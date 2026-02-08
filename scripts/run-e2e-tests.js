#!/usr/bin/env node
/**
 * E2E Test Runner
 *
 * Runs vitest for e2e tests and ensures proper cleanup of any hanging processes.
 * This is needed because e2e tests spawn child processes that may keep vitest alive.
 */

import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Run vitest
const vitest = spawn('npx', ['vitest', 'run', '--config', 'vitest.e2e.config.ts'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
});

let exitCode = 0;

vitest.on('close', (code) => {
  exitCode = code ?? 0;

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

  // Force exit
  process.exit(exitCode);
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
