#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'chat') {
  const { runChat } = await import('./chat.mjs');
  process.exitCode = await runChat(args.slice(1));
} else if (args.length === 1 && args[0] === 'demo') {
  await import('../src/kernel/interface/demo.mjs');
} else {
  console.error('Usage: legion demo | legion chat [--project path] [--user-data path] [--protocol protocol --provider provider --model model --base-url url]');
  process.exitCode = 2;
}
