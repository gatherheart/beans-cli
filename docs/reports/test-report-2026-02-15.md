# Test Report

**Date:** 2026-02-15T07:03:35.042Z
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
| Agent Profile E2E Default Profile should load default agent profile | passed | 1260.5353810000001ms |
| Agent Profile E2E Default Profile should display profile name on startup | passed | 804.3809910000002ms |
| Agent Profile E2E Custom Profile Loading should load profile from --agent-profile flag | passed | 1259.8431609999998ms |
| Agent Profile E2E Profile Commands should show full profile with /profile command | passed | 1462.8495660000003ms |
| Agent Profile E2E Profile Commands should show system prompt with /memory command | passed | 1612.2636629999997ms |
| Agent Profile E2E Workspace Context should include workspace info in system prompt | passed | 1810.5887939999993ms |
| CLI Flags E2E Model Selection should accept --model flag | passed | 674.3795659999996ms |
| CLI Flags E2E Debug Mode should accept --debug flag | passed | 610.0777440000002ms |
| CLI Flags E2E Yolo Mode should accept --yolo flag | passed | 731.1756929999992ms |
| CLI Flags E2E List Models should list available models with --list-models | passed | 829.427853000001ms |

#### anti-flicker.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Anti-Flicker E2E Terminal Line Wrapping Control should disable line wrapping on startup | passed | 1218.548497ms |
| Anti-Flicker E2E Terminal Line Wrapping Control should re-enable line wrapping on exit | passed | 1610.46885ms |
| Anti-Flicker E2E UI Test Scenarios should render basic scenario without errors | passed | 1865.5190619999998ms |
| Anti-Flicker E2E UI Test Scenarios should handle rapid-stream scenario | passed | 1659.8505489999998ms |
| Anti-Flicker E2E UI Test Scenarios should handle tool-calls scenario | passed | 1927.895282999999ms |
| Anti-Flicker E2E Message Rendering should render user message correctly | passed | 2079.2989419999994ms |
| Anti-Flicker E2E Message Rendering should render assistant response correctly | passed | 1461.2891039999995ms |
| Anti-Flicker E2E Error Handling should handle error scenario gracefully | passed | 1513.9410970000008ms |
| Anti-Flicker E2E Static Component Behavior should accumulate multiple messages | failed | 28046.017267ms |
| CLI Help and Version should show help with --help flag | passed | 541.6057529999962ms |
| CLI Help and Version should show version with --version flag | passed | 630.8210229999968ms |

#### input-handling.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Input Handling E2E Basic Input should submit message on Enter and get response | passed | 2274.425408ms |
| Input Handling E2E Basic Input should handle empty input gracefully | passed | 1356.8909950000002ms |
| Input Handling E2E Basic Input should display user input in prompt area | passed | 1662.46396ms |
| Input Handling E2E Message Submission should show user message after submission | passed | 2216.5228879999995ms |
| Input Handling E2E Message Submission should show assistant response after submission | passed | 1658.9782690000002ms |
| Input Handling E2E Input During Streaming should maintain input area visibility during streaming | passed | 2314.201623000001ms |
| Input Handling E2E Multiple Messages should handle multiple sequential messages | failed | 27017.997494000003ms |
| Input Handling E2E Long Input should handle and submit long input | passed | 3632.5019089999987ms |

#### markdown-rendering.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Markdown Rendering E2E Code Blocks should render code blocks with borders | passed | 1712.098676ms |
| Markdown Rendering E2E Code Blocks should render code blocks with language labels | passed | 1659.3849739999998ms |
| Markdown Rendering E2E Long Content should handle long content scenario | passed | 1713.009328ms |
| Markdown Rendering E2E Empty Response should handle empty response gracefully | passed | 3160.785269000001ms |

#### slash-commands.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Slash Commands E2E /help command should display available commands | passed | 1112.0334369999998ms |
| Slash Commands E2E /help command should list all slash commands | passed | 1107.624701ms |
| Slash Commands E2E /profile command should display current agent profile | passed | 1258.985873ms |
| Slash Commands E2E /clear command should clear chat history | passed | 2964.162126ms |
| Slash Commands E2E /history command should show message history | passed | 2123.110524999999ms |
| Slash Commands E2E /memory command should show system prompt | passed | 1812.6692729999995ms |
| Slash Commands E2E /exit command should exit the application | passed | 1106.2987740000008ms |
| Slash Commands E2E /exit command should work with /quit alias | passed | 1105.9856259999997ms |
| Slash Commands E2E /exit command should work with /q alias | passed | 960.5730160000003ms |
| Slash Commands E2E Unknown commands should handle unknown slash commands gracefully | passed | 1613.7040909999996ms |

#### streaming.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Streaming E2E Basic Streaming should stream content progressively | passed | 1676.747808ms |
| Streaming E2E Basic Streaming should handle rapid streaming without flickering | passed | 1459.151643ms |
| Streaming E2E Basic Streaming should handle slow streaming | passed | 1257.0153149999996ms |
| Streaming E2E Tool Calls should display tool call indicators | passed | 1915.6516350000002ms |
| Streaming E2E Tool Calls should show tool completion status | passed | 2724.7475240000012ms |
| Streaming E2E Multi-turn Conversation should maintain context across turns | failed | 27232.443889000002ms |
| Streaming E2E Multi-turn Conversation should accumulate messages in history | failed | 27834.01459ms |
| Streaming E2E Error Handling should display errors gracefully | passed | 1306.7860179999916ms |
| Streaming E2E Error Handling should allow continuing after error | passed | 1810.1749050000071ms |

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
   Duration  [2m 4.38s[2m (transform 801ms, setup 0ms, collect 3.75s, tests 5.98s, environment 3ms, prepare 1.10s)[22m
```

### E2E Tests
```

──────────────────────────────────────────────────
      Tests  [2m [1m[31m4 failed[39m[22m[2m | [22m[1m[32m48 passed[39m[22m[90m (52)[39m
   Duration  [2m 67.60s[2m (transform 140ms, setup 0ms, collect 371ms, tests 186.39s, environment 1ms, prepare 529ms)[22m
Duration: 67.58s
```

---

## Sign-off

- [ ] All critical tests passed
- [ ] No blocking issues found
- [ ] Ready for release

**Status:** ❌ FAILED