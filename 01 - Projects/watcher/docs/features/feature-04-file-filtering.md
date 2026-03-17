---
domain: Folder Watcher
stage: done
plugin: "[[Development/watcher/README|README]]"
type: Feature
---
# Feature 4: File Filtering

Covers which files are included or excluded from sync operations based on extension, pattern, type, and link status.

> **Test file:** `tests/acceptance/feature4-file-filtering.test.ts` — 19 passing, 2 skipped

## Use Cases

| # | Use Case | User Story | Status |
|---|----------|------------|--------|
| UC-15 | File Extension Filtering | Syncing only specific file types | ✅ 5/5 |
| UC-16 | Exclude Patterns | Excluding files/folders by glob pattern | ✅ 5/5 |
| UC-17 | Temp / System File Filtering | Ignoring temporary and OS files | ✅ 5/5 |
| UC-18 | Dotfile Filtering | Ignoring hidden files and directories | ✅ 3/3 |
| UC-19 | Symlink Protection | Skipping symbolic links safely | ✅ 1/3 |
