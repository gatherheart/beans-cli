# Feature: List Models

## Overview

Provide the ability to list available models from each LLM provider. This helps users discover which models are available and ensures they use valid model names.

## Motivation

- Users often encounter 404 errors when using incorrect model names
- Model names change frequently (e.g., `gemini-1.5-pro` vs `gemini-2.0-flash`)
- Different providers have different naming conventions
- Users need to know what models are available before configuration

## API Design

### LLMClient Interface Extension

```typescript
interface LLMClient {
  // Existing method
  chat(request: ChatRequest): Promise<ChatResponse>;

  // New method
  listModels?(): Promise<ModelInfo[]>;
}

interface ModelInfo {
  id: string;           // Model identifier (e.g., "gpt-4o", "gemini-2.0-flash")
  name?: string;        // Display name
  description?: string; // Model description
  contextWindow?: number; // Max context length
  supportedMethods?: string[]; // e.g., ["generateContent", "chat"]
}
```

## Provider Endpoints

### OpenAI
- Endpoint: `GET https://api.openai.com/v1/models`
- Auth: `Authorization: Bearer <API_KEY>`
- Returns list of all available models

### Anthropic
- Endpoint: `GET https://api.anthropic.com/v1/models`
- Auth: `x-api-key: <API_KEY>`
- Note: May require specific API version header

### Google (Gemini)
- Endpoint: `GET https://generativelanguage.googleapis.com/v1beta/models?key=<API_KEY>`
- Returns models with supported generation methods
- Filter by `supportedGenerationMethods` containing `generateContent`

### Ollama
- Endpoint: `GET http://localhost:11434/api/tags`
- No authentication required
- Returns locally installed models

## CLI Command

```bash
# List models for current provider
beans --list-models

# List models for specific provider
beans --list-models --provider google

# Output format
Available models for google:
  gemini-2.0-flash     Gemini 2.0 Flash (experimental)
  gemini-1.5-pro-latest    Gemini 1.5 Pro
  gemini-1.5-flash-latest  Gemini 1.5 Flash
```

## Implementation Steps

1. Add `listModels()` method to `LLMClient` interface
2. Implement for each provider in `client.ts`
3. Add `--list-models` CLI option
4. Display formatted output

## Error Handling

- Return empty array if API call fails
- Log warning if provider doesn't support model listing
- Handle rate limits gracefully
