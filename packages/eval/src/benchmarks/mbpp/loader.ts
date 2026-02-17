import { readFile } from 'fs/promises';
import type { LoadOptions } from '../types.js';
import type { MBPPRawProblem, MBPPProblem, MBPPSubset } from './types.js';
import { MBPP_URLS } from './types.js';

/**
 * Load MBPP dataset from URL or local file
 */
export async function loadMBPP(
  options: LoadOptions & { source?: string; subset?: MBPPSubset } = {}
): Promise<MBPPProblem[]> {
  const {
    source,
    subset = 'sanitized',
    limit,
    offset = 0,
    problemIds,
    sanitized = true,
  } = options;

  let rawProblems: MBPPRawProblem[];

  if (source) {
    // Load from local file
    rawProblems = await loadFromFile(source);
  } else {
    // Load from URL
    const effectiveSubset = sanitized ? 'sanitized' : subset;
    rawProblems = await loadFromUrl(MBPP_URLS[effectiveSubset], effectiveSubset);
  }

  // Normalize to MBPPProblem format
  let problems = rawProblems.map(normalizeProblem);

  // Filter by problem IDs if specified
  if (problemIds && problemIds.length > 0) {
    const idSet = new Set(problemIds);
    problems = problems.filter((p) => idSet.has(p.id));
  }

  // Apply offset and limit
  if (offset > 0) {
    problems = problems.slice(offset);
  }
  if (limit !== undefined && limit > 0) {
    problems = problems.slice(0, limit);
  }

  return problems;
}

/**
 * Load from local JSON or JSONL file
 */
async function loadFromFile(path: string): Promise<MBPPRawProblem[]> {
  const content = await readFile(path, 'utf-8');

  if (path.endsWith('.jsonl')) {
    // JSONL format: one JSON object per line
    return content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as MBPPRawProblem);
  }

  // Regular JSON
  const data = JSON.parse(content);
  return Array.isArray(data) ? data : [data];
}

/**
 * Load from URL
 */
async function loadFromUrl(
  url: string,
  subset: MBPPSubset
): Promise<MBPPRawProblem[]> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch MBPP dataset: ${response.statusText}`);
  }

  const content = await response.text();

  if (subset === 'full') {
    // JSONL format
    return content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as MBPPRawProblem);
  }

  // Sanitized is regular JSON
  return JSON.parse(content);
}

/**
 * Normalize raw problem to standard format
 */
function normalizeProblem(raw: MBPPRawProblem): MBPPProblem {
  return {
    id: String(raw.task_id),
    taskId: raw.task_id,
    text: raw.text,
    referenceCode: raw.code,
    tests: raw.test_list,
    setupCode: raw.test_setup_code,
    challengeTests: raw.challenge_test_list,
  };
}
