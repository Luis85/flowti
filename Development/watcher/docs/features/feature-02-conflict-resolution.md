---
domain: Folder Watcher
stage: done
plugin: "[[Development/watcher/README|README]]"
type: Feature
---
# Feature 2: Conflict Resolution

Covers how the plugin handles cases where a file exists in both source and target with different content.

> **Test file:** `tests/acceptance/feature2-conflict-resolution.test.ts` — 9 passing, 1 skipped

## Use Cases

| # | Use Case | User Story | Status |
|---|----------|------------|--------|
| UC-06 | Conflict — Overwrite | Always taking the latest written version | ✅ 1/2 |
| UC-07 | Conflict — Skip | Never overwriting existing files | ✅ 1/1 |
| UC-08 | Conflict — Keep Newer | Keeping the most recently modified version | ✅ 3/3 |
| UC-09 | Conflict — Rename | Preserving both versions on conflict | ✅ 2/2 |
| UC-10 | Reverse Conflict Resolution | Separate conflict strategy for vault→source | ✅ 2/2 |
