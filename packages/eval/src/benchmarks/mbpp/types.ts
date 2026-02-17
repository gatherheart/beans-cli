import type { BenchmarkProblem } from '../types.js';

/**
 * Raw MBPP problem from the dataset
 */
export interface MBPPRawProblem {
  task_id: number;
  text: string;
  code: string;
  test_list: string[];
  test_setup_code?: string;
  challenge_test_list?: string[];
}

/**
 * Normalized MBPP problem
 */
export interface MBPPProblem extends BenchmarkProblem {
  id: string;
  taskId: number;
  text: string;
  referenceCode: string;
  tests: string[];
  setupCode?: string;
  challengeTests?: string[];
}

/**
 * MBPP dataset URLs
 */
export const MBPP_URLS = {
  full: 'https://raw.githubusercontent.com/google-research/google-research/master/mbpp/mbpp.jsonl',
  sanitized:
    'https://raw.githubusercontent.com/google-research/google-research/master/mbpp/sanitized-mbpp.json',
} as const;

/**
 * MBPP dataset subsets
 */
export type MBPPSubset = 'full' | 'sanitized';
