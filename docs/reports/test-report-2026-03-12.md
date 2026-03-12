# Test Report

**Date:** 2026-03-12T15:20:51.422Z
**Tester:** QA Engineer
**Version:** 0.1.0

---

## Summary

| Metric      | Value            |
| ----------- | ---------------- |
| Total Tests | 58               |
| Passed      | 58               |
| Failed      | 0                |
| Skipped     | 0                |
| Duration    | (see categories) |

## Test Results by File

### Unit Tests

### E2E Tests

#### agent-profile.test.ts

| Test                                                                                   | Status | Duration             |
| -------------------------------------------------------------------------------------- | ------ | -------------------- |
| Agent Profile E2E Default Profile should load default agent profile                    | passed | 1268.0792940000001ms |
| Agent Profile E2E Default Profile should display profile name on startup               | passed | 807.676655ms         |
| Agent Profile E2E Custom Profile Loading should load profile from --agent-profile flag | passed | 1659.249416ms        |
| Agent Profile E2E Profile Commands should show full profile with /profile command      | passed | 1254.528984ms        |
| Agent Profile E2E Profile Commands should show system prompt with /memory command      | passed | 2014.5965190000006ms |
| Agent Profile E2E Workspace Context should include workspace info in system prompt     | passed | 2010.5227610000002ms |
| CLI Flags E2E Model Selection should accept --model flag                               | passed | 767.12853ms          |
| CLI Flags E2E Debug Mode should accept --debug flag                                    | passed | 665.7680049999999ms  |
| CLI Flags E2E Yolo Mode should accept --yolo flag                                      | passed | 788.5583019999995ms  |
| CLI Flags E2E List Models should list available models with --list-models              | passed | 1047.4126209999995ms |

#### anti-flicker.test.ts

| Test                                                                                    | Status | Duration             |
| --------------------------------------------------------------------------------------- | ------ | -------------------- |
| Anti-Flicker E2E Terminal Line Wrapping Control should disable line wrapping on startup | passed | 1218.9162279999998ms |
| Anti-Flicker E2E Terminal Line Wrapping Control should re-enable line wrapping on exit  | passed | 1605.719724ms        |
| Anti-Flicker E2E UI Test Scenarios should render basic scenario without errors          | passed | 1860.161838ms        |
| Anti-Flicker E2E UI Test Scenarios should handle rapid-stream scenario                  | passed | 1658.6203770000002ms |
| Anti-Flicker E2E UI Test Scenarios should handle tool-calls scenario                    | passed | 1715.6964179999995ms |
| Anti-Flicker E2E Message Rendering should render user message correctly                 | passed | 1480.960783999999ms  |
| Anti-Flicker E2E Message Rendering should render assistant response correctly           | passed | 1664.2852939999993ms |
| Anti-Flicker E2E Error Handling should handle error scenario gracefully                 | passed | 1511.6716210000013ms |
| Anti-Flicker E2E Static Component Behavior should accumulate multiple messages          | passed | 3365.321684999999ms  |
| CLI Help and Version should show help with --help flag                                  | passed | 676.5961239999997ms  |
| CLI Help and Version should show version with --version flag                            | passed | 715.9016479999991ms  |

#### input-handling.test.ts

| Test                                                                                             | Status | Duration             |
| ------------------------------------------------------------------------------------------------ | ------ | -------------------- |
| Input Handling E2E Basic Input should submit message on Enter and get response                   | passed | 1666.726071ms        |
| Input Handling E2E Basic Input should handle empty input gracefully                              | passed | 1357.7018079999998ms |
| Input Handling E2E Basic Input should display user input in prompt area                          | passed | 1662.5837539999998ms |
| Input Handling E2E Message Submission should show user message after submission                  | passed | 2011.3485890000002ms |
| Input Handling E2E Message Submission should show assistant response after submission            | passed | 1460.6334180000003ms |
| Input Handling E2E Input During Streaming should maintain input area visibility during streaming | passed | 2513.0390850000003ms |
| Input Handling E2E Multiple Messages should handle multiple sequential messages                  | passed | 2363.8203780000003ms |
| Input Handling E2E Long Input should handle and submit long input                                | passed | 3828.934574000001ms  |

#### markdown-rendering.test.ts

| Test                                                                              | Status | Duration             |
| --------------------------------------------------------------------------------- | ------ | -------------------- |
| Markdown Rendering E2E Code Blocks should render code blocks with borders         | passed | 1714.014856ms        |
| Markdown Rendering E2E Code Blocks should render code blocks with language labels | passed | 1256.244487ms        |
| Markdown Rendering E2E Long Content should handle long content scenario           | passed | 1916.1423089999998ms |
| Markdown Rendering E2E Empty Response should handle empty response gracefully     | passed | 3157.896374ms        |

#### memory.test.ts

| Test                                                                                            | Status | Duration             |
| ----------------------------------------------------------------------------------------------- | ------ | -------------------- |
| Memory System E2E Project memory (BEANS.md) should load BEANS.md from project root              | passed | 2229.177186ms        |
| Memory System E2E Project memory (BEANS.md) should load BEANS.md from .beans directory          | passed | 1813.3433910000003ms |
| Memory System E2E Project memory (BEANS.md) should merge root and .beans directory memory files | passed | 1814.4848869999996ms |
| Memory System E2E Project memory (BEANS.md) should respect enabled: false in frontmatter        | passed | 3209.8485070000006ms |
| Memory System E2E Memory content in system prompt should inject memory into agent system prompt | passed | 2223.8492129999995ms |
| Memory System E2E No memory file should work without any BEANS.md file                          | passed | 1810.0714930000013ms |

#### slash-commands.test.ts

| Test                                                                                | Status | Duration             |
| ----------------------------------------------------------------------------------- | ------ | -------------------- |
| Slash Commands E2E /help command should display available commands                  | passed | 1111.646864ms        |
| Slash Commands E2E /help command should list all slash commands                     | passed | 1310.3480759999998ms |
| Slash Commands E2E /profile command should display current agent profile            | passed | 1460.4778069999998ms |
| Slash Commands E2E /clear command should clear chat history                         | passed | 2969.727608ms        |
| Slash Commands E2E /history command should show message history                     | passed | 2321.8716639999993ms |
| Slash Commands E2E /memory command should show system prompt                        | passed | 2016.9240520000003ms |
| Slash Commands E2E /exit command should exit the application                        | passed | 1106.8231290000003ms |
| Slash Commands E2E /exit command should work with /quit alias                       | passed | 1509.0741979999984ms |
| Slash Commands E2E /exit command should work with /q alias                          | passed | 954.848519000001ms   |
| Slash Commands E2E Unknown commands should handle unknown slash commands gracefully | passed | 1611.8539419999997ms |

#### streaming.test.ts

| Test                                                                           | Status | Duration             |
| ------------------------------------------------------------------------------ | ------ | -------------------- |
| Streaming E2E Basic Streaming should stream content progressively              | passed | 1874.932287ms        |
| Streaming E2E Basic Streaming should handle rapid streaming without flickering | passed | 1661.9800260000002ms |
| Streaming E2E Basic Streaming should handle slow streaming                     | passed | 1461.1616940000004ms |
| Streaming E2E Tool Calls should display tool call indicators                   | passed | 1712.5953950000003ms |
| Streaming E2E Tool Calls should show tool completion status                    | passed | 2716.703860999999ms  |
| Streaming E2E Multi-turn Conversation should maintain context across turns     | passed | 2567.7205139999987ms |
| Streaming E2E Multi-turn Conversation should accumulate messages in history    | passed | 3669.796909999999ms  |
| Streaming E2E Error Handling should display errors gracefully                  | passed | 1511.1089790000005ms |
| Streaming E2E Error Handling should allow continuing after error               | passed | 2014.297674999998ms  |

---

## Failed Tests

No failed tests.

---

## Environment

| Property       | Value     |
| -------------- | --------- |
| Node.js        | v20.20.0  |
| OS             | linux x64 |
| Version        | 0.1.0     |
| Test Framework | Vitest    |

---

## Raw Test Output

### Unit Tests

```

──────────────────────────────────────────────────
      Tests  [2m [1m[32m313 passed[39m[22m[90m (313)[39m
   Duration  [2m 5.46s[2m (transform 1.06s, setup 0ms, collect 3.71s, tests 8.36s, environment 4ms, prepare 1.50s)[22m
```

### E2E Tests

```

──────────────────────────────────────────────────
      Tests  [2m [1m[32m58 passed[39m[22m[90m (58)[39m
   Duration  [2m 38.98s[2m (transform 156ms, setup 0ms, collect 388ms, tests 103.35s, environment 2ms, prepare 651ms)[22m
Duration: 38.96s
```

---

## Sign-off

- [x] All critical tests passed
- [x] No blocking issues found
- [x] Ready for release

**Status:** ✅ PASSED
