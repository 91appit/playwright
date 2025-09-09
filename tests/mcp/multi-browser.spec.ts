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

import { test, expect } from './fixtures';

test.describe('multi-browser support', () => {
  test('should create and manage multiple browser instances', async ({ startClient }) => {
    const { client } = await startClient(); // Start in dynamic mode (no browser specified)

    // First, verify we start with no instances (dynamic mode)
    const initialList = await client.callTool({
      name: 'list_browser_instances',
      arguments: {}
    });
    
    // If we started with a default instance, we need to close it first to test dynamic mode
    if (initialList.content[0].text.includes('default')) {
      await client.callTool({
        name: 'close_browser_instance',
        arguments: { instanceId: 'default' }
      });
      
      // Verify no instances after closing default
      const emptyList = await client.callTool({
        name: 'list_browser_instances',
        arguments: {}
      });
      expect(emptyList.content[0].text).toContain('No active browser instances');
    }

    // Create a chromium instance
    const chromeResult = await client.callTool({
      name: 'create_browser_instance',
      arguments: { browserType: 'chromium' }
    });
    expect(chromeResult.content[0].text).toContain('Successfully created chromium browser instance');
    expect(chromeResult.content[0].text).toContain('ID: browser-');
    
    // Extract instance ID from response text
    const chromeMatch = chromeResult.content[0].text.match(/ID: (browser-[a-zA-Z0-9-]+)/);
    expect(chromeMatch).toBeTruthy();
    const chromeInstanceId = chromeMatch![1];

    // Create a firefox instance  
    const firefoxResult = await client.callTool({
      name: 'create_browser_instance',
      arguments: { browserType: 'firefox' }
    });
    expect(firefoxResult.content[0].text).toContain('Successfully created firefox browser instance');
    
    const firefoxMatch = firefoxResult.content[0].text.match(/ID: (browser-[a-zA-Z0-9-]+)/);
    expect(firefoxMatch).toBeTruthy();
    const firefoxInstanceId = firefoxMatch![1];

    // List instances - should show both
    const listResult = await client.callTool({
      name: 'list_browser_instances',
      arguments: {}
    });
    expect(listResult.content[0].text).toContain(chromeInstanceId);
    expect(listResult.content[0].text).toContain(firefoxInstanceId);
    expect(listResult.content[0].text).toContain('chromium');
    expect(listResult.content[0].text).toContain('firefox');

    // Try to navigate with specific instance ID (use server.HELLO_WORLD for a working URL)
    await client.callTool({
      name: 'browser_navigate',
      arguments: {
        url: 'data:text/html,<h1>Chrome Test</h1>',
        instanceId: chromeInstanceId
      }
    });

    await client.callTool({
      name: 'browser_navigate',
      arguments: {
        url: 'data:text/html,<h1>Firefox Test</h1>',
        instanceId: firefoxInstanceId
      }
    });

    // Close one instance
    const closeResult = await client.callTool({
      name: 'close_browser_instance',
      arguments: { instanceId: firefoxInstanceId }
    });
    expect(closeResult.content[0].text).toContain(`Successfully closed browser instance: ${firefoxInstanceId}`);

    // List instances - should show only one now
    const listResultAfterClose = await client.callTool({
      name: 'list_browser_instances',
      arguments: {}
    });
    expect(listResultAfterClose.content[0].text).toContain(chromeInstanceId);
    expect(listResultAfterClose.content[0].text).not.toContain(firefoxInstanceId);

    // Close remaining instance
    await client.callTool({
      name: 'close_browser_instance',
      arguments: { instanceId: chromeInstanceId }
    });

    // List instances - should be empty
    const listResultFinal = await client.callTool({
      name: 'list_browser_instances',
      arguments: {}
    });
    expect(listResultFinal.content[0].text).toContain('No active browser instances');
  });

  test('should handle invalid instance IDs gracefully', async ({ startClient }) => {
    const { client } = await startClient();

    // Try to use a non-existent instance ID - should fail
    const result = await client.callTool({
      name: 'browser_navigate',
      arguments: {
        url: 'data:text/html,<h1>Test</h1>',
        instanceId: 'non-existent-id'
      }
    });
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Browser instance "non-existent-id" not found');
  });

  test('should work without instanceId in legacy mode', async ({ startClient }) => {
    const { client } = await startClient({ args: ['--browser=chromium'] });

    // This should work without instanceId in legacy mode
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: 'data:text/html,<h1>Legacy Test</h1>' }
    });

    // Should also work with tools that don't need instanceId
    await client.callTool({
      name: 'browser_take_screenshot',
      arguments: { filename: 'test.png' }
    });
  });

  test('should require instanceId when multiple browsers exist', async ({ startClient }) => {
    const { client } = await startClient();

    // Create two instances
    await client.callTool({
      name: 'create_browser_instance',
      arguments: { browserType: 'chromium' }
    });
    await client.callTool({
      name: 'create_browser_instance',
      arguments: { browserType: 'firefox' }
    });

    // List instances to verify we have two
    const listResult = await client.callTool({
      name: 'list_browser_instances',
      arguments: {}
    });
    console.log('Instances after creating two:', listResult.content[0].text);

    // Try to navigate without instanceId - should fail
    const result = await client.callTool({
      name: 'browser_navigate',
      arguments: { url: 'data:text/html,<h1>Test</h1>' }
    });
    
    console.log('Navigation result:', result);
    console.log('isError:', result.isError);
    console.log('Content:', result.content[0].text);
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Multiple browser instances available');
  });
});