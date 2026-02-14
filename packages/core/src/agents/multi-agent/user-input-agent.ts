/**
 * User Input Agent - Analyzes user input to determine intent and task breakdown
 *
 * Uses RAG (Retrieval-Augmented Generation) to intelligently match user
 * queries to appropriate tools and agents based on semantic similarity.
 */

import type { LLMClient } from '../../llm/types.js';
import type { InputAnalysis, TaskSuggestion, UserIntent } from './types.js';
import {
  initializeToolRAG,
  retrieveTools,
  type ToolRecommendation,
} from './tool-rag/index.js';

/**
 * Build the analysis prompt with RAG context
 */
function buildAnalysisPrompt(
  input: string,
  toolRecommendations: ToolRecommendation[]
): string {
  // Build tool context from RAG results
  const toolContext = toolRecommendations.length > 0
    ? `\n## Relevant Tools (from semantic search)\n${toolRecommendations
        .map(r => `- ${r.toolName} (relevance: ${(r.relevance * 100).toFixed(0)}%): ${r.topMatches[0]?.text || 'N/A'}`)
        .join('\n')}\n`
    : '';

  return `You are an AI assistant that analyzes user input to determine the best approach for handling it.

Analyze the following user input and determine:
1. The user's intent (classify as one of the categories below)
2. Whether this requires task planning (complex multi-step work)
3. The best agent type to handle this
4. If complex, break it down into subtasks
${toolContext}
## Intent Categories
- simple_question: Quick question that can be answered directly (use general agent)
- web_search: Requires searching the web for information (weather, news, facts, current events) - use general agent with web_search tool
- code_exploration: Finding/understanding code without modifying it
- code_modification: Changes to existing code or creating new code
- bash_execution: Running shell commands, git operations, builds
- planning: Designing architecture or implementation strategy
- multi_step_task: Complex work requiring multiple agents
- unknown: Cannot classify (default to general agent)

## Agent Types
- bash: For shell commands, git, builds
- explore: For finding files, searching code, understanding structure
- plan: For designing implementation approaches
- general: For web search, complex tasks, or anything needing multiple tools

## IMPORTANT
- If semantic search suggests web_search tool, use intent "web_search" and agent "general"
- If user asks about weather, news, current events, stocks, or needs real-time info, use web_search
- Always consider the tool recommendations when choosing an agent

## Response Format
Respond with valid JSON only, no other text:
{
  "intent": "<intent_category>",
  "requiresPlanning": <true|false>,
  "suggestedAgent": "<agent_type>",
  "suggestedTools": ["tool1", "tool2"],
  "tasks": []
}

User Input:
${input}`;
}

interface AnalysisResponse {
  intent: UserIntent;
  requiresPlanning: boolean;
  suggestedAgent?: string;
  suggestedTools?: string[];
  tasks?: Array<{
    subject: string;
    description: string;
    suggestedAgent: string;
    dependencies?: string[];
  }>;
}

/**
 * Analyze user input to determine intent and task breakdown
 *
 * Uses RAG to find semantically similar tool patterns, then
 * passes this context to the LLM for final classification.
 */
export async function analyzeUserInput(
  input: string,
  llmClient: LLMClient,
  model: string
): Promise<InputAnalysis> {
  try {
    // Initialize RAG if needed
    await initializeToolRAG();

    // Retrieve relevant tools using RAG
    const toolRecommendations = await retrieveTools(input, 5);

    // Build prompt with RAG context
    const prompt = buildAnalysisPrompt(input, toolRecommendations);

    const response = await llmClient.chat({
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1, // Low temperature for consistent classification
    });

    if (!response.content) {
      return createRAGFallbackAnalysis(input, toolRecommendations);
    }

    const parsed = parseAnalysisResponse(response.content);

    return {
      intent: parsed.intent,
      requiresPlanning: parsed.requiresPlanning,
      suggestedAgent: parsed.suggestedAgent,
      tasks: parsed.tasks?.map((task): TaskSuggestion => ({
        subject: task.subject,
        description: task.description,
        suggestedAgent: task.suggestedAgent,
        dependencies: task.dependencies,
      })),
      originalInput: input,
    };
  } catch {
    // Fallback to RAG-only analysis
    return createRAGOnlyAnalysis(input);
  }
}

/**
 * Parse the LLM response into a structured analysis
 */
function parseAnalysisResponse(content: string): AnalysisResponse {
  // Try to extract JSON from the response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  const parsed = JSON.parse(jsonMatch[0]) as AnalysisResponse;

  // Validate required fields
  if (!parsed.intent || typeof parsed.requiresPlanning !== 'boolean') {
    throw new Error('Missing required fields');
  }

  // Validate intent is one of the expected values
  const validIntents: UserIntent[] = [
    'simple_question',
    'web_search',
    'code_exploration',
    'code_modification',
    'bash_execution',
    'planning',
    'multi_step_task',
    'unknown',
  ];
  if (!validIntents.includes(parsed.intent)) {
    parsed.intent = 'unknown';
  }

  return parsed;
}

/**
 * Create fallback analysis using RAG recommendations when LLM parsing fails
 */
function createRAGFallbackAnalysis(
  input: string,
  recommendations: ToolRecommendation[]
): InputAnalysis {
  if (recommendations.length === 0) {
    return {
      intent: 'unknown',
      requiresPlanning: false,
      suggestedAgent: 'general',
      originalInput: input,
    };
  }

  const best = recommendations[0];

  // Map tool to intent
  let intent: UserIntent = 'unknown';
  if (best.toolName === 'web_search') {
    intent = 'web_search';
  } else if (['glob', 'grep', 'read_file'].includes(best.toolName)) {
    intent = 'code_exploration';
  } else if (best.toolName === 'write_file') {
    intent = 'code_modification';
  } else if (best.toolName === 'shell') {
    intent = 'bash_execution';
  }

  return {
    intent,
    requiresPlanning: false,
    suggestedAgent: best.suggestedAgent || 'general',
    originalInput: input,
  };
}

/**
 * RAG-only analysis without LLM (fastest fallback)
 */
async function createRAGOnlyAnalysis(input: string): Promise<InputAnalysis> {
  try {
    await initializeToolRAG();
    const recommendations = await retrieveTools(input, 3);

    return createRAGFallbackAnalysis(input, recommendations);
  } catch {
    // Ultimate fallback
    return {
      intent: 'unknown',
      requiresPlanning: false,
      suggestedAgent: 'general',
      originalInput: input,
    };
  }
}

/**
 * Quick intent classification using RAG
 *
 * Uses semantic search to determine intent without LLM call.
 * Faster than full analysis but less accurate.
 */
export async function quickClassifyIntent(input: string): Promise<UserIntent> {
  try {
    await initializeToolRAG();
    const recommendations = await retrieveTools(input, 3);

    if (recommendations.length === 0) {
      return 'unknown';
    }

    const best = recommendations[0];

    // Map tool to intent based on relevance
    if (best.relevance < 0.3) {
      return 'unknown';
    }

    switch (best.toolName) {
      case 'web_search':
        return 'web_search';
      case 'glob':
      case 'grep':
      case 'read_file':
        return 'code_exploration';
      case 'write_file':
        return 'code_modification';
      case 'shell':
        return 'bash_execution';
      case 'TaskCreate':
      case 'TaskUpdate':
        return 'planning';
      default:
        return 'simple_question';
    }
  } catch {
    return 'unknown';
  }
}

/**
 * Get tool recommendations for a query (exposed for debugging)
 */
export async function getToolRecommendations(
  input: string
): Promise<ToolRecommendation[]> {
  await initializeToolRAG();
  return retrieveTools(input, 5);
}
