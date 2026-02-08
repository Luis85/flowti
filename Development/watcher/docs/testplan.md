# Folder Watcher — User Acceptance Test Plan

## Top 3 User Journeys

These end-to-end journeys represent the most critical paths through the system.
Each journey crosses multiple features and validates that components work together correctly.

> **Test file:** `tests/acceptance/user-journeys.test.ts`

---
### Journey 1: Import External Notes into Obsidian

> **Persona:** A researcher who keeps notes in an external folder (synced via Dropbox)
> and wants them automatically imported into their Obsidian vault.

| Step | What happens | Features exercised |
|------|--------------|--------------------|
| 1 | User configures a source-only mapping (`/external/notes` → `vault/imported`) | UC-36 Settings |
| 2 | A new file `report.md` appears in the source folder | UC-01 Core Sync |
| 3 | Temp files (`~$report.docx`) and dotfiles (`.DS_Store`) are filtered out | UC-17, UC-18 Filtering |
| 4 | File extension filter allows `.md` but blocks `.exe` | UC-15 Filtering |
| 5 | Path traversal check validates source and target paths | UC-31 Safety |
| 6 | ConflictResolver decides "overwrite" (first sync, no conflict) | UC-06 Conflict |
| 7 | File is written to `vault/imported/report.md` | UC-01 Core Sync |
| 8 | SyncState records the file's mtime and size | UC-43 Persistence |
| 9 | Subsequent reconciliation skips the unchanged file | UC-21 Incremental |

**Happy Path Test:** Configure mapping → filter pipeline accepts `report.md` → validate paths → resolve conflict → record sync state → verify incremental skip on re-check.

---

### Journey 2: Edit from Both Obsidian and VS Code

> **Persona:** A developer who edits markdown files in both Obsidian and VS Code,
> using bidirectional sync to keep both sides in sync.

| Step | What happens | Features exercised |
|------|--------------|--------------------|
| 1 | User configures a bidirectional mapping with `debounceDelay: 800` | UC-36 Settings |
| 2 | User edits `vault/imported/file.md` in Obsidian | UC-03 Bidirectional |
| 3 | VaultWatcher debounces rapid saves (min 1500ms for reverse) | UC-28 Debounce |
| 4 | After debounce, reverse sync writes to `/external/file.md` | UC-03 Bidirectional |
| 5 | SyncLoopDetector records the sync to prevent bounce-back | UC-27 Loop Prevention |
| 6 | Source watcher sees the change but loop detector blocks it | UC-27 Loop Prevention |
| 7 | After 5s cooldown expires, a genuine external edit is detected | UC-27 Loop Prevention |
| 8 | ConflictResolver uses "keepNewer" — source is newer, overwrites vault | UC-08 Conflict |

**Happy Path Test:** Vault edit → debounced reverse sync → loop detector blocks bounce → cooldown expires → forward sync proceeds with keepNewer resolution.

---

### Journey 3: Catch Up After a Weekend Away

> **Persona:** A user who was offline for the weekend while their Dropbox folder
> accumulated changes. On Monday, they open Obsidian and reconciliation kicks in.

| Step | What happens | Features exercised |
|------|--------------|--------------------|
| 1 | Obsidian opens, plugin loads settings with `syncOnStart: true` | UC-36 Settings |
| 2 | ReconcileService checks enabled mappings with `reconcileOnStart: true` | UC-20 Reconciliation |
| 3 | SyncStateService reports unchanged files → skipped (incremental) | UC-21 Incremental |
| 4 | Modified files (different mtime/size) are synced | UC-21 Incremental |
| 5 | New files pass the filter pipeline and are synced | UC-15–18 Filtering |
| 6 | Concurrent reconcile guard prevents double-run if triggered again | UC-24 Concurrent Guard |
| 7 | User cancels mid-reconciliation → cooperative stop after current file | UC-23 Cancel |

**Happy Path Test:** Load settings → reconcile enabled mappings → skip unchanged → sync modified → sync new files → verify concurrent guard blocks second run → verify cancel stops processing.

---

## Use Cases Overview

---

### Feature 1: Core Synchronization

| # | Use Case | User Story | Status |
|---|----------|------------|--------|
| UC-01 | Source-Only Sync (external → vault) | Importing external files into Obsidian | ⏭️ 1/4 (chokidar) |
| UC-02 | Vault-Only Sync (vault → external) | Exporting vault files to external tools | ✅ 2/3 |
| UC-03 | Bidirectional Sync | Editing files from both Obsidian and external editors | ✅ 2/3 |
| UC-04 | Subfolder Watching | Controlling recursive vs top-level watching | ⏭️ 0/2 (chokidar) |
| UC-05 | New Directory Detection | Auto-scanning new source subdirectories | ⏭️ 0/3 (chokidar) |

---

### Feature 2: Conflict Resolution

| # | Use Case | User Story | Status |
|---|----------|------------|--------|
| UC-06 | Conflict — Overwrite | Always taking the latest written version | ✅ 1/2 |
| UC-07 | Conflict — Skip | Never overwriting existing files | ✅ 1/1 |
| UC-08 | Conflict — Keep Newer | Keeping the most recently modified version | ✅ 3/3 |
| UC-09 | Conflict — Rename | Preserving both versions on conflict | ✅ 2/2 |
| UC-10 | Reverse Conflict Resolution | Separate conflict strategy for vault→source | ✅ 2/2 |

---

### Feature 3: Deletion & Move Handling

| # | Use Case | User Story | Status |
|---|----------|------------|--------|
| UC-11 | Deletion — Ignore | Preventing deletion propagation | ✅ 1/2 |
| UC-12 | Deletion — Trash | Syncing deletions safely via trash | ✅ 1/2 |
| UC-13 | Move Detection | Detecting renames as single operations | ✅ 4/7 |
| UC-14 | Orphan Cleanup | Cleaning up vault files without source counterpart | ⏭️ 0/5 (integration) |

---

### Feature 4: File Filtering

| # | Use Case | User Story | Status |
|---|----------|------------|--------|
| UC-15 | File Extension Filtering | Syncing only specific file types | ✅ 5/5 |
| UC-16 | Exclude Patterns | Excluding files/folders by glob pattern | ✅ 5/5 |
| UC-17 | Temp / System File Filtering | Ignoring temporary and OS files | ✅ 5/5 |
| UC-18 | Dotfile Filtering | Ignoring hidden files and directories | ✅ 3/3 |
| UC-19 | Symlink Protection | Skipping symbolic links safely | ✅ 1/3 |

---

### Feature 5: Reconciliation

| # | Use Case | User Story | Status |
|---|----------|------------|--------|
| UC-20 | Reconciliation on Start | Catching up after Obsidian was closed | ✅ 3/4 |
| UC-21 | Incremental Reconciliation | Skipping unchanged files for speed | ✅ 2/4 |
| UC-22 | Reconcile Worker Parallelism | Processing multiple files concurrently | ✅ 1/2 |
| UC-23 | Cancel Reconciliation | Stopping a running reconciliation | ✅ 1/1 |
| UC-24 | Concurrent Reconcile Guard | Preventing overlapping reconciliations | ✅ 1/1 |

---

### Feature 6: Reliability & Performance

| # | Use Case | User Story | Status |
|---|----------|------------|--------|
| UC-25 | File Stability Checks | Waiting for cloud-synced files to finish downloading | ⏭️ 0/3 (integration) |
| UC-26 | Retry on Transient Errors | Automatically retrying on temporary failures | ✅ 3/3 (+4 extra) |
| UC-27 | Sync Loop Prevention | Preventing infinite sync ping-pong | ✅ 4/5 |
| UC-28 | Debounce Behavior | Consolidating rapid saves into single syncs | ✅ 2/2 |
| UC-29 | Backpressure / Queue Limits | Preventing unbounded memory consumption | ✅ 2/2 |

---

### Feature 7: Safety & Validation

| # | Use Case | User Story | Status |
|---|----------|------------|--------|
| UC-30 | File Size Limit | Preventing OOM on huge files | ⏭️ 0/3 (integration) |
| UC-31 | Path Traversal Protection | Preventing writes outside designated folders | ✅ 2/2 (+3 extra) |
| UC-32 | Windows Path Length Validation | Handling MAX_PATH (260 char) limit | ✅ 3/3 |
| UC-33 | Unicode Path Normalization | Cross-platform Unicode path matching | ✅ 2/2 (+2 extra) |
| UC-34 | Source Folder Validation | Graceful handling when source folder is missing | ⏭️ 0/2 (chokidar) |
| UC-35 | Overlapping Mapping Validation | Preventing two mappings writing to the same vault folder | ⏭️ 0/3 (Modal UI) |

---

### Feature 8: Settings & Configuration

| # | Use Case | User Story | Status |
|---|----------|------------|--------|
| UC-36 | Mapping CRUD | Creating, editing, and deleting folder mappings | ✅ 2/4 (+defaults) |
| UC-37 | Polling Mode | Using polling for NAS / network drives | ✅ 1/2 (+defaults) |

---

### Feature 9: User Interface

| # | Use Case | User Story | Status |
|---|----------|------------|--------|
| UC-38 | Status Bar Display | At-a-glance sync status | ⏭️ 0/2 (DOM) |
| UC-39 | Reconcile Progress Reporting | Real-time progress during reconciliation | ⏭️ 0/3 (DOM) |
| UC-40 | Dashboard | Detailed watcher management and logs | ⏭️ 0/3 (DOM) |
| UC-41 | Commands | Keyboard-accessible plugin actions | ⏭️ 0/2 (Plugin API) |
| UC-42 | Watcher Health Monitoring | Identifying idle, warning, or error states | ⏭️ 0/1 (integration) |

---

### Feature 10: Persistence & Error Recovery

| # | Use Case | User Story | Status |
|---|----------|------------|--------|
| UC-43 | SyncState Persistence | Remembering sync state across sessions | ✅ 4/5 (+3 extra) |
| UC-44 | SyncState Auto-Save | Debounced auto-save prevents data loss | ✅ 1/2 |
| UC-45 | Watcher Error Recovery | Handling chokidar errors gracefully | ⏭️ 0/1 (chokidar) |
| UC-46 | Watcher Close Timeout | Preventing hanging on unresponsive filesystems | ⏭️ 0/1 (chokidar) |

---

## Feature 1: Core Synchronization

> Covers the three sync directions (source-only, vault-only, bidirectional), subfolder depth, and new directory detection.
>
> **Test file:** `tests/acceptance/feature1-core-sync.test.ts` — 5 passing, 8 skipped

### UC-01: Source-Only Sync (external → vault)

> As a user, I want files from an external folder to be automatically imported into my vault so that I can work with them in Obsidian.

**Scenario 1.1: New file appears in source folder** ⏭️ *Requires MappingWatcher + chokidar*
```gherkin
Given a mapping with syncDirection "source-only"
  And the source folder is "/external/notes"
  And the target folder is "vault/imported"
When a new file "report.md" is created in "/external/notes"
Then "vault/imported/report.md" should be created in the vault
  And the status bar should show 1 file processed
```

**Scenario 1.2: Existing file is modified in source folder** ⏭️ *Requires MappingWatcher + chokidar*
```gherkin
Given a mapping with syncDirection "source-only"
  And "report.md" exists in both source and vault
When "report.md" is modified in the source folder
Then "vault/imported/report.md" should be updated with the new content
```

**Scenario 1.3: File in subfolder is synced** ⏭️ *Requires MappingWatcher + chokidar*
```gherkin
Given a mapping with syncDirection "source-only" and watchSubfolders enabled
When a file "sub/deep/file.md" is created in the source folder
Then "vault/imported/sub/deep/file.md" should be created
  And all intermediate folders should be created automatically
```

**Scenario 1.4: Vault changes are NOT pushed back to source** ✅
```gherkin
Given a mapping with syncDirection "source-only"
When a file is modified in the vault target folder
Then no changes should be written to the external source folder
  And the VaultWatcher should NOT be started for this mapping
```

---

### UC-02: Vault-Only Sync (vault → external)

> As a user, I want files in a vault folder to be automatically exported to an external folder so that I can share them with other tools.

**Scenario 2.1: File modified in vault is exported** ✅
```gherkin
Given a mapping with syncDirection "vault-only"
  And the target folder is "vault/export"
  And the source folder is "/external/output"
When "notes.md" is modified inside "vault/export"
Then "/external/output/notes.md" should be updated
```

**Scenario 2.2: New file created in vault is exported** ✅
```gherkin
Given a mapping with syncDirection "vault-only"
When a new file "new.md" is created inside the vault target folder
Then the file should be written to the external source folder
```

**Scenario 2.3: External changes are NOT pulled into vault** ⏭️ *Requires WatcherManager integration*
```gherkin
Given a mapping with syncDirection "vault-only"
When a file is created in the external source folder
Then no changes should appear in the vault target folder
  And the MappingWatcher should NOT be started for this mapping
```

---

### UC-03: Bidirectional Sync

> As a user, I want changes in either direction to be synced so that I can edit files from both Obsidian and external editors.

**Scenario 3.1: Source change syncs to vault** ⏭️ *Requires MappingWatcher + chokidar*
```gherkin
Given a mapping with syncDirection "bidirectional"
When a file is modified in the source folder
Then the change should appear in the vault target folder
```

**Scenario 3.2: Vault change syncs to source** ✅
```gherkin
Given a mapping with syncDirection "bidirectional"
When a file is modified in the vault target folder
Then the change should appear in the external source folder
```

**Scenario 3.3: Changes do not ping-pong infinitely** ✅
```gherkin
Given a mapping with syncDirection "bidirectional"
When a file is modified in the source folder
  And the change is synced to the vault
Then the vault-side event should NOT trigger a reverse sync back to source
  And the loop detector should block the reverse event within its 5-second cooldown
```

---

### UC-04: Subfolder Watching

> As a user, I want the option to watch only the top-level folder or include all subfolders.

**Scenario 4.1: Subfolders included when enabled** ⏭️ *Requires MappingWatcher + chokidar*
```gherkin
Given a mapping with watchSubfolders: true
When a file "sub/deep/file.md" is created in the source
Then it should be synced to "vault/imported/sub/deep/file.md"
```

**Scenario 4.2: Subfolders excluded when disabled** ⏭️ *Requires MappingWatcher + chokidar depth config*
```gherkin
Given a mapping with watchSubfolders: false
When a file "subfolder/file.md" is created in the source
Then it should NOT be synced (only root-level files are watched)
  And chokidar should be configured with depth: 0
```

---

### UC-05: New Directory Detection

> As a user, I want new directories created in the source to be automatically scanned and synced.

**Scenario 5.1: New directory triggers incremental reconcile** ⏭️ *Requires MappingWatcher + chokidar*
```gherkin
Given a mapping with watchSubfolders: true
When a new directory "new-folder" is created in the source
  And files are placed inside it
Then the files should be synced after a short debounce
```

**Scenario 5.2: Directory events are debounced** ⏭️ *Requires MappingWatcher + chokidar*
```gherkin
Given a mapping with debounceDelay 500ms
When a directory "batch-folder" is created
Then processing should wait at least 250ms (minimum dir debounce)
  And all files in the directory should be synced in one batch
```

**Scenario 5.3: Directory queue has backpressure limit** ⏭️ *Requires MappingWatcher + chokidar*
```gherkin
Given the pending directory queue has 100 entries (MAX_PENDING_DIRS)
When another new directory event arrives
Then the new event should be dropped
  And the dropped job count should increment
```

---

## Feature 2: Conflict Resolution

> Covers how the plugin handles cases where a file exists in both source and target with different content.
>
> **Test file:** `tests/acceptance/feature2-conflict-resolution.test.ts` — 9 passing, 1 skipped

### UC-06: Conflict Resolution — Overwrite

> As a user who always wants the latest written version, I want conflicts to be resolved by overwriting the target.

**Scenario 6.1: Source overwrites vault file** ✅
```gherkin
Given a mapping with conflictResolution "overwrite"
  And "file.md" exists in both source and vault with different content
When the source file triggers a sync
Then the vault file should be overwritten with source content
```

**Scenario 6.2: Vault overwrites source file (reverse)** ⏭️ *Requires vault.adapter.stat + fsp.stat mocking*
```gherkin
Given a bidirectional mapping with conflictResolution "overwrite"
  And "file.md" exists in both vault and source with different content
When the vault file triggers a reverse sync
Then the source file should be overwritten with vault content
```

---

### UC-07: Conflict Resolution — Skip

> As a user, I never want existing files to be overwritten.

**Scenario 7.1: Existing vault file is not overwritten** ✅
```gherkin
Given a mapping with conflictResolution "skip"
  And "file.md" already exists in the vault target folder
When the source file triggers a sync
Then the vault file should NOT be modified
  And the file should be counted as skipped
```

---

### UC-08: Conflict Resolution — Keep Newer

> As a user, I want the most recently modified version to win.

**Scenario 8.1: Source is newer — overwrites vault** ✅
```gherkin
Given a mapping with conflictResolution "keepNewer"
  And source "file.md" has mtime 2024-01-15 14:00:00
  And vault "file.md" has mtime 2024-01-15 12:00:00
When the source file triggers a sync
Then the vault file should be overwritten (source is newer)
```

**Scenario 8.2: Vault is newer — source is skipped** ✅
```gherkin
Given a mapping with conflictResolution "keepNewer"
  And source "file.md" has mtime 2024-01-15 10:00:00
  And vault "file.md" has mtime 2024-01-15 14:00:00
When the source file triggers a sync
Then the vault file should NOT be modified (target is newer)
  And the file should be counted as skipped
```

**Scenario 8.3: Target does not exist — always syncs** ✅
```gherkin
Given a mapping with conflictResolution "keepNewer"
  And "file.md" does NOT exist in the vault
When the source file triggers a sync
Then the vault file should be created
```

---

### UC-09: Conflict Resolution — Rename

> As a user, I want both versions preserved when a conflict occurs.

**Scenario 9.1: Conflict generates timestamped copy** ✅
```gherkin
Given a mapping with conflictResolution "rename"
  And "file.md" already exists in the vault
When the source file triggers a sync
Then a new file "file (conflict 2024-01-15 14-30-00).md" should be created
  And the original vault file should remain untouched
```

**Scenario 9.2: Multiple rename collisions increment counter inside parentheses** ✅
```gherkin
Given a mapping with conflictResolution "rename"
  And "file.md" and "file (conflict 2024-01-15 14-30-00).md" both exist
When the source file triggers a sync
Then a new file "file (conflict 2024-01-15 14-30-00 2).md" should be created
  And the counter increments inside the parentheses up to 1000 attempts
```

---

### UC-10: Reverse Conflict Resolution

> As a user, I want different conflict behavior for vault→source sync.

**Scenario 10.1: Reverse uses its own strategy** ✅
```gherkin
Given a bidirectional mapping
  And conflictResolution is "overwrite"
  And reverseConflictResolution is "skip"
When the vault file triggers a reverse sync
  And the source file already exists
Then the source file should NOT be overwritten (reverse uses "skip")
```

**Scenario 10.2: Reverse falls back to forward strategy if unset** ✅
```gherkin
Given a bidirectional mapping
  And conflictResolution is "keepNewer"
  And reverseConflictResolution is not set
When the vault file triggers a reverse sync
Then "keepNewer" should be used for the reverse direction
```

---

## Feature 3: Deletion & Move Handling

> Covers how the plugin handles file deletions and renames in both sync directions.
>
> **Test file:** `tests/acceptance/feature3-deletion-move.test.ts` — 6 passing, 10 skipped

### UC-11: Deletion Handling — Ignore

> As a user, I do not want deletions to propagate.

**Scenario 11.1: Deleted source file remains in vault** ⏭️ *Requires MappingWatcher + chokidar*
```gherkin
Given a mapping with deletionHandling "ignore"
When "file.md" is deleted from the source folder
Then "vault/imported/file.md" should still exist in the vault
```

**Scenario 11.2: Deleted vault file remains in source** ✅
```gherkin
Given a bidirectional mapping with deletionHandling "ignore"
When "file.md" is deleted from the vault target folder
Then "/external/file.md" should still exist in the source
```

---

### UC-12: Deletion Handling — Trash

> As a user, I want deletions to be synced by moving files to trash.

**Scenario 12.1: Deleted source file is trashed in vault** ⏭️ *Requires MappingWatcher + chokidar*
```gherkin
Given a mapping with deletionHandling "trash"
When "file.md" is deleted from the source folder
Then "vault/imported/file.md" should be moved to Obsidian trash (via vault.trash)
```

**Scenario 12.2: Deleted vault file is trashed in source** ✅
```gherkin
Given a bidirectional mapping with deletionHandling "trash"
When "file.md" is deleted from the vault target folder
Then the corresponding source file should be moved to the .sync-trash/ directory
  And a timestamp suffix should be appended if a file with the same name already exists in .sync-trash/
```

---

### UC-13: Move Detection

> As a user, I want file renames/moves to be detected as a single operation rather than a delete followed by an add.

**Scenario 13.1: File renamed in source is detected as move** ⏭️ *Requires MappingWatcher + chokidar*
```gherkin
Given a mapping with deletionHandling "trash" and detectMoves enabled
  And "old-name.md" (size 1024 bytes) was previously synced
When "old-name.md" is deleted
  And "new-name.md" (size 1024 bytes, same extension) is created within 2 seconds
Then a single "move" operation should be performed
  And "vault/imported/old-name.md" should be renamed to "vault/imported/new-name.md"
```

**Scenario 13.2: Files with same size but different extension are NOT matched** ⏭️ *Requires MappingWatcher + chokidar*
```gherkin
Given a mapping with detectMoves enabled
  And "report.md" (size 500 bytes) is deleted
  And "image.png" (size 500 bytes) is created within 2 seconds
Then they should NOT be matched as a move
  And separate delete and add operations should be performed
```

**Scenario 13.3: Move window expires** ⏭️ *Requires MappingWatcher + chokidar*
```gherkin
Given a mapping with detectMoves enabled
  And "file.md" is deleted
When more than 2 seconds pass without a matching add
Then the delete should be processed as a regular deletion
```

**Scenario 13.4: Move detection without size info falls back to delete** ⏭️ *Requires MappingWatcher + chokidar*
```gherkin
Given a mapping with detectMoves enabled
  And no prior sync state exists for "file.md" (size = 0)
When "file.md" is deleted
Then the delete should be processed immediately via normal debounce (no buffering for move match)
```

**Scenario 13.5: Vault-side rename detected as move** ✅
```gherkin
Given a bidirectional mapping with deletionHandling "trash"
When "vault/imported/old.md" is renamed to "vault/imported/new.md" within the vault
Then the source file should be renamed from "old.md" to "new.md" via syncMoveReverse
```

**Scenario 13.6: File moved out of vault target folder** ✅
```gherkin
Given a bidirectional mapping with deletionHandling "trash"
When "vault/imported/file.md" is moved to "vault/other/file.md"
Then the original source file should be deleted (treated as removal from scope)
```

**Scenario 13.7: File moved into vault target folder** ✅
```gherkin
Given a bidirectional mapping
When "vault/other/file.md" is moved to "vault/imported/file.md"
Then the file should be synced to the source folder (treated as new addition)
```

---

### UC-14: Orphan Cleanup

> As a user, I want vault files that no longer have a source counterpart to be cleaned up during reconciliation.

**Scenario 14.1: Orphaned vault file is trashed** ⏭️ *Requires FileSyncService + vault integration*
```gherkin
Given a mapping with deletionHandling "trash"
  And "vault/imported/orphan.md" exists in the vault
  And "orphan.md" does NOT exist in the source folder
When reconciliation runs
Then "vault/imported/orphan.md" should be trashed
```

**Scenario 14.2: Files matching source are kept** ⏭️ *Requires FileSyncService + vault integration*
```gherkin
Given a mapping with deletionHandling "trash"
  And "vault/imported/keep.md" exists in both vault and source
When reconciliation runs
Then "vault/imported/keep.md" should NOT be trashed
```

**Scenario 14.3: Extension filter is respected during cleanup** ⏭️ *Requires FileSyncService + vault integration*
```gherkin
Given a mapping with deletionHandling "trash" and fileExtensions [".md"]
  And "vault/imported/data.csv" exists in the vault but not in source
When reconciliation runs
Then "vault/imported/data.csv" should NOT be trashed (not in filter scope)
```

**Scenario 14.4: Exclude patterns respected during cleanup** ⏭️ *Requires FileSyncService + vault integration*
```gherkin
Given a mapping with deletionHandling "trash" and excludePatterns ["*.log"]
  And "vault/imported/debug.log" exists in vault but not in source
When reconciliation runs
Then "vault/imported/debug.log" should NOT be trashed (matches exclude pattern)
```

**Scenario 14.5: Trash failure is handled gracefully** ⏭️ *Requires FileSyncService + vault integration*
```gherkin
Given a mapping with deletionHandling "trash"
  And trash fails for "vault/imported/locked.md"
When reconciliation runs
Then the error count should increment
  And processing of other files should continue
```

---

## Feature 4: File Filtering

> Covers which files are included or excluded from sync operations based on extension, pattern, type, and link status.
>
> **Test file:** `tests/acceptance/feature4-file-filtering.test.ts` — 19 passing, 2 skipped

### UC-15: File Extension Filtering

> As a user, I only want specific file types to be synced.

**Scenario 15.1: Allowed extensions are synced** ✅
```gherkin
Given a mapping with fileExtensions [".md", ".txt"]
When "notes.md" is created in the source folder
Then "vault/imported/notes.md" should be synced
```

**Scenario 15.2: Non-matching extensions are ignored** ✅
```gherkin
Given a mapping with fileExtensions [".md"]
When "image.png" is created in the source folder
Then "vault/imported/image.png" should NOT be created
```

**Scenario 15.3: Empty extension list means all files allowed** ✅
```gherkin
Given a mapping with fileExtensions []
When "anything.xyz" is created in the source folder
Then the file should be synced regardless of extension
```

**Scenario 15.4: Files without extension are rejected when filter is active** ✅
```gherkin
Given a mapping with fileExtensions [".md"]
When a file "Makefile" (no extension) is created in the source folder
Then it should NOT be synced
```

**Scenario 15.5: Extension matching is case-insensitive** ✅
```gherkin
Given a mapping with fileExtensions [".md"]
When "README.MD" is created in the source folder
Then the file should be synced (case-insensitive match)
```

---

### UC-16: Exclude Patterns

> As a user, I want to exclude specific files or folders from syncing.

**Scenario 16.1: Exact name pattern match** ✅
```gherkin
Given a mapping with excludePatterns ["node_modules"]
When a file "node_modules/pkg/index.js" appears in the source
Then it should NOT be synced
```

**Scenario 16.2: Wildcard extension match** ✅
```gherkin
Given a mapping with excludePatterns ["*.log"]
When "debug.log" is created in the source folder
Then it should NOT be synced
```

**Scenario 16.3: Double-star glob match** ✅
```gherkin
Given a mapping with excludePatterns ["build/**"]
When "build/output/bundle.js" is created
Then it should NOT be synced
```

**Scenario 16.4: Single-char wildcard match** ✅
```gherkin
Given a mapping with excludePatterns ["file?.txt"]
When "file1.txt" is created
Then it should NOT be synced
But when "file12.txt" is created
Then it SHOULD be synced (? only matches one character)
```

**Scenario 16.5: Empty or whitespace patterns are ignored** ✅
```gherkin
Given a mapping with excludePatterns ["", "  "]
When any file is created in the source
Then it should be synced normally (empty patterns have no effect)
```

---

### UC-17: Temp File / System File Filtering

> As a user, I do not want temporary or system files to be synced.

**Scenario 17.1: Office lock files are ignored** ✅
```gherkin
Given ignoreOneDriveTemp is enabled
When "~$document.docx" is created in the source folder
Then it should NOT be synced
```

**Scenario 17.2: Temporary file extensions are ignored** ✅
```gherkin
Given ignoreOneDriveTemp is enabled
When "data.tmp" is created in the source folder
Then it should NOT be synced
  And files with .temp, .swp, .partial, .crdownload extensions should also be ignored
```

**Scenario 17.3: System files are ignored** ✅
```gherkin
Given ignoreOneDriveTemp is enabled
When "thumbs.db" or ".DS_Store" or "desktop.ini" appears
Then it should NOT be synced
```

**Scenario 17.4: Partial downloads are ignored** ✅
```gherkin
Given ignoreOneDriveTemp is enabled
When "installer.crdownload" or "archive.partial" appears
Then it should NOT be synced
```

**Scenario 17.5: Regular files starting with ~ are NOT filtered if they have an extension** ✅
```gherkin
Given ignoreOneDriveTemp is enabled
When "~notes.txt" is created
Then it SHOULD be synced (has an extension, not a bare tilde prefix)
  And only "~filename" without any "." is treated as a generic temp file
```

---

### UC-18: Dotfile Filtering

> As a user, I do not want hidden files and directories (starting with ".") to be synced, since they are typically configuration or metadata that should stay local.

**Scenario 18.1: Dotfiles in source root are ignored** ✅
```gherkin
Given a mapping with any syncDirection
When ".gitignore" or ".env" is created in the source folder
Then it should NOT be synced
```

**Scenario 18.2: Dot-directories and their contents are ignored** ✅
```gherkin
Given a mapping with watchSubfolders: true
When files are created inside ".git/", ".obsidian/", or ".vscode/"
Then no files from those directories should be synced
```

**Scenario 18.3: Regular files in regular folders are unaffected** ✅
```gherkin
Given a mapping with any syncDirection
When "readme.md" is created in a folder "docs/"
Then it should be synced normally (dotfile filter only applies to names starting with ".")
```

---

### UC-19: Symlink Protection

> As a user, I expect symlinks to be safely skipped to prevent loops and unexpected behavior.

**Scenario 19.1: Symlinked file is skipped during sync** ⏭️ *Requires real filesystem symlink*
```gherkin
Given a file "link.md" in the source folder is a symbolic link
When the watcher detects a change to "link.md"
Then the file should be skipped
  And a debug log should note it was a symlink
  And the skipped count should increment
```

**Scenario 19.2: Symlinked directory is skipped during walk** ⏭️ *Requires real filesystem symlink*
```gherkin
Given a directory "linked-dir" in the source is a symbolic link
When a new directory event fires for "linked-dir"
Then "linked-dir" and its contents should be skipped entirely
```

**Scenario 19.3: Symlink check is skipped for deleted files** ✅
```gherkin
Given a file "removed.md" has been deleted from the source
When the delete event is processed
Then no symlink check should occur (the file no longer exists on disk)
```

---

## Feature 5: Reconciliation

> Covers bulk catchup sync operations that scan entire folders, including startup reconciliation, incremental mode, parallelism, and cancellation.
>
> **Test file:** `tests/acceptance/feature5-reconciliation.test.ts` — 8 passing, 6 skipped

### UC-20: Reconciliation on Start

> As a user, I want the plugin to catch up on any changes I missed while Obsidian was closed.

**Scenario 20.1: New source files are synced on startup** ✅
```gherkin
Given syncOnStart is enabled
  And mapping.reconcileOnStart is true
  And new files were added to the source folder while Obsidian was closed
When the plugin loads
Then all new source files should be synced to the vault
```

**Scenario 20.2: Reconcile is skipped for disabled mappings** ✅
```gherkin
Given syncOnStart is enabled
  And a mapping is disabled (enabled: false)
When the plugin loads
Then that mapping should NOT be reconciled
```

**Scenario 20.3: Reconcile is skipped when reconcileOnStart is false** ✅
```gherkin
Given syncOnStart is enabled
  And a mapping has reconcileOnStart: false
When the plugin loads
Then that mapping should NOT be reconciled
```

**Scenario 20.4: Reconcile blocks watchers during execution** ⏭️ *Requires WatcherManager + AsyncMutex integration*
```gherkin
Given reconciliation is in progress for a mapping
When a file change event occurs in that mapping's source folder
Then the event should be queued (operation lock prevents concurrent processing)
  And the watcher should resume processing after reconciliation completes
```

---

### UC-21: Incremental Reconciliation

> As a user, I want reconciliation to be fast by skipping files that haven't changed since the last run.

**Scenario 21.1: Unchanged files are skipped** ✅
```gherkin
Given incremental mode is enabled
  And "file.md" was synced in the last reconciliation with mtime 1000 and size 500
  And "file.md" still has mtime 1000 and size 500
  And "vault/imported/file.md" exists
When reconciliation runs
Then "file.md" should be skipped (unchanged)
```

**Scenario 21.2: Modified file is re-synced** ✅ *(also tests size change variant)*
```gherkin
Given incremental mode is enabled
  And "file.md" was synced with mtime 1000
  And "file.md" now has mtime 2000
When reconciliation runs
Then "file.md" should be synced again
```

**Scenario 21.3: Missing vault target triggers re-sync even if source unchanged** ⏭️ *Requires FileSyncService + vault adapter integration*
```gherkin
Given incremental mode is enabled
  And "file.md" source is unchanged since last reconcile
  And "vault/imported/file.md" has been manually deleted
When reconciliation runs
Then "file.md" should be re-synced (target missing)
```

**Scenario 21.4: Sync state is persisted after reconciliation** ⏭️ *Requires filesystem write verification*
```gherkin
Given incremental mode is enabled
When reconciliation completes successfully
Then updated mtime/size info for all processed files should be saved to disk
```

---

### UC-22: Reconcile Worker Parallelism

> As a user, I want reconciliation to be fast by processing multiple files in parallel.

**Scenario 22.1: Multiple files processed concurrently** ⏭️ *Requires FileSyncService + concurrency tracking*
```gherkin
Given reconcile parallelism is set to 4
  And 100 files need to be synced
When reconciliation runs
Then up to 4 files should be processed simultaneously
  And all 100 files should be processed by the end
```

**Scenario 22.2: Individual file errors don't stop other files** ✅
```gherkin
Given a file fails to sync during reconciliation
When other files are being processed in parallel
Then the failed file should increment the error count
  And other files should continue processing normally
```

---

### UC-23: Cancel Reconciliation

> As a user, I want to be able to stop a running reconciliation if it takes too long or I made a mistake.

**Scenario 23.1: User cancels from dashboard** ✅
```gherkin
Given reconciliation is in progress
When the user clicks Cancel in the dashboard
Then the current file should finish processing (cooperative cancellation)
  And no further files should be processed
  And the reconcile phase should change to "cancelled"
```

**Scenario 23.2: Stats reflect partial completion** *(tested implicitly via 23.1)*
```gherkin
Given reconciliation was cancelled after processing 50 of 200 files
Then the stats should show 50 processed
  And the remaining 150 files should not be counted as skipped or errors
```

---

### UC-24: Concurrent Reconcile Guard

> As a user, I expect that triggering reconciliation while another is already running does not cause conflicts.

**Scenario 24.1: Second reconcile call is ignored** ✅
```gherkin
Given reconciliation is already running
When reconcileAll() is called again (via settings or dashboard)
Then the second call should return immediately without action
  And the first reconciliation should continue unaffected
```

---

## Feature 6: Reliability & Performance

> Covers mechanisms that ensure sync operations are reliable and performant: stability checks, retry, loop prevention, debounce, and backpressure.
>
> **Test file:** `tests/acceptance/feature6-reliability.test.ts` — 14 passing, 3 skipped

### UC-25: File Stability Checks

> As a user syncing from a OneDrive / Dropbox folder, I want the plugin to wait until files are fully downloaded before syncing.

**Scenario 25.1: Unstable file is delayed until stable** ⏭️ *Requires FileSyncService.verifyStability with multi-stat mocking*
```gherkin
Given verifyFileStability is enabled
  And stabilityChecks is 3
  And stabilityCheckInterval is 500ms
When "file.md" is created and its mtime keeps changing (cloud sync in progress)
Then the sync should wait until 3 consecutive stat checks show the same mtime/size
```

**Scenario 25.2: File that never stabilizes is skipped** ⏭️ *Requires FileSyncService.verifyStability*
```gherkin
Given verifyFileStability is enabled
When a file's mtime continues changing through all stability checks
Then the file should be skipped with reason "not_stable"
```

**Scenario 25.3: Stability checks disabled during reconciliation** ⏭️ *Requires ReconcileService + FileSyncService integration*
```gherkin
Given disableStabilityCheckDuringReconcile is true (default)
When reconciliation processes files
Then stability checks should be skipped for faster processing
```

---

### UC-26: Retry on Transient Errors

> As a user, I want the plugin to automatically retry when it encounters temporary filesystem errors.

**Scenario 26.1: File locked by another process is retried** ✅ *(also tests EAGAIN, EMFILE, ENFILE, ENOTEMPTY + message patterns)*
```gherkin
Given a file read fails with error code EBUSY
When the retry logic kicks in
Then the operation should be retried up to 3 times (maxRetries default)
  And the delay between retries should increase exponentially (baseDelayMs=100, capped at maxDelayMs=2000)
  And delays should include ±25% jitter to prevent thundering herd
```

**Scenario 26.2: File-not-found is NOT retried** ✅ *(also tests EACCES, EEXIST)*
```gherkin
Given a file read fails with error code ENOENT
When the error is evaluated
Then no retry should be attempted (permanent error)
  And EACCES, EEXIST are also treated as permanent
```

**Scenario 26.3: Retry succeeds on second attempt** ✅ *(also tests maxRetries exhausted + onRetry callback)*
```gherkin
Given a file read fails once with EBUSY
  And succeeds on the second attempt
Then the file should be synced successfully
  And a debug log should record the retry
```

---

### UC-27: Sync Loop Prevention

> As a user with bidirectional sync, I expect that a single file edit does not bounce back and forth endlessly.

**Scenario 27.1: Forward sync blocks immediate reverse** ✅
```gherkin
Given a bidirectional mapping
When a source file change is synced to the vault
Then the resulting vault event should be blocked by the loop detector
  And no reverse sync should occur for that file within 5 seconds (COOLDOWN_MS)
```

**Scenario 27.2: Reverse sync blocks immediate forward** *(covered by 27.1 — symmetric behavior)*
```gherkin
Given a bidirectional mapping
When a vault file change is synced to the source
Then the resulting source event should be blocked by the loop detector
```

**Scenario 27.3: After cooldown expires, sync resumes** ✅
```gherkin
Given a file was synced 6 seconds ago
When the same file is modified again
Then the sync should proceed normally (cooldown expired)
```

**Scenario 27.4: Path normalization ensures consistent matching** ✅
```gherkin
Given forward sync records "C:\Users\Name\File.MD"
When reverse sync checks "c:/users/name/file.md"
Then the loop detector should match (case-insensitive, separator-normalized via toLowerCase + replace)
```

**Scenario 27.5: Stale entries are cleaned up periodically** ✅
```gherkin
Given loop detector entries older than 10 seconds exist (2x COOLDOWN_MS)
When the cleanup interval fires (every 60 seconds)
Then those stale entries should be removed from memory
```

---

### UC-28: Debounce Behavior

> As a user, I want rapid file saves to be consolidated into a single sync operation.

**Scenario 28.1: Multiple rapid edits produce one sync** ✅
```gherkin
Given a mapping with debounceDelay 800ms
When "file.md" is saved 5 times within 500ms
Then only 1 sync operation should be performed (after the debounce settles)
```

**Scenario 28.2: Reverse sync uses minimum 1500ms debounce** ✅
```gherkin
Given a bidirectional mapping with debounceDelay 200ms
When a vault file is modified
Then the reverse sync should wait at least 1500ms before processing (MIN_REVERSE_DEBOUNCE_MS)
```

---

### UC-29: Backpressure / Queue Limits

> As a user with a very active folder, I do not want the plugin to consume unbounded memory.

**Scenario 29.1: Queue at capacity drops new jobs** ✅
```gherkin
Given the pending queue has 1000 jobs (MAX_PENDING_JOBS)
When a new file event arrives
Then the new event should be dropped
  And the dropped job count should increment
  And a warning should be logged
  And the skipped count should increment
```

**Scenario 29.2: Existing job in queue is updated (not duplicated)** ✅
```gherkin
Given "file.md" is already in the pending queue
When "file.md" is modified again before the debounce fires
Then the existing timer should be reset
  And the queue size should remain the same
```

---

## Feature 7: Safety & Validation

> Covers mechanisms that prevent data loss, security issues, and platform-specific path problems.
>
> **Test file:** `tests/acceptance/feature7-safety.test.ts` — 10 passing, 8 skipped

### UC-30: File Size Limit

> As a user, I do not want the plugin to crash by trying to load a multi-gigabyte file into memory.

**Scenario 30.1: File over 100MB is skipped (forward sync)** ⏭️ *Requires FileSyncService.syncFileInternal with fsp.stat mocking*
```gherkin
Given a source file "huge.bin" is 150 MB
When the watcher tries to sync it to the vault
Then the file should be skipped with reason "file_too_large"
  And a warning should be logged with the file size and the 100MB limit (MAX_FILE_SIZE_BYTES)
```

**Scenario 30.2: File over 100MB is skipped (reverse sync)** ⏭️ *Requires FileSyncService.syncFileReverse with vault binary read*
```gherkin
Given a vault file "huge.bin" is 150 MB
When the reverse sync tries to export it to the source
Then the file should be skipped with reason "file_too_large"
```

**Scenario 30.3: File under 100MB is synced normally** ⏭️ *Requires FileSyncService integration*
```gherkin
Given a source file "normal.md" is 50 KB
When the watcher syncs it
Then the file should be synced successfully
```

---

### UC-31: Path Traversal Protection

> As a user, I expect the plugin to prevent files from being written outside the designated folders.

**Scenario 31.1: Source path escaping base folder is blocked** ✅ *(also tests valid source path does not throw)*
```gherkin
Given a mapping with sourceFolder "/safe/folder"
When a path "/safe/folder/../../etc/passwd" is computed
Then a PathTraversalError should be thrown
  And the file should NOT be written
```

**Scenario 31.2: Target path escaping vault folder is blocked** ✅ *(also tests valid target path does not throw + PathTraversalError properties)*
```gherkin
Given a mapping with targetFolder "vault/imported"
When a computed target path resolves to "vault/other/file.md"
Then a PathTraversalError should be thrown
```

---

### UC-32: Windows Path Length Validation

> As a user on Windows, I want the plugin to warn me when file paths exceed the 260-character MAX_PATH limit.

**Scenario 32.1: Source path exceeding 260 chars is rejected** ✅ *(Windows-only, conditional test)*
```gherkin
Given the platform is Windows
  And a source file has a full path of 270 characters
When the path is validated
Then an error should be thrown indicating the path is too long
```

**Scenario 32.2: Target path exceeding 260 chars is rejected** ✅ *(Windows-only, conditional test)*
```gherkin
Given the platform is Windows
  And a computed vault target path is 265 characters
When the path is validated
Then an error should be thrown
```

**Scenario 32.3: Paths under 260 chars pass validation** ✅
```gherkin
Given a file path of 200 characters
When the path is validated
Then no error should be thrown
```

---

### UC-33: Unicode Path Normalization

> As a user working across macOS and Windows, I want paths with accented characters to match correctly regardless of Unicode encoding form.

**Scenario 33.1: NFD path from macOS is normalized to NFC** ✅ *(also tests backslash conversion + combined NFD+backslash)*
```gherkin
Given a macOS file system returns "cafe\u0301" (NFD: e + combining accent)
When the path is processed through toVaultPath
Then it should become "caf\u00e9" (NFC: precomposed e-acute)
  And vault path comparisons should match correctly
```

**Scenario 33.2: NFC paths are unchanged** ✅
```gherkin
Given a Windows file system returns "caf\u00e9" (already NFC)
When the path is processed through toVaultPath
Then it should remain "caf\u00e9" unchanged
```

---

### UC-34: Source Folder Validation

> As a user, I want the plugin to notify me when a configured source folder does not exist rather than silently failing.

**Scenario 34.1: Missing source folder prevents watcher start** ⏭️ *Requires MappingWatcher with fs.existsSync mocking*
```gherkin
Given a mapping with sourceFolder "/nonexistent/path"
When the watcher tries to start
Then the watcher should NOT start
  And an error notice should be shown: 'Mapping "...": source folder missing'
  And the error count should increment
```

**Scenario 34.2: Empty source folder prevents watcher start** ⏭️ *Requires MappingWatcher integration*
```gherkin
Given a mapping with sourceFolder ""
When the watcher tries to start
Then the watcher should NOT start (same as missing)
```

---

### UC-35: Overlapping Mapping Validation

> As a user, I want to be warned when two mappings target the same vault folder to prevent data conflicts.

**Scenario 35.1: Identical target folders are rejected** ⏭️ *Requires FolderMappingModal UI*
```gherkin
Given mapping A targets "vault/imported"
When creating mapping B that also targets "vault/imported"
Then validation should fail with "Target folder overlaps with mapping A"
```

**Scenario 35.2: Nested target folders are rejected** ⏭️ *Requires FolderMappingModal UI*
```gherkin
Given mapping A targets "vault/imported"
When creating mapping B that targets "vault/imported/sub"
Then validation should fail (nested target folders conflict)
```

**Scenario 35.3: Non-overlapping target folders are accepted** ⏭️ *Requires FolderMappingModal UI*
```gherkin
Given mapping A targets "vault/notes"
When creating mapping B that targets "vault/docs"
Then validation should pass
```

---

## Feature 8: Settings & Configuration

> Covers mapping management and watcher configuration options.
>
> **Test file:** `tests/acceptance/feature8-10-settings-ui-persistence.test.ts` — 11 passing, 18 skipped

### UC-36: Mapping CRUD (Create / Edit / Delete)

> As a user, I want to create, edit, and delete folder mappings through the settings UI.

**Scenario 36.1: Create new mapping** ⏭️ *Requires Obsidian Modal + DOM*
```gherkin
Given the settings modal is open in "create" mode
When the user fills in sourceFolder and targetFolder
  And clicks Save
Then a new mapping with a generated UUID should be added to settings
  And the watcher should start for the new mapping
```

**Scenario 36.2: Edit existing mapping** ⏭️ *Requires Obsidian Modal + DOM*
```gherkin
Given the settings modal is open in "edit" mode for an existing mapping
When the user changes the debounceDelay from 800 to 1500
  And clicks Save
Then the mapping should be updated in settings
  And the watcher should restart with the new configuration
```

**Scenario 36.3: Delete mapping** ⏭️ *Requires Obsidian ConfirmModal + DOM*
```gherkin
Given the settings modal shows a Delete button
When the user clicks Delete and confirms via ConfirmModal
Then the mapping should be removed from settings
  And the watcher for that mapping should be stopped
```

**Scenario 36.4: Validation rejects empty folders** ⏭️ *Requires FolderMappingModal.validateMapping*
```gherkin
Given the create modal is open
When the user leaves sourceFolder empty and clicks Save
Then an error notice "Source folder is required" should be shown
  And the mapping should NOT be saved
```

---

### UC-37: Polling Mode

> As a user syncing from a NAS or network drive, I want an alternative to inotify-based file watching.

**Scenario 37.1: Polling detects file changes** ⏭️ *Requires MappingWatcher + chokidar polling mode*
```gherkin
Given a mapping with usePolling enabled and pollingInterval 500ms
When a file is created in the source folder
Then the change should be detected within one polling interval
  And the file should be synced to the vault
```

**Scenario 37.2: Polling interval is respected** ⏭️ *Requires MappingWatcher chokidar config verification*
```gherkin
Given pollingInterval is set to 1000ms
When the watcher is started
Then chokidar should be configured with usePolling: true and interval: 1000
```

---

## Feature 9: User Interface

> Covers status bar, dashboard, commands, and health indicators that let the user monitor and control the plugin.
>
> **Test file:** `tests/acceptance/feature8-10-settings-ui-persistence.test.ts` (shared)
> All UI scenarios require Obsidian DOM and are currently skipped.

### UC-38: Status Bar Display

> As a user, I want to see at a glance how many files are being watched and how many have been processed.

**Scenario 38.1: Normal mode shows stats** ⏭️ *Requires StatusBarService + DOM*
```gherkin
Given 2 watchers are active watching 5000 files
  And 150 files have been processed, 300 skipped, 2 errors
Then the status bar should display sync counts in compact format
```

**Scenario 38.2: Clicking status bar opens dashboard** ⏭️ *Requires DOM event handling*
```gherkin
Given the status bar is visible
When the user clicks the status bar item
Then the dashboard modal should open
```

---

### UC-39: Reconcile Progress Reporting

> As a user, I want to see real-time progress during reconciliation.

**Scenario 39.1: Progress shown during reconciliation** ⏭️ *Requires StatusBarService + DOM*
```gherkin
Given reconciliation is running for mapping 1 of 3
  And 120 of 860 files have been scanned
Then the status bar should display reconcile progress with mapping index, file counts, and stats
  And progress updates should be throttled by progressThrottleMs (default 250ms)
```

**Scenario 39.2: Progress clears after reconciliation completes** ⏭️ *Requires StatusBarService + DOM*
```gherkin
Given reconciliation has completed
Then the status bar should return to normal mode display
```

**Scenario 39.3: Per-mapping done notice** ⏭️ *Requires NoticeService + ReconcileService integration*
```gherkin
Given notifyOnMappingDone is enabled (default)
When reconciliation finishes processing a mapping
Then a notice should be shown with the mapping's sync stats
```

---

### UC-40: Dashboard

> As a user, I want a detailed view for managing watchers, viewing logs, and controlling reconciliation.

**Scenario 40.1: Overview tab shows global stats** ⏭️ *Requires Obsidian Modal + DOM*
```gherkin
Given the dashboard is open on the Overview tab
Then it should display: active watchers, watched files, processed/skipped/errors
  And controls: Start/Stop All, Reconcile All, Cancel
  And recent activity log (last 5 entries)
```

**Scenario 40.2: Watchers tab shows per-mapping status** ⏭️ *Requires Obsidian Modal + DOM*
```gherkin
Given the dashboard is open on the Watchers tab
Then each mapping should show: description, source/target folders, health indicator
  And per-watcher controls: Start/Stop, Reconcile, Edit
  And queue stats: pending files, pending dirs, dropped jobs
```

**Scenario 40.3: Logs tab shows filtered log entries** ⏭️ *Requires Obsidian Modal + DOM*
```gherkin
Given the dashboard is open on the Logs tab
Then it should display the last 100 log entries
  And provide level filters (debug, info, warn, error) and a search input
  And a Clear All button
```

---

### UC-41: Commands

> As a user, I want to access common plugin actions via the Obsidian command palette.

**Scenario 41.1: Restart watchers command** ⏭️ *Requires Obsidian Plugin.addCommand*
```gherkin
Given the user opens the command palette
When they execute "filewatcher-restart"
Then all watchers should stop and restart
```

**Scenario 41.2: Open dashboard command** ⏭️ *Requires Obsidian Plugin.addCommand*
```gherkin
Given the user opens the command palette
When they execute "filewatcher-dashboard"
Then the dashboard modal should open
```

---

### UC-42: Watcher Health Monitoring

> As a user, I want to identify at a glance which watchers are healthy, idle, or experiencing issues.

**Scenario 42.1: Healthy watcher** ⏭️ *Requires MappingWatcher + VaultWatcher integration*
```gherkin
Given a watcher is running
  And it received a file event within the last 5 minutes
Then its health should be "healthy"
```

**Scenario 42.2: Idle watcher** ⏭️ *Requires MappingWatcher + VaultWatcher integration*
```gherkin
Given a watcher is running
  And it has NOT received any file event for more than 5 minutes (IDLE_THRESHOLD_MS)
Then its health should be "idle"
```

**Scenario 42.3: Warning state** ⏭️ *Requires MappingWatcher + VaultWatcher integration*
```gherkin
Given a watcher is running
  And it has dropped jobs OR its queue is over 80% full
Then its health should be "warning"
```

**Scenario 42.4: Error state** ⏭️ *Requires MappingWatcher + VaultWatcher integration*
```gherkin
Given a watcher failed to start
Then its health should be "error"
```

---

## Feature 10: Persistence & Error Recovery

> Covers sync state persistence across sessions and graceful handling of watcher errors and shutdowns.
>
> **Test file:** `tests/acceptance/feature8-10-settings-ui-persistence.test.ts` (shared)

### UC-43: SyncState Persistence

> As a user, I want the plugin to remember what was synced so it can resume efficiently.

**Scenario 43.1: State is saved on plugin unload** ⏭️ *Requires filesystem mocking for fsp.writeFile*
```gherkin
Given files have been synced during this session
When the user closes Obsidian
Then sync state should be written to "sync-state.json" in the plugin data directory
```

**Scenario 43.2: State is loaded on plugin startup** ✅ *(tests recordSync + needsSync + getTrackedFileCount)*
```gherkin
Given "sync-state.json" exists from a previous session
When the plugin loads
Then the sync state should be restored
  And incremental reconciliation should use the stored mtime/size data
```

**Scenario 43.3: Corrupted state file is handled gracefully** ⏭️ *Requires filesystem mocking for fsp.readFile returning bad JSON*
```gherkin
Given "sync-state.json" contains invalid JSON
When the plugin loads
Then it should start with fresh (empty) state
  And a warning should be logged
```

**Scenario 43.4: Orphaned entries are pruned after reconciliation** ✅
```gherkin
Given sync state contains an entry for "deleted-file.md"
  And "deleted-file.md" no longer exists in the source folder
When reconciliation completes
Then the entry for "deleted-file.md" should be removed from sync state
```

**Scenario 43.5: State enforces per-mapping file limit** ✅ *(tests getStats mechanism)*
```gherkin
Given a mapping's sync state has 100,000 file entries (MAX_FILES_PER_MAPPING)
When a new file is synced
Then the state should handle the limit gracefully to prevent unbounded growth
```

---

### UC-44: SyncState Auto-Save

> As a user, I want sync state to be saved automatically to prevent data loss if Obsidian crashes.

**Scenario 44.1: Changes trigger debounced auto-save** ✅ *(tests cancelPendingSave clears timer)*
```gherkin
Given a file has been synced and the state is marked dirty
When 5 seconds pass (AUTO_SAVE_DELAY_MS)
Then the sync state should be automatically saved to disk
```

**Scenario 44.2: Rapid changes are consolidated** ⏭️ *Requires filesystem mocking to count disk writes*
```gherkin
Given 50 files are synced within 3 seconds
Then only 1 auto-save should occur (after the debounce settles)
  And not 50 separate disk writes
```

---

### UC-45: Watcher Error Recovery

> As a user, I want the plugin to handle filesystem watcher errors gracefully without crashing.

**Scenario 45.1: Chokidar error is logged and counted** ⏭️ *Requires MappingWatcher with chokidar error emission*
```gherkin
Given a MappingWatcher is running
When chokidar emits an error event (e.g., EACCES on a subdirectory)
Then the error should be logged
  And the error count for that mapping should increment
  And an error notice should be shown to the user
  And the watcher should continue running (not crash)
```

---

### UC-46: Watcher Close Timeout

> As a user, I want the plugin to handle unresponsive filesystems when stopping watchers.

**Scenario 46.1: Slow close is timed out** ⏭️ *Requires MappingWatcher.stop() with hanging chokidar.close()*
```gherkin
Given a MappingWatcher is stopping
  And the underlying chokidar.close() hangs (unresponsive NAS)
When 5 seconds pass (CLOSE_TIMEOUT_MS)
Then the stop operation should complete with a timeout warning
  And Obsidian should not freeze
```

---

## Appendix A: Constants Reference

| Constant | Value | Location |
|----------|-------|----------|
| MAX_PENDING_JOBS | 1,000 | MappingWatcher, VaultWatcher |
| MAX_PENDING_DIRS | 100 | MappingWatcher |
| MAX_FILE_SIZE_BYTES | 100 MB | FileSyncService |
| MAX_TARGET_INDEX_SIZE | 50,000 | FileSyncService |
| MAX_ENSURED_FOLDERS_CACHE_SIZE | 10,000 | FileSyncService |
| MAX_FILES_PER_MAPPING | 100,000 | SyncStateService |
| WIN_MAX_PATH | 260 | utils.ts |
| COOLDOWN_MS | 5,000 ms | SyncLoopDetector |
| CLEANUP_INTERVAL_MS | 60,000 ms | SyncLoopDetector |
| MIN_REVERSE_DEBOUNCE_MS | 1,500 ms | VaultWatcher |
| MOVE_DETECT_WINDOW_MS | 2,000 ms | MappingWatcher |
| CLOSE_TIMEOUT_MS | 5,000 ms | MappingWatcher |
| AUTO_SAVE_DELAY_MS | 5,000 ms | SyncStateService |
| IDLE_THRESHOLD_MS | 300,000 ms (5 min) | WatcherManager |
| RENDER_THROTTLE_MS | 100 ms | StatusBarService |
| LOCK_TIMEOUT_MS | 30,000 ms | AsyncMutex |
| Default debounceDelay | 800 ms | types.ts |
| Default pollingInterval | 300 ms | types.ts |
| Default stabilityChecks | 3 | settings/types.ts |
| Default stabilityCheckInterval | 500 ms | settings/types.ts |
| Default reconcile parallelism | 8 | settings/types.ts |
| Default progressThrottleMs | 250 ms | settings/types.ts |
| Retry maxRetries | 3 | retry.ts |
| Retry baseDelayMs | 100 ms | retry.ts |
| Retry maxDelayMs | 2,000 ms | retry.ts |
| Retry jitter | ±25% | retry.ts |
| Rename MAX_ATTEMPTS | 1,000 | ConflictResolver |

## Appendix B: Test Implementation Status

> Last updated: 2026-02-08 — 452 total tests across 27 test files (82 acceptance + 370 unit/integration)

### Summary by Feature

| Feature | Test File | ✅ Pass | ⏭️ Skip | Total | Coverage |
|---------|-----------|---------|---------|-------|----------|
| 1. Core Sync | `feature1-core-sync.test.ts` | 5 | 8 | 13 | 38% |
| 2. Conflict Resolution | `feature2-conflict-resolution.test.ts` | 9 | 1 | 10 | 90% |
| 3. Deletion & Move | `feature3-deletion-move.test.ts` | 6 | 10 | 16 | 38% |
| 4. File Filtering | `feature4-file-filtering.test.ts` | 19 | 2 | 21 | 90% |
| 5. Reconciliation | `feature5-reconciliation.test.ts` | 8 | 6 | 14 | 57% |
| 6. Reliability | `feature6-reliability.test.ts` | 14 | 3 | 17 | 82% |
| 7. Safety | `feature7-safety.test.ts` | 10 | 8 | 18 | 56% |
| 8-10. Settings/UI/Persistence | `feature8-10-settings-ui-persistence.test.ts` | 11 | 18 | 29 | 38% |
| **Totals** | | **82** | **56** | **138** | **59%** |

### Skip Reasons by Category

| Category | Count | Affected UCs | Unblocking Strategy |
|----------|-------|--------------|---------------------|
| **Chokidar / MappingWatcher** | 19 | UC-01, 04, 05, 11, 12, 13, 34, 37, 45, 46 | Mock chokidar's `watch()` or create filesystem integration test harness |
| **Obsidian DOM / Modal** | 18 | UC-35, 36, 38-41, 42 | Use JSDOM + mock Obsidian API, or E2E testing framework |
| **FileSyncService I/O** | 12 | UC-14, 21, 22, 25, 30, 43, 44 | Mock `fsp.*` at module level (same pattern as Feature 2) |
| **Filesystem / symlinks** | 2 | UC-19 | Create temp symlinks in test setup (`fs.symlinkSync`) |
| **WatcherManager integration** | 5 | UC-02, 20, 42 | Mock WatcherManager's `startAll()` with injected watcher factories |

### Well-Tested Areas (>80% coverage)

- **Conflict Resolution** (UC-06 through UC-10): All 4 strategies + reverse fallback fully tested via ConflictResolver mock
- **File Filtering** (UC-15 through UC-18): All pure utility functions (`isAllowedByExtensions`, `matchesExcludePattern`, `isTempFile`, `createIgnoredMatcher`) directly testable
- **Retry Logic** (UC-26): `isRetryableError` + `withRetry` fully tested with error codes, message patterns, maxRetries, and onRetry callback
- **Sync Loop Prevention** (UC-27): SyncLoopDetector fully tested — recording, cooldown, path normalization, cleanup
- **Debounce & Backpressure** (UC-28, UC-29): VaultWatcher queue behavior fully tested with fake timers

### Additional Non-Scenario Tests

Several test files include extra tests beyond the numbered scenarios:

- **Feature 2:** `createDefaultMapping` default values, `DEFAULT_SETTINGS` structure
- **Feature 6:** Non-Error retryability check, `PathTraversalError` properties
- **Feature 7:** Valid path inverse tests (31.1b, 31.2b), backslash conversion, combined NFD+backslash
- **Feature 8-10:** `clearMapping`, `clearAll`, source folder invalidation, `DEFAULT_MAPPING_VALUES` polling defaults

---

## Appendix C: Test Environment Requirements (Manual Testing)

| Requirement | Details |
|-------------|---------|
| **Obsidian Version** | Latest stable |
| **Platform** | Windows 10/11, macOS, Linux |
| **Source Folder Types** | Local SSD, network share (SMB), cloud-synced (OneDrive/Dropbox) |
| **File Sizes** | Empty, small (1 KB), medium (1 MB), large (50 MB), oversized (150 MB) |
| **File Names** | ASCII, Unicode (accents, CJK), long paths (>200 chars), special chars |
| **Concurrent Editors** | Obsidian + VS Code + external text editor simultaneously |
| **Network Conditions** | Online, offline (for cloud-synced folders), intermittent |
