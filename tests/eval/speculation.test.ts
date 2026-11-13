import { describe, expect, it } from "vitest";
import {
  CodeSimilarityIndex,
  ReviewNeedPredictor,
  prepareNextReview,
} from "../../packages/eval/src/speculation/index.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("predicted review preparation", () => {
  it("starts preparation before the current tool finishes and adopts it only on failure", async () => {
    const tool = deferred<boolean>();
    const preparation = deferred<string>();
    const calls: string[] = [];
    const job = prepareNextReview({
      code: "def f(): return 1",
      mode: "predictive",
      predictor: new ReviewNeedPredictor(),
      runTool: () => {
        calls.push("tool");
        return tool.promise;
      },
      needsReview: (passed) => !passed,
      prepare: () => {
        calls.push("prepare");
        return preparation.promise;
      },
    });
    expect(calls).toEqual(["tool", "prepare"]);
    tool.resolve(false);
    preparation.resolve("related code");
    const result = await job;
    expect(result.context).toBe("related code");
    expect(result.metrics.adopted).toBe(true);
  });

  it("does not pass unused speculative context downstream", async () => {
    const result = await prepareNextReview({
      code: "def f(): return 1",
      mode: "eager",
      predictor: new ReviewNeedPredictor(),
      runTool: async () => true,
      needsReview: (passed) => !passed,
      prepare: async () => "must be discarded",
    });
    expect(result.context).toBeUndefined();
    expect(result.metrics.discarded).toBe(true);
    expect(result.metrics.adopted).toBe(false);
  });

  it("searches after the tool in the sequential control and on a prediction miss", async () => {
    for (const mode of ["sequential", "predictive"] as const) {
      const tool = deferred<boolean>();
      let searched = false;
      const job = prepareNextReview({
        code: "def f(): return 1",
        mode,
        threshold: 1,
        predictor: new ReviewNeedPredictor(),
        runTool: () => tool.promise,
        needsReview: (passed) => !passed,
        prepare: async () => {
          searched = true;
          return "same context";
        },
      });
      expect(searched).toBe(false);
      tool.resolve(false);
      expect((await job).context).toBe("same context");
    }
  });

  it("keeps preparation failures separate from tool outcomes", async () => {
    const result = await prepareNextReview({
      code: "x",
      mode: "eager",
      predictor: new ReviewNeedPredictor(),
      runTool: async () => false,
      needsReview: (passed) => !passed,
      prepare: async () => {
        throw new Error("index unavailable");
      },
    });
    expect(result.tool).toBe(false);
    expect(result.metrics.preparationFailed).toBe(true);
    expect(result.context).toBeUndefined();
  });

  it("learns only from completed observations and restores that history", () => {
    const predictor = new ReviewNeedPredictor();
    const before = predictor.predict("def f(): return 1");
    expect(predictor.predict("def g(): return 2")).toBe(before);
    predictor.observe("def f(): return 1", true);
    expect(predictor.predict("def g(): return 2")).toBeGreaterThan(before);
    const resumed = new ReviewNeedPredictor();
    resumed.restore(predictor.snapshot());
    expect(resumed.predict("def g(): return 2")).toBe(
      predictor.predict("def g(): return 2"),
    );
  });
});

describe("code similarity review index", () => {
  it("recognizes renamed code, never executes it, and rejects evaluation overlap", async () => {
    const index = await CodeSimilarityIndex.create([
      {
        id: "branch",
        code: "def f(x):\n    if x > 0:\n        return x\n    return 0",
        analysis: "Check the boundary",
        sourceProblemId: "old-task",
      },
      {
        id: "loop",
        code: "raise RuntimeError('must not execute')\ndef f(xs):\n    for x in xs:\n        print(x)",
        analysis: "Check iteration",
      },
    ]);
    const matches = await index.search(
      "def renamed(y):\n    if y > 0:\n        return y\n    return 0",
      2,
      0,
    );
    expect(matches[0].id).toBe("branch");
    expect(matches[0].similarity).toBeCloseTo(1);
    expect(matches[0].similarity).toBeGreaterThan(matches[1].similarity);
    expect(() => index.assertDisjoint(["old-task"])).toThrow("overlaps");
    expect(() => index.assertDisjoint(["new-task"])).not.toThrow();
  });
});
