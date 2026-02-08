/**
 * E2E Tests for CLI
 *
 * Phase 1: Only non-interactive tests to verify basic PTY setup works in CI.
 * Interactive tests are temporarily disabled while debugging CI issues.
 *
 * See docs/issues/e2e-test-ci-failure.md for details.
 * Original tests backed up in anti-flicker.test.ts.bak
 */

import { describe, it, expect } from 'vitest';
import { spawnCommand } from './cli-helper.js';

describe('CLI Commands (Non-Interactive)', () => {
  it('should show help with --help flag', async () => {
    const { output, exitCode } = await spawnCommand(['--help']);

    expect(exitCode).toBe(0);
    expect(output).toContain('Usage');
    expect(output).toContain('Options');
  });

  it('should show version with --version flag', async () => {
    const { output, exitCode } = await spawnCommand(['--version']);

    expect(exitCode).toBe(0);
    expect(output).toMatch(/\d+\.\d+\.\d+/);
  });
});

// Interactive test - verify Ink renders properly
describe('Interactive CLI', () => {
  it('should render Type a message prompt', async () => {
    const { spawnInteractiveDebug } = await import('./cli-helper.js');

    const result = await spawnInteractiveDebug({
      args: ['--ui-test'],
      timeout: 10000,  // 10s should be enough
    });

    // Always log for CI debugging
    console.log('[DEBUG] Output length:', result.rawOutput.length);
    console.log('[DEBUG] Raw (escaped):', JSON.stringify(result.rawOutput));
    console.log('[DEBUG] Clean output:', result.cleanOutput);

    expect(result.cleanOutput).toContain('Type a message');
  }, 60000);  // 60s test timeout
});
