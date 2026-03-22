import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createLLMClient,
  inferProviderFromModel,
} from "../../../packages/core/src/llm/client.js";

describe("OpenAI Client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("inferProviderFromModel", () => {
    it("recognizes fine-tuned OpenAI model ids", () => {
      expect(
        inferProviderFromModel(
          "ft:gpt-4o-mini-2024-07-18:org:localized-ko:abc123",
        ),
      ).toBe("openai");
    });

    it("recognizes o-series OpenAI model ids", () => {
      expect(inferProviderFromModel("o4-mini")).toBe("openai");
    });
  });

  describe("listModels", () => {
    it("includes fine-tuned models and o-series models", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              { id: "gpt-4o-mini", owned_by: "openai" },
              { id: "o4-mini", owned_by: "openai" },
              {
                id: "ft:gpt-4o-mini-2024-07-18:org:localized-ko:abc123",
                owned_by: "org",
              },
              { id: "text-embedding-3-large", owned_by: "openai" },
            ],
          }),
      } as Response);

      const client = createLLMClient("openai", { apiKey: "test-key" });
      const models = await client.listModels!();

      expect(models.map((model) => model.id)).toEqual([
        "gpt-4o-mini",
        "o4-mini",
        "ft:gpt-4o-mini-2024-07-18:org:localized-ko:abc123",
      ]);
    });
  });

  describe("uploadFile", () => {
    it("uploads files with the fine-tune purpose", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "file-123",
            bytes: 128,
            created_at: 1710000000,
            filename: "training.jsonl",
            purpose: "fine-tune",
          }),
      } as Response);

      const client = createLLMClient("openai", { apiKey: "test-key" });
      const uploaded = await client.uploadFile!({
        path: new URL("../../fixtures/training.jsonl", import.meta.url)
          .pathname,
        purpose: "fine-tune",
      });

      expect(uploaded.id).toBe("file-123");
      expect(uploaded.filename).toBe("training.jsonl");
      expect(fetch).toHaveBeenCalledWith(
        "https://api.openai.com/v1/files",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });
  });

  describe("fine-tuning jobs", () => {
    it("creates a fine-tuning job with file ids and suffix", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "ftjob-123",
            model: "gpt-4o-mini",
            status: "queued",
            created_at: 1710000000,
            fine_tuned_model: null,
            training_file: "file-train",
            validation_file: "file-valid",
            result_files: [],
          }),
      } as Response);

      const client = createLLMClient("openai", { apiKey: "test-key" });
      const job = await client.createFineTuningJob!({
        model: "gpt-4o-mini",
        trainingFile: "file-train",
        validationFile: "file-valid",
        suffix: "localized-ko",
      });

      const [, requestInit] = vi.mocked(fetch).mock.calls[0];
      expect(JSON.parse(String(requestInit?.body))).toMatchObject({
        model: "gpt-4o-mini",
        training_file: "file-train",
        validation_file: "file-valid",
        suffix: "localized-ko",
      });
      expect(job.id).toBe("ftjob-123");
      expect(job.status).toBe("queued");
    });

    it("lists fine-tuning jobs", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: "ftjob-123",
                model: "gpt-4o-mini",
                status: "succeeded",
                created_at: 1710000000,
                finished_at: 1710000300,
                fine_tuned_model:
                  "ft:gpt-4o-mini-2024-07-18:org:localized-ko:abc123",
                training_file: "file-train",
                validation_file: "file-valid",
                trained_tokens: 1024,
                result_files: ["file-results"],
              },
            ],
          }),
      } as Response);

      const client = createLLMClient("openai", { apiKey: "test-key" });
      const jobs = await client.listFineTuningJobs!();

      expect(jobs).toHaveLength(1);
      expect(jobs[0].fineTunedModel).toContain("ft:gpt-4o-mini");
      expect(jobs[0].trainedTokens).toBe(1024);
    });

    it("lists fine-tuning events", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: "ftevent-123",
                created_at: 1710000100,
                level: "info",
                message: "Training started",
                type: "message",
              },
            ],
          }),
      } as Response);

      const client = createLLMClient("openai", { apiKey: "test-key" });
      const events = await client.listFineTuningEvents!("ftjob-123");

      expect(events).toEqual([
        {
          id: "ftevent-123",
          createdAt: 1710000100,
          level: "info",
          message: "Training started",
          type: "message",
        },
      ]);
    });
  });
});
