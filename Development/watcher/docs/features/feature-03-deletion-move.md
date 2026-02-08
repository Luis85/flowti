# Feature 3: Deletion & Move Handling

Covers how the plugin handles file deletions and renames in both sync directions.

> **Test file:** `tests/acceptance/feature3-deletion-move.test.ts` — 6 passing, 10 skipped

## Use Cases

| # | Use Case | User Story | Status |
|---|----------|------------|--------|
| UC-11 | Deletion — Ignore | Preventing deletion propagation | ✅ 1/2 |
| UC-12 | Deletion — Trash | Syncing deletions safely via trash | ✅ 1/2 |
| UC-13 | Move Detection | Detecting renames as single operations | ✅ 4/7 |
| UC-14 | Orphan Cleanup | Cleaning up vault files without source counterpart | ⏭️ 0/5 (integration) |
