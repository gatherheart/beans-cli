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
const jsonReportPath = path.join(reportDir, 'test-report.json');

// Ensure report directory exists
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

// Capture output for raw log
let rawOutput = '';

// Run vitest with JSON reporter
const vitest = spawn(
  'npx',
  ['vitest', 'run', '--config', 'vitest.e2e.config.ts', '--reporter=verbose', '--reporter=json', '--outputFile', jsonReportPath],
  {
    cwd: rootDir,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
  }
);

vitest.stdout.on('data', (data) => {
  const str = data.toString();
  rawOutput += str;
  process.stdout.write(str);
});

vitest.stderr.on('data', (data) => {
  const str = data.toString();
  rawOutput += str;
  process.stderr.write(str);
});

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
    testSuites: [],
    failedTests: [],
    duration: null,
  };

  // Try to read and parse the JSON report
  try {
    if (fs.existsSync(jsonReportPath)) {
      const jsonReport = JSON.parse(fs.readFileSync(jsonReportPath, 'utf8'));

      // Use vitest's top-level summary fields
      report.summary.total = jsonReport.numTotalTests || 0;
      report.summary.passed = jsonReport.numPassedTests || 0;
      report.summary.failed = jsonReport.numFailedTests || 0;
      report.summary.skipped = jsonReport.numPendingTests || 0;

      // Calculate duration from testResults
      if (jsonReport.testResults && jsonReport.testResults.length > 0) {
        const startTime = jsonReport.startTime;
        let endTime = startTime;
        for (const suite of jsonReport.testResults) {
          if (suite.endTime > endTime) endTime = suite.endTime;

          // Collect test suite info with individual test results
          report.testSuites.push({
            name: path.basename(suite.name),
            status: suite.status,
            testCount: suite.assertionResults?.length || 0,
            tests: (suite.assertionResults || []).map(test => ({
              name: test.fullName || test.title,
              status: test.status,
              duration: test.duration || 0,
            })),
          });

          // Collect failed tests
          for (const test of suite.assertionResults || []) {
            if (test.status === 'failed') {
              report.failedTests.push({
                name: test.fullName || test.title,
                suite: path.basename(suite.name),
                message: test.failureMessages?.join('\n') || '',
              });
            }
          }
        }
        report.duration = ((endTime - startTime) / 1000).toFixed(2) + 's';
      }
    }
  } catch (err) {
    console.error('\nWarning: Could not parse JSON test report:', err.message);

    // Try to extract summary from raw output as fallback
    const passedMatch = rawOutput.match(/(\d+)\s+passed/);
    const failedMatch = rawOutput.match(/(\d+)\s+failed/);
    const skippedMatch = rawOutput.match(/(\d+)\s+skipped/);

    if (passedMatch) report.summary.passed = parseInt(passedMatch[1], 10);
    if (failedMatch) report.summary.failed = parseInt(failedMatch[1], 10);
    if (skippedMatch) report.summary.skipped = parseInt(skippedMatch[1], 10);
    report.summary.total = report.summary.passed + report.summary.failed + report.summary.skipped;
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('E2E TEST REPORT');
  console.log('='.repeat(60));
  console.log(`Status: ${report.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Total: ${report.summary.total} | Passed: ${report.summary.passed} | Failed: ${report.summary.failed} | Skipped: ${report.summary.skipped}`);
  if (report.duration) {
    console.log(`Duration: ${report.duration}`);
  }
  console.log('='.repeat(60));

  if (report.failedTests.length > 0) {
    console.log('\nFailed tests:');
    for (const test of report.failedTests) {
      console.log(`  ❌ ${test.name}`);
      if (test.message) {
        console.log(`     ${test.message.split('\n')[0]}`);
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
