import type { AgentDefinition } from './types.js';

/**
 * Registry for managing agent definitions
 */
export class AgentRegistry {
  private agents = new Map<string, AgentDefinition>();

  /**
   * Register an agent definition
   */
  register(definition: AgentDefinition): void {
    if (this.agents.has(definition.name)) {
      throw new Error(`Agent already registered: ${definition.name}`);
    }
    this.agents.set(definition.name, definition);
  }

  /**
   * Get an agent definition by name
   */
  get(name: string): AgentDefinition | undefined {
    return this.agents.get(name);
  }

  /**
   * Get all registered agent names
   */
  getNames(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Get all registered agents
   */
  getAll(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  /**
   * Check if an agent is registered
   */
  has(name: string): boolean {
    return this.agents.has(name);
  }

  /**
   * Remove an agent registration
   */
  unregister(name: string): boolean {
    return this.agents.delete(name);
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.agents.clear();
  }
}
