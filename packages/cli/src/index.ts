#!/usr/bin/env node
/**
 * @beans/cli - AI Agent Command Line Interface
 *
 * Main entry point for the CLI application.
 */

import { parseArgs } from './args.js';
import { runApp } from './app.js';
import { Config } from '@beans/core';

async function main() {
  const args = await parseArgs();

  if (args.version) {
    console.log('beans-agent v0.1.0');
    process.exit(0);
  }

  if (args.help) {
    console.log(`
beans-agent - AI-powered stock trading assistant

Usage:
  beans [options] [prompt]

Options:
  -h, --help       Show this help message
  -v, --version    Show version number
  -c, --continue   Continue previous session
  -m, --model      Specify model to use
  --list-models    List available models for the current provider
  --yolo           Auto-approve all tool calls

Examples:
  beans "analyze AAPL stock performance"
  beans --model gpt-4o "what are the best tech stocks to buy?"
  beans "explain RSI indicator"
  beans --list-models
`);
    process.exit(0);
  }

  if (args.listModels) {
    const config = await Config.getInstance();
    const client = config.getLLMClient();
    const llmConfig = config.getLLMConfig();

    console.log(`\nAvailable models for ${llmConfig.provider}:\n`);

    if (client.listModels) {
      try {
        const models = await client.listModels();
        for (const model of models) {
          const desc = model.description ? ` - ${model.description}` : '';
          console.log(`  ${model.id}${desc}`);
        }
      } catch (error) {
        console.error(`Error listing models: ${error instanceof Error ? error.message : error}`);
      }
    } else {
      console.log('  Model listing not supported for this provider');
    }

    process.exit(0);
  }

  await runApp(args);
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
