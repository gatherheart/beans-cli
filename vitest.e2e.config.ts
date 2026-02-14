import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    // E2E tests need longer timeouts, especially in CI
    testTimeout: process.env.CI ? 120000 : 30000,
    // Retry failed tests in CI (E2E tests can be flaky due to timing)
    retry: process.env.CI ? 2 : 0,
    // Run tests sequentially (e2e tests spawn processes)
    sequence: {
      concurrent: false,
    },
    // Force exit after tests complete to clean up any hanging processes
    teardownTimeout: 5000,
    // Global setup and teardown
    globalSetup: ['./tests/e2e/globalSetup.ts'],
    globalTeardown: ['./tests/e2e/globalTeardown.ts'],
  },
});
