# Folder Watcher — Test Plan Index

> Last updated: 2026-02-10 — 511 tests across 34 files (92 acceptance + 419 unit/integration)

This document serves as the index for the full test plan. Each feature, use case, journey, and scenario has its own file.

---

## Personas

| Persona          | Description                                        | Journey   | File                                     |
| ---------------- | -------------------------------------------------- | --------- | ---------------------------------------- |
| The Researcher   | Academic importing Dropbox notes into Obsidian     | Journey 1 | [Researcher](Development/watcher/docs/personas/Researcher.md)     |
| The Developer    | Developer editing markdown in Obsidian + VS Code   | Journey 2 | [Developer](Development/watcher/docs/personas/Developer.md)       |
| The Weekend User | Knowledge worker catching up after offline periods | Journey 3 | [Weekend User](Weekend%20User.md) |
| The Collaborator | Team lead sharing files for review and contributions | Journey 4 | [Collaborator](Development/watcher/docs/personas/Collaborator.md) |
| The Content Creator | Multi-device creator syncing via OneDrive across phone, tablet, desktop | Journey 5 | [Content Creator](Content%20Creator.md) |
| The Maintainer   | Plugin developer focused on quality and regressions   | Journey 6 | [Maintainer](Development/watcher/docs/personas/Maintainer.md)     |

---

## Jobs to be Done

What each persona is trying to accomplish — framed as situational motivations, not feature requests.

| Persona | Jobs | File |
|---------|------|------|
| The Researcher | 6 | [researcher](jtbd/researcher.md) |
| The Developer | 6 | [developer](jtbd/developer.md) |
| The Weekend User | 6 | [weekend-user](jtbd/weekend-user.md) |
| The Collaborator | 7 | [collaborator](jtbd/collaborator.md) |
| The Content Creator | 8 | [content-creator](jtbd/content-creator.md) |
| The Maintainer | 8 | [maintainer](jtbd/maintainer.md) |

---

## User Stories

Testable requirements derived from each persona's JTBD — "As a … I want … so that …" with acceptance criteria.

| Persona | Stories | Prefix | File |
|---------|---------|--------|------|
| The Researcher | 6 | US-R | [researcher](user-stories/researcher.md) |
| The Developer | 6 | US-D | [developer](user-stories/developer.md) |
| The Weekend User | 6 | US-W | [weekend-user](user-stories/weekend-user.md) |
| The Collaborator | 8 | US-C | [collaborator](user-stories/collaborator.md) |
| The Content Creator | 8 | US-X | [content-creator](user-stories/content-creator.md) |
| The Maintainer | 8 | US-M | [maintainer](user-stories/maintainer.md) |

---

## User Journeys

End-to-end paths through the system that cross multiple features.

> **Test file:** `tests/acceptance/user-journeys.test.ts`

| # | Journey | File |
|---|---------|------|
| 1 | Import External Notes into Obsidian | [journey-1](journeys/journey-1-import-external-notes.md) |
| 2 | Edit from Both Obsidian and VS Code | [journey-2](journeys/journey-2-edit-from-both-sides.md) |
| 3 | Catch Up After a Weekend Away | [journey-3](journeys/journey-3-catch-up-after-weekend.md) |
| 4 | Share Drafts and Collect Feedback | [journey-4](journeys/journey-4-share-and-collect-feedback.md) |
| 5 | Sync Content Across Devices | [journey-5](journeys/journey-5-sync-across-devices.md) |
| 6 | Maintain and Harden the Plugin | [journey-6](journeys/journey-6-maintain-and-harden.md) |

---

## Features

| # | Feature | Use Cases | File |
|---|---------|-----------|------|
| 1 | Core Synchronization | UC-01 – UC-05 | [feature-01](features/feature-01-core-sync.md) |
| 2 | Conflict Resolution | UC-06 – UC-10 | [feature-02](features/feature-02-conflict-resolution.md) |
| 3 | Deletion & Move Handling | UC-11 – UC-14 | [feature-03](features/feature-03-deletion-move.md) |
| 4 | File Filtering | UC-15 – UC-19 | [feature-04](features/feature-04-file-filtering.md) |
| 5 | Reconciliation | UC-20 – UC-24 | [feature-05](features/feature-05-reconciliation.md) |
| 6 | Reliability & Performance | UC-25 – UC-29 | [feature-06](features/feature-06-reliability.md) |
| 7 | Safety & Validation | UC-30 – UC-35 | [feature-07](features/feature-07-safety.md) |
| 8 | Settings & Configuration | UC-36 – UC-37 | [feature-08](features/feature-08-settings.md) |
| 9 | User Interface | UC-38 – UC-42 | [feature-09](features/feature-09-ui.md) |
| 10 | Persistence & Error Recovery | UC-43 – UC-46 | [feature-10](features/feature-10-persistence.md) |
| 11 | Export / Import Mappings | UC-47 – UC-48 | [feature-11](features/feature-11-export-import.md) |

---

## Use Cases

### Feature 1: Core Synchronization

| # | Use Case | Status | File |
|---|----------|--------|------|
| UC-01 | Source-Only Sync | ⏭️ 1/4 | [uc-01](use-cases/uc-01-source-only-sync.md) |
| UC-02 | Vault-Only Sync | ✅ 2/3 | [uc-02](use-cases/uc-02-vault-only-sync.md) |
| UC-03 | Bidirectional Sync | ✅ 2/3 | [uc-03](use-cases/uc-03-bidirectional-sync.md) |
| UC-04 | Subfolder Watching | ⏭️ 0/2 | [uc-04](use-cases/uc-04-subfolder-watching.md) |
| UC-05 | New Directory Detection | ⏭️ 0/3 | [uc-05](use-cases/uc-05-new-directory-detection.md) |

### Feature 2: Conflict Resolution

| # | Use Case | Status | File |
|---|----------|--------|------|
| UC-06 | Conflict — Overwrite | ✅ 1/2 | [uc-06](use-cases/uc-06-conflict-overwrite.md) |
| UC-07 | Conflict — Skip | ✅ 1/1 | [uc-07](use-cases/uc-07-conflict-skip.md) |
| UC-08 | Conflict — Keep Newer | ✅ 3/3 | [uc-08](use-cases/uc-08-conflict-keep-newer.md) |
| UC-09 | Conflict — Rename | ✅ 2/2 | [uc-09](use-cases/uc-09-conflict-rename.md) |
| UC-10 | Reverse Conflict Resolution | ✅ 2/2 | [uc-10](use-cases/uc-10-reverse-conflict.md) |

### Feature 3: Deletion & Move Handling

| # | Use Case | Status | File |
|---|----------|--------|------|
| UC-11 | Deletion — Ignore | ✅ 1/2 | [uc-11](use-cases/uc-11-deletion-ignore.md) |
| UC-12 | Deletion — Trash | ✅ 1/2 | [uc-12](use-cases/uc-12-deletion-trash.md) |
| UC-13 | Move Detection | ✅ 6/7 | [uc-13](use-cases/uc-13-move-detection.md) |
| UC-14 | Orphan Cleanup | ✅ 5/5 | [uc-14](use-cases/uc-14-orphan-cleanup.md) |

### Feature 4: File Filtering

| # | Use Case | Status | File |
|---|----------|--------|------|
| UC-15 | File Extension Filtering | ✅ 5/5 | [uc-15](use-cases/uc-15-extension-filtering.md) |
| UC-16 | Exclude Patterns | ✅ 5/5 | [uc-16](use-cases/uc-16-exclude-patterns.md) |
| UC-17 | Temp / System File Filtering | ✅ 5/5 | [uc-17](use-cases/uc-17-temp-file-filtering.md) |
| UC-18 | Dotfile Filtering | ✅ 3/3 | [uc-18](use-cases/uc-18-dotfile-filtering.md) |
| UC-19 | Symlink Protection | ✅ 1/3 | [uc-19](use-cases/uc-19-symlink-protection.md) |

### Feature 5: Reconciliation

| # | Use Case | Status | File |
|---|----------|--------|------|
| UC-20 | Reconciliation on Start | ✅ 3/4 | [uc-20](use-cases/uc-20-reconciliation-on-start.md) |
| UC-21 | Incremental Reconciliation | ✅ 2/4 | [uc-21](use-cases/uc-21-incremental-reconciliation.md) |
| UC-22 | Reconcile Worker Parallelism | ✅ 1/2 | [uc-22](use-cases/uc-22-reconcile-worker-parallelism.md) |
| UC-23 | Cancel Reconciliation | ✅ 1/1 | [uc-23](use-cases/uc-23-cancel-reconciliation.md) |
| UC-24 | Concurrent Reconcile Guard | ✅ 1/1 | [uc-24](use-cases/uc-24-concurrent-reconcile-guard.md) |

### Feature 6: Reliability & Performance

| # | Use Case | Status | File |
|---|----------|--------|------|
| UC-25 | File Stability Checks | ⏭️ 0/3 | [uc-25](use-cases/uc-25-file-stability-checks.md) |
| UC-26 | Retry on Transient Errors | ✅ 3/3 | [uc-26](use-cases/uc-26-retry-transient-errors.md) |
| UC-27 | Sync Loop Prevention | ✅ 4/5 | [uc-27](use-cases/uc-27-sync-loop-prevention.md) |
| UC-28 | Debounce Behavior | ✅ 2/2 | [uc-28](use-cases/uc-28-debounce-behavior.md) |
| UC-29 | Backpressure / Queue Limits | ✅ 2/2 | [uc-29](use-cases/uc-29-backpressure-queue-limits.md) |

### Feature 7: Safety & Validation

| # | Use Case | Status | File |
|---|----------|--------|------|
| UC-30 | File Size Limit | ⏭️ 0/3 | [uc-30](use-cases/uc-30-file-size-limit.md) |
| UC-31 | Path Traversal Protection | ✅ 2/2 | [uc-31](use-cases/uc-31-path-traversal-protection.md) |
| UC-32 | Windows Path Length Validation | ✅ 3/3 | [uc-32](use-cases/uc-32-windows-path-length.md) |
| UC-33 | Unicode Path Normalization | ✅ 2/2 | [uc-33](use-cases/uc-33-unicode-normalization.md) |
| UC-34 | Source Folder Validation | ⏭️ 0/2 | [uc-34](use-cases/uc-34-source-folder-validation.md) |
| UC-35 | Overlapping Mapping Validation | ⏭️ 0/3 | [uc-35](use-cases/uc-35-overlapping-mapping-validation.md) |

### Feature 8: Settings & Configuration

| # | Use Case | Status | File |
|---|----------|--------|------|
| UC-36 | Mapping CRUD | ✅ 2/4 | [uc-36](use-cases/uc-36-mapping-crud.md) |
| UC-37 | Polling Mode | ✅ 1/2 | [uc-37](use-cases/uc-37-polling-mode.md) |

### Feature 9: User Interface

| # | Use Case | Status | File |
|---|----------|--------|------|
| UC-38 | Status Bar Display | ⏭️ 0/2 | [uc-38](use-cases/uc-38-status-bar-display.md) |
| UC-39 | Reconcile Progress Reporting | ⏭️ 0/3 | [uc-39](use-cases/uc-39-reconcile-progress.md) |
| UC-40 | Dashboard | ⏭️ 0/3 | [uc-40](use-cases/uc-40-dashboard.md) |
| UC-41 | Commands | ⏭️ 0/2 | [uc-41](use-cases/uc-41-commands.md) |
| UC-42 | Watcher Health Monitoring | ⏭️ 0/1 | [uc-42](use-cases/uc-42-watcher-health-monitoring.md) |

### Feature 10: Persistence & Error Recovery

| # | Use Case | Status | File |
|---|----------|--------|------|
| UC-43 | SyncState Persistence | ✅ 4/5 | [uc-43](use-cases/uc-43-syncstate-persistence.md) |
| UC-44 | SyncState Auto-Save | ✅ 1/2 | [uc-44](use-cases/uc-44-syncstate-auto-save.md) |
| UC-45 | Watcher Error Recovery | ⏭️ 0/1 | [uc-45](use-cases/uc-45-watcher-error-recovery.md) |
| UC-46 | Watcher Close Timeout | ⏭️ 0/1 | [uc-46](use-cases/uc-46-watcher-close-timeout.md) |

### Feature 11: Export / Import Mappings

| # | Use Case | Status | File |
|---|----------|--------|------|
| UC-47 | Export Mappings to JSON | ✅ 14/14 | [uc-47](use-cases/uc-47-export-mappings.md) |
| UC-48 | Import Mappings from JSON | ✅ 22/22 | [uc-48](use-cases/uc-48-import-mappings.md) |

---

## Test Implementation Status

| Feature | Test File | ✅ Pass | ⏭️ Skip | Total | Coverage |
|---------|-----------|---------|---------|-------|----------|
| 1. Core Sync | `feature1-core-sync.test.ts` | 5 | 13 | 18 | 28% |
| 2. Conflict Resolution | `feature2-conflict-resolution.test.ts` | 9 | 1 | 10 | 90% |
| 3. Deletion & Move | `feature3-deletion-move.test.ts` | 6 | 11 | 17 | 35% |
| 4. File Filtering | `feature4-file-filtering.test.ts` | 23 | 2 | 25 | 92% |
| 5. Reconciliation | `feature5-reconciliation.test.ts` | 11 | 4 | 15 | 73% |
| 6. Reliability | `feature6-reliability.test.ts` | 16 | 3 | 19 | 84% |
| 7. Safety | `feature7-safety.test.ts` | 12 | 8 | 20 | 60% |
| 8-10. Settings/UI/Persistence | `feature8-10-settings-ui-persistence.test.ts` | 10 | 22 | 32 | 31% |
| 11. Export/Import | `MappingExportService.test.ts` + `MappingExportImport.test.ts` | 36 | 0 | 36 | 100% |
| **Totals** | | **128** | **64** | **192** | **67%** |

### Skip Reasons

| Category | Count | Affected UCs | Unblocking Strategy |
|----------|-------|--------------|---------------------|
| Chokidar / MappingWatcher | 15 | UC-01, 04, 05, 11, 12, 34, 37 | Mock chokidar's `watch()` or create filesystem integration test harness |
| Obsidian DOM / Modal | 18 | UC-35, 36, 38-41, 42 | Use JSDOM + mock Obsidian API, or E2E testing framework |
| FileSyncService I/O | 17 | UC-06, 13², 14¹, 21, 22, 25, 30, 43, 44 | Mock `fsp.*` at module level (same pattern as Feature 2) |
| Filesystem / symlinks | 2 | UC-19 | Create temp symlinks in test setup (`fs.symlinkSync`) |
| WatcherManager integration | 7 | UC-02, 03, 20, 45, 46 | Mock WatcherManager's `startAll()` with injected watcher factories |

> ¹ UC-14 acceptance tests are skipped but all 5 scenarios are covered by `OrphanCleanup.test.ts` (9 unit tests).
> ² UC-13 scenarios 13.1, 13.3, 13.4 are skipped in acceptance but covered by `MappingWatcher.movedetect.test.ts` (6 unit tests). Only 13.2 (same-size-different-ext) lacks a dedicated test.

---

## Data Dictionary

> [data-dictionary.md](data-dictionary.md) — All concepts, settings, mapping fields, defaults, and filtered file patterns for end users.

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

## Appendix B: Test Environment Requirements (Manual Testing)

| Requirement | Details |
|-------------|---------|
| **Obsidian Version** | Latest stable |
| **Platform** | Windows 10/11, macOS, Linux |
| **Source Folder Types** | Local SSD, network share (SMB), cloud-synced (OneDrive/Dropbox) |
| **File Sizes** | Empty, small (1 KB), medium (1 MB), large (50 MB), oversized (150 MB) |
| **File Names** | ASCII, Unicode (accents, CJK), long paths (>200 chars), special chars |
| **Concurrent Editors** | Obsidian + VS Code + external text editor simultaneously |
| **Network Conditions** | Online, offline (for cloud-synced folders), intermittent |
