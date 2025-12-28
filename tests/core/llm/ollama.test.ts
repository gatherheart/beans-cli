import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLLMClient } from '../../../packages/core/src/llm/client.js';

describe('Ollama Client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('listModels', () => {
    it('should list local models', async () => {
      const mockResponse = {
        models: [
          { name: 'llama3.2', size: 4_000_000_000, modified_at: '2024-01-01' },
          { name: 'mistral', size: 7_500_000_000, modified_at: '2024-01-02' },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = createLLMClient('ollama', {});
      const models = await client.listModels!();

      expect(models).toHaveLength(2);
      expect(models[0].id).toBe('llama3.2');
      expect(models[1].id).toBe('mistral');
    });

    it('should include size in description as GB', async () => {
      const mockResponse = {
        models: [
          { name: 'llama3.2', size: 4_000_000_000, modified_at: '2024-01-01' },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = createLLMClient('ollama', {});
      const models = await client.listModels!();

      expect(models[0].description).toContain('GB');
      expect(models[0].description).toContain('3.7');
    });

    it('should use default localhost URL', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ models: [] }),
      } as Response);

      const client = createLLMClient('ollama', {});
      await client.listModels!();

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.any(Object)
      );
    });

    it('should use custom baseUrl if provided', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ models: [] }),
      } as Response);

      const client = createLLMClient('ollama', {
        baseUrl: 'http://192.168.1.100:11434',
      });
      await client.listModels!();

      expect(fetch).toHaveBeenCalledWith(
        'http://192.168.1.100:11434/api/tags',
        expect.any(Object)
      );
    });

    it('should throw error on API failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const client = createLLMClient('ollama', {});

      await expect(client.listModels!()).rejects.toThrow('Ollama API error: 500');
    });

    it('should handle empty models list', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ models: [] }),
      } as Response);

      const client = createLLMClient('ollama', {});
      const models = await client.listModels!();

      expect(models).toHaveLength(0);
    });
  });
});
