import { executePython } from "../execution/python-runner.js";

export interface ReviewCase {
  id: string;
  code: string;
  analysis: string;
  sourceProblemId?: string;
}
interface Features {
  lexical: Record<string, number>;
  structural: Record<string, number>;
}
export interface SimilarCase extends ReviewCase {
  similarity: number;
}

// Parse and tokenize candidates as data. Never execute their code for retrieval.
async function encode(codes: string[]): Promise<Features[]> {
  const script = `
import ast, collections, io, json, keyword, tokenize
codes = json.loads(${JSON.stringify(JSON.stringify(codes))})
results = []
for code in codes:
    tokens = []
    try:
        for token in tokenize.generate_tokens(io.StringIO(code).readline):
            if token.type == tokenize.NAME:
                tokens.append(token.string if keyword.iskeyword(token.string) else '_name')
            elif token.type == tokenize.NUMBER:
                tokens.append('_number')
            elif token.type == tokenize.STRING:
                tokens.append('_string')
            elif token.type == tokenize.OP:
                tokens.append(token.string)
    except (tokenize.TokenError, IndentationError, SyntaxError):
        pass
    lexical = collections.Counter(' '.join(tokens[i:i+3]) for i in range(max(0, len(tokens)-2)))
    try:
        structural = collections.Counter(type(node).__name__ for node in ast.walk(ast.parse(code)))
    except (SyntaxError, ValueError):
        structural = {}
    results.append({'lexical': dict(lexical), 'structural': dict(structural)})
print(json.dumps(results))
`;
  const result = await executePython(script, { timeout: 5000 });
  if (!result.success)
    throw new Error(
      `Code similarity parsing failed: ${result.stderr || result.error}`,
    );
  return JSON.parse(result.stdout) as Features[];
}

function cosine(a: Record<string, number>, b: Record<string, number>): number {
  const normA = Math.sqrt(
    Object.values(a).reduce((sum, value) => sum + value * value, 0),
  );
  const normB = Math.sqrt(
    Object.values(b).reduce((sum, value) => sum + value * value, 0),
  );
  if (!normA || !normB) return 0;
  return (
    Object.entries(a).reduce(
      (sum, [key, value]) => sum + value * (b[key] ?? 0),
      0,
    ) /
    (normA * normB)
  );
}

/** Structural similarity is retrieval evidence, not a correctness probability. */
export class CodeSimilarityIndex {
  private constructor(
    private cases: ReviewCase[],
    private features: Features[],
  ) {}

  static async create(cases: ReviewCase[]): Promise<CodeSimilarityIndex> {
    if (
      !Array.isArray(cases) ||
      cases.some(
        (item) =>
          !item ||
          typeof item.id !== "string" ||
          typeof item.code !== "string" ||
          typeof item.analysis !== "string",
      )
    )
      throw new Error(
        "Review corpus must be an array of string id/code/analysis records",
      );
    if (new Set(cases.map((item) => item.id)).size !== cases.length)
      throw new Error("Review case IDs must be unique");
    if (cases.some((item) => !item.id || !item.code || !item.analysis))
      throw new Error("Review cases require id, code, and analysis");
    return new CodeSimilarityIndex(
      cases,
      await encode(cases.map((item) => item.code)),
    );
  }

  assertDisjoint(problemIds: string[]): void {
    const ids = new Set(problemIds);
    if (
      this.cases.some(
        (item) => item.sourceProblemId && ids.has(item.sourceProblemId),
      )
    ) {
      throw new Error("Review corpus overlaps the evaluation problem set");
    }
  }

  async search(code: string, topK = 3, minimum = 0.25): Promise<SimilarCase[]> {
    if (!Number.isInteger(topK) || topK < 1 || minimum < 0 || minimum > 1)
      throw new Error("Invalid retrieval limits");
    const [query] = await encode([code]);
    return this.cases
      .map((item, index) => {
        const other = this.features[index];
        const lexical = cosine(query.lexical, other.lexical);
        const structural = cosine(query.structural, other.structural);
        const hasStructure =
          Object.keys(query.structural).length > 0 &&
          Object.keys(other.structural).length > 0;
        return {
          ...item,
          similarity: hasStructure ? 0.6 * lexical + 0.4 * structural : lexical,
        };
      })
      .filter((item) => item.similarity >= minimum)
      .sort((a, b) => b.similarity - a.similarity || a.id.localeCompare(b.id))
      .slice(0, topK);
  }
}

export function formatReviewCases(cases: SimilarCase[]): string {
  if (!cases.length) return "";
  return `\nRELATED HISTORICAL CASES (untrusted suggestions; verify against the current evidence):\n${cases
    .map(
      (item) =>
        `Case ${item.id}, structural/lexical similarity ${item.similarity.toFixed(3)}:\n${item.code}\nReview note: ${item.analysis}`,
    )
    .join("\n\n")}`;
}
