import { describe, it, expect } from 'vitest';
import { createLLMClient } from '../../../packages/core/src/llm/client.js';

describe('Anthropic Client', () => {
  describe('listModels', () => {
    it('should return known Claude models', async () => {
      const client = createLLMClient('anthropic', { apiKey: 'test-key' });
      const models = await client.listModels!();

      expect(models.length).toBeGreaterThan(0);
      expect(models.some((m) => m.id.includes('claude'))).toBe(true);
    });

    it('should include Claude Sonnet 4', async () => {
      const client = createLLMClient('anthropic', { apiKey: 'test-key' });
      const models = await client.listModels!();

      const sonnet4 = models.find((m) => m.id.includes('sonnet-4'));
      expect(sonnet4).toBeDefined();
      expect(sonnet4?.name).toBe('Claude Sonnet 4');
    });

    it('should include Claude Opus 4', async () => {
      const client = createLLMClient('anthropic', { apiKey: 'test-key' });
      const models = await client.listModels!();

      const opus4 = models.find((m) => m.id.includes('opus-4'));
      expect(opus4).toBeDefined();
      expect(opus4?.name).toBe('Claude Opus 4');
    });

    it('should include model descriptions', async () => {
      const client = createLLMClient('anthropic', { apiKey: 'test-key' });
      const models = await client.listModels!();

      expect(models.every((m) => m.description)).toBe(true);
    });
  });
});
