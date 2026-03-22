# Test Report

**Date:** 2026-03-22T07:03:02.892Z
**Tester:** QA Engineer
**Version:** 0.1.0

---

## Summary

| Metric      | Value            |
| ----------- | ---------------- |
| Total Tests | 58               |
| Passed      | 54               |
| Failed      | 4                |
| Skipped     | 0                |
| Duration    | (see categories) |

## Test Results by File

### Unit Tests

### E2E Tests

#### agent-profile.test.ts

| Test                                                                                   | Status | Duration             |
| -------------------------------------------------------------------------------------- | ------ | -------------------- |
| Agent Profile E2E Default Profile should load default agent profile                    | passed | 1259.613316ms        |
| Agent Profile E2E Default Profile should display profile name on startup               | passed | 602.996891ms         |
| Agent Profile E2E Custom Profile Loading should load profile from --agent-profile flag | passed | 1257.0392479999998ms |
| Agent Profile E2E Profile Commands should show full profile with /profile command      | passed | 1259.0663060000002ms |
| Agent Profile E2E Profile Commands should show system prompt with /memory command      | passed | 1609.0815910000001ms |
| Agent Profile E2E Workspace Context should include workspace info in system prompt     | passed | 1604.3703880000003ms |
| CLI Flags E2E Model Selection should accept --model flag                               | passed | 486.2169069999991ms  |
| CLI Flags E2E Debug Mode should accept --debug flag                                    | passed | 522.6102699999992ms  |
| CLI Flags E2E Yolo Mode should accept --yolo flag                                      | passed | 578.6174309999988ms  |
| CLI Flags E2E List Models should list available models with --list-models              | passed | 734.2295990000002ms  |

#### anti-flicker.test.ts

| Test                                                                                    | Status | Duration             |
| --------------------------------------------------------------------------------------- | ------ | -------------------- |
| Anti-Flicker E2E Terminal Line Wrapping Control should disable line wrapping on startup | passed | 1011.479263ms        |
| Anti-Flicker E2E Terminal Line Wrapping Control should re-enable line wrapping on exit  | passed | 1609.8427000000001ms |
| Anti-Flicker E2E UI Test Scenarios should render basic scenario without errors          | passed | 1658.7796199999998ms |
| Anti-Flicker E2E UI Test Scenarios should handle rapid-stream scenario                  | passed | 1461.7834090000006ms |
| Anti-Flicker E2E UI Test Scenarios should handle tool-calls scenario                    | passed | 1709.6414999999997ms |
| Anti-Flicker E2E Message Rendering should render user message correctly                 | passed | 1467.686726ms        |
| Anti-Flicker E2E Message Rendering should render assistant response correctly           | passed | 1054.8380390000002ms |
| Anti-Flicker E2E Error Handling should handle error scenario gracefully                 | passed | 1307.9376729999985ms |
| Anti-Flicker E2E Static Component Behavior should accumulate multiple messages          | passed | 3166.6998089999997ms |
| CLI Help and Version should show help with --help flag                                  | passed | 499.5003820000002ms  |
| CLI Help and Version should show version with --version flag                            | passed | 507.3148860000001ms  |

#### input-handling.test.ts

| Test                                                                                             | Status | Duration             |
| ------------------------------------------------------------------------------------------------ | ------ | -------------------- |
| Input Handling E2E Basic Input should submit message on Enter and get response                   | passed | 1665.652674ms        |
| Input Handling E2E Basic Input should handle empty input gracefully                              | passed | 1354.8032999999998ms |
| Input Handling E2E Basic Input should display user input in prompt area                          | passed | 1462.1947179999997ms |
| Input Handling E2E Message Submission should show user message after submission                  | passed | 1807.8361320000004ms |
| Input Handling E2E Message Submission should show assistant response after submission            | passed | 1258.554032ms        |
| Input Handling E2E Input During Streaming should maintain input area visibility during streaming | passed | 2106.4342960000004ms |
| Input Handling E2E Multiple Messages should handle multiple sequential messages                  | passed | 2361.6750410000004ms |
| Input Handling E2E Long Input should handle and submit long input                                | passed | 3621.3826879999997ms |

#### markdown-rendering.test.ts

| Test                                                                              | Status | Duration             |
| --------------------------------------------------------------------------------- | ------ | -------------------- |
| Markdown Rendering E2E Code Blocks should render code blocks with borders         | failed | 4935.606228000001ms  |
| Markdown Rendering E2E Code Blocks should render code blocks with language labels | passed | 1462.9376309999998ms |
| Markdown Rendering E2E Long Content should handle long content scenario           | passed | 1708.8644949999998ms |
| Markdown Rendering E2E Empty Response should handle empty response gracefully     | passed | 3356.6693750000013ms |

#### memory.test.ts

| Test                                                                                            | Status | Duration             |
| ----------------------------------------------------------------------------------------------- | ------ | -------------------- |
| Memory System E2E Project memory (BEANS.md) should load BEANS.md from project root              | failed | 33744.836799000004ms |
| Memory System E2E Project memory (BEANS.md) should load BEANS.md from .beans directory          | failed | 33096.479812ms       |
| Memory System E2E Project memory (BEANS.md) should merge root and .beans directory memory files | failed | 33099.04292600001ms  |
| Memory System E2E Project memory (BEANS.md) should respect enabled: false in frontmatter        | passed | 3008.5825360000017ms |
| Memory System E2E Memory content in system prompt should inject memory into agent system prompt | passed | 1407.2192619999987ms |
| Memory System E2E No memory file should work without any BEANS.md file                          | passed | 1406.3183449999924ms |

#### slash-commands.test.ts

| Test                                                                                | Status | Duration             |
| ----------------------------------------------------------------------------------- | ------ | -------------------- |
| Slash Commands E2E /help command should display available commands                  | passed | 912.3596399999999ms  |
| Slash Commands E2E /help command should list all slash commands                     | passed | 905.9164799999999ms  |
| Slash Commands E2E /profile command should display current agent profile            | passed | 1057.0984500000002ms |
| Slash Commands E2E /clear command should clear chat history                         | passed | 2761.8081020000004ms |
| Slash Commands E2E /history command should show message history                     | passed | 2117.2246160000004ms |
| Slash Commands E2E /memory command should show system prompt                        | passed | 1607.0694599999988ms |
| Slash Commands E2E /exit command should exit the application                        | passed | 907.5760869999995ms  |
| Slash Commands E2E /exit command should work with /quit alias                       | passed | 1107.0566070000004ms |
| Slash Commands E2E /exit command should work with /q alias                          | passed | 754.136496000001ms   |
| Slash Commands E2E Unknown commands should handle unknown slash commands gracefully | passed | 1407.622942ms        |

#### streaming.test.ts

| Test                                                                           | Status | Duration             |
| ------------------------------------------------------------------------------ | ------ | -------------------- |
| Streaming E2E Basic Streaming should stream content progressively              | passed | 1673.260504ms        |
| Streaming E2E Basic Streaming should handle rapid streaming without flickering | passed | 1267.8776329999998ms |
| Streaming E2E Basic Streaming should handle slow streaming                     | passed | 1057.713597ms        |
| Streaming E2E Tool Calls should display tool call indicators                   | passed | 1509.5882789999996ms |
| Streaming E2E Tool Calls should show tool completion status                    | passed | 2505.3689289999993ms |
| Streaming E2E Multi-turn Conversation should maintain context across turns     | passed | 2364.878382000001ms  |
| Streaming E2E Multi-turn Conversation should accumulate messages in history    | passed | 3671.1713390000004ms |
| Streaming E2E Error Handling should display errors gracefully                  | passed | 1306.2463929999994ms |
| Streaming E2E Error Handling should allow continuing after error               | passed | 2012.0463440000003ms |

---

## Failed Tests

| Test                                                                                            | Suite                      | Error          |
| ----------------------------------------------------------------------------------------------- | -------------------------- | -------------- |
| Markdown Rendering E2E Code Blocks should render code blocks with borders                       | markdown-rendering.test.ts | See raw output |
| Memory System E2E Project memory (BEANS.md) should load BEANS.md from project root              | memory.test.ts             | See raw output |
| Memory System E2E Project memory (BEANS.md) should load BEANS.md from .beans directory          | memory.test.ts             | See raw output |
| Memory System E2E Project memory (BEANS.md) should merge root and .beans directory memory files | memory.test.ts             | See raw output |

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
      Tests  [2m [1m[32m332 passed[39m[2m[90m (332)[39m
   Duration  [2m 5.38s[2m (transform 1.01s, setup 0ms, collect 3.49s, tests 8.38s, environment 4ms, prepare 1.54s)[2m
```

### E2E Tests

```

──────────────────────────────────────────────────
      Tests  [2m [1m[31m4 failed[39m[1m[2m | [22m[1m[32m54 passed[39m[2m[90m (58)[39m
   Duration  [2m 106.10s[2m (transform 139ms, setup 0ms, collect 358ms, tests 189.16s, environment 1ms, prepare 519ms)[2m
Duration: 106.08s
```

---

## Sign-off

- [ ] All critical tests passed
- [ ] No blocking issues found
- [ ] Ready for release

**Status:** ❌ FAILED
