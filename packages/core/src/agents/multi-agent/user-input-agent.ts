/**
 * User Input Agent - Analyzes user input to determine intent and task breakdown
 */

import type { LLMClient } from '../../llm/types.js';
import type { InputAnalysis, TaskSuggestion, UserIntent } from './types.js';

const INPUT_ANALYSIS_PROMPT = `You are an AI assistant that analyzes user input to determine the best approach for handling it.

Analyze the following user input and determine:
1. The user's intent (classify as one of the categories below)
2. Whether this requires task planning (complex multi-step work)
3. The best agent type to handle this
4. If complex, break it down into subtasks

## Intent Categories
- simple_question: Quick question that can be answered directly
- web_search: Requires searching the web for information (weather, news, facts, current events)
- code_exploration: Finding/understanding code without modifying it
- code_modification: Changes to existing code or creating new code
- bash_execution: Running shell commands, git operations, builds
- planning: Designing architecture or implementation strategy
- multi_step_task: Complex work requiring multiple agents
- unknown: Cannot classify

## Agent Types
- bash: For shell commands, git, builds
- explore: For finding files, searching code, understanding structure
- plan: For designing implementation approaches
- general: For web search, complex tasks, or anything needing multiple tools

IMPORTANT: If the user asks about weather, news, current events, or anything requiring up-to-date information from the internet, use intent "web_search" and suggestedAgent "general".

## Response Format
Respond with valid JSON only, no other text:
{
  "intent": "<intent_category>",
  "requiresPlanning": <true|false>,
  "suggestedAgent": "<agent_type>",
  "tasks": [
    {
      "subject": "Brief task title",
      "description": "Detailed description",
      "suggestedAgent": "<agent_type>",
      "dependencies": ["task_index_numbers"]
    }
  ]
}

For simple requests, tasks array should be empty or omitted.
For complex requests, break down into 2-5 subtasks with dependencies.

User Input:
`;

interface AnalysisResponse {
  intent: UserIntent;
  requiresPlanning: boolean;
  suggestedAgent?: string;
  tasks?: Array<{
    subject: string;
    description: string;
    suggestedAgent: string;
    dependencies?: string[];
  }>;
}

/**
 * Analyze user input to determine intent and task breakdown
 */
export async function analyzeUserInput(
  input: string,
  llmClient: LLMClient,
  model: string
): Promise<InputAnalysis> {
  try {
    const response = await llmClient.chat({
      model,
      messages: [
        {
          role: 'user',
          content: INPUT_ANALYSIS_PROMPT + input,
        },
      ],
      temperature: 0.1, // Low temperature for consistent classification
    });

    if (!response.content) {
      return createFallbackAnalysis(input);
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
    return createFallbackAnalysis(input);
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
 * Create a fallback analysis when LLM parsing fails
 */
function createFallbackAnalysis(input: string): InputAnalysis {
  // Simple heuristics for fallback
  const lowerInput = input.toLowerCase();

  let intent: UserIntent = 'unknown';
  let suggestedAgent = 'general';

  // Web search patterns - check first to avoid confusion with code exploration
  const webSearchPatterns = [
    'weather', 'news', 'price', 'stock', 'current', 'today', 'latest',
    'what is the', 'who is', 'search it', 'look up', 'google',
  ];
  const isWebSearch = webSearchPatterns.some(pattern => lowerInput.includes(pattern));

  if (isWebSearch) {
    intent = 'web_search';
    suggestedAgent = 'general';
  } else if ((lowerInput.includes('find') || lowerInput.includes('search') || lowerInput.includes('where')) &&
             (lowerInput.includes('file') || lowerInput.includes('code') || lowerInput.includes('function') || lowerInput.includes('class'))) {
    // Only use explore for code-related searches
    intent = 'code_exploration';
    suggestedAgent = 'explore';
  } else if (lowerInput.includes('run') || lowerInput.includes('execute') || lowerInput.includes('git')) {
    intent = 'bash_execution';
    suggestedAgent = 'bash';
  } else if (lowerInput.includes('plan') || lowerInput.includes('design') || lowerInput.includes('how should')) {
    intent = 'planning';
    suggestedAgent = 'plan';
  } else if (lowerInput.includes('?') && lowerInput.length < 100) {
    intent = 'simple_question';
    suggestedAgent = 'general';
  }

  return {
    intent,
    requiresPlanning: false,
    suggestedAgent,
    originalInput: input,
  };
}

/**
 * Quick intent classification without full analysis
 * Useful for simple routing decisions
 */
export function quickClassifyIntent(input: string): UserIntent {
  const lowerInput = input.toLowerCase().trim();

  // Command patterns
  if (/^(run|execute|npm|yarn|git|make|docker)\s/.test(lowerInput)) {
    return 'bash_execution';
  }

  // Question patterns
  if (/^(what|where|how|why|who|when|can|does|is)\s/i.test(lowerInput) && input.includes('?')) {
    if (lowerInput.includes('find') || lowerInput.includes('code') || lowerInput.includes('file')) {
      return 'code_exploration';
    }
    return 'simple_question';
  }

  // Action patterns
  if (/^(find|search|locate|show|list)\s/.test(lowerInput)) {
    return 'code_exploration';
  }

  if (/^(create|add|implement|write|fix|update|modify|change|refactor)\s/.test(lowerInput)) {
    return 'code_modification';
  }

  if (/^(plan|design|architect|think about|consider)\s/.test(lowerInput)) {
    return 'planning';
  }

  return 'unknown';
}
