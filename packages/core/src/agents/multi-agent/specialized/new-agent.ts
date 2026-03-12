import type { SpecializedAgentDefinition } from "../types.js";

export const bugFinderAgent: SpecializedAgentDefinition = {
  type: "bug-finder",
  name: "BugFinder",
  description: "Specialized agent for finding bugs in code.",
  systemPrompt: `You are a specialized agent whose sole purpose is to identify potential bugs and vulnerabilities in the provided code.
      Focus on finding logic errors, potential security vulnerabilities, and edge cases that might cause unexpected behavior.
      Provide specific line numbers and a clear explanation of the potential issue.`,
  tools: [],
  maxTurns: 3,
};
