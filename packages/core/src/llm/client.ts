import type {
  LLMClient,
  ChatRequest,
  ChatResponse,
  ProviderConfig,
  LLMProvider,
  ModelInfo,
} from './types.js';

/**
 * Creates an LLM client for the specified provider.
 *
 * @remarks
 * This is the main factory function for creating provider-specific LLM clients.
 * It implements the factory pattern to abstract away provider differences and
 * return a unified LLMClient interface regardless of the underlying provider.
 *
 * Supported providers:
 * - **openai**: OpenAI API (also compatible with Azure OpenAI and local endpoints)
 * - **anthropic**: Anthropic Claude API
 * - **google**: Google Gemini API
 * - **ollama**: Ollama local inference server
 *
 * Each provider client implements the same LLMClient interface with `chat()` and
 * `listModels()` methods, handling provider-specific request formatting, response
 * parsing, and error handling internally.
 *
 * @param provider - The LLM provider to create a client for (openai, anthropic,
 * google, or ollama).
 * @param config - Provider-specific configuration including API keys, base URLs,
 * timeout settings, and additional headers.
 * @returns An LLMClient instance configured for the specified provider.
 * @throws Error if an unsupported provider is specified.
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
 * Creates an OpenAI-compatible LLM client.
 *
 * @remarks
 * This function creates a client that implements the OpenAI chat completions API.
 * It is compatible with:
 * - OpenAI's official API (api.openai.com)
 * - Azure OpenAI Service
 * - Local OpenAI-compatible endpoints (e.g., LocalAI, vLLM)
 *
 * The client implements two methods:
 * - `chat()`: Sends a chat completion request and returns the response
 * - `listModels()`: Retrieves available GPT models from the API
 *
 * Request formatting and response parsing are handled internally, converting
 * between the unified LLMClient interface and OpenAI's specific API format.
 *
 * @param config - Provider configuration including API key, optional base URL,
 * organization ID, custom headers, and timeout settings.
 * @returns An LLMClient instance configured for OpenAI-compatible APIs.
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
 * Creates an Anthropic Claude LLM client.
 *
 * @remarks
 * This function creates a client that implements the Anthropic Messages API
 * for communicating with Claude models. It handles the specific requirements
 * of Anthropic's API including the anthropic-version header and unique message
 * formatting.
 *
 * The client implements two methods:
 * - `chat()`: Sends a message request and returns Claude's response
 * - `listModels()`: Returns a static list of known Claude models (Anthropic
 *   does not provide a public model listing API)
 *
 * Key differences from OpenAI's API:
 * - System prompt is passed as a separate field, not as a message
 * - Tool definitions use `input_schema` instead of `parameters`
 * - Response content is an array of content blocks
 *
 * @param config - Provider configuration including API key, optional base URL,
 * custom headers, and timeout settings.
 * @returns An LLMClient instance configured for the Anthropic API.
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
 * Creates a Google Gemini LLM client.
 *
 * @remarks
 * This function creates a client that implements the Google Generative Language
 * API for communicating with Gemini models. It handles Google's unique API
 * structure including content parts, system instructions, and function
 * declarations.
 *
 * The client implements two methods:
 * - `chat()`: Sends a generateContent request and returns Gemini's response
 * - `listModels()`: Retrieves models that support the generateContent method
 *
 * Key differences from other providers:
 * - API key is passed as a query parameter, not in headers
 * - Messages use a `contents` array with `parts` sub-arrays
 * - System prompt uses `systemInstruction` with its own parts structure
 * - Tools are wrapped in a `functionDeclarations` array
 * - Response candidates may be empty in some edge cases
 *
 * @param config - Provider configuration including API key, optional base URL,
 * custom headers, and timeout settings.
 * @returns An LLMClient instance configured for the Google Gemini API.
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
 * Creates an Ollama local LLM client.
 *
 * @remarks
 * This function creates a client that communicates with a local Ollama server
 * for running open-source language models. Ollama provides a simple API for
 * running models like Llama, Mistral, and others locally.
 *
 * The client implements two methods:
 * - `chat()`: Sends a chat request to the local Ollama server
 * - `listModels()`: Retrieves the list of locally available models (tags)
 *
 * Key characteristics:
 * - Default endpoint is localhost:11434 (Ollama's default port)
 * - No API key required for local usage
 * - Longer default timeout (120s) to accommodate slower local inference
 * - Streaming is disabled by default for simpler response handling
 * - Model options use Ollama-specific naming (num_predict vs max_tokens)
 *
 * @param config - Provider configuration including optional base URL (defaults
 * to localhost:11434), custom headers, and timeout settings.
 * @returns An LLMClient instance configured for the Ollama API.
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

/**
 * Formats messages for the OpenAI chat completions API.
 *
 * @remarks
 * Converts the unified Message format to OpenAI's expected structure.
 * Handles three message types:
 * - System/User messages: passed through with content
 * - Assistant messages: includes tool_calls array if tools were invoked
 * - Tool result messages: split into individual tool messages with tool_call_id
 *
 * @param request - The chat request containing messages and optional system prompt.
 * @returns An array of messages formatted for OpenAI's API.
 */
function formatMessagesForOpenAI(request: ChatRequest) {
  const messages: Array<{
    role: string;
    content: string | null;
    tool_calls?: unknown[];
    tool_call_id?: string;
  }> = [];

  if (request.systemPrompt) {
    messages.push({ role: 'system', content: request.systemPrompt });
  }

  for (const msg of request.messages) {
    if (msg.role === 'tool' && msg.toolResults) {
      // Each tool result is a separate message in OpenAI format
      for (const result of msg.toolResults) {
        messages.push({
          role: 'tool',
          tool_call_id: result.toolCallId,
          content: result.error ?? result.content,
        });
      }
    } else if (msg.role === 'assistant') {
      messages.push({
        role: 'assistant',
        content: msg.content || null,
        tool_calls: msg.toolCalls?.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      });
    } else {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  return messages;
}

/**
 * Formats messages for the Anthropic Messages API.
 *
 * @remarks
 * Converts the unified Message format to Anthropic's expected structure.
 * Handles three message types:
 * - User messages: passed through as-is
 * - Assistant messages: includes tool_use blocks if tool calls were made
 * - Tool result messages: formatted as user messages with tool_result blocks
 *
 * @param request - The chat request containing messages.
 * @returns An array of messages formatted for Anthropic's API.
 */
function formatMessagesForAnthropic(request: ChatRequest) {
  const messages: Array<{
    role: 'user' | 'assistant';
    content: string | Array<{ type: string; [key: string]: unknown }>;
  }> = [];

  for (const msg of request.messages) {
    if (msg.role === 'assistant') {
      // Build content array with text and tool_use blocks
      const content: Array<{ type: string; [key: string]: unknown }> = [];

      if (msg.content) {
        content.push({ type: 'text', text: msg.content });
      }

      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          });
        }
      }

      messages.push({
        role: 'assistant',
        content: content.length > 0 ? content : msg.content,
      });
    } else if (msg.role === 'tool' && msg.toolResults) {
      // Tool results are sent as user messages with tool_result blocks
      const content = msg.toolResults.map((result) => ({
        type: 'tool_result',
        tool_use_id: result.toolCallId,
        content: result.error ?? result.content,
      }));

      messages.push({ role: 'user', content });
    } else {
      // Regular user message
      messages.push({ role: 'user', content: msg.content });
    }
  }

  return messages;
}

/**
 * Formats messages for the Google Generative Language API.
 *
 * @remarks
 * Converts the unified Message format to Google's expected structure.
 * Handles three message types:
 * - User messages: text wrapped in parts array
 * - Model messages: includes functionCall parts if tool calls were made
 * - Tool results: formatted as user messages with functionResponse parts
 *
 * @param request - The chat request containing messages.
 * @returns An array of contents formatted for Google's API.
 */
function formatMessagesForGoogle(request: ChatRequest) {
  const contents: Array<{
    role: 'user' | 'model';
    parts: Array<{ text?: string; functionCall?: unknown; functionResponse?: unknown }>;
  }> = [];

  for (const msg of request.messages) {
    if (msg.role === 'assistant') {
      const parts: Array<{ text?: string; functionCall?: unknown }> = [];

      if (msg.content) {
        parts.push({ text: msg.content });
      }

      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          parts.push({
            functionCall: { name: tc.name, args: tc.arguments },
          });
        }
      }

      contents.push({ role: 'model', parts });
    } else if (msg.role === 'tool' && msg.toolResults) {
      // Tool results are sent as user messages with functionResponse parts
      const parts = msg.toolResults.map((result) => ({
        functionResponse: {
          name: result.toolCallId,
          response: { content: result.error ?? result.content },
        },
      }));

      contents.push({ role: 'user', parts });
    } else {
      contents.push({ role: 'user', parts: [{ text: msg.content }] });
    }
  }

  return contents;
}

/**
 * Formats messages for the Ollama chat API.
 *
 * @remarks
 * Converts the unified Message format to Ollama's expected structure.
 * Ollama follows a format similar to OpenAI, with the system prompt
 * prepended as a system message. Tool calls and results follow OpenAI's
 * format with tool_calls arrays and tool_call_id references.
 *
 * @param request - The chat request containing messages and optional system prompt.
 * @returns An array of messages formatted for Ollama's API.
 */
function formatMessagesForOllama(request: ChatRequest) {
  const messages: Array<{
    role: string;
    content: string;
    tool_calls?: unknown[];
    tool_call_id?: string;
  }> = [];

  if (request.systemPrompt) {
    messages.push({ role: 'system', content: request.systemPrompt });
  }

  for (const msg of request.messages) {
    if (msg.role === 'tool' && msg.toolResults) {
      for (const result of msg.toolResults) {
        messages.push({
          role: 'tool',
          tool_call_id: result.toolCallId,
          content: result.error ?? result.content,
        });
      }
    } else if (msg.role === 'assistant') {
      messages.push({
        role: 'assistant',
        content: msg.content,
        tool_calls: msg.toolCalls?.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      });
    } else {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  return messages;
}

// Tool formatting helpers

/**
 * Formats a tool definition for the OpenAI function calling API.
 *
 * @remarks
 * Wraps the tool definition in OpenAI's expected structure with a 'function'
 * type and nested function object containing name, description, and parameters.
 *
 * @param tool - The unified tool definition to format.
 * @returns A tool object formatted for OpenAI's API.
 */
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

/**
 * Formats a tool definition for the Anthropic tool use API.
 *
 * @remarks
 * Converts the tool definition to Anthropic's expected structure. The key
 * difference from OpenAI is that parameters are passed as `input_schema`
 * instead of `parameters`.
 *
 * @param tool - The unified tool definition to format.
 * @returns A tool object formatted for Anthropic's API.
 */
function formatToolForAnthropic(tool: import('../tools/types.js').ToolDefinition) {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  };
}

/**
 * Formats a tool definition for the Google function declarations API.
 *
 * @remarks
 * Converts the tool definition to Google's expected structure. Google uses
 * a straightforward format with name, description, and parameters at the
 * top level.
 *
 * @param tool - The unified tool definition to format.
 * @returns A function declaration object formatted for Google's API.
 */
function formatToolForGoogle(tool: import('../tools/types.js').ToolDefinition) {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  };
}

/**
 * Formats a tool definition for the Ollama tool calling API.
 *
 * @remarks
 * Converts the tool definition to Ollama's expected structure, which follows
 * the OpenAI format with a 'function' type wrapper and nested function object.
 *
 * @param tool - The unified tool definition to format.
 * @returns A tool object formatted for Ollama's API.
 */
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

/**
 * Parses an OpenAI chat completion response into the unified format.
 *
 * @remarks
 * Extracts content, tool calls, usage statistics, and finish reason from
 * OpenAI's response structure. Tool call arguments are parsed from JSON
 * strings back into objects.
 *
 * @param data - The raw response from OpenAI's chat completions API.
 * @returns A ChatResponse object in the unified format.
 */
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

/**
 * Parses an Anthropic Messages response into the unified format.
 *
 * @remarks
 * Extracts text content and tool_use blocks from Anthropic's content array.
 * Tool use blocks are converted to the unified ToolCall format with id, name,
 * and arguments (called 'input' in Anthropic's format).
 *
 * @param data - The raw response from Anthropic's Messages API.
 * @returns A ChatResponse object in the unified format.
 */
function parseAnthropicResponse(data: {
  content: Array<{
    type: string;
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  }>;
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
  model: string;
}): ChatResponse {
  const textContent = data.content.find((c) => c.type === 'text');
  const toolUseBlocks = data.content.filter((c) => c.type === 'tool_use');

  const toolCalls = toolUseBlocks.length > 0
    ? toolUseBlocks.map((block) => ({
        id: block.id!,
        name: block.name!,
        arguments: block.input ?? {},
      }))
    : undefined;

  return {
    content: textContent?.text ?? null,
    toolCalls,
    usage: {
      promptTokens: data.usage.input_tokens,
      completionTokens: data.usage.output_tokens,
      totalTokens: data.usage.input_tokens + data.usage.output_tokens,
    },
    model: data.model,
    finishReason: data.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
  };
}

/**
 * Parses a Google Generative Language response into the unified format.
 *
 * @remarks
 * Handles Google's unique response structure with candidates and content parts.
 * Extracts both text content and functionCall parts for tool invocation.
 * Includes error handling for API errors and empty candidate arrays.
 *
 * @param data - The raw response from Google's generateContent API.
 * @param model - The model identifier to include in the response.
 * @returns A ChatResponse object in the unified format.
 * @throws Error if the response contains an API error.
 */
function parseGoogleResponse(
  data: {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          functionCall?: { name: string; args: Record<string, unknown> };
        }>;
      };
      finishReason?: string;
    }>;
    usageMetadata?: {
      promptTokenCount: number;
      candidatesTokenCount: number;
      totalTokenCount: number;
    };
    error?: { message: string; code: number };
  },
  model: string
): ChatResponse {
  // Handle API errors
  if (data.error) {
    throw new Error(`Google API error: ${data.error.message}`);
  }

  // Handle empty candidates
  if (!data.candidates || data.candidates.length === 0) {
    return {
      content: null,
      model,
      finishReason: 'stop',
    };
  }

  const candidate = data.candidates[0];
  const parts = candidate.content?.parts ?? [];

  const text = parts.find((p) => p.text)?.text;
  const functionCalls = parts.filter((p) => p.functionCall);

  const toolCalls = functionCalls.length > 0
    ? functionCalls.map((part, index) => ({
        id: `call_${index}`,
        name: part.functionCall!.name,
        arguments: part.functionCall!.args,
      }))
    : undefined;

  return {
    content: text ?? null,
    toolCalls,
    usage: data.usageMetadata
      ? {
          promptTokens: data.usageMetadata.promptTokenCount,
          completionTokens: data.usageMetadata.candidatesTokenCount,
          totalTokens: data.usageMetadata.totalTokenCount,
        }
      : undefined,
    model,
    finishReason: toolCalls ? 'tool_calls' : 'stop',
  };
}

/**
 * Parses an Ollama chat response into the unified format.
 *
 * @remarks
 * Extracts content from Ollama's simple response structure. Ollama responses
 * are straightforward with a message object containing the content. Usage
 * statistics are not currently provided by Ollama's API.
 *
 * @param data - The raw response from Ollama's chat API.
 * @param model - The model identifier to include in the response.
 * @returns A ChatResponse object in the unified format.
 */
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
