```markdown
# Test Report

**Date:** 2026-02-14T06:16:24.721Z
**Tester:** QA Engineer
**Version:** 0.1.0

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | 52 |
| Passed | 50 |
| Failed | 2 |
| Skipped | 0 |
| Duration | (see categories) |

## Test Results by File

### Unit Tests

### E2E Tests

#### agent-profile.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Agent Profile E2E Default Profile should load default agent profile | passed | 1195.4131009999999ms |
| Agent Profile E2E Default Profile should display profile name on startup | passed | 807.542203ms |
| Agent Profile E2E Custom Profile Loading should load profile from --agent-profile flag | passed | 1086.770979ms |
| Agent Profile E2E Profile Commands should show full profile with /profile command | passed | 889.6609280000002ms |
| Agent Profile E2E Profile Commands should show system prompt with /memory command | failed | 6314.5768530000005ms |
| Agent Profile E2E Workspace Context should include workspace info in system prompt | passed | 1177.1305080000002ms |
| CLI Flags E2E Model Selection should accept --model flag | passed | 510.39645700000074ms |
| CLI Flags E2E Debug Mode should accept --debug flag | passed | 522.8350250000003ms |
| CLI Flags E2E Yolo Mode should accept --yolo flag | passed | 512.4879650000003ms |
| CLI Flags E2E List Models should list available models with --list-models | passed | 695.4885859999995ms |

#### anti-flicker.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Anti-Flicker E2E Terminal Line Wrapping Control should disable line wrapping on startup | passed | 1114.898815ms |
| Anti-Flicker E2E Terminal Line Wrapping Control should re-enable line wrapping on exit | failed | 9178.072633ms |
| Anti-Flicker E2E UI Test Scenarios should render basic scenario without errors | passed | 1181.9436490000007ms |
| Anti-Flicker E2E UI Test Scenarios should handle rapid-stream scenario | passed | 911.8352059999997ms |
| Anti-Flicker E2E UI Test Scenarios should handle tool-calls scenario | passed | 1620.1323840000005ms |
| Anti-Flicker E2E Message Rendering should render user message correctly | passed | 1117.6447970000008ms |
| Anti-Flicker E2E Message Rendering should render assistant response correctly | passed | 1211.683148ms |
| Anti-Flicker E2E Error Handling should handle error scenario gracefully | passed | 1201.039829999998ms |
| Anti-Flicker E2E Static Component Behavior should accumulate multiple messages | passed | 2508.839394999999ms |
| CLI Help and Version should show help with --help flag | passed | 1069.677724000001ms |
| CLI Help and Version should show version with --version flag | passed | 766.6727009999995ms |

#### input-handling.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Input Handling E2E Basic Input should submit message on Enter and get response | passed | 1292.2692109999998ms |
| Input Handling E2E Basic Input should handle empty input gracefully | passed | 1531.7644870000001ms |
| Input Handling E2E Basic Input should display user input in prompt area | passed | 1236.536024ms |
| Input Handling E2E Message Submission should show user message after submission | passed | 1237.9446990000006ms |
| Input Handling E2E Message Submission should show assistant response after submission | passed | 1005.9009219999998ms |
| Input Handling E2E Input During Streaming should maintain input area visibility during streaming | passed | 1826.3617400000003ms |
| Input Handling E2E Multiple Messages should handle multiple sequential messages | passed | 1876.2354880000003ms |
| Input Handling E2E Long Input should handle and submit long input | passed | 1986.535339ms |

#### markdown-rendering.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Markdown Rendering E2E Code Blocks should render code blocks with borders | passed | 1016.117035ms |
| Markdown Rendering E2E Code Blocks should render code blocks with language labels | passed | 1012.6209930000002ms |
| Markdown Rendering E2E Long Content should handle long content scenario | passed | 1059.4290569999998ms |
| Markdown Rendering E2E Empty Response should handle empty response gracefully | passed | 2834.5906390000005ms |

#### slash-commands.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Slash Commands E2E /help command should display available commands | passed | 1235.945672ms |
| Slash Commands E2E /help command should list all slash commands | passed | 1134.9885319999999ms |
| Slash Commands E2E /profile command should display current agent profile | passed | 991.8673290000002ms |
| Slash Commands E2E /clear command should clear chat history | passed | 2143.334649ms |
| Slash Commands E2E /history command should show message history | passed | 1568.828031ms |
| Slash Commands E2E /memory command should show system prompt | passed | 976.7166390000002ms |
| Slash Commands E2E /exit command should exit the application | passed | 1340.0427980000004ms |
| Slash Commands E2E /exit command should work with /quit alias | passed | 928.1842099999994ms |
| Slash Commands E2E /exit command should work with /q alias | passed | 773.5986219999995ms |
| Slash Commands E2E Unknown commands should handle unknown slash commands gracefully | passed | 1032.3205129999988ms |

#### streaming.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Streaming E2E Basic Streaming should stream content progressively | passed | 1325.108496ms |
| Streaming E2E Basic Streaming should handle rapid streaming without flickering | passed | 1211.243847ms |
| Streaming E2E Basic Streaming should handle slow streaming | passed | 1407.7084569999997ms |
| Streaming E2E Tool Calls should display tool call indicators | passed | 1413.9003140000004ms |
| Streaming E2E Tool Calls should show tool completion status | passed | 2420.6785259999997ms |
| Streaming E2E Multi-turn Conversation should maintain context across turns | passed | 1885.49975ms |
| Streaming E2E Multi-turn Conversation should accumulate messages in history | passed | 2697.2275090000003ms |
| Streaming E2E Error Handling should display errors gracefully | passed | 1297.9446420000004ms |
| Streaming E2E Error Handling should allow continuing after error | passed | 1803.6462779999983ms |

---

## Failed Tests

| Test | Suite | Error |
|------|-------|-------|
| Agent Profile E2E Profile Commands should show system prompt with /memory command | agent-profile.test.ts | See raw output |
| Anti-Flicker E2E Terminal Line Wrapping Control should re-enable line wrapping on exit | anti-flicker.test.ts | See raw output |

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
      Tests  [22m [1m[32m136 passed[39m[22m[90m (136)[39m
   Duration  [22m 4.09s[2m (transform 647ms, setup 0ms, collect 3.43s, tests 5.87s, environment 5ms, prepare 870ms)[22m
```

### E2E Tests
```

──────────────────────────────────────────────────
      Tests  [22m [1m[31m2 failed[39m[22m[2m | [22m[1m[32m50 passed[39m[22m[90m (52)[39m
   Duration  [22m 29.88s[2m (transform 162ms, setup 0ms, collect 438ms, tests 81.12s, environment 2ms, prepare 563ms)[22m
Duration: 29.86s
```

---

## Sign-off

- [ ] All critical tests passed
- [ ] No blocking issues found
- [ ] Ready for release

**Status:** ❌ FAILED
```