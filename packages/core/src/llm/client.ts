import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type {
  LLMClient,
  ChatRequest,
  ChatResponse,
  ProviderConfig,
  LLMProvider,
  ModelInfo,
  DebugRequestData,
  DebugResponseData,
} from './types.js';

/**
 * Infers the LLM provider from a model name.
 *
 * @remarks
 * Uses naming conventions to determine the provider:
 * - Models starting with 'gemini-' are Google models
 * - All other models are assumed to be Ollama (local) models
 *
 * @param model - The model name to infer provider from
 * @returns The inferred LLMProvider
 */
export function inferProviderFromModel(model: string): LLMProvider {
  if (model.startsWith('gemini-')) {
    return 'google';
  }
  // Assume Ollama for all other models (tinyllama, llama3, mistral, etc.)
  return 'ollama';
}

// Debug log file path
const DEBUG_LOG_DIR = join(homedir(), '.beans', 'logs');
const DEBUG_LOG_FILE = join(DEBUG_LOG_DIR, 'debug.log');

function ensureLogDir(): void {
  if (!existsSync(DEBUG_LOG_DIR)) {
    mkdirSync(DEBUG_LOG_DIR, { recursive: true });
  }
}

function writeDebugLog(content: string): void {
  ensureLogDir();
  const timestamp = new Date().toISOString();
  appendFileSync(DEBUG_LOG_FILE, `[${timestamp}]\n${content}\n\n`);
}

/**
 * Creates an LLM client for the specified provider.
 *
 * @remarks
 * This is the main factory function for creating provider-specific LLM clients.
 * It implements the factory pattern to abstract away provider differences and
 * return a unified LLMClient interface regardless of the underlying provider.
 *
 * Supported providers:
 * - **google**: Google Gemini API
 * - **ollama**: Ollama local inference server
 *
 * Each provider client implements the same LLMClient interface with `chat()` and
 * `listModels()` methods, handling provider-specific request formatting, response
 * parsing, and error handling internally.
 *
 * @param provider - The LLM provider to create a client for (google or ollama).
 * @param config - Provider-specific configuration including API keys, base URLs,
 * timeout settings, and additional headers.
 * @returns An LLMClient instance configured for the specified provider.
 * @throws Error if an unsupported provider is specified.
 */
export function createLLMClient(
  provider: LLMProvider,
  config: ProviderConfig
): LLMClient {
  let client: LLMClient;
  switch (provider) {
    case 'google':
      client = createGoogleClient(config);
      break;
    case 'ollama':
      client = createOllamaClient(config);
      break;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  // Wrap with debug logging if enabled
  if (config.debug?.enabled) {
    return wrapWithDebugLogging(client, config.debug);
  }

  return client;
}

/**
 * Wraps an LLM client with debug logging for requests and responses.
 */
function wrapWithDebugLogging(
  client: LLMClient,
  debug: NonNullable<ProviderConfig['debug']>
): LLMClient {
  const emitDebugEvent = debug.onDebugEvent;

  const buildRequestData = (request: ChatRequest): DebugRequestData => ({
    model: request.model,
    systemPrompt: request.systemPrompt,
    messageCount: request.messages.length,
    toolCount: request.tools?.length ?? 0,
    messages: request.messages.map(msg => ({
      role: msg.role,
      contentPreview: msg.content?.substring(0, 200) ?? '',
      toolCallCount: msg.toolCalls?.length,
      toolResultCount: msg.toolResults?.length,
    })),
  });

  const buildResponseData = (response: ChatResponse): DebugResponseData => ({
    model: response.model,
    finishReason: response.finishReason,
    contentPreview: response.content?.substring(0, 500) ?? '',
    toolCallCount: response.toolCalls?.length ?? 0,
    usage: response.usage,
  });

  const logRequest = (request: ChatRequest) => {
    // Emit event for UI if callback provided
    if (emitDebugEvent) {
      emitDebugEvent({ type: 'request', data: buildRequestData(request) });
    }

    if (!debug.logRequests) return;

    const lines: string[] = [
      '─'.repeat(60),
      '🔵 REQUEST',
      `Model: ${request.model}`,
    ];

    if (request.systemPrompt) {
      lines.push('', 'System Prompt:', request.systemPrompt);
    }

    lines.push('', 'Messages:');
    request.messages.forEach((msg) => {
      lines.push(`  [${msg.role}]: ${msg.content || ''}`);
      if (msg.toolCalls) {
        lines.push(`    Tool Calls: ${JSON.stringify(msg.toolCalls, null, 2)}`);
      }
      if (msg.toolResults) {
        msg.toolResults.forEach(r => {
          lines.push(`    Tool Result [${r.toolCallId}]: ${r.content}`);
        });
      }
    });

    if (request.tools) {
      lines.push('', `Tools: ${request.tools.map(t => t.name).join(', ')}`);
    }

    lines.push('─'.repeat(60));
    writeDebugLog(lines.join('\n'));
  };

  const logResponse = (response: ChatResponse) => {
    // Emit event for UI if callback provided
    if (emitDebugEvent) {
      emitDebugEvent({ type: 'response', data: buildResponseData(response) });
    }

    if (!debug.logResponses) return;

    const lines: string[] = [
      '🟢 RESPONSE',
      `Model: ${response.model}`,
      `Finish: ${response.finishReason}`,
    ];

    if (response.content) {
      lines.push('', 'Content:', response.content);
    }

    if (response.toolCalls && response.toolCalls.length > 0) {
      lines.push('', 'Tool Calls:');
      response.toolCalls.forEach((tc) => {
        lines.push(`  - ${tc.name}: ${JSON.stringify(tc.arguments, null, 2)}`);
      });
    }

    if (response.usage) {
      lines.push('', `Tokens: ${response.usage.promptTokens} prompt + ${response.usage.completionTokens} completion = ${response.usage.totalTokens} total`);
    }

    lines.push('─'.repeat(60));
    writeDebugLog(lines.join('\n'));
  };

  return {
    async chat(request: ChatRequest): Promise<ChatResponse> {
      logRequest(request);
      const response = await client.chat(request);
      logResponse(response);
      return response;
    },

    async *chatStream(request: ChatRequest) {
      logRequest(request);
      if (!client.chatStream) {
        const response = await client.chat(request);
        logResponse(response);
        yield {
          content: response.content ?? undefined,
          done: true,
          finishReason: response.finishReason,
          usage: response.usage,
        };
        return;
      }

      let accumulatedContent = '';
      const accumulatedToolCalls: import('../agents/types.js').ToolCall[] = [];

      for await (const chunk of client.chatStream(request)) {
        if (chunk.content) {
          accumulatedContent += chunk.content;
        }
        const delta = chunk.toolCallDelta;
        if (delta && typeof delta.id === 'string' && typeof delta.name === 'string') {
          accumulatedToolCalls.push({
            id: delta.id,
            name: delta.name,
            arguments: delta.arguments ?? {},
          });
        }
        if (chunk.done && debug.logResponses) {
          const response: ChatResponse = {
            content: accumulatedContent || null,
            toolCalls: accumulatedToolCalls.length > 0 ? accumulatedToolCalls : undefined,
            model: request.model,
            finishReason: chunk.finishReason ?? 'stop',
            usage: chunk.usage,
          };
          logResponse(response);
        }
        yield chunk;
      }
    },

    listModels: client.listModels?.bind(client),
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

  const buildRequestBody = (request: ChatRequest) => ({
    contents: formatMessagesForGoogle(request),
    systemInstruction: request.systemPrompt
      ? { parts: [{ text: request.systemPrompt }] }
      : undefined,
    tools: request.tools && request.tools.length > 0
      ? [{ functionDeclarations: request.tools.map(formatToolForGoogle) }]
      : undefined,
    generationConfig: {
      temperature: request.temperature,
      maxOutputTokens: request.maxTokens,
      topP: request.topP,
    },
  });

  return {
    async chat(request: ChatRequest): Promise<ChatResponse> {
      const url = `${baseUrl}/models/${request.model}:generateContent?key=${config.apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body: JSON.stringify(buildRequestBody(request)),
        signal: AbortSignal.timeout(config.timeout ?? 60000),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Google API error: ${response.status} - ${errorBody}`);
      }

      const data = await response.json() as Parameters<typeof parseGoogleResponse>[0];
      return parseGoogleResponse(data, request.model);
    },

    async *chatStream(
      request: ChatRequest
    ): AsyncGenerator<import('./types.js').ChatStreamChunk, void, unknown> {
      const url = `${baseUrl}/models/${request.model}:streamGenerateContent?key=${config.apiKey}&alt=sse`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body: JSON.stringify(buildRequestBody(request)),
        signal: AbortSignal.timeout(config.timeout ?? 120000),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Google API error: ${response.status} - ${errorBody}`);
      }

      if (!response.body) {
        throw new Error('No response body for streaming');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const accumulatedToolCalls: import('../agents/types.js').ToolCall[] = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === '[DONE]') continue;

              try {
                const data = JSON.parse(jsonStr) as {
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
                };

                const candidate = data.candidates?.[0];
                const parts = candidate?.content?.parts ?? [];

                for (const part of parts) {
                  if (part.text) {
                    yield {
                      content: part.text,
                      done: false,
                    };
                  }
                  if (part.functionCall) {
                    const toolCall = {
                      id: `call_${accumulatedToolCalls.length}`,
                      name: part.functionCall.name,
                      arguments: part.functionCall.args,
                    };
                    accumulatedToolCalls.push(toolCall);
                    yield {
                      toolCallDelta: toolCall,
                      done: false,
                    };
                  }
                }

                // Check for finish
                if (candidate?.finishReason) {
                  yield {
                    done: true,
                    finishReason: accumulatedToolCalls.length > 0 ? 'tool_calls' : 'stop',
                    usage: data.usageMetadata
                      ? {
                          promptTokens: data.usageMetadata.promptTokenCount,
                          completionTokens: data.usageMetadata.candidatesTokenCount,
                          totalTokens: data.usageMetadata.totalTokenCount,
                        }
                      : undefined,
                  };
                }
              } catch {
                // Skip invalid JSON chunks
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
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
        const errorBody = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorBody}`);
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
          function: { name: tc.name, arguments: tc.arguments },
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
 * Extracts content and tool calls from Ollama's response structure.
 * Handles both simple text responses and tool call responses.
 *
 * @param data - The raw response from Ollama's chat API.
 * @param model - The model identifier to include in the response.
 * @returns A ChatResponse object in the unified format.
 */
function parseOllamaResponse(
  data: {
    message: {
      content: string;
      tool_calls?: Array<{
        id?: string;
        function: {
          name: string;
          arguments: Record<string, unknown>;
        };
      }>;
    };
    done: boolean;
  },
  model: string
): ChatResponse {
  const toolCalls = data.message.tool_calls?.map((tc, index) => ({
    id: tc.id ?? `call_${index}`,
    name: tc.function.name,
    arguments: tc.function.arguments,
  }));

  return {
    content: data.message.content || null,
    toolCalls,
    model,
    finishReason: toolCalls && toolCalls.length > 0 ? 'tool_calls' : 'stop',
  };
}
