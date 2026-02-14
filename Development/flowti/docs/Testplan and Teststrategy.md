---
type: TestPlan
stage: open
domain: Flowti/Tests
plugin: "[[Development/flowti/README|README]]"
---

# Teststrategy

This section describes **why** and **how** we test.

- we use Vitest for unit-tests
- we use Vitest for automated integration-tests
- we will use the Obsidian CLI for automated end-to-end tests in the future

# Flowti IBDE — Test Plan Index

> Run `npm test` (or `npx vitest run`) for the current test count and pass/fail status.

This document describes **what** is tested — use cases, scenarios, and coverage strategy — independent of the evolving test count. It serves as the index for the full test plan.

> **Expanded documentation:** Each use case (UC-56 through UC-99) has a standalone file in `docs/use-cases/` with full steps, preconditions, outcomes, and variations. End-to-end user journeys are documented in `docs/flows/` (10 files).

Vitest generates test and coverage reports. You find them as JSON file in `docs/tests`.

- `docs/tests/testreport.json` for the test report
- `docs/tests/coverage-final.json` for coverage

The codebase gets exported as JSON by typedoc. You find the export here:

- `docs/codebase/codebase.json`

Every `npm run build` will also update the generated exports.

---

## Architecture

```
src/
├── domain/               # Business logic (11 bounded contexts)
│   ├── dataExchange/     # CSV import/export, pipelines, type docs
│   ├── docs/             # DocService + content generators + path resolvers
│   ├── discovery/        # Vault scanning for user-defined events
│   ├── eventDefinition/  # Custom event mapping rules
│   ├── eventFilter/      # Hidden event types
│   ├── eventNotify/      # Notification preferences
│   ├── ingestion/        # File monitoring, job queue, catch-up
│   ├── installer/        # First-run setup wizard
│   ├── settings/         # Plugin configuration
│   ├── subscription/     # Event watchers with filters
│   └── user/             # User profile management
├── infrastructure/       # Generic plumbing
│   ├── commands/         # Command pipeline with middleware
│   ├── errors/           # Error categorization & handling
│   ├── events/           # EventBus + Obsidian EventBridge
│   ├── filesystem/       # Vault I/O abstraction
│   ├── logger/           # Structured logging
│   ├── services/         # DI container with lifecycle
│   └── views/            # Obsidian pane registration
├── ui/                   # Presentation layer (~17,127 LOC)
│   ├── catalog/          # Event Catalog components (15 files)
│   ├── hub/              # Data Exchange Hub components (21 files)
│   ├── csv/              # CSV import wizard components (10 files)
│   └── export/           # Export wizard components (7 files)
├── utils/                # Shared helpers (UUID, glob, persistence, mutex)
└── main.ts               # Plugin orchestrator
```

---

## User Journey

End-to-end path through the installer feature, crossing multiple steps and services.

> **Test file:** `tests/domain/installer/InstallerJourney.test.ts`

| Journey | Scenario | Status |
|---------|----------|--------|
| 1 — First Run | Detect first run from empty storage | ✅ |
| 1 — First Run | Create user and scaffold folders | ✅ |
| 1 — First Run | Persist installed state | ✅ |
| 1 — First Run | Full event lifecycle emitted in order | ✅ |
| 1 — First Run | UserCreationStep runs before FolderScaffoldStep | ✅ |
| 1 — First Run | Wizard modal opens when not installed | ⏭️ Obsidian Modal |
| 2 — Subsequent Launch | Detect installed state from storage | ✅ |
| 2 — Subsequent Launch | No steps run when already installed | ✅ |
| 2 — Subsequent Launch | Wizard modal does not open | ⏭️ Obsidian Modal |
| 3 — Restart | Reset clears installed state | ✅ |
| 3 — Restart | UserCreationStep skips on re-run | ✅ |
| 3 — Restart | FolderScaffoldStep skips existing folders | ✅ |
| 3 — Restart | Persist new state after re-run | ✅ |
| 3 — Restart | Wizard opens after reset | ⏭️ Obsidian Modal |
| 4 — Failure | FolderScaffoldStep fails on permission error | ✅ |
| 4 — Failure | installer.failed emitted with step id | ✅ |
| 4 — Failure | Partial createdFolders in context | ✅ |
| 4 — Failure | Retry succeeds after error resolved | ✅ |
| 4 — Failure | UserCreationStep skipped on retry | ✅ |
| 4 — Failure | Failure page with retry button | ⏭️ Obsidian Modal |

---

## Features

| # | Feature | Domain | Test Files | Status |
|---|---------|--------|------------|--------|
| 1 | Installer | domain/installer | `InstallerService`, `InstallerJourney`, `UserCreationStep`, `FolderScaffoldStep`, `folders` | ✅ |
| 2 | Settings | domain/settings | `SettingsService`, `settings` | ✅ |
| 3 | User Management | domain/user | `UserService` | ✅ |
| 4 | Event System | infrastructure/events | `EventBus`, `EventBridge`, `catalog` | ✅ |
| 5 | Service Container | infrastructure/services | `ServiceContainer`, `VaultQueryService`, `WorkspaceService` | ✅ |
| 6 | Command Pipeline | infrastructure/commands | `CommandRegistry` | ✅ |
| 7 | Error Handling | infrastructure/errors | `FlowtiError`, `ErrorService` | ✅ |
| 8 | Logger | infrastructure/logger | `LoggerService` | ✅ |
| 9 | Utilities | utils | `helpers`, `glob`, `persistence`, `mutex` | ✅ |
| 10 | Event Catalog View | ui/catalog | `EventCatalogView`, `catalog/helpers`, `eventDocTemplate` | ✅ |
| 11 | Event Log View | ui | `EventLogView` | ✅ |
| 12 | Data Exchange Hub View | ui | `DataExchangeHubView` | ✅ |
| 13 | CSV Import & Data Exchange | domain/dataExchange | `ImportService`, `CsvParser`, `DataExchangeService`, `Pipeline`, `BaseQueryEngine`, `ExportService` | ✅ |
| 14 | Export View | ui/export | `ExportView` | ✅ |
| 15 | Component Showcase View | ui | — | ⏭️ Rendering only |
| 16 | Catalog Helpers | ui/catalog | `catalog/helpers` | ✅ |
| 17 | Discovery | domain/discovery | `DiscoveryService` | ✅ |
| 18 | Event Filter | domain/eventFilter | `EventFilterService` | ✅ |
| 19 | Event Notification | domain/eventNotify | `EventNotificationService` | ✅ |
| 20 | Subscription | domain/subscription | `SubscriptionService` | ✅ |
| 21 | Ingestion | domain/ingestion | `IngestionService`, `JobQueue` | ✅ |
| 22 | Event Definition | domain/eventDefinition | `EventDefinitionService`, `payloadExtractor` | ✅ |
| 23 | DocService | domain/docs | `DocService` | ✅ |
| 24 | Event Config Modal | ui | `EventConfigModal` | ✅ |
| 25 | Ingestion Status Bar | ui | `IngestionStatusBar` | ✅ |

---

## Feature 1: Installer

The first-run setup wizard. Extensible step-based pipeline that creates the user profile and scaffolds the IBDE folder structure.

> **Feature doc:** [Installer.md](features/Installer/Installer.md)

### Source files

| File | Purpose |
|------|---------|
| `types.ts` | IInstallerStep, InstallerContext, InstallerState, IInstallerService |
| `events.ts` | InstallerEventMap (6 events) |
| `folders.ts` | DEFAULT_IBDE_FOLDERS constant (23 folders) |
| `InstallerService.ts` | Step registry, pipeline executor, state persistence, reset |
| `InstallerWizardModal.ts` | 4-page Obsidian Modal (Welcome, Review, Progress, Complete) |
| `steps/UserCreationStep.ts` | Create user profile (order 10), idempotent |
| `steps/FolderScaffoldStep.ts` | Scaffold PARA folders (order 20), idempotent |

### Test files

| Test File | What it covers |
|-----------|----------------|
| `InstallerService.test.ts` | load, registerStep, getSteps, runAll, reset, persistence, events |
| `InstallerJourney.test.ts` | First run, subsequent launch, restart, failure/retry |
| `UserCreationStep.test.ts` | Metadata, create user, skip if exists, fail without name |
| `FolderScaffoldStep.test.ts` | Create all folders, idempotent, error reporting, partial state |
| `folders.test.ts` | Non-empty, no duplicates, parent-before-child ordering |

### Use cases

| UC | Use Case | Scenarios | Status |
|----|----------|-----------|--------|
| UC-01 | First-run detection | Load empty storage, isInstalled false | ✅ |
| UC-02 | User creation | Name input, createUser, skip if exists, fail without name | ✅ |
| UC-03 | Folder scaffolding | Create all PARA folders, idempotent, partial on failure | ✅ |
| UC-04 | Step pipeline execution | Ordered execution, context accumulation, event lifecycle | ✅ |
| UC-05 | State persistence | Save on success, skip on failure, reset clears state | ✅ |
| UC-06 | Wizard UI (4 pages) | Welcome, Review, Progress, Complete | ⏭️ Obsidian Modal |
| UC-07 | Restart from Settings | Reset + re-run, idempotent steps skip | ✅ |
| UC-08 | Failure and retry | Permission error, partial folders, retry succeeds | ✅ |
| UC-09 | Step extensibility | Register custom step, duplicate id rejected | ✅ |

---

## Feature 2: Settings

Plugin configuration with Zod schema validation.

### Test files

| Test File | What it covers |
|-----------|----------------|
| `SettingsService.test.ts` | Load, getSettings, updateSettings, setDebugMode, events, optional deps |
| `settings.test.ts` | Schema validation, safe parsing, defaults |

### Use cases

| UC | Use Case | Status |
|----|----------|--------|
| UC-10 | Load settings from storage | ✅ |
| UC-11 | Update settings with persistence | ✅ |
| UC-12 | Debug mode toggle | ✅ |
| UC-13 | Zod schema validation | ✅ |
| UC-14 | Settings tab UI | ⏭️ Obsidian PluginSettingTab |

---

## Feature 3: User Management

User profile lifecycle (create, update, persist).

### Test files

| Test File | What it covers |
|-----------|----------------|
| `UserService.test.ts` | load, hasUser, getUser, createUser, updateUserName, persistence, events |

### Use cases

| UC | Use Case | Status |
|----|----------|--------|
| UC-15 | Create user with UUID | ✅ |
| UC-16 | Update user name | ✅ |
| UC-17 | Persist user to storage | ✅ |
| UC-18 | Load user from storage | ✅ |
| UC-19 | User events (created, updated, loaded) | ✅ |
| UC-20 | Validation (empty name rejected) | ✅ |

---

## Feature 4: Event System

EventBus (pub/sub backbone) and EventBridge (Obsidian API translator).

> **Feature docs:** [Event Bridge](features/Event%20Bridge/Event%20Bridge.md) · [Event System](features/Event%20System/Event%20System.md) · [File Events](features/File%20Events/File%20Events.md) · [Event Files](features/Event%20Files/Event%20Files.md)

### Test files

| Test File | What it covers |
|-----------|----------------|
| `EventBus.test.ts` | on/emit, off, once, clear, wildcard, event structure |
| `EventBridge.test.ts` | File/folder/event-file notifications, frontmatter, vault/workspace/metadata listeners |

### Use cases — EventBus

| UC | Use Case | Status |
|----|----------|--------|
| UC-21 | Subscribe and emit events | ✅ |
| UC-22 | Wildcard listener | ✅ |
| UC-23 | Once handler (auto-unsubscribe) | ✅ |
| UC-24 | Unsubscribe (on/off) | ✅ |

### Use cases — EventBridge: File Operations

| UC | Use Case | Status |
|----|----------|--------|
| UC-25 | File operations (create, read, update, delete, move, rename) | ✅ |
| UC-26 | Frontmatter operations (read, update) | ✅ |

### Use cases — EventBridge: Vault Notifications

| UC | Use Case | Status |
|----|----------|--------|
| UC-27 | File notifications (file.created, file.modified, file.deleted, file.renamed) | ✅ |
| UC-28 | Folder notifications (folder.created, folder.deleted, folder.renamed) | ✅ |
| UC-29 | Workspace listeners (active-leaf-change) | ✅ |
| UC-30 | Metadata listeners (metadata.changed) | ✅ |

### Use cases — EventBridge: Event Files

Event Files are vault notes with frontmatter `type: "Event"` that act as event declarations. When such a file changes, EventBridge emits `event.file.triggered`.

| UC | Use Case | Status |
|----|----------|--------|
| UC-31 | Emit event.file.triggered on file modify/rename/delete (direct detection) | ✅ |
| UC-32 | Deferred create detection via pending-set handoff (vault create → metadata.changed) | ✅ |
| UC-33 | Event name from frontmatter `name` property | ✅ |
| UC-34 | Event name derived from basename when `name` is absent (lowercase, spaces → dots) | ✅ |
| UC-35 | Pending path consumed once (one-shot — second metadata.changed does not re-emit) | ✅ |
| UC-36 | No emit when `type` is not "Event" (including lowercase "event") | ✅ |
| UC-37 | No emit when metadata cache is unavailable (e.g. deleted file) | ✅ |
| UC-38 | Full lifecycle: create → modify emits separate events | ✅ |

---

## Feature 5: Service Container

Dependency injection with lifecycle management.

### Test files

| Test File | What it covers |
|-----------|----------------|
| `ServiceContainer.test.ts` | Register, get, initializeAll, disposeAll, dependency order, circular detection |

### Use cases

| UC | Use Case | Status |
|----|----------|--------|
| UC-39 | Register and resolve services | ✅ |
| UC-40 | Dependency ordering (topological) | ✅ |
| UC-41 | Circular dependency detection | ✅ |
| UC-42 | Service lifecycle (init/dispose) | ✅ |
| UC-43 | Service events (registered, initialized, disposed) | ✅ |

---

## Feature 6: Command Pipeline

Command registration and execution with middleware.

### Test files

| Test File | What it covers |
|-----------|----------------|
| `CommandRegistry.test.ts` | Register, execute, middleware chain, logging/error middleware |

### Use cases

| UC | Use Case | Status |
|----|----------|--------|
| UC-44 | Register and execute commands | ✅ |
| UC-45 | Middleware pipeline (logging, error) | ✅ |
| UC-46 | Command events (registered, executing, executed, failed) | ✅ |
| UC-47 | Error wrapping in CommandError | ✅ |

---

## Feature 7: Error Handling

Categorized error classes and error service.

### Test files

| Test File | What it covers |
|-----------|----------------|
| `FlowtiError.test.ts` | Error class hierarchy, factory methods, type conversion |
| `ErrorService.test.ts` | Handle, create, wrap, event emission, optional deps |

### Use cases

| UC | Use Case | Status |
|----|----------|--------|
| UC-48 | Error categories (Validation, Storage, Lifecycle, Service, Command) | ✅ |
| UC-49 | Error severity levels | ✅ |
| UC-50 | Error cause chain | ✅ |
| UC-51 | Error event emission | ✅ |

---

## Feature 8: Logger

Structured logging with levels, context, and event tracing.

### Test files

| Test File | What it covers |
|-----------|----------------|
| `LoggerService.test.ts` | Log levels, context prefix, debug mode, event tracing, event emission |

### Use cases

| UC | Use Case | Status |
|----|----------|--------|
| UC-52 | Log at all levels (debug, info, warn, error) | ✅ |
| UC-53 | Context/child loggers | ✅ |
| UC-54 | Debug mode toggle (suppresses debug output) | ✅ |
| UC-55 | Event tracing (wildcard listener, skips log.* recursion) | ✅ |

---

## Feature 9: Utilities

Shared helper functions.

### Test files

| Test File | What it covers |
|-----------|----------------|
| `helpers.test.ts` | UUID v4 generation, uniqueness |

---

## Feature 10: Event Catalog View

Semantic map of domains, events, flows, systems, actors, and products. The view is an Obsidian `ItemView` subclass — tests verify behavioral contracts via EventBus rather than DOM rendering.

> **Sitemap doc:** [Event Catalog View](sitemap/Event%20Catalog%20View.md)

### Test files

| Test File | What it covers |
|-----------|----------------|
| `EventCatalogView.test.ts` | Discovery sync, subscription/definition tracking, filter/notification sync, settings sync, doc lifecycle, cleanup |
| `EventConfigModal.test.ts` | Per-event subscription and definition CRUD |

### Use cases

| UC | Use Case | Scenarios | Status |
|----|----------|-----------|--------|
| UC-56 | Browse and discover domain events | `discovery.loaded/updated/removed` → state sync | ✅ |
| UC-57 | Document a business domain | `doc.created` → 500ms delayed re-render, `doc.deleted` → immediate re-render | ✅ |
| UC-58 | Configure event subscriptions | `subscription.loaded/created/updated/deleted` → state update | ✅ |
| UC-59 | Configure event definitions | `eventDefinition.loaded/created/updated/deleted` → state update | ✅ |
| UC-60 | Filter system events | `showSystemEvents` toggle filters entries via `settings.changed` | ✅ |
| UC-61 | Filter by event type | `eventFilter.loaded/changed` → excluded types update | ✅ |
| UC-62 | Notification sync | `eventNotify.loaded/changed` → notified types update | ✅ |
| UC-63 | Cleanup on close | All listeners unsubscribed, no events received after close | ✅ |

---

## Feature 11: Event Log View

Real-time activity feed of system events. Tests verify event capture, buffer management, filtering, and enrichment.

> **Sitemap doc:** [Event Log View](sitemap/Event%20Log%20View.md)

### Test files

| Test File | What it covers |
|-----------|----------------|
| `EventLogView.test.ts` | Event capture, buffer limits, filtering (subscribed/all), search, pause/resume, context enrichment |

### Use cases

| UC | Use Case | Scenarios | Status |
|----|----------|-----------|--------|
| UC-64 | Monitor live system activity | Wildcard listener captures events, buffer respects maxEntries | ✅ |
| UC-65 | Focus on subscribed events | Subscribed mode filters by active subscription types | ✅ |
| UC-66 | Debug event flow | All mode shows every event, search filters by type pattern | ✅ |
| UC-67 | Pause and inspect | Freeze flag stops rendering, buffer continues collecting | ✅ |
| UC-68 | Navigate to event documentation | Event type links resolve to doc paths | ✅ |
| UC-69 | Review enriched context | Context summaries for subscriptions, ingestion, failures, definitions | ✅ |

---

## Feature 12: Data Exchange Hub View

Central management hub for import and export operations. Tests verify event-driven state sync and navigation.

> **Sitemap doc:** [Data Exchange Hub View](sitemap/Data%20Exchange%20Hub%20View.md)

### Test files

| Test File | What it covers |
|-----------|----------------|
| `DataExchangeHubView.test.ts` | Config sync, import/export completion, property doc tracking, state management, cleanup |

### Use cases

| UC | Use Case | Scenarios | Status |
|----|----------|-----------|--------|
| UC-70 | Manage saved configurations | `dataExchange.config.changed` → refreshes configs | ✅ |
| UC-71 | Monitor import reports | `dataExchange.import.completed` → triggers re-render | ✅ |
| UC-72 | Manage export configurations | `dataExchange.export.completed` → triggers re-render | ✅ |
| UC-73 | Build a data dictionary | `file.created/deleted` in properties folder → triggers scan | ✅ |
| UC-74 | State management | Page navigation, selection state, filter text | ✅ |
| UC-75 | Cleanup on close | All listeners unsubscribed after onClose | ✅ |
| UC-76 | Orchestrate multi-step pipelines | Pipeline execution events | ✅ (via `Pipeline.test.ts`) |

---

## Feature 13: CSV Action View

CSV file viewer and import wizard. The view itself is an Obsidian `ItemView` — business logic is tested through the underlying services.

> **Sitemap doc:** [CSV Action View](sitemap/CSV%20Action%20View.md)

### Test files

| Test File | What it covers |
|-----------|----------------|
| `ImportService.test.ts` | CSV import pipeline, conflict strategies, progress events |
| `CsvParser.test.ts` | Parse/generate CSV content, empty lines, delimiters |
| `DataExchangeService.test.ts` | Import orchestration, config persistence, event wiring |
| `Pipeline.test.ts` | Multi-import pipelines, step execution, doc generation |

### Use cases

| UC | Use Case | Scenarios | Status |
|----|----------|-----------|--------|
| UC-77 | Import CSV rows as vault notes | CSV parse → buildNoteContent → createFile pipeline | ✅ |
| UC-78 | Reuse import configurations | Save/load config persistence via DataExchangeService | ✅ |
| UC-79 | Clean and transform data | Column mapping, frontmatter field renaming | ✅ |
| UC-80 | Handle incremental imports | Conflict strategies: skip existing, update, overwrite | ✅ |
| UC-81 | Preview CSV content | CsvParser parse with header detection | ✅ |
| UC-82 | Create Base file alongside import | Pipeline step generates .base file | ✅ (via `Pipeline.test.ts`) |

---

## Feature 14: Export View

Wizard for exporting vault data as CSV or tab-delimited files. Tests verify the pure helper functions and state management logic.

> **Sitemap doc:** [Export View](sitemap/Export%20View.md)

### Test files

| Test File | What it covers |
|-----------|----------------|
| `ExportView.test.ts` | File property resolution, path helpers, format swapping, state defaults, change detection |
| `ExportService.test.ts` | Column scanning, file resolution, export execution, conflict strategies |

### Use cases

| UC | Use Case | Scenarios | Status |
|----|----------|-----------|--------|
| UC-83 | Export a Base view as CSV | resolveFileProperty for all file.* keys, output path construction | ✅ |
| UC-84 | Export a folder's notes | getOutputFolder, getOutputFilename, buildOutputPath helpers | ✅ |
| UC-85 | Save to the filesystem | External export path handling (vault vs filesystem) | ✅ |
| UC-86 | Handle export conflicts | State reflects overwrite/skip/append selection | ✅ |
| UC-87 | Reuse export configurations | hasUnsavedChanges detects format, path, column changes | ✅ |
| UC-88 | Format swapping | swapOutputExtension (.csv ↔ .txt) on format change | ✅ |

---

## Feature 15: Component Showcase View

Design system reference showing all available CSS components. Pure rendering view — no testable business logic.

> **Sitemap doc:** [Component Showcase View](sitemap/Component%20Showcase%20View.md)

### Skip reason

This view renders static CSS component examples. There are no event subscriptions, state management, or business logic to test. Visual correctness is verified by manual inspection in the Obsidian runtime.

| UC | Use Case | Status |
|----|----------|--------|
| UC-89 | Verify design system consistency | ⏭️ Visual / manual |
| UC-90 | Reference available CSS classes | ⏭️ Visual / manual |
| UC-91 | Test theme compatibility | ⏭️ Visual / manual |
| UC-92 | Onboard new contributors | ⏭️ Visual / manual |

---

## Feature 16: Catalog Helpers

Pure helper functions used by the Event Catalog View's tab components. Directly testable without Obsidian runtime.

### Test files

| Test File | What it covers |
|-----------|----------------|
| `catalog/helpers.test.ts` | Frontmatter parsing, event classification, category ordering, entry resolution, counting, cross-references, source paths |

### Use cases

| UC | Use Case | Scenarios | Status |
|----|----------|-----------|--------|
| UC-93 | Frontmatter parsing | `fmString` with fallback fields, `fmStringArray` coercion | ✅ |
| UC-94 | Event classification | `isDiscoveredEvent`, `isSystemOnly`, `isConfigured` edge cases | ✅ |
| UC-95 | Category ordering | Visible-first, alphabetical within groups | ✅ |
| UC-96 | Entry resolution | `discoveredToCatalogEntries`, `resolveEntry`, `getVisibleEntries` merge logic | ✅ |
| UC-97 | Config counting | `getConfiguredCount`, `getFollowedCount` with/without subs/defs | ✅ |
| UC-98 | Cross-references | `findRelatedFlows/Systems/Actors/Products` overlap matching | ✅ |
| UC-99 | Source path lookup | `getSourcePath` found vs not found | ✅ |

---

## Skip Reasons

| Category | Affected UCs | Unblocking Strategy |
|----------|--------------|---------------------|
| Obsidian Modal | UC-06 (Wizard UI) | Mock Obsidian `App`/`Modal` classes, or E2E test framework |
| Rendering only | UC-89 to UC-92 (Component Showcase) | Visual regression testing or Obsidian E2E framework |

The skipped tests in `InstallerJourney.test.ts` require the Obsidian runtime to instantiate `InstallerWizardModal`. The Component Showcase View is a pure rendering view with no business logic. In both cases, the underlying logic is fully covered by the passing tests.

---

## Appendix A: Build Pipeline

```
npm run build = vitest run → typedoc → tsc -noEmit -skipLibCheck → eslint → esbuild
```

| Stage | What it validates |
|-------|-------------------|
| `vitest run` | All tests pass |
| `typedoc` | TSDoc comments generate without errors |
| `tsc` | Type-checking passes (skip lib check for node_modules) |
| `eslint` | Lint rules pass on src/ |
| `esbuild` | Bundle produces `main.js` in `.obsidian/plugins/flowti-ibde/` |

## Appendix B: Test Environment

| Requirement | Details |
|-------------|---------|
| **Runtime** | Node.js (vitest) |
| **Platform** | Windows 10/11 |
| **Framework** | Vitest with vi.fn() mocks |
| **Obsidian API** | Mocked via test doubles (no runtime dependency) |
| **Test Isolation** | Fresh EventBus + mock storage per test (via `beforeEach`) |
| **Known Gotcha** | `DEFAULT_STATE` must use factory function to avoid shared-reference mutation across tests |
