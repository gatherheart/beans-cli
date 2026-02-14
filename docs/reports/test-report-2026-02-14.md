```markdown
# Test Report

**Date:** 2026-02-14T06:48:15.705Z
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
| Agent Profile E2E Default Profile should load default agent profile | passed | 1100.9748800000002ms |
| Agent Profile E2E Default Profile should display profile name on startup | passed | 916.717932ms |
| Agent Profile E2E Custom Profile Loading should load profile from --agent-profile flag | passed | 1195.4668539999998ms |
| Agent Profile E2E Profile Commands should show full profile with /profile command | passed | 1196.9999789999997ms |
| Agent Profile E2E Profile Commands should show system prompt with /memory command | passed | 1681.5576700000001ms |
| Agent Profile E2E Workspace Context should include workspace info in system prompt | passed | 1371.3807640000005ms |
| CLI Flags E2E Model Selection should accept --model flag | passed | 666.7905449999998ms |
| CLI Flags E2E Debug Mode should accept --debug flag | passed | 628.0872230000004ms |
| CLI Flags E2E Yolo Mode should accept --yolo flag | passed | 666.0595059999996ms |
| CLI Flags E2E List Models should list available models with --list-models | passed | 791.5996610000002ms |

#### anti-flicker.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Anti-Flicker E2E Terminal Line Wrapping Control should disable line wrapping on startup | passed | 1018.8189699999999ms |
| Anti-Flicker E2E Terminal Line Wrapping Control should re-enable line wrapping on exit | failed | 11092.091731ms |
| Anti-Flicker E2E UI Test Scenarios should render basic scenario without errors | passed | 1383.0655289999995ms |
| Anti-Flicker E2E UI Test Scenarios should handle rapid-stream scenario | passed | 1217.1763200000005ms |
| Anti-Flicker E2E UI Test Scenarios should handle tool-calls scenario | passed | 1511.3455829999984ms |
| Anti-Flicker E2E Message Rendering should render user message correctly | passed | 1317.1431329999978ms |
| Anti-Flicker E2E Message Rendering should render assistant response correctly | passed | 1314.5312720000002ms |
| Anti-Flicker E2E Error Handling should handle error scenario gracefully | passed | 1194.6412920000002ms |
| Anti-Flicker E2E Static Component Behavior should accumulate multiple messages | passed | 2398.449891999997ms |
| CLI Help and Version should show help with --help flag | passed | 730.5454900000004ms |
| CLI Help and Version should show version with --version flag | passed | 685.7677010000007ms |

#### input-handling.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Input Handling E2E Basic Input should submit message on Enter and get response | passed | 1582.43784ms |
| Input Handling E2E Basic Input should handle empty input gracefully | passed | 1532.4306810000003ms |
| Input Handling E2E Basic Input should display user input in prompt area | passed | 1227.2092109999999ms |
| Input Handling E2E Message Submission should show user message after submission | passed | 1230.5851840000005ms |
| Input Handling E2E Message Submission should show assistant response after submission | passed | 911.1933300000001ms |
| Input Handling E2E Input During Streaming should maintain input area visibility during streaming | passed | 1927.8330939999996ms |
| Input Handling E2E Multiple Messages should handle multiple sequential messages | passed | 1773.1329829999995ms |
| Input Handling E2E Long Input should handle and submit long input | passed | 1790.8985670000002ms |

#### markdown-rendering.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Markdown Rendering E2E Code Blocks should render code blocks with borders | passed | 1114.271677ms |
| Markdown Rendering E2E Code Blocks should render code blocks with language labels | passed | 812.0580980000002ms |
| Markdown Rendering E2E Long Content should handle long content scenario | passed | 1063.4553769999998ms |
| Markdown Rendering E2E Empty Response should handle empty response gracefully | passed | 2833.4409ms |

#### slash-commands.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Slash Commands E2E /help command should display available commands | passed | 1145.735465ms |
| Slash Commands E2E /help command should list all slash commands | passed | 1234.649615ms |
| Slash Commands E2E /profile command should display current agent profile | passed | 1096.2502600000003ms |
| Slash Commands E2E /clear command should clear chat history | passed | 1943.389955ms |
| Slash Commands E2E /history command should show message history | passed | 1470.87025ms |
| Slash Commands E2E /memory command should show system prompt | failed | 11152.954662ms |
| Slash Commands E2E /exit command should exit the application | passed | 744.7147019999975ms |
| Slash Commands E2E /exit command should work with /quit alias | passed | 728.9007290000009ms |
| Slash Commands E2E /exit command should work with /q alias | passed | 666.6176080000005ms |
| Slash Commands E2E Unknown commands should handle unknown slash commands gracefully | passed | 938.1070230000005ms |

#### streaming.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Streaming E2E Basic Streaming should stream content progressively | passed | 1228.3261579999999ms |
| Streaming E2E Basic Streaming should handle rapid streaming without flickering | passed | 1206.690436ms |
| Streaming E2E Basic Streaming should handle slow streaming | passed | 1418.4272409999999ms |
| Streaming E2E Tool Calls should display tool call indicators | passed | 1414.0697959999998ms |
| Streaming E2E Tool Calls should show tool completion status | passed | 2312.905742ms |
| Streaming E2E Multi-turn Conversation should maintain context across turns | passed | 1773.987047999999ms |
| Streaming E2E Multi-turn Conversation should accumulate messages in history | passed | 2603.572787000001ms |
| Streaming E2E Error Handling should display errors gracefully | passed | 1295.6040200000007ms |
| Streaming E2E Error Handling should allow continuing after error | passed | 1694.4596870000005ms |

---

## Failed Tests

| Test | Suite | Error |
|------|-------|-------|
| Anti-Flicker E2E Terminal Line Wrapping Control should re-enable line wrapping on exit | anti-flicker.test.ts | See raw output |
| Slash Commands E2E /memory command should show system prompt | slash-commands.test.ts | See raw output |

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
   Duration  [22m 4.00s[22m (transform 589ms, setup 0ms, collect 3.16s, tests 5.79s, environment 2ms, prepare 854ms)[22m
```

### E2E Tests
```

──────────────────────────────────────────────────
      Tests  [22m [1m[31m2 failed[39m[22m[2m | [22m[1m[32m50 passed[39m[22m[90m (52)[39m
   Duration  [22m 33.78s[22m (transform 165ms, setup 0ms, collect 404ms, tests 87.96s, environment 1ms, prepare 532ms)[22m
Duration: 33.77s
```

---

## Sign-off

- [ ] All critical tests passed
- [ ] No blocking issues found
- [ ] Ready for release

**Status:** ❌ FAILED
```