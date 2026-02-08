/**
 * E2E Test Global Setup
 *
 * Sets up a clean environment for integration tests.
 * Based on gemini-cli's globalSetup.ts pattern.
 */

import { mkdir, rm, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '../..');
const integrationTestsDir = join(rootDir, '.e2e-tests');
let runDir = '';

export async function setup() {
  // Unset NO_COLOR to ensure consistent theme behavior
  if (process.env['NO_COLOR'] !== undefined) {
    delete process.env['NO_COLOR'];
  }

  // Create a unique run directory
  runDir = join(integrationTestsDir, `${Date.now()}`);
  await mkdir(runDir, { recursive: true });

  // Set HOME to test directory to avoid loading user config
  process.env['HOME'] = runDir;
  if (process.platform === 'win32') {
    process.env['USERPROFILE'] = runDir;
  }

  // Set beans config directory
  process.env['BEANS_CONFIG_DIR'] = join(runDir, '.beans');
  await mkdir(join(runDir, '.beans'), { recursive: true });

  // Clean up old test runs (keep last 5)
  try {
    const testRuns = await readdir(integrationTestsDir);
    if (testRuns.length > 5) {
      const oldRuns = testRuns.sort().slice(0, testRuns.length - 5);
      await Promise.all(
        oldRuns.map((oldRun) =>
          rm(join(integrationTestsDir, oldRun), { recursive: true, force: true })
        )
      );
    }
  } catch {
    // Ignore cleanup errors
  }

  // Store run directory for tests
  process.env['E2E_TEST_DIR'] = runDir;
  process.env['BEANS_E2E_TEST'] = 'true';

  console.log(`\n[E2E] Test output directory: ${runDir}`);
}

export async function teardown() {
  // Clean up unless KEEP_OUTPUT is set
  if (process.env['KEEP_OUTPUT'] !== 'true' && runDir) {
    try {
      await rm(runDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
