import type {
  AppConfig,
  LLMConfig,
  AgentConfig,
  ToolsConfig,
  TelemetryConfig,
  UIConfig,
  DebugConfig,
  RuntimeConfig,
  MemoryConfig,
} from "./types.js";
import { loadSettings, saveSettings, type Settings } from "./settings.js";
import { loadEnv } from "./env.js";
import { ToolRegistry } from "../tools/registry.js";
import { createBuiltinTools } from "../tools/builtin/index.js";
import { AgentRegistry } from "../agents/registry.js";
import { createLLMClient } from "../llm/client.js";
import type { LLMClient, LLMProvider, DebugEvent } from "../llm/types.js";
import { MemoryStore, DEFAULT_MEMORY_CONFIG } from "../memory/index.js";

/**
 * Default configuration values
 */
const defaults: AppConfig = {
  llm: {
    provider: "google",
    model: "gemini-2.0-flash",
    temperature: 0.7,
    maxTokens: 4096,
  },
  agent: {
    maxTurns: 50,
    timeoutMs: 300000, // 5 minutes
    streaming: true,
    autoApprove: "none",
  },
  tools: {
    enabled: [
      "read_file",
      "write_file",
      "shell",
      "glob",
      "grep",
      "web_search",
      "save_memory",
      "list_directory",
      "rename_file",
      "delete_file",
    ],
    disabled: [],
    shellTimeout: 120000,
  },
  telemetry: {
    enabled: false,
    logPrompts: false,
  },
  ui: {
    theme: "auto",
    showThinking: true,
    compact: false,
    maxOutputLines: 500,
  },
  debug: {
    enabled: false,
    logRequests: true,
    logResponses: true,
  },
  memory: { ...DEFAULT_MEMORY_CONFIG },
  runtime: {
    uiTestMode: false,
  },
};

/**
 * Application configuration manager
 */
export class Config {
  private static instance: Config | null = null;
  private config: AppConfig;

  // Lazy-loaded services
  private _toolRegistry: ToolRegistry | null = null;
  private _agentRegistry: AgentRegistry | null = null;
  private _llmClient: LLMClient | null = null;
  private _memoryStore: MemoryStore | null = null;

  // Debug event callback (set by UI)
  private _debugEventCallback: ((event: DebugEvent) => void) | null = null;

  private constructor(settings: Settings) {
    this.config = this.mergeWithDefaults(settings);
  }

  /**
   * Get the singleton config instance
   */
  static async getInstance(): Promise<Config> {
    if (!Config.instance) {
      loadEnv();
      const settings = await loadSettings();
      Config.instance = new Config(settings);
    }
    return Config.instance;
  }

  /**
   * Reset the singleton (for testing)
   */
  static reset(): void {
    Config.instance = null;
  }

  /**
   * Get current configuration
   */
  getConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * Get LLM configuration
   */
  getLLMConfig(): LLMConfig {
    return { ...this.config.llm };
  }

  /**
   * Get agent configuration
   */
  getAgentConfig(): AgentConfig {
    return { ...this.config.agent };
  }

  /**
   * Get tools configuration
   */
  getToolsConfig(): ToolsConfig {
    return { ...this.config.tools };
  }

  /**
   * Get telemetry configuration
   */
  getTelemetryConfig(): TelemetryConfig {
    return { ...this.config.telemetry };
  }

  /**
   * Get UI configuration
   */
  getUIConfig(): UIConfig {
    return { ...this.config.ui };
  }

  /**
   * Get debug configuration
   */
  getDebugConfig(): DebugConfig {
    return { ...this.config.debug };
  }

  /**
   * Get runtime configuration (never persisted)
   */
  getRuntimeConfig(): RuntimeConfig {
    return { ...this.config.runtime };
  }

  /**
   * Get memory configuration
   */
  getMemoryConfig(): MemoryConfig {
    return { ...this.config.memory };
  }

  /**
   * Get the memory store (lazy-loaded)
   * @param projectDir - Optional project directory for project-level memory
   */
  getMemoryStore(projectDir?: string): MemoryStore {
    if (!this._memoryStore) {
      this._memoryStore = new MemoryStore(this.config.memory, projectDir);
    }
    return this._memoryStore;
  }

  /**
   * Reset the memory store (useful when changing project directory)
   */
  resetMemoryStore(): void {
    this._memoryStore = null;
  }

  /**
   * Get the tool registry (lazy-loaded)
   */
  getToolRegistry(): ToolRegistry {
    if (!this._toolRegistry) {
      this._toolRegistry = new ToolRegistry();

      // Register built-in tools
      const builtinTools = createBuiltinTools();
      for (const tool of builtinTools) {
        const toolName = tool.definition.name;
        const isEnabled = this.config.tools.enabled.includes(toolName);
        const isDisabled = this.config.tools.disabled.includes(toolName);

        if (isEnabled && !isDisabled) {
          this._toolRegistry.register(tool);
        }
      }
    }
    return this._toolRegistry;
  }

  /**
   * Get the agent registry (lazy-loaded)
   */
  getAgentRegistry(): AgentRegistry {
    if (!this._agentRegistry) {
      this._agentRegistry = new AgentRegistry();
    }
    return this._agentRegistry;
  }

  /**
   * Get the LLM client (lazy-loaded)
   */
  getLLMClient(): LLMClient {
    if (!this._llmClient) {
      const apiKey = this.resolveApiKey();
      const debugConfig = this.config.debug.enabled
        ? {
            ...this.config.debug,
            onDebugEvent: this._debugEventCallback ?? undefined,
          }
        : undefined;
      this._llmClient = createLLMClient(this.config.llm.provider, {
        apiKey,
        baseUrl: this.config.llm.baseUrl,
        defaultModel: this.config.llm.model,
        debug: debugConfig,
      });
    }
    return this._llmClient;
  }

  /**
   * Set the debug event callback for UI integration
   * Must be called before getLLMClient() for the callback to take effect
   */
  setDebugEventCallback(callback: ((event: DebugEvent) => void) | null): void {
    this._debugEventCallback = callback;
    // Reset LLM client so it gets recreated with the new callback
    this._llmClient = null;
  }

  /**
   * Set a custom LLM client (for testing)
   */
  setLLMClient(client: LLMClient): void {
    this._llmClient = client;
  }

  /**
   * Update configuration (persists to settings file)
   *
   * Note: Runtime config changes are not persisted. Use setRuntimeConfig() instead.
   */
  async updateConfig(
    updates: Partial<Omit<AppConfig, "runtime">>,
  ): Promise<void> {
    this.config = {
      ...this.config,
      llm: { ...this.config.llm, ...updates.llm },
      agent: { ...this.config.agent, ...updates.agent },
      tools: { ...this.config.tools, ...updates.tools },
      telemetry: { ...this.config.telemetry, ...updates.telemetry },
      ui: { ...this.config.ui, ...updates.ui },
      debug: { ...this.config.debug, ...updates.debug },
      memory: { ...this.config.memory, ...updates.memory },
    };

    // Reset lazy-loaded services
    this._llmClient = null;
    this._toolRegistry = null;
    this._memoryStore = null;

    // Save to settings file (runtime config is excluded)
    await saveSettings(this.configToSettings());
  }

  /**
   * Update runtime configuration (never persisted)
   *
   * Use this for CLI flags like --ui-test that should only apply to the current session.
   */
  setRuntimeConfig(updates: Partial<RuntimeConfig>): void {
    this.config.runtime = { ...this.config.runtime, ...updates };
  }

  /**
   * Merge loaded settings with defaults
   */
  private mergeWithDefaults(settings: Settings): AppConfig {
    return {
      llm: { ...defaults.llm, ...settings.llm },
      agent: { ...defaults.agent, ...settings.agent },
      tools: { ...defaults.tools, ...settings.tools },
      telemetry: { ...defaults.telemetry, ...settings.telemetry },
      ui: { ...defaults.ui, ...settings.ui },
      debug: { ...defaults.debug, ...settings.debug },
      memory: { ...defaults.memory, ...settings.memory },
      // Runtime config is never loaded from settings - always use defaults
      runtime: { ...defaults.runtime },
    };
  }

  /**
   * Convert config back to settings format (excludes runtime config)
   */
  private configToSettings(): Settings {
    return {
      llm: this.config.llm,
      agent: this.config.agent,
      tools: this.config.tools,
      telemetry: this.config.telemetry,
      ui: this.config.ui,
      debug: this.config.debug,
      memory: this.config.memory,
    };
  }

  /**
   * Resolve API key from config or environment
   */
  private resolveApiKey(): string {
    const provider = this.config.llm.provider;
    const configKey = this.config.llm.apiKey;

    // Use config key if provided
    if (configKey) {
      // Check if it's an env var reference
      if (configKey.startsWith("$")) {
        return process.env[configKey.slice(1)] ?? "";
      }
      return configKey;
    }

    // Fall back to standard env vars
    const envVars: Record<LLMProvider, string> = {
      google: "GOOGLE_API_KEY",
      ollama: "", // No key needed
      openai: "OPENAI_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
    };

    return process.env[envVars[provider]] ?? "";
  }
}
