# Folder Watcher — Data Dictionary

> Audience: End users and configuration authors.
> Source of truth: [`types.ts`](../src/types.ts), [`settings/types.ts`](../src/settings/types.ts)

---

## Concepts

| Term | Meaning |
|------|---------|
| **Mapping** | A rule that links an external folder (source) to a vault folder (target). Each mapping has its own sync direction, filters, and conflict strategy. |
| **Source folder** | An absolute path on the file system, outside the vault (e.g. `C:\Users\Max\OneDrive\Notes`). The plugin watches this folder for changes. |
| **Target folder** | A relative path inside the Obsidian vault (e.g. `imported/onedrive`). Files are synced into this folder. |
| **Forward sync** | Source → Vault. A change in the external folder is copied into the vault. |
| **Reverse sync** | Vault → Source. A change made inside Obsidian is copied back to the external folder. Only active in `bidirectional` or `vault-only` mode. |
| **Reconciliation** | A bulk scan that compares source and vault, syncing any files that are new or changed. Runs on startup or on demand. |
| **Sync state** | A persistent record of each file's last-known modification time and size. Used to skip unchanged files during reconciliation. |
| **Stability check** | Before syncing a newly detected file, the plugin verifies that its size and modification time haven't changed across multiple readings. This prevents importing half-uploaded cloud files. |
| **Debounce** | A short delay after a file change event before the sync actually fires. Multiple rapid edits within the window are collapsed into a single sync. |
| **Conflict** | When a file already exists at the target path and the plugin must decide what to do (overwrite, skip, keep newer, or rename). |
| **Orphan** | A file in the vault whose corresponding source file no longer exists. |
| **Move detection** | When a file is renamed or moved in the source folder, the plugin detects the delete + add pair and treats it as a rename instead. |
| **Loop detection** | After syncing a file in one direction, the plugin blocks the same file from being synced in the opposite direction for a cooldown period (5 seconds). |

---

## Mapping Fields

Each folder mapping has the following configurable fields.

| Field                       | Type   | Default       | Description                                                                                                         |
| --------------------------- | ------ | ------------- | ------------------------------------------------------------------------------------------------------------------- |
| `description`               | text   | *(empty)*     | Friendly name shown in dashboard and status bar.                                                                    |
| `sourceFolder`              | path   | *(required)*  | Absolute path to the external folder to watch.                                                                      |
| `targetFolder`              | path   | *(required)*  | Vault-relative path where synced files are placed.                                                                  |
| `enabled`                   | on/off | on            | Whether this mapping is active. Disabled mappings are ignored.                                                      |
| `syncDirection`             | choice | `source-only` | Direction of sync. See [Sync Direction](#sync-direction).                                                           |
| `watchSubfolders`           | on/off | on            | Also watch and sync files in subdirectories.                                                                        |
| `fileExtensions`            | list   | *(all)*       | Only sync files with these extensions (e.g. `.md, .txt`). Empty means all files.                                    |
| `excludePatterns`           | list   | *(none)*      | Glob patterns to exclude (e.g. `node_modules`, `*.log`, `temp/*`).                                                  |
| `conflictResolution`        | choice | `keepNewer`   | How to handle forward sync conflicts. See [Conflict Resolution](#conflict-resolution).                              |
| `reverseConflictResolution` | choice | `keepNewer`   | How to handle reverse sync conflicts (bidirectional only).                                                          |
| `debounceDelay`             | ms     | `800`         | Delay before processing a change event. Prevents sync storms from rapid saves.                                      |
| `usePolling`                | on/off | off           | Use polling instead of OS file events. More reliable for network/cloud folders, but uses more CPU.                  |
| `pollingInterval`           | ms     | `300`         | How often to check for changes when polling is enabled.                                                             |
| `reconcileOnStart`          | on/off | on            | [[Development/watcher/src/types.ts]]Scan and sync all existing files when the plugin starts.                        |
| `deletionHandling`          | choice | `ignore`      | What to do when a source file is deleted. See [Deletion Handling](#deletion-handling).                              |
| `detectMoves`               | on/off | off           | Detect renames/moves instead of treating them as delete + add. Only active when `deletionHandling` is not `ignore`. |

---

## Sync Direction

| Value | UI Label | Meaning |
|-------|----------|---------|
| `source-only` | Source → Vault (consume only) | External folder changes are imported into the vault. Vault edits are not pushed back. |
| `vault-only` | Vault → Source (publish only) | Vault changes are exported to the external folder. External changes are not imported. |
| `bidirectional` | Bidirectional (both ways) | Changes in either location are synced to the other. Uses loop detection to prevent infinite bounce. |

---

## Conflict Resolution

Applied when a file already exists at the target path during sync.

| Value | UI Label | Behavior |
|-------|----------|----------|
| `overwrite` | Overwrite — Replace existing file | The incoming file always replaces the existing one. |
| `skip` | Skip — Don't sync if exists | The existing file is kept; the incoming file is ignored. |
| `keepNewer` | Keep Newer — Compare timestamps | The file with the more recent modification time wins. The older version is replaced. |
| `rename` | Rename — Add conflict suffix | The incoming file is saved with a `(conflict YYYY-MM-DD HH-MM-SS)` suffix. Both versions are preserved. |

Each mapping has two conflict resolution settings:
- **`conflictResolution`** — Used for forward sync (source → vault).
- **`reverseConflictResolution`** — Used for reverse sync (vault → source). Only applies in `bidirectional` mode.

---

## Deletion Handling

Applied when a file is deleted in the source folder (forward) or the vault (reverse).

| Value | UI Label | Behavior |
|-------|----------|----------|
| `ignore` | Ignore — Don't sync deletions | Deletions are not propagated. The other side keeps its copy. |
| `trash` | Move to Trash — Safe, recoverable | The corresponding file on the other side is moved to the system trash. |

---

## Global Settings

These apply to all mappings.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `syncOnStart` | on/off | on | Automatically reconcile all enabled mappings when Obsidian starts. |
| `ignoreOneDriveTemp` | on/off | on | Filter out Office lock files (`~$*.docx`), temp files (`.tmp`, `.partial`), dotfiles (`.DS_Store`), and other system artifacts. |
| `verifyFileStability` | on/off | on | Wait until a file's size and modification time are stable before syncing. Prevents importing half-uploaded cloud files. |
| `stabilityChecks` | number | `3` | Number of consecutive stable readings required before a file is considered ready. |
| `stabilityCheckInterval` | ms | `500` | Time between each stability reading. Minimum: 50 ms. |
| `debugMode` | on/off | off | Log detailed sync operations to the developer console (`Ctrl+Shift+I`). |

---

## Reconciliation Settings

Control the behavior of bulk reconciliation (startup sync and manual reconcile).

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `incrementalMode` | on/off | on | Only sync files that changed since the last reconcile (based on mtime + size). When off, all files are re-checked. |
| `fastSkipUnchanged` | on/off | on | Skip files whose modification time and size match the recorded sync state. |
| `parallelism` | number | `8` | Number of files processed simultaneously during reconcile. Range: 1–64. Higher = faster but more CPU/disk. |
| `progressThrottleMs` | ms | `250` | Minimum time between UI progress updates. Range: 0–5000 ms. |
| `disableStabilityCheckDuringReconcile` | on/off | on | Skip file stability checks during bulk reconcile for speed. Files are already on disk, not mid-upload. |
| `notifyOnMappingDone` | on/off | on | Show a notice when each mapping finishes reconciling. |

---

## Internal Constants

Not user-configurable, but useful for understanding plugin behavior.

| Constant | Value | What it controls |
|----------|-------|-----------------|
| `MIN_REVERSE_DEBOUNCE_MS` | 1,500 ms | Minimum delay before a vault edit triggers a reverse sync. |
| `COOLDOWN_MS` | 5,000 ms | After syncing a file, how long it's blocked from syncing in the opposite direction (loop prevention). |
| `MOVE_DETECT_WINDOW_MS` | 2,000 ms | Time window to pair a delete + add as a single move operation. |
| `MAX_FILE_SIZE_BYTES` | 100 MB | Files larger than this are skipped with a warning. |
| `MAX_PENDING_JOBS` | 1,000 | Maximum queued sync operations before new events are dropped (backpressure). |
| `WIN_MAX_PATH` | 260 chars | Windows path length limit. Paths exceeding this are rejected. |
| `AUTO_SAVE_DELAY_MS` | 5,000 ms | Sync state is written to disk after this idle period. |
| `CLOSE_TIMEOUT_MS` | 5,000 ms | Maximum time to wait for a watcher to shut down gracefully. |
| `LOCK_TIMEOUT_MS` | 30,000 ms | Maximum time to wait for an exclusive operation lock. |
| `Retry maxRetries` | 3 | Number of retry attempts for transient file system errors (EBUSY, EAGAIN). |
| `Retry baseDelayMs` | 100 ms | Initial delay before first retry. Doubles on each subsequent attempt (exponential backoff). |
| `Retry maxDelayMs` | 2,000 ms | Maximum delay between retries. |
| `Rename MAX_ATTEMPTS` | 1,000 | Maximum attempts to find a unique conflict filename before giving up. |

---

## Filtered File Patterns

When `ignoreOneDriveTemp` is enabled, the following files are automatically excluded.

| Pattern | Example | Source |
|---------|---------|--------|
| `~$*` | `~$proposal.docx` | Office lock files |
| `.*` | `.DS_Store`, `.gitignore` | Dotfiles / system files |
| `*.tmp` | `document.tmp` | Temporary files |
| `*.partial` | `download.partial` | Incomplete downloads |
| `*.crdownload` | `file.crdownload` | Chrome partial downloads |
| `Thumbs.db` | `Thumbs.db` | Windows thumbnail cache |
| `desktop.ini` | `desktop.ini` | Windows folder config |
