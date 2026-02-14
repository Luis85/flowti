---
stage: open
domain: Flowti/Tests
plugin: "[[Development/flowti/README|README]]"
---

# Flowti IBDE — Test Plan Index

> Run `npm test` (or `npx vitest run`) for the current test count and pass/fail status.

This document describes **what** is tested — use cases, scenarios, and coverage strategy — independent of the evolving test count. It serves as the index for the full test plan.

Vitest generates test and coverage reports. You find them as json file in `docs/tests`.

- `docs/tests/index.json` for the test report
- `docs/tests/coverage/coverage-final.json` for coverage

Every `npm run build` will also update the reports.

---

## Architecture

```
src/
├── domain/               # Business logic
│   ├── installer/        # First-run setup wizard
│   ├── settings/         # Plugin configuration
│   └── user/             # User profile management
├── infrastructure/       # Generic plumbing
│   ├── commands/         # Command pipeline with middleware
│   ├── errors/           # Error categorization & handling
│   ├── events/           # EventBus + Obsidian EventBridge
│   ├── filesystem/       # Vault I/O abstraction
│   ├── logger/           # Structured logging
│   ├── services/         # DI container with lifecycle
│   └── views/            # Obsidian pane registration
├── ui/                   # Presentation (ComponentShowcase)
├── utils/                # Shared helpers (UUID)
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
| 4 | Event System | infrastructure/events | `EventBus`, `EventBridge` | ✅ |
| 5 | Service Container | infrastructure/services | `ServiceContainer` | ✅ |
| 6 | Command Pipeline | infrastructure/commands | `CommandRegistry` | ✅ |
| 7 | Error Handling | infrastructure/errors | `FlowtiError`, `ErrorService` | ✅ |
| 8 | Logger | infrastructure/logger | `LoggerService` | ✅ |
| 9 | Utilities | utils | `helpers` | ✅ |

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

## Skip Reasons

| Category | Affected UCs | Unblocking Strategy |
|----------|--------------|---------------------|
| Obsidian Modal | UC-06 (Wizard UI) | Mock Obsidian `App`/`Modal` classes, or E2E test framework |

The skipped tests are in `InstallerJourney.test.ts` and require the Obsidian runtime to instantiate `InstallerWizardModal`. The underlying logic (service calls, event emission, state management) is fully covered by the passing tests.

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
