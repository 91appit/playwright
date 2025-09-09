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

    // Create a chromium instance
    const chromeResult = await client.callTool({
      name: 'create_browser_instance',
      arguments: { browserType: 'chromium' }
    });
    expect(chromeResult.meta?.instanceId).toBeTruthy();
    expect(chromeResult.meta?.browserType).toBe('chromium');
    const chromeInstanceId = chromeResult.meta?.instanceId;

    // Create a firefox instance
    const firefoxResult = await client.callTool({
      name: 'create_browser_instance',
      arguments: { browserType: 'firefox' }
    });
    expect(firefoxResult.meta?.instanceId).toBeTruthy();
    expect(firefoxResult.meta?.browserType).toBe('firefox');
    const firefoxInstanceId = firefoxResult.meta?.instanceId;

    // List instances - should show both
    const listResult = await client.callTool({
      name: 'list_browser_instances',
      arguments: {}
    });
    expect(listResult.meta?.count).toBe(2);
    expect(listResult.meta?.instances).toHaveLength(2);

    // Navigate with specific instance ID
    await client.callTool({
      name: 'browser_navigate',
      arguments: {
        url: 'https://example.com',
        instanceId: chromeInstanceId
      }
    });

    await client.callTool({
      name: 'browser_navigate',
      arguments: {
        url: 'https://google.com',
        instanceId: firefoxInstanceId
      }
    });

    // Close one instance
    await client.callTool({
      name: 'close_browser_instance',
      arguments: { instanceId: firefoxInstanceId }
    });

    // List instances - should show only one now
    const listResultAfterClose = await client.callTool({
      name: 'list_browser_instances',
      arguments: {}
    });
    expect(listResultAfterClose.meta?.count).toBe(1);
    expect(listResultAfterClose.meta?.instances).toHaveLength(1);
    expect(listResultAfterClose.meta?.instances[0].instanceId).toBe(chromeInstanceId);

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
    expect(listResultFinal.meta?.count).toBe(0);
  });

  test('should handle invalid instance IDs gracefully', async ({ startClient }) => {
    const { client } = await startClient();

    // Try to use a non-existent instance ID
    const result = await client.callTool({
      name: 'browser_navigate',
      arguments: {
        url: 'https://example.com',
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
      arguments: { url: 'https://example.com' }
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

    // Try to navigate without instanceId - should fail
    const result = await client.callTool({
      name: 'browser_navigate',
      arguments: { url: 'https://example.com' }
    });
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Multiple browser instances available');
  });
});