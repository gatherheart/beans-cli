```markdown
# Test Report

**Date:** 2026-02-14T13:51:11.921Z
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
| Agent Profile E2E Default Profile should load default agent profile | passed | 1264.882468ms |
| Agent Profile E2E Default Profile should display profile name on startup | passed | 807.6528860000001ms |
| Agent Profile E2E Custom Profile Loading should load profile from --agent-profile flag | passed | 1259.1593320000002ms |
| Agent Profile E2E Profile Commands should show full profile with /profile command | passed | 1259.1725160000005ms |
| Agent Profile E2E Profile Commands should show system prompt with /memory command | passed | 1607.7316060000003ms |
| Agent Profile E2E Workspace Context should include workspace info in system prompt | passed | 1613.668627ms |
| CLI Flags E2E Model Selection should accept --model flag | passed | 641.5156050000005ms |
| CLI Flags E2E Debug Mode should accept --debug flag | passed | 653.3999369999983ms |
| CLI Flags E2E Yolo Mode should accept --yolo flag | passed | 678.9894929999991ms |
| CLI Flags E2E List Models should list available models with --list-models | passed | 821.1419439999991ms |

#### anti-flicker.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Anti-Flicker E2E Terminal Line Wrapping Control should disable line wrapping on startup | passed | 1010.328949ms |
| Anti-Flicker E2E Terminal Line Wrapping Control should re-enable line wrapping on exit | passed | 1608.171409ms |
| Anti-Flicker E2E UI Test Scenarios should render basic scenario without errors | passed | 1666.535895ms |
| Anti-Flicker E2E UI Test Scenarios should handle rapid-stream scenario | passed | 1455.452013ms |
| Anti-Flicker E2E UI Test Scenarios should handle tool-calls scenario | passed | 1507.1490330000006ms |
| Anti-Flicker E2E Message Rendering should render user message correctly | passed | 1865.1262199999992ms |
| Anti-Flicker E2E Message Rendering should render assistant response correctly | passed | 1460.4656219999997ms |
| Anti-Flicker E2E Error Handling should handle error scenario gracefully | passed | 1306.4866550000006ms |
| Anti-Flicker E2E Static Component Behavior should accumulate multiple messages | failed | 28023.885058ms |
| CLI Help and Version should show help with --help flag | passed | 529.1941570000054ms |
| CLI Help and Version should show version with --version flag | passed | 525.2861759999942ms |

#### input-handling.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Input Handling E2E Basic Input should submit message on Enter and get response | passed | 2084.464877ms |
| Input Handling E2E Basic Input should handle empty input gracefully | passed | 1357.8731619999999ms |
| Input Handling E2E Basic Input should display user input in prompt area | passed | 1659.667441ms |
| Input Handling E2E Message Submission should show user message after submission | passed | 2010.8501530000003ms |
| Input Handling E2E Message Submission should show assistant response after submission | passed | 1660.0254170000007ms |
| Input Handling E2E Input During Streaming should maintain input area visibility during streaming | passed | 2311.769873000001ms |
| Input Handling E2E Multiple Messages should handle multiple sequential messages | failed | 27205.326116999997ms |
| Input Handling E2E Long Input should handle and submit long input | passed | 3417.131158000004ms |

#### markdown-rendering.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Markdown Rendering E2E Code Blocks should render code blocks with borders | passed | 1718.837698ms |
| Markdown Rendering E2E Code Blocks should render code blocks with language labels | passed | 1660.636247ms |
| Markdown Rendering E2E Long Content should handle long content scenario | passed | 1719.359047ms |
| Markdown Rendering E2E Empty Response should handle empty response gracefully | passed | 3162.775359ms |

#### slash-commands.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Slash Commands E2E /help command should display available commands | passed | 908.3569130000001ms |
| Slash Commands E2E /help command should list all slash commands | passed | 1106.6915319999998ms |
| Slash Commands E2E /profile command should display current agent profile | passed | 1256.2569329999997ms |
| Slash Commands E2E /clear command should clear chat history | passed | 2765.24419ms |
| Slash Commands E2E /history command should show message history | passed | 2115.0742329999994ms |
| Slash Commands E2E /memory command should show system prompt | passed | 1813.851775000001ms |
| Slash Commands E2E /exit command should exit the application | passed | 1107.826167000001ms |
| Slash Commands E2E /exit command should work with /quit alias | passed | 1106.5168410000006ms |
| Slash Commands E2E /exit command should work with /q alias | passed | 954.2012890000005ms |
| Slash Commands E2E Unknown commands should handle unknown slash commands gracefully | passed | 1806.358796999999ms |

#### streaming.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Streaming E2E Basic Streaming should stream content progressively | passed | 1669.320041ms |
| Streaming E2E Basic Streaming should handle rapid streaming without flickering | passed | 1459.1673910000002ms |
| Streaming E2E Basic Streaming should handle slow streaming | passed | 1255.0180690000002ms |
| Streaming E2E Tool Calls should display tool call indicators | passed | 1511.1502140000002ms |
| Streaming E2E Tool Calls should show tool completion status | passed | 2711.1843230000004ms |
| Streaming E2E Multi-turn Conversation should maintain context across turns | failed | 27200.723048ms |
| Streaming E2E Multi-turn Conversation should accumulate messages in history | failed | 28021.462951ms |
| Streaming E2E Error Handling should display errors gracefully | passed | 1312.968525999997ms |
| Streaming E2E Error Handling should allow continuing after error | passed | 1813.1538899999941ms |

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
   Duration  [2m 4.24s[22m (transform 811ms, setup 0ms, collect 3.55s, tests 5.87s, environment 3ms, prepare 1.07s)[22m
```

### E2E Tests
```

──────────────────────────────────────────────────
      Tests  [2m [22m[1m[31m4 failed[39m[22m[2m | [22m[1m[32m48 passed[39m[22m[90m (52)[39m
   Duration  [2m 67.32s[22m (transform 146ms, setup 0ms, collect 354ms, tests 183.44s, environment 1ms, prepare 494ms)[22m
Duration: 67.30s
```

---

## Sign-off

- [ ] All critical tests passed
- [ ] No blocking issues found
- [ ] Ready for release

**Status:** ❌ FAILED
```