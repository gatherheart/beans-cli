import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadMBPP } from "../../packages/eval/src/benchmarks/mbpp/loader.js";
import { MBPPBenchmark } from "../../packages/eval/src/benchmarks/mbpp/index.js";

describe("MBPP dataset schema", () => {
  it("reads sanitized prompt and test_imports as well as full-dataset text", async () => {
    const directory = await mkdtemp(join(tmpdir(), "beans-mbpp-"));
    try {
      const source = join(directory, "fixture.json");
      await writeFile(
        source,
        JSON.stringify([
          {
            task_id: 1,
            prompt: "Return the square root.",
            code: "",
            test_imports: ["import math"],
            test_list: ["assert root(4) == 2"],
          },
          {
            task_id: 2,
            text: "Return the input.",
            code: "",
            test_list: ["assert identity(1) == 1"],
          },
        ]),
      );
      const problems = await loadMBPP({ source });
      const benchmark = new MBPPBenchmark();
      expect(benchmark.buildPrompt(problems[0])).toContain(
        "Return the square root.",
      );
      expect(benchmark.buildPrompt(problems[0])).not.toContain("undefined");
      expect(problems[0].setupCode).toBe("import math");
      expect(problems[1].text).toBe("Return the input.");
      await writeFile(
        source,
        JSON.stringify([{ task_id: 3, code: "", test_list: [] }]),
      );
      await expect(loadMBPP({ source })).rejects.toThrow(
        "has no problem statement",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
