/**
 * Debug logger for multi-agent conversations
 *
 * Logs agent-to-agent communication and orchestration events
 * to ~/.beans/logs/multi-agent.log when debug mode is enabled.
 */

import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type {
  MultiAgentEvent,
  InputAnalysis,
  AgentExecutionResult,
  Task,
} from './types.js';
import type { Message } from '../types.js';

const DEBUG_LOG_DIR = join(homedir(), '.beans', 'logs');
const MULTI_AGENT_LOG_FILE = join(DEBUG_LOG_DIR, 'multi-agent.log');

let debugEnabled = false;

/**
 * Enable or disable debug logging
 */
export function setMultiAgentDebug(enabled: boolean): void {
  debugEnabled = enabled;
}

/**
 * Check if debug logging is enabled
 */
export function isMultiAgentDebugEnabled(): boolean {
  return debugEnabled;
}

function ensureLogDir(): void {
  if (!existsSync(DEBUG_LOG_DIR)) {
    mkdirSync(DEBUG_LOG_DIR, { recursive: true });
  }
}

function writeLog(content: string): void {
  if (!debugEnabled) return;
  ensureLogDir();
  const timestamp = new Date().toISOString();
  appendFileSync(MULTI_AGENT_LOG_FILE, `[${timestamp}]\n${content}\n\n`);
}

function formatLine(char: string, length: number = 70): string {
  return char.repeat(length);
}

/**
 * Log input analysis start
 */
export function logInputAnalysisStart(input: string): void {
  writeLog([
    formatLine('='),
    '  INPUT ANALYSIS',
    formatLine('='),
    '',
    'User Input:',
    input,
    '',
  ].join('\n'));
}

/**
 * Log input analysis result
 */
export function logInputAnalysisComplete(analysis: InputAnalysis): void {
  const lines = [
    formatLine('-'),
    '  ANALYSIS RESULT',
    formatLine('-'),
    '',
    `Intent: ${analysis.intent}`,
    `Requires Planning: ${analysis.requiresPlanning}`,
    `Suggested Agent: ${analysis.suggestedAgent ?? 'none'}`,
  ];

  if (analysis.tasks && analysis.tasks.length > 0) {
    lines.push('', 'Tasks:');
    analysis.tasks.forEach((task, i) => {
      lines.push(`  ${i + 1}. ${task.subject}`);
      lines.push(`     Agent: ${task.suggestedAgent}`);
      if (task.dependencies?.length) {
        lines.push(`     Dependencies: ${task.dependencies.join(', ')}`);
      }
    });
  }

  lines.push('');
  writeLog(lines.join('\n'));
}

/**
 * Log task creation
 */
export function logTaskCreated(task: Task): void {
  writeLog([
    formatLine('-'),
    `  TASK CREATED: #${task.id}`,
    formatLine('-'),
    '',
    `Subject: ${task.subject}`,
    `Status: ${task.status}`,
    '',
    'Description:',
    task.description,
    '',
  ].join('\n'));
}

/**
 * Log task update
 */
export function logTaskUpdated(task: Task): void {
  const lines = [
    `  TASK UPDATED: #${task.id}`,
    `  Status: ${task.status}`,
  ];

  if (task.owner) {
    lines.push(`  Owner: ${task.owner}`);
  }

  if (task.blockedBy.length > 0) {
    lines.push(`  Blocked By: ${task.blockedBy.join(', ')}`);
  }

  writeLog(lines.join('\n'));
}

/**
 * Log agent spawn start
 */
export function logAgentSpawnStart(agentType: string, taskId?: string): void {
  const taskInfo = taskId ? ` (Task #${taskId})` : '';
  writeLog([
    formatLine('*'),
    `  AGENT SPAWN: ${agentType.toUpperCase()}${taskInfo}`,
    formatLine('*'),
    '',
  ].join('\n'));
}

/**
 * Log agent conversation turn
 */
export function logAgentTurn(
  agentType: string,
  turnNumber: number,
  messages: Message[]
): void {
  const lines = [
    formatLine('-'),
    `  ${agentType.toUpperCase()} - Turn ${turnNumber}`,
    formatLine('-'),
    '',
  ];

  // Get only messages from this turn (last few messages)
  const recentMessages = messages.slice(-3);

  for (const msg of recentMessages) {
    const roleLabel = msg.role.toUpperCase();
    lines.push(`[${roleLabel}]`);

    if (msg.content) {
      // Truncate long content
      const content = msg.content.length > 500
        ? msg.content.substring(0, 500) + '...'
        : msg.content;
      lines.push(content);
    }

    if (msg.toolCalls && msg.toolCalls.length > 0) {
      lines.push('Tool Calls:');
      for (const tc of msg.toolCalls) {
        lines.push(`  - ${tc.name}(${JSON.stringify(tc.arguments)})`);
      }
    }

    if (msg.toolResults && msg.toolResults.length > 0) {
      lines.push('Tool Results:');
      for (const tr of msg.toolResults) {
        const result = tr.content.length > 200
          ? tr.content.substring(0, 200) + '...'
          : tr.content;
        lines.push(`  [${tr.toolCallId}]: ${result}`);
      }
    }

    lines.push('');
  }

  writeLog(lines.join('\n'));
}

/**
 * Log agent spawn complete
 */
export function logAgentSpawnComplete(result: AgentExecutionResult): void {
  const statusIcon = result.success ? '+' : 'x';
  const lines = [
    formatLine('-'),
    `  [${statusIcon}] ${result.agentType.toUpperCase()} COMPLETE`,
    formatLine('-'),
    '',
    `Success: ${result.success}`,
    `Turns: ${result.turnCount}`,
    `Terminate Reason: ${result.terminateReason}`,
  ];

  if (result.error) {
    lines.push(`Error: ${result.error}`);
  }

  if (result.content) {
    const content = result.content.length > 500
      ? result.content.substring(0, 500) + '...'
      : result.content;
    lines.push('', 'Output:', content);
  }

  lines.push('');
  writeLog(lines.join('\n'));
}

/**
 * Log multi-agent event
 */
export function logMultiAgentEvent(event: MultiAgentEvent): void {
  if (!debugEnabled) return;

  switch (event.type) {
    case 'input_analysis_start':
      logInputAnalysisStart(event.input);
      break;
    case 'input_analysis_complete':
      logInputAnalysisComplete(event.analysis);
      break;
    case 'task_created':
      logTaskCreated(event.task);
      break;
    case 'task_updated':
      logTaskUpdated(event.task);
      break;
    case 'agent_spawn_start':
      logAgentSpawnStart(event.agentType, event.taskId);
      break;
    case 'agent_spawn_complete':
      logAgentSpawnComplete(event.result);
      break;
    case 'error':
      writeLog(`ERROR: ${event.error.message}\nAgent: ${event.agentType ?? 'unknown'}`);
      break;
  }
}

/**
 * Log full conversation history for an agent
 */
export function logConversationHistory(
  agentType: string,
  messages: Message[]
): void {
  if (!debugEnabled) return;

  const lines = [
    formatLine('='),
    `  FULL CONVERSATION: ${agentType.toUpperCase()}`,
    formatLine('='),
    '',
  ];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const roleLabel = msg.role.toUpperCase();
    lines.push(`--- Message ${i + 1} [${roleLabel}] ---`);

    if (msg.content) {
      lines.push(msg.content);
    }

    if (msg.toolCalls && msg.toolCalls.length > 0) {
      lines.push('', 'Tool Calls:');
      for (const tc of msg.toolCalls) {
        lines.push(`  ${tc.name}:`);
        lines.push(`    ${JSON.stringify(tc.arguments, null, 2).split('\n').join('\n    ')}`);
      }
    }

    if (msg.toolResults && msg.toolResults.length > 0) {
      lines.push('', 'Tool Results:');
      for (const tr of msg.toolResults) {
        lines.push(`  [${tr.toolCallId}]:`);
        const result = tr.content.length > 1000
          ? tr.content.substring(0, 1000) + '\n    ... (truncated)'
          : tr.content;
        lines.push(`    ${result.split('\n').join('\n    ')}`);
      }
    }

    lines.push('');
  }

  writeLog(lines.join('\n'));
}

/**
 * Log orchestration summary
 */
export function logOrchestrationSummary(
  totalTasks: number,
  completedTasks: number,
  totalTurns: number,
  agents: string[]
): void {
  writeLog([
    formatLine('='),
    '  ORCHESTRATION SUMMARY',
    formatLine('='),
    '',
    `Tasks: ${completedTasks}/${totalTasks} completed`,
    `Total Turns: ${totalTurns}`,
    `Agents Used: ${agents.join(', ')}`,
    '',
    formatLine('='),
  ].join('\n'));
}
