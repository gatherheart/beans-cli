import type { Tool, ToolDefinition } from './types.js';

/**
 * Registry for managing available tools
 */
export class ToolRegistry {
  private tools = new Map<string, Tool>();

  /**
   * Register a tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.definition.name)) {
      throw new Error(`Tool already registered: ${tool.definition.name}`);
    }
    this.tools.set(tool.definition.name, tool);
  }

  /**
   * Register multiple tools
   */
  registerAll(tools: Tool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get all tool definitions
   */
  getAllDefinitions(): ToolDefinition[] {
    return this.getAllTools().map((t) => t.definition);
  }

  /**
   * Get tool names
   */
  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Remove a tool registration
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Get a subset of tools by name
   */
  getToolsByNames(names: string[]): Tool[] {
    return names
      .map((name) => this.tools.get(name))
      .filter((t): t is Tool => t !== undefined);
  }
}
