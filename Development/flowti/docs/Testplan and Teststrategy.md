---
type: TestPlan
stage: done
domain: Flowti/Tests
plugin: "[[Development/flowti/README|README]]"
tags:
  - testing
  - quality
---

# Flowti IBDE — Testplan and Teststrategy

> Related: [[Backend Architecture]] · [[Frontend Architecture]] · [[Event Catalog]] · [[Technical Debt Review 2026-02-13]]

---

## Test Strategy

This section describes **why** and **how** we test.

### Goals

1. **Prevent regressions** — Every domain service, infrastructure component, and utility function has automated tests that run on every build.
2. **Document behavior** — Tests serve as executable specifications. Use case IDs (UC-01 through UC-99) link tests to user-visible behavior.
3. **Enable fearless refactoring** — High coverage on pure functions and service logic allows structural changes (e.g., [[TD-34 Entity tab structural duplication|BaseEntityTab extraction]]) without risk.
4. **Gate the build** — The `npm run build` pipeline fails if any test fails, preventing broken code from reaching the plugin output.

### Test Pyramid

```
        ┌──────────────────────┐
        │   E2E (planned)      │  Obsidian runtime
        │   ⏭️ Future           │  ~0 tests
        ├──────────────────────┤
        │   Flow Integration   │  Cross-service journeys
        │   ✅ 10 flow suites   │  ~87 tests (28 skipped)
        ├──────────────────────┤
        │   Integration        │  Multi-service flows
        │   ✅ InstallerJourney │  ~20 tests
        │   ✅ Pipeline         │  ~25 tests
        ├──────────────────────┤
        │   Unit               │  Services, pure fns, utils
        │   ✅ 55 test files    │  ~1,300 tests
        └──────────────────────┘
```

### Frameworks and Tools

#### Test Runtime

| Tool | Purpose |
|------|---------|
| **Vitest 4.x** | Unit + integration test runner. Runs all suites in parallel via the forks pool. Configured as the first build gate — every `npm run build` runs the full suite before typedoc, tsc, eslint, and esbuild |
| **`vi.fn()` / `vi.spyOn()`** | Mocking and spying. Services are injected with mock `IStorageProvider` and mock `IEventBus` instances to isolate behavior. Modal constructors are mocked via `vi.mock()` to avoid DOM dependencies |
| **`vi.useFakeTimers()`** | Deterministic time control for timestamp-dependent tests (batch windows, debounce timers, notice throttles). Ensures reproducible test output regardless of execution speed |
| **`@vitest/coverage-v8`** | Code coverage via V8's native instrumentation. Reports generated as JSON (`docs/tests/coverage-final.json`) on every build. Target: 100% on pure functions, 80%+ on injectable services |

#### Test Infrastructure

| Tool | Purpose |
|------|---------|
| **obsidian-stub** (`tests/mocks/obsidian-stub.ts`) | Polyfills Obsidian's augmented `HTMLElement` methods (`createDiv`, `createEl`, `createSpan`, `addClass`, `setText`, `empty`) and stubs platform classes (`Modal`, `FuzzySuggestModal`, `Setting`, `Plugin`, `PluginSettingTab`, `ButtonComponent`, `ToggleComponent`, `DropdownComponent`, `TextComponent`, `ExtraButtonComponent`, `setIcon`). Enables testing view orchestrators and service wiring without the Obsidian runtime |
| **Zod** | Runtime schema validation for settings. `FlowtiSettingsSchema.safeParse()` is tested directly for default values, coercion, and invalid input rejection |
| **Real `EventBus`** | Tests use real `EventBus` instances (not mocks) to verify actual pub/sub behavior. Each test gets a fresh instance via `beforeEach()` to prevent listener leakage between tests |

#### Build Pipeline

| Tool | Purpose |
|------|---------|
| **TypeDoc** | API documentation generator. Runs after tests pass. Produces `docs/codebase/codebase.json` and HTML output |
| **TypeScript (`tsc`)** | Type-checking with `strict: true` and `-skipLibCheck` (avoids node_modules errors). No emit — used purely as a type gate |
| **ESLint** | Lint rules enforced on `src/` directory. Runs after tsc to catch style and correctness issues |
| **esbuild** | Bundles `src/main.ts` into `.obsidian/plugins/flowti-ibde/main.js` for Obsidian to load. Production builds use minification |

#### Development Methodologies

| Methodology | Application in this project |
|-------------|----------------------------|
| **Domain-Driven Design (DDD)** | 11 bounded contexts (Settings, User, Installer, Discovery, Subscription, Ingestion, EventDefinition, EventFilter, EventNotify, DataExchange, Docs), each owning its events, types, and service. Cross-domain communication exclusively via EventBus |
| **Test-Driven Development (TDD)** | New services and pure functions are developed test-first. The failing-test → implementation → refactor cycle produces focused, testable units with high coverage from the start |
| **Behaviour-Driven Development (BDD)** | Use cases (UC-01 through UC-99) link tests to user-visible behavior. Each UC describes preconditions, actions, and expected outcomes. Gherkin-style scenarios serve as executable specifications |
| **Clean Code** | Single Responsibility Principle enforced through the orchestrator + component pattern. Services implement `IDisposable` for deterministic cleanup. No service imports another service — all coupling is via events |
| **Agile / Incremental** | Short development cycles produce testable increments. Each feature phase (1–11) adds a complete vertical slice: events → service → tests → UI wiring |
| **Architecture Reviews** | Regular reviews against the [[Technical Debt Review 2026-02-13\|tech-debt register]] (38 items). Each review updates metrics (LOC, test count, coverage) and reclassifies items by current severity |
| **Three Amigos** | Solution evaluated from developer, tester, and business perspectives. The persona-driven design ([[personas/]]) ensures features serve real user workflows, not just technical requirements |

### Test Isolation

- Each test gets a **fresh `EventBus`** instance via `beforeEach()` to prevent listener leakage
- **Mock storage** (`vi.fn()` for `load`/`save`) avoids cross-test state contamination
- `DEFAULT_STATE` uses **factory functions** (not shared objects) to prevent mutation bleed
- Services are instantiated per-test with injected mocks — no singletons

### What We Don't Test

| Category | Reason | Mitigation |
|----------|--------|------------|
| Obsidian Modals | Require runtime `App` instance | Business logic extracted into testable services |
| DOM rendering | Component rendering needs Obsidian's augmented `HTMLElement` | `obsidian-stub` polyfills cover event handler wiring; visual correctness is manual |
| `main.ts` bootstrap | Plugin lifecycle tightly coupled to Obsidian API | Registration order tested indirectly via `ServiceContainer` |

## Roadmap

### E2E Testing

To further improve our test capabilities we will enhance the test suite with user-interface end-to-end tests. In order to make this happen, we will depend on the yet-to-be-released Obsidian CLI, which would enable:

1. **Booting the plugin** inside a headless Obsidian instance with a test vault
2. **Triggering Obsidian commands** and verifying that the correct views open (now fully observable via `ui.opened` events on the EventBus)
3. **Interacting with modals** (InputModal, InstallerWizardModal, EventConfigModal) and verifying outcomes
4. **Asserting vault state** — files created, frontmatter updated, folders scaffolded

The UI CommandBus refactoring (`ui.*` events) lays the groundwork: every user entry point is now an observable event, so E2E tests can assert on event emissions rather than inspecting DOM state directly.

| Dependency | Status | Notes |
|------------|--------|-------|
| Obsidian CLI / E2E framework | Not yet released | No official test harness exists; community options are manual only |
| jsdom environment | Not installed | Would enable testing Modal subclasses but not full workspace behavior |
| Component-level rendering | [[TD-27 Limited UI component testing\|TD-27]] | 40+ UI components have 0% test coverage |

### Quality Reporting

For easier quality surveillance we will integrate Vitest JSON reports into dedicated Obsidian views for fast quality checks during plugin development. The data pipeline is already in place:

| Asset | Path | Updated | Purpose |
|-------|------|---------|---------|
| Test results | `docs/tests/testreport.json` | Every `npm run build` | Suite/test pass/fail/skip counts, durations |
| Coverage | `docs/tests/coverage-final.json` | Every `npm run build` | Per-file statement/branch/function coverage |
| Codebase API | `docs/codebase/codebase.json` | Every `npm run build` | TypeDoc-generated API reference |

Planned enhancements:

| Enhancement | Approach | Benefit |
|-------------|----------|---------|
| In-vault test dashboard | Custom Flowti view parsing `testreport.json` | Browse pass/fail/skip counts, durations, and trends directly in Obsidian |
| In-vault coverage view | Parse `coverage-final.json` | Per-file coverage bars with drill-down, highlight low-coverage files |
| Interactive test explorer | `@vitest/ui` (`vitest --ui`) | Browser-based test tree with re-run, failure diffs, and watch mode |
| HTML coverage report | `@vitest/coverage-v8` with `reporter: ['html']` | Visual per-file line highlighting in browser |
| CI trend tracking | GitHub Actions (future, see [[TD-37 No Release- and Publishing Strategy\|TD-37]]) | Test count, coverage %, and failure rate trends across commits |

### Expanded Coverage Targets

| Area | Current | Target | Approach |
|------|---------|--------|----------|
| UI components (`catalog/`, `hub/`, `csv/`, `export/`) | 0% | 40%+ | Extract testable logic into helpers; test render side effects via EventBus |
| DataExchangeService facade | 59% | 80%+ | Test remaining config CRUD and pipeline orchestration |
| DiscoveryService vault scan | 52% | 80%+ | Mock `metadataCache` with varied frontmatter scenarios |
| UI command contracts | 100% | 100% | Maintain full coverage on `UiCommandService` event routing |

### Naming Conventions

- Test files mirror source tree: `src/domain/ingestion/IngestionService.ts` → `tests/domain/ingestion/IngestionService.test.ts`
- Describe blocks match class/function names
- Test names use `should + expected behavior` pattern

---

## Test Plan

> Run `npm test` (or `npx vitest run`) for the current test count and pass/fail status.

This section describes **what** is tested — use cases, scenarios, and coverage strategy — independent of the evolving test count. It serves as the index for the full test plan.

> **Expanded documentation:** Each use case (UC-56 through UC-99) has a standalone file in `docs/use-cases/` with full steps, preconditions, outcomes, and variations. End-to-end user journeys are documented in `docs/flows/` (10 files).

### Generated Reports

Vitest generates test and coverage reports. You find them as JSON files in `docs/tests`.

| Report             | Path                             | Updated                   |
| ------------------ | -------------------------------- | ------------------------- |
| Test results       | `docs/tests/testreport.json`     | Every `npm run publish`   |
| Coverage           | `docs/tests/coverage-final.json` | `npm run test --coverage` |
| Codebase (TypeDoc) | `docs/codebase/codebase.json`    | Every `npm run publish`   |

### Current Metrics (Feb 2026)

| Metric | Value |
|--------|-------|
| Test files | 65 |
| Tests | 1,447 passing, 32 skipped |
| Flow test suites | 10 files covering all documented user journeys (87 pass, 28 skip) |
| Coverage (statements) | ~31% overall (UI layer largely untested — see [[TD-27 Limited UI component testing\|TD-27]]) |
| Coverage (branches) | ~36% overall |
| 100% coverage files | `pathResolver.ts`, `contentGenerator.ts`, `configDocContent.ts`, `CsvParser.ts`, `glob.ts`, `mutex.ts`, `pathUtils.ts`, `folders.ts`, `settings.ts`, `UserService.ts`, `EventBus.ts`, `UiCommandService.ts` |
| Build pipeline | vitest → typedoc → tsc → eslint → esbuild |

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
│   ├── ui/               # UiCommandService (UI command bus)
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

## Flow Integration Tests

End-to-end user journey test suites covering all 10 documented flows. Each suite exercises multiple services via real `EventBus` instances, verifying cross-domain event contracts.

> **Test directory:** `tests/flows/`
> **Shared helpers:** `tests/flows/testHelpers.ts` (`createMockStorage<T>`, `createMockFileSystem`, `waitForAsync`)
> **Flow documentation:** `docs/flows/` (10 files)

### Flow Test Suites

| # | Flow | Test File | Pass | Skip | Services Exercised |
|---|------|-----------|------|------|--------------------|
| 01 | First-Run Onboarding | `01-FirstRunOnboarding.test.ts` | 4 | 2 | InstallerService, UserService |
| 02 | Browse and Configure Events | `02-BrowseAndConfigureEvents.test.ts` | 10 | 2 | SubscriptionService, EventDefinitionService |
| 03 | Import CSV as Notes | `03-ImportCsvAsNotes.test.ts` | 7 | 2 | DataExchangeService, ImportService |
| 04 | Export Vault Data | `04-ExportVaultData.test.ts` | 5 | 5 | DataExchangeService, ExportService |
| 05 | Build Import Pipeline | `05-BuildImportPipeline.test.ts` | 8 | 2 | DataExchangeService, PipelineExecutor |
| 06 | Create Domain Documentation | `06-CreateDomainDocumentation.test.ts` | 13 | 2 | DocService |
| 07 | Monitor and Debug Events | `07-MonitorAndDebugEvents.test.ts` | 8 | 3 | SubscriptionService |
| 08 | Configure File Ingestion | `08-ConfigureFileIngestion.test.ts` | 9 | 4 | IngestionService, EventDefinitionService |
| 09 | Discover Custom Events | `09-DiscoverCustomEvents.test.ts` | 7 | 3 | DiscoveryService, SubscriptionService |
| 10 | Manage Data Dictionary | `10-ManageDataDictionary.test.ts` | 16 | 3 | DataExchangeService |
| | **Total** | | **87** | **28** | |

### Skip Reasons (Flow Tests)

| Category | Affected Tests | Reason |
|----------|---------------|--------|
| Obsidian Modal/View | 18 tests | Require Obsidian `App`, `Modal`, or `ItemView` runtime |
| `emitCustom` limitation | 3 tests | `emitCustom()` only fires wildcard handlers, not typed `on()` handlers — by design |
| UI rendering | 7 tests | DOM rendering requires live Obsidian workspace |

### Test Pattern

Each flow test:
1. Creates isolated `EventBus` + mock storage/filesystem per test via `beforeEach()`
2. Instantiates real service instances (not mocks) with injected dependencies
3. Emits events and asserts on event handler calls, service state, and side effects
4. Skips scenarios that require Obsidian runtime with annotated `it.skip()` blocks

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
| 9 | Utilities | utils | `helpers`, `glob`, `persistence`, `mutex`, `pathUtils` | ✅ |
| 10 | Event Catalog View | ui/catalog | `EventCatalogView`, `catalog/helpers`, `eventDocTemplate` | ✅ |
| 11 | Event Log View | ui | `EventLogView` | ✅ |
| 12 | Data Exchange Hub View | ui | `DataExchangeHubView` | ✅ |
| 13 | CSV Import & Data Exchange | domain/dataExchange | `ImportService`, `CsvParser`, `DataExchangeService`, `Pipeline`, `BaseQueryEngine`, `ExportService`, `configDocContent` | ✅ |
| 14 | Export View | ui/export | `ExportView` | ✅ |
| 15 | Component Showcase View | ui | — | ⏭️ Rendering only |
| 16 | Catalog Helpers | ui/catalog | `catalog/helpers` | ✅ |
| 17 | Discovery | domain/discovery | `DiscoveryService` | ✅ |
| 18 | Event Filter | domain/eventFilter | `EventFilterService` | ✅ |
| 19 | Event Notification | domain/eventNotify | `EventNotificationService` | ✅ |
| 20 | Subscription | domain/subscription | `SubscriptionService` | ✅ |
| 21 | Ingestion | domain/ingestion | `IngestionService`, `JobQueue` | ✅ |
| 22 | Event Definition | domain/eventDefinition | `EventDefinitionService`, `payloadExtractor` | ✅ |
| 23 | DocService | domain/docs | `DocService`, `pathResolver`, `contentGenerator` | ✅ |
| 24 | Event Config Modal | ui | `EventConfigModal` | ✅ |
| 25 | Ingestion Status Bar | ui | `IngestionStatusBar` | ✅ |
| 26 | UI Command Bus | infrastructure/ui | `UiCommandService` | ✅ |

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

## Feature 26: UI Command Bus

Centralized command routing for all user entry points (Obsidian commands, ribbon icons, file-menu items). Every user action emits a `ui.*` event on the EventBus, which `UiCommandService` handles to open the appropriate view or modal.

### Source files

| File | Purpose |
|------|---------|
| `infrastructure/ui/events.ts` | `UiCommandEventMap` — 8 events for all user-initiated navigation |
| `infrastructure/ui/UiCommandService.ts` | Central handler: listens for `ui.*` events, opens views/modals via Obsidian workspace API |

### Test files

| Test File | What it covers |
|-----------|----------------|
| `UiCommandService.test.ts` | View opening (new/existing leaf), sidebar vs main, modal delegation, InputModal fallback, callback injection, dispose |

### Use cases

| UC | Use Case | Scenarios | Status |
|----|----------|-----------|--------|
| UC-100 | Open views via command palette | 4 commands emit `ui.*` events → UiCommandService opens view or reveals existing | ✅ |
| UC-101 | Open views via ribbon icons | 2 ribbon icons emit `ui.*` events → same handler as commands | ✅ |
| UC-102 | Open import/export via file menu | File-menu items emit `ui.openCsvImport` / `ui.openExport` with file path + optional saved config | ✅ |
| UC-103 | Fallback InputModal for palette commands | Commands without pre-selected file show InputModal, then delegate to callback | ✅ |
| UC-104 | Observability via ui.opened | Every view/modal opening emits `ui.opened` with target name and timestamp | ✅ |
| UC-105 | Cleanup on plugin unload | `dispose()` unsubscribes all listeners, no events fire after dispose | ✅ |

---

## Skip Reasons

| Category | Affected UCs | Unblocking Strategy |
|----------|--------------|---------------------|
| Obsidian Modal | UC-06 (Wizard UI) | Mock Obsidian `App`/`Modal` classes, or E2E test framework |
| Rendering only | UC-89 to UC-92 (Component Showcase) | Visual regression testing or Obsidian E2E framework |

The skipped tests in `InstallerJourney.test.ts` require the Obsidian runtime to instantiate `InstallerWizardModal`. The Component Showcase View is a pure rendering view with no business logic. In both cases, the underlying logic is fully covered by the passing tests.

---

## Coverage Strategy

### Tier Model

Coverage is prioritized by ROI — pure functions first, then injectable services, then UI wiring.

| Tier | Description | Status | Files | Tests |
|------|-------------|--------|-------|-------|
| **Tier 1: Pure functions** | Stateless input→output functions, zero mocking needed | ✅ Complete | `pathResolver`, `contentGenerator`, `configDocContent`, `settings`, `folders`, `glob`, `pathUtils`, `persistence`, `mutex`, `helpers`, `exportUtils`, `BaseQueryEngine`, `CsvParser` | ~500+ |
| **Tier 2: Injectable services** | Stateful services with injected `EventBus` + `Storage` | ✅ Complete (core) | All 11 domain services + `EventBus`, `EventBridge`, `ServiceContainer`, `CommandRegistry`, `UiCommandService` | ~475+ |
| **Tier 3: View orchestrators** | Obsidian `ItemView` subclasses testing event wiring | ✅ Partial | `EventCatalogView`, `EventLogView`, `DataExchangeHubView`, `ExportView`, `EventConfigModal`, `IngestionStatusBar` | ~170+ |
| **Tier 4: UI components** | Tab/page components with DOM rendering | ⏭️ Open ([[TD-27 Limited UI component testing|TD-27]]) | ~40 components in `catalog/`, `hub/`, `csv/`, `export/` | 0 |
| **Tier 5: Bootstrap/wiring** | `main.ts`, `pluginBootstrap.ts`, `dataExchangeSetup.ts` | ⏭️ Low ROI | Plugin lifecycle tightly coupled to Obsidian | 0 |

### Files at 100% Coverage

These files have full statement and branch coverage:

| File | Tests | Domain |
|------|-------|--------|
| `pathResolver.ts` | 82 | docs |
| `contentGenerator.ts` | 64 | docs |
| `configDocContent.ts` | 152 | dataExchange |
| `CsvParser.ts` | 12 | dataExchange |
| `glob.ts` | 15 | utils |
| `persistence.ts` | 11 | utils |
| `mutex.ts` | 5 | utils |
| `pathUtils.ts` | 19 | utils |
| `folders.ts` | 9 | installer |
| `settings.ts` | 19 | settings |
| `UserService.ts` | 19 | user |
| `EventBus.ts` | 13 | events |
| `UiCommandService.ts` | 25 | ui |

### Coverage Gaps (known)

| File | Coverage | Gap | Debt Item |
|------|----------|-----|-----------|
| `EventLogView.ts` | 8% | Rendering methods | [[TD-27 Limited UI component testing|TD-27]] |
| `ConfigDocService.ts` | 48% | Doc CRUD with file I/O | [[TD-30 Untested domain and infrastructure logic|TD-30 Tier 2]] |
| `PipelineExecutor.ts` | 45% | Multi-source orchestration | [[TD-30 Untested domain and infrastructure logic|TD-30 Tier 2]] |
| `DataDictionaryBuilder.ts` | 52% | Property aggregation | [[TD-30 Untested domain and infrastructure logic|TD-30 Tier 2]] |
| `DataExchangeService.ts` | 59% | Facade wiring | [[TD-30 Untested domain and infrastructure logic|TD-30 Tier 2]] |
| `DiscoveryService.ts` | 52% | Vault scan paths | [[TD-30 Untested domain and infrastructure logic|TD-30 Tier 2]] |

---

## Appendix A: Build Pipeline

```
npm run build = vitest run --coverage → typedoc → tsc -noEmit -skipLibCheck → eslint → esbuild
```

| Stage | What it validates |
|-------|-------------------|
| `vitest run` | All 1,447 tests pass (32 skipped), coverage report generated |
| `typedoc` | TSDoc comments generate without errors |
| `tsc` | Type-checking passes (`strict: true`, `-skipLibCheck` for node_modules) |
| `eslint` | Lint rules pass on `src/` |
| `esbuild` | Bundle produces `main.js` in `.obsidian/plugins/flowti-ibde/` |

## Appendix B: Test Environment

| Requirement | Details |
|-------------|---------|
| **Runtime** | Node.js (vitest) |
| **Platform** | Windows 10/11 |
| **Framework** | Vitest 4.x with `vi.fn()` mocks |
| **Obsidian API** | Mocked via `tests/mocks/obsidian-stub.ts` (no runtime dependency) |
| **Test Isolation** | Fresh `EventBus` + mock `IStorageProvider` per test (via `beforeEach`) |
| **Fake Timers** | `vi.useFakeTimers()` for timestamp-dependent tests (e.g., `contentGenerator`) |
| **Known Gotcha** | `DEFAULT_STATE` must use factory function to avoid shared-reference mutation across tests |
| **Known Gotcha** | `vi.fn(async () => { status: "completed" })` — tsc infers `string`, not literal union. Use explicit return type or `as const` |

## Appendix C: Test File Index

### Domain Tests (31 files)

| File | Tests | Source |
|------|-------|--------|
| `tests/domain/dataExchange/BaseQueryEngine.test.ts` | 26 | `.base` YAML query engine |
| `tests/domain/dataExchange/configDocContent.test.ts` | 152 | Config doc content builders |
| `tests/domain/dataExchange/CsvParser.test.ts` | 12 | CSV parse/generate |
| `tests/domain/dataExchange/DataExchangeService.test.ts` | 26 | Import/export orchestration |
| `tests/domain/dataExchange/ExportService.test.ts` | 34 | Vault→CSV export |
| `tests/domain/dataExchange/ImportService.test.ts` | 16 | CSV→vault import |
| `tests/domain/dataExchange/Pipeline.test.ts` | 25 | Multi-import pipelines |
| `tests/domain/dataExchange/ConfigPathTracker.test.ts` | 22 | Config path tracking |
| `tests/domain/dataExchange/DataDictionaryBuilder.test.ts` | 30 | Data dictionary building |
| `tests/domain/discovery/DiscoveryService.test.ts` | 27 | Event file discovery |
| `tests/domain/docs/contentGenerator.test.ts` | 64 | Doc content generators |
| `tests/domain/docs/DocService.test.ts` | 15 | Centralized doc creation |
| `tests/domain/docs/pathResolver.test.ts` | 82 | Doc path resolution |
| `tests/domain/eventDefinition/EventDefinitionService.test.ts` | 24 | Event transforms |
| `tests/domain/eventDefinition/payloadExtractor.test.ts` | 15 | Payload extraction |
| `tests/domain/eventFilter/EventFilterService.test.ts` | 14 | Event visibility |
| `tests/domain/eventNotify/EventNotificationService.test.ts` | 14 | Event notifications |
| `tests/domain/ingestion/IngestionService.test.ts` | 24 | File processing pipeline |
| `tests/domain/ingestion/JobQueue.test.ts` | 10 | Concurrent job queue |
| `tests/domain/installer/InstallerJourney.test.ts` | 20 | End-to-end installer |
| `tests/domain/installer/InstallerService.test.ts` | 26 | Step registry + execution |
| `tests/domain/installer/steps/FolderScaffoldStep.test.ts` | 7 | PARA folder creation |
| `tests/domain/installer/steps/UserCreationStep.test.ts` | 5 | User profile creation |
| `tests/domain/installer/folders.test.ts` | 9 | Folder constant validation |
| `tests/domain/settings/SettingsService.test.ts` | 14 | Settings persistence |
| `tests/domain/settings/settings.test.ts` | 19 | Zod schema validation |
| `tests/domain/subscription/SubscriptionService.test.ts` | 25 | Event watchers |
| `tests/domain/user/UserService.test.ts` | 19 | User profile lifecycle |

### Infrastructure Tests (11 files)

| File | Tests | Source |
|------|-------|--------|
| `tests/infrastructure/commands/CommandRegistry.test.ts` | 18 | Command pipeline |
| `tests/infrastructure/errors/ErrorService.test.ts` | 11 | Error handling |
| `tests/infrastructure/errors/FlowtiError.test.ts` | 13 | Error hierarchy |
| `tests/infrastructure/events/EventBridge.test.ts` | 53 | Obsidian API bridge |
| `tests/infrastructure/events/EventBus.test.ts` | 13 | Pub/sub backbone |
| `tests/infrastructure/events/catalog.test.ts` | 19 | Runtime catalog |
| `tests/infrastructure/logger/LoggerService.test.ts` | 19 | Structured logging |
| `tests/infrastructure/services/ServiceContainer.test.ts` | 24 | DI container |
| `tests/infrastructure/services/VaultQueryService.test.ts` | 12 | Vault queries |
| `tests/infrastructure/services/WorkspaceService.test.ts` | 4 | Workspace ops |
| `tests/infrastructure/ui/UiCommandService.test.ts` | 25 | UI command bus |

### UI Tests (9 files)

| File | Tests | Source |
|------|-------|--------|
| `tests/ui/EventCatalogView.test.ts` | 23 | Catalog event wiring |
| `tests/ui/EventConfigModal.test.ts` | 6 | Event config hub |
| `tests/ui/EventLogView.test.ts` | 25 | Activity feed |
| `tests/ui/DataExchangeHubView.test.ts` | 10 | Hub event wiring |
| `tests/ui/ExportView.test.ts` | 40 | Export wizard |
| `tests/ui/IngestionStatusBar.test.ts` | 7 | Status bar |
| `tests/ui/eventDocTemplate.test.ts` | 64 | Doc template generators |
| `tests/ui/catalog/helpers.test.ts` | 44 | Catalog helper functions |
| `tests/ui/catalog/DomainsTab.test.ts` | 16 | DomainsTab component |

### Flow Integration Tests (10 files)

| File | Pass | Skip | Source |
|------|------|------|--------|
| `tests/flows/01-FirstRunOnboarding.test.ts` | 4 | 2 | Installer lifecycle |
| `tests/flows/02-BrowseAndConfigureEvents.test.ts` | 10 | 2 | Subscription + definition CRUD |
| `tests/flows/03-ImportCsvAsNotes.test.ts` | 7 | 2 | CSV import pipeline |
| `tests/flows/04-ExportVaultData.test.ts` | 5 | 5 | Vault data export |
| `tests/flows/05-BuildImportPipeline.test.ts` | 8 | 2 | Multi-source pipeline |
| `tests/flows/06-CreateDomainDocumentation.test.ts` | 13 | 2 | Doc creation (7 types) |
| `tests/flows/07-MonitorAndDebugEvents.test.ts` | 8 | 3 | Subscription matching |
| `tests/flows/08-ConfigureFileIngestion.test.ts` | 9 | 4 | Ingestion + definition matching |
| `tests/flows/09-DiscoverCustomEvents.test.ts` | 7 | 3 | Event discovery lifecycle |
| `tests/flows/10-ManageDataDictionary.test.ts` | 16 | 3 | Config CRUD + data dictionary |

### Utility Tests (5 files)

| File | Tests | Source |
|------|-------|--------|
| `tests/utils/glob.test.ts` | 15 | Glob pattern matching |
| `tests/utils/helpers.test.ts` | 14 | UUID generation |
| `tests/utils/mutex.test.ts` | 5 | Path mutex |
| `tests/utils/pathUtils.test.ts` | 19 | Path manipulation |
| `tests/utils/persistence.test.ts` | 11 | Storage helpers |
