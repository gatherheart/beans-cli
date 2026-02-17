import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { Checkpoint, EvalRunnerConfig } from './types.js';
import type { EvaluationResult } from '../benchmarks/types.js';

const EVAL_DIR = join(homedir(), '.beans', 'eval');

/**
 * Generate a unique run ID
 */
export function generateRunId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

/**
 * Get the checkpoint file path for a run
 */
function getCheckpointPath(runId: string): string {
  return join(EVAL_DIR, runId, 'checkpoint.json');
}

/**
 * Create a new checkpoint
 */
export async function createCheckpoint(
  runId: string,
  config: EvalRunnerConfig
): Promise<Checkpoint> {
  const checkpoint: Checkpoint = {
    runId,
    config,
    completedIds: [],
    results: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveCheckpoint(checkpoint);
  return checkpoint;
}

/**
 * Save checkpoint to disk
 */
export async function saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
  const dir = join(EVAL_DIR, checkpoint.runId);
  await mkdir(dir, { recursive: true });

  checkpoint.updatedAt = new Date().toISOString();
  const path = getCheckpointPath(checkpoint.runId);
  await writeFile(path, JSON.stringify(checkpoint, null, 2));
}

/**
 * Load checkpoint from disk
 */
export async function loadCheckpoint(runId: string): Promise<Checkpoint | null> {
  const path = getCheckpointPath(runId);

  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content) as Checkpoint;
  } catch {
    return null;
  }
}

/**
 * Update checkpoint with a new result
 */
export async function updateCheckpoint(
  checkpoint: Checkpoint,
  result: EvaluationResult
): Promise<void> {
  checkpoint.completedIds.push(result.problemId);
  checkpoint.results.push(result);
  await saveCheckpoint(checkpoint);
}

/**
 * Get completed problem IDs from checkpoint
 */
export function getCompletedIds(checkpoint: Checkpoint): Set<string> {
  return new Set(checkpoint.completedIds);
}
