import { z } from 'zod';
import { BaseTool } from '../base-tool.js';
import type { ToolExecutionResult } from '../types.js';

const WebSearchSchema = z.object({
  query: z.string().describe('The search query'),
  maxResults: z
    .number()
    .optional()
    .default(5)
    .describe('Maximum number of results to return (default: 5)'),
});

type WebSearchParams = z.infer<typeof WebSearchSchema>;

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Tool for searching the web using various search providers.
 *
 * @remarks
 * Supports multiple search providers configured via environment variables,
 * checked in the following priority order:
 *
 * 1. GOOGLE_API_KEY: Use Gemini's native Google Search grounding (recommended)
 * 2. TAVILY_API_KEY: Use Tavily Search API (good for AI agents)
 * 3. SERP_API_KEY: Use SerpAPI for Google results
 * 4. BING_API_KEY: Use Bing Search API
 *
 * The Gemini Google Search integration provides grounded results with citations,
 * following the gemini-cli pattern.
 */
export class WebSearchTool extends BaseTool<WebSearchParams> {
  readonly name = 'web_search';
  readonly description =
    'Search the web for information using Google Search. Returns grounded results with sources.';
  readonly schema = WebSearchSchema;

  /**
   * Executes a web search query and returns the results.
   *
   * @param params - The search parameters including query and max results.
   * @returns A promise that resolves to the search results.
   */
  async execute(params: WebSearchParams): Promise<ToolExecutionResult> {
    const { query, maxResults } = params;

    try {
      // Try Gemini's native Google Search first (best integration)
      if (process.env.GOOGLE_API_KEY) {
        return await this.searchWithGemini(query);
      }

      // Try Tavily (good for AI agents)
      if (process.env.TAVILY_API_KEY) {
        return await this.searchWithTavily(query, maxResults);
      }

      // Try SerpAPI
      if (process.env.SERP_API_KEY) {
        return await this.searchWithSerp(query, maxResults);
      }

      // Try Bing
      if (process.env.BING_API_KEY) {
        return await this.searchWithBing(query, maxResults);
      }

      return {
        content:
          'No search API configured. Please set one of: GOOGLE_API_KEY, TAVILY_API_KEY, SERP_API_KEY, or BING_API_KEY',
        isError: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: `Search failed: ${message}`,
        isError: true,
      };
    }
  }

  /**
   * Searches using Gemini's native Google Search grounding.
   *
   * @remarks
   * This uses the Gemini API with the googleSearch tool enabled, which provides
   * grounded search results with citations. This is the same approach used by
   * gemini-cli.
   */
  private async searchWithGemini(query: string): Promise<ToolExecutionResult> {
    const apiKey = process.env.GOOGLE_API_KEY;
    const model = process.env.GOOGLE_SEARCH_MODEL ?? 'gemini-2.0-flash';
    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    const response = await fetch(
      `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: query }] }],
          tools: [{ googleSearch: {} }],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        groundingMetadata?: {
          groundingChunks?: Array<{
            web?: { uri?: string; title?: string };
          }>;
          groundingSupports?: Array<{
            segment?: { startIndex: number; endIndex: number };
            groundingChunkIndices?: number[];
          }>;
        };
      }>;
    };

    const candidate = data.candidates?.[0];
    const responseText = candidate?.content?.parts?.find((p) => p.text)?.text;

    if (!responseText?.trim()) {
      return {
        content: `No search results found for: "${query}"`,
        metadata: { query },
      };
    }

    const groundingMetadata = candidate?.groundingMetadata;
    const sources = groundingMetadata?.groundingChunks ?? [];
    const supports = groundingMetadata?.groundingSupports ?? [];

    // Add citation markers to the response text
    let modifiedText = responseText;
    if (sources.length > 0 && supports.length > 0) {
      // Build insertions for citation markers
      const insertions: Array<{ index: number; marker: string }> = [];
      for (const support of supports) {
        if (support.segment && support.groundingChunkIndices) {
          const marker = support.groundingChunkIndices
            .map((i) => `[${i + 1}]`)
            .join('');
          insertions.push({ index: support.segment.endIndex, marker });
        }
      }

      // Sort descending to avoid index shifting
      insertions.sort((a, b) => b.index - a.index);

      // Insert markers (using byte positions like gemini-cli)
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const bytes = encoder.encode(modifiedText);
      const parts: Uint8Array[] = [];
      let lastIndex = bytes.length;

      for (const ins of insertions) {
        const pos = Math.min(ins.index, lastIndex);
        parts.unshift(bytes.subarray(pos, lastIndex));
        parts.unshift(encoder.encode(ins.marker));
        lastIndex = pos;
      }
      parts.unshift(bytes.subarray(0, lastIndex));

      const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
      const finalBytes = new Uint8Array(totalLength);
      let offset = 0;
      for (const part of parts) {
        finalBytes.set(part, offset);
        offset += part.length;
      }
      modifiedText = decoder.decode(finalBytes);
    }

    // Append sources list
    if (sources.length > 0) {
      const sourceList = sources
        .map((s, i) => `[${i + 1}] ${s.web?.title ?? 'Untitled'} (${s.web?.uri ?? 'No URL'})`)
        .join('\n');
      modifiedText += `\n\nSources:\n${sourceList}`;
    }

    return {
      content: modifiedText,
      metadata: {
        query,
        sourceCount: sources.length,
        provider: 'gemini-google-search',
      },
    };
  }

  /**
   * Searches using the Tavily API.
   */
  private async searchWithTavily(
    query: string,
    maxResults: number
  ): Promise<ToolExecutionResult> {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        max_results: maxResults,
        include_answer: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      answer?: string;
      results: Array<{ title: string; url: string; content: string }>;
    };

    const results: SearchResult[] = data.results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
    }));

    return this.formatResults(results, data.answer);
  }

  /**
   * Searches using the SerpAPI.
   */
  private async searchWithSerp(
    query: string,
    maxResults: number
  ): Promise<ToolExecutionResult> {
    const params = new URLSearchParams({
      q: query,
      api_key: process.env.SERP_API_KEY!,
      num: String(maxResults),
    });

    const response = await fetch(
      `https://serpapi.com/search.json?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`SerpAPI error: ${response.status}`);
    }

    const data = (await response.json()) as {
      organic_results?: Array<{ title: string; link: string; snippet: string }>;
    };

    const results: SearchResult[] = (data.organic_results ?? []).map((r) => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet,
    }));

    return this.formatResults(results);
  }

  /**
   * Searches using the Bing Search API.
   */
  private async searchWithBing(
    query: string,
    maxResults: number
  ): Promise<ToolExecutionResult> {
    const params = new URLSearchParams({
      q: query,
      count: String(maxResults),
    });

    const response = await fetch(
      `https://api.bing.microsoft.com/v7.0/search?${params.toString()}`,
      {
        headers: {
          'Ocp-Apim-Subscription-Key': process.env.BING_API_KEY!,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Bing API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      webPages?: {
        value: Array<{ name: string; url: string; snippet: string }>;
      };
    };

    const results: SearchResult[] = (data.webPages?.value ?? []).map((r) => ({
      title: r.name,
      url: r.url,
      snippet: r.snippet,
    }));

    return this.formatResults(results);
  }

  /**
   * Formats search results into a readable string.
   */
  private formatResults(
    results: SearchResult[],
    answer?: string
  ): ToolExecutionResult {
    if (results.length === 0) {
      return {
        content: 'No results found.',
        metadata: { resultCount: 0 },
      };
    }

    let content = '';

    if (answer) {
      content += `Summary: ${answer}\n\n`;
    }

    content += results
      .map(
        (r, i) =>
          `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`
      )
      .join('\n\n');

    return {
      content,
      metadata: {
        resultCount: results.length,
        hasAnswer: !!answer,
      },
    };
  }
}
