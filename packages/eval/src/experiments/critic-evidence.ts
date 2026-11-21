import { z } from "zod";
import type { Message } from "@beans/core";

export const ARMS = [
  "retained_general",
  "isolated_general",
  "retained_counterexample",
  "isolated_counterexample",
] as const;
export type Arm = (typeof ARMS)[number];
export type Family =
  | "weighted_intervals"
  | "bounded_route"
  | "bottleneck_route";
export interface Candidate {
  id: string;
  family: Family;
  origin: "authored_control" | "live_main";
  expectedVerdict?: "correct" | "incorrect";
  code: string;
  mainMessages: Message[];
}

export const SYSTEM =
  "You are a Python programming assistant. Follow the current request. No tools or external resources are available.";

export function mainPrompt(problem: string): string {
  return `${problem}\n\nReturn a JSON object with two fields: "approach", a brief explanation of the algorithm (at most three sentences), and "code", the complete Python implementation. Use the standard library only. Do not include tests. No markdown.`;
}

const schema = `Return JSON only:
{
  "verdict": "correct" | "incorrect" | "uncertain",
  "relevant_requirement": "requirement supporting the assessment",
  "code_lines": [one-based source line numbers],
  "explanation": "concise explanation grounded in the code",
  "evidence": null OR {
    "kind": "counterexample",
    "input": {function parameter names: JSON values},
    "expected": integer,
    "predicted_actual": integer or null if an exception is predicted
  } OR {
    "kind": "metamorphic",
    "relation": "edge_addition" | "budget_relaxation" | "input_permutation",
    "input": {function parameter names: JSON values},
    "followup_input": {function parameter names: JSON values}
  }
}
If you supply evidence, construct it yourself. No example, expected answer, or test result is provided. A metamorphic test must satisfy its transformation's preconditions and demonstrate an output-relation violation. If no evidence is available, use null. Do not write replacement code. Do not assume that every implementation contains a defect.`;

export function reviewPrompt(
  problem: string,
  code: string,
  directed: boolean,
): string {
  const guidance = directed
    ? `Assess correctness by seeking a falsifiable violation. Identify a necessary condition implied by the problem and inspect a code decision that could violate it. Challenge state merging, pruning, local choices, and the optimized objective where relevant. Try to construct a small valid counterexample or a valid input transformation whose outputs must obey a relation. Check the proposed evidence against the actual code before reporting it. A different implementation or an unfamiliar pattern is not evidence of a bug. Accept correct code and use uncertain if you cannot justify a conclusion.`
    : `Review whether the implementation satisfies the problem specification. Assess the code and explain your verdict.`;
  return `${guidance}\n\n${schema}\n\nProblem:\n${problem}\n\nCode:\n\`\`\`python\n${code}\n\`\`\``;
}

export function reviewMessages(
  candidate: Candidate,
  problem: string,
  arm: Arm,
): Message[] {
  return [
    ...(arm.startsWith("retained_") ? candidate.mainMessages : []),
    {
      role: "user",
      content: reviewPrompt(
        problem,
        candidate.code,
        arm.endsWith("_counterexample"),
      ),
    },
  ];
}

const evidenceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("counterexample"),
    input: z.record(z.unknown()),
    expected: z.number().int(),
    predicted_actual: z.number().int().nullable(),
  }),
  z.object({
    kind: z.literal("metamorphic"),
    relation: z.enum([
      "edge_addition",
      "budget_relaxation",
      "input_permutation",
    ]),
    input: z.record(z.unknown()),
    followup_input: z.record(z.unknown()),
  }),
]);
export const reviewSchema = z.object({
  verdict: z.enum(["correct", "incorrect", "uncertain"]),
  relevant_requirement: z.string(),
  code_lines: z.array(z.number().int().positive()),
  explanation: z.string(),
  evidence: evidenceSchema.nullable(),
});
export type Review = z.infer<typeof reviewSchema>;

export function parseJSON(text: string): unknown {
  return JSON.parse(
    text
      .trim()
      .replace(/^```(?:json)?\s*/, "")
      .replace(/\s*```$/, ""),
  );
}

export function treatmentOrder(candidateIndex: number, round: number): Arm[] {
  const offset = (candidateIndex + round - 1) % ARMS.length;
  return [...ARMS.slice(offset), ...ARMS.slice(0, offset)];
}
