import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    // E2E tests may take longer
    testTimeout: 30000,
    // Run tests sequentially (e2e tests spawn processes)
    sequence: {
      concurrent: false,
    },
    // Force exit after tests complete to clean up any hanging processes
    teardownTimeout: 1000,
    // Global teardown to force exit
    globalTeardown: ['./tests/e2e/globalTeardown.ts'],
  },
});
