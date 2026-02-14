```markdown
# Test Report

**Date:** 2026-02-14T09:03:30.739Z
**Tester:** QA Engineer
**Version:** 0.1.0

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | 52 |
| Passed | 48 |
| Failed | 4 |
| Skipped | 0 |
| Duration | (see categories) |

## Test Results by File

### Unit Tests

### E2E Tests

#### agent-profile.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Agent Profile E2E Default Profile should load default agent profile | passed | 1263.734831ms |
| Agent Profile E2E Default Profile should display profile name on startup | passed | 805.599068ms |
| Agent Profile E2E Custom Profile Loading should load profile from --agent-profile flag | passed | 1259.544715ms |
| Agent Profile E2E Profile Commands should show full profile with /profile command | passed | 1462.001254ms |
| Agent Profile E2E Profile Commands should show system prompt with /memory command | passed | 1413.116667ms |
| Agent Profile E2E Workspace Context should include workspace info in system prompt | passed | 1607.321152ms |
| CLI Flags E2E Model Selection should accept --model flag | passed | 538.574811ms |
| CLI Flags E2E Debug Mode should accept --debug flag | passed | 608.736197ms |
| CLI Flags E2E Yolo Mode should accept --yolo flag | passed | 642.511341ms |
| CLI Flags E2E List Models should list available models with --list-models | passed | 840.813013ms |

#### anti-flicker.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Anti-Flicker E2E Terminal Line Wrapping Control should disable line wrapping on startup | passed | 1016.610756ms |
| Anti-Flicker E2E Terminal Line Wrapping Control should re-enable line wrapping on exit | passed | 1607.437541ms |
| Anti-Flicker E2E UI Test Scenarios should render basic scenario without errors | passed | 1857.845561ms |
| Anti-Flicker E2E UI Test Scenarios should handle rapid-stream scenario | passed | 1460.492866ms |
| Anti-Flicker E2E UI Test Scenarios should handle tool-calls scenario | passed | 1717.972757ms |
| Anti-Flicker E2E Message Rendering should render user message correctly | passed | 1687.503032ms |
| Anti-Flicker E2E Message Rendering should render assistant response correctly | passed | 1455.483134ms |
| Anti-Flicker E2E Error Handling should handle error scenario gracefully | passed | 1513.513995ms |
| Anti-Flicker E2E Static Component Behavior should accumulate multiple messages | failed | 28061.228214ms |
| CLI Help and Version should show help with --help flag | passed | 538.257911ms |
| CLI Help and Version should show version with --version flag | passed | 547.821564ms |

#### input-handling.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Input Handling E2E Basic Input should submit message on Enter and get response | passed | 2066.918065ms |
| Input Handling E2E Basic Input should handle empty input gracefully | passed | 1353.837571ms |
| Input Handling E2E Basic Input should display user input in prompt area | passed | 1659.863852ms |
| Input Handling E2E Message Submission should show user message after submission | passed | 2011.402074ms |
| Input Handling E2E Message Submission should show assistant response after submission | passed | 1661.522392ms |
| Input Handling E2E Input During Streaming should maintain input area visibility during streaming | passed | 2108.316817ms |
| Input Handling E2E Multiple Messages should handle multiple sequential messages | failed | 27033.316098ms |
| Input Handling E2E Long Input should handle and submit long input | passed | 3443.201054ms |

#### markdown-rendering.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Markdown Rendering E2E Code Blocks should render code blocks with borders | passed | 1714.54977ms |
| Markdown Rendering E2E Code Blocks should render code blocks with language labels | passed | 1658.693696ms |
| Markdown Rendering E2E Long Content should handle long content scenario | passed | 1916.287812ms |
| Markdown Rendering E2E Empty Response should handle empty response gracefully | passed | 3162.643349ms |

#### slash-commands.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Slash Commands E2E /help command should display available commands | passed | 1113.004603ms |
| Slash Commands E2E /help command should list all slash commands | passed | 1108.550544ms |
| Slash Commands E2E /profile command should display current agent profile | passed | 1263.834737ms |
| Slash Commands E2E /clear command should clear chat history | passed | 2966.7371ms |
| Slash Commands E2E /history command should show message history | passed | 2313.208609ms |
| Slash Commands E2E /memory command should show system prompt | passed | 1809.989601ms |
| Slash Commands E2E /exit command should exit the application | passed | 1107.077367ms |
| Slash Commands E2E /exit command should work with /quit alias | passed | 906.254486ms |
| Slash Commands E2E /exit command should work with /q alias | passed | 1160.810339ms |
| Slash Commands E2E Unknown commands should handle unknown slash commands gracefully | passed | 1612.3368ms |

#### streaming.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Streaming E2E Basic Streaming should stream content progressively | passed | 1670.639835ms |
| Streaming E2E Basic Streaming should handle rapid streaming without flickering | passed | 1460.440811ms |
| Streaming E2E Basic Streaming should handle slow streaming | passed | 1256.336101ms |
| Streaming E2E Tool Calls should display tool call indicators | passed | 1504.878957ms |
| Streaming E2E Tool Calls should show tool completion status | passed | 2507.789886ms |
| Streaming E2E Multi-turn Conversation should maintain context across turns | failed | 27229.899457ms |
| Streaming E2E Multi-turn Conversation should accumulate messages in history | failed | 28232.954695ms |
| Streaming E2E Error Handling should display errors gracefully | passed | 1311.727116ms |
| Streaming E2E Error Handling should allow continuing after error | passed | 1816.077125ms |

---

## Failed Tests

| Test | Suite | Error |
|------|-------|-------|
| Anti-Flicker E2E Static Component Behavior should accumulate multiple messages | anti-flicker.test.ts | See raw output |
| Input Handling E2E Multiple Messages should handle multiple sequential messages | input-handling.test.ts | See raw output |
| Streaming E2E Multi-turn Conversation should maintain context across turns | streaming.test.ts | See raw output |
| Streaming E2E Multi-turn Conversation should accumulate messages in history | streaming.test.ts | See raw output |

---

## Environment

| Property | Value |
|----------|-------|
| Node.js | v20.20.0 |
| OS | linux x64 |
| Version | 0.1.0 |
| Test Framework | Vitest |

---

## Raw Test Output

### Unit Tests
```

──────────────────────────────────────────────────
      Tests  [22m [1m[32m191 passed[39m[22m[90m (191)[39m
   Duration  [22m 4.23s[22m (transform 843ms, setup 0ms, collect 3.50s, tests 5.88s, environment 3ms, prepare 1.05s)
```

### E2E Tests
```

──────────────────────────────────────────────────
      Tests  [22m [1m[31m4 failed[39m[22m[2m | [22m[1m[32m48 passed[39m[22m[90m (52)[39m
   Duration  [22m 67.35s[22m (transform 154ms, setup 0ms, collect 352ms, tests 184.06s, environment 1ms, prepare 486ms)
Duration: 67.34s
```

---

## Sign-off

- [ ] All critical tests passed
- [ ] No blocking issues found
- [ ] Ready for release

**Status:** ❌ FAILED
```