# E2E Testing Architecture

## Overview

The E2E (end-to-end) testing framework tests the CLI application as a whole, including terminal rendering, user input handling, and interactive features. It uses a pseudo-terminal (PTY) to simulate a real terminal environment, allowing tests to run in CI environments where a real TTY is not available.

## Why PTY?

The CLI uses [Ink](https://github.com/vadimdemedes/ink), a React-based terminal UI library. Ink requires a TTY (terminal) to render properly:

- **TTY Mode**: Ink uses cursor movement, colors, and screen clearing
- **Non-TTY Mode**: Ink falls back to static output, breaking interactive UI

In CI environments (GitHub Actions, Docker, etc.), there is no TTY. We use `@lydell/node-pty` to create a pseudo-terminal that behaves like a real terminal.

```
┌─────────────────────────────────────────────────────────┐
│                    Test Process                         │
│  ┌─────────────┐     ┌─────────────────────────────┐   │
│  │   Vitest    │────▶│   @lydell/node-pty          │   │
│  │   Runner    │     │   (Pseudo-Terminal)         │   │
│  └─────────────┘     └──────────────┬──────────────┘   │
│                                     │                   │
│                                     ▼                   │
│                      ┌─────────────────────────────┐   │
│                      │   CLI Process (beans)       │   │
│                      │   - Sees isTTY = true       │   │
│                      │   - Ink renders normally    │   │
│                      └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Directory Structure

```
tests/e2e/
├── cli-helper.ts          # Test utilities and PTY wrapper
├── anti-flicker.test.ts   # UI rendering and flicker tests
├── globalTeardown.ts      # Cleanup after all tests
vitest.e2e.config.ts       # Vitest configuration for E2E tests
scripts/run-e2e-tests.js   # Script to run E2E tests
```

## Configuration

### vitest.e2e.config.ts

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    testTimeout: 30000,           // E2E tests need longer timeouts
    sequence: { concurrent: false }, // Run sequentially (spawns processes)
    teardownTimeout: 1000,
    globalTeardown: ['./tests/e2e/globalTeardown.ts'],
  },
});
```

### Environment-Aware Timeouts

The test helper adjusts timeouts based on environment:

| Environment | Timeout | Reason |
|-------------|---------|--------|
| CI          | 60s     | Slower, shared resources |
| Local       | 15s     | Fast, dedicated resources |

```typescript
function getDefaultTimeout(): number {
  if (process.env['CI']) return 60000;
  return 15000;
}
```

## Test Helper API

### InteractiveRun

Wraps a PTY process for interactive testing:

```typescript
const run = await spawnInteractive({ args: ['--ui-test'] });

// Wait for text to appear
await run.expectText('Type a message');

// Send input
await run.sendLine('hello');

// Wait for response
await run.expectText('response');

// Check raw output (with ANSI codes)
const raw = run.getRawOutput();
expect(hasEscapeCode(raw, EscapeCodes.DISABLE_LINE_WRAP)).toBe(true);

// Clean up
run.kill();
```

### spawnCommand

For non-interactive commands:

```typescript
const { output, exitCode } = await spawnCommand(['--help']);
expect(exitCode).toBe(0);
expect(output).toContain('Usage');
```

### Methods

| Method | Description |
|--------|-------------|
| `expectText(text, timeout?)` | Wait for text to appear (case-insensitive) |
| `expectPattern(regex, timeout?)` | Wait for regex pattern to match |
| `type(text)` | Type slowly with echo verification |
| `sendKeys(text)` | Send keys without waiting |
| `sendLine(text)` | Send text + Enter |
| `getRawOutput()` | Get output with ANSI codes |
| `getCleanOutput()` | Get output without ANSI codes |
| `kill()` | Terminate the process |
| `expectExit(timeout?)` | Wait for process to exit |

## Running Tests

### Local Development

```bash
# Run all E2E tests
npm run test:e2e

# Run with watch mode
npm run test:e2e:watch

# Run with verbose output
VERBOSE=true npm run test:e2e

# Run specific test file
npx vitest run --config vitest.e2e.config.ts tests/e2e/anti-flicker.test.ts
```

### CI (GitHub Actions)

E2E tests run automatically in the CI workflow:

```yaml
e2e-test:
  name: E2E Tests
  runs-on: ubuntu-latest
  needs: build

  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - run: npm ci
    - run: npm run build
    - run: npm run test:e2e
```

## Writing Tests

### Test Structure

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { spawnInteractive, type InteractiveRun } from './cli-helper.js';

describe('Feature Name', () => {
  let run: InteractiveRun | null = null;

  afterEach(() => {
    // Always clean up the PTY process
    if (run) {
      run.kill();
      run = null;
    }
  });

  it('should do something', async () => {
    run = await spawnInteractive({ args: ['--ui-test'] });

    await run.sendLine('input');
    await run.expectText('expected output');

    const output = run.getCleanOutput();
    expect(output).toContain('something');
  });
});
```

### Testing Escape Codes

```typescript
import { hasEscapeCode, EscapeCodes } from './cli-helper.js';

it('should disable line wrapping', async () => {
  run = await spawnInteractive({ args: ['--ui-test'] });

  const rawOutput = run.getRawOutput();
  expect(hasEscapeCode(rawOutput, EscapeCodes.DISABLE_LINE_WRAP)).toBe(true);
});
```

### UI Test Mode

The CLI has a `--ui-test` flag that uses mock LLM responses:

```bash
beans --ui-test                           # Basic scenario
beans --ui-test --ui-test-scenario rapid-stream   # Fast streaming
beans --ui-test --ui-test-scenario tool-calls     # Tool call UI
beans --ui-test --ui-test-scenario error          # Error handling
beans --ui-test --ui-test-scenario multi-turn     # Multi-turn chat
```

Use these in tests to get predictable, fast responses.

## Troubleshooting

### Tests Timeout in CI

1. Increase timeout: `await run.expectText('text', 60000)`
2. Check CI logs for actual output
3. Use `VERBOSE=true` to see real-time output

### PTY Process Not Terminating

Always call `run.kill()` in `afterEach`:

```typescript
afterEach(() => {
  if (run) {
    run.kill();
    run = null;
  }
});
```

### Output Doesn't Match

- Use `run.getCleanOutput()` to strip ANSI codes
- Pattern matching is case-insensitive by default
- Check for timing issues (add delays or longer timeouts)

### Debug Mode

```bash
# See all output in real-time
VERBOSE=true npm run test:e2e

# Keep test output for inspection
KEEP_OUTPUT=true npm run test:e2e
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `@lydell/node-pty` | Cross-platform PTY implementation |
| `strip-ansi` | Remove ANSI escape codes from output |
| `vitest` | Test runner |

## References

- [gemini-cli integration-tests](https://github.com/anthropics/gemini-cli/tree/main/integration-tests)
- [node-pty documentation](https://github.com/microsoft/node-pty)
- [Ink documentation](https://github.com/vadimdemedes/ink)
