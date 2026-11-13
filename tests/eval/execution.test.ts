import { describe, expect, it } from "vitest";
import { extractCode } from "../../packages/eval/src/extraction/code-extractor.js";
import { executeWithTests } from "../../packages/eval/src/execution/python-runner.js";

describe("benchmark execution integrity", () => {
  it("preserves imports and globals before a raw Python function", async () => {
    const response =
      "import math\nSCALE = 2\ndef area(r):\n    return math.pi * r * r * SCALE";
    const extracted = extractCode(response);
    expect(extracted.code).toBe(response);
    const result = await executeWithTests(extracted.code, [
      "assert area(1) == math.pi * 2",
    ]);
    expect(result.success).toBe(true);
  });

  it("executes original assertion semantics and preserves exception details", async () => {
    const result = await executeWithTests("def value():\n    return 2", [
      "assert 1 < value() == 2",
      "raise ValueError('contains :PASS and | separators')",
      "assert value() == 3",
    ]);
    expect(result.passed).toBe(1);
    expect(result.results[1].passed).toBe(false);
    expect(result.results[1].error).toContain("ValueError");
    expect(result.results[2].error).toContain("AssertionError");
  });

  it("runs the supplied setup before the candidate", async () => {
    const result = await executeWithTests(
      "def value():\n    return CONSTANT",
      ["assert value() == 7"],
      "CONSTANT = 7",
    );
    expect(result.success).toBe(true);
  });

  it("reports timeout as a failure", async () => {
    const result = await executeWithTests(
      "while True:\n    pass",
      ["assert True"],
      undefined,
      { timeout: 100 },
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("Execution timed out");
  });
});
