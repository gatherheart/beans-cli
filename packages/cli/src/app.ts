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
 * Runs the main CLI application with the provided arguments.
 *
 * @remarks
 * This is the primary entry point for the CLI application. It initializes all
 * necessary components including configuration, workspace context, and session
 * management before routing to either single-prompt or interactive chat mode.
 *
 * The function performs the following initialization steps:
 * 1. Loads configuration from the Config singleton
 * 2. Applies command-line overrides for model and auto-approve settings
 * 3. Initializes workspace context for the current working directory
 * 4. Creates a session manager for tracking conversation metrics
 *
 * Execution mode is determined by the presence of a prompt and the interactive
 * flag:
 * - If a prompt is provided without `-i` flag: single-shot execution
 * - Otherwise: interactive continuous chat mode
 *
 * @param args - The parsed command-line arguments containing configuration
 * options such as model, prompt, interactive mode, yolo mode, and working
 * directory.
 * @returns A promise that resolves when the application exits.
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
 * Executes a single prompt and exits without entering interactive mode.
 *
 * @remarks
 * This function is used for one-shot execution when the user provides a prompt
 * without the interactive flag. It creates an agent execution context, processes
 * the prompt, streams the response to stdout, and then exits.
 *
 * The function provides real-time feedback during execution:
 * - Content chunks are streamed directly to stdout
 * - Tool call starts are indicated with a wrench emoji
 * - Tool call completions are marked with a checkmark
 * - Errors are displayed with appropriate formatting
 *
 * After execution completes, a session summary is printed showing the number
 * of turns taken and total tokens consumed.
 *
 * @param executor - The AgentExecutor instance to run the prompt.
 * @param config - The application configuration containing LLM and agent settings.
 * @param systemPrompt - The system prompt that defines the agent's behavior.
 * @param prompt - The user's prompt to execute.
 * @param sessionManager - The session manager for tracking execution metrics.
 * @returns A promise that resolves when execution is complete.
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
          case 'tool_call_start': {
            const args = JSON.stringify(event.toolCall.arguments, null, 2);
            console.log(`\n🔧 ${event.toolCall.name}`);
            console.log(`   Args: ${args}`);
            break;
          }
          case 'tool_call_end': {
            const preview = event.result.length > 200
              ? event.result.slice(0, 200) + '...'
              : event.result;
            console.log(`   ✅ Result: ${preview}`);
            break;
          }
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
 * Runs an interactive continuous chat session with the user.
 *
 * @remarks
 * This function implements the main interactive chat loop using Node.js readline
 * for user input. Unlike single-prompt execution, this mode maintains conversation
 * history across multiple exchanges, enabling context-aware multi-turn conversations.
 *
 * The function creates a single ChatSession instance that persists for the entire
 * interactive session. The system prompt is set once at session creation and is
 * not repeated in subsequent messages, following the gemini-cli pattern.
 *
 * Supported slash commands:
 * - `/help` - Displays available commands
 * - `/clear` - Clears the conversation history
 * - `/exit`, `/quit`, `/q` - Exits the application
 *
 * Activity events are streamed to the console in real-time:
 * - Thinking content is displayed with a thought bubble emoji
 * - Content chunks are written directly to stdout
 * - Tool calls show start/end status with appropriate emojis
 *
 * If an initial prompt is provided, it is processed before entering the
 * interactive loop.
 *
 * @param config - The application configuration containing LLM and agent settings.
 * @param systemPrompt - The system prompt that defines the agent's behavior.
 * @param initialPrompt - Optional initial prompt to process before entering
 * the interactive loop.
 * @returns A promise that resolves when the user exits the chat session.
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
            case 'turn_start':
              // Turn started
              break;
            case 'turn_end':
              // Turn ended
              break;
            case 'thinking':
              console.log(`\n💭 ${event.content}`);
              break;
            case 'content_chunk':
              process.stdout.write(event.content);
              break;
            case 'tool_call_start': {
              const args = JSON.stringify(event.toolCall.arguments, null, 2);
              console.log(`\n🔧 ${event.toolCall.name}`);
              console.log(`   Args: ${args}`);
              break;
            }
            case 'tool_call_end': {
              const preview = event.result.length > 200
                ? event.result.slice(0, 200) + '...'
                : event.result;
              console.log(`   ✅ Result: ${preview}`);
              break;
            }
            case 'error':
              console.error(`\n❌ Error: ${event.error.message}`);
              break;
          }
        },
      });

      console.log('\n');

      // Show response if we got one but onActivity didn't print it
      if (result.success && result.content && result.content.length > 0) {
        // Content was already printed via onActivity
      } else if (!result.success) {
        console.error(`Error: ${result.error}\n`);
      } else if (!result.content) {
        console.log('(No response received)\n');
      }
    } catch (error) {
      console.error(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}\n`);
      if (error instanceof Error && error.stack) {
        console.error(error.stack);
      }
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
 * Builds the system prompt that defines the stock trading agent's behavior.
 *
 * @remarks
 * This function constructs the comprehensive system prompt that establishes
 * the agent's identity, capabilities, guidelines, and disclaimers. The prompt
 * is designed to create a helpful yet responsible AI trading assistant.
 *
 * The system prompt includes:
 * - **Agent identity**: Defines the agent as an AI Stock Trading Agent
 * - **Capabilities**: Lists what the agent can help with, including market
 *   analysis, trading strategies, portfolio management, and education
 * - **Guidelines**: Establishes responsible behavior such as acknowledging
 *   risks, providing balanced analysis, and encouraging user research
 * - **Disclaimers**: Important legal disclaimers about the informational
 *   nature of the advice and the need for professional consultation
 *
 * This prompt is set once at session creation and remains constant throughout
 * the conversation, following the gemini-cli pattern for system instructions.
 *
 * @returns The complete system prompt string for the stock trading agent.
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
