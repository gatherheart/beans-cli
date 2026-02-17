import { writeFile } from 'fs/promises';
import type { BenchmarkReport, EvaluationResult } from '../benchmarks/types.js';

/**
 * Generate Markdown report string
 */
export function generateMarkdownReport(report: BenchmarkReport): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${formatBenchmarkName(report.benchmarkName)} Evaluation Report`);
  lines.push('');
  lines.push(`**Model:** ${report.model}`);
  lines.push(`**Date:** ${formatDate(report.timestamp)}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Problems | ${report.summary.total} |`);
  lines.push(`| Passed | ${report.summary.passed} |`);
  lines.push(`| Pass Rate | ${formatPercent(report.summary.passRate)} |`);
  lines.push(`| Total Tokens | ${formatNumber(report.summary.totalTokens)} |`);
  lines.push(`| Total Time | ${formatDuration(report.summary.totalTimeMs)} |`);
  lines.push(
    `| Avg Time/Problem | ${formatDuration(report.summary.avgTimePerProblem)} |`
  );
  lines.push('');

  // Results summary by status
  const passed = report.results.filter((r) => r.success);
  const failed = report.results.filter((r) => !r.success);

  if (failed.length > 0 && failed.length <= 50) {
    lines.push('## Failed Problems');
    lines.push('');
    for (const result of failed) {
      lines.push(formatResultLine(result));
    }
    lines.push('');
  }

  // Detailed results (collapsed for large reports)
  if (report.results.length <= 100) {
    lines.push('## Detailed Results');
    lines.push('');
    for (const result of report.results) {
      lines.push(formatResultLine(result));
    }
  } else {
    lines.push('## Results');
    lines.push('');
    lines.push(
      `*${report.results.length} problems evaluated. See JSON report for full details.*`
    );
    lines.push('');
    lines.push(`- Passed: ${passed.length}`);
    lines.push(`- Failed: ${failed.length}`);
  }

  return lines.join('\n');
}

/**
 * Write Markdown report to file
 */
export async function writeMarkdownReport(
  report: BenchmarkReport,
  path: string
): Promise<void> {
  const content = generateMarkdownReport(report);
  await writeFile(path, content);
}

function formatBenchmarkName(name: string): string {
  return name.toUpperCase();
}

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function formatResultLine(result: EvaluationResult): string {
  const status = result.success ? '\u2705' : '\u274C';
  const tests = `${result.passed}/${result.total}`;
  const error = result.error ? ` - ${truncate(result.error, 50)}` : '';
  return `- ${status} Problem ${result.problemId}: ${tests} tests${error}`;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}
