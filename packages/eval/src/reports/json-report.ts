import { writeFile } from 'fs/promises';
import type { BenchmarkReport } from '../benchmarks/types.js';

/**
 * Generate JSON report string
 */
export function generateJsonReport(report: BenchmarkReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Write JSON report to file
 */
export async function writeJsonReport(
  report: BenchmarkReport,
  path: string
): Promise<void> {
  const content = generateJsonReport(report);
  await writeFile(path, content);
}
