```markdown
# Test Report

**Date:** 2026-02-14T14:07:17.894Z
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
| Agent Profile E2E Default Profile should load default agent profile | passed | 1266.086359ms |
| Agent Profile E2E Default Profile should display profile name on startup | passed | 807.7440590000001ms |
| Agent Profile E2E Custom Profile Loading should load profile from --agent-profile flag | passed | 1259.7669020000003ms |
| Agent Profile E2E Profile Commands should show full profile with /profile command | passed | 1462.0161880000005ms |
| Agent Profile E2E Profile Commands should show system prompt with /memory command | passed | 1808.604445ms |
| Agent Profile E2E Workspace Context should include workspace info in system prompt | passed | 1810.588987ms |
| CLI Flags E2E Model Selection should accept --model flag | passed | 687.9612960000013ms |
| CLI Flags E2E Debug Mode should accept --debug flag | passed | 641.7858610000003ms |
| CLI Flags E2E Yolo Mode should accept --yolo flag | passed | 659.3898090000002ms |
| CLI Flags E2E List Models should list available models with --list-models | passed | 871.5116280000002ms |

#### anti-flicker.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Anti-Flicker E2E Terminal Line Wrapping Control should disable line wrapping on startup | passed | 1215.011262ms |
| Anti-Flicker E2E Terminal Line Wrapping Control should re-enable line wrapping on exit | passed | 1605.8494620000001ms |
| Anti-Flicker E2E UI Test Scenarios should render basic scenario without errors | passed | 1660.0887790000002ms |
| Anti-Flicker E2E UI Test Scenarios should handle rapid-stream scenario | passed | 1458.7453010000008ms |
| Anti-Flicker E2E UI Test Scenarios should handle tool-calls scenario | passed | 1925.4377349999995ms |
| Anti-Flicker E2E Message Rendering should render user message correctly | passed | 1871.5220469999995ms |
| Anti-Flicker E2E Message Rendering should render assistant response correctly | passed | 1460.0563139999995ms |
| Anti-Flicker E2E Error Handling should handle error scenario gracefully | passed | 1508.845668ms |
| Anti-Flicker E2E Static Component Behavior should accumulate multiple messages | failed | 28013.728987ms |
| CLI Help and Version should show help with --help flag | passed | 573.2681349999984ms |
| CLI Help and Version should show version with --version flag | passed | 575.7340380000023ms |

#### input-handling.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Input Handling E2E Basic Input should submit message on Enter and get response | passed | 2270.5889310000002ms |
| Input Handling E2E Basic Input should handle empty input gracefully | passed | 1355.812414ms |
| Input Handling E2E Basic Input should display user input in prompt area | passed | 1659.7603669999994ms |
| Input Handling E2E Message Submission should show user message after submission | passed | 2018.9878429999999ms |
| Input Handling E2E Message Submission should show assistant response after submission | passed | 1659.3128709999992ms |
| Input Handling E2E Input During Streaming should maintain input area visibility during streaming | passed | 2111.234024000001ms |
| Input Handling E2E Multiple Messages should handle multiple sequential messages | failed | 26995.079487ms |
| Input Handling E2E Long Input should handle and submit long input | passed | 3429.1937959999996ms |

#### markdown-rendering.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Markdown Rendering E2E Code Blocks should render code blocks with borders | passed | 1717.814452ms |
| Markdown Rendering E2E Code Blocks should render code blocks with language labels | passed | 1461.159008ms |
| Markdown Rendering E2E Long Content should handle long content scenario | passed | 1711.4105490000006ms |
| Markdown Rendering E2E Empty Response should handle empty response gracefully | passed | 3161.6843150000004ms |

#### slash-commands.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Slash Commands E2E /help command should display available commands | passed | 1114.180641ms |
| Slash Commands E2E /help command should list all slash commands | passed | 1108.3600470000001ms |
| Slash Commands E2E /profile command should display current agent profile | passed | 1258.2834049999997ms |
| Slash Commands E2E /clear command should clear chat history | passed | 2963.092316ms |
| Slash Commands E2E /history command should show message history | passed | 2513.080022ms |
| Slash Commands E2E /memory command should show system prompt | passed | 1808.172982ms |
| Slash Commands E2E /exit command should exit the application | passed | 1106.5428599999996ms |
| Slash Commands E2E /exit command should work with /quit alias | passed | 1105.152044999999ms |
| Slash Commands E2E /exit command should work with /q alias | passed | 1154.6446590000014ms |
| Slash Commands E2E Unknown commands should handle unknown slash commands gracefully | passed | 1606.6491429999987ms |

#### streaming.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Streaming E2E Basic Streaming should stream content progressively | passed | 1669.9711899999998ms |
| Streaming E2E Basic Streaming should handle rapid streaming without flickering | passed | 1465.085194ms |
| Streaming E2E Basic Streaming should handle slow streaming | passed | 1456.9847920000002ms |
| Streaming E2E Tool Calls should display tool call indicators | passed | 1519.9490340000002ms |
| Streaming E2E Tool Calls should show tool completion status | passed | 2715.38778ms |
| Streaming E2E Multi-turn Conversation should maintain context across turns | failed | 27399.656872ms |
| Streaming E2E Multi-turn Conversation should accumulate messages in history | failed | 28209.92028ms |
| Streaming E2E Error Handling should display errors gracefully | passed | 1309.138856000005ms |
| Streaming E2E Error Handling should allow continuing after error | passed | 1813.1888790000085ms |

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
      Tests  [2m [1m[32m191 passed[39m[22m[90m (191)[39m
   Duration  [2m 4.24s[2m (transform 802ms, setup 0ms, collect 3.46s, tests 5.90s, environment 3ms, prepare 1.07s)[22m
```

### E2E Tests
```

──────────────────────────────────────────────────
      Tests  [2m [1m[31m4 failed[39m[22m[2m | [22m[1m[32m48 passed[39m[22m[90m (52)[39m
   Duration  [2m 67.93s[2m (transform 153ms, setup 0ms, collect 350ms, tests 186.01s, environment 1ms, prepare 505ms)[22m
Duration: 67.92s
```

---

## Sign-off

- [ ] All critical tests passed
- [ ] No blocking issues found
- [ ] Ready for release

**Status:** ❌ FAILED
```