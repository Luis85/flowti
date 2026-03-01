---
type: ArchitectureDoc
stage: done
updated: 2026-03-01
domain: Flowti/System
plugin: "[[Development/flowti/README|README]]"
tags:
  - backend
  - c4
---

# Flowti IBDE — Service Design Blueprint

> C4-structured architecture reference. Compressed — follow wikilinks for full details.
> UI architecture: [[Frontend Architecture]] · Data schemas: [[Data Dictionary]] · Tests: [[Testplan and Teststrategy]] · Events: [[Event Catalog]]

---

## C4 Level 1 — System Context

```
┌──────────────────────────────────────────────────┐
│                   Vault User                      │
│  creates notes · configures events · models       │
│  domains · imports/exports data                   │
└────────────────────┬─────────────────────────────┘
                     │ uses
                     ▼
┌──────────────────────────────────────────────────┐
│             Flowti IBDE Plugin                    │
│  Event-driven architecture toolkit for Obsidian   │
│  343+ events · 20 domain services · 11 views       │
└────────────────────┬─────────────────────────────┘
                     │ runs on
                     ▼
┌──────────────────────────────────────────────────┐
│             Obsidian Platform                     │
│  Vault (markdown files) · Workspace (views,       │
│  modals) · MetadataCache (frontmatter index) ·    │
│  Plugin API (loadData/saveData, registerView)     │
└──────────────────────────────────────────────────┘
```

No external network dependencies. All data stored in-vault via `saveData()`.

---

## C4 Level 2 — Container Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     Flowti IBDE Plugin                         │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  UI Layer                                                │ │
│  │  10 views · 7 modals · status bar                       │ │
│  │  [[EventCatalogView]] · [[DataExchangeHubView]]          │ │
│  │  [[CsvActionView]] · [[ExportView]] · [[EventLogView]]   │ │
│  │  [[ComponentShowcaseView]] · [[UserHubView]]             │ │
│  │  [[SessionWorkspaceView]] · [[TrainMainView]]            │ │
│  │  [[TrainTimelineSidebar]] · [[TrainHubView]]             │ │
│  └────────────────────────────┬──────────────────────────── │ │
│                               │ events                       │
│  ┌────────────────────────────┴────────────────────────────┐ │
│  │  Domain Layer  ·  20 services  ·  229+ events             │ │
│  │  Settings · User · EventFilter · EventNotify · Doc       │ │
│  │  Discovery · Subscription · Ingestion · EventDefinition  │ │
│  │  DataExchange · Installer · Session · Inbox · Nudge      │ │
│  │  Signal · Canvas · Analytics · Capture · Train           │ │
│  └────────────────────────────┬────────────────────────────┘ │
│                               │ events                       │
│  ┌────────────────────────────┴────────────────────────────┐ │
│  │  Infrastructure Layer  ·  114 events                     │ │
│  │  EventBus · EventBridge · FileSystemClient               │ │
│  │  LoggerService · ErrorService · ServiceContainer         │ │
│  │  CommandRegistry · ViewRegistry · UiCommandService        │ │
│  └────────────────────────────┬────────────────────────────┘ │
│                               │                              │
│  ┌────────────────────────────┴────────────────────────────┐ │
│  │  Obsidian Storage  ·  single JSON blob                   │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────┬───────────────────────────┘
                                   │
                          ┌────────┴────────┐
                          │ Obsidian Platform │
                          │ Vault · Workspace │
                          │ MetadataCache     │
                          └─────────────────┘
```

### Communication Rules

1. Services emit events on the EventBus — never import other services
2. **EventBridge** is the sole Obsidian API contact point for write operations
3. File ops use `*.request` → `*.response` correlated by `RequestId`
4. Domain services register in **ServiceContainer** with explicit dependencies
5. Doc creation centralized through **DocService** via `doc.create` events
6. User entry points (commands, ribbon icons, file menus) emit `ui.*` events — **UiCommandService** handles view/modal opening

---

## C4 Level 3 — Infrastructure Components

### EventBus

| | |
|---|---|
| **Source** | [[Development/flowti/src/infrastructure/events/EventBus.ts\|EventBus.ts]] |
| **Interface** | `IEventBus` — `emit()`, `on()`, `once()`, `off()`, `clear()` |
| **Phase** | 1 — direct instantiation, `clear()` on unload |

Core event router. Handlers in `Map<EventType | "*", Set<Handler>>`. Wildcard handlers fire after type-specific. Event format: `{ type, payload, timestamp }` (xstate v5 convention).

### EventBridge

| | |
|---|---|
| **Source** | [[Development/flowti/src/infrastructure/events/EventBridge.ts\|EventBridge.ts]] |
| **Interface** | `IEventBridge` — `register()`, `registerVaultListeners()`, `dispose()` |
| **Phase** | 1 — `register()` immediate; `registerVaultListeners()` deferred to Phase 6 |

Sole Obsidian API contact point. Translates platform callbacks into EventBus events.

- **Request handlers** (9): `file.{create,read,update,delete,move,rename}.request`, `frontmatter.{get,update,set}.request`
- **Vault notifications** (7): `file.{created,modified,deleted,renamed}`, `folder.{created,deleted,renamed}`
- **Other** (5): `event.file.triggered`, `workspace.{leaf-changed,file-opened,layout-changed}`, `metadata.{changed,resolved}`

### FileSystemClient

| | |
|---|---|
| **Source** | [[Development/flowti/src/infrastructure/filesystem/FileSystemClient.ts\|FileSystemClient.ts]] |
| **Interface** | `IFileSystemClient` — `createFile()`, `readFile()`, `updateFile()`, `deleteFile()`, `moveFile()`, `renameFile()`, `getFrontmatter()`, `updateFrontmatter()`, `setFrontmatter()` |

Each method emits `*.request` with unique `RequestId`, awaits matching `*.response`. Rejects on timeout (default: 5000ms).

### LoggerService

| | |
|---|---|
| **Source** | [[Development/flowti/src/infrastructure/logger/LoggerService.ts\|LoggerService.ts]] |
| **Interface** | `ILogger` — `debug()`, `info()`, `warn()`, `error()`, `setContext()`, `setDebugMode()` |
| **Emits** | `log.entry`, `log.error` |

When `debugMode` enabled, wildcard listener logs every event (skips `log.*` to prevent recursion).

### ErrorService

| | |
|---|---|
| **Source** | [[Development/flowti/src/infrastructure/errors/ErrorService.ts\|ErrorService.ts]] |
| **Interface** | `IErrorService` — `handle()`, `create()`, `wrap()` |
| **Emits** | `error.occurred` |

Error taxonomy: `validation` · `storage` · `lifecycle` · `service` · `command` · `event`. Severity: `low` · `medium` · `high` · `critical`.

### ServiceContainer

| | |
|---|---|
| **Source** | [[Development/flowti/src/infrastructure/services/ServiceContainer.ts\|ServiceContainer.ts]] |
| **Interface** | `IServiceContainer` — `register()`, `get()`, `has()`, `initializeAll()`, `disposeAll()` |
| **Emits** | `service.{registered,initialized,disposed,error}` |

Topological sort for init order. Circular dependency detection. `IDisposable` services get automatic cleanup.

### CommandRegistry

| | |
|---|---|
| **Source** | [[Development/flowti/src/infrastructure/commands/CommandRegistry.ts\|CommandRegistry.ts]] |
| **Emits** | `command.{registered,executing,executed,failed}` |

Middleware pipeline: `createLoggingMiddleware()` → `createErrorMiddleware()` (LIFO).

Commands emit `ui.*` events on the EventBus. The `UiCommandService` listens for these events and performs the actual view/modal opening — commands themselves are stateless emitters.

| ID | Icon | Opens |
|----|------|-------|
| `flowti:open-event-catalog` | `list` | [[EventCatalogView]] |
| `flowti:open-event-log` | `activity` | [[EventLogView]] |
| `flowti:open-component-showcase` | `palette` | [[ComponentShowcaseView]] |
| `flowti:manage-subscriptions` | `bell` | [[SubscriptionManagerModal]] |
| `flowti:import-csv` | `file-input` | [[CsvActionView]] |
| `flowti:export-data` | `file-output` | [[ExportView]] |

### ViewRegistry

| | |
|---|---|
| **Source** | [[Development/flowti/src/infrastructure/views/ViewRegistry.ts\|ViewRegistry.ts]] |
| **Emits** | `view.registered` |

| View Type | Display Name | Phase |
|-----------|-------------|-------|
| `flowti-event-catalog` | Event Catalog | 3 |
| `flowti-event-log` | Activity Log | 3 |
| `flowti-component-showcase` | Flowti Components | 3 |
| `flowti-data-exchange-hub` | Data Exchange Hub | 6 |
| `flowti-csv-action` | CSV Action | 6 |
| `flowti-export` | Export | 6 |
| `flowti-user-hub` | User Hub | 6 |
| `flowti-session-workspace` | Session Workspace | 6 |
| `flowti-train-main` | Train Main | 6 |
| `flowti-train-timeline` | Train Timeline | 6 |

`ViewStateProvider` supplies live settings, discovered events, excluded/notified types, and collapsed categories to views opened mid-session.

### UiCommandService

| | |
|---|---|
| **Source** | [[Development/flowti/src/infrastructure/ui/UiCommandService.ts\|UiCommandService.ts]] |
| **Events** | [[Development/flowti/src/infrastructure/ui/events.ts\|events.ts]] |
| **Listens** | `ui.openEventCatalog`, `ui.openEventLog`, `ui.openComponentShowcase`, `ui.openDataExchangeHub`, `ui.openSubscriptionManager`, `ui.openCsvImport`, `ui.openExport` |
| **Emits** | `ui.opened` |

Central handler for all user-initiated navigation. Every Obsidian command, ribbon icon, and file-menu item emits a `ui.*` event. UiCommandService listens and opens the appropriate view or modal via the Obsidian workspace API.

- **View commands** (4): reveal existing leaf or create new one. Event Catalog and Hub open in main workspace; Event Log and Component Showcase open in right sidebar.
- **Modal commands** (1): `ui.openSubscriptionManager` → instantiates and opens `SubscriptionManagerModal`.
- **Data exchange commands** (2): `ui.openCsvImport` / `ui.openExport` — delegate to injected callbacks (set during `onLayoutReady`) to avoid circular dependency with `DataExchangeSetup`. When no file path is provided (palette flow), shows an `InputModal` first.
- **Observability**: emits `ui.opened` with `{ target, timestamp }` after every view/modal open.
- **IDisposable**: properly unsubscribes all listeners on plugin unload.

---

## C4 Level 3 — Domain Components

### SettingsService

| | |
|---|---|
| **Source** | [[Development/flowti/src/domain/settings/SettingsService.ts\|SettingsService.ts]] |
| **ID** | `settingsService` · **Storage**: top-level keys |
| **Consumes** | `settings.update{CatalogCategories,CollapsedCategories,ShowSystemEvents,CatalogDomains,CatalogServices}` |
| **Emits** | `settings.loaded`, `settings.changed` |

Manages `FlowtiSettings` validated by Zod `FlowtiSettingsSchema`. Invalid data falls back to `DEFAULT_SETTINGS`. Must call `load()` in Phase 6. Key settings: `debugMode`, `docsRootPath`, `showSystemEvents`, `catalogCategories`, `ingestionConcurrency`, `watchFolders`. Full schema in [[Data Dictionary]].

**Flows**: [[First-Run Onboarding]]

### UserService

| | |
|---|---|
| **Source** | [[Development/flowti/src/domain/user/UserService.ts\|UserService.ts]] |
| **ID** | `userService` · **Storage**: `user` |
| **Emits** | `user.{created,updated,loaded}` |

Creates `FlowtiUser { id: UUID, name, createdAt }`. Single user per vault.

**Flows**: [[First-Run Onboarding]]

### EventFilterService

| | |
|---|---|
| **Source** | [[Development/flowti/src/domain/eventFilter/EventFilterService.ts\|EventFilterService.ts]] |
| **ID** | `eventFilterService` · **Storage**: `eventFilter` |
| **Consumes** | `eventFilter.{toggle,toggleCategory}` |
| **Emits** | `eventFilter.{loaded,changed}` |

Per-event-type visibility (eye toggles in [[EventCatalogView]]).

**Use cases**: [[Browse and Discover Events]]

### EventNotificationService

| | |
|---|---|
| **Source** | [[Development/flowti/src/domain/eventNotify/EventNotificationService.ts\|EventNotificationService.ts]] |
| **ID** | `eventNotifyService` · **Storage**: `eventNotify` |
| **Consumes** | `eventNotify.toggle`, `*` (wildcard — monitors for matches, skips `log.*`, `eventNotify.*`) |
| **Emits** | `eventNotify.{loaded,changed,fired}` |

Per-event-type notifications (bell toggles in [[EventCatalogView]]).

**Flows**: [[Monitor and Debug Events]]

### DocService

| | |
|---|---|
| **Source** | [[Development/flowti/src/domain/docs/DocService.ts\|DocService.ts]] |
| **ID** | `docService` |
| **Consumes** | `doc.{create,delete}`, `settings.{loaded,changed}` |
| **Emits** | `doc.{created,exists,failed,deleted}` |

Centralized doc creation. All UI/services emit `doc.create` instead of direct `fileSystemClient.createFile()`. Supports 17 `DocType` values (see [[Data Dictionary]]). Path resolution via `docsRootPath` + type-specific subfolders. Content generation in [[Development/flowti/src/domain/docs/contentGenerator.ts\|contentGenerator.ts]].

**Flows**: [[Create Domain Documentation]] · [[Discover Custom Events]]

### DiscoveryService

| | |
|---|---|
| **Source** | [[Development/flowti/src/domain/discovery/DiscoveryService.ts\|DiscoveryService.ts]] |
| **ID** | `discoveryService` · **Storage**: `discovery` |
| **Consumes** | `event.file.triggered`, `discovery.{create,remove}` |
| **Emits** | `discovery.{loaded,updated,removed}` |

Discovers events from vault files with `type: "Event"` frontmatter. Tracks `DiscoveredEvent { eventName, sourcePath, firstSeenAt, lastSeenAt, triggerCount, category }`.

**Flows**: [[Discover Custom Events]]

### SubscriptionService

| | |
|---|---|
| **Source** | [[Development/flowti/src/domain/subscription/SubscriptionService.ts\|SubscriptionService.ts]] |
| **ID** | `subscriptionService` · **Storage**: `subscription` |
| **Consumes** | `subscription.{create,update,remove,refresh}`, `settings.*`, `*` (wildcard matcher, skips `log.*`, `subscription.*`, `settings.*`) |
| **Emits** | `subscription.{loaded,created,updated,deleted,matched}` |

Event watchers with optional `SubscriptionFilter` (`pathPattern`, `extension`, `namePattern` — AND logic).

**Use cases**: [[Configure Event Subscriptions]] · **Flows**: [[Browse and Configure Events]]

### IngestionService

| | |
|---|---|
| **Source** | [[Development/flowti/src/domain/ingestion/IngestionService.ts\|IngestionService.ts]] |
| **ID** | `ingestionService` · **Storage**: `ingestion` |
| **Consumes** | `settings.*`, `*` (wildcard — watched event types) |
| **Emits** | `ingestion.job.{queued,started,completed,failed}`, `ingestion.batch.{started,completed}`, `ingestion.{stats,recovery.completed}`, `catchup.{started,file.found,completed}` |

Wildcard listener → time-windowed batching → concurrent `JobQueue` → retry with exponential backoff. Idempotency ledger (`processedKeys: Set<string>`, MAX_LEDGER_SIZE=10,000). Catch-up scan via `runCatchUp()`.

**Flows**: [[Configure File Ingestion]]

### EventDefinitionService

| | |
|---|---|
| **Source** | [[Development/flowti/src/domain/eventDefinition/EventDefinitionService.ts\|EventDefinitionService.ts]] |
| **ID** | `eventDefinitionService` · **Storage**: `eventDefinition` |
| **Consumes** | `eventDefinition.{create,update,remove,refresh}`, `settings.*`, `ingestion.job.completed` |
| **Emits** | `eventDefinition.{loaded,created,updated,deleted,matched}` + custom domain events via `emitCustom()` |

Maps `sourceEventType + filePattern → domainEventName` with `PayloadMapping[]` (`field`, `source`: path/metadata/derived, `expression`). Emission policy: `"once"` (deduplicated) or `"always"`.

**Use cases**: [[Configure Event Definitions]] · **Flows**: [[Configure File Ingestion]]

### DataExchangeService

| | |
|---|---|
| **Source** | [[Development/flowti/src/domain/dataExchange/DataExchangeService.ts\|DataExchangeService.ts]] |
| **ID** | `dataExchangeService` · **Storage**: `dataExchange` |
| **Consumes** | `dataExchange.{import,export,pipeline}.execute`, `file.renamed`, `folder.renamed` |
| **Emits** | `dataExchange.import.{started,progress,completed,failed}`, `dataExchange.export.{started,completed,failed}`, `dataExchange.pipeline.{started,sourceCompleted,completed,failed}`, `dataExchange.config.changed` |

Orchestrator wiring 4 sub-modules:

| Module | Role |
|--------|------|
| [[Development/flowti/src/domain/dataExchange/ConfigDocService.ts\|ConfigDocService]] | Path resolution + doc CRUD |
| [[Development/flowti/src/domain/dataExchange/PipelineExecutor.ts\|PipelineExecutor]] | Multi-source import pipeline |
| [[Development/flowti/src/domain/dataExchange/ConfigPathTracker.ts\|ConfigPathTracker]] | Tracks file/folder renames → updates config paths |
| [[Development/flowti/src/domain/dataExchange/DataDictionaryBuilder.ts\|DataDictionaryBuilder]] | Aggregates data dictionary from configs |

**Import**: CSV → vault notes via [[Development/flowti/src/domain/dataExchange/ImportService.ts\|ImportService]] (conflict: skip/update/overwrite)
**Export**: vault → CSV/Tab via [[Development/flowti/src/domain/dataExchange/ExportService.ts\|ExportService]] (conflict: overwrite/skip/append)
**Parsing**: [[Development/flowti/src/domain/dataExchange/CsvParser.ts\|CsvParser]] (papaparse) · [[Development/flowti/src/domain/dataExchange/BaseQueryEngine.ts\|BaseQueryEngine]] (`.base` YAML)

**Flows**: [[Import CSV as Notes]] · [[Export Vault Data]] · [[Build Import Pipeline]] · [[Manage Data Dictionary]]

### InstallerService

| | |
|---|---|
| **Source** | [[Development/flowti/src/domain/installer/InstallerService.ts\|InstallerService.ts]] |
| **ID** | `installerService` · **Dependencies**: `userService` · **Storage**: `installer` |
| **Emits** | `installer.{loaded,started,completed,failed}`, `installer.step.{started,completed}` |

Step pipeline: `IInstallerStep { id, name, description, intro, order, execute(context, deps) }`.

| Step | Order | Behavior |
|------|-------|----------|
| `UserCreationStep` | 10 | Creates user profile, skips if exists |
| `FolderScaffoldStep` | 20 | Scaffolds PARA structure (23 folders) |

Extensible: `registerStep(new MyStep())` before `runAll()`.

**Flows**: [[First-Run Onboarding]]

### SessionService

| | |
|---|---|
| **Source** | [[Development/flowti/src/domain/session/SessionService.ts\|SessionService.ts]] |
| **ID** | `sessionService` · **Storage**: `session` |
| **Consumes** | `session.{create,start,pause,resume,complete,archive,delete,refresh}`, `session.goal.*`, `session.task.*`, `session.reflection.*`, `session.intent.*`, `session.mode.*`, `session.energy.*`, `session.notes.*`, `session.context.*`, `session.decision.*`, `session.closure.*`, `file.modified` |
| **Emits** | 90 events covering lifecycle, goals, tasks, reflections, intent, energy, decisions, note sync, closure, activity tracking, cognitive overload |

Largest domain service (1,729 LOC). Manages `Session` entities with 6-state lifecycle (`prepared → running → paused → reviewing → completed → archived`), intent/energy tracking, execution tasks, reflections, closure ritual, and bidirectional note sync (forward: session → markdown file, reverse: markdown edits → session state). State machine validated by `isValidTransition()` in [[Development/flowti/src/domain/session/helpers.ts\|helpers.ts]].

**Flows**: [[Create and Manage Sessions]] · [[Run Intentional Session]] · [[Monitor Session from Sidebar]]

### InboxService

| | |
|---|---|
| **Source** | [[Development/flowti/src/domain/inbox/InboxService.ts\|InboxService.ts]] |
| **ID** | `inboxService` · **Storage**: `inbox` |
| **Consumes** | `subscription.matched`, `dataExchange.import.{completed,failed}`, `dataExchange.export.completed`, `inbox.refresh` |
| **Emits** | `inbox.{loaded,itemAdded,itemsChanged,refresh}` |

Collects actionable items from other domains via pure mapper functions. `InboxItem { id, type: "action"|"info", title, description, sourceEvent, sourceHub }`. MAX_INBOX_ITEMS=500 with oldest-first eviction. CRUD: `markRead()`, `dismiss()`, `clearAll()`.

### NudgeService

| | |
|---|---|
| **Source** | [[Development/flowti/src/domain/nudge/NudgeService.ts\|NudgeService.ts]] |
| **ID** | `nudgeService` · **Storage**: `nudge` |
| **Consumes** | `nudge.{configure,remove,dismiss}` |
| **Emits** | `nudge.{loaded,configured,removed,triggered,dismissed}` |

Scheduled reminders with timer-based triggering. Nudge configurations persist across sessions. Timer management with proper cleanup on dispose.

### HubRegistry

| | |
|---|---|
| **Source** | [[Development/flowti/src/domain/hub/HubRegistry.ts\|HubRegistry.ts]] |
| **Consumes** | `hub.{opened,closed,tab.changed,navigate}` |
| **Emits** | `hub.{opened,closed,tab.changed}` |

Central registry for hub-type views (Event Catalog, Data Exchange, User Hub). Manages hub lifecycle events and navigation state.

### SignalService

| | |
|---|---|
| **Source** | [[Development/flowti/src/domain/signal/SignalService.ts\|SignalService.ts]] |
| **ID** | `signalService` · **Storage**: `signal` |
| **Consumes** | `signal.{configure,remove,sync,testConnection}` |
| **Emits** | `signal.{loaded,configured,removed,connection.tested,sync.started,sync.progress,sync.completed,sync.failed,item.created,item.updated}` |

Manages external signal connections (Azure DevOps work items). CRUD for `SignalConfig`, sync orchestration with per-item error resilience. Adapter pattern: `SignalAdapter` interface with `AzureDevOpsAdapter` implementation (WIQL + batch GET, PAT auth).

**Flows**: [[Connect Azure DevOps Signal]]

### CanvasService

| | |
|---|---|
| **Source** | [[Development/flowti/src/domain/canvas/CanvasService.ts\|CanvasService.ts]] |
| **ID** | `canvasService` |
| **Emits** | `canvas.import.{started,progress,completed,failed}`, `canvas.config.{saved,deleted,loaded}` |

Orchestrates `.canvas` file parsing and import. Composes CanvasParser, CanvasImporter, CanvasRebuilder, and BaseGenerator.

### AnalyticsService

| | |
|---|---|
| **Source** | [[Development/flowti/src/domain/analytics/AnalyticsService.ts\|AnalyticsService.ts]] |
| **ID** | `analyticsService` · **Storage**: `dataExchange` (savedAnalyticsQueries within DataExchangeState) |
| **Emits** | `analytics.query.{started,completed,failed,saved,deleted}` |

Facade for the in-memory AnalyticsEngine. Manages saved query persistence, query execution with locale-aware parsing, joins, aggregation, and time bucketing. Currently stored within `"dataExchange"` key — planned migration to dedicated `"analytics"` key in [[Cycle 28 - Analytics Hub]].

### CaptureService

| | |
|---|---|
| **Source** | [[Development/flowti/src/domain/capture/CaptureService.ts\|CaptureService.ts]] |
| **ID** | `captureService` |

Thought capture and train composition for the Train domain.

### TrainService

| | |
|---|---|
| **Source** | [[Development/flowti/src/domain/train/TrainService.ts\|TrainService.ts]] |
| **ID** | `trainService` · **Dependencies**: `captureService` |

Train navigation and thought sequencing for linear/branching thought trains.

---

## Event Catalog

330+ events total: 114 infrastructure + 216+ domain.

> Note: The full event catalog is in [[Event Catalog]] and `src/infrastructure/events/catalog.ts`. Below is a summary by category.

### Infrastructure Events (114)

| Category | # | Events |
|----------|---|--------|
| Plugin Lifecycle | 5 | `plugin.{loading,loaded,ready,unloading,unloaded}` |
| Service Lifecycle | 4 | `service.{registered,initialized,disposed,error}` |
| Commands | 4 | `command.{registered,executing,executed,failed}` |
| Views | 1 | `view.registered` |
| Logging | 2 | `log.{entry,error}` |
| Errors | 2 | `error.{occurred,handled}` |
| File Ops Request | 6 | `file.{create,read,update,delete,move,rename}.request` |
| File Ops Response | 6 | `file.{create,read,update,delete,move,rename}.response` |
| File Notifications | 4 | `file.{created,modified,deleted,renamed}` |
| Folder Notifications | 3 | `folder.{created,deleted,renamed}` |
| Event File | 1 | `event.file.triggered` |
| Frontmatter Request | 3 | `frontmatter.{get,update,set}.request` |
| Frontmatter Response | 3 | `frontmatter.{get,update,set}.response` |
| Workspace | 3 | `workspace.{leaf-changed,file-opened,layout-changed}` |
| Metadata | 2 | `metadata.{changed,resolved}` |
| UI Commands | 8 | `ui.{openEventCatalog,openEventLog,openComponentShowcase,openDataExchangeHub,openSubscriptionManager,openCsvImport,openExport,opened}` |

### Domain Events (194)

| Category | # | Events |
|----------|---|--------|
| Settings | 7 | `settings.{loaded,changed}`, `settings.update{CatalogCategories,CollapsedCategories,ShowSystemEvents,CatalogDomains,CatalogServices}` |
| User | 3 | `user.{created,updated,loaded}` |
| Event Filter | 4 | `eventFilter.{loaded,changed,toggle,toggleCategory}` |
| Event Notification | 4 | `eventNotify.{loaded,changed,toggle,fired}` |
| Documentation | 6 | `doc.{create,created,exists,failed,delete,deleted}` |
| Discovery | 5 | `discovery.{loaded,updated,create,remove,removed}` |
| Subscription | 9 | `subscription.{loaded,created,updated,deleted,create,update,remove,refresh,matched}` |
| Ingestion | 11 | `ingestion.job.{queued,started,completed,failed}`, `ingestion.batch.{started,completed}`, `ingestion.{stats,recovery.completed}`, `catchup.{started,file.found,completed}` |
| Event Definition | 9 | `eventDefinition.{loaded,created,updated,deleted,create,update,remove,refresh,matched}` |
| Data Exchange | 15 | `dataExchange.import.{execute,started,progress,completed,failed}`, `dataExchange.export.{execute,started,completed,failed}`, `dataExchange.pipeline.{execute,started,sourceCompleted,completed,failed}`, `dataExchange.config.changed` |
| Installer | 6 | `installer.{loaded,started,completed,failed}`, `installer.step.{started,completed}` |
| Session | 90 | Lifecycle, goals, tasks, reflections, intent, energy, decisions, note sync, closure, activity, overload (see [[Event Catalog]] for full list) |
| Inbox | 4 | `inbox.{loaded,itemAdded,itemsChanged,refresh}` |
| Nudge | 8 | `nudge.{configure,configured,remove,removed,triggered,dismiss,dismissed,loaded}` |
| Hub | 4 | `hub.{opened,closed,tab.changed,navigate}` |
| Notification | 8 | `notification.{show,dismiss,action,dismissed,actioned,loaded,updated,cleared}` |
| Signal | 10 | `signal.{configured,removed,connection.tested,loaded}`, `signal.sync.{started,progress,completed,failed}`, `signal.item.{created,updated}` |
| Canvas | 8 | `canvas.import.{started,progress,completed,failed}`, `canvas.config.{saved,deleted,loaded}`, `canvas.rebuild.completed` |
| Analytics | 5 | `analytics.query.{started,completed,failed,saved,deleted}` |

---

## Initialization Sequence

### Startup (6 phases)

```
Plugin.onload()
│
├─ Phase 1: Core Infrastructure
│  ├─ loadSettings()              → Zod-validated settings
│  ├─ initializeEventBus()        → new EventBus()
│  ├─ initializeLogger()          → new LoggerService({ debugMode })
│  ├─ initializeErrorService()    → new ErrorService()
│  ├─ initializeEventBridge()     → new EventBridge().register()
│  └─ setupEventListeners()       → settings.changed → logger.setDebugMode()
│
├─ Phase 2: Containers
│  ├─ initializeServiceContainer()
│  ├─ initializeCommandRegistry() + middleware
│  └─ initializeViewRegistry()
│
├─ Phase 3: Registration
│  ├─ registerAllServices()       → 19 services
│  ├─ registerAllCommands()       → 4 core commands
│  └─ registerAllViews()          → 3 core views
│
├─ Phase 4: Service Initialization
│  └─ services.initializeAll()    → topological sort
│
├─ Phase 5: UI Binding
│  ├─ addSettingTab(FlowtiSettingTab)
│  ├─ bindViews()                 → registerView() × 3
│  └─ bindCommands()              → addCommand() × 4
│
└─ Phase 6: Post-Load (onLayoutReady)
    ├─ settingsService.load()
    ├─ userService.load()
    ├─ installerService.load()
    ├─ InstallerWizardModal.showIfNeeded()
    ├─ [filter, notify, discovery, subscription,
    │   ingestion, eventDef, dataExchange,
    │   session, inbox, nudge].load()
    ├─ DataExchangeSetup
    │  ├─ wireCallbacks()         → setDocsRootPath, setListFiles, etc.
    │  ├─ registerViews()         → 3 data exchange views
    │  ├─ registerFileMenuItems() → CSV import, export context menus
    │  └─ registerCommands()      → 2 data exchange commands
    ├─ ingestionService.runCatchUp() (if watchFolders configured)
    ├─ eventBridge.registerVaultListeners()  ← AFTER all loads
    └─ emit("plugin.ready")
```

### Shutdown

```
Plugin.onunload()
├─ emit("plugin.unloading")
├─ EventBridge.dispose()
├─ services.disposeAll()          → reverse init order
├─ commands.clear()
├─ views.clear()
├─ eventBus.clear()               → last, so unload listeners still fire
└─ emit("plugin.unloaded")
```

### Service Registration Order

| # | Service ID | Deps |
|---|------------|------|
| 1 | `settingsService` | — |
| 2 | `userService` | — |
| 3 | `eventFilterService` | — |
| 4 | `eventNotifyService` | — |
| 5 | `docService` | — |
| 6 | `discoveryService` | — |
| 7 | `subscriptionService` | — |
| 8 | `ingestionService` | — |
| 9 | `eventDefinitionService` | — |
| 10 | `dataExchangeService` | — |
| 11 | `installerService` | `userService` |
| 12 | `sessionService` | — |
| 13 | `inboxService` | — |
| 14 | `nudgeService` | — |
| 15 | `hubRegistry` | — |
| 16 | `signalService` | — |
| 17 | `canvasService` | — |
| 18 | `analyticsService` | — |
| 19 | `captureService` | — |
| 20 | `trainService` | `captureService` |

---

## Storage Schema

Single JSON blob via `loadData()`/`saveData()`. All services share one `IStorageProvider` adapter.

```typescript
{
  // SettingsService (top-level keys)
  debugMode: boolean,
  docsRootPath: string,
  showSystemEvents: boolean,
  catalogCategories: CatalogCategoryConfig[],
  collapsedCategories: string[],
  catalogDomains: CatalogCategoryConfig[],
  catalogServices: CatalogCategoryConfig[],
  entityPaths: Record<string, string>,
  ingestionConcurrency: number,
  ingestionBatchWindowMs: number,
  ingestionMaxRetries: number,
  ingestionWatchEventTypes: string[],
  watchFolders: string[],

  // UserService
  user: { id: UUID, name: string, createdAt: string },

  // EventFilterService
  eventFilter: { excludedTypes: string[] },

  // EventNotificationService
  eventNotify: { notifiedTypes: string[] },

  // DiscoveryService
  discovery: { events: Record<string, DiscoveredEvent> },

  // SubscriptionService
  subscription: { subscriptions: Record<string, Subscription> },

  // IngestionService
  ingestion: { processedKeys: string[], pendingJobs?: IngestionJob[] },

  // EventDefinitionService
  eventDefinition: {
    definitions: Record<string, EventDefinition>,
    emittedKeys: string[]
  },

  // DataExchangeService
  dataExchange: {
    savedImportConfigs: SavedImportConfig[],
    savedExportConfigs: SavedExportConfig[],
    savedPipelines?: SavedMultiImportPipeline[],
    csvDisplaySettings?: Record<string, CsvDisplaySettings>,
    hiddenCsvPaths?: string[]
  },

  // InstallerService
  installer: {
    installed: boolean,
    installedAt?: string,
    completedSteps: Record<string, { completedAt: string }>
  },

  // SessionService
  session: {
    sessions: Session[],
    sessionTypes: SessionType[]
  },

  // InboxService
  inbox: {
    items: InboxItem[]  // MAX_INBOX_ITEMS=500, oldest-first eviction
  },

  // NudgeService
  nudge: {
    nudges: NudgeConfig[]
  },

  // SignalService
  signal: {
    signals: SignalConfig[]  // Azure DevOps connection configs + sync state
  }

  // Note: AnalyticsService stores savedAnalyticsQueries within dataExchange key.
  // Planned migration to dedicated "analytics" key in Cycle 28.
}
```

Full type definitions in [[Data Dictionary]].

---

## Dependency Graph

```
                    ┌──────────┐
                    │ EventBus │
                    └────┬─────┘
           ┌─────────────┼─────────────────────┐
           │             │                     │
     ┌─────▼─────┐ ┌────▼──────┐       ┌──────▼───────┐
     │  Logger   │ │  Error    │       │ EventBridge  │
     │  Service  │ │  Service  │       │              │
     └─────┬─────┘ └──────────┘       └──────────────┘
           │
     ┌─────▼────────────┐
     │ ServiceContainer │
     └─────┬────────────┘
           │
    ┌──────┴───────────────────────────────────────┐
    │      │       │       │       │       │       │
  ┌─▼──┐┌─▼──┐┌──▼──┐┌──▼──┐┌──▼──┐┌──▼──┐┌──▼──┐
  │Sett││User││Filt-││Noti-││ Doc ││Disc-││Subs-│
  │ings││Svc ││er   ││fy   ││ Svc ││over ││crip │
  └────┘└────┘└─────┘└─────┘└─────┘└─────┘└─────┘
  ┌─────┐┌─────────┐┌────────────┐
  │Inge-││EventDef-││DataExchange│
  │stion││inition  ││Service     │
  └─────┘└─────────┘└────────────┘
  ┌──────────────────┐
  │  Installer       │
  │  (→ userService) │
  └──────────────────┘
  ┌──────────┐┌──────┐┌──────┐┌─────┐
  │ Session  ││Inbox ││Nudge ││ Hub │
  │ Service  ││Svc   ││Svc   ││Reg  │
  └──────────┘└──────┘└──────┘└─────┘
  ┌──────────┐┌──────────┐┌───────────┐
  │ Signal   ││ Canvas   ││ Analytics │
  │ Service  ││ Service  ││ Service   │
  └──────────┘└──────────┘└───────────┘
  ┌──────────┐┌──────────┐
  │ Capture  ││ Train    │
  │ Service  ││(→capture)│
  └──────────┘└──────────┘
  ┌──────────────┐   ┌──────────────┐
  │CommandRegistry│   │ ViewRegistry │
  └──────────────┘   └──────────────┘
```

---

## Appendix

### Branded Types

| Type | Base | Source |
|------|------|--------|
| `UUID` | `string & { __brand: "UUID" }` | `src/utils/types.ts` |
| `RequestId` | `string & { __brand: "RequestId" }` | `src/infrastructure/events/events.ts` |

### Shared Interfaces

| Interface | Purpose |
|-----------|---------|
| `IStorageProvider` | `load()` / `save()` for all persistent services |
| `IDisposable` | Automatic cleanup via ServiceContainer |
| `FlowtiEvent<T>` | All event handlers |
| `FlowtiErrorInfo` | ErrorService + event payloads |
| `LogEntry` | LoggerService + event payloads |

### Zod Validation Schemas

| Schema | Source | Target |
|--------|--------|--------|
| `FlowtiSettingsSchema` | [[Development/flowti/src/domain/settings/settings.ts\|settings.ts]] | Settings on load |
| `FlowtiUserSchema` | [[Development/flowti/src/domain/user/types.ts\|user/types.ts]] | User data on load |
| `UUIDSchema` | [[Development/flowti/src/domain/user/types.ts\|user/types.ts]] | UUID format |

---

*Build pipelines and distribution: see [[README|README §12]].*

*See also: [[Frontend Architecture]] · [[Event Catalog]] · [[Data Dictionary]] · [[Testplan and Teststrategy]] · [[Technical Debt Review 2026-02-13]]*
