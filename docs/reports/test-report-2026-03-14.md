# Test Report

**Date:** 2026-03-14T07:29:09.151Z
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
| Agent Profile E2E Default Profile should load default agent profile                    | passed | 1468.03503ms         |
| Agent Profile E2E Default Profile should display profile name on startup               | passed | 1005.4246740000001ms |
| Agent Profile E2E Custom Profile Loading should load profile from --agent-profile flag | passed | 1257.5556060000004ms |
| Agent Profile E2E Profile Commands should show full profile with /profile command      | passed | 1259.2578899999999ms |
| Agent Profile E2E Profile Commands should show system prompt with /memory command      | passed | 1810.242096ms        |
| Agent Profile E2E Workspace Context should include workspace info in system prompt     | passed | 2016.2748800000008ms |
| CLI Flags E2E Model Selection should accept --model flag                               | passed | 697.6672010000002ms  |
| CLI Flags E2E Debug Mode should accept --debug flag                                    | passed | 685.7853380000015ms  |
| CLI Flags E2E Yolo Mode should accept --yolo flag                                      | passed | 714.5716990000001ms  |
| CLI Flags E2E List Models should list available models with --list-models              | passed | 1160.7960160000002ms |

#### anti-flicker.test.ts

| Test                                                                                    | Status | Duration             |
| --------------------------------------------------------------------------------------- | ------ | -------------------- |
| Anti-Flicker E2E Terminal Line Wrapping Control should disable line wrapping on startup | passed | 1221.762496ms        |
| Anti-Flicker E2E Terminal Line Wrapping Control should re-enable line wrapping on exit  | passed | 1811.108336ms        |
| Anti-Flicker E2E UI Test Scenarios should render basic scenario without errors          | passed | 1866.1312979999998ms |
| Anti-Flicker E2E UI Test Scenarios should handle rapid-stream scenario                  | passed | 1655.6810500000001ms |
| Anti-Flicker E2E UI Test Scenarios should handle tool-calls scenario                    | passed | 1706.4440699999996ms |
| Anti-Flicker E2E Message Rendering should render user message correctly                 | passed | 1460.4440479999994ms |
| Anti-Flicker E2E Message Rendering should render assistant response correctly           | passed | 1660.2299820000007ms |
| Anti-Flicker E2E Error Handling should handle error scenario gracefully                 | passed | 1514.3774649999996ms |
| Anti-Flicker E2E Static Component Behavior should accumulate multiple messages          | passed | 3369.8938450000005ms |
| CLI Help and Version should show help with --help flag                                  | passed | 781.6159599999992ms  |
| CLI Help and Version should show version with --version flag                            | passed | 599.687495000002ms   |

#### input-handling.test.ts

| Test                                                                                             | Status | Duration             |
| ------------------------------------------------------------------------------------------------ | ------ | -------------------- |
| Input Handling E2E Basic Input should submit message on Enter and get response                   | passed | 1670.731984ms        |
| Input Handling E2E Basic Input should handle empty input gracefully                              | passed | 1153.6390390000001ms |
| Input Handling E2E Basic Input should display user input in prompt area                          | passed | 1862.2377960000003ms |
| Input Handling E2E Message Submission should show user message after submission                  | passed | 2213.412638ms        |
| Input Handling E2E Message Submission should show assistant response after submission            | passed | 1662.2501569999995ms |
| Input Handling E2E Input During Streaming should maintain input area visibility during streaming | passed | 2309.08568ms         |
| Input Handling E2E Multiple Messages should handle multiple sequential messages                  | passed | 2364.2881859999998ms |
| Input Handling E2E Long Input should handle and submit long input                                | passed | 4053.326774000001ms  |

#### markdown-rendering.test.ts

| Test                                                                              | Status | Duration             |
| --------------------------------------------------------------------------------- | ------ | -------------------- |
| Markdown Rendering E2E Code Blocks should render code blocks with borders         | failed | 4549.8928590000005ms |
| Markdown Rendering E2E Code Blocks should render code blocks with language labels | passed | 1059.2853860000005ms |
| Markdown Rendering E2E Long Content should handle long content scenario           | passed | 1718.391149ms        |
| Markdown Rendering E2E Empty Response should handle empty response gracefully     | passed | 3163.6649100000013ms |

#### memory.test.ts

| Test                                                                                            | Status | Duration             |
| ----------------------------------------------------------------------------------------------- | ------ | -------------------- |
| Memory System E2E Project memory (BEANS.md) should load BEANS.md from project root              | passed | 2025.9753480000002ms |
| Memory System E2E Project memory (BEANS.md) should load BEANS.md from .beans directory          | passed | 1817.279179ms        |
| Memory System E2E Project memory (BEANS.md) should merge root and .beans directory memory files | passed | 2015.8761999999997ms |
| Memory System E2E Project memory (BEANS.md) should respect enabled: false in frontmatter        | passed | 3212.264223ms        |
| Memory System E2E Memory content in system prompt should inject memory into agent system prompt | passed | 2013.0200839999998ms |
| Memory System E2E No memory file should work without any BEANS.md file                          | passed | 1816.3233149999996ms |

#### slash-commands.test.ts

| Test                                                                                | Status | Duration             |
| ----------------------------------------------------------------------------------- | ------ | -------------------- |
| Slash Commands E2E /help command should display available commands                  | passed | 1318.410409ms        |
| Slash Commands E2E /help command should list all slash commands                     | passed | 1308.534874ms        |
| Slash Commands E2E /profile command should display current agent profile            | passed | 1263.483022ms        |
| Slash Commands E2E /clear command should clear chat history                         | passed | 2763.4825109999992ms |
| Slash Commands E2E /history command should show message history                     | passed | 2116.8099269999993ms |
| Slash Commands E2E /memory command should show system prompt                        | passed | 2016.6098229999989ms |
| Slash Commands E2E /exit command should exit the application                        | passed | 1110.2267599999996ms |
| Slash Commands E2E /exit command should work with /quit alias                       | passed | 1305.5788140000004ms |
| Slash Commands E2E /exit command should work with /q alias                          | passed | 1157.373141ms        |
| Slash Commands E2E Unknown commands should handle unknown slash commands gracefully | passed | 1617.1665939999984ms |

#### streaming.test.ts

| Test                                                                           | Status | Duration             |
| ------------------------------------------------------------------------------ | ------ | -------------------- |
| Streaming E2E Basic Streaming should stream content progressively              | passed | 1872.1346629999998ms |
| Streaming E2E Basic Streaming should handle rapid streaming without flickering | passed | 1662.074521ms        |
| Streaming E2E Basic Streaming should handle slow streaming                     | passed | 1460.8522810000004ms |
| Streaming E2E Tool Calls should display tool call indicators                   | passed | 1917.0366649999996ms |
| Streaming E2E Tool Calls should show tool completion status                    | passed | 2716.903076999999ms  |
| Streaming E2E Multi-turn Conversation should maintain context across turns     | passed | 2566.528061000001ms  |
| Streaming E2E Multi-turn Conversation should accumulate messages in history    | passed | 3670.9416980000005ms |
| Streaming E2E Error Handling should display errors gracefully                  | passed | 1713.4793180000015ms |
| Streaming E2E Error Handling should allow continuing after error               | passed | 2215.280370999997ms  |

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
   Duration  [22m 5.26s[22m (transform 936ms, setup 0ms, collect 3.51s, tests 8.19s, environment 4ms, prepare 1.41s)[22m
```

### E2E Tests

```

──────────────────────────────────────────────────
      Tests  [22m [1m[31m1 failed[39m[22m[2m | [22m[1m[32m57 passed[39m[22m[90m (58)[39m
   Duration  [22m 41.61s[22m (transform 168ms, setup 0ms, collect 417ms, tests 106.19s, environment 1ms, prepare 560ms)[22m
Duration: 41.59s
```

---

## Sign-off

- [ ] All critical tests passed
- [ ] No blocking issues found
- [ ] Ready for release

**Status:** ❌ FAILED
