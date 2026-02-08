/**
 * Global teardown for e2e tests
 *
 * This ensures vitest exits cleanly after e2e tests complete.
 * E2E tests spawn child processes that may leave open handles.
 */

export default function globalTeardown() {
  // Force exit on next tick to ensure this runs after vitest cleanup
  // This is safe because tests have already completed at this point
  setImmediate(() => {
    process.exit(0);
  });
}
