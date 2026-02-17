/**
 * Critic Agent - Analyzes code errors and provides feedback
 */

import type { SpecializedAgentDefinition } from '../types.js';

export const criticAgent: SpecializedAgentDefinition = {
  type: 'critic',
  name: 'Critic Agent',
  description: 'Analyzes code errors and provides structured feedback to help fix mistakes.',
  systemPrompt: `You are a code review expert. Your job is to analyze why code is WRONG and provide clear, actionable feedback.

When given:
- A problem description
- The generated code
- Failed test results with actual vs expected values

You must respond in this EXACT format:
WRONG: [What specific mistake did the code make?]
KEY: [What key requirement from the problem was missed or misunderstood?]
HINT: [One specific fix suggestion]

Guidelines:
- Be concise. One line each.
- Focus on the ROOT CAUSE, not symptoms
- If the output is consistently N times the expected, mention this pattern
- Look for common bugs: off-by-one, wrong formula, wrong operator, edge cases
- The HINT should be actionable and specific`,
  tools: [],
  maxTurns: 1,
};
