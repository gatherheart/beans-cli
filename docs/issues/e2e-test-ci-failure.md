# E2E Test CI Failure

## Problem

E2E tests pass locally (including in Docker with `node:20`) but fail in GitHub Actions. The tests timeout waiting for "Type a message" prompt to appear.

### Symptoms

1. All interactive tests timeout in CI
2. CI output shows corrupted escape sequences: `7l25l` instead of proper escape codes
3. Non-interactive tests (`--help`, `--version`) pass

### Error Output (CI)

```
[E2E] Spawning CLI with args: --ui-test --yolo
[E2E] CLI_PATH: /path/to/packages/cli/dist/index.js
Error: Timeout waiting for text: "Type a message"
Output:
7l25l🤖 General Assistant...
```

The `7l25l` appears to be corrupted terminal escape sequences (`\x1b[?7l\x1b[?25l`).

## Root Cause Analysis

The CLI writes terminal escape sequences at startup:
- `\x1b[?7l` - Disable line wrapping (in `app.tsx`)
- `\x1b[?25l` - Hide cursor (in Ink's internal rendering)

In GitHub Actions, these escape codes appear to be:
1. Partially processed by the PTY
2. Printed as visible text instead of interpreted as control sequences
3. Causing the output parsing to fail

## Investigation Tasks

- [ ] **Task 1**: Simplify tests to isolate the issue
  - Keep only `--help` and `--version` tests (non-interactive)
  - Verify these pass in CI

- [ ] **Task 2**: Add a minimal interactive test
  - Create simple test that just spawns PTY and checks for any output
  - Debug what the PTY actually receives

- [ ] **Task 3**: Investigate PTY configuration differences
  - Compare `@lydell/node-pty` behavior in GitHub Actions vs local
  - Check if `TERM` environment variable affects behavior

- [ ] **Task 4**: Consider alternative approaches
  - Option A: Filter escape codes before matching text
  - Option B: Use different PTY configuration
  - Option C: Add startup delay in CI for escape code processing

- [ ] **Task 5**: Restore full test suite once issue is fixed

## Current Test Status

| Test | Local | Docker (node:20) | GitHub Actions |
|------|-------|------------------|----------------|
| `--help` | ✅ | ✅ | ✅ |
| `--version` | ✅ | ✅ | ✅ |
| Interactive tests | ✅ | ✅ | ❌ Timeout |

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

**Status**: Implemented. Tests pass locally.

### Phase 2: Debug interactive test failure ✅

1. Add a minimal interactive test with extra debugging
2. Log raw PTY output to understand what's happening
3. Identify why "Type a message" isn't being detected

**Status**: Implemented. Added `spawnInteractiveDebug()` helper and debug test.
Locally, escape codes appear as `\u001b[?7l` and "Type a message" is found correctly.
Need to push to CI to see the actual output there.

### Phase 3: Fix the issue

Based on Phase 2 findings, implement the appropriate fix:
- Fix escape code handling
- Adjust PTY configuration
- Or implement workaround

### Phase 4: Restore full test suite

1. Uncomment/restore all interactive tests
2. Verify all tests pass in CI
3. Update this document with final solution

## Related

- `docs/issues/rendering-performance.md` - Why escape sequences are needed
- `../gemini-cli/integration-tests/` - Reference implementation
