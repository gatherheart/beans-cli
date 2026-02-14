```markdown
# Test Report

**Date:** 2026-02-14T08:46:58.498Z
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
| Agent Profile E2E Default Profile should load default agent profile | passed | 1266.695993ms |
| Agent Profile E2E Default Profile should display profile name on startup | passed | 804.637167ms |
| Agent Profile E2E Custom Profile Loading should load profile from --agent-profile flag | passed | 1262.477435ms |
| Agent Profile E2E Profile Commands should show full profile with /profile command | passed | 1462.316647ms |
| Agent Profile E2E Profile Commands should show system prompt with /memory command | passed | 1810.851547ms |
| Agent Profile E2E Workspace Context should include workspace info in system prompt | passed | 1609.848101ms |
| CLI Flags E2E Model Selection should accept --model flag | passed | 680.697396ms |
| CLI Flags E2E Debug Mode should accept --debug flag | passed | 548.73508ms |
| CLI Flags E2E Yolo Mode should accept --yolo flag | passed | 687.457075ms |
| CLI Flags E2E List Models should list available models with --list-models | passed | 842.508167ms |

#### anti-flicker.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Anti-Flicker E2E Terminal Line Wrapping Control should disable line wrapping on startup | passed | 1017.062695ms |
| Anti-Flicker E2E Terminal Line Wrapping Control should re-enable line wrapping on exit | passed | 1610.985229ms |
| Anti-Flicker E2E UI Test Scenarios should render basic scenario without errors | passed | 1656.815655ms |
| Anti-Flicker E2E UI Test Scenarios should handle rapid-stream scenario | passed | 1457.139339ms |
| Anti-Flicker E2E UI Test Scenarios should handle tool-calls scenario | passed | 1514.083055ms |
| Anti-Flicker E2E Message Rendering should render user message correctly | passed | 1657.430901ms |
| Anti-Flicker E2E Message Rendering should render assistant response correctly | passed | 1262.128126ms |
| Anti-Flicker E2E Error Handling should handle error scenario gracefully | passed | 1313.407878ms |
| Anti-Flicker E2E Static Component Behavior should accumulate multiple messages | failed | 28242.333354ms |
| CLI Help and Version should show help with --help flag | passed | 534.183954ms |
| CLI Help and Version should show version with --version flag | passed | 518.767255ms |

#### input-handling.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Input Handling E2E Basic Input should submit message on Enter and get response | passed | 2072.378421ms |
| Input Handling E2E Basic Input should handle empty input gracefully | passed | 1359.488849ms |
| Input Handling E2E Basic Input should display user input in prompt area | passed | 1662.494546ms |
| Input Handling E2E Message Submission should show user message after submission | passed | 1816.290971ms |
| Input Handling E2E Message Submission should show assistant response after submission | passed | 1665.765674ms |
| Input Handling E2E Input During Streaming should maintain input area visibility during streaming | passed | 2312.187587ms |
| Input Handling E2E Multiple Messages should handle multiple sequential messages | failed | 26808.464946ms |
| Input Handling E2E Long Input should handle and submit long input | passed | 3234.786489ms |

#### markdown-rendering.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Markdown Rendering E2E Code Blocks should render code blocks with borders | passed | 1713.22631ms |
| Markdown Rendering E2E Code Blocks should render code blocks with language labels | passed | 1456.146523ms |
| Markdown Rendering E2E Long Content should handle long content scenario | passed | 1908.478035ms |
| Markdown Rendering E2E Empty Response should handle empty response gracefully | passed | 3155.69931ms |

#### slash-commands.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Slash Commands E2E /help command should display available commands | passed | 1113.686518ms |
| Slash Commands E2E /help command should list all slash commands | passed | 1107.83667ms |
| Slash Commands E2E /profile command should display current agent profile | passed | 1261.860802ms |
| Slash Commands E2E /clear command should clear chat history | passed | 2767.161633ms |
| Slash Commands E2E /history command should show message history | passed | 2114.723937ms |
| Slash Commands E2E /memory command should show system prompt | passed | 1805.678769ms |
| Slash Commands E2E /exit command should exit the application | passed | 1104.195819ms |
| Slash Commands E2E /exit command should work with /quit alias | passed | 1103.766801ms |
| Slash Commands E2E /exit command should work with /q alias | passed | 754.213146ms |
| Slash Commands E2E Unknown commands should handle unknown slash commands gracefully | passed | 1811.223863ms |

#### streaming.test.ts

| Test | Status | Duration |
|------|--------|----------|
| Streaming E2E Basic Streaming should stream content progressively | passed | 1669.624548ms |
| Streaming E2E Basic Streaming should handle rapid streaming without flickering | passed | 1457.793508ms |
| Streaming E2E Basic Streaming should handle slow streaming | passed | 1256.55769ms |
| Streaming E2E Tool Calls should display tool call indicators | passed | 1507.588149ms |
| Streaming E2E Tool Calls should show tool completion status | passed | 2510.802304ms |
| Streaming E2E Multi-turn Conversation should maintain context across turns | failed | 27215.452551ms |
| Streaming E2E Multi-turn Conversation should accumulate messages in history | failed | 28225.756359ms |
| Streaming E2E Error Handling should display errors gracefully | passed | 1310.407847ms |
| Streaming E2E Error Handling should allow continuing after error | passed | 1806.420914ms |

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
      Tests  [22m [1m[32m159 passed[39m[22m[90m (159)[39m
   Duration  [22m 4.11s[2m (transform 709ms, setup 0ms, collect 3.31s, tests 5.85s, environment 3ms, prepare 950ms)[22m
```

### E2E Tests
```

──────────────────────────────────────────────────
      Tests  [22m [1m[31m4 failed[39m[22m[2m | [22m[1m[32m48 passed[39m[22m[90m (52)[39m
   Duration  [22m 67.33s[2m (transform 168ms, setup 0ms, collect 361ms, tests 182.84s, environment 1ms, prepare 512ms)[22m
Duration: 67.31s
```

---

## Sign-off

- [ ] All critical tests passed
- [ ] No blocking issues found
- [ ] Ready for release

**Status:** ❌ FAILED
```