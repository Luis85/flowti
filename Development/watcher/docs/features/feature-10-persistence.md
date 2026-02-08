# Feature 10: Persistence & Error Recovery

Covers sync state persistence across sessions and graceful handling of watcher errors and shutdowns.

> **Test file:** `tests/acceptance/feature8-10-settings-ui-persistence.test.ts` (shared)

## Use Cases

| # | Use Case | User Story | Status |
|---|----------|------------|--------|
| UC-43 | SyncState Persistence | Remembering sync state across sessions | ✅ 4/5 (+3 extra) |
| UC-44 | SyncState Auto-Save | Debounced auto-save prevents data loss | ✅ 1/2 |
| UC-45 | Watcher Error Recovery | Handling chokidar errors gracefully | ⏭️ 0/1 (chokidar) |
| UC-46 | Watcher Close Timeout | Preventing hanging on unresponsive filesystems | ⏭️ 0/1 (chokidar) |
