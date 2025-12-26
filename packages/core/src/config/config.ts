import type { AppConfig, LLMConfig, AgentConfig, ToolsConfig, TelemetryConfig, UIConfig } from './types.js';
import { loadSettings, saveSettings, type Settings } from './settings.js';
import { ToolRegistry } from '../tools/registry.js';
import { createBuiltinTools } from '../tools/builtin/index.js';
import { AgentRegistry } from '../agents/registry.js';
import { createLLMClient, type LLMClient } from '../llm/client.js';
import type { LLMProvider } from '../llm/types.js';

/**
 * Default configuration values
 */
const defaults: AppConfig = {
  llm: {
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 4096,
  },
  agent: {
    maxTurns: 50,
    timeoutMs: 300000, // 5 minutes
    streaming: true,
    autoApprove: 'none',
  },
  tools: {
    enabled: ['read_file', 'write_file', 'shell', 'glob', 'grep'],
    disabled: [],
    shellTimeout: 120000,
  },
  telemetry: {
    enabled: false,
    logPrompts: false,
  },
  ui: {
    theme: 'auto',
    showThinking: true,
    compact: false,
    maxOutputLines: 500,
  },
};

/**
 * Application configuration manager
 */
export class Config {
  private static instance: Config | null = null;
  private settings: Settings;
  private config: AppConfig;

  // Lazy-loaded services
  private _toolRegistry: ToolRegistry | null = null;
  private _agentRegistry: AgentRegistry | null = null;
  private _llmClient: LLMClient | null = null;

  private constructor(settings: Settings) {
    this.settings = settings;
    this.config = this.mergeWithDefaults(settings);
  }

  /**
   * Get the singleton config instance
   */
  static async getInstance(): Promise<Config> {
    if (!Config.instance) {
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
      this._llmClient = createLLMClient(this.config.llm.provider, {
        apiKey,
        baseUrl: this.config.llm.baseUrl,
        defaultModel: this.config.llm.model,
      });
    }
    return this._llmClient;
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<AppConfig>): Promise<void> {
    this.config = {
      ...this.config,
      ...updates,
      llm: { ...this.config.llm, ...updates.llm },
      agent: { ...this.config.agent, ...updates.agent },
      tools: { ...this.config.tools, ...updates.tools },
      telemetry: { ...this.config.telemetry, ...updates.telemetry },
      ui: { ...this.config.ui, ...updates.ui },
    };

    // Reset lazy-loaded services
    this._llmClient = null;
    this._toolRegistry = null;

    // Save to settings file
    await saveSettings(this.configToSettings());
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
    };
  }

  /**
   * Convert config back to settings format
   */
  private configToSettings(): Settings {
    return {
      llm: this.config.llm,
      agent: this.config.agent,
      tools: this.config.tools,
      telemetry: this.config.telemetry,
      ui: this.config.ui,
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
      if (configKey.startsWith('$')) {
        return process.env[configKey.slice(1)] ?? '';
      }
      return configKey;
    }

    // Fall back to standard env vars
    const envVars: Record<LLMProvider, string> = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      google: 'GOOGLE_API_KEY',
      ollama: '', // No key needed
      custom: '',
    };

    return process.env[envVars[provider]] ?? '';
  }
}
