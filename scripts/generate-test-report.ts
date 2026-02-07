#!/usr/bin/env npx tsx
/**
 * Generate UI Test Report
 *
 * This script runs tests and generates a report using Gemini API.
 *
 * Usage:
 *   npx tsx scripts/generate-test-report.ts              # Show test data
 *   npx tsx scripts/generate-test-report.ts --json       # Output JSON only
 *   npx tsx scripts/generate-test-report.ts --gemini     # Generate with Gemini API
 *   npx tsx scripts/generate-test-report.ts --save       # Save report to file
 *
 * Environment:
 *   GEMINI_API_KEY - Required for --gemini mode
 */

import { execSync } from 'node:child_process';
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
  tests: TestResult[];
  duration: number;
}

interface TestReport {
  date: string;
  version: string;
  nodeVersion: string;
  os: string;
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

function runTestsVerbose(): string {
  try {
    return execSync('npm test -- --reporter=verbose', {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string };
    return err.stdout || err.stderr || 'Unknown error';
  }
}

/**
 * Clean and format raw test output for better readability
 */
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

function parseTestOutput(output: string): Partial<TestReport> {
  const lines = output.split('\n');
  const suites: TestSuite[] = [];
  let currentSuite: TestSuite | null = null;

  let totalPassed = 0;
  let totalFailed = 0;
  const totalSkipped = 0;
  let totalDuration = '';

  for (const line of lines) {
    const fileMatch = line.match(/[✓✗] (.+\.test\.tsx?) \((\d+) tests?\) (\d+)ms/);
    if (fileMatch) {
      if (currentSuite) {
        suites.push(currentSuite);
      }
      currentSuite = {
        name: fileMatch[1],
        tests: [],
        duration: parseInt(fileMatch[3]),
      };
    }

    const summaryMatch = line.match(/Tests\s+(\d+) passed/);
    if (summaryMatch) {
      totalPassed = parseInt(summaryMatch[1]);
    }

    const failedMatch = line.match(/(\d+) failed/);
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

function generateReport(): TestReport {
  console.error('Running tests...\n');

  const verboseOutput = runTestsVerbose();
  const parsed = parseTestOutput(verboseOutput);

  const report: TestReport = {
    date: new Date().toISOString(),
    version: JSON.parse(
      fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8')
    ).version,
    nodeVersion: process.version,
    os: `${process.platform} ${process.arch}`,
    summary: parsed.summary || {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: '0ms',
    },
    suites: parsed.suites || [],
    rawOutput: formatRawOutput(verboseOutput),
  };

  return report;
}

function getGeminiPrompt(report: TestReport): string {
  const template = fs.readFileSync(
    path.join(ROOT_DIR, 'docs/templates/test-report.md'),
    'utf-8'
  );

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

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const jsonOnly = args.includes('--json');
  const geminiMode = args.includes('--gemini');
  const saveMode = args.includes('--save');

  const report = generateReport();

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
  console.log('=== TEST REPORT DATA ===\n');
  console.log(`Date: ${report.date}`);
  console.log(`Version: ${report.version}`);
  console.log(`Node: ${report.nodeVersion}`);
  console.log(`OS: ${report.os}`);
  console.log(`\nSummary:`);
  console.log(`  Total: ${report.summary.total}`);
  console.log(`  Passed: ${report.summary.passed}`);
  console.log(`  Failed: ${report.summary.failed}`);
  console.log(`  Duration: ${report.summary.duration}`);
  console.log(`\nTest Suites:`);
  for (const suite of report.suites) {
    console.log(`  - ${suite.name} (${suite.duration}ms)`);
  }
  console.log('\nOptions:');
  console.log('  --json    Output JSON data');
  console.log('  --gemini  Generate report with Gemini API');
  console.log('  --save    Save report to docs/reports/');
}

main().catch(console.error);
