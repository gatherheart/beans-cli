import type {
  LLMClient,
  ChatRequest,
  ChatResponse,
  ProviderConfig,
  LLMProvider,
  ModelInfo,
} from './types.js';

/**
 * Factory for creating LLM clients
 */
export function createLLMClient(
  provider: LLMProvider,
  config: ProviderConfig
): LLMClient {
  switch (provider) {
    case 'openai':
      // Dynamic import to avoid bundling all providers
      return createOpenAIClient(config);
    case 'anthropic':
      return createAnthropicClient(config);
    case 'google':
      return createGoogleClient(config);
    case 'ollama':
      return createOllamaClient(config);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * OpenAI-compatible client (works with OpenAI, Azure, local endpoints)
 */
function createOpenAIClient(config: ProviderConfig): LLMClient {
  const baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';

  return {
    async chat(request: ChatRequest): Promise<ChatResponse> {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
          ...(config.organizationId && {
            'OpenAI-Organization': config.organizationId,
          }),
          ...config.headers,
        },
        body: JSON.stringify({
          model: request.model,
          messages: formatMessagesForOpenAI(request),
          tools: request.tools?.map(formatToolForOpenAI),
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          top_p: request.topP,
          stop: request.stopSequences,
        }),
        signal: AbortSignal.timeout(config.timeout ?? 60000),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json() as Parameters<typeof parseOpenAIResponse>[0];
      return parseOpenAIResponse(data);
    },

    async listModels(): Promise<ModelInfo[]> {
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          ...(config.organizationId && {
            'OpenAI-Organization': config.organizationId,
          }),
          ...config.headers,
        },
        signal: AbortSignal.timeout(config.timeout ?? 60000),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json() as { data: Array<{ id: string; owned_by: string }> };
      return data.data
        .filter((m) => m.id.startsWith('gpt'))
        .map((m) => ({
          id: m.id,
          name: m.id,
          description: `Owned by ${m.owned_by}`,
        }));
    },
  };
}

/**
 * Anthropic Claude client
 */
function createAnthropicClient(config: ProviderConfig): LLMClient {
  const baseUrl = config.baseUrl ?? 'https://api.anthropic.com/v1';

  return {
    async chat(request: ChatRequest): Promise<ChatResponse> {
      const response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey ?? '',
          'anthropic-version': '2023-06-01',
          ...config.headers,
        },
        body: JSON.stringify({
          model: request.model,
          system: request.systemPrompt,
          messages: formatMessagesForAnthropic(request),
          tools: request.tools?.map(formatToolForAnthropic),
          max_tokens: request.maxTokens ?? 4096,
          temperature: request.temperature,
          top_p: request.topP,
        }),
        signal: AbortSignal.timeout(config.timeout ?? 60000),
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`);
      }

      const data = await response.json() as Parameters<typeof parseAnthropicResponse>[0];
      return parseAnthropicResponse(data);
    },

    async listModels(): Promise<ModelInfo[]> {
      // Anthropic doesn't have a public list models API, return known models
      return [
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Latest Sonnet model' },
        { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: 'Most capable model' },
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Balanced performance' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast and efficient' },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Previous flagship' },
      ];
    },
  };
}

/**
 * Google Gemini client
 */
function createGoogleClient(config: ProviderConfig): LLMClient {
  const baseUrl =
    config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';

  return {
    async chat(request: ChatRequest): Promise<ChatResponse> {
      const url = `${baseUrl}/models/${request.model}:generateContent?key=${config.apiKey}`;

      const body = {
        contents: formatMessagesForGoogle(request),
        systemInstruction: request.systemPrompt
          ? { parts: [{ text: request.systemPrompt }] }
          : undefined,
        tools: request.tools
          ? [{ functionDeclarations: request.tools.map(formatToolForGoogle) }]
          : undefined,
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
          topP: request.topP,
        },
      };

      console.log('[Google API] URL:', url.replace(/key=[^&]+/, 'key=***'));
      console.log('[Google API] Body:', JSON.stringify(body, null, 2));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(config.timeout ?? 60000),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Google API error: ${response.status} - ${errorBody}`);
      }

      const data = await response.json() as Parameters<typeof parseGoogleResponse>[0];
      return parseGoogleResponse(data, request.model);
    },

    async listModels(): Promise<ModelInfo[]> {
      const response = await fetch(`${baseUrl}/models?key=${config.apiKey}`, {
        headers: config.headers,
        signal: AbortSignal.timeout(config.timeout ?? 60000),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Google API error: ${response.status} - ${errorBody}`);
      }

      const data = await response.json() as {
        models: Array<{
          name: string;
          displayName: string;
          description: string;
          supportedGenerationMethods: string[];
        }>;
      };

      return data.models
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => ({
          id: m.name.replace('models/', ''),
          name: m.displayName,
          description: m.description,
          supportedMethods: m.supportedGenerationMethods,
        }));
    },
  };
}

/**
 * Ollama local client
 */
function createOllamaClient(config: ProviderConfig): LLMClient {
  const baseUrl = config.baseUrl ?? 'http://localhost:11434';

  return {
    async chat(request: ChatRequest): Promise<ChatResponse> {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body: JSON.stringify({
          model: request.model,
          messages: formatMessagesForOllama(request),
          tools: request.tools?.map(formatToolForOllama),
          options: {
            temperature: request.temperature,
            num_predict: request.maxTokens,
            top_p: request.topP,
          },
          stream: false,
        }),
        signal: AbortSignal.timeout(config.timeout ?? 120000),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json() as Parameters<typeof parseOllamaResponse>[0];
      return parseOllamaResponse(data, request.model);
    },

    async listModels(): Promise<ModelInfo[]> {
      const response = await fetch(`${baseUrl}/api/tags`, {
        headers: config.headers,
        signal: AbortSignal.timeout(config.timeout ?? 60000),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json() as {
        models: Array<{
          name: string;
          size: number;
          modified_at: string;
        }>;
      };

      return data.models.map((m) => ({
        id: m.name,
        name: m.name,
        description: `Size: ${Math.round(m.size / 1024 / 1024 / 1024 * 10) / 10}GB`,
      }));
    },
  };
}

// Message formatting helpers
function formatMessagesForOpenAI(request: ChatRequest) {
  const messages: Array<{ role: string; content: string; tool_calls?: unknown[] }> = [];

  if (request.systemPrompt) {
    messages.push({ role: 'system', content: request.systemPrompt });
  }

  for (const msg of request.messages) {
    messages.push({
      role: msg.role === 'tool' ? 'tool' : msg.role,
      content: msg.content,
      tool_calls: msg.toolCalls?.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      })),
    });
  }

  return messages;
}

function formatMessagesForAnthropic(request: ChatRequest) {
  return request.messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content,
  }));
}

function formatMessagesForGoogle(request: ChatRequest) {
  return request.messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));
}

function formatMessagesForOllama(request: ChatRequest) {
  const messages = [];

  if (request.systemPrompt) {
    messages.push({ role: 'system', content: request.systemPrompt });
  }

  for (const msg of request.messages) {
    messages.push({ role: msg.role, content: msg.content });
  }

  return messages;
}

// Tool formatting helpers
function formatToolForOpenAI(tool: import('../tools/types.js').ToolDefinition) {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

function formatToolForAnthropic(tool: import('../tools/types.js').ToolDefinition) {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  };
}

function formatToolForGoogle(tool: import('../tools/types.js').ToolDefinition) {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  };
}

function formatToolForOllama(tool: import('../tools/types.js').ToolDefinition) {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

// Response parsing helpers
function parseOpenAIResponse(data: {
  choices: Array<{
    message: {
      content: string | null;
      tool_calls?: Array<{
        id: string;
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  model: string;
}): ChatResponse {
  const choice = data.choices[0];
  return {
    content: choice.message.content,
    toolCalls: choice.message.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    })),
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined,
    model: data.model,
    finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
  };
}

function parseAnthropicResponse(data: {
  content: Array<{ type: string; text?: string }>;
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
  model: string;
}): ChatResponse {
  const textContent = data.content.find((c) => c.type === 'text');
  return {
    content: textContent?.text ?? null,
    usage: {
      promptTokens: data.usage.input_tokens,
      completionTokens: data.usage.output_tokens,
      totalTokens: data.usage.input_tokens + data.usage.output_tokens,
    },
    model: data.model,
    finishReason: data.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
  };
}

function parseGoogleResponse(
  data: {
    candidates: Array<{
      content: { parts: Array<{ text?: string }> };
      finishReason: string;
    }>;
    usageMetadata?: {
      promptTokenCount: number;
      candidatesTokenCount: number;
      totalTokenCount: number;
    };
  },
  model: string
): ChatResponse {
  const candidate = data.candidates[0];
  const text = candidate.content.parts.find((p) => p.text)?.text;
  return {
    content: text ?? null,
    usage: data.usageMetadata
      ? {
          promptTokens: data.usageMetadata.promptTokenCount,
          completionTokens: data.usageMetadata.candidatesTokenCount,
          totalTokens: data.usageMetadata.totalTokenCount,
        }
      : undefined,
    model,
    finishReason: 'stop',
  };
}

function parseOllamaResponse(
  data: { message: { content: string }; done: boolean },
  model: string
): ChatResponse {
  return {
    content: data.message.content,
    model,
    finishReason: 'stop',
  };
}
