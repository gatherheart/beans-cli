# Test Report

**Date:** 2026-03-13T00:30:50.348Z
**Tester:** QA Engineer
**Version:** 0.1.0

---

## Summary

| Metric      | Value            |
| ----------- | ---------------- |
| Total Tests | 58               |
| Passed      | 57               |
| Failed      | 1                |
| Skipped     | 0                |
| Duration    | (see categories) |

## Test Results by File

### Unit Tests

### E2E Tests

#### agent-profile.test.ts

| Test                                                                                   | Status | Duration             |
| -------------------------------------------------------------------------------------- | ------ | -------------------- |
| Agent Profile E2E Default Profile should load default agent profile                    | passed | 1261.479372ms        |
| Agent Profile E2E Default Profile should display profile name on startup               | passed | 1006.3463849999998ms |
| Agent Profile E2E Custom Profile Loading should load profile from --agent-profile flag | passed | 1258.9294710000004ms |
| Agent Profile E2E Profile Commands should show full profile with /profile command      | passed | 1254.9987859999997ms |
| Agent Profile E2E Profile Commands should show system prompt with /memory command      | passed | 2015.6871570000003ms |
| Agent Profile E2E Workspace Context should include workspace info in system prompt     | passed | 2008.082375ms        |
| CLI Flags E2E Model Selection should accept --model flag                               | passed | 663.6588419999989ms  |
| CLI Flags E2E Debug Mode should accept --debug flag                                    | passed | 624.0122450000017ms  |
| CLI Flags E2E Yolo Mode should accept --yolo flag                                      | passed | 682.9551049999991ms  |
| CLI Flags E2E List Models should list available models with --list-models              | passed | 1042.0994719999999ms |

#### anti-flicker.test.ts

| Test                                                                                    | Status | Duration             |
| --------------------------------------------------------------------------------------- | ------ | -------------------- |
| Anti-Flicker E2E Terminal Line Wrapping Control should disable line wrapping on startup | passed | 1214.770859ms        |
| Anti-Flicker E2E Terminal Line Wrapping Control should re-enable line wrapping on exit  | passed | 1609.3218570000001ms |
| Anti-Flicker E2E UI Test Scenarios should render basic scenario without errors          | passed | 1657.8884970000004ms |
| Anti-Flicker E2E UI Test Scenarios should handle rapid-stream scenario                  | passed | 1662.9362250000004ms |
| Anti-Flicker E2E UI Test Scenarios should handle tool-calls scenario                    | passed | 1706.7715499999995ms |
| Anti-Flicker E2E Message Rendering should render user message correctly                 | passed | 1473.5505649999996ms |
| Anti-Flicker E2E Message Rendering should render assistant response correctly           | passed | 1463.8339629999991ms |
| Anti-Flicker E2E Error Handling should handle error scenario gracefully                 | passed | 1513.5687669999988ms |
| Anti-Flicker E2E Static Component Behavior should accumulate multiple messages          | passed | 3163.4891929999994ms |
| CLI Help and Version should show help with --help flag                                  | passed | 815.3849050000008ms  |
| CLI Help and Version should show version with --version flag                            | passed | 582.6348849999995ms  |

#### input-handling.test.ts

| Test                                                                                             | Status | Duration             |
| ------------------------------------------------------------------------------------------------ | ------ | -------------------- |
| Input Handling E2E Basic Input should submit message on Enter and get response                   | passed | 1668.8791039999999ms |
| Input Handling E2E Basic Input should handle empty input gracefully                              | passed | 1557.946551ms        |
| Input Handling E2E Basic Input should display user input in prompt area                          | passed | 1864.742331ms        |
| Input Handling E2E Message Submission should show user message after submission                  | passed | 2018.5808699999998ms |
| Input Handling E2E Message Submission should show assistant response after submission            | passed | 1665.2054930000004ms |
| Input Handling E2E Input During Streaming should maintain input area visibility during streaming | passed | 2107.9990479999997ms |
| Input Handling E2E Multiple Messages should handle multiple sequential messages                  | passed | 2561.1182389999994ms |
| Input Handling E2E Long Input should handle and submit long input                                | passed | 3834.1107859999993ms |

#### markdown-rendering.test.ts

| Test                                                                              | Status | Duration             |
| --------------------------------------------------------------------------------- | ------ | -------------------- |
| Markdown Rendering E2E Code Blocks should render code blocks with borders         | failed | 4343.479353ms        |
| Markdown Rendering E2E Code Blocks should render code blocks with language labels | passed | 1056.6780500000004ms |
| Markdown Rendering E2E Long Content should handle long content scenario           | passed | 1712.5677719999994ms |
| Markdown Rendering E2E Empty Response should handle empty response gracefully     | passed | 3161.2654039999998ms |

#### memory.test.ts

| Test                                                                                            | Status | Duration             |
| ----------------------------------------------------------------------------------------------- | ------ | -------------------- |
| Memory System E2E Project memory (BEANS.md) should load BEANS.md from project root              | passed | 2231.7833170000004ms |
| Memory System E2E Project memory (BEANS.md) should load BEANS.md from .beans directory          | passed | 1811.2154959999998ms |
| Memory System E2E Project memory (BEANS.md) should merge root and .beans directory memory files | passed | 1812.3487950000008ms |
| Memory System E2E Project memory (BEANS.md) should respect enabled: false in frontmatter        | passed | 3409.107766ms        |
| Memory System E2E Memory content in system prompt should inject memory into agent system prompt | passed | 2022.9187540000003ms |
| Memory System E2E No memory file should work without any BEANS.md file                          | passed | 2011.7513360000012ms |

#### slash-commands.test.ts

| Test                                                                                | Status | Duration             |
| ----------------------------------------------------------------------------------- | ------ | -------------------- |
| Slash Commands E2E /help command should display available commands                  | passed | 1313.980126ms        |
| Slash Commands E2E /help command should list all slash commands                     | passed | 1109.9990580000003ms |
| Slash Commands E2E /profile command should display current agent profile            | passed | 1259.0673460000003ms |
| Slash Commands E2E /clear command should clear chat history                         | passed | 2964.1102480000004ms |
| Slash Commands E2E /history command should show message history                     | passed | 2113.5015189999995ms |
| Slash Commands E2E /memory command should show system prompt                        | passed | 2014.9777419999991ms |
| Slash Commands E2E /exit command should exit the application                        | passed | 1306.9456289999998ms |
| Slash Commands E2E /exit command should work with /quit alias                       | passed | 1106.1264190000002ms |
| Slash Commands E2E /exit command should work with /q alias                          | passed | 1157.939061000001ms  |
| Slash Commands E2E Unknown commands should handle unknown slash commands gracefully | passed | 1608.2641999999996ms |

#### streaming.test.ts

| Test                                                                           | Status | Duration             |
| ------------------------------------------------------------------------------ | ------ | -------------------- |
| Streaming E2E Basic Streaming should stream content progressively              | passed | 1686.483713ms        |
| Streaming E2E Basic Streaming should handle rapid streaming without flickering | passed | 1668.4092979999998ms |
| Streaming E2E Basic Streaming should handle slow streaming                     | passed | 1458.0927340000003ms |
| Streaming E2E Tool Calls should display tool call indicators                   | passed | 1508.9352479999998ms |
| Streaming E2E Tool Calls should show tool completion status                    | passed | 2718.2988650000007ms |
| Streaming E2E Multi-turn Conversation should maintain context across turns     | passed | 2565.9623090000005ms |
| Streaming E2E Multi-turn Conversation should accumulate messages in history    | passed | 3669.684899ms        |
| Streaming E2E Error Handling should display errors gracefully                  | passed | 1707.0394169999981ms |
| Streaming E2E Error Handling should allow continuing after error               | passed | 2216.167031000001ms  |

---

## Failed Tests

| Test                                                                      | Suite                      | Error          |
| ------------------------------------------------------------------------- | -------------------------- | -------------- |
| Markdown Rendering E2E Code Blocks should render code blocks with borders | markdown-rendering.test.ts | See raw output |

---

## Environment

| Property       | Value     |
| -------------- | --------- |
| Node.js        | v20.20.1  |
| OS             | linux x64 |
| Version        | 0.1.0     |
| Test Framework | Vitest    |

---

## Raw Test Output

### Unit Tests

```

──────────────────────────────────────────────────
      Tests  [22m [1m[32m313 passed[39m[22m[90m (313)[39m
   Duration  [22m 5.51s[2m (transform 1.16s, setup 0ms, collect 3.84s, tests 8.43s, environment 4ms, prepare 1.53s)[22m
```

### E2E Tests

```

──────────────────────────────────────────────────
      Tests  [22m [1m[31m1 failed[39m[22m[2m | [22m[1m[32m57 passed[39m[22m[90m (58)[39m
   Duration  [22m 41.70s[2m (transform 145ms, setup 0ms, collect 401ms, tests 104.70s, environment 2ms, prepare 639ms)[22m
Duration: 41.69s
```

---

## Sign-off

- [ ] All critical tests passed
- [ ] No blocking issues found
- [ ] Ready for release

**Status:** ❌ FAILED
