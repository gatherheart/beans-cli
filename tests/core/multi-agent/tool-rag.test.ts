/**
 * Tests for RAG-based tool selection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  toolKnowledgeBase,
  getToolKnowledge,
  getAllToolKnowledge,
} from '../../../packages/core/src/agents/multi-agent/tool-rag/tool-knowledge.js';
import {
  generateEmbedding,
  cosineSimilarity,
} from '../../../packages/core/src/agents/multi-agent/tool-rag/embeddings.js';
import {
  getVectorStore,
  resetVectorStore,
} from '../../../packages/core/src/agents/multi-agent/tool-rag/vector-store.js';
import type { EmbeddingEntry } from '../../../packages/core/src/agents/multi-agent/tool-rag/types.js';

describe('Tool Knowledge Base', () => {
  it('should have knowledge for all core tools', () => {
    const coreTools = ['web_search', 'read_file', 'write_file', 'shell', 'glob', 'grep'];

    for (const toolName of coreTools) {
      const knowledge = getToolKnowledge(toolName);
      expect(knowledge).toBeDefined();
      expect(knowledge?.name).toBe(toolName);
    }
  });

  it('should have example queries for each tool', () => {
    const allKnowledge = getAllToolKnowledge();

    for (const knowledge of allKnowledge) {
      expect(knowledge.exampleQueries.length).toBeGreaterThan(0);
      expect(knowledge.keywords.length).toBeGreaterThan(0);
      expect(knowledge.useCases.length).toBeGreaterThan(0);
    }
  });

  it('should return undefined for unknown tool', () => {
    const knowledge = getToolKnowledge('nonexistent_tool');
    expect(knowledge).toBeUndefined();
  });

  it('web_search should have weather-related examples', () => {
    const webSearch = getToolKnowledge('web_search');
    expect(webSearch).toBeDefined();

    const hasWeatherExample = webSearch!.exampleQueries.some(
      q => q.toLowerCase().includes('weather')
    );
    expect(hasWeatherExample).toBe(true);

    const hasWeatherKeyword = webSearch!.keywords.includes('weather');
    expect(hasWeatherKeyword).toBe(true);
  });

  it('shell should have command-related examples', () => {
    const shell = getToolKnowledge('shell');
    expect(shell).toBeDefined();

    const hasNpmExample = shell!.exampleQueries.some(
      q => q.toLowerCase().includes('npm')
    );
    expect(hasNpmExample).toBe(true);
  });

  it('should have agent type suggestions', () => {
    const webSearch = getToolKnowledge('web_search');
    expect(webSearch?.agentTypes).toContain('general');

    const glob = getToolKnowledge('glob');
    expect(glob?.agentTypes).toContain('explore');
  });
});

describe('Embeddings', () => {
  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vector = [1, 2, 3, 4, 5];
      const similarity = cosineSimilarity(vector, vector);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      const similarity = cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(0, 5);
    });

    it('should return -1 for opposite vectors', () => {
      const a = [1, 2, 3];
      const b = [-1, -2, -3];
      const similarity = cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(-1, 5);
    });

    it('should handle normalized vectors', () => {
      const a = [0.6, 0.8, 0];
      const b = [0.6, 0.8, 0];
      const similarity = cosineSimilarity(a, b);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should throw for vectors of different lengths', () => {
      const a = [1, 2, 3];
      const b = [1, 2];
      expect(() => cosineSimilarity(a, b)).toThrow('Vectors must have same length');
    });
  });

  describe('generateEmbedding (fallback mode)', () => {
    beforeEach(() => {
      // Ensure no API key to test fallback
      delete process.env.GOOGLE_API_KEY;
    });

    it('should generate embedding of correct dimension', async () => {
      const embedding = await generateEmbedding('test query');
      expect(embedding).toHaveLength(768);
    });

    it('should generate consistent embeddings for same text', async () => {
      const embedding1 = await generateEmbedding('hello world');
      const embedding2 = await generateEmbedding('hello world');

      const similarity = cosineSimilarity(embedding1, embedding2);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should generate different embeddings for different text', async () => {
      const embedding1 = await generateEmbedding('weather in seoul');
      const embedding2 = await generateEmbedding('run npm install');

      const similarity = cosineSimilarity(embedding1, embedding2);
      expect(similarity).toBeLessThan(0.9);
    });

    it('should generate similar embeddings for similar text', async () => {
      const embedding1 = await generateEmbedding('what is the weather');
      const embedding2 = await generateEmbedding('how is the weather');

      const similarity = cosineSimilarity(embedding1, embedding2);
      expect(similarity).toBeGreaterThan(0.5);
    });
  });
});

describe('Vector Store', () => {
  beforeEach(() => {
    resetVectorStore();
  });

  afterEach(() => {
    resetVectorStore();
  });

  it('should start empty', () => {
    const store = getVectorStore();
    expect(store.size()).toBe(0);
    expect(store.isInitialized()).toBe(false);
  });

  it('should add entries', () => {
    const store = getVectorStore();
    const entry: EmbeddingEntry = {
      id: 'test-1',
      toolName: 'web_search',
      text: 'weather query',
      contentType: 'query',
      vector: [1, 0, 0],
    };

    store.add(entry);
    expect(store.size()).toBe(1);
  });

  it('should add multiple entries', () => {
    const store = getVectorStore();
    const entries: EmbeddingEntry[] = [
      { id: '1', toolName: 'web_search', text: 'q1', contentType: 'query', vector: [1, 0, 0] },
      { id: '2', toolName: 'shell', text: 'q2', contentType: 'query', vector: [0, 1, 0] },
    ];

    store.addAll(entries);
    expect(store.size()).toBe(2);
  });

  it('should search and return results sorted by similarity', () => {
    const store = getVectorStore();

    // Add entries with known vectors
    store.addAll([
      { id: '1', toolName: 'web_search', text: 'weather', contentType: 'query', vector: [1, 0, 0] },
      { id: '2', toolName: 'shell', text: 'npm', contentType: 'query', vector: [0, 1, 0] },
      { id: '3', toolName: 'glob', text: 'files', contentType: 'query', vector: [0, 0, 1] },
    ]);

    // Search with vector closest to web_search
    const results = store.search([0.9, 0.1, 0], 3, 0);

    expect(results.length).toBe(3);
    expect(results[0].toolName).toBe('web_search');
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it('should filter by threshold', () => {
    const store = getVectorStore();

    store.addAll([
      { id: '1', toolName: 'web_search', text: 'weather', contentType: 'query', vector: [1, 0, 0] },
      { id: '2', toolName: 'shell', text: 'npm', contentType: 'query', vector: [0, 1, 0] },
    ]);

    // Search with high threshold
    const results = store.search([1, 0, 0], 10, 0.9);

    expect(results.length).toBe(1);
    expect(results[0].toolName).toBe('web_search');
  });

  it('should search and group by tool', () => {
    const store = getVectorStore();

    store.addAll([
      { id: '1', toolName: 'web_search', text: 'weather', contentType: 'query', vector: [1, 0, 0] },
      { id: '2', toolName: 'web_search', text: 'news', contentType: 'query', vector: [0.9, 0.1, 0] },
      { id: '3', toolName: 'shell', text: 'npm', contentType: 'query', vector: [0, 1, 0] },
    ]);

    const byTool = store.searchByTool([1, 0, 0], 5, 0);

    expect(byTool.has('web_search')).toBe(true);
    expect(byTool.get('web_search')?.length).toBe(2);
  });

  it('should mark as initialized', () => {
    const store = getVectorStore();
    expect(store.isInitialized()).toBe(false);

    store.markInitialized();
    expect(store.isInitialized()).toBe(true);
  });

  it('should clear all entries', () => {
    const store = getVectorStore();
    store.add({ id: '1', toolName: 'test', text: 'test', contentType: 'query', vector: [1] });
    store.markInitialized();

    store.clear();

    expect(store.size()).toBe(0);
    expect(store.isInitialized()).toBe(false);
  });
});

describe('Tool Retriever Integration', () => {
  beforeEach(async () => {
    // Reset the entire RAG system including initialization promise
    const { resetToolRAG } = await import(
      '../../../packages/core/src/agents/multi-agent/tool-rag/tool-retriever.js'
    );
    resetToolRAG();
    // Ensure fallback mode
    delete process.env.GOOGLE_API_KEY;
  });

  afterEach(async () => {
    const { resetToolRAG } = await import(
      '../../../packages/core/src/agents/multi-agent/tool-rag/tool-retriever.js'
    );
    resetToolRAG();
  });

  // Note: These tests use the fallback embedding which is deterministic
  // In production with Gemini API, results would be more accurate

  it('should initialize RAG system', async () => {
    const { initializeToolRAG, isToolRAGInitialized } = await import(
      '../../../packages/core/src/agents/multi-agent/tool-rag/tool-retriever.js'
    );

    expect(isToolRAGInitialized()).toBe(false);

    await initializeToolRAG();

    expect(isToolRAGInitialized()).toBe(true);
    expect(getVectorStore().size()).toBeGreaterThan(0);
  });

  it('should retrieve tools for weather query', async () => {
    const { initializeToolRAG, retrieveTools } = await import(
      '../../../packages/core/src/agents/multi-agent/tool-rag/tool-retriever.js'
    );

    await initializeToolRAG();

    const recommendations = await retrieveTools('What is the weather in Seoul?', 5);

    expect(recommendations.length).toBeGreaterThan(0);
    // web_search should be among top recommendations for weather queries
    const hasWebSearch = recommendations.some(r => r.toolName === 'web_search');
    expect(hasWebSearch).toBe(true);
  });

  it('should retrieve tools for npm command', async () => {
    const { initializeToolRAG, retrieveTools } = await import(
      '../../../packages/core/src/agents/multi-agent/tool-rag/tool-retriever.js'
    );

    await initializeToolRAG();

    const recommendations = await retrieveTools('run npm install', 5);

    expect(recommendations.length).toBeGreaterThan(0);
    // shell should be among top recommendations for npm commands
    const hasShell = recommendations.some(r => r.toolName === 'shell');
    expect(hasShell).toBe(true);
  });

  it('should retrieve tools for file search', async () => {
    const { initializeToolRAG, retrieveTools } = await import(
      '../../../packages/core/src/agents/multi-agent/tool-rag/tool-retriever.js'
    );

    await initializeToolRAG();

    const recommendations = await retrieveTools('find all TypeScript files', 5);

    expect(recommendations.length).toBeGreaterThan(0);
    // glob should be among top recommendations
    const hasGlob = recommendations.some(r => r.toolName === 'glob');
    expect(hasGlob).toBe(true);
  });

  it('should suggest general agent for web search queries', async () => {
    const { initializeToolRAG, suggestAgent } = await import(
      '../../../packages/core/src/agents/multi-agent/tool-rag/tool-retriever.js'
    );

    await initializeToolRAG();

    const agent = await suggestAgent('What is the current stock price?');

    expect(agent).toBe('general');
  });

  it('should return recommendations with relevance scores', async () => {
    const { initializeToolRAG, retrieveTools } = await import(
      '../../../packages/core/src/agents/multi-agent/tool-rag/tool-retriever.js'
    );

    await initializeToolRAG();

    const recommendations = await retrieveTools('search the web for news', 3);

    expect(recommendations.length).toBeGreaterThan(0);

    for (const rec of recommendations) {
      expect(rec.toolName).toBeDefined();
      expect(rec.relevance).toBeGreaterThanOrEqual(0);
      expect(rec.relevance).toBeLessThanOrEqual(1);
      expect(rec.matchCount).toBeGreaterThan(0);
      expect(rec.topMatches.length).toBeGreaterThan(0);
    }
  });

  it('should return sorted recommendations by relevance', async () => {
    const { initializeToolRAG, retrieveTools } = await import(
      '../../../packages/core/src/agents/multi-agent/tool-rag/tool-retriever.js'
    );

    await initializeToolRAG();

    const recommendations = await retrieveTools('check the weather forecast', 5);

    for (let i = 1; i < recommendations.length; i++) {
      expect(recommendations[i - 1].relevance).toBeGreaterThanOrEqual(
        recommendations[i].relevance
      );
    }
  });
});

describe('User Input Agent with RAG', () => {
  beforeEach(async () => {
    const { resetToolRAG } = await import(
      '../../../packages/core/src/agents/multi-agent/tool-rag/tool-retriever.js'
    );
    resetToolRAG();
    delete process.env.GOOGLE_API_KEY;
  });

  afterEach(async () => {
    const { resetToolRAG } = await import(
      '../../../packages/core/src/agents/multi-agent/tool-rag/tool-retriever.js'
    );
    resetToolRAG();
  });

  it('should get tool recommendations for query', async () => {
    const { getToolRecommendations } = await import(
      '../../../packages/core/src/agents/multi-agent/user-input-agent.js'
    );

    const recommendations = await getToolRecommendations('What is the weather?');

    expect(recommendations.length).toBeGreaterThan(0);
  });

  it('should classify intent using RAG', async () => {
    const { quickClassifyIntent } = await import(
      '../../../packages/core/src/agents/multi-agent/user-input-agent.js'
    );

    const weatherIntent = await quickClassifyIntent('How is the weather today?');
    expect(weatherIntent).toBe('web_search');

    const shellIntent = await quickClassifyIntent('run npm test');
    expect(shellIntent).toBe('bash_execution');
  });
});
