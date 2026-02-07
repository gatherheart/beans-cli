import { describe, it, expect } from 'vitest';
import { MockLLMClient } from '../../../packages/core/src/llm/providers/mock.js';
import type { ChatRequest } from '../../../packages/core/src/llm/types.js';

describe('MockLLMClient', () => {
  const createRequest = (content = 'test'): ChatRequest => ({
    model: 'mock',
    messages: [{ role: 'user', content }],
  });

  describe('basic scenario', () => {
    it('should return markdown content', async () => {
      const client = new MockLLMClient('basic');
      const response = await client.chat(createRequest());

      expect(response.content).toContain('mock response');
      expect(response.content).toContain('## Code Example');
      expect(response.model).toBe('mock');
      expect(response.finishReason).toBe('stop');
    });

    it('should stream content word by word', async () => {
      const client = new MockLLMClient('basic');
      const chunks: string[] = [];

      for await (const chunk of client.chatStream(createRequest())) {
        if (chunk.content) {
          chunks.push(chunk.content);
        }
      }

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.join('')).toContain('mock response');
    });
  });

  describe('long-content scenario', () => {
    it('should return long content', async () => {
      const client = new MockLLMClient('long-content');
      const response = await client.chat(createRequest());

      expect(response.content).toContain('Long Content Test');
      expect(response.content).toContain('Section 5');
      expect(response.content!.length).toBeGreaterThan(500);
    });
  });

  describe('tool-calls scenario', () => {
    it('should include tool calls', async () => {
      const client = new MockLLMClient('tool-calls');
      const response = await client.chat(createRequest());

      expect(response.toolCalls).toBeDefined();
      expect(response.toolCalls!.length).toBe(3);
      expect(response.toolCalls![0].name).toBe('read_file');
      expect(response.toolCalls![1].name).toBe('glob');
      expect(response.toolCalls![2].name).toBe('shell');
      expect(response.finishReason).toBe('tool_calls');
    });

    it('should stream tool calls before content', async () => {
      const client = new MockLLMClient('tool-calls');
      const toolCalls: string[] = [];
      const contents: string[] = [];

      for await (const chunk of client.chatStream(createRequest())) {
        if (chunk.toolCallDelta) {
          toolCalls.push(chunk.toolCallDelta.name!);
        }
        if (chunk.content) {
          contents.push(chunk.content);
        }
      }

      expect(toolCalls.length).toBe(3);
      expect(contents.length).toBeGreaterThan(0);
    });
  });

  describe('empty-response scenario', () => {
    it('should return empty content', async () => {
      const client = new MockLLMClient('empty-response');
      const response = await client.chat(createRequest());

      expect(response.content).toBe('');
      expect(response.finishReason).toBe('stop');
    });
  });

  describe('multi-turn scenario', () => {
    it('should track turn count', async () => {
      const client = new MockLLMClient('multi-turn');

      const response1 = await client.chat(createRequest('hello'));
      expect(response1.content).toContain('turn 1');

      const response2 = await client.chat(createRequest('world'));
      expect(response2.content).toContain('turn 2');
    });

    it('should include message history', async () => {
      const client = new MockLLMClient('multi-turn');

      const request: ChatRequest = {
        model: 'mock',
        messages: [
          { role: 'user', content: 'first message here' },
          { role: 'assistant', content: 'response' },
          { role: 'user', content: 'second message' },
        ],
      };

      const response = await client.chat(request);
      expect(response.content).toContain('user: first message here');
    });

    it('should reset turn count', async () => {
      const client = new MockLLMClient('multi-turn');

      await client.chat(createRequest());
      await client.chat(createRequest());
      client.resetTurnCount();

      const response = await client.chat(createRequest());
      expect(response.content).toContain('turn 1');
    });
  });

  describe('error scenario', () => {
    it('should throw error on chat', async () => {
      const client = new MockLLMClient('error');

      await expect(client.chat(createRequest())).rejects.toThrow(
        'Mock error for UI testing'
      );
    });

    it('should throw error on stream', async () => {
      const client = new MockLLMClient('error');

      await expect(async () => {
        for await (const _ of client.chatStream(createRequest())) {
          // Should throw before yielding
        }
      }).rejects.toThrow('Mock streaming error for UI testing');
    });
  });

  describe('rapid-stream scenario', () => {
    it('should stream with minimal delay', async () => {
      const client = new MockLLMClient('rapid-stream');
      const start = Date.now();
      const chunks: string[] = [];

      for await (const chunk of client.chatStream(createRequest())) {
        if (chunk.content) {
          chunks.push(chunk.content);
        }
      }

      const elapsed = Date.now() - start;
      expect(chunks.length).toBeGreaterThan(10);
      // With 1ms delay per word, should be fast
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe('getScenario', () => {
    it('should return current scenario', () => {
      const client = new MockLLMClient('slow-stream');
      expect(client.getScenario()).toBe('slow-stream');
    });

    it('should default to basic', () => {
      const client = new MockLLMClient();
      expect(client.getScenario()).toBe('basic');
    });
  });
});
