/**
 * Evaluation command handler
 */

import type { CLIArgs } from './args.js';
import { Config, ChatSession } from '@beans/core';
import {
  EvalRunner,
  AgenticEvalRunner,
  generateMarkdownReport,
  writeJsonReport,
  writeMarkdownReport,
  type EvalRunnerConfig,
} from '@beans/eval';

const CODE_GEN_SYSTEM_PROMPT = `You are a Python code generator. When given a problem description, write a Python function that solves it.

Rules:
- Output ONLY the Python code, no explanations
- Use proper Python syntax and conventions
- Include the function definition
- Do not include test cases or examples`;

const AGENTIC_SYSTEM_PROMPT = `You are a Python code generator that writes correct code through iteration.

When given a problem:
1. Write a Python function to solve it
2. If tests fail, analyze the error and fix your code
3. Keep iterating until ALL tests pass

Rules:
- Output ONLY the Python code (no markdown, no explanations)
- The function name and signature must match what the tests expect
- Pay attention to edge cases
- Learn from test failures to fix your code`;

/**
 * Run benchmark evaluation
 */
export async function runEval(args: CLIArgs): Promise<void> {
  if (!args.benchmark) {
    console.error('Error: --benchmark is required for --eval');
    console.error('Usage: beans --eval --benchmark mbpp');
    process.exit(1);
  }

  // Initialize configuration
  const config = await Config.getInstance();

  // Override model if specified
  if (args.model) {
    await config.updateConfig({
      llm: { ...config.getLLMConfig(), model: args.model },
    });
  }

  const llmConfig = config.getLLMConfig();
  const isAgentic = args.agentic;
  const maxIterations = args.maxIterations ?? 5;

  console.log(`\n📊 Starting ${args.benchmark.toUpperCase()} Evaluation`);
  console.log(`   Model: ${llmConfig.model}`);
  console.log(`   Mode: ${isAgentic ? `Agentic (max ${maxIterations} iterations)` : 'Single-shot'}`);
  if (args.limit) console.log(`   Limit: ${args.limit} problems`);
  if (args.resume) console.log(`   Resuming from: ${args.resume}`);
  console.log('');

  // Create chat session for the evaluation
  const session = new ChatSession(config.getLLMClient(), config.getToolRegistry(), {
    systemPrompt: isAgentic ? AGENTIC_SYSTEM_PROMPT : CODE_GEN_SYSTEM_PROMPT,
    modelConfig: llmConfig,
    toolConfig: { allowAllTools: false },
  });

  // Build runner config
  const evalConfig: EvalRunnerConfig = {
    benchmark: args.benchmark,
    model: llmConfig.model,
    limit: args.limit,
    offset: args.offset,
    output: args.output,
    runId: args.resume,
    timeout: args.timeout ?? 30000,
    sanitized: true,
    agentic: isAgentic,
    maxIterations,
  };

  // Create appropriate runner
  const runner = isAgentic
    ? new AgenticEvalRunner(session)
    : new EvalRunner(session);

  const startTime = Date.now();
  let lastProgressTime = 0;

  const result = await runner.run(evalConfig, (progress) => {
    const now = Date.now();
    // Throttle progress updates to every 500ms
    if (now - lastProgressTime < 500 && progress.current !== progress.total) {
      return;
    }
    lastProgressTime = now;

    const pct = ((progress.current / progress.total) * 100).toFixed(1);
    const status = progress.result
      ? progress.result.success
        ? '✅'
        : '❌'
      : '⏳';
    const iterations = progress.result?.metrics.turnCount ?? 0;
    const iterInfo = isAgentic && iterations > 0 ? ` [${iterations} iter]` : '';
    process.stdout.write(
      `\r   ${status} Problem ${progress.problemId}${iterInfo} (${progress.current}/${progress.total} - ${pct}%)   `
    );
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n');

  // Print summary
  console.log('📈 Results Summary');
  console.log(`   Total: ${result.report.summary.total}`);
  console.log(`   Passed: ${result.report.summary.passed}`);
  console.log(`   Pass Rate: ${(result.report.summary.passRate * 100).toFixed(1)}%`);
  if (isAgentic && result.report.summary.avgIterations !== undefined) {
    console.log(`   Avg Iterations: ${result.report.summary.avgIterations.toFixed(1)}`);
  }
  console.log(`   Duration: ${duration}s`);
  console.log(`   Run ID: ${result.runId}`);
  if (result.resumed) console.log(`   (Resumed from previous run)`);
  console.log('');

  // Output reports
  if (args.output) {
    if (args.output.endsWith('.json')) {
      await writeJsonReport(result.report, args.output);
      console.log(`📄 JSON report saved to: ${args.output}`);
    } else if (args.output.endsWith('.md')) {
      await writeMarkdownReport(result.report, args.output);
      console.log(`📄 Markdown report saved to: ${args.output}`);
    } else {
      // Default to JSON
      const jsonPath = args.output + '.json';
      const mdPath = args.output + '.md';
      await writeJsonReport(result.report, jsonPath);
      await writeMarkdownReport(result.report, mdPath);
      console.log(`📄 Reports saved to: ${jsonPath}, ${mdPath}`);
    }
  } else {
    // Print markdown report to stdout
    console.log(generateMarkdownReport(result.report));
  }
}
