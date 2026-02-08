import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    // E2E tests need longer timeouts, especially in CI
    testTimeout: process.env.CI ? 120000 : 30000,
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
