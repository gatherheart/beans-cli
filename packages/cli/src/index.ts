#!/usr/bin/env node
/**
 * @beans/cli - AI Agent Command Line Interface
 *
 * Main entry point for the CLI application.
 */

import { parseArgs } from "./args.js";
import { runApp } from "./app.js";
import { runEval } from "./eval.js";
import { handleFineTuneCommand } from "./fineTune.js";
import { handleOllamaLocalizerCommand } from "./ollamaLocalizer.js";
import { Config } from "@beans/core";

async function main() {
  const args = await parseArgs();

  if (args.version) {
    console.log("beans-agent v0.1.0");
    process.exit(0);
  }

  if (args.help) {
    console.log(`
beans-agent - AI-powered dynamic agent framework

Usage:
  beans [options] [prompt]

Options:
  -h, --help              Show this help message
  -v, --version           Show version number
  -c, --continue          Continue previous session
  -m, --model             Specify model to use
  -a, --agent <desc>      Generate agent from description
  --agent-profile <path>  Load agent profile from file
  --sop <text>            Inject SOP into agent
  --sop-file <path>       Load SOP from file
  --list-models           List available models for the current provider
  --fine-tune <path>      Upload a JSONL file and create an OpenAI fine-tuning job
  --fine-tune-model <id>  Base OpenAI model for fine-tuning
  --fine-tune-validation-file <path>
                          Optional JSONL validation file for fine-tuning
  --fine-tune-suffix <s>  Optional suffix for the fine-tuned model name
  --list-fine-tunes       List OpenAI fine-tuning jobs
  --fine-tune-job <id>    Show an OpenAI fine-tuning job and recent events
  --create-ollama-localizer <name>
                          Build a localization-focused Ollama model from a base model
  --ollama-base-model <id>
                          Base Ollama model to customize (default: qwen2.5:3b)
  --localization-language <name>
                          Target language for the localization prompt
  --localization-rules-file <path>
                          Optional file with extra localization rules
  --ollama-parameter <key=value>
                          Add a raw Modelfile PARAMETER line (repeatable)
  --yolo                  Auto-approve all tool calls
  --debug                 Show LLM requests and responses for debugging

Evaluation:
  --eval                  Run benchmark evaluation
  --benchmark <name>      Benchmark to run (e.g., mbpp)
  --limit <n>             Limit to first N problems
  --offset <n>            Skip first N problems
  --output <path>         Output report file (.json or .md)
  --resume <run-id>       Resume from previous run
  --timeout <ms>          Timeout per problem (default: 30000)
  --agentic               Enable agentic mode (iterate on failures)
  --max-iterations <n>    Max iterations per problem (default: 5)
  --baseline-report <path> Reuse initial answers from a single-pass JSON report
  --blind-retry           Retry failures with only the original prompt
  --review-preparation <mode>
                          Related-code retrieval: sequential, eager, predictive
  --review-cases <path>   JSON corpus of disjoint historical review cases
  --prediction-threshold <p>
                          Minimum predicted review probability (default: 0.2)

Examples:
  beans "help me refactor this code"
  beans -a "A helpful coding assistant" "review my code"
  beans --agent-profile ./my-agent.json
  beans --sop "Always explain step by step"
  beans --list-models
  beans --fine-tune ./data/ko-localization.jsonl --fine-tune-model gpt-4o-mini
  beans --fine-tune-job ftjob_abc123
  beans --create-ollama-localizer finance-localizer --ollama-base-model qwen2.5:3b --localization-language English --ollama-parameter temperature=0.1
  beans --eval --benchmark mbpp --limit 10
  beans --eval --benchmark mbpp --agentic --limit 10
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
          const desc = model.description ? ` - ${model.description}` : "";
          console.log(`  ${model.id}${desc}`);
        }
      } catch (error) {
        console.error(
          `Error listing models: ${error instanceof Error ? error.message : error}`,
        );
      }
    } else {
      console.log("  Model listing not supported for this provider");
    }

    process.exit(0);
  }

  if (await handleFineTuneCommand(args)) {
    process.exit(0);
  }

  if (await handleOllamaLocalizerCommand(args)) {
    process.exit(0);
  }

  // Route to evaluation mode
  if (args.eval) {
    await runEval(args);
    process.exit(0);
  }

  await runApp(args);
}

main().catch((error) => {
  console.error("Fatal error:", error.message);
  process.exit(1);
});
