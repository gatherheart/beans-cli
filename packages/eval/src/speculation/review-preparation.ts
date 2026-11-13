export type PreparationMode = "sequential" | "eager" | "predictive";

/** Online Beta-Bernoulli baseline. Only completed past tool outcomes update it. */
export class ReviewNeedPredictor {
  private observations = new Map<string, { failures: number; total: number }>();
  private bucket(code: string): string {
    return /\b(for|while)\b/.test(code)
      ? "loop"
      : /\b(if|try)\b/.test(code)
        ? "branch"
        : "plain";
  }
  predict(code: string): number {
    const past = this.observations.get(this.bucket(code));
    return ((past?.failures ?? 0) + 1) / ((past?.total ?? 0) + 4);
  }
  observe(code: string, needsReview: boolean): void {
    const key = this.bucket(code);
    const past = this.observations.get(key) ?? { failures: 0, total: 0 };
    this.observations.set(key, {
      failures: past.failures + Number(needsReview),
      total: past.total + 1,
    });
  }
  snapshot(): Record<string, { failures: number; total: number }> {
    return Object.fromEntries(
      [...this.observations].map(([key, value]) => [key, { ...value }]),
    );
  }
  restore(state: Record<string, { failures: number; total: number }>): void {
    for (const [key, value] of Object.entries(state)) {
      if (
        !["plain", "branch", "loop"].includes(key) ||
        !Number.isInteger(value.total) ||
        !Number.isInteger(value.failures) ||
        value.failures < 0 ||
        value.total < value.failures
      ) {
        throw new Error("Invalid predictor checkpoint");
      }
    }
    this.observations = new Map(
      Object.entries(state).map(([key, value]) => [key, { ...value }]),
    );
  }
}

export interface PreparationMetrics {
  probability: number;
  predicted: boolean;
  needed: boolean;
  speculative: boolean;
  adopted: boolean;
  discarded: boolean;
  preparationFailed: boolean;
  predictionMs: number;
  toolMs: number;
  preparationMs: number;
  waitAfterToolMs: number;
  foregroundMs: number;
  elapsedMs: number;
  wastedPreparationMs: number;
}

/** At most one read-only preparation. Unused work is drained and charged. */
export async function prepareNextReview<T, P>(options: {
  code: string;
  mode: PreparationMode;
  predictor: ReviewNeedPredictor;
  threshold?: number;
  runTool: () => Promise<T>;
  needsReview: (result: T) => boolean;
  prepare: () => Promise<P>;
}): Promise<{ tool: T; context?: P; metrics: PreparationMetrics }> {
  const started = performance.now();
  const threshold = options.threshold ?? 0.2;
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1)
    throw new Error("Prediction threshold must be between zero and one");
  const probability = options.predictor.predict(options.code);
  const predicted = probability >= threshold;
  const speculative =
    options.mode === "eager" || (options.mode === "predictive" && predicted);
  const predictionMs = performance.now() - started;
  let preparationMs = 0;
  let preparationFailed = false;
  const prepare = async () => {
    const start = performance.now();
    try {
      return await options.prepare();
    } catch {
      preparationFailed = true;
      return undefined;
    } finally {
      preparationMs += performance.now() - start;
    }
  };
  const toolStart = performance.now();
  const toolPromise = options.runTool();
  const pending = speculative ? prepare() : undefined;
  let tool: T;
  try {
    tool = await toolPromise;
  } catch (error) {
    await pending;
    throw error;
  }
  const toolDone = performance.now();
  const needed = options.needsReview(tool);
  options.predictor.observe(options.code, needed);
  const context = needed ? await (pending ?? prepare()) : undefined;
  const foregroundDone = performance.now();
  if (!needed) await pending;
  return {
    tool,
    context,
    metrics: {
      probability,
      predicted,
      needed,
      speculative,
      adopted: speculative && needed && !preparationFailed,
      discarded: speculative && !needed,
      preparationFailed,
      predictionMs,
      toolMs: toolDone - toolStart,
      preparationMs,
      waitAfterToolMs: needed ? foregroundDone - toolDone : 0,
      foregroundMs: foregroundDone - started,
      elapsedMs: performance.now() - started,
      wastedPreparationMs: speculative && !needed ? preparationMs : 0,
    },
  };
}
