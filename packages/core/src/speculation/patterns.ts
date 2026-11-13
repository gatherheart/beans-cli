import { z } from "zod";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };
export const jsonValue: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(jsonValue),
    z.record(jsonValue),
  ]),
);
export const invocationSchema = z.object({
  name: z.string().min(1),
  arguments: z.record(jsonValue),
});
export type PasteInvocation = z.infer<typeof invocationSchema>;
export const eventSchema = invocationSchema.extend({
  status: z.enum(["success", "error"]),
  output: jsonValue,
});
export type PasteEvent = z.infer<typeof eventSchema>;
export const tracesSchema = z.array(z.array(eventSchema).max(256)).max(256);

export function canonical(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function invocationKey(call: PasteInvocation): string {
  return canonical({ name: call.name, arguments: call.arguments });
}

type Binding =
  | { source: "value"; value: JsonValue }
  | { source: "event"; index: number; path: string[] };
interface Pattern {
  context: string;
  target: string;
  bindings: Record<string, Binding>;
  probability: number;
  support: number;
}
interface Observation {
  context: PasteEvent[];
  next?: PasteInvocation;
}
export interface PastePrediction {
  call: PasteInvocation;
  probability: number;
  support: number;
}

const signature = (events: PasteEvent[]) =>
  JSON.stringify(events.map(({ name, status }) => [name, status]));

function lookup(value: JsonValue, path: string[]): JsonValue | undefined {
  let current: JsonValue | undefined = value;
  for (const key of path) {
    if (
      current === null ||
      typeof current !== "object" ||
      !Object.hasOwn(current, key)
    )
      return undefined;
    current = Array.isArray(current) ? current[Number(key)] : current[key];
  }
  return current;
}

function fields(
  value: JsonValue,
  path: string[] = [],
  depth = 0,
): Array<{ path: string[]; value: JsonValue }> {
  const result = [{ path, value }];
  if (depth < 5 && value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value).slice(0, 32)) {
      result.push(...fields(item, [...path, key], depth + 1));
      if (result.length > 256) break;
    }
  }
  return result.slice(0, 256);
}

function payload(event: PasteEvent): JsonValue {
  return { arguments: event.arguments, output: event.output };
}

function bind(
  pattern: Pattern,
  context: PasteEvent[],
): PasteInvocation | undefined {
  const entries: Array<[string, JsonValue]> = [];
  for (const [key, binding] of Object.entries(pattern.bindings)) {
    const event =
      binding.source === "event" ? context[binding.index] : undefined;
    const value =
      binding.source === "value"
        ? binding.value
        : event && lookup(payload(event), binding.path);
    if (value === undefined) return undefined;
    entries.push([key, value]);
  }
  return { name: pattern.target, arguments: Object.fromEntries(entries) };
}

/** Bounded suffix mining with symbolic field/index mappings and empirical validation. */
export class PastePatternAnalyzer {
  private observations: Observation[] = [];
  private patterns: Pattern[] = [];
  private dirty = false;

  constructor(
    private readonly minSupport = 2,
    private readonly maxContext = 2,
  ) {}

  observe(context: PasteEvent[], next?: PasteInvocation): void {
    if (!context.length) return;
    this.observations.push(
      structuredClone({ context: context.slice(-this.maxContext), next }),
    );
    this.observations = this.observations.slice(-256);
    this.dirty = true;
  }

  learn(traces: PasteEvent[][]): void {
    for (const trace of traces) {
      for (let i = 1; i <= trace.length; i++)
        this.observe(
          trace.slice(Math.max(0, i - this.maxContext), i),
          trace[i],
        );
    }
  }

  predict(events: PasteEvent[]): PastePrediction[] {
    if (this.dirty) this.mine();
    const predictions: PastePrediction[] = [];
    for (
      let length = 1;
      length <= Math.min(events.length, this.maxContext);
      length++
    ) {
      const context = events.slice(-length);
      for (const pattern of this.patterns) {
        if (pattern.context !== signature(context)) continue;
        const call = bind(pattern, context);
        if (call)
          predictions.push({
            call,
            probability: pattern.probability,
            support: pattern.support,
          });
      }
    }
    return predictions;
  }

  private mine(): void {
    const groups = new Map<string, Observation[]>();
    for (const observation of this.observations) {
      for (let length = 1; length <= observation.context.length; length++) {
        const context = observation.context.slice(-length);
        const key = signature(context);
        groups.set(key, [
          ...(groups.get(key) ?? []),
          { context, next: observation.next },
        ]);
      }
    }
    const patterns: Pattern[] = [];
    for (const [contextKey, rows] of groups) {
      const candidates = new Map<string, Pattern>();
      for (const { context, next } of rows) {
        if (!next) continue;
        const bindings: Record<string, Binding> = Object.create(null);
        for (const [key, value] of Object.entries(next.arguments)) {
          let binding: Binding = { source: "value", value };
          for (let index = context.length - 1; index >= 0; index--) {
            const match = fields(payload(context[index])).find(
              (field) => canonical(field.value) === canonical(value),
            );
            if (match) {
              binding = { source: "event", index, path: match.path };
              break;
            }
          }
          bindings[key] = binding;
        }
        const pattern = {
          context: contextKey,
          target: next.name,
          bindings,
          probability: 0,
          support: 0,
        };
        candidates.set(JSON.stringify([next.name, bindings]), pattern);
      }
      for (const pattern of candidates.values()) {
        pattern.support = rows.filter(({ context, next }) => {
          const predicted = bind(pattern, context);
          return (
            next &&
            predicted &&
            invocationKey(next) === invocationKey(predicted)
          );
        }).length;
        pattern.probability = pattern.support / rows.length;
        if (pattern.support >= this.minSupport) patterns.push(pattern);
      }
    }
    this.patterns = patterns;
    this.dirty = false;
  }
}
