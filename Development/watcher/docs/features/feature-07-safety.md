---
domain: Folder Watcher
stage: done
plugin: "[[Development/watcher/README|README]]"
---
# Feature 7: Safety & Validation

Covers mechanisms that prevent data loss, security issues, and platform-specific path problems.

> **Test file:** `tests/acceptance/feature7-safety.test.ts` — 10 passing, 8 skipped

## Use Cases

| # | Use Case | User Story | Status |
|---|----------|------------|--------|
| UC-30 | File Size Limit | Preventing OOM on huge files | ⏭️ 0/3 (integration) |
| UC-31 | Path Traversal Protection | Preventing writes outside designated folders | ✅ 2/2 (+3 extra) |
| UC-32 | Windows Path Length Validation | Handling MAX_PATH (260 char) limit | ✅ 3/3 |
| UC-33 | Unicode Path Normalization | Cross-platform Unicode path matching | ✅ 2/2 (+2 extra) |
| UC-34 | Source Folder Validation | Graceful handling when source folder is missing | ⏭️ 0/2 (chokidar) |
| UC-35 | Overlapping Mapping Validation | Preventing two mappings writing to the same vault folder | ⏭️ 0/3 (Modal UI) |
