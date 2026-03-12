import type { SpecializedAgentDefinition } from "../types.js";

export const bugFinderAgent: SpecializedAgentDefinition = {
  type: "bug-finder",
  name: "BugFinder",
  description: "Specialized agent for finding bugs in code.",
  systemPrompt: `You are a specialized agent for finding bugs and vulnerabilities in code.
    Focus on logic errors, security vulnerabilities, and edge cases.
    Provide specific line numbers and explanations for each issue found.`,
  tools: ["read_file", "grep"],
  maxTurns: 5,
};
