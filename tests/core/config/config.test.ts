import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Config } from '../../../packages/core/src/config/config.js';
import * as settings from '../../../packages/core/src/config/settings.js';

// Mock the settings module
vi.mock('../../../packages/core/src/config/settings.js', () => ({
  loadSettings: vi.fn().mockResolvedValue({}),
  saveSettings: vi.fn().mockResolvedValue(undefined),
}));

describe('Config', () => {
  beforeEach(() => {
    Config.reset();
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(settings.loadSettings).mockResolvedValue({});
  });

  afterEach(() => {
    Config.reset();
    vi.unstubAllGlobals();
  });

  describe('getLLMClient', () => {
    it('should return an LLM client with chat method', async () => {
      const config = await Config.getInstance();
      const client = config.getLLMClient();

      expect(client).toBeDefined();
      expect(typeof client.chat).toBe('function');
    });

    it('should return an LLM client with listModels method', async () => {
      const config = await Config.getInstance();
      const client = config.getLLMClient();

      expect(client.listModels).toBeDefined();
      expect(typeof client.listModels).toBe('function');
    });

    it('should return the same client instance on multiple calls', async () => {
      const config = await Config.getInstance();
      const client1 = config.getLLMClient();
      const client2 = config.getLLMClient();

      expect(client1).toBe(client2);
    });

    it('should create new client after config update', async () => {
      const config = await Config.getInstance();
      const client1 = config.getLLMClient();

      await config.updateConfig({
        llm: { ...config.getLLMConfig(), model: 'different-model' },
      });

      const client2 = config.getLLMClient();
      expect(client1).not.toBe(client2);
    });
  });

  describe('getLLMConfig', () => {
    it('should return default provider as google when no settings', async () => {
      vi.mocked(settings.loadSettings).mockResolvedValue({});
      Config.reset();

      const config = await Config.getInstance();
      const llmConfig = config.getLLMConfig();

      expect(llmConfig.provider).toBe('google');
    });

    it('should return default model as gemini-2.0-flash-exp when no settings', async () => {
      vi.mocked(settings.loadSettings).mockResolvedValue({});
      Config.reset();

      const config = await Config.getInstance();
      const llmConfig = config.getLLMConfig();

      expect(llmConfig.model).toBe('gemini-2.0-flash-exp');
    });

    it('should use provider from settings when provided', async () => {
      vi.mocked(settings.loadSettings).mockResolvedValue({
        llm: { provider: 'ollama' },
      });
      Config.reset();

      const config = await Config.getInstance();
      const llmConfig = config.getLLMConfig();

      expect(llmConfig.provider).toBe('ollama');
    });

    it('should use model from settings when provided', async () => {
      vi.mocked(settings.loadSettings).mockResolvedValue({
        llm: { model: 'llama3.2' },
      });
      Config.reset();

      const config = await Config.getInstance();
      const llmConfig = config.getLLMConfig();

      expect(llmConfig.model).toBe('llama3.2');
    });
  });
});
