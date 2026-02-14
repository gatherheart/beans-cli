# Test Report

**Date:** {{date}}
**Tester:** QA Engineer
**Version:** {{version}}

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | {{summary.total}} |
| Passed | {{summary.passed}} |
| Failed | {{summary.failed}} |
| Skipped | {{summary.skipped}} |
| Duration | (see categories) |

## Test Results by File

{{#each categories}}
### {{name}}

{{#each suites}}
#### {{name}}

| Test | Status | Duration |
|------|--------|----------|
{{#each tests}}
| {{name}} | {{status}} | {{duration}}ms |
{{/each}}

{{/each}}
{{/each}}

---

## Failed Tests

{{#if summary.failed}}
| Test | Suite | Error |
|------|-------|-------|
{{#each categories}}
{{#each suites}}
{{#each tests}}
{{#if (eq status "failed")}}
| {{name}} | {{../name}} | See raw output |
{{/if}}
{{/each}}
{{/each}}
{{/each}}
{{else}}
No failed tests.
{{/if}}

---

## Environment

| Property | Value |
|----------|-------|
| Node.js | {{nodeVersion}} |
| OS | {{os}} |
| Version | {{version}} |
| Test Framework | Vitest |

---

## Raw Test Output

{{#each categories}}
### {{name}}
```
{{rawOutput}}
```
{{/each}}

---

## Sign-off

{{#if overallSuccess}}
- [x] All critical tests passed
- [x] No blocking issues found
- [x] Ready for release
{{else}}
- [ ] All critical tests passed
- [ ] No blocking issues found
- [ ] Ready for release
{{/if}}

**Status:** {{#if overallSuccess}}✅ PASSED{{else}}❌ FAILED{{/if}}
