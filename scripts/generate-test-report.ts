#!/usr/bin/env npx tsx
/**
 * Generate Comprehensive Test Report
 *
 * This script runs all tests (unit + e2e) and generates a combined report.
 *
 * Usage:
 *   npx tsx scripts/generate-test-report.ts              # Show test data
 *   npx tsx scripts/generate-test-report.ts --json       # Output JSON only
 *   npx tsx scripts/generate-test-report.ts --gemini     # Generate with Gemini API
 *   npx tsx scripts/generate-test-report.ts --save       # Save report to file
 *   npx tsx scripts/generate-test-report.ts --unit-only  # Run only unit tests
 *   npx tsx scripts/generate-test-report.ts --e2e-only   # Run only e2e tests
 *
 * Environment:
 *   GEMINI_API_KEY - Required for --gemini mode
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

interface TestSuite {
  name: string;
  type: 'unit' | 'e2e';
  tests: TestResult[];
  duration: number;
  status: 'passed' | 'failed';
}

interface TestCategory {
  name: string;
  type: 'unit' | 'e2e';
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: string;
  };
  suites: TestSuite[];
  rawOutput: string;
}

interface TestReport {
  date: string;
  version: string;
  nodeVersion: string;
  os: string;
  overallSuccess: boolean;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  categories: TestCategory[];
}

function runCommand(command: string, args: string[]): { output: string; exitCode: number } {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  });

  const output = (result.stdout || '') + (result.stderr || '');
  return { output, exitCode: result.status || 0 };
}

function runUnitTests(): { output: string; exitCode: number } {
  console.error('Running unit tests...\n');
  return runCommand('npm', ['test', '--', '--reporter=verbose']);
}

function runE2ETests(): { output: string; exitCode: number } {
  console.error('Running e2e tests...\n');

  // Run e2e tests - this generates .e2e-reports/summary.json
  const result = runCommand('npm', ['run', 'test:e2e']);

  return result;
}

function parseVitestOutput(output: string, type: 'unit' | 'e2e'): Partial<TestCategory> {
  const lines = output.split('\n');
  const suites: TestSuite[] = [];
  let currentSuite: TestSuite | null = null;

  let totalPassed = 0;
  let totalFailed = 0;
  const totalSkipped = 0;
  let totalDuration = '';

  for (const line of lines) {
    // Match file headers: ✓ path/to/file.test.ts (N tests) Xms
    const fileMatch = line.match(/[✓✗]\s+(.+\.test\.tsx?)\s+\((\d+)\s+tests?\)\s+(\d+)ms/);
    if (fileMatch) {
      if (currentSuite) {
        suites.push(currentSuite);
      }
      currentSuite = {
        name: fileMatch[1],
        type,
        tests: [],
        duration: parseInt(fileMatch[3]),
        status: line.includes('✓') ? 'passed' : 'failed',
      };
    }

    // Match individual test results
    const testMatch = line.match(/^\s*[✓✗]\s+(.+?)\s+(\d+)ms$/);
    if (testMatch && currentSuite) {
      currentSuite.tests.push({
        name: testMatch[1],
        status: line.includes('✓') ? 'passed' : 'failed',
        duration: parseInt(testMatch[2]),
      });
    }

    // Match summary line
    const summaryMatch = line.match(/Tests\s+(\d+)\s+passed/);
    if (summaryMatch) {
      totalPassed = parseInt(summaryMatch[1]);
    }

    const failedMatch = line.match(/(\d+)\s+failed/);
    if (failedMatch) {
      totalFailed = parseInt(failedMatch[1]);
    }

    const durationMatch = line.match(/Duration\s+([0-9.]+[ms]+)/);
    if (durationMatch) {
      totalDuration = durationMatch[1];
    }
  }

  if (currentSuite) {
    suites.push(currentSuite);
  }

  return {
    summary: {
      total: totalPassed + totalFailed + totalSkipped,
      passed: totalPassed,
      failed: totalFailed,
      skipped: totalSkipped,
      duration: totalDuration,
    },
    suites,
  };
}

interface E2ETestResult {
  name: string;
  status: string;
  duration: number;
}

interface E2ESuite {
  name: string;
  status: string;
  testCount: number;
  tests: E2ETestResult[];
}

function readE2EReport(): Partial<TestCategory> | null {
  const reportPath = path.join(ROOT_DIR, '.e2e-reports', 'summary.json');
  try {
    if (fs.existsSync(reportPath)) {
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      return {
        summary: {
          total: report.summary?.total || 0,
          passed: report.summary?.passed || 0,
          failed: report.summary?.failed || 0,
          skipped: report.summary?.skipped || 0,
          duration: report.duration || '0s',
        },
        suites: (report.testSuites || []).map((s: E2ESuite) => ({
          name: s.name,
          type: 'e2e' as const,
          tests: (s.tests || []).map((t: E2ETestResult) => ({
            name: t.name,
            status: t.status === 'passed' ? 'passed' : t.status === 'failed' ? 'failed' : 'skipped',
            duration: t.duration || 0,
          })),
          duration: (s.tests || []).reduce((sum: number, t: E2ETestResult) => sum + (t.duration || 0), 0),
          status: s.status === 'passed' ? 'passed' : 'failed',
        })),
      };
    }
  } catch (err) {
    console.error('Warning: Could not read e2e report:', (err as Error).message);
  }
  return null;
}

function formatRawOutput(output: string): string {
  const lines = output.split('\n');
  const formattedLines: string[] = [];

  let currentFile = '';
  let testCount = 0;

  for (const line of lines) {
    // Skip npm command header and empty lines
    if (line.includes('> @beans') || line.includes('> vitest') || line.trim() === '') {
      continue;
    }

    // Skip the RUN header line
    if (line.includes('RUN  v')) {
      const versionMatch = line.match(/v(\d+\.\d+\.\d+)/);
      if (versionMatch) {
        formattedLines.push(`Vitest ${versionMatch[1]}`);
        formattedLines.push('─'.repeat(50));
      }
      continue;
    }

    // Format file headers - extract just the file name
    const fileMatch = line.match(/[✓✗]\s+(.+\.test\.tsx?)\s+(?:>|$)/);
    if (fileMatch && !currentFile.includes(fileMatch[1])) {
      currentFile = fileMatch[1];
      const shortPath = currentFile.replace(/^(packages\/|tests\/)/, '');
      if (testCount > 0) {
        formattedLines.push('');
      }
      formattedLines.push(`📁 ${shortPath}`);
      testCount = 0;
    }

    // Format individual test results
    const testMatch = line.match(/^\s*([✓✗])\s+(.+?)\s+(\d+ms)?$/);
    if (testMatch) {
      const [, status, testName, duration] = testMatch;
      const icon = status === '✓' ? '  ✅' : '  ❌';
      const durationStr = duration ? ` (${duration})` : '';
      // Extract just the test name (after last >)
      const parts = testName.split(' > ');
      const shortName = parts[parts.length - 1];
      formattedLines.push(`${icon} ${shortName}${durationStr}`);
      testCount++;
    }

    // Include summary lines
    if (line.includes('Tests') && line.includes('passed')) {
      formattedLines.push('');
      formattedLines.push('─'.repeat(50));
      formattedLines.push(line.trim());
    }
    if (line.includes('Duration')) {
      formattedLines.push(line.trim());
    }
  }

  return formattedLines.join('\n');
}

interface RunOptions {
  unitOnly: boolean;
  e2eOnly: boolean;
}

function generateReport(options: RunOptions): TestReport {
  const categories: TestCategory[] = [];
  let overallSuccess = true;

  // Run unit tests
  if (!options.e2eOnly) {
    const unitResult = runUnitTests();
    const unitParsed = parseVitestOutput(unitResult.output, 'unit');

    if (unitResult.exitCode !== 0) {
      overallSuccess = false;
    }

    categories.push({
      name: 'Unit Tests',
      type: 'unit',
      summary: unitParsed.summary || { total: 0, passed: 0, failed: 0, skipped: 0, duration: '0ms' },
      suites: unitParsed.suites || [],
      rawOutput: formatRawOutput(unitResult.output),
    });
  }

  // Run e2e tests
  if (!options.unitOnly) {
    const e2eResult = runE2ETests();

    // Read the generated e2e report for more accurate data
    const e2eReport = readE2EReport();
    const e2eParsed = e2eReport || parseVitestOutput(e2eResult.output, 'e2e');

    // Check success from the e2e report
    const e2eReportPath = path.join(ROOT_DIR, '.e2e-reports', 'summary.json');
    if (fs.existsSync(e2eReportPath)) {
      const report = JSON.parse(fs.readFileSync(e2eReportPath, 'utf-8'));
      if (!report.success) {
        overallSuccess = false;
      }
    }

    categories.push({
      name: 'E2E Tests',
      type: 'e2e',
      summary: e2eParsed.summary || { total: 0, passed: 0, failed: 0, skipped: 0, duration: '0s' },
      suites: e2eParsed.suites || [],
      rawOutput: formatRawOutput(e2eResult.output),
    });
  }

  // Calculate overall summary
  const overallSummary = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  };

  for (const cat of categories) {
    overallSummary.total += cat.summary.total;
    overallSummary.passed += cat.summary.passed;
    overallSummary.failed += cat.summary.failed;
    overallSummary.skipped += cat.summary.skipped;
  }

  if (overallSummary.failed > 0) {
    overallSuccess = false;
  }

  const report: TestReport = {
    date: new Date().toISOString(),
    version: JSON.parse(
      fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8')
    ).version,
    nodeVersion: process.version,
    os: `${process.platform} ${process.arch}`,
    overallSuccess,
    summary: overallSummary,
    categories,
  };

  return report;
}

function getGeminiPrompt(report: TestReport): string {
  const templatePath = path.join(ROOT_DIR, 'docs/templates/test-report.md');
  let template = '';

  if (fs.existsSync(templatePath)) {
    template = fs.readFileSync(templatePath, 'utf-8');
  } else {
    template = `# Test Report

**Date:** {{date}}
**Version:** {{version}}

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | {{total}} |
| Passed | {{passed}} |
| Failed | {{failed}} |
| Skipped | {{skipped}} |

## Categories

{{#each categories}}
### {{name}}
- Total: {{summary.total}}
- Passed: {{summary.passed}}
- Failed: {{summary.failed}}
- Duration: {{summary.duration}}
{{/each}}

## Status

{{#if overallSuccess}}
✅ All tests passed!
{{else}}
❌ Some tests failed.
{{/if}}
`;
  }

  return `You are a QA engineer generating a test report.

Based on the following test results, fill in the test report template.
Replace all {{placeholder}} values with actual data from the test results.

## Test Results (JSON):
\`\`\`json
${JSON.stringify(report, null, 2)}
\`\`\`

## Template:
\`\`\`markdown
${template}
\`\`\`

## Instructions:
1. Fill in all {{placeholder}} values with actual data
2. For each test category, mark status as ✅ PASSED, ❌ FAILED, or ⏭️ SKIPPED
3. Add any observations or recommendations based on the test results
4. If all tests passed, add a positive summary
5. If there are failures, describe them in the Issues Found section
6. Output ONLY the filled-in markdown report, no additional text

Generate the complete test report:`;
}

async function callGeminiAPI(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('No response from Gemini API');
  }

  return text;
}

function saveReport(content: string, filename?: string): string {
  const reportsDir = path.join(ROOT_DIR, 'docs/reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const date = new Date().toISOString().split('T')[0];
  const reportFile = filename || `test-report-${date}.md`;
  const reportPath = path.join(reportsDir, reportFile);

  fs.writeFileSync(reportPath, content, 'utf-8');
  return reportPath;
}

function printSummary(report: TestReport): void {
  console.log('\n' + '='.repeat(60));
  console.log('COMPREHENSIVE TEST REPORT');
  console.log('='.repeat(60));
  console.log(`Status: ${report.overallSuccess ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);
  console.log(`Date: ${report.date}`);
  console.log(`Version: ${report.version}`);
  console.log(`Node: ${report.nodeVersion}`);
  console.log(`OS: ${report.os}`);
  console.log('');
  console.log('Overall Summary:');
  console.log(`  Total: ${report.summary.total} | Passed: ${report.summary.passed} | Failed: ${report.summary.failed} | Skipped: ${report.summary.skipped}`);
  console.log('');

  for (const category of report.categories) {
    const status = category.summary.failed > 0 ? '❌' : '✅';
    console.log(`${status} ${category.name}:`);
    console.log(`   Total: ${category.summary.total} | Passed: ${category.summary.passed} | Failed: ${category.summary.failed} | Duration: ${category.summary.duration}`);

    if (category.suites.length > 0) {
      for (const suite of category.suites) {
        const suiteStatus = suite.status === 'passed' ? '✓' : '✗';
        console.log(`   ${suiteStatus} ${suite.name}`);
      }
    }
    console.log('');
  }

  console.log('='.repeat(60));
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const jsonOnly = args.includes('--json');
  const geminiMode = args.includes('--gemini');
  const saveMode = args.includes('--save');
  const unitOnly = args.includes('--unit-only');
  const e2eOnly = args.includes('--e2e-only');

  const report = generateReport({ unitOnly, e2eOnly });

  if (jsonOnly) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (geminiMode) {
    const prompt = getGeminiPrompt(report);

    try {
      console.error('Calling Gemini API...\n');
      const generatedReport = await callGeminiAPI(prompt);

      if (saveMode) {
        const reportPath = saveReport(generatedReport);
        console.error(`Report saved to: ${reportPath}\n`);
      }

      console.log(generatedReport);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
    return;
  }

  // Default: show summary
  printSummary(report);

  console.log('Options:');
  console.log('  --json       Output JSON data');
  console.log('  --gemini     Generate report with Gemini API');
  console.log('  --save       Save report to docs/reports/');
  console.log('  --unit-only  Run only unit tests');
  console.log('  --e2e-only   Run only e2e tests');
}

main().catch(console.error);
