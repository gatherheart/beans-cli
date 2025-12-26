#!/usr/bin/env node
/**
 * @beans/cli - AI Agent Command Line Interface
 *
 * Main entry point for the CLI application.
 */

import { parseArgs } from './args.js';
import { runApp } from './app.js';

async function main() {
  const args = await parseArgs();

  if (args.version) {
    console.log('beans-agent v0.1.0');
    process.exit(0);
  }

  if (args.help) {
    console.log(`
beans-agent - AI-powered coding assistant

Usage:
  beans [options] [prompt]

Options:
  -h, --help      Show this help message
  -v, --version   Show version number
  -c, --continue  Continue previous session
  -m, --model     Specify model to use
  --yolo          Auto-approve all tool calls

Examples:
  beans "fix the bug in main.ts"
  beans --model gpt-4o "add unit tests"
  beans --continue
`);
    process.exit(0);
  }

  await runApp(args);
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
