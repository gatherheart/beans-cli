/**
 * Main application entry point
 */

import readline from 'node:readline';
import type { CLIArgs } from './args.js';
import { Config } from '@beans/core';
import { AgentExecutor, ChatSession } from '@beans/core';
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

  const systemPrompt = buildSystemPrompt();

  // If we have an initial prompt and not interactive mode, run single shot
  if (args.prompt && !args.interactive) {
    // Create agent executor for single prompt
    const executor = new AgentExecutor(
      config.getLLMClient(),
      config.getToolRegistry()
    );
    await runSinglePrompt(executor, config, systemPrompt, args.prompt, sessionManager);
  } else {
    // Interactive continuous chat mode - use ChatSession
    await runInteractiveChat(config, systemPrompt, args.prompt);
  }
}

/**
 * Run a single prompt and exit
 */
async function runSinglePrompt(
  executor: AgentExecutor,
  config: Config,
  systemPrompt: string,
  prompt: string,
  sessionManager: SessionManager
): Promise<void> {
  console.log(`> ${prompt}\n`);

  const result = await executor.execute(
    {
      name: 'stock_trading_agent',
      description: 'AI stock trading assistant',
      promptConfig: {
        systemPrompt,
        query: prompt,
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
}

/**
 * Run interactive continuous chat using ChatSession
 * System prompt is set once, messages accumulate
 */
async function runInteractiveChat(
  config: Config,
  systemPrompt: string,
  initialPrompt?: string
): Promise<void> {
  // Create a single readline interface for the entire session
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Create a single ChatSession for the entire conversation
  const chatSession = new ChatSession(
    config.getLLMClient(),
    config.getToolRegistry(),
    {
      systemPrompt,
      modelConfig: config.getLLMConfig(),
      runConfig: config.getAgentConfig(),
      toolConfig: {
        allowAllTools: true,
      },
    }
  );

  console.log('Type your message (or /help for commands, /exit to quit)\n');

  const processMessage = async (input: string): Promise<boolean> => {
    const trimmed = input.trim();

    // Handle commands
    if (trimmed.startsWith('/')) {
      const command = trimmed.slice(1).toLowerCase();
      if (command === 'exit' || command === 'quit' || command === 'q') {
        console.log('Goodbye!');
        return false;
      }
      if (command === 'clear') {
        chatSession.clearHistory();
        console.log('Chat history cleared.\n');
        return true;
      }
      if (command === 'help') {
        console.log(`
Available commands:
  /help  - Show this help message
  /clear - Clear chat history
  /exit  - Exit the application
`);
        return true;
      }
      console.log(`Unknown command: ${trimmed}. Type /help for available commands.\n`);
      return true;
    }

    if (!trimmed) {
      return true;
    }

    try {
      const result = await chatSession.sendMessage(trimmed, {
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
      });

      console.log('\n');

      if (!result.success) {
        console.error(`Error: ${result.error}\n`);
      }
    } catch (error) {
      console.error(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}\n`);
    }

    return true;
  };

  // Process initial prompt if provided
  if (initialPrompt) {
    console.log(`> ${initialPrompt}`);
    const shouldContinue = await processMessage(initialPrompt);
    if (!shouldContinue) {
      rl.close();
      return;
    }
  }

  // Main chat loop using the same readline interface
  const prompt = (): void => {
    rl.question('> ', async (answer) => {
      const shouldContinue = await processMessage(answer);
      if (shouldContinue) {
        prompt(); // Continue asking
      } else {
        rl.close();
      }
    });
  };

  prompt();

  // Wait for readline to close
  await new Promise<void>((resolve) => {
    rl.on('close', resolve);
  });
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
