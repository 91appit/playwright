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

import { z } from '../../sdk/bundle';
import { defineTool } from './tool';

const createBrowserInstance = defineTool({
  capability: 'core',

  schema: {
    name: 'create_browser_instance',
    title: 'Create Browser Instance',
    description: 'Create a new browser instance with the specified browser type. Returns an instanceId that can be used with other tools.',
    inputSchema: z.object({
      browserType: z.enum(['chromium', 'firefox', 'webkit']).describe('The type of browser to launch. Chromium includes Chrome, Edge, and other Chromium-based browsers.'),
    }),
    type: 'destructive',
  },

  handle: async (context, params, response) => {
    // Since this is a management tool, we need to access the BrowserServerBackend
    // We'll need to implement this differently - we need access to the backend from the context
    throw new Error('Browser management tools need to be implemented at the backend level');
  },
});

const closeBrowserInstance = defineTool({
  capability: 'core',

  schema: {
    name: 'close_browser_instance',
    title: 'Close Browser Instance',
    description: 'Close and dispose a browser instance by its instanceId. All tabs and resources associated with this instance will be cleaned up.',
    inputSchema: z.object({
      instanceId: z.string().describe('The instanceId of the browser instance to close'),
    }),
    type: 'destructive',
  },

  handle: async (context, params, response) => {
    // Since this is a management tool, we need to access the BrowserServerBackend
    // We'll need to implement this differently - we need access to the backend from the context
    throw new Error('Browser management tools need to be implemented at the backend level');
  },
});

const listBrowserInstances = defineTool({
  capability: 'core',

  schema: {
    name: 'list_browser_instances', 
    title: 'List Browser Instances',
    description: 'List all active browser instances with their instanceIds and browser types',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    // Since this is a management tool, we need to access the BrowserServerBackend
    // We'll need to implement this differently - we need access to the backend from the context
    throw new Error('Browser management tools need to be implemented at the backend level');
  },
});

export default [
  createBrowserInstance,
  closeBrowserInstance,
  listBrowserInstances,
];