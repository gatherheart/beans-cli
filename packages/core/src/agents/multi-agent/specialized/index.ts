/**
 * Specialized agent definitions
 */

export { bashAgent } from "./bash-agent.js";
export { exploreAgent } from "./explore-agent.js";
export { planAgent } from "./plan-agent.js";
export { generalAgent } from "./general-agent.js";
export { coderAgent } from "./coder-agent.js";
export { criticAgent } from "./critic-agent.js";
export { mathAgent } from "./math-agent.js";

import { bashAgent } from "./bash-agent.js";
import { exploreAgent } from "./explore-agent.js";
import { planAgent } from "./plan-agent.js";
import { generalAgent } from "./general-agent.js";
import { coderAgent } from "./coder-agent.js";
import { criticAgent } from "./critic-agent.js";
import { mathAgent } from "./math-agent.js";
import type { SpecializedAgentDefinition } from "../types.js";

/**
 * All specialized agent definitions
 */
export const specializedAgents: SpecializedAgentDefinition[] = [
  bashAgent,
  exploreAgent,
  planAgent,
  generalAgent,
  coderAgent,
  criticAgent,
  mathAgent,
];

/**
 * Get agent definition by type
 */
export function getAgentDefinition(
  type: string,
): SpecializedAgentDefinition | undefined {
  return specializedAgents.find((agent) => agent.type === type);
}

/**
 * Get all available agent types
 */
export function getAgentTypes(): string[] {
  return specializedAgents.map((agent) => agent.type);
}
