# UI Test Report

**Date:** {{date}}
**Tester:** {{tester}}
**Version:** {{version}}

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | {{total_tests}} |
| Passed | {{passed}} |
| Failed | {{failed}} |
| Skipped | {{skipped}} |
| Duration | {{duration}} |

## Test Results by Category

### Static Rendering Tests

| Test | Status | Notes |
|------|--------|-------|
| Renders input prompt | {{status}} | {{notes}} |
| Shows placeholder text | {{status}} | {{notes}} |
| Shows help hint | {{status}} | {{notes}} |
| Renders with border | {{status}} | {{notes}} |

### Keyboard Input Tests

| Test | Status | Notes |
|------|--------|-------|
| Displays typed characters | {{status}} | {{notes}} |
| Handles backspace | {{status}} | {{notes}} |
| Clears input with Ctrl+U | {{status}} | {{notes}} |

### Message Submission Tests

| Test | Status | Notes |
|------|--------|-------|
| Sends message on Enter | {{status}} | {{notes}} |
| Clears input after submission | {{status}} | {{notes}} |
| Does not send empty message | {{status}} | {{notes}} |

### Slash Commands Tests

| Test | Status | Notes |
|------|--------|-------|
| /exit command | {{status}} | {{notes}} |
| /help command | {{status}} | {{notes}} |
| /clear command | {{status}} | {{notes}} |
| Unknown command handling | {{status}} | {{notes}} |

### Long Text Handling Tests

| Test | Status | Notes |
|------|--------|-------|
| Long single-line text | {{status}} | {{notes}} |
| Very long text (500 chars) | {{status}} | {{notes}} |
| Rapid typing | {{status}} | {{notes}} |
| Unicode characters | {{status}} | {{notes}} |
| Special characters | {{status}} | {{notes}} |

### Markdown Rendering Tests

| Test | Status | Notes |
|------|--------|-------|
| Headers (h1, h2, h3) | {{status}} | {{notes}} |
| Code blocks with border | {{status}} | {{notes}} |
| Inline formatting | {{status}} | {{notes}} |
| Lists (ordered/unordered) | {{status}} | {{notes}} |
| Tables | {{status}} | {{notes}} |

---

## UI Verification Checklist

### Flickering Detection
- [ ] No screen flashing during streaming
- [ ] Input area remains stable
- [ ] Cursor blink continues smoothly

### Input Visibility
- [ ] Input area visible during streaming
- [ ] Can type while response streams
- [ ] Cursor position updates correctly

### Output Display
- [ ] All content visible (can scroll)
- [ ] No content truncation
- [ ] Code blocks render with borders

---

## Issues Found

| Issue ID | Severity | Description | Steps to Reproduce |
|----------|----------|-------------|-------------------|
| {{issue_id}} | {{severity}} | {{description}} | {{steps}} |

---

## Recommendations

{{recommendations}}

---

## Environment

| Property | Value |
|----------|-------|
| Node.js | {{node_version}} |
| OS | {{os}} |
| Terminal | {{terminal}} |
| Test Framework | Vitest |

---

## Raw Test Output

```
{{raw_output}}
```

---

## Sign-off

- [ ] All critical tests passed
- [ ] No blocking issues found
- [ ] Ready for release

**Approved by:** {{approver}}
**Date:** {{approval_date}}
