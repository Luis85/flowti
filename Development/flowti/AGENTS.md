# Flowti IBDE — Agent Instructions

You are working on **Flowti – IBDE** (Integrated Business Development Environment), an Obsidian plugin.

## Project overview

- **Codebase:** `Development/flowti/`
- **Target:** Obsidian Community Plugin (TypeScript → bundled JavaScript via esbuild)
- **Entry point:** `src/main.ts` → `main.js`
- **Release artifacts:** `main.js`, `manifest.json`, `styles.css`

### Purpose

Flowti – IBDE provides an integrated environment inside Obsidian to:
- Track and model business events
- Design, document, and evolve business processes
- Observe, control, and improve operational flows over time

It treats the Obsidian vault as a living business system, using Markdown as the primary source of truth and Git for state/history tracking.

### Sibling project

The **Foreign Folder Watcher** plugin lives at `Development/watcher/` with its own `AGENTS.md`. It is a separate npm project with independent build/test pipelines.

## Design principles

- **Event-driven architecture** — EventBus is the backbone; all inter-module communication via typed events
- **DDD layers** — Infrastructure (plumbing) → Domain (business logic) → UI (presentation)
- **Separation of concerns** — Each module has a single responsibility. Favor composition over inheritance.
- **Test-first development** — Start with requirements and happy-path tests. Not dogmatic, but the default.
- **Iterative development** — Make it work → make it better → make it pretty.
- **Markdown-first** — Human-readable, auditable artifacts. Git-native workflows.

## Environment & tooling

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | LTS (18+) | Runtime |
| npm | latest | Package manager |
| TypeScript | strict mode | Language |
| esbuild | latest | Bundler (config: `esbuild.config.mjs`) |
| Vitest | latest | Test runner |
| Zod | latest | Schema validation (settings, user types) |

### Commands

```bash
npm install        # Install dependencies
npm run dev        # Watch mode (esbuild --watch)
npm run build      # Full pipeline: vitest → typedoc → tsc → eslint → esbuild
npm test           # Run tests (npx vitest run)
```

**Note:** `tsc` uses `-skipLibCheck` to avoid `node_modules/` type errors.

## Architecture

### DDD layer structure

```
src/                                          # 110 files, ~31,000 LOC
├── main.ts                                   # Plugin orchestrator (482 LOC)
├── dataExchangeSetup.ts                      # Data Exchange UI wiring (extracted from main.ts)
├── pluginBootstrap.ts                        # Bootstrap helper
│
├── infrastructure/                           # Generic plumbing (no business logic)
│   ├── events/
│   │   ├── EventBus.ts                       # Central pub/sub implementation
│   │   ├── EventBridge.ts                    # Sole Obsidian API contact point
│   │   ├── catalog.ts                        # Event catalog metadata (CATALOG_DATA)
│   │   ├── events.ts                         # FlowtiEventMap (~98 events, composed from domains)
│   │   └── types.ts                          # IEventBus, EventHandler types
│   ├── errors/
│   │   ├── ErrorService.ts                   # Centralized error handling
│   │   ├── FlowtiError.ts                    # Typed error hierarchy
│   │   └── types.ts
│   ├── logger/
│   │   ├── LoggerService.ts                  # Structured logging with event emission
│   │   └── types.ts
│   ├── services/
│   │   ├── ServiceContainer.ts               # DI container with lifecycle management
│   │   ├── registry.ts                       # Service registrations (11 services)
│   │   └── types.ts
│   ├── commands/
│   │   ├── CommandRegistry.ts                # Command execution with middleware
│   │   ├── registry.ts                       # Command definitions (4 commands)
│   │   └── types.ts
│   ├── views/
│   │   ├── ViewRegistry.ts                   # View registration for ItemViews
│   │   ├── registry.ts                       # View definitions (3 core views)
│   │   └── types.ts
│   └── filesystem/
│       ├── FileSystemClient.ts               # Vault filesystem abstraction
│       ├── index.ts
│       └── types.ts
│
├── domain/                                   # Business logic (11 bounded contexts)
│   ├── dataExchange/                         # CSV import/export, pipelines, type docs
│   │   ├── BaseQueryEngine.ts                # .base YAML filter expression evaluator
│   │   ├── ConfigDocService.ts               # Doc generation + path resolution (934 LOC)
│   │   ├── ConfigPathTracker.ts              # File/folder rename → config path updates
│   │   ├── CsvParser.ts                      # Thin wrapper around papaparse
│   │   ├── DataDictionaryBuilder.ts          # Aggregate property usage across configs
│   │   ├── DataExchangeService.ts            # Orchestrator façade (578 LOC)
│   │   ├── ExportService.ts                  # Vault → CSV/Tab pipeline
│   │   ├── ImportService.ts                  # CSV → vault notes pipeline
│   │   ├── PipelineExecutor.ts               # Multi-source pipeline execution
│   │   ├── events.ts                         # DataExchangeEventMap
│   │   └── types.ts
│   ├── discovery/                            # Vault scan for user-defined events
│   │   ├── DiscoveryService.ts
│   │   ├── events.ts                         # DiscoveryEventMap
│   │   └── types.ts
│   ├── docs/                                 # Centralized documentation file creation
│   │   ├── DocService.ts                     # Listens for doc.create, creates files
│   │   ├── contentGenerator.ts               # Markdown content builders (708 LOC)
│   │   ├── pathResolver.ts                   # Entity doc path resolution
│   │   ├── events.ts                         # DocEventMap
│   │   ├── index.ts
│   │   └── types.ts
│   ├── eventDefinition/                      # Source event → domain event mapping
│   │   ├── EventDefinitionService.ts
│   │   ├── payloadExtractor.ts
│   │   ├── events.ts                         # EventDefinitionEventMap
│   │   └── types.ts
│   ├── eventFilter/                          # Activity Log visibility toggles
│   │   ├── EventFilterService.ts
│   │   ├── events.ts                         # EventFilterEventMap
│   │   └── types.ts
│   ├── eventNotify/                          # Notice popups on event fire
│   │   ├── EventNotificationService.ts
│   │   ├── events.ts                         # EventNotifyEventMap
│   │   └── types.ts
│   ├── ingestion/                            # File monitoring + job queue
│   │   ├── IngestionService.ts               # Wildcard listener → batching → retry
│   │   ├── JobQueue.ts                       # Generic concurrent queue
│   │   ├── events.ts                         # IngestionEventMap
│   │   └── types.ts
│   ├── installer/                            # First-run wizard + folder scaffold
│   │   ├── InstallerService.ts               # Step registry + pipeline executor
│   │   ├── InstallerWizardModal.ts           # 4-page wizard (Welcome → Complete)
│   │   ├── folders.ts                        # DEFAULT_IBDE_FOLDERS (23 folders)
│   │   ├── steps/
│   │   │   ├── UserCreationStep.ts           # Order 10: create user profile
│   │   │   └── FolderScaffoldStep.ts         # Order 20: scaffold PARA folders
│   │   ├── events.ts                         # InstallerEventMap
│   │   └── types.ts
│   ├── settings/                             # Plugin configuration persistence
│   │   ├── SettingsService.ts                # Load, update, persist with Zod validation
│   │   ├── FlowtiSettingTab.ts               # Obsidian settings tab UI
│   │   ├── settings.ts                       # Zod schema, types, defaults
│   │   ├── events.ts                         # SettingsEventMap
│   │   └── types.ts
│   ├── subscription/                         # Event watchers with filters
│   │   ├── SubscriptionService.ts            # CRUD + wildcard matching
│   │   ├── events.ts                         # SubscriptionEventMap
│   │   └── types.ts
│   └── user/                                 # User identity
│       ├── UserService.ts                    # Create, update, persist user profile
│       ├── events.ts                         # UserEventMap
│       └── types.ts
│
├── ui/                                       # Presentation layer
│   ├── catalog/                              # Event Catalog components (13 files)
│   │   ├── CatalogDashboard.ts               # Stats grid, quick actions
│   │   ├── DomainsTab.ts                     # Hybrid file + catalog domain scanning
│   │   ├── ServicesTab.ts                    # Service entity management
│   │   ├── EventsTab.ts                      # Category tree, event list (655 LOC)
│   │   ├── EventDetailPanel.ts               # Event detail with config counts
│   │   ├── FlowsTab.ts                       # File-driven flow docs
│   │   ├── SystemsTab.ts                     # File-driven system docs
│   │   ├── ActorsTab.ts                      # File-driven actor docs
│   │   ├── ProductsTab.ts                    # File-driven product docs
│   │   ├── entityScanner.ts                  # Shared file scanning utility
│   │   ├── helpers.ts                        # Layout, forms, cross-references (511 LOC)
│   │   ├── index.ts
│   │   └── types.ts                          # CatalogComponentDeps
│   ├── hub/                                  # Data Exchange Hub components (18 files)
│   │   ├── HubDashboard.ts                   # Pipeline summary, config tables (766 LOC)
│   │   ├── DashboardImportExecutor.ts        # Inline import progress row
│   │   ├── ImportsTab.ts                     # Saved import config management
│   │   ├── ExportsTab.ts                     # Saved export config management
│   │   ├── PipelinesTab.ts                   # Multi-source pipeline builder
│   │   ├── TypesTab.ts                       # Note type documentation CRUD
│   │   ├── PropertiesTab.ts                  # Data dictionary browser
│   │   ├── ReportsTab.ts                     # CSV file documentation browser
│   │   ├── helpers.ts                        # Stepper bar, config dropdown
│   │   ├── pipelines/                        # Pipeline detail sub-components
│   │   │   ├── PipelineDetail.ts
│   │   │   ├── PipelineEditForm.ts
│   │   │   ├── PipelinePreview.ts
│   │   │   ├── PipelineExecution.ts
│   │   │   ├── SourcesExportsGrid.ts
│   │   │   ├── index.ts
│   │   │   └── types.ts
│   │   ├── index.ts
│   │   └── types.ts
│   ├── csv/                                  # CSV import wizard components (7 files)
│   │   ├── CsvLanding.ts                     # File info, data snapshot (701 LOC)
│   │   ├── CsvConfigPage.ts                  # Form + column mapping grid
│   │   ├── CsvPreviewPage.ts                 # Parsed data preview
│   │   ├── CsvResultPage.ts                  # Import results
│   │   ├── csvUtils.ts                       # Delimiter detection, formatting
│   │   ├── index.ts
│   │   └── types.ts
│   ├── export/                               # Export wizard components (7 files)
│   │   ├── ViewSelectPage.ts                 # Source selection
│   │   ├── ConfigurePage.ts                  # Settings form + property grid
│   │   ├── PreviewPage.ts                    # Export preview
│   │   ├── ResultPage.ts                     # Results display
│   │   ├── exportUtils.ts                    # File property helpers, path utils
│   │   ├── index.ts
│   │   └── types.ts
│   ├── EventCatalogView.ts                   # 8-tab orchestrator (833 LOC)
│   ├── DataExchangeHubView.ts                # 7-page hub orchestrator (484 LOC)
│   ├── CsvActionView.ts                      # CSV import orchestrator (747 LOC)
│   ├── ExportView.ts                         # Export wizard orchestrator (655 LOC)
│   ├── EventLogView.ts                       # Activity feed (581 LOC)
│   ├── EventConfigModal.ts                   # Per-event config (628 LOC)
│   ├── PipelineSourceModal.ts                # CSV source editor for pipelines
│   ├── SubscriptionManagerModal.ts           # Manage all event subscriptions
│   ├── ComponentShowcaseView.ts              # CSS component preview
│   ├── eventDocTemplate.ts                   # Doc path + content barrel exports
│   ├── IngestionStatusBar.ts                 # Status bar widget
│   ├── modals.ts                             # ConfirmModal, InputModal, CreateEventModal
│   ├── FilePickerModal.ts                    # Fuzzy file picker
│   ├── FolderPickerModal.ts                  # Fuzzy folder picker
│   └── electronDialog.ts                     # Electron save dialog wrapper
│
└── utils/
    ├── helpers.ts                            # UUID generation (crypto.randomUUID)
    ├── glob.ts                               # Glob pattern matching
    ├── persistence.ts                        # loadStateFromStorage / saveStateToStorage
    └── types.ts                              # UUID, IStorageProvider, IDisposable
```

### Key architecture rules

- **EventBus** is the backbone — all cross-module communication via events
- **EventBridge** is the sole Obsidian API contact point for mutations; UI reads directly from `app.vault`/`app.metadataCache` for synchronous queries
- **Per-domain events** — Each domain folder has its own `events.ts` exporting an EventMap interface; composed via `extends` in `infrastructure/events/events.ts`
- **FlowtiEventMap** imports `type` from domain (compile-time only cross-layer dependency)
- **DocService** centralizes all doc file creation — callers emit `doc.create` instead of calling `fileSystemClient.createFile()` directly

### Core infrastructure

| Module | Responsibility |
|--------|---------------|
| **EventBus** | Central pub/sub for decoupled communication (~98 event types) |
| **EventBridge** | Bridges Obsidian workspace/vault events into EventBus |
| **FileSystemClient** | Promise-based file ops via request/response events with timeout |
| **LoggerService** | Structured logging with event emission and wildcard event trace |
| **ErrorService** | Centralized error handling with typed FlowtiError hierarchy |
| **ServiceContainer** | DI container with topological init/dispose lifecycle (11 services) |
| **CommandRegistry** | Command registration with middleware (logging, error handling) |
| **ViewRegistry** | View registration for custom ItemViews |

### Domain services (registered in ServiceContainer)

| # | Service ID | Domain | Purpose |
|---|------------|--------|---------|
| 1 | `settingsService` | settings | Plugin configuration with Zod validation |
| 2 | `userService` | user | User profile lifecycle (create, update, persist) |
| 3 | `eventFilterService` | eventFilter | Event visibility toggles for Activity Log |
| 4 | `eventNotifyService` | eventNotify | Notice popups when subscribed events fire |
| 5 | `docService` | docs | Centralized doc file creation via `doc.create` events |
| 6 | `discoveryService` | discovery | Vault scan for user-defined events (frontmatter) |
| 7 | `subscriptionService` | subscription | Event watchers with path/extension/name filters |
| 8 | `ingestionService` | ingestion | File monitoring, job queue, batching, retry |
| 9 | `eventDefinitionService` | eventDefinition | Source event → domain event mapping rules |
| 10 | `dataExchangeService` | dataExchange | CSV import/export, pipelines, config persistence |
| 11 | `installerService` | installer | First-run wizard, folder scaffolding (depends: userService) |

### Views

| View | Type Constant | Registration | Purpose |
|------|--------------|--------------|---------|
| EventCatalogView | `flowti-event-catalog` | ViewRegistry | 8-tab catalog: Dashboard, Domains, Services, Events, Flows, Systems, Actors, Products |
| EventLogView | `flowti-event-log` | ViewRegistry | Activity feed with category/type filters |
| ComponentShowcaseView | `flowti-component-showcase` | ViewRegistry | CSS component preview |
| DataExchangeHubView | `flowti-data-exchange-hub` | DataExchangeSetup | 7-page hub: Dashboard, Imports, Exports, Reports, Properties, Pipelines, Types |
| CsvActionView | `flowti-csv` | DataExchangeSetup | CSV file handler + inline import wizard |
| ExportView | `flowti-export` | DataExchangeSetup | 4-page export wizard |

### Commands

| ID | Name | Registration |
|----|------|-------------|
| `flowti:open-component-showcase` | Open Component Showcase | CommandRegistry |
| `flowti:open-event-catalog` | Open Event Catalog | CommandRegistry |
| `flowti:open-event-log` | Open Event Log | CommandRegistry |
| `flowti:manage-subscriptions` | Manage Watchers | CommandRegistry |
| `flowti:import-csv` | Import CSV | DataExchangeSetup |
| `flowti:export-data` | Export Data | DataExchangeSetup |

### Initialization order (main.ts)

```
Phase 1: Core infrastructure
  loadSettings → EventBus → Logger → ErrorService → EventBridge.register()

Phase 2: Containers
  ServiceContainer → CommandRegistry (+ middleware) → ViewRegistry

Phase 3: Registration
  registerServices(11) → registerCommands(4) → registerViews(3)

Phase 4: Service initialization
  services.initializeAll()  (topological sort)

Phase 5: UI binding
  addSettingTab → bindViews → bindCommands → addRibbonIcon

Phase 6: Post-load (onLayoutReady)
  settingsService.load() → userService.load() → installerService.load()
  → InstallerWizardModal.showIfNeeded()
  → eventFilterService.load() → eventNotifyService.load()
  → discoveryService.load() → subscriptionService.load()
  → ingestionService.load() → eventDefinitionService.load()
  → dataExchangeService.load() → DataExchangeSetup.wireCallbacks()
  → DataExchangeSetup.registerViews(3) → registerCommands(2)
  → eventBridge.registerVaultListeners()
  → emit("plugin.ready")
```

### Test structure

```
tests/                                        # 41 files, 811 tests (4 skipped)
├── mocks/
│   ├── obsidian-stub.ts                      # Obsidian DOM polyfills for test env
│   └── main-stub.ts
├── domain/
│   ├── dataExchange/                         # BaseQueryEngine, CsvParser, DataExchangeService,
│   │                                         # ExportService, ImportService, Pipeline
│   ├── discovery/DiscoveryService.test.ts
│   ├── docs/DocService.test.ts
│   ├── eventDefinition/                      # EventDefinitionService, payloadExtractor
│   ├── eventFilter/EventFilterService.test.ts
│   ├── eventNotify/EventNotificationService.test.ts
│   ├── ingestion/                            # IngestionService, JobQueue
│   ├── installer/                            # InstallerService, InstallerJourney, folders,
│   │                                         # steps/UserCreationStep, steps/FolderScaffoldStep
│   ├── settings/                             # SettingsService, settings (Zod schema)
│   ├── subscription/SubscriptionService.test.ts
│   └── user/UserService.test.ts
├── infrastructure/
│   ├── commands/CommandRegistry.test.ts
│   ├── errors/                               # ErrorService, FlowtiError
│   ├── events/                               # EventBus, EventBridge, catalog
│   ├── logger/LoggerService.test.ts
│   └── services/ServiceContainer.test.ts
├── ui/
│   ├── catalog/helpers.test.ts               # 44 tests for pure catalog helper functions
│   ├── EventCatalogView.test.ts              # 23 tests for catalog event contracts
│   ├── DataExchangeHubView.test.ts           # 10 tests for hub event contracts
│   ├── ExportView.test.ts                    # 40 tests for export view helpers
│   ├── EventConfigModal.test.ts
│   ├── eventDocTemplate.test.ts              # 64 tests for path + content generation
│   ├── EventLogView.test.ts
│   └── IngestionStatusBar.test.ts
└── utils/                                    # helpers, glob
```

**Build verification:** `npm run build` = vitest → typedoc → tsc -noEmit -skipLibCheck → eslint → esbuild

### Adding new features

**New command** — add to `src/infrastructure/commands/registry.ts`:
```typescript
{
  id: "flowti:my-command",
  name: "My Command",
  icon: "icon-name",
  handler: async (ctx) => {
    ctx.logger.debug("Executing command");
  },
}
```

**New service** — add to `src/infrastructure/services/registry.ts`:
```typescript
{
  id: "myService",
  factory: (container: IServiceContainer) =>
    new MyService({
      storage,
      eventBus: container.getEventBus(),
    }),
},
```

**New domain events** — add to the domain's `events.ts`:
```typescript
// src/domain/mydomain/events.ts
export interface MyDomainEventMap {
  "mydomain.created": { id: string };
  "mydomain.updated": { id: string; changes: Record<string, unknown> };
}
```
Then extend `FlowtiEventMap` in `src/infrastructure/events/events.ts`.

**New view** — add to `src/infrastructure/views/registry.ts`:
```typescript
{
  type: "flowti-my-view",
  displayName: "My View",
  icon: "icon-name",
  factory: (leaf) => new MyView(leaf),
}
```

**New doc type** — emit `doc.create` event via EventBus:
```typescript
eventBus.emit("doc.create", {
  docType: "MyDoc",
  name: "Document Name",
  entityType: "myEntities",    // maps to docsRootPath/MyEntities/
  source: "MyTab",
});
```

## File & folder conventions

- Source lives in `src/` organized by DDD layers (`infrastructure/`, `domain/`, `ui/`, `utils/`).
- Keep `main.ts` minimal — lifecycle orchestration only, no business logic.
- **Do not commit build artifacts:** Never commit `node_modules/`, `main.js`, or generated files.
- Keep the plugin small. Avoid large dependencies. Prefer browser-compatible packages.
- Release artifacts go to the plugin root: `main.js`, `manifest.json`, `styles.css`.

## Coding conventions

- TypeScript with strict null checks and no implicit any.
- **Split large files:** If any file exceeds ~600 LOC, consider extracting focused modules.
- **Single responsibility per file.**
- Bundle everything into `main.js` (no unbundled runtime deps).
- Prefer `async/await` over promise chains.
- Avoid `any` — use proper interfaces and type guards.
- Avoid mixing helpers into service files — keep pure functions in `utils/`.
- Avoid barrel exports (except for component sub-directories like `catalog/`, `hub/`, `csv/`, `export/`).
- Use TSDoc for public APIs.
- All services must implement `dispose()` to clean up event listeners.

## Agent do/don't

**Do:**
- Leverage the event-driven architecture — communicate via EventBus, not direct calls
- Follow separation of concerns — infrastructure vs domain vs UI
- Provide defaults and validation in settings (Zod schemas)
- Write idempotent code paths — reload/unload must not leak listeners or intervals
- Use `this.register*` helpers for everything needing cleanup
- Implement services as testable units with injected dependencies
- Implement `dispose()` on every service that registers event listeners
- Use `doc.create` events via DocService instead of direct file creation
- Keep the README and architecture docs up to date
- Every feature must have corresponding tests

**Don't:**
- Introduce network calls without an obvious user-facing reason and documentation
- Ship features requiring cloud services without explicit opt-in and disclosure
- Store or transmit vault contents unless essential and consented
- Put business logic in `main.ts` or infrastructure modules
- Import concrete implementations across layer boundaries (use `type` imports for events)
- Call `fileSystemClient.createFile()` for documentation files — use `doc.create` events instead

## Security & privacy

- Default to local/offline operation
- No hidden telemetry — require explicit opt-in for any external services
- Never execute remote code or auto-update outside normal releases
- Minimize scope: read/write only what's necessary
- Register and clean up all DOM, app, and interval listeners

## References

- Obsidian API: https://docs.obsidian.md
- Developer policies: https://docs.obsidian.md/Developer+policies
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Style guide: https://help.obsidian.md/style-guide
