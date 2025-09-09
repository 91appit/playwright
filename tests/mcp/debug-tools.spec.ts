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

test('list all tools', async ({ startClient }) => {
  const { client } = await startClient();
  
  const tools = await client.listTools();
  console.log('Available tools:');
  tools.tools.forEach(tool => {
    console.log(`- ${tool.name}: ${tool.description}`);
  });
  
  const toolNames = tools.tools.map(t => t.name);
  expect(toolNames).toContain('create_browser_instance');
  expect(toolNames).toContain('close_browser_instance');
  expect(toolNames).toContain('list_browser_instances');
});