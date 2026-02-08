#!/usr/bin/env node
/**
 * E2E Test Runner
 *
 * Runs vitest for e2e tests with JSON reporter and generates a test report.
 * Always exits with code 0, reporting success/failure in the output.
 */

import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const reportDir = path.join(rootDir, '.e2e-reports');
const reportPath = path.join(reportDir, 'test-report.json');

// Ensure report directory exists
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

// Run vitest with JSON reporter
const vitest = spawn(
  'npx',
  ['vitest', 'run', '--config', 'vitest.e2e.config.ts', '--reporter=verbose', '--reporter=json', '--outputFile', reportPath],
  {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
  }
);

vitest.on('close', (code) => {
  const testsPassed = code === 0;

  // Kill any remaining vitest-related processes (cross-platform)
  try {
    if (process.platform === 'win32') {
      execSync('taskkill /F /IM node.exe /FI "WINDOWTITLE eq vitest*" 2>nul', { stdio: 'ignore' });
    } else {
      execSync('pkill -f "vitest" 2>/dev/null || true', { stdio: 'ignore' });
    }
  } catch {
    // Ignore - processes may already be dead
  }

  // Generate summary report
  let report = {
    timestamp: new Date().toISOString(),
    success: testsPassed,
    exitCode: code,
    summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
    tests: [],
  };

  // Try to read and parse the JSON report
  try {
    if (fs.existsSync(reportPath)) {
      const jsonReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

      // Extract test results from vitest JSON format
      if (jsonReport.testResults) {
        for (const file of jsonReport.testResults) {
          for (const test of file.assertionResults || []) {
            report.tests.push({
              name: test.fullName || test.title,
              status: test.status,
              duration: test.duration,
            });

            report.summary.total++;
            if (test.status === 'passed') report.summary.passed++;
            else if (test.status === 'failed') report.summary.failed++;
            else if (test.status === 'skipped') report.summary.skipped++;
          }
        }
      }
    }
  } catch (err) {
    console.error('Warning: Could not parse test report:', err.message);
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('E2E TEST REPORT');
  console.log('='.repeat(60));
  console.log(`Status: ${report.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Total: ${report.summary.total} | Passed: ${report.summary.passed} | Failed: ${report.summary.failed} | Skipped: ${report.summary.skipped}`);
  console.log('='.repeat(60));

  if (!report.success && report.tests.length > 0) {
    console.log('\nFailed tests:');
    for (const test of report.tests) {
      if (test.status === 'failed') {
        console.log(`  ❌ ${test.name}`);
      }
    }
  }

  // Save the summary report
  const summaryPath = path.join(reportDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to: ${summaryPath}`);

  // Always exit 0 - report indicates success/failure
  process.exit(0);
});

// Handle interrupts
process.on('SIGINT', () => {
  vitest.kill('SIGTERM');
  process.exit(130);
});

process.on('SIGTERM', () => {
  vitest.kill('SIGTERM');
  process.exit(143);
});
