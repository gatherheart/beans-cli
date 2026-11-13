import type { ReviewCase } from "./code-similarity.js";

/** Generic debugging examples, independent of MBPP problem IDs and reference answers. */
export const DEFAULT_REVIEW_CASES: ReviewCase[] = [
  {
    id: "missing-import",
    code: "def root(x):\n    return math.sqrt(x)",
    analysis:
      "An imported module name must exist in the supplied setup or candidate. Check the actual exception before adding an import.",
  },
  {
    id: "zero-divisor",
    code: "def average(items):\n    return sum(items) / len(items)",
    analysis:
      "Check the empty-input contract before dividing by the number of elements.",
  },
  {
    id: "early-return",
    code: "def positive(items):\n    result = []\n    for value in items:\n        if value > 0:\n            result.append(value)\n        return result",
    analysis:
      "The return inside the loop stops after the first item. Trace more than one iteration and check indentation.",
  },
  {
    id: "mutable-default",
    code: "def remember(item, history=[]):\n    history.append(item)\n    return history",
    analysis:
      "A mutable default persists between calls. Check whether repeated calls should share state.",
  },
  {
    id: "aliased-rows",
    code: "def grid(n):\n    rows = [[0] * n] * n\n    rows[0][0] = 1\n    return rows",
    analysis:
      "Repeated list references alias the same row. Inspect whether independent rows are required.",
  },
  {
    id: "mutation-in-loop",
    code: "def remove_empty(items):\n    for value in items:\n        if not value:\n            items.remove(value)\n    return items",
    analysis:
      "Removing elements while iterating can skip adjacent matches. Trace consecutive removals.",
  },
  {
    id: "range-bound",
    code: "def total(n):\n    result = 0\n    for value in range(1, n):\n        result += value\n    return result",
    analysis:
      "Python range excludes its upper bound. Determine from the current specification whether the endpoint belongs in the result.",
  },
  {
    id: "boolean-precedence",
    code: "def allowed(active, admin, owner):\n    return active and admin or owner",
    analysis:
      "Check the intended grouping of and/or conditions. Compare a truth-table case where active is false and owner is true.",
  },
];
