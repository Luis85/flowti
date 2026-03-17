# UC-43: SyncState Persistence

**Feature:** [Persistence & Error Recovery](../features/feature-10-persistence.md)

> As a user, I want the plugin to remember what was synced so it can resume efficiently.

## Scenario 43.1: State is saved on plugin unload ⏭️

*Requires filesystem mocking for fsp.writeFile*

```gherkin
Given files have been synced during this session
When the user closes Obsidian
Then sync state should be written to "sync-state.json" in the plugin data directory
```

## Scenario 43.2: State is loaded on plugin startup ✅

*(tests recordSync + needsSync + getTrackedFileCount)*

```gherkin
Given "sync-state.json" exists from a previous session
When the plugin loads
Then the sync state should be restored
  And incremental reconciliation should use the stored mtime/size data
```

## Scenario 43.3: Corrupted state file is handled gracefully ⏭️

*Requires filesystem mocking for fsp.readFile returning bad JSON*

```gherkin
Given "sync-state.json" contains invalid JSON
When the plugin loads
Then it should start with fresh (empty) state
  And a warning should be logged
```

## Scenario 43.4: Orphaned entries are pruned after reconciliation ✅

```gherkin
Given sync state contains an entry for "deleted-file.md"
  And "deleted-file.md" no longer exists in the source folder
When reconciliation completes
Then the entry for "deleted-file.md" should be removed from sync state
```

## Scenario 43.5: State enforces per-mapping file limit ✅

*(tests getStats mechanism)*

```gherkin
Given a mapping's sync state has 100,000 file entries (MAX_FILES_PER_MAPPING)
When a new file is synced
Then the state should handle the limit gracefully to prevent unbounded growth
```
