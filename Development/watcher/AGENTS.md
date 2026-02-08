# Foreign Folder Watcher — Agent Instructions

You are working on the **Foreign Folder Watcher**, an Obsidian plugin that synchronizes files between external folders and the Obsidian vault in real time.

## Project overview

- **Codebase:** `Development/watcher/`
- **Target:** Obsidian Community Plugin (TypeScript → bundled JavaScript via esbuild)
- **Entry point:** `src/main.ts` → `main.js`
- **Release artifacts:** `main.js`, `manifest.json`, `styles.css`
- **Runtime dependency:** `chokidar ^5.0.0` (file watching)
- **Desktop only:** Yes (`isDesktopOnly: true`) — uses Node.js `fs` and chokidar

## Design principles

- **Test-first development** — Start with requirements and happy-path tests before implementing. Not dogmatic, but the default approach.
- **Separation of concerns** — Each service has a single responsibility. Services depend on interfaces, not concrete implementations.
- **Composition over inheritance** — Favor functional composition; use classes only where they naturally fit (services with state).
- **Iterative development** — Make it work → make it better → make it pretty.
- **Defensive I/O** — All filesystem operations validate paths, check for traversal, retry on transient errors, and respect platform limits.

## Environment & tooling

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | LTS (18+) | Runtime |
| npm | latest | Package manager |
| TypeScript | 5.9+ | Language (`strict: true`) |
| esbuild | 0.27+ | Bundler (config: `esbuild.config.mjs`) |
| Vitest | 4.0+ | Test runner (config: `vitest.config.ts`) |
| ESLint | 8.50+ | Linter |
| TypeDoc | 0.28+ | API documentation |

### Commands

```bash
npm install              # Install dependencies
npm run dev              # Watch mode (esbuild --watch)
npm run build            # Full pipeline: vitest → typedoc → tsc → eslint → esbuild
npm test                 # Run tests once (npx vitest run)
npm run test:watch       # Watch mode tests
npm run test:ui          # Vitest UI
npm run test:coverage    # Coverage report (v8)
npm run docs             # Generate TypeDoc
node esbuild.config.mjs  # Fast esbuild-only build (skip tests/lint)
```

**Note:** `tsc` has pre-existing errors in `node_modules/` (vite, vitest, zod types). Filter with `grep -v node_modules` when checking for real issues.

## Architecture

### Layer diagram

```
┌──────────────────────────────────────────────────┐
│           src/main.ts (Plugin Orchestrator)       │
│  Lifecycle, service init, command registration,   │
│  reconcile state management                       │
└────────────────┬─────────────────────────────────┘
                 │
     ┌───────────┼───────────┐
     ▼           ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────────┐
│ Watchers │ │ Services │ │  Modals / UI │
└──────────┘ └──────────┘ └──────────────┘
     │           │               │
     ▼           ▼               ▼
┌──────────────────────────────────────────────────┐
│  Obsidian API (Vault, App)  +  Node.js fs/chokidar│
└──────────────────────────────────────────────────┘
```

### Source structure

```
src/
├── main.ts                        # Plugin lifecycle (542 lines)
├── types.ts                       # Core domain types
├── interfaces/
│   └── IPluginContext.ts           # DI interfaces
├── settings/
│   ├── types.ts                   # FileWatcherSettings, defaults
│   └── FileWatcherSettingTab.ts   # Obsidian settings UI
├── services/
│   ├── FileSyncService.ts         # Core sync engine (1,570 lines)
│   ├── ReconcileService.ts        # Bulk reconciliation orchestrator
│   ├── ReconcileWorkerPool.ts     # Parallel file processing pool
│   ├── SyncStateService.ts        # Incremental sync state persistence
│   ├── ConflictResolver.ts        # overwrite / skip / keepNewer / rename
│   ├── OrphanCleanup.ts           # Remove orphaned vault files
│   ├── SyncLoopDetector.ts        # Prevents bidirectional ping-pong
│   ├── StatsService.ts            # Per-mapping + global statistics
│   ├── StatusBarService.ts        # Status bar UI
│   ├── LogService.ts              # Centralized structured logging
│   ├── NoticeService.ts           # User notification wrapper
│   ├── FolderPickerService.ts     # Native folder picker (Electron)
│   ├── AsyncMutex.ts              # KeyedMutex + OperationLock
│   ├── retry.ts                   # withRetry + isRetryableError + PathTraversalError
│   └── types.ts                   # Service interfaces
├── watcher/
│   ├── WatcherManager.ts          # Lifecycle for all watchers, health tracking
│   ├── MappingWatcher.ts          # Source → vault (chokidar-based)
│   └── VaultWatcher.ts            # Vault → source (Obsidian event-based)
├── modals/
│   ├── DashboardModal.ts          # Monitoring dashboard (overview, watchers, logs)
│   ├── FolderMappingModal.ts      # Mapping editor UI
│   └── ConfirmModal.ts            # Confirmation dialogs
└── utils.ts                       # Path validation, filtering, glob matching, directory walking
```

### Key services

| Service | Responsibility |
|---------|---------------|
| **FileSyncService** | Single-file sync (forward + reverse), bulk reconcile, stability checks. Thread-safe via `KeyedMutex` (per-file) + `OperationLock` (readers-writer). |
| **ReconcileService** | Orchestrates multi-mapping reconciliation. Sequential mapping processing with progress callbacks, cooperative cancellation, concurrent guard. |
| **SyncStateService** | Persists `mtime + size` per file for incremental reconciliation. Auto-saves with debounce. Prunes orphaned entries. |
| **ConflictResolver** | Four strategies: `overwrite`, `skip`, `keepNewer`, `rename` (with timestamped collision counter). Forward and reverse conflict resolution use separate strategies. |
| **SyncLoopDetector** | 5-second cooldown to prevent sync loops in bidirectional mode. Path normalization (lowercase + forward slashes). Periodic cleanup of stale entries. |
| **WatcherManager** | Manages lifecycle of MappingWatcher + VaultWatcher pairs. Tracks health states: healthy / idle / warning / error. |
| **MappingWatcher** | Watches external source folder via chokidar. Debounced processing, backpressure queue (MAX_PENDING_JOBS=1000), move detection (size + extension matching). |
| **VaultWatcher** | Watches vault target folder via Obsidian vault events. Minimum 1500ms reverse debounce. Backpressure queue. |

### Core domain types (`types.ts`)

```typescript
FolderMapping        // Configuration for source ↔ target relationship
SyncDirection        // "source-only" | "vault-only" | "bidirectional"
ConflictResolution   // "overwrite" | "rename" | "skip" | "keepNewer"
ChangeType           // "added" | "changed" | "deleted" | "moved"
DeletionHandling     // "ignore" | "trash"
ReconcileProgress    // Real-time progress snapshots
WatcherStats         // Per-mapping + global statistics
```

### Key constants

| Constant | Value | Location |
|----------|-------|----------|
| `MAX_PENDING_JOBS` | 1,000 | VaultWatcher, MappingWatcher |
| `MAX_PENDING_DIRS` | 100 | MappingWatcher |
| `MIN_REVERSE_DEBOUNCE_MS` | 1,500 ms | VaultWatcher |
| `COOLDOWN_MS` | 5,000 ms | SyncLoopDetector |
| `MAX_FILE_SIZE_BYTES` | 100 MB | FileSyncService |
| `WIN_MAX_PATH` | 260 | utils.ts |
| `MOVE_WINDOW_MS` | 2,000 ms | MappingWatcher |
| `CLOSE_TIMEOUT_MS` | 5,000 ms | MappingWatcher |
| `AUTO_SAVE_DELAY_MS` | 5,000 ms | SyncStateService |
| `Retry maxRetries` | 3 | retry.ts |
| `Retry baseDelayMs` | 100 ms | retry.ts |
| `Retry maxDelayMs` | 2,000 ms | retry.ts |

### Design patterns

- **Dependency injection** — Services depend on interfaces (`IVaultWatcherContext`, `IReconcileContext`, `IFileSyncService`), not concrete implementations.
- **Mutex / operation lock** — `KeyedMutex` prevents concurrent sync of the same file. `OperationLock` (readers-writer) separates watcher ops from reconciliation.
- **Worker pool** — `ReconcileWorkerPool` processes files in parallel (configurable `parallelism`, default 4).
- **Cooperative cancellation** — ReconcileService checks a `cancelled` flag between files, allowing the current file to finish.
- **Debounced auto-save** — SyncStateService batches writes to disk after a 5-second debounce.
- **Loop detection** — SyncLoopDetector records every sync and blocks the reverse direction for 5 seconds.
- **Move detection** — MappingWatcher buffers deletes for 2 seconds and matches with adds by `size + extension`.

## Testing

### Test structure (457 passing, 64 skipped across 28 files)

```
tests/
├── acceptance/                    # Feature-driven BDD tests (9 files)
│   ├── feature1-core-sync.test.ts
│   ├── feature2-conflict-resolution.test.ts
│   ├── feature3-deletion-move.test.ts
│   ├── feature4-file-filtering.test.ts
│   ├── feature5-reconciliation.test.ts
│   ├── feature6-reliability.test.ts
│   ├── feature7-safety.test.ts
│   ├── feature8-10-settings-ui-persistence.test.ts
│   └── user-journeys.test.ts      # Cross-feature happy paths
├── services/                      # Unit tests (13 files)
├── watcher/                       # Watcher tests (4 files)
├── settings/                      # Settings UI tests (1 file)
├── mocks/
│   ├── factories.ts               # Central mock factory (550 lines)
│   ├── obsidian-stub.ts           # Obsidian API mocks
│   ├── main-stub.ts               # Plugin mock
│   └── index.ts
└── utils.test.ts
```

### Test plan

Full BDD test plan with 46 use cases across 10 features: `docs/testplan.md`

### Mock patterns

**ESM-safe module mocking** (required for `fs/promises`):
```typescript
vi.mock("fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs/promises")>();
  return { ...actual, stat: vi.fn() };
});
import * as fsp from "fs/promises";
// In tests: vi.mocked(fsp.stat).mockResolvedValueOnce({...} as any);
```

**Mock LogService** (required in most test files):
```typescript
vi.mock("../../src/services/LogService", () => ({
  LogService: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
```

**VaultWatcher mock app** (for testing vault events):
```typescript
const handlers = new Map<string, VaultEventHandler>();
const mockApp = {
  vault: {
    on: vi.fn((event, handler) => { handlers.set(event, handler); return { id: event }; }),
    offref: vi.fn(),
  },
  _handlers: handlers,
};
```

**Key mock factories** (all in `tests/mocks/factories.ts`):
- `createMockVaultAdapter()` — In-memory file storage with stat/read/write
- `createMockVaultWatcherContext()` — Mock `fileSync.syncFileReverse`, `bumpProcessed`, etc.
- `createMockReconcileContext()` — Mock settings, stats, statusbar
- `createMockFileSyncService()` — Mock `reconcileMapping`, `getOperationLock`
- `createMockMapping()` — Default `FolderMapping` with overrides
- `createMockSettings()` — Default `FileWatcherSettings` with overrides
- `createMockNoticeService()` — Tracks calls for assertion

### Testing conventions

- Use `vi.useFakeTimers()` for debounce/timing tests; always `vi.useRealTimers()` in cleanup
- Acceptance tests follow BDD structure: `Feature > UC > Scenario`
- Skip tests that need real chokidar or Obsidian DOM with `it.skip` and a comment explaining why
- Test isolation: create fresh instances per test; shared state leaks across tests (especially EventBus wildcard listeners)

## File & folder conventions

- Source lives in `src/`. Keep `main.ts` focused on plugin lifecycle orchestration.
- Tests mirror source structure under `tests/`.
- **Do not commit build artifacts:** Never commit `node_modules/`, `main.js`, or generated files.
- Keep the plugin small. `chokidar` is the only runtime dependency.
- TypeDoc is generated into `docs/api/`.
- Test HTML reports go to `docs/tests/`.

## Coding conventions

- TypeScript with `strict: true`.
- **Keep `main.ts` as an orchestrator:** Initialize services, wire dependencies, register commands. No business logic.
- **Split large files:** If any file exceeds ~300 lines, extract a focused module (e.g., ConflictResolver, OrphanCleanup, SyncLoopDetector were extracted from FileSyncService).
- Prefer `async/await` over promise chains.
- Avoid `any` — use proper interfaces and type guards.
- Use TSDoc for all public APIs.
- Path handling: Always use `toVaultPath()` for vault paths (normalizes backslashes + NFC Unicode).
- Error handling: Use `isRetryableError()` + `withRetry()` for filesystem I/O. Use `PathTraversalError` for security violations.
- Logging: Use `LogService.debug/info/warn/error` with category, message, and structured options.
- Avoid barrel exports.
- Avoid mixing helpers into service files — keep pure functions in `utils.ts`.

## Agent do/don't

**Do:**
- Validate all paths before filesystem operations (`validateSourcePath`, `validateTargetPath`)
- Use `withRetry()` for any `fsp.*` call that might encounter transient errors
- Record syncs in `SyncLoopDetector` to prevent bidirectional ping-pong
- Use `toVaultPath()` for all vault-side path comparisons
- Run `npm test` after changes to verify the full suite passes
- Keep the test plan (`docs/testplan.md`) in sync with test changes
- Use mock factories from `tests/mocks/factories.ts` — don't create ad-hoc mocks

**Don't:**
- Skip path validation — it prevents writes outside designated folders
- Use `vi.spyOn()` on ESM module exports (fs/promises) — use `vi.mock()` at module level instead
- Forget to clean up timers/intervals in tests (`vi.useRealTimers()`, `detector.destroy()`)
- Add network calls without explicit user opt-in and documentation
- Store or transmit vault contents

## Security & safety

- **Path traversal protection** — All source and target paths are validated to stay within their designated folders
- **File size limit** — Files over 100 MB are skipped to prevent OOM
- **Windows MAX_PATH** — Paths over 260 characters are rejected on Windows
- **Unicode normalization** — `toVaultPath()` applies NFC normalization for cross-platform consistency
- **Symlink protection** — Symbolic links are detected and skipped
- **Local-only** — No network calls, no telemetry, no external services

## References

- Test plan: `docs/testplan.md` (46 use cases, 10 features, 3 user journeys)
- API docs: `docs/api/` (generated by TypeDoc)
- Obsidian API: https://docs.obsidian.md
- Obsidian developer policies: https://docs.obsidian.md/Developer+policies
- Obsidian plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
