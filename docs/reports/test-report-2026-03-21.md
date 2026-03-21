# Test Report

**Date:** 2026-03-21T07:09:22.977Z
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
| Agent Profile E2E Default Profile should load default agent profile                    | passed | 1464.4819479999999ms |
| Agent Profile E2E Default Profile should display profile name on startup               | passed | 811.6686099999997ms  |
| Agent Profile E2E Custom Profile Loading should load profile from --agent-profile flag | passed | 1463.3236809999999ms |
| Agent Profile E2E Profile Commands should show full profile with /profile command      | passed | 1056.2387180000005ms |
| Agent Profile E2E Profile Commands should show system prompt with /memory command      | passed | 2013.6619020000007ms |
| Agent Profile E2E Workspace Context should include workspace info in system prompt     | passed | 2013.0098239999998ms |
| CLI Flags E2E Model Selection should accept --model flag                               | passed | 748.3721790000018ms  |
| CLI Flags E2E Debug Mode should accept --debug flag                                    | passed | 670.525443999999ms   |
| CLI Flags E2E Yolo Mode should accept --yolo flag                                      | passed | 731.6678400000001ms  |
| CLI Flags E2E List Models should list available models with --list-models              | passed | 1112.6567309999991ms |

#### anti-flicker.test.ts

| Test                                                                                    | Status | Duration             |
| --------------------------------------------------------------------------------------- | ------ | -------------------- |
| Anti-Flicker E2E Terminal Line Wrapping Control should disable line wrapping on startup | passed | 1219.709179ms        |
| Anti-Flicker E2E Terminal Line Wrapping Control should re-enable line wrapping on exit  | passed | 1606.8793349999999ms |
| Anti-Flicker E2E UI Test Scenarios should render basic scenario without errors          | passed | 1862.226631ms        |
| Anti-Flicker E2E UI Test Scenarios should handle rapid-stream scenario                  | passed | 1664.6291649999994ms |
| Anti-Flicker E2E UI Test Scenarios should handle tool-calls scenario                    | passed | 1719.5422259999996ms |
| Anti-Flicker E2E Message Rendering should render user message correctly                 | passed | 1459.2004399999987ms |
| Anti-Flicker E2E Message Rendering should render assistant response correctly           | passed | 1656.256976999999ms  |
| Anti-Flicker E2E Error Handling should handle error scenario gracefully                 | passed | 1707.2516560000004ms |
| Anti-Flicker E2E Static Component Behavior should accumulate multiple messages          | passed | 3566.4582009999995ms |
| CLI Help and Version should show help with --help flag                                  | passed | 774.3185269999994ms  |
| CLI Help and Version should show version with --version flag                            | passed | 685.374194ms         |

#### input-handling.test.ts

| Test                                                                                             | Status | Duration             |
| ------------------------------------------------------------------------------------------------ | ------ | -------------------- |
| Input Handling E2E Basic Input should submit message on Enter and get response                   | passed | 1669.1836600000001ms |
| Input Handling E2E Basic Input should handle empty input gracefully                              | passed | 1356.4880669999998ms |
| Input Handling E2E Basic Input should display user input in prompt area                          | passed | 1656.9444419999995ms |
| Input Handling E2E Message Submission should show user message after submission                  | passed | 2213.9876990000002ms |
| Input Handling E2E Message Submission should show assistant response after submission            | passed | 1657.4332759999998ms |
| Input Handling E2E Input During Streaming should maintain input area visibility during streaming | passed | 2314.166578999999ms  |
| Input Handling E2E Multiple Messages should handle multiple sequential messages                  | passed | 2561.10289ms         |
| Input Handling E2E Long Input should handle and submit long input                                | passed | 3829.614334ms        |

#### markdown-rendering.test.ts

| Test                                                                              | Status | Duration             |
| --------------------------------------------------------------------------------- | ------ | -------------------- |
| Markdown Rendering E2E Code Blocks should render code blocks with borders         | failed | 4558.46452ms         |
| Markdown Rendering E2E Code Blocks should render code blocks with language labels | passed | 1055.3184270000002ms |
| Markdown Rendering E2E Long Content should handle long content scenario           | passed | 1717.0224520000002ms |
| Markdown Rendering E2E Empty Response should handle empty response gracefully     | passed | 3158.208837ms        |

#### memory.test.ts

| Test                                                                                            | Status | Duration             |
| ----------------------------------------------------------------------------------------------- | ------ | -------------------- |
| Memory System E2E Project memory (BEANS.md) should load BEANS.md from project root              | passed | 2230.984372ms        |
| Memory System E2E Project memory (BEANS.md) should load BEANS.md from .beans directory          | passed | 1810.2855059999997ms |
| Memory System E2E Project memory (BEANS.md) should merge root and .beans directory memory files | passed | 1810.7229580000003ms |
| Memory System E2E Project memory (BEANS.md) should respect enabled: false in frontmatter        | passed | 3212.745734ms        |
| Memory System E2E Memory content in system prompt should inject memory into agent system prompt | passed | 2220.297340000001ms  |
| Memory System E2E No memory file should work without any BEANS.md file                          | passed | 2012.7437310000005ms |

#### slash-commands.test.ts

| Test                                                                                | Status | Duration             |
| ----------------------------------------------------------------------------------- | ------ | -------------------- |
| Slash Commands E2E /help command should display available commands                  | passed | 1117.772444ms        |
| Slash Commands E2E /help command should list all slash commands                     | passed | 1108.243019ms        |
| Slash Commands E2E /profile command should display current agent profile            | passed | 1460.638078ms        |
| Slash Commands E2E /clear command should clear chat history                         | passed | 2765.1952779999997ms |
| Slash Commands E2E /history command should show message history                     | passed | 2516.7696859999996ms |
| Slash Commands E2E /memory command should show system prompt                        | passed | 2009.7925649999997ms |
| Slash Commands E2E /exit command should exit the application                        | passed | 1110.127257ms        |
| Slash Commands E2E /exit command should work with /quit alias                       | passed | 1306.7775939999992ms |
| Slash Commands E2E /exit command should work with /q alias                          | passed | 1156.217299ms        |
| Slash Commands E2E Unknown commands should handle unknown slash commands gracefully | passed | 1610.7237729999997ms |

#### streaming.test.ts

| Test                                                                           | Status | Duration             |
| ------------------------------------------------------------------------------ | ------ | -------------------- |
| Streaming E2E Basic Streaming should stream content progressively              | passed | 1871.6579600000002ms |
| Streaming E2E Basic Streaming should handle rapid streaming without flickering | passed | 1666.4983220000004ms |
| Streaming E2E Basic Streaming should handle slow streaming                     | passed | 1456.7425200000002ms |
| Streaming E2E Tool Calls should display tool call indicators                   | passed | 1714.7281989999992ms |
| Streaming E2E Tool Calls should show tool completion status                    | passed | 2711.897091ms        |
| Streaming E2E Multi-turn Conversation should maintain context across turns     | passed | 2765.0742219999993ms |
| Streaming E2E Multi-turn Conversation should accumulate messages in history    | passed | 3876.321303999999ms  |
| Streaming E2E Error Handling should display errors gracefully                  | passed | 1506.1668929999978ms |
| Streaming E2E Error Handling should allow continuing after error               | passed | 2213.0885070000004ms |

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
      Tests  [2m [1m[32m313 passed[39m[22m[90m (313)[39m
   Duration  [2m 5.39s[2m (transform 1.02s, setup 0ms, collect 3.59s, tests 8.30s, environment 4ms, prepare 1.48s)[22m
```

### E2E Tests

```

──────────────────────────────────────────────────
      Tests  [2m [22m[1m[31m1 failed[39m[22m[2m | [22m[1m[32m57 passed[39m[22m[90m (58)[39m
   Duration  [2m 42.02s[2m (transform 157ms, setup 0ms, collect 412ms, tests 107.02s, environment 2ms, prepare 622ms)[22m
Duration: 42.01s
```

---

## Sign-off

- [ ] All critical tests passed
- [ ] No blocking issues found
- [ ] Ready for release

**Status:** ❌ FAILED
