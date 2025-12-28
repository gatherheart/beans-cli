import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLLMClient } from '../../../packages/core/src/llm/client.js';

describe('Google Client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('listModels', () => {
    it('should list models that support generateContent', async () => {
      const mockResponse = {
        models: [
          {
            name: 'models/gemini-2.0-flash',
            displayName: 'Gemini 2.0 Flash',
            description: 'Fast model',
            supportedGenerationMethods: ['generateContent'],
          },
          {
            name: 'models/embedding-001',
            displayName: 'Embedding',
            description: 'Embedding model',
            supportedGenerationMethods: ['embedContent'],
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = createLLMClient('google', { apiKey: 'test-key' });
      const models = await client.listModels!();

      expect(models).toHaveLength(1);
      expect(models[0].id).toBe('gemini-2.0-flash');
    });

    it('should strip models/ prefix from id', async () => {
      const mockResponse = {
        models: [
          {
            name: 'models/gemini-2.5-pro',
            displayName: 'Gemini 2.5 Pro',
            description: 'Pro model',
            supportedGenerationMethods: ['generateContent'],
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = createLLMClient('google', { apiKey: 'test-key' });
      const models = await client.listModels!();

      expect(models[0].id).toBe('gemini-2.5-pro');
      expect(models[0].id).not.toContain('models/');
    });

    it('should include displayName as name', async () => {
      const mockResponse = {
        models: [
          {
            name: 'models/gemini-2.0-flash',
            displayName: 'Gemini 2.0 Flash',
            description: 'Fast model',
            supportedGenerationMethods: ['generateContent'],
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = createLLMClient('google', { apiKey: 'test-key' });
      const models = await client.listModels!();

      expect(models[0].name).toBe('Gemini 2.0 Flash');
    });

    it('should include supportedMethods', async () => {
      const mockResponse = {
        models: [
          {
            name: 'models/gemini-2.0-flash',
            displayName: 'Gemini 2.0 Flash',
            description: 'Fast model',
            supportedGenerationMethods: ['generateContent', 'countTokens'],
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = createLLMClient('google', { apiKey: 'test-key' });
      const models = await client.listModels!();

      expect(models[0].supportedMethods).toContain('generateContent');
      expect(models[0].supportedMethods).toContain('countTokens');
    });

    it('should throw error with response body on failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('{"error": "Not found"}'),
      } as Response);

      const client = createLLMClient('google', { apiKey: 'invalid-key' });

      await expect(client.listModels!()).rejects.toThrow('Google API error: 404');
    });

    it('should include API key in query string', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ models: [] }),
      } as Response);

      const client = createLLMClient('google', { apiKey: 'my-api-key' });
      await client.listModels!();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('key=my-api-key'),
        expect.any(Object)
      );
    });
  });
});
