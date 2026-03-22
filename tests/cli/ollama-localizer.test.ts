import { describe, it, expect } from "vitest";
import { buildOllamaLocalizerModelfile } from "../../packages/cli/src/ollamaLocalizer.js";

describe("Ollama Localizer", () => {
  it("builds a Modelfile for the requested base model", () => {
    const modelfile = buildOllamaLocalizerModelfile({
      baseModel: "qwen2.5:3b",
      language: "English",
    });

    expect(modelfile).toContain("FROM qwen2.5:3b");
    expect(modelfile).toContain(
      'SYSTEM """You are a localization assistant specialized in English.',
    );
    expect(modelfile).toContain("PARAMETER temperature 0.2");
  });

  it("appends extra project rules and custom parameters when provided", () => {
    const modelfile = buildOllamaLocalizerModelfile({
      baseModel: "qwen2.5:3b",
      language: "English",
      extraRules: "Prefer 존댓말. Keep button labels under 12 characters.",
      parameters: [
        { name: "temperature", value: "0.1" },
        { name: "num_ctx", value: "8192" },
      ],
    });

    expect(modelfile).toContain("Additional project rules:");
    expect(modelfile).toContain(
      "Prefer 존댓말. Keep button labels under 12 characters.",
    );
    expect(modelfile).toContain("PARAMETER temperature 0.1");
    expect(modelfile).toContain("PARAMETER num_ctx 8192");
  });
});
