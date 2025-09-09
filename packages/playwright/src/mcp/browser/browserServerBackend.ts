/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { fileURLToPath } from 'url';
import { FullConfig } from './config';
import { Context } from './context';
import { logUnhandledError } from '../log';
import { Response } from './response';
import { SessionLog } from './sessionLog';
import { filteredTools } from './tools';
import { toMcpTool } from '../sdk/tool';
import { contextFactory } from './browserContextFactory';
import { z } from '../sdk/bundle';

import type { Tool } from './tools/tool';
import type { BrowserContextFactory } from './browserContextFactory';
import type * as mcpServer from '../sdk/server';
import type { ServerBackend } from '../sdk/server';

export class BrowserServerBackend implements ServerBackend {
  private _tools: Tool[];
  private _contexts: Map<string, Context>;
  private _defaultContextId: string | undefined;
  private _sessionLog: SessionLog | undefined;
  private _config: FullConfig;
  private _browserContextFactory: BrowserContextFactory;

  constructor(config: FullConfig, factory: BrowserContextFactory) {
    this._config = config;
    this._browserContextFactory = factory;
    this._tools = filteredTools(config);
    this._contexts = new Map();
  }

  async initialize(server: mcpServer.Server, clientVersion: mcpServer.ClientVersion, roots: mcpServer.Root[]): Promise<void> {
    let rootPath: string | undefined;
    if (roots.length > 0) {
      const firstRootUri = roots[0]?.uri;
      const url = firstRootUri ? new URL(firstRootUri) : undefined;
      rootPath = url ? fileURLToPath(url) : undefined;
    }
    this._sessionLog = this._config.saveSession ? await SessionLog.create(this._config, rootPath) : undefined;
    
    // Legacy mode: If browser is configured, create a default context
    if (this._config.browser.browserName) {
      this._defaultContextId = 'default';
      const context = new Context({
        tools: this._tools,
        config: this._config,
        browserContextFactory: this._browserContextFactory,
        sessionLog: this._sessionLog,
        clientInfo: { ...clientVersion, rootPath },
      });
      this._contexts.set(this._defaultContextId, context);
    }
  }

  async listTools(): Promise<mcpServer.Tool[]> {
    return this._tools.map(tool => toMcpTool(tool.schema));
  }

  async callTool(name: string, rawArguments: mcpServer.CallToolRequest['params']['arguments']) {
    const tool = this._tools.find(tool => tool.schema.name === name)!;
    if (!tool)
      throw new Error(`Tool "${name}" not found`);
    
    // Handle browser management tools specially
    if (name === 'create_browser_instance') {
      return this._handleCreateBrowserInstance(rawArguments);
    }
    if (name === 'close_browser_instance') {
      return this._handleCloseBrowserInstance(rawArguments);
    }
    if (name === 'list_browser_instances') {
      return this._handleListBrowserInstances(rawArguments);
    }
    
    const parsedArguments = tool.schema.inputSchema.parse(rawArguments || {});
    
    // Determine which context to use
    let context: Context;
    const instanceId = (parsedArguments as any).instanceId;
    
    console.log(`[DEBUG] Tool: ${name}, instanceId: ${instanceId}, contexts.size: ${this._contexts.size}`);
    
    if (instanceId) {
      // Multi-browser mode: Use specified instance
      const targetContext = this._contexts.get(instanceId);
      if (!targetContext) {
        throw new Error(`Browser instance "${instanceId}" not found. Use create_browser_instance to create a new instance or check the instanceId.`);
      }
      context = targetContext;
      console.log(`[DEBUG] Using specified instanceId: ${instanceId}`);
    } else {
      // Legacy mode behavior when no instanceId provided
      console.log(`[DEBUG] No instanceId provided, contexts: ${Array.from(this._contexts.keys()).join(', ')}`);
      if (this._contexts.size === 0) {
        throw new Error('No browser instances available. Use create_browser_instance to create a new instance or specify a browser type at startup.');
      } else if (this._contexts.size === 1) {
        // If only one context exists, use it (regardless of whether it's default or not)
        const firstContext = this._contexts.values().next().value;
        if (!firstContext) {
          throw new Error('Unexpected error: context map corrupted.');
        }
        context = firstContext;
        console.log(`[DEBUG] Using single context: ${Array.from(this._contexts.keys())[0]}`);
      } else {
        // Multiple contexts exist - require instanceId
        console.log(`[DEBUG] Multiple contexts exist, should throw error`);
        throw new Error('Multiple browser instances available. Please specify instanceId parameter to choose which browser instance to use.');
      }
    }
    
    const response = new Response(context, name, parsedArguments);
    context.setRunningTool(name);
    try {
      await tool.handle(context, parsedArguments, response);
      await response.finish();
      this._sessionLog?.logResponse(response);
    } catch (error: any) {
      response.addError(String(error));
    } finally {
      context.setRunningTool(undefined);
    }
    return response.serialize();
  }

  serverClosed() {
    void Promise.all(
      Array.from(this._contexts.values()).map(context => context.dispose().catch(logUnhandledError))
    );
  }

  /**
   * Create a new browser instance with the specified browser type
   */
  async createBrowserInstance(browserType: 'chromium' | 'firefox' | 'webkit', clientInfo?: any): Promise<string> {
    const instanceId = this._generateInstanceId();
    
    // Create a temporary config with the specified browser type
    const instanceConfig = {
      ...this._config,
      browser: {
        ...this._config.browser,
        browserName: browserType,
      }
    };
    
    // Create a new context factory for this browser type
    const instanceFactory = this._createBrowserContextFactory(instanceConfig);
    
    const context = new Context({
      tools: this._tools,
      config: instanceConfig,
      browserContextFactory: instanceFactory,
      sessionLog: this._sessionLog,
      clientInfo: clientInfo || { name: 'MCP', version: '1.0.0' },
    });
    
    this._contexts.set(instanceId, context);
    return instanceId;
  }

  /**
   * Close and dispose a browser instance
   */
  async closeBrowserInstance(instanceId: string): Promise<void> {
    const context = this._contexts.get(instanceId);
    if (!context) {
      throw new Error(`Browser instance "${instanceId}" not found.`);
    }
    
    await context.dispose();
    this._contexts.delete(instanceId);
    
    // If this was the default context, clear the default
    if (this._defaultContextId === instanceId) {
      this._defaultContextId = undefined;
    }
  }

  /**
   * Get list of active browser instances
   */
  getActiveInstances(): Array<{ instanceId: string, browserType: string }> {
    return Array.from(this._contexts.entries()).map(([instanceId, context]) => ({
      instanceId,
      browserType: context.config.browser.browserName || 'unknown',
    }));
  }

  private _generateInstanceId(): string {
    return `browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private _createBrowserContextFactory(config: FullConfig): BrowserContextFactory {
    return contextFactory(config);
  }

  private async _handleCreateBrowserInstance(rawArguments: any) {
    const schema = z.object({
      browserType: z.enum(['chromium', 'firefox', 'webkit']).describe('The type of browser to launch'),
    });
    const params = schema.parse(rawArguments || {});
    
    // Create a mock context for the response (we don't have a browser context yet)
    const mockContext = {
      tools: this._tools,
      config: this._config,
      sessionLog: this._sessionLog,
      options: null,
      tabs: () => [],
      currentTab: () => undefined,
      currentTabOrDie: () => { throw new Error('No context available for browser management'); },
    } as any;
    
    const response = new Response(mockContext, 'create_browser_instance', params);
    
    try {
      const instanceId = await this.createBrowserInstance(params.browserType);
      response.addResult(`Successfully created ${params.browserType} browser instance with ID: ${instanceId}`);
      return response.serialize();
    } catch (error: any) {
      response.addError(`Error creating browser instance: ${error.message}`);
      return response.serialize();
    }
  }

  private async _handleCloseBrowserInstance(rawArguments: any) {
    const schema = z.object({
      instanceId: z.string().describe('The instanceId of the browser instance to close'),
    });
    const params = schema.parse(rawArguments || {});
    
    const mockContext = {
      tools: this._tools,
      config: this._config,
      sessionLog: this._sessionLog,
      options: null,
      tabs: () => [],
      currentTab: () => undefined,
      currentTabOrDie: () => { throw new Error('No context available for browser management'); },
    } as any;
    
    const response = new Response(mockContext, 'close_browser_instance', params);
    
    try {
      await this.closeBrowserInstance(params.instanceId);
      response.addResult(`Successfully closed browser instance: ${params.instanceId}`);
      return response.serialize();
    } catch (error: any) {
      response.addError(`Error closing browser instance: ${error.message}`);
      return response.serialize();
    }
  }

  private async _handleListBrowserInstances(rawArguments: any) {
    const mockContext = {
      tools: this._tools,
      config: this._config,
      sessionLog: this._sessionLog,
      options: null,
      tabs: () => [],
      currentTab: () => undefined,
      currentTabOrDie: () => { throw new Error('No context available for browser management'); },
    } as any;
    
    const response = new Response(mockContext, 'list_browser_instances', {});
    
    try {
      const instances = this.getActiveInstances();
      const instancesText = instances.length > 0 
        ? instances.map(inst => `- ${inst.instanceId} (${inst.browserType})`).join('\n')
        : 'No active browser instances';
        
      response.addResult(`Active browser instances:\n${instancesText}`);
      return response.serialize();
    } catch (error: any) {
      response.addError(`Error listing browser instances: ${error.message}`);
      return response.serialize();
    }
  }
}
