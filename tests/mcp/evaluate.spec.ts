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

test('browser_evaluate', async ({ client, server }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    pageState: expect.stringContaining(`- Page Title: Title`),
  });

  expect(await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: '() => document.title',
    },
  })).toHaveResponse({
    result: `"Title"`,
    code: `await page.evaluate('() => document.title');`,
  });
});

test('browser_evaluate (element)', async ({ client, server }) => {
  server.setContent('/', `
    <body style="background-color: red">Hello, world!</body>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: 'element => element.style.backgroundColor',
      element: 'body',
      ref: 'e1',
    },
  })).toHaveResponse({
    result: `"red"`,
    code: `await page.getByText('Hello, world!').evaluate('element => element.style.backgroundColor');`,
  });
});

test('browser_evaluate object', async ({ client, server }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    pageState: expect.stringContaining(`- Page Title: Title`),
  });

  expect(await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: '() => ({ title: document.title, url: document.URL })',
    },
  })).toHaveResponse({
    result: JSON.stringify({ title: 'Title', url: server.HELLO_WORLD }, null, 2),
    code: `await page.evaluate('() => ({ title: document.title, url: document.URL })');`,
  });
});

test('browser_evaluate (error)', async ({ client, server }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    pageState: expect.stringContaining(`- Page Title: Title`),
  });

  const result = await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: '() => nonExistentVariable',
    },
  });

  expect(result.isError).toBe(true);
  expect(result.content?.[0]?.text).toContain('nonExistentVariable');
  // Check for common error patterns across browsers
  const errorText = result.content?.[0]?.text || '';
  expect(errorText).toMatch(/not defined|Can't find variable/);
});

test('browser_evaluate with instanceId in multi-instance environment', async ({ startClient }) => {
  const { client } = await startClient(); // Start in dynamic mode

  // Create two browser instances
  const chrome1Result = await client.callTool({
    name: 'create_browser_instance',
    arguments: { browserType: 'chromium' }
  });
  const chromeMatch = chrome1Result.content[0].text.match(/ID: (browser-[a-zA-Z0-9-]+)/);
  expect(chromeMatch).toBeTruthy();
  const chromeInstanceId = chromeMatch![1];

  const chrome2Result = await client.callTool({
    name: 'create_browser_instance',
    arguments: { browserType: 'chromium' }
  });
  const chrome2Match = chrome2Result.content[0].text.match(/ID: (browser-[a-zA-Z0-9-]+)/);
  expect(chrome2Match).toBeTruthy();
  const chrome2InstanceId = chrome2Match![1];

  // Navigate first instance
  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><head><title>Instance 1</title></head><body>First</body></html>',
      instanceId: chromeInstanceId
    }
  });

  // Evaluate on first instance - should work
  const result1 = await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: '() => document.title',
      instanceId: chromeInstanceId
    }
  });
  expect(result1).toHaveResponse({
    result: `"Instance 1"`,
  });

  // Try to use evaluate without instanceId when multiple instances exist - should fail
  const resultNoId = await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: '() => document.title'
    }
  });
  expect(resultNoId.isError).toBe(true);
  expect(resultNoId.content[0].text).toContain('Multiple browser instances available');

  // Clean up
  await client.callTool({
    name: 'close_browser_instance',
    arguments: { instanceId: chromeInstanceId }
  });
  await client.callTool({
    name: 'close_browser_instance',
    arguments: { instanceId: chrome2InstanceId }
  });
});
