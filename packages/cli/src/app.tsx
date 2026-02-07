/**
 * Main application entry point
 */

import React from 'react';
import { render } from 'ink';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CLIArgs } from './args.js';
import {
  Config,
  AgentExecutor,
  SessionManager,
  WorkspaceService,
  AgentProfileBuilder,
  loadAgentProfile,
  saveAgentProfile,
  DEFAULT_AGENT_PROFILE,
  MockLLMClient,
  type AgentProfile,
} from '@beans/core';
import { App } from './ui/App.js';
import { Mode, setMode, isDebug } from './mode.js';

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
  // Set mode flags from CLI args
  let modeFlags = Mode.NONE;
  if (args.debug) modeFlags |= Mode.DEBUG;
  setMode(modeFlags);

  // Change to specified working directory if provided
  if (args.cwd) {
    process.chdir(args.cwd);
  }

  // Initialize configuration
  const config = await Config.getInstance();

  // UI test mode: use mock LLM client with optional scenario
  if (args.uiTest) {
    const scenario = args.uiTestScenario ?? 'basic';
    config.setLLMClient(new MockLLMClient(scenario));
    console.log(`🧪 UI Test Mode: scenario="${scenario}"`);
  }

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

  // Enable debug mode if specified
  if (isDebug()) {
    await config.updateConfig({
      debug: { ...config.getDebugConfig(), enabled: true },
    });
    console.log('🐛 Debug mode enabled - LLM requests and responses will be logged');
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

  const systemPrompt = agentProfile.systemPrompt;

  // If we have an initial prompt and not interactive mode, run single shot
  if (args.prompt && !args.interactive) {
    // Create agent executor for single prompt
    const executor = new AgentExecutor(
      config.getLLMClient(),
      config.getToolRegistry()
    );
    await runSinglePrompt(executor, config, systemPrompt, args.prompt, sessionManager, agentProfile);
  } else {
    // Interactive continuous chat mode - use ChatSession
    await runInteractiveChat(config, systemPrompt, args.prompt, agentProfile);
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
 * Runs an interactive continuous chat session with the user using Ink-based UI.
 *
 * @remarks
 * This function renders an Ink-based React UI for interactive chat. The UI
 * features a visually separated input area, markdown-formatted responses,
 * and real-time streaming with a final markdown render.
 *
 * Supported slash commands:
 * - `/help` - Displays available commands
 * - `/clear` - Clears the conversation history
 * - `/exit`, `/quit`, `/q` - Exits the application
 * - `/profile` - Shows current agent profile
 *
 * @param config - The application configuration containing LLM and agent settings.
 * @param systemPrompt - The system prompt that defines the agent's behavior.
 * @param initialPrompt - Optional initial prompt to process before entering
 * the interactive loop.
 * @param profile - The agent profile to use.
 * @returns A promise that resolves when the user exits the chat session.
 */
async function runInteractiveChat(
  config: Config,
  systemPrompt: string,
  initialPrompt?: string,
  profile?: AgentProfile
): Promise<void> {
  const { waitUntilExit } = render(
    React.createElement(App, {
      config,
      systemPrompt,
      profile,
      initialPrompt,
    })
  );

  await waitUntilExit();
  console.log('Goodbye!');
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
    } catch {
      console.warn(`Failed to load profile from ${args.agentProfile}, falling back to generation`);
    }
  }

  // 2. Generate from description using LLM
  if (args.agentDescription) {
    console.log('Generating agent profile from description...');
    const builder = new AgentProfileBuilder(config.getLLMClient(), config.getLLMConfig().model);
    const profile = await builder.buildProfile({
      description: args.agentDescription,
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
