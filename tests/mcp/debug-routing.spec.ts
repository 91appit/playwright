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

test('debug instance routing', async ({ startClient }) => {
  const { client } = await startClient();

  console.log('=== Initial state ===');
  const initialList = await client.callTool({
    name: 'list_browser_instances',
    arguments: {}
  });
  console.log('Initial instances:', initialList.content[0].text);

  console.log('=== Creating two instances ===');
  await client.callTool({
    name: 'create_browser_instance',
    arguments: { browserType: 'chromium' }
  });
  await client.callTool({
    name: 'create_browser_instance',
    arguments: { browserType: 'firefox' }
  });

  console.log('=== Listing instances after creation ===');
  const afterList = await client.callTool({
    name: 'list_browser_instances',
    arguments: {}
  });
  console.log('After creation:', afterList.content[0].text);

  console.log('=== Trying navigation without instanceId ===');
  try {
    const result = await client.callTool({
      name: 'browser_navigate',
      arguments: { url: 'data:text/html,<h1>Test</h1>' }
    });
    console.log('Navigation succeeded unexpectedly:', result);
  } catch (error) {
    console.log('Navigation failed as expected:', error);
  }
});
