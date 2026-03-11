/**
 * Intent Extractor - Uses LLM to extract user intent and keywords
 */

import type { LLMClient } from "../../llm/types.js";

export interface ExtractedIntent {
  /** Main action the user wants */
  action: "find" | "read" | "understand" | "show" | "search" | "other";
  /** Target path or directory */
  targetPath?: string;
  /** Keywords to search for */
  keywords: string[];
  /** Original query */
  originalQuery: string;
}

const EXTRACTION_PROMPT = `Extract the user's intent from their query. Return JSON only.

Query: "{query}"

Return this exact JSON format:
{
  "action": "find|read|understand|show|search|other",
  "targetPath": "path if mentioned, or null",
  "keywords": ["keyword1", "keyword2"] // 1-3 important search terms, NOT stop words
}

Examples:
- "read ../broadcaster find relay logic" → {"action":"find","targetPath":"../broadcaster","keywords":["relay","logic"]}
- "show me the auth code" → {"action":"show","targetPath":null,"keywords":["auth"]}
- "where is the database connection" → {"action":"find","targetPath":null,"keywords":["database","connection"]}

JSON only, no explanation:`;

/**
 * Extract intent and keywords from user query using LLM
 */
export async function extractIntent(
  llmClient: LLMClient,
  model: string,
  query: string,
): Promise<ExtractedIntent> {
  try {
    const response = await llmClient.chat({
      model,
      messages: [
        {
          role: "user",
          content: EXTRACTION_PROMPT.replace("{query}", query),
        },
      ],
      temperature: 0,
      maxTokens: 150,
    });

    const content = response.content?.trim() || "";

    // Try to parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        action: parsed.action || "other",
        targetPath: parsed.targetPath || undefined,
        keywords: Array.isArray(parsed.keywords)
          ? parsed.keywords.slice(0, 3)
          : [],
        originalQuery: query,
      };
    }
  } catch {
    // Fall back to simple extraction on error
  }

  // Fallback: simple keyword extraction
  return {
    action: "other",
    keywords: simpleExtract(query),
    originalQuery: query,
  };
}

/**
 * Simple fallback keyword extraction (no LLM)
 */
function simpleExtract(query: string): string[] {
  const stopWords = new Set([
    "read",
    "find",
    "search",
    "show",
    "list",
    "get",
    "the",
    "a",
    "an",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "and",
    "or",
    "is",
    "are",
    "this",
    "that",
    "me",
    "my",
    "i",
    "you",
    "your",
    "we",
    "code",
    "file",
    "files",
    "project",
  ]);

  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w) && !/^\.+$/.test(w))
    .slice(0, 3);
}
