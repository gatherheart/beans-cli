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

  // Initialize workspace context
  const workspaceService = new WorkspaceService(args.cwd ?? process.cwd());
  const workspaceContext = await workspaceService.getContext();

  // Initialize session
  const sessionManager = new SessionManager();

  console.log(`\n🤖 Beans Agent v0.1.0`);
  console.log(`📁 Workspace: ${workspaceContext.rootPath}`);
  if (workspaceContext.isGitRepo) {
    console.log(`🌿 Branch: ${workspaceContext.gitBranch}`);
  }
  if (workspaceContext.projectType !== 'unknown') {
    console.log(`📦 Project: ${workspaceContext.projectType}`);
  }
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
        name: 'coding_assistant',
        description: 'AI coding assistant',
        promptConfig: {
          systemPrompt: buildSystemPrompt(workspaceContext),
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
 * Build the system prompt with workspace context
 */
function buildSystemPrompt(workspace: import('@beans/core').WorkspaceContext): string {
  let prompt = `You are an AI coding assistant. You help users with software engineering tasks.

Current workspace:
- Path: ${workspace.rootPath}
- Git repo: ${workspace.isGitRepo ? `Yes (branch: ${workspace.gitBranch})` : 'No'}`;

  if (workspace.projectType !== 'unknown') {
    prompt += `\n- Project type: ${workspace.projectType}`;
  }
  if (workspace.primaryLanguage) {
    prompt += `\n- Primary language: ${workspace.primaryLanguage}`;
  }
  if (workspace.packageManager) {
    prompt += `\n- Package manager: ${workspace.packageManager}`;
  }

  prompt += `

Guidelines:
- Read files before modifying them
- Make minimal, focused changes
- Test your changes when possible
- Explain what you're doing

Available tools: read_file, write_file, shell, glob, grep`;

  return prompt;
}
