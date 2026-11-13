import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLLMClient } from "../../../packages/core/src/llm/client.js";
import type { ToolCall } from "../../../packages/core/src/agents/types.js";

describe("Google Client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([false, true])(
    "replays signed function calls and real function response names (stream=%s)",
    async (stream) => {
      const parts = [
        {
          functionCall: { name: "submit_solution", args: { code: "pass" } },
          thoughtSignature: "opaque-signature==",
        },
        { functionCall: { name: "read_context", args: {} } },
      ];
      const payload = {
        candidates: [{ content: { parts }, finishReason: "STOP" }],
      };
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          stream
            ? `data: ${JSON.stringify(payload)}\n\n`
            : JSON.stringify(payload),
          { status: 200 },
        ),
      );
      const client = createLLMClient("google", { apiKey: "test-key" });
      const firstRequest = {
        model: "gemini-3.6-flash",
        messages: [{ role: "user" as const, content: "Solve." }],
      };
      let calls: ToolCall[];
      if (stream) {
        calls = [];
        for await (const chunk of client.chatStream(firstRequest)) {
          if (chunk.toolCallDelta) calls.push(chunk.toolCallDelta as ToolCall);
        }
      } else {
        calls = (await client.chat(firstRequest)).toolCalls!;
      }
      expect(calls[0].thoughtSignature).toBe("opaque-signature==");
      expect(calls[1].thoughtSignature).toBeUndefined();
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "Done." }] } }],
          }),
        ),
      );
      await client.chat({
        ...firstRequest,
        messages: [
          ...firstRequest.messages,
          { role: "assistant", content: "", toolCalls: calls },
          {
            role: "tool",
            content: "",
            toolResults: calls.map((call) => ({
              toolCallId: call.id,
              content: "ok",
            })),
          },
        ],
      });
      const body = JSON.parse(
        vi.mocked(fetch).mock.calls[1][1]!.body as string,
      );
      expect(body.contents[1].parts).toEqual(parts);
      expect(
        body.contents[2].parts.map(
          (part: { functionResponse: { name: string } }) =>
            part.functionResponse.name,
        ),
      ).toEqual(["submit_solution", "read_context"]);
    },
  );

  describe("listModels", () => {
    it("should list models that support generateContent", async () => {
      const mockResponse = {
        models: [
          {
            name: "models/gemini-2.0-flash",
            displayName: "Gemini 2.0 Flash",
            description: "Fast model",
            supportedGenerationMethods: ["generateContent"],
          },
          {
            name: "models/embedding-001",
            displayName: "Embedding",
            description: "Embedding model",
            supportedGenerationMethods: ["embedContent"],
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = createLLMClient("google", { apiKey: "test-key" });
      const models = await client.listModels!();

      expect(models).toHaveLength(1);
      expect(models[0].id).toBe("gemini-2.0-flash");
    });

    it("should strip models/ prefix from id", async () => {
      const mockResponse = {
        models: [
          {
            name: "models/gemini-2.5-pro",
            displayName: "Gemini 2.5 Pro",
            description: "Pro model",
            supportedGenerationMethods: ["generateContent"],
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = createLLMClient("google", { apiKey: "test-key" });
      const models = await client.listModels!();

      expect(models[0].id).toBe("gemini-2.5-pro");
      expect(models[0].id).not.toContain("models/");
    });

    it("should include displayName as name", async () => {
      const mockResponse = {
        models: [
          {
            name: "models/gemini-2.0-flash",
            displayName: "Gemini 2.0 Flash",
            description: "Fast model",
            supportedGenerationMethods: ["generateContent"],
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = createLLMClient("google", { apiKey: "test-key" });
      const models = await client.listModels!();

      expect(models[0].name).toBe("Gemini 2.0 Flash");
    });

    it("should include supportedMethods", async () => {
      const mockResponse = {
        models: [
          {
            name: "models/gemini-2.0-flash",
            displayName: "Gemini 2.0 Flash",
            description: "Fast model",
            supportedGenerationMethods: ["generateContent", "countTokens"],
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = createLLMClient("google", { apiKey: "test-key" });
      const models = await client.listModels!();

      expect(models[0].supportedMethods).toContain("generateContent");
      expect(models[0].supportedMethods).toContain("countTokens");
    });

    it("should throw error with response body on failure", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('{"error": "Not found"}'),
      } as Response);

      const client = createLLMClient("google", { apiKey: "invalid-key" });

      await expect(client.listModels!()).rejects.toThrow(
        "Google API error: 404",
      );
    });

    it("should include API key in query string", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ models: [] }),
      } as Response);

      const client = createLLMClient("google", { apiKey: "my-api-key" });
      await client.listModels!();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("key=my-api-key"),
        expect.any(Object),
      );
    });
  });
});
