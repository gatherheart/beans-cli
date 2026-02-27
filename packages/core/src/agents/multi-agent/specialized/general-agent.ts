/**
 * General Agent - General-purpose agent with full tool access
 */

import type { SpecializedAgentDefinition } from "../types.js";

export const generalAgent: SpecializedAgentDefinition = {
  type: "general",
  name: "General Agent",
  description:
    "General-purpose agent for complex multi-step tasks with full tool access.",
  systemPrompt: `You are a helpful AI assistant. Help the user accomplish their task.

## Guidelines
- For math/calculations: Compute the answer directly and explain your reasoning. You can do math without tools.
- For code that user wants to run: First use write_file to save code, then use shell to run it.
- For current events/weather/prices: Use web_search tool.
- IMPORTANT: Always respond with text, never return an empty response.`,
  allowAllTools: true,
  maxTurns: 50,
};
