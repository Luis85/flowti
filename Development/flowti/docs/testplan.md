# Flowti IBDE — Test Plan Index

> Last updated: 2026-02-09 — 239 tests across 16 files (20 journey + 219 unit/integration), 4 skipped

This document serves as the index for the full test plan. Each feature, domain, and infrastructure module is listed with its test coverage.

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

| # | Journey | Tests | Skipped | Status |
|---|---------|-------|---------|--------|
| 1 | First Run | 5 | 1 | ✅ |
| 2 | Subsequent Launch | 2 | 1 | ✅ |
| 3 | Restart from Settings | 4 | 1 | ✅ |
| 4 | Failure and Retry | 5 | 1 | ✅ |

### Journey detail

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

| # | Feature | Domain | Test Files | Tests | Status |
|---|---------|--------|------------|-------|--------|
| 1 | Installer | domain/installer | 5 files | 67 | ✅ (4 skipped) |
| 2 | Settings | domain/settings | 2 files | 18 | ✅ |
| 3 | User Management | domain/user | 1 file | 19 | ✅ |
| 4 | Event System | infrastructure/events | 2 files | 48 | ✅ |
| 5 | Service Container | infrastructure/services | 1 file | 24 | ✅ |
| 6 | Command Pipeline | infrastructure/commands | 1 file | 18 | ✅ |
| 7 | Error Handling | infrastructure/errors | 2 files | 24 | ✅ |
| 8 | Logger | infrastructure/logger | 1 file | 19 | ✅ |
| 9 | Utilities | utils | 1 file | 2 | ✅ |

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

| Test File | Tests | Skipped | What it covers |
|-----------|-------|---------|----------------|
| `InstallerService.test.ts` | 26 | 0 | load, registerStep, getSteps, runAll, reset, persistence, events |
| `InstallerJourney.test.ts` | 16 | 4 | First run, subsequent launch, restart, failure/retry |
| `UserCreationStep.test.ts` | 5 | 0 | Metadata, create user, skip if exists, fail without name |
| `FolderScaffoldStep.test.ts` | 7 | 0 | Create all folders, idempotent, error reporting, partial state |
| `folders.test.ts` | 9 | 0 | Non-empty, no duplicates, parent-before-child ordering |

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

> **Feature doc:** [Event System.md](features/Event%20System/Event%20System.md) (stub)

### Test files

| Test File | Tests | What it covers |
|-----------|-------|----------------|
| `SettingsService.test.ts` | 14 | Load, getSettings, updateSettings, setDebugMode, events, optional deps |
| `settings.test.ts` | 4 | Schema validation, safe parsing, defaults |

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

| Test File | Tests | What it covers |
|-----------|-------|----------------|
| `UserService.test.ts` | 19 | load, hasUser, getUser, createUser, updateUserName, persistence, events |

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

> **Feature doc:** [Event Bridge.md](features/Event%20Bridge/Event%20Bridge.md) (stub)

### Test files

| Test File | Tests | What it covers |
|-----------|-------|----------------|
| `EventBus.test.ts` | 13 | on/emit, off, once, clear, wildcard, event structure |
| `EventBridge.test.ts` | 35 | File ops, frontmatter, vault/workspace/metadata listeners |

### Use cases

| UC | Use Case | Status |
|----|----------|--------|
| UC-21 | Subscribe and emit events | ✅ |
| UC-22 | Wildcard listener | ✅ |
| UC-23 | Once handler (auto-unsubscribe) | ✅ |
| UC-24 | Unsubscribe (on/off) | ✅ |
| UC-25 | File operations via EventBridge | ✅ |
| UC-26 | Frontmatter operations via EventBridge | ✅ |
| UC-27 | Vault change listeners | ✅ |
| UC-28 | Workspace listeners | ✅ |
| UC-29 | Metadata listeners | ✅ |

---

## Feature 5: Service Container

Dependency injection with lifecycle management.

### Test files

| Test File | Tests | What it covers |
|-----------|-------|----------------|
| `ServiceContainer.test.ts` | 24 | Register, get, initializeAll, disposeAll, dependency order, circular detection |

### Use cases

| UC | Use Case | Status |
|----|----------|--------|
| UC-30 | Register and resolve services | ✅ |
| UC-31 | Dependency ordering (topological) | ✅ |
| UC-32 | Circular dependency detection | ✅ |
| UC-33 | Service lifecycle (init/dispose) | ✅ |
| UC-34 | Service events (registered, initialized, disposed) | ✅ |

---

## Feature 6: Command Pipeline

Command registration and execution with middleware.

### Test files

| Test File | Tests | What it covers |
|-----------|-------|----------------|
| `CommandRegistry.test.ts` | 18 | Register, execute, middleware chain, logging/error middleware |

### Use cases

| UC | Use Case | Status |
|----|----------|--------|
| UC-35 | Register and execute commands | ✅ |
| UC-36 | Middleware pipeline (logging, error) | ✅ |
| UC-37 | Command events (registered, executing, executed, failed) | ✅ |
| UC-38 | Error wrapping in CommandError | ✅ |

---

## Feature 7: Error Handling

Categorized error classes and error service.

### Test files

| Test File | Tests | What it covers |
|-----------|-------|----------------|
| `FlowtiError.test.ts` | 13 | Error class hierarchy, factory methods, type conversion |
| `ErrorService.test.ts` | 11 | Handle, create, wrap, event emission, optional deps |

### Use cases

| UC | Use Case | Status |
|----|----------|--------|
| UC-39 | Error categories (Validation, Storage, Lifecycle, Service, Command) | ✅ |
| UC-40 | Error severity levels | ✅ |
| UC-41 | Error cause chain | ✅ |
| UC-42 | Error event emission | ✅ |

---

## Feature 8: Logger

Structured logging with levels, context, and event tracing.

### Test files

| Test File | Tests | What it covers |
|-----------|-------|----------------|
| `LoggerService.test.ts` | 19 | Log levels, context prefix, debug mode, event tracing, event emission |

### Use cases

| UC | Use Case | Status |
|----|----------|--------|
| UC-43 | Log at all levels (debug, info, warn, error) | ✅ |
| UC-44 | Context/child loggers | ✅ |
| UC-45 | Debug mode toggle (suppresses debug output) | ✅ |
| UC-46 | Event tracing (wildcard listener, skips log.* recursion) | ✅ |

---

## Feature 9: Utilities

Shared helper functions.

### Test files

| Test File | Tests | What it covers |
|-----------|-------|----------------|
| `helpers.test.ts` | 2 | UUID v4 generation, uniqueness |

---

## Test Implementation Status

| Layer | Test File | Pass | Skip | Total |
|-------|-----------|------|------|-------|
| Domain: Installer | `InstallerService.test.ts` | 26 | 0 | 26 |
| Domain: Installer | `InstallerJourney.test.ts` | 16 | 4 | 20 |
| Domain: Installer | `UserCreationStep.test.ts` | 5 | 0 | 5 |
| Domain: Installer | `FolderScaffoldStep.test.ts` | 7 | 0 | 7 |
| Domain: Installer | `folders.test.ts` | 9 | 0 | 9 |
| Domain: Settings | `SettingsService.test.ts` | 14 | 0 | 14 |
| Domain: Settings | `settings.test.ts` | 4 | 0 | 4 |
| Domain: User | `UserService.test.ts` | 19 | 0 | 19 |
| Infra: Events | `EventBus.test.ts` | 13 | 0 | 13 |
| Infra: Events | `EventBridge.test.ts` | 35 | 0 | 35 |
| Infra: Commands | `CommandRegistry.test.ts` | 18 | 0 | 18 |
| Infra: Errors | `FlowtiError.test.ts` | 13 | 0 | 13 |
| Infra: Errors | `ErrorService.test.ts` | 11 | 0 | 11 |
| Infra: Logger | `LoggerService.test.ts` | 19 | 0 | 19 |
| Infra: Services | `ServiceContainer.test.ts` | 24 | 0 | 24 |
| Utils | `helpers.test.ts` | 2 | 0 | 2 |
| **Totals** | **16 files** | **235** | **4** | **239** |

---

## Skip Reasons

| Category | Count | Affected UCs | Unblocking Strategy |
|----------|-------|--------------|---------------------|
| Obsidian Modal | 4 | UC-06 (Wizard UI) | Mock Obsidian `App`/`Modal` classes, or E2E test framework |

All 4 skipped tests are in `InstallerJourney.test.ts` and require the Obsidian runtime to instantiate `InstallerWizardModal`. The underlying logic (service calls, event emission, state management) is fully covered by the passing tests.

---

## Test Summary by Layer

| Layer | Files | Tests | Pass | Skip | Coverage |
|-------|-------|-------|------|------|----------|
| Domain | 8 | 104 | 100 | 4 | 96% |
| Infrastructure | 7 | 133 | 133 | 0 | 100% |
| Utils | 1 | 2 | 2 | 0 | 100% |
| **Total** | **16** | **239** | **235** | **4** | **98%** |

---

## Appendix A: Build Pipeline

```
npm run build = vitest run → typedoc → tsc -noEmit -skipLibCheck → eslint → esbuild
```

| Stage | What it validates |
|-------|-------------------|
| `vitest run` | All 239 tests pass |
| `typedoc` | TSDoc comments generate without errors |
| `tsc` | Type-checking passes (skip lib check for node_modules) |
| `eslint` | Lint rules pass on src/ |
| `esbuild` | Bundle produces `main.js` in `.obsidian/plugins/flowti-ibde/` |

## Appendix B: Test Environment

| Requirement | Details |
|-------------|---------|
| **Runtime** | Node.js (vitest v4.0.17) |
| **Platform** | Windows 10/11 |
| **Framework** | Vitest with vi.fn() mocks |
| **Obsidian API** | Mocked via test doubles (no runtime dependency) |
| **Test Isolation** | Fresh EventBus + mock storage per test (via `beforeEach`) |
| **Known Gotcha** | `DEFAULT_STATE` must use factory function to avoid shared-reference mutation across tests |
