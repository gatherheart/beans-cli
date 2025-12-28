/**
 * Main application entry point
 */

import type { CLIArgs } from './args.js';
import { Config } from '@beans/core';
import { AgentExecutor } from '@beans/core';
import { SessionManager } from '@beans/core';
import { WorkspaceService } from '@beans/core';

/**
 * Run the CLI application
 */
export async function runApp(args: CLIArgs): Promise<void> {
  // Initialize configuration
  const config = await Config.getInstance();

  // Override model if specified
  if (args.model) {
    await config.updateConfig({
      llm: { ...config.getLLMConfig(), model: args.model },
    });
  }

  // Override auto-approve if yolo mode
  if (args.yolo) {
    await config.updateConfig({
      agent: { ...config.getAgentConfig(), autoApprove: 'all' },
    });
  }

  // Initialize workspace for data storage
  const workspaceService = new WorkspaceService(args.cwd ?? process.cwd());
  const workspaceContext = await workspaceService.getContext();

  // Initialize session
  const sessionManager = new SessionManager();

  console.log(`\n📈 Stock Trading Agent v0.1.0`);
  console.log(`📁 Workspace: ${workspaceContext.rootPath}`);
  console.log(`💹 Ready to assist with stock analysis and trading decisions`);
  console.log('');

  // Create agent executor
  const executor = new AgentExecutor(
    config.getLLMClient(),
    config.getToolRegistry()
  );

  // If we have an initial prompt, run it
  if (args.prompt) {
    console.log(`> ${args.prompt}\n`);

    const result = await executor.execute(
      {
        name: 'stock_trading_agent',
        description: 'AI stock trading assistant',
        promptConfig: {
          systemPrompt: buildSystemPrompt(),
          query: args.prompt,
        },
        modelConfig: config.getLLMConfig(),
        runConfig: config.getAgentConfig(),
        toolConfig: {
          allowAllTools: true,
        },
      },
      {
        onActivity: (event) => {
          switch (event.type) {
            case 'content_chunk':
              process.stdout.write(event.content);
              break;
            case 'tool_call_start':
              console.log(`\n🔧 ${event.toolCall.name}...`);
              break;
            case 'tool_call_end':
              console.log(`   ✅ Done`);
              break;
            case 'error':
              console.error(`\n❌ Error: ${event.error.message}`);
              break;
          }
        },
      }
    );

    console.log('\n');

    if (!result.success) {
      console.error(`Session ended with error: ${result.error}`);
    }

    // Print session summary
    const metrics = sessionManager.getMetrics();
    console.log(`📊 Session: ${metrics.turnCount} turns, ${metrics.totalTokens} tokens`);
  } else {
    // Interactive mode - TODO: implement REPL
    console.log('Interactive mode coming soon...');
    console.log('For now, provide a prompt: beans "your prompt here"');
  }
}

/**
 * Build the system prompt for stock trading agent
 */
function buildSystemPrompt(): string {
  return `You are an AI Stock Trading Agent. You help users with stock market analysis, trading strategies, and investment decisions.

Your capabilities:
- Analyze stock market trends and patterns
- Provide technical and fundamental analysis
- Suggest trading strategies based on market conditions
- Help with portfolio management and risk assessment
- Explain market concepts and trading terminology
- Monitor and analyze stock performance

Guidelines:
- Always remind users that stock trading involves risk
- Provide balanced analysis with both bullish and bearish perspectives
- Base recommendations on data and analysis, not speculation
- Clearly state when information may be outdated
- Encourage users to do their own research before making investment decisions
- Never guarantee returns or promise specific outcomes

Important disclaimers:
- This is for informational purposes only, not financial advice
- Past performance does not guarantee future results
- Users should consult with licensed financial advisors for personalized advice`;
}
