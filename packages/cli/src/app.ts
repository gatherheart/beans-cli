/**
 * Main application entry point
 */

import readline from 'node:readline';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CLIArgs } from './args.js';
import { Config } from '@beans/core';
import { AgentExecutor, ChatSession } from '@beans/core';
import { SessionManager } from '@beans/core';
import { WorkspaceService } from '@beans/core';
import {
  AgentProfileBuilder,
  loadAgentProfile,
  saveAgentProfile,
  DEFAULT_AGENT_PROFILE,
  type AgentProfile,
} from '@beans/core';

// Get the package root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_AGENT_PATH = path.join(PACKAGE_ROOT, 'plugins', 'general-assistant', 'agents', 'default.md');

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

  // Load or generate agent profile
  const agentProfile = await resolveAgentProfile(config, args);

  console.log(`\n🤖 ${agentProfile.displayName} v${agentProfile.version}`);
  console.log(`📁 Workspace: ${workspaceContext.rootPath}`);
  console.log(`📋 ${agentProfile.description}`);
  console.log('');

  // Apply SOP if provided
  let finalProfile = agentProfile;
  const sop = await resolveSOP(args);
  if (sop) {
    const builder = new AgentProfileBuilder(config.getLLMClient(), config.getLLMConfig().model);
    finalProfile = builder.updateProfileWithSOP(agentProfile, sop);
    console.log('📝 SOP applied to agent profile');
    console.log('');
  }

  const systemPrompt = finalProfile.systemPrompt;

  // If we have an initial prompt and not interactive mode, run single shot
  if (args.prompt && !args.interactive) {
    // Create agent executor for single prompt
    const executor = new AgentExecutor(
      config.getLLMClient(),
      config.getToolRegistry()
    );
    await runSinglePrompt(executor, config, systemPrompt, args.prompt, sessionManager, finalProfile);
  } else {
    // Interactive continuous chat mode - use ChatSession
    await runInteractiveChat(config, systemPrompt, args.prompt, finalProfile);
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
  sessionManager: SessionManager,
  profile: AgentProfile
): Promise<void> {
  console.log(`> ${prompt}\n`);

  const result = await executor.execute(
    {
      name: profile.name,
      description: profile.description,
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
  initialPrompt?: string,
  profile?: AgentProfile
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
  /help    - Show this help message
  /clear   - Clear chat history
  /profile - Show current agent profile
  /sop     - Update SOP (usage: /sop <new sop text>)
  /exit    - Exit the application
`);
        return true;
      }
      if (command === 'profile') {
        if (profile) {
          console.log(`
Current Agent Profile:
  Name: ${profile.displayName}
  Description: ${profile.description}
  Purpose: ${profile.purpose}
  Version: ${profile.version}
`);
        } else {
          console.log('No profile loaded.\n');
        }
        return true;
      }
      if (command.startsWith('sop ')) {
        const newSop = trimmed.slice(5); // Remove '/sop '
        if (newSop.trim()) {
          const builder = new AgentProfileBuilder(config.getLLMClient(), config.getLLMConfig().model);
          const updatedProfile = builder.updateProfileWithSOP(
            profile || DEFAULT_AGENT_PROFILE,
            newSop
          );
          // Update the chat session with new system prompt
          chatSession.updateSystemPrompt(updatedProfile.systemPrompt);
          console.log('✅ SOP updated successfully.\n');
        } else {
          console.log('Usage: /sop <your sop text>\n');
        }
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
 * Resolves the agent profile based on CLI arguments.
 *
 * Priority order:
 * 1. Load from profile file (--agent-profile)
 * 2. Generate from description using LLM (--agent or -a)
 * 3. Load from workspace .beans/agent.json
 * 4. Load from default agents/default.json
 * 5. Use hardcoded default profile
 *
 * @param config - The application configuration
 * @param args - CLI arguments
 * @returns The resolved agent profile
 */
async function resolveAgentProfile(config: Config, args: CLIArgs): Promise<AgentProfile> {
  // 1. Try to load from profile file (explicit --agent-profile)
  if (args.agentProfile) {
    try {
      console.log(`Loading agent profile from: ${args.agentProfile}`);
      const profile = await loadAgentProfile(args.agentProfile);
      return profile;
    } catch (error) {
      console.warn(`Failed to load profile from ${args.agentProfile}, falling back to generation`);
    }
  }

  // 2. Generate from description using LLM
  if (args.agentDescription) {
    console.log('Generating agent profile from description...');
    const builder = new AgentProfileBuilder(config.getLLMClient(), config.getLLMConfig().model);
    const sop = await resolveSOP(args);
    const profile = await builder.buildProfile({
      description: args.agentDescription,
      sop: sop || undefined,
    });

    // Optionally save the generated profile
    const workspaceDir = args.cwd ?? process.cwd();
    const profilePath = `${workspaceDir}/.beans/agent-profile.md`;
    try {
      await saveAgentProfile(profile, profilePath);
      console.log(`Profile saved to: ${profilePath}`);
    } catch {
      // Ignore save errors - profile generation succeeded
    }

    return profile;
  }

  // 3. Try to load from workspace .beans/agent.md
  const workspaceDir = args.cwd ?? process.cwd();
  const workspaceAgentPath = path.join(workspaceDir, '.beans', 'agent.md');
  try {
    await fs.access(workspaceAgentPath);
    const profile = await loadAgentProfile(workspaceAgentPath);
    return profile;
  } catch {
    // File doesn't exist or can't be read, continue to next option
  }

  // 4. Try to load from default agents/default.json
  try {
    await fs.access(DEFAULT_AGENT_PATH);
    const profile = await loadAgentProfile(DEFAULT_AGENT_PATH);
    return profile;
  } catch {
    // File doesn't exist or can't be read, continue to fallback
  }

  // 5. Use hardcoded default profile as final fallback
  return DEFAULT_AGENT_PROFILE;
}

/**
 * Resolves SOP from CLI arguments.
 *
 * @param args - CLI arguments
 * @returns The SOP string or null if not provided
 */
async function resolveSOP(args: CLIArgs): Promise<string | null> {
  // Direct SOP from command line
  if (args.sop) {
    return args.sop;
  }

  // Load from file
  if (args.sopFile) {
    try {
      const content = await fs.readFile(args.sopFile, 'utf-8');
      return content.trim();
    } catch (error) {
      console.warn(`Failed to load SOP from ${args.sopFile}`);
    }
  }

  return null;
}
