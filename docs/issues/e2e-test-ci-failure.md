# E2E Test CI Failure

## Status: RESOLVED ✅

## Problem

E2E tests pass locally (including in Docker with `node:20`) but fail in GitHub Actions. The tests timeout waiting for "Type a message" prompt to appear.

### Symptoms

1. All interactive tests timeout in CI
2. Console.log output appears but Ink-rendered content does not
3. Non-interactive tests (`--help`, `--version`) pass

## Root Cause

**Ink uses `log-update` for terminal rendering, which doesn't work in CI environments.**

Ink is a React-based terminal UI library. By default, it uses the `log-update` package to efficiently update terminal output by erasing and rewriting content. However, in CI environments (detected via `is-in-ci` package), `log-update` doesn't output content properly through the PTY.

### Why it happens

1. Ink detects CI environment via `is-in-ci` package
2. In CI mode, Ink modifies some behavior but still uses `log-update` for rendering
3. `log-update` relies on terminal cursor manipulation that doesn't work correctly through `node-pty` in GitHub Actions
4. Result: React components mount and render, but output never appears in stdout

### Evidence

- Console.log statements before `render()` appeared in CI output
- Ink-rendered content ("Type a message") never appeared
- Local tests passed because real TTY handles `log-update` correctly

## Solution

**Enable Ink's `debug` mode only when running in CI + UI test mode.**

```typescript
// packages/cli/src/app.tsx
const isCI = process.env.CI === 'true';

const { waitUntilExit } = render(
  React.createElement(App, { ... }),
  {
    exitOnCtrlC: false,
    stdout: process.stdout,
    debug: uiTestMode && isCI,  // Forces direct stdout.write() in CI only
    ...stdinAdapter.renderOptions,
  }
);
```

When `debug: true` is set, Ink bypasses `log-update` and writes directly to stdout on each render. This produces more output (each render frame is appended rather than replacing), but it works reliably in CI environments.

The check for `process.env.CI` ensures clean output locally while still working in CI.

### Additional fixes applied

1. **Separated RuntimeConfig from persistent settings** - `uiTestMode` is now a runtime-only flag that doesn't persist to settings.json
2. **Simplified mock stdin** - Removed setTimeout delays that could cause timing issues
3. **Added explicit stdout** - Pass `stdout: process.stdout` to Ink render options

## Investigation Tasks

- [x] **Task 1**: Simplify tests to isolate the issue
  - Keep only `--help` and `--version` tests (non-interactive)
  - Verify these pass in CI

- [x] **Task 2**: Add a minimal interactive test
  - Create simple test that just spawns PTY and checks for any output
  - Debug what the PTY actually receives

- [x] **Task 3**: Investigate PTY configuration differences
  - Found: Issue is with Ink's `log-update`, not PTY configuration

- [x] **Task 4**: Implement fix
  - Solution: Use `debug: true` in Ink render options for UI test mode

- [x] **Task 5**: Restore full test suite once issue is fixed

## Current Test Status

| Test | Local | Docker (node:20) | GitHub Actions |
|------|-------|------------------|----------------|
| `--help` | ✅ | ✅ | ✅ |
| `--version` | ✅ | ✅ | ✅ |
| Interactive tests | ✅ | ✅ | ✅ |

## Files Involved

- `tests/e2e/anti-flicker.test.ts` - Test cases
- `tests/e2e/cli-helper.ts` - PTY helper functions
- `packages/cli/src/app.tsx` - Terminal escape sequences
- `.github/workflows/ci.yml` - CI configuration

## Implementation Plan

### Phase 1: Verify non-interactive tests work in CI ✅

1. Temporarily reduce test file to only `--help` and `--version` tests
2. Push and verify CI passes
3. This confirms the basic PTY setup works

**Status**: Complete. Non-interactive tests pass in CI.

### Phase 2: Debug interactive test failure ✅

1. Add a minimal interactive test with extra debugging
2. Log raw PTY output to understand what's happening
3. Identify why "Type a message" isn't being detected

**Status**: Complete. Found that console.log output appeared but Ink-rendered content did not.

### Phase 3: Fix the issue ✅

**Solution**: Enable Ink's `debug` mode in UI test mode.

The fix was to pass `debug: uiTestMode` to Ink's render options. This bypasses `log-update` and writes directly to stdout, which works reliably through node-pty in CI.

### Phase 4: Restore full test suite ✅

1. Uncomment/restore all interactive tests
2. Verify all tests pass in CI
3. Update this document with final solution

**Status**: Complete. Full test suite restored from backup.

## Related

- `docs/issues/rendering-performance.md` - Why escape sequences are needed
- `../gemini-cli/integration-tests/` - Reference implementation
