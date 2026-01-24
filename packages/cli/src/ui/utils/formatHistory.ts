/**
 * Utility functions for formatting LLM message history for display
 */

import type { Message as LLMMessage } from '@beans/core';

/**
 * Truncates content to a maximum length with ellipsis
 */
function truncate(content: string, maxLength: number): string {
  const oneLine = content.replace(/\n/g, ' ').trim();
  if (oneLine.length <= maxLength) return oneLine;
  return oneLine.slice(0, maxLength) + '...';
}

/**
 * Formats the entire message history for display
 */
export function formatHistoryForDisplay(messages: LLMMessage[]): string {
  if (messages.length === 0) {
    return 'No messages in history.';
  }

  const lines: string[] = [`History (${messages.length})`];

  for (const msg of messages) {
    const role = msg.role.toUpperCase().padEnd(9);
    const content = truncate(msg.content || '', 60);
    const tools = msg.toolCalls?.length ? ` [${msg.toolCalls.map(t => t.name).join(', ')}]` : '';
    const results = msg.toolResults?.length ? ` (${msg.toolResults.length} results)` : '';

    lines.push(`${role} ${content}${tools}${results}`);
  }

  return lines.join('\n');
}
