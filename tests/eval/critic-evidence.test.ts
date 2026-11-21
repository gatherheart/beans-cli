import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { executePython } from "../../packages/eval/src/execution/python-runner.js";
import {
  ARMS,
  reviewMessages,
  reviewSchema,
  parseJSON,
  treatmentOrder,
  type Candidate,
} from "../../packages/eval/src/experiments/critic-evidence.js";

const sample: Candidate = {
  id: "test",
  family: "bounded_route",
  origin: "live_main",
  code: "def solve(): pass",
  mainMessages: [
    { role: "user", content: "ORIGINAL_REQUEST" },
    { role: "assistant", content: "MAIN_EXPLANATION" },
  ],
};

describe("critic evidence experiment", () => {
  it("isolates visible Main context while retaining identical candidate inputs", () => {
    for (const guidance of ["general", "counterexample"] as const) {
      const isolated = reviewMessages(sample, "SPEC", `isolated_${guidance}`);
      const retained = reviewMessages(sample, "SPEC", `retained_${guidance}`);
      expect(isolated).toHaveLength(1);
      expect(retained).toHaveLength(3);
      expect(isolated[0]).toEqual(retained[2]);
      expect(JSON.stringify(isolated)).not.toContain("MAIN_EXPLANATION");
      expect(JSON.stringify(retained)).toContain("MAIN_EXPLANATION");
      expect(JSON.stringify(isolated)).not.toContain("expectedVerdict");
    }
  });
  it("rotates all four treatments without omitting or duplicating them", () => {
    for (let i = 0; i < 9; i++)
      for (let r = 1; r <= 3; r++) {
        expect([...treatmentOrder(i, r)].sort()).toEqual([...ARMS].sort());
      }
  });
  it("does not convert malformed responses into negative judgments", () => {
    expect(() => parseJSON("This is correct.")).toThrow();
    expect(reviewSchema.safeParse({ verdict: "correct" }).success).toBe(false);
  });
  it("validates independent witnesses and rejects false claims and invalid transformations", async () => {
    const validator = await readFile(
      "scripts/critic-evidence-validator.py",
      "utf8",
    );
    const { controls } = JSON.parse(
      await readFile("tests/fixtures/critic-evidence/cases.json", "utf8"),
    );
    const code = controls.find((c: Candidate) => c.id === "C2").code;
    const correct = controls.find((c: Candidate) => c.id === "C4").code;
    const input = {
      n: 4,
      edges: [
        [0, 1, 1],
        [0, 2, 3],
        [2, 3, 1],
      ],
      source: 0,
      target: 3,
      max_edges: 2,
    };
    const followup = { ...input, edges: [...input.edges, [1, 2, 1]] };
    const evidence = {
      kind: "counterexample",
      input: followup,
      expected: 4,
      predicted_actual: -1,
    };
    const payloads = [
      { mode: "evidence", family: "bounded_route", code, evidence },
      { mode: "evidence", family: "bounded_route", code: correct, evidence },
      {
        mode: "evidence",
        family: "bounded_route",
        code,
        evidence: { ...evidence, expected: 9 },
      },
      {
        mode: "evidence",
        family: "bounded_route",
        code,
        evidence: { ...evidence, input: { ...followup, max_edges: -1 } },
      },
      {
        mode: "evidence",
        family: "bounded_route",
        code,
        evidence: {
          kind: "metamorphic",
          relation: "edge_addition",
          input,
          followup_input: followup,
        },
      },
      {
        mode: "evidence",
        family: "bounded_route",
        code,
        evidence: {
          kind: "metamorphic",
          relation: "edge_addition",
          input,
          followup_input: { ...followup, max_edges: 0 },
        },
      },
    ];
    const script = `${validator}\nprint(json.dumps([evaluate(p) for p in json.loads(${JSON.stringify(JSON.stringify(payloads))})]))`;
    const result = await executePython(script, {
      isolated: true,
      timeout: 10000,
    });
    expect(result.success, result.stderr).toBe(true);
    const rows = JSON.parse(result.stdout);
    expect(rows[0].fully_validated).toBe(true);
    expect(rows[1].confirmed).toBe(false);
    expect(rows[2].confirmed).toBe(true);
    expect(rows[2].fully_validated).toBe(false);
    expect(rows[3].status).toBe("invalid_input");
    expect(rows[4].confirmed).toBe(true);
    expect(rows[4].oracle_free).toBe(true);
    expect(rows[5].status).toBe("invalid_transformation");
  });
});
