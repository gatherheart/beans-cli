import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLLMClient } from '../../../packages/core/src/llm/client.js';

describe('OpenAI Client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('listModels', () => {
    it('should list available models and filter GPT models', async () => {
      const mockResponse = {
        data: [
          { id: 'gpt-4o', owned_by: 'openai' },
          { id: 'gpt-4o-mini', owned_by: 'openai' },
          { id: 'dall-e-3', owned_by: 'openai' },
          { id: 'whisper-1', owned_by: 'openai' },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = createLLMClient('openai', { apiKey: 'test-key' });
      const models = await client.listModels!();

      expect(models).toHaveLength(2);
      expect(models[0].id).toBe('gpt-4o');
      expect(models[1].id).toBe('gpt-4o-mini');
    });

    it('should include owned_by in description', async () => {
      const mockResponse = {
        data: [{ id: 'gpt-4o', owned_by: 'openai' }],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = createLLMClient('openai', { apiKey: 'test-key' });
      const models = await client.listModels!();

      expect(models[0].description).toBe('Owned by openai');
    });

    it('should throw error on API failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const client = createLLMClient('openai', { apiKey: 'invalid-key' });

      await expect(client.listModels!()).rejects.toThrow('OpenAI API error: 401');
    });

    it('should use custom baseUrl if provided', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      } as Response);

      const client = createLLMClient('openai', {
        apiKey: 'test-key',
        baseUrl: 'https://custom.api.com/v1',
      });
      await client.listModels!();

      expect(fetch).toHaveBeenCalledWith(
        'https://custom.api.com/v1/models',
        expect.any(Object)
      );
    });
  });
});
