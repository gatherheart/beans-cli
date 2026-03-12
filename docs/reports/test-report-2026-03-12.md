# Test Report

**Date:** 2026-03-12T14:54:50.776Z
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
| Agent Profile E2E Default Profile should load default agent profile                    | passed | 1263.741326ms        |
| Agent Profile E2E Default Profile should display profile name on startup               | passed | 807.9561580000002ms  |
| Agent Profile E2E Custom Profile Loading should load profile from --agent-profile flag | passed | 1459.0839960000003ms |
| Agent Profile E2E Profile Commands should show full profile with /profile command      | passed | 1256.8807899999997ms |
| Agent Profile E2E Profile Commands should show system prompt with /memory command      | passed | 2008.4572239999998ms |
| Agent Profile E2E Workspace Context should include workspace info in system prompt     | passed | 1812.9885439999998ms |
| CLI Flags E2E Model Selection should accept --model flag                               | passed | 791.6651619999993ms  |
| CLI Flags E2E Debug Mode should accept --debug flag                                    | passed | 695.6948069999999ms  |
| CLI Flags E2E Yolo Mode should accept --yolo flag                                      | passed | 685.1101859999999ms  |
| CLI Flags E2E List Models should list available models with --list-models              | passed | 973.0619459999998ms  |

#### anti-flicker.test.ts

| Test                                                                                    | Status | Duration             |
| --------------------------------------------------------------------------------------- | ------ | -------------------- |
| Anti-Flicker E2E Terminal Line Wrapping Control should disable line wrapping on startup | passed | 1015.597354ms        |
| Anti-Flicker E2E Terminal Line Wrapping Control should re-enable line wrapping on exit  | passed | 1625.43346ms         |
| Anti-Flicker E2E UI Test Scenarios should render basic scenario without errors          | passed | 1858.7551660000004ms |
| Anti-Flicker E2E UI Test Scenarios should handle rapid-stream scenario                  | passed | 1658.2289730000002ms |
| Anti-Flicker E2E UI Test Scenarios should handle tool-calls scenario                    | passed | 1717.4094620000005ms |
| Anti-Flicker E2E Message Rendering should render user message correctly                 | passed | 1465.8802290000003ms |
| Anti-Flicker E2E Message Rendering should render assistant response correctly           | passed | 1660.7503780000006ms |
| Anti-Flicker E2E Error Handling should handle error scenario gracefully                 | passed | 1506.0820899999999ms |
| Anti-Flicker E2E Static Component Behavior should accumulate multiple messages          | passed | 3363.8430210000006ms |
| CLI Help and Version should show help with --help flag                                  | passed | 634.5002430000004ms  |
| CLI Help and Version should show version with --version flag                            | passed | 875.1970660000006ms  |

#### input-handling.test.ts

| Test                                                                                             | Status | Duration             |
| ------------------------------------------------------------------------------------------------ | ------ | -------------------- |
| Input Handling E2E Basic Input should submit message on Enter and get response                   | passed | 1666.587318ms        |
| Input Handling E2E Basic Input should handle empty input gracefully                              | passed | 1356.776159ms        |
| Input Handling E2E Basic Input should display user input in prompt area                          | passed | 1862.2882919999997ms |
| Input Handling E2E Message Submission should show user message after submission                  | passed | 2011.8058369999999ms |
| Input Handling E2E Message Submission should show assistant response after submission            | passed | 1662.4931379999998ms |
| Input Handling E2E Input During Streaming should maintain input area visibility during streaming | passed | 2306.67469ms         |
| Input Handling E2E Multiple Messages should handle multiple sequential messages                  | passed | 2564.598345999999ms  |
| Input Handling E2E Long Input should handle and submit long input                                | passed | 3828.838328ms        |

#### markdown-rendering.test.ts

| Test                                                                              | Status | Duration             |
| --------------------------------------------------------------------------------- | ------ | -------------------- |
| Markdown Rendering E2E Code Blocks should render code blocks with borders         | passed | 1715.166807ms        |
| Markdown Rendering E2E Code Blocks should render code blocks with language labels | passed | 1256.953923ms        |
| Markdown Rendering E2E Long Content should handle long content scenario           | passed | 1716.1416560000002ms |
| Markdown Rendering E2E Empty Response should handle empty response gracefully     | passed | 3162.5615149999994ms |

#### memory.test.ts

| Test                                                                                            | Status | Duration             |
| ----------------------------------------------------------------------------------------------- | ------ | -------------------- |
| Memory System E2E Project memory (BEANS.md) should load BEANS.md from project root              | passed | 2231.907057ms        |
| Memory System E2E Project memory (BEANS.md) should load BEANS.md from .beans directory          | passed | 1808.6854359999998ms |
| Memory System E2E Project memory (BEANS.md) should merge root and .beans directory memory files | passed | 1810.7625769999995ms |
| Memory System E2E Project memory (BEANS.md) should respect enabled: false in frontmatter        | passed | 3212.0344970000006ms |
| Memory System E2E Memory content in system prompt should inject memory into agent system prompt | passed | 2014.6249989999997ms |
| Memory System E2E No memory file should work without any BEANS.md file                          | passed | 2017.6822950000005ms |

#### slash-commands.test.ts

| Test                                                                                | Status | Duration             |
| ----------------------------------------------------------------------------------- | ------ | -------------------- |
| Slash Commands E2E /help command should display available commands                  | passed | 1314.807766ms        |
| Slash Commands E2E /help command should list all slash commands                     | passed | 1110.0569480000001ms |
| Slash Commands E2E /profile command should display current agent profile            | passed | 1464.044272ms        |
| Slash Commands E2E /clear command should clear chat history                         | passed | 2765.58227ms         |
| Slash Commands E2E /history command should show message history                     | passed | 2320.9052229999998ms |
| Slash Commands E2E /memory command should show system prompt                        | passed | 2010.576692999999ms  |
| Slash Commands E2E /exit command should exit the application                        | passed | 1105.5867279999984ms |
| Slash Commands E2E /exit command should work with /quit alias                       | passed | 1106.3844439999993ms |
| Slash Commands E2E /exit command should work with /q alias                          | passed | 1155.3382120000006ms |
| Slash Commands E2E Unknown commands should handle unknown slash commands gracefully | passed | 1404.5364250000002ms |

#### streaming.test.ts

| Test                                                                           | Status | Duration             |
| ------------------------------------------------------------------------------ | ------ | -------------------- |
| Streaming E2E Basic Streaming should stream content progressively              | passed | 1880.761558ms        |
| Streaming E2E Basic Streaming should handle rapid streaming without flickering | passed | 1656.2210849999997ms |
| Streaming E2E Basic Streaming should handle slow streaming                     | passed | 1459.5400829999999ms |
| Streaming E2E Tool Calls should display tool call indicators                   | passed | 1715.3615339999997ms |
| Streaming E2E Tool Calls should show tool completion status                    | passed | 2514.657364999999ms  |
| Streaming E2E Multi-turn Conversation should maintain context across turns     | passed | 2577.6870369999997ms |
| Streaming E2E Multi-turn Conversation should accumulate messages in history    | passed | 3662.7029619999994ms |
| Streaming E2E Error Handling should display errors gracefully                  | passed | 1510.1401650000007ms |
| Streaming E2E Error Handling should allow continuing after error               | passed | 2209.9270240000005ms |

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
   Duration  [2m 5.23s[2m (transform 969ms, setup 0ms, collect 3.42s, tests 8.24s, environment 4ms, prepare 1.44s)[22m
```

### E2E Tests

```

──────────────────────────────────────────────────
      Tests  [2m [1m[32m58 passed[39m[22m[90m (58)[39m
   Duration  [2m 39.06s[2m (transform 156ms, setup 0ms, collect 408ms, tests 102.30s, environment 2ms, prepare 604ms)[22m
Duration: 39.05s
```

---

## Sign-off

- [x] All critical tests passed
- [x] No blocking issues found
- [x] Ready for release

**Status:** ✅ PASSED
