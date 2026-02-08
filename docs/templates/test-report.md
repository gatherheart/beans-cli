# Test Report

**Date:** {{date}}
**Tester:** QA Engineer
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

## Test Results by File

{{#each test_suites}}
### {{suite_name}}

| Test | Status | Duration |
|------|--------|----------|
{{#each tests}}
| {{test_name}} | {{status}} | {{duration}} |
{{/each}}

{{/each}}

---

## Failed Tests

{{#if has_failures}}
| Test | Error |
|------|-------|
{{#each failed_tests}}
| {{test_name}} | {{error}} |
{{/each}}
{{else}}
No failed tests.
{{/if}}

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
