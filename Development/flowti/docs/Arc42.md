---
type: ArchitectureDocument
template: Arc42
stage: living
version: 0.0.1
last_updated: 2026-02-16
---

# Arc42 — Flowti IBDE

## 1. Introduction and Goals

### 1.1 Requirements Overview

Flowti is an **Integrated Business Development Environment (IBDE)** built as an Obsidian desktop plugin. It provides a framework for describing, managing, and visualizing digital twins of business processes inside a markdown-based knowledge base.

**Core capabilities:**

- **Event Catalog** — Discover, browse, and manage business events across domains, services, flows, systems, actors, and products
- **Data Exchange** — Import CSV data as vault notes, export vault data as CSV/TSV, build multi-source import pipelines with merge-key deduplication
- **Documentation Sessions** — Time-boxed Pomodoro sessions with focus file, artifact tracking, timeline, and session document generation
- **Ingestion Pipeline** — Automated file processing with job queue, batching, retry logic, and idempotency
- **Event Subscriptions** — Watch rules with glob-pattern filters that route matching events to an actionable inbox
- **User Hub** — Personal dashboard aggregating cross-hub summaries, inbox items, and active sessions
- **Installer** — Guided first-run wizard with pluggable setup steps

### 1.2 Quality Goals

| Priority | Quality Goal | Approach |
|----------|-------------|----------|
| 1 | **Testability** | Domain services never touch the Obsidian API directly; all I/O flows through the EventBus and EventBridge |
| 2 | **Extensibility** | Registry pattern for services, commands, views, and hub providers — adding a new bounded context requires < 200 LOC |
| 3 | **Type Safety** | Full TypeScript strict mode; Zod validation at system boundaries; type-checked event catalog at compile time |
| 4 | **Loose Coupling** | Event-driven communication between all domains; no service-to-service direct dependencies |

### 1.3 Stakeholders

| Role | Expectations |
|------|-------------|
| Domain Architect | Structure and discipline for business process documentation; time-boxed sessions; health dashboards |
| Business Analyst | Event discovery; CSV data exchange; backlog structuring |
| Developer | Type-safe extensibility; testable services; clear architectural boundaries |
| Plugin Author | Clean API surface; registry-based extension points; documented event catalog |

---

## 2. Constraints

### 2.1 Technical Constraints

| Constraint | Description |
|-----------|-------------|
| Runtime | Obsidian Desktop (Electron, Node 16+); `isDesktopOnly: true` |
| Language | TypeScript 5.9 strict mode |
| Data Format | Markdown-first with YAML frontmatter; `.base` files for structured queries; `.csv` for data exchange |
| Persistence | Obsidian `loadData()`/`saveData()` for plugin state; vault files for user content |
| Bundle | Single `main.js` via esbuild; no dynamic imports; external: `obsidian`, `electron`, Node builtins |
| Dependencies | Runtime: `papaparse` (CSV), `zod` (validation). All other deps are dev-only. |
| Min App Version | Obsidian 1.11.4 |

### 2.2 Organizational Constraints

| Constraint | Description |
|-----------|-------------|
| Release | Community plugin guidelines; artifacts: `main.js`, `manifest.json`, `styles.css` |
| Versioning | SemVer via `manifest.json` + `versions.json` |
| Testing | Full pipeline: `vitest run --coverage && typedoc && tsc -noEmit && eslint && esbuild` |
| License | MIT |

### 2.3 Conventions

| Convention | Description |
|-----------|-------------|
| CSS Isolation | All classes prefixed `ft-` to avoid conflicts with Obsidian core styles |
| Event Naming | Dot-separated: `<domain>.<entity>.<action>` (e.g., `session.timer.tick`) |
| Doc Types | Frontmatter `type` field identifies entity kind (EventDoc, ServiceDoc, SessionDocument, etc.) |
| Storage Keys | Each service gets a scoped key via `TypedStorage` (e.g., `"sessions"`, `"inbox"`) |

---

## 3. Context and Scope

### 3.1 Business Context

```
                    ┌──────────────────────────────────┐
                    │          Vault User               │
                    │  (Domain Architect / Analyst)      │
                    └──────────┬───────────────────────┘
                               │
                     Commands, File edits, Sessions
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                     Obsidian Desktop                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                   Flowti IBDE Plugin                    │  │
│  │                                                        │  │
│  │  Event Catalog · Data Exchange · Sessions · Ingestion  │  │
│  │  Subscriptions · Inbox · User Hub · Installer          │  │
│  └────────────────────────────────────────────────────────┘  │
│                               │                              │
│                  Vault (Markdown files)                       │
│                  .base files · .csv files                     │
└──────────────────────────────────────────────────────────────┘
                               │
                     Git (version control)
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Remote Repository  │
                    └──────────────────────┘
```

**External interfaces:**

| Partner | Medium | Direction | Content |
|---------|--------|-----------|---------|
| Vault User | Obsidian UI | Bidirectional | Commands, modals, views, file edits |
| Obsidian Vault | File system | Bidirectional | Markdown, CSV, .base files, frontmatter |
| External File System | Node.js `fs` | Bidirectional | CSV import sources, export targets |
| Obsidian API | Plugin API | Bidirectional | Workspace, MetadataCache, Vault, FileManager |

### 3.2 Technical Context

```
┌────────────────────────────────────────────────────────────────────┐
│                        Flowti Plugin Process                       │
│                                                                    │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────┐  │
│  │ Commands │   │  Views   │   │ Modals   │   │ Settings Tab │  │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   └──────┬───────┘  │
│       │              │              │                 │           │
│       └──────────────┴──────┬───────┴─────────────────┘           │
│                             │                                     │
│                    ┌────────▼────────┐                            │
│                    │    EventBus     │  150+ typed events         │
│                    │  (pub-sub hub)  │  wildcard support          │
│                    └────────┬────────┘                            │
│                             │                                     │
│         ┌───────────────────┼───────────────────┐                │
│         │                   │                   │                │
│  ┌──────▼──────┐    ┌──────▼──────┐    ┌───────▼───────┐       │
│  │   Domain    │    │   Domain    │    │    Domain     │       │
│  │  Services   │    │  Services   │    │   Services    │       │
│  │ (14 total)  │    │             │    │               │       │
│  └──────┬──────┘    └──────┬──────┘    └───────┬───────┘       │
│         │                  │                   │                │
│         └──────────────────┴───────┬───────────┘                │
│                                    │                             │
│                           ┌────────▼────────┐                   │
│                           │   EventBridge   │                   │
│                           │  (Obsidian ↔    │                   │
│                           │   EventBus)     │                   │
│                           └────────┬────────┘                   │
│                                    │                             │
└────────────────────────────────────┼─────────────────────────────┘
                                     │
                    ┌────────────────┬┴────────────────┐
                    │                │                 │
             ┌──────▼──────┐  ┌─────▼──────┐  ┌──────▼──────┐
             │ Vault API   │  │ Workspace  │  │ Metadata    │
             │ (CRUD)      │  │ API        │  │ Cache       │
             └─────────────┘  └────────────┘  └─────────────┘
```

---

## 4. Solution Strategy

### 4.1 Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Event-driven architecture** | All inter-domain communication flows through the EventBus. Services never call each other directly. This eliminates circular dependencies and makes every service independently testable. |
| **EventBridge as sole Obsidian adapter** | A single bridge translates between Obsidian's imperative API and the plugin's event-driven domain. Domain services remain platform-agnostic. |
| **Registry pattern for extensibility** | ServiceContainer, CommandRegistry, ViewRegistry, and HubRegistry all follow the same register/resolve pattern. Adding a new feature requires registering, not modifying. |
| **Pure helper functions for computation** | Time calculations, path resolution, and content generation are stateless pure functions. They are trivially testable and reusable from any context. |
| **TypedStorage for isolation** | Each service gets a scoped storage key with `PathMutex` serialization. No service can accidentally corrupt another's state. |
| **6-phase initialization** | Startup is deterministic: Settings → Containers → Registration → Initialization → UI Binding → Post-Load. Shutdown reverses this order. |
| **Request-response via events** | File operations use a `file.*.request` / `file.*.response` pattern through EventBridge, keeping domain services decoupled from the vault API. |
| **Markdown-first content** | All user-visible artifacts are markdown with YAML frontmatter. This ensures Git-trackability, human readability, and full participation in Obsidian's link graph. |

### 4.2 Technology Choices

| Technology | Purpose |
|-----------|---------|
| TypeScript 5.9 (strict) | Type safety across the entire codebase |
| Zod 4 | Runtime validation at system boundaries (settings, user input) |
| PapaParse | CSV parsing with delimiter detection |
| esbuild | Fast bundling to single `main.js` |
| Vitest 4 | Testing with v8 coverage; happy-dom for UI tests |
| typedoc | API documentation generation |

---

## 5. Building Block View

### 5.1 Level 1 — System Decomposition

```
┌─────────────────────────────────────────────────────────────────┐
│                        Flowti IBDE Plugin                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    UI Layer (~90 files)                   │   │
│  │  Views · Modals · Tabs · Panels · Shared Components      │   │
│  └────────────────────────────┬──────────────────────────────┘  │
│                               │                                 │
│  ┌────────────────────────────▼──────────────────────────────┐  │
│  │               Infrastructure Layer (~27 files)             │  │
│  │  EventBus · EventBridge · ServiceContainer · Commands      │  │
│  │  ViewRegistry · Logger · ErrorService · UiCommandService   │  │
│  └────────────────────────────┬──────────────────────────────┘  │
│                               │                                 │
│  ┌────────────────────────────▼──────────────────────────────┐  │
│  │                 Domain Layer (~72 files)                    │  │
│  │  14 Bounded Contexts (services, types, events, helpers)    │  │
│  └────────────────────────────┬──────────────────────────────┘  │
│                               │                                 │
│  ┌────────────────────────────▼──────────────────────────────┐  │
│  │                  Utilities (~7 files)                       │  │
│  │  TypedStorage · PathMutex · Glob · CSV · Helpers           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Level 2 — Domain Bounded Contexts

| Bounded Context | Service | LOC | Purpose |
|----------------|---------|-----|---------|
| **dataExchange** | DataExchangeService | 3,285 | CSV import/export, pipelines, data dictionaries, config management |
| **docs** | DocService | 1,228 | Centralized doc file creation with content templates per doc type |
| **session** | SessionService | 783 | Time-boxed Pomodoro sessions with timer, artifacts, timeline, templates |
| **installer** | InstallerService | 705 | First-run wizard with pluggable steps (folder scaffold, user creation) |
| **settings** | SettingsService | 664 | Plugin settings with Zod validation, entity paths, catalog categories |
| **ingestion** | IngestionService | 608 | File event pipeline with job queue, batching, retry, idempotency |
| **eventDefinition** | EventDefinitionService | 526 | Maps file events to domain events via configurable definitions |
| **inbox** | InboxService | 423 | Aggregates actionable items from domain events into a time-windowed inbox |
| **subscription** | SubscriptionService | 346 | Event watch rules with glob-pattern filters |
| **discovery** | DiscoveryService | 305 | Discovers user-defined events from vault files |
| **hub** | HubRegistry | 224 | Central registry for hub providers and cross-hub navigation |
| **user** | UserService | 213 | User profile management |
| **eventFilter** | EventFilterService | 168 | Event visibility toggles for the Event Log |
| **eventNotify** | EventNotificationService | 161 | Event notification popups via Obsidian Notices |

**Total domain code: ~10,460 LOC across 72 files**

### 5.3 Level 2 — Infrastructure Components

| Component | Files | LOC | Purpose |
|-----------|-------|-----|---------|
| **EventBus** | EventBus.ts, events.ts | 705 | Typed pub-sub hub; 150+ event types; wildcard support |
| **EventBridge** | EventBridge.ts | 613 | Obsidian API ↔ EventBus translation; file ops, frontmatter, vault/workspace/metadata listeners |
| **Event Catalog** | catalog.ts | 460 | Runtime metadata for all events; category, direction, domain, stability |
| **ServiceContainer** | ServiceContainer.ts, registry.ts, types.ts | 634 | Dependency injection; singleton/transient lifecycles; topological init; circular dependency detection |
| **CommandRegistry** | CommandRegistry.ts, registry.ts, types.ts | 433 | Command registration with middleware pipeline (logging + error handling) |
| **ViewRegistry** | ViewRegistry.ts, registry.ts, types.ts | 233 | View registration with factory pattern |
| **ErrorService** | ErrorService.ts, FlowtiError.ts, types.ts | 383 | Structured errors with category/severity; error wrapping; event emission |
| **LoggerService** | LoggerService.ts, types.ts | 241 | 4-level logging with context; debug mode toggle; event trace |
| **UiCommandService** | UiCommandService.ts | 258 | Handles all `ui.*` events; bridges commands to workspace operations |

**Total infrastructure code: ~4,805 LOC across 27 files**

### 5.4 Level 2 — UI Components

| Module | Files | Key Views / Components |
|--------|-------|----------------------|
| **Catalog** | 19 | EventCatalogView (735 LOC), 8 entity tabs (Domains, Services, Events, Flows, Systems, Actors, Products, Health), detail panels, entity scanner |
| **Data Exchange Hub** | 15 | DataExchangeHubView (477 LOC), Imports/Exports/Reports/Properties/Pipelines/Types tabs, pipeline management |
| **CSV Import** | 10 | CsvActionView (767 LOC), 4-page wizard (Landing → Config → Preview → Result) |
| **Export** | 7 | ExportView (655 LOC), 4-page wizard (ViewSelect → Configure → Preview → Result) |
| **User Hub** | 5 | UserHubView (290 LOC), Dashboard/Inbox/Sessions/Preferences tabs |
| **Event Config** | 3 | EventConfigModal (299 LOC), Overview and DefinitionForm pages |
| **Shared** | 2 | StatCard, reusable components |
| **Core** | 7 | BaseHubView (305 LOC), EventLogView (581 LOC), ComponentShowcaseView, IngestionStatusBar, Modals (7 modal classes) |

**Total UI code: ~19,891 LOC across 90 files**

### 5.5 Level 3 — EventBus Detail

```
┌──────────────────────────────────────────────────────────────┐
│                         EventBus                              │
│                                                              │
│  emit<T>(type, payload)                                      │
│    │                                                         │
│    ├─→ type-specific handlers: Map<EventType, Set<Handler>>  │
│    │     (called sequentially, async-aware)                  │
│    │                                                         │
│    └─→ wildcard handlers: Set<Handler>                       │
│          (called after type-specific; receive all events)    │
│                                                              │
│  on<T>(type, handler) → unsubscribe()                        │
│  once<T>(type, handler)                                      │
│  emitCustom(type, payload?)  → wildcard-only                 │
│  clear()                                                     │
│                                                              │
│  Event shape: { type, payload, timestamp }                   │
│  (xstate v5 compatible)                                      │
└──────────────────────────────────────────────────────────────┘
```

### 5.6 Level 3 — EventBridge Detail

```
┌──────────────────────────────────────────────────────────────┐
│                       EventBridge                             │
│                                                              │
│  File System Handlers (request → operation → response)       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ file.create.request  → vault.create()  → .response     │  │
│  │ file.read.request    → vault.read()    → .response     │  │
│  │ file.update.request  → vault.modify()  → .response     │  │
│  │ file.delete.request  → vault.delete()  → .response     │  │
│  │ file.move.request    → fileManager.renameFile() → .rsp │  │
│  │ file.rename.request  → fileManager.renameFile() → .rsp │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Frontmatter Handlers                                        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ frontmatter.get.request    → metadataCache  → .response│  │
│  │ frontmatter.update.request → processFM()    → .response│  │
│  │ frontmatter.set.request    → processFM()    → .response│  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Vault Listeners (Obsidian → EventBus)                       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ vault.on("create")  → file.created + event.file.triggered│ │
│  │ vault.on("modify")  → file.modified                    │  │
│  │ vault.on("delete")  → file.deleted                     │  │
│  │ vault.on("rename")  → file.renamed                     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Workspace Listeners                                         │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ active-leaf-change → workspace.leaf-changed             │  │
│  │ file-open          → workspace.file-opened              │  │
│  │ layout-change      → workspace.layout-changed           │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  MetadataCache Listeners                                     │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ metadataCache.on("changed")  → metadata.changed         │  │
│  │ metadataCache.on("resolved") → metadata.resolved         │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Runtime View

### 6.1 Plugin Startup Sequence

```
Plugin.onload()
│
├─ Phase 1: Core
│  ├─ loadSettings()  →  Zod-validate persisted settings
│  ├─ createInfrastructure()
│  │  ├─ EventBus
│  │  ├─ LoggerService(eventBus)
│  │  ├─ ErrorService(eventBus, logger)
│  │  ├─ EventBridge(app, eventBus, logger)
│  │  ├─ ServiceContainer(eventBus, logger)
│  │  ├─ CommandRegistry + middleware (logging, errors)
│  │  └─ ViewRegistry
│  └─ setupCrossCuttingListeners()
│
├─ Phase 2: Containers  (created in Phase 1)
│
├─ Phase 3: Registration
│  ├─ registerAllServices()    →  14 services
│  ├─ registerAllCommands()    →  5 commands
│  └─ registerAllViews()       →  3 views
│
├─ Phase 4: Initialization
│  └─ services.initializeAll() →  topological sort + lazy init
│
├─ Phase 5: UI Binding
│  ├─ addSettingTab()
│  ├─ bindViews()              →  registerView() per view
│  ├─ bindCommands()           →  addCommand() per command
│  ├─ UiCommandService         →  handles all ui.* events
│  ├─ addRibbonIcon("list")    →  Event Catalog
│  ├─ addRibbonIcon("↔")      →  Data Exchange Hub
│  ├─ addRibbonIcon("home")   →  User Hub
│  └─ IngestionStatusBar
│
├─ Phase 6: Post-Load  (onLayoutReady)
│  ├─ loadDomainServices()     →  12 services loaded sequentially
│  ├─ wireDataExchange()       →  register views, commands, context menus
│  ├─ setupHubRegistry()       →  3 hub providers + User Hub view
│  ├─ registerSessionFileMenu()→  right-click → "Start Session"
│  ├─ runIngestionCatchUp()    →  scan folders for unprocessed files
│  ├─ eventBridge.registerVaultListeners()
│  └─ emit("plugin.ready")
│
└─ emit("plugin.loaded")
```

### 6.2 Plugin Shutdown Sequence

```
Plugin.onunload()
│
├─ emit("plugin.unloading")
├─ UiCommandService.dispose()
├─ IngestionStatusBar.dispose()
├─ EventBridge.dispose()          →  unregister all Obsidian listeners
├─ ServiceContainer.disposeAll()  →  reverse initialization order
├─ CommandRegistry.clear()
├─ ViewRegistry.clear()
├─ Unsubscribe cross-cutting listeners
├─ emit("plugin.unloaded")
└─ EventBus.clear()
```

### 6.3 Documentation Session Lifecycle

```
User: "New Session"
│
├─ NewSessionModal opens
│  ├─ Select type, duration, focus file
│  └─ Submit → emit("session.create", { title, type, duration, focusFile })
│
├─ SessionService.handleCreate()
│  ├─ createSession()  →  status: "prepared"
│  ├─ save()
│  └─ emit("session.created", { session })
│
├─ User clicks "Start"
│  └─ emit("session.start", { sessionId })
│     ├─ SessionService: status → "active", start timer
│     ├─ timeline.push({ action: "started", timestamp })
│     ├─ emit("session.started", { sessionId })
│     └─ setInterval(1s) → emit("session.timer.tick", { remainingMs })
│
├─ During session: vault file activity
│  ├─ file.created / file.modified events
│  └─ SessionService: track as SessionArtifact
│
├─ Timer expires or user clicks "Complete"
│  ├─ SessionService: status → "completed"
│  ├─ timeline.push({ action: "completed", timestamp })
│  ├─ emit("session.completed", { sessionId })
│  └─ [Planned: generate session document]
│
└─ User can: Archive, Rerun, Save as Template, Spawn new session
```

### 6.4 CSV Import Flow

```
User: Right-click CSV → "Import as Notes"
│
├─ CsvActionView opens with 4-page wizard
│  ├─ Landing: Preview CSV data
│  ├─ Config: Map columns to frontmatter fields, set conflict strategy
│  ├─ Preview: Show generated notes preview
│  └─ Result: Execute import, show success/error counts
│
├─ DataExchangeService.executeImport()
│  ├─ CsvParser.parse()         →  rows[]
│  ├─ ImportService.import()    →  per-row note creation
│  │  ├─ Generate frontmatter from column mapping
│  │  ├─ Resolve conflicts (skip/overwrite/append)
│  │  └─ emit("file.create.request") per note
│  └─ emit("dataExchange.import.completed", { result })
│
└─ InboxService receives event → creates inbox item
```

### 6.5 Event Subscription Match Flow

```
Vault file change
│
├─ Obsidian: vault.on("create") / vault.on("modify")
│
├─ EventBridge: emit("file.created", { path, ... })
│  └─ For type: "Event" frontmatter → emit("event.file.triggered")
│
├─ SubscriptionService (wildcard listener)
│  ├─ matchSubscriptions(event)
│  │  ├─ Filter: event type matches?
│  │  ├─ Filter: pathPattern matches? (glob)
│  │  ├─ Filter: extension matches?
│  │  └─ Filter: namePattern matches?
│  └─ If matched → emit("subscription.matched", { subscription, event })
│
├─ InboxService: mapSubscriptionMatched() → inbox item
│  └─ emit("inbox.itemAdded")
│
└─ EventNotifyService: if notified type → Obsidian Notice popup
```

---

## 7. Deployment View

### 7.1 Build Pipeline

```
npm run build
│
├─ vitest run --coverage          →  tests + v8 coverage → docs/tests/
├─ typedoc                        →  API docs
├─ tsc -noEmit -skipLibCheck      →  type checking
├─ eslint ./src/                  →  linting
└─ esbuild production             →  bundle + minify → main.js
```

### 7.2 Plugin Artifacts

```
<vault>/.obsidian/plugins/flowti-ibde/
├─ main.js          (bundled, minified)
├─ manifest.json    (plugin metadata)
├─ styles.css       (1,838 lines, ft-* prefixed)
├─ data.json        (persisted plugin state — auto-managed)
└─ .hotreload       (dev mode flag)
```

### 7.3 Runtime Environment

```
┌──────────────────────────────────────┐
│           Electron (Desktop)          │
│  ┌────────────────────────────────┐  │
│  │        Obsidian App            │  │
│  │  ┌──────────────────────────┐  │  │
│  │  │   Flowti Plugin          │  │  │
│  │  │   (single main.js)      │  │  │
│  │  └──────────────────────────┘  │  │
│  │                                │  │
│  │  Vault (local file system)     │  │
│  │  ├─ Markdown files (.md)       │  │
│  │  ├─ Structured data (.base)    │  │
│  │  ├─ Import/Export data (.csv)  │  │
│  │  └─ Assets (images, PDFs, etc.)│  │
│  └────────────────────────────────┘  │
│                                      │
│  Node.js fs API (external files)     │
└──────────────────────────────────────┘
```

---

## 8. Crosscutting Concepts

### 8.1 Event-Driven Communication

All inter-domain communication is mediated by the EventBus. No service directly references another service. This is enforced by the architecture: services receive only `IEventBus` and `ILogger` during construction.

**Event categories:** Plugin Lifecycle, Service Lifecycle, Commands, Views, Logging, Errors, File Operations, Frontmatter, Workspace, Metadata, and 14 domain-specific categories.

**Event catalog:** Every event type has a compile-time checked catalog entry with metadata (category, description, direction, domain, services, stability, visibility). The catalog uses `satisfies Record<keyof FlowtiEventMap, EventCatalogMeta>` to guarantee completeness.

### 8.2 Error Handling Strategy

```
                  ┌─────────────────┐
                  │  FlowtiError    │
                  │  (base class)   │
                  └───────┬─────────┘
        ┌─────────────────┼─────────────────┐
        │                 │                 │
  LifecycleError    ServiceError     ValidationError
  CommandError      StorageError
```

- Every error carries: `code`, `category`, `severity`, `context`, `timestamp`
- ErrorService emits `error.occurred` events for observability
- Command middleware wraps all handlers with error capture
- `ErrorService.wrap()` provides try-catch-emit pattern for services

### 8.3 Persistence Model

```
Plugin State (data.json via loadData/saveData)
├─ settings         →  FlowtiSettings (Zod-validated)
├─ user             →  FlowtiUser
├─ sessions         →  Session[] + activeSessionId + templates
├─ inbox            →  InboxItem[]
├─ subscriptions    →  Subscription[]
├─ discovery        →  DiscoveredEvent[]
├─ eventFilter      →  excluded event types
├─ eventNotify      →  notified event types
├─ eventDefinitions →  EventDefinition[]
├─ ingestion        →  idempotency ledger + pending jobs
├─ dataExchange     →  import/export configs + pipelines
└─ installer        →  installation state + completed steps

Vault Files (markdown with frontmatter)
├─ EventDoc, DomainDoc, ServiceDoc, ...
├─ SessionDocument (generated on session completion)
├─ Architecture docs, Blueprint docs
├─ CSV imports → generated notes
└─ Config/Pipeline documentation (auto-generated)
```

Each service uses `TypedStorage<T>` with `PathMutex` serialization to prevent concurrent write corruption.

### 8.4 Backward Compatibility

Services handle schema evolution in their `load()` method. Pattern:

```typescript
async load(): Promise<void> {
  const state = await this.storage.safeLoad();
  // Migrate: add missing fields with defaults
  for (const session of state.sessions) {
    if (!session.timeline) session.timeline = [];
    if (!session.focusFile) session.focusFile = null;
  }
  // ...
}
```

No migration framework — each service owns its own evolution. Fields are added with safe defaults, never removed in-place.

### 8.5 UI Patterns

**Hub Shell Pattern (BaseHubView):**
All hub views extend `BaseHubView<TabType>` which provides: top bar, tab bar, content area, search, split-dock layout, lifecycle management, and event-driven refresh via `scheduleRender()` (debounced 100ms).

**Split-Dock Layout:**
Master list (left, filterable/sortable) + detail panel (right, contextual). Used across Sessions, Inbox, Events, and all entity browsers.

**Modal Pattern:**
All modals extend Obsidian's `Modal` or `FuzzySuggestModal`, use the `Setting` API for form controls, and communicate results via callbacks (not events).

**Component Deps Injection:**
UI components receive a `ComponentDeps` interface with getState/setState/eventBus/scheduleRender plus feature-specific callbacks. This keeps components testable without Obsidian API mocking.

### 8.6 Testing Strategy

| Layer | Approach | Tools |
|-------|----------|-------|
| Domain Services | Unit tests against EventBus; mock storage | Vitest, mock EventBus |
| Pure Helpers | Pure function tests; no mocks needed | Vitest |
| Infrastructure | Unit tests with Obsidian API stubs | Vitest, obsidian-stub |
| UI Components | DOM assertions via happy-dom; mock deps | Vitest, happy-dom |
| User Flows | End-to-end journey tests through full service stack | Vitest, full mocks |

**Test organization:**
- `tests/domain/` — 37 files, service contract tests
- `tests/ui/` — 20 files, component rendering tests
- `tests/infrastructure/` — 16 files, infrastructure contract tests
- `tests/flows/` — 10 files, end-to-end user journey tests
- `tests/utils/` — 6 files, utility function tests
- `tests/mocks/` — 4 files, shared Obsidian API stubs

---

## 9. Architecture Decisions

### ADR-1: Event-Driven Over Direct Service Calls

**Context:** Services need to communicate but must remain independently testable and deployable.

**Decision:** All inter-service communication goes through EventBus. Services never import or reference each other.

**Consequences:** (+) Full testability, no circular deps, easy to add new consumers. (-) Indirect flow can be harder to trace; requires disciplined event catalog maintenance.

### ADR-2: EventBridge as Single Obsidian Adapter

**Context:** Domain logic must be platform-agnostic for testability.

**Decision:** EventBridge is the sole component that touches Obsidian's Vault, FileManager, Workspace, and MetadataCache APIs. It translates between imperative Obsidian events and the plugin's typed event system.

**Consequences:** (+) Domain services can be tested without Obsidian mocks. (-) EventBridge becomes a large file (~613 LOC); must be carefully maintained.

### ADR-3: TypedStorage Per Service

**Context:** Multiple services persist state to the same `data.json` file.

**Decision:** Each service gets a scoped `TypedStorage<T>` instance with PathMutex serialization.

**Consequences:** (+) No cross-contamination of state; concurrent writes serialized. (-) All state in a single file; large vaults may have noticeable save latency.

### ADR-4: Middleware Pipeline for Commands

**Context:** Commands need consistent logging and error handling.

**Decision:** CommandRegistry supports middleware (logging, error handling) applied to all commands.

**Consequences:** (+) Cross-cutting concerns handled once. (-) Middleware adds slight overhead per command execution.

### ADR-5: Pure Helpers for Time Computation

**Context:** Session time calculations (remaining, elapsed, pause segments) need to be testable and reusable.

**Decision:** All time computation lives in `helpers.ts` as pure functions accepting `Session` + optional `now` parameter. SessionService only records timeline events; UI calls helpers directly.

**Consequences:** (+) Trivially testable (no mocks), reusable from any context. (-) Computed data not cached; recalculated on each render (acceptable at < 20 entries).

### ADR-6: Hub Registry Pattern

**Context:** The plugin needs multiple hub views (Event Catalog, Data Exchange, User) with a unified navigation and dashboard model.

**Decision:** HubRegistry with `HubDashboardProvider` interface. Each hub registers a provider that supplies summary stats. `openHub(hubId, tabId?, entityId?)` enables cross-hub deep linking.

**Consequences:** (+) Adding a new hub requires only a provider + view (< 200 LOC). (-) Dashboard aggregation is pull-based (each render queries all providers).

---

## 10. Quality Requirements

### 10.1 Quality Tree

```
Quality
├─ Functional Suitability
│  ├─ Completeness: All documented features implemented and tested
│  └─ Correctness: Zod validation at boundaries; type-safe events
│
├─ Reliability
│  ├─ Fault Tolerance: Ingestion retry logic (3 retries); error events
│  ├─ Recoverability: Crash recovery via persistent job queue
│  └─ Data Integrity: PathMutex prevents concurrent write corruption
│
├─ Maintainability
│  ├─ Modularity: 14 independent bounded contexts
│  ├─ Testability: 82 test files, ~3,200 test cases
│  └─ Analysability: Event catalog with runtime metadata
│
├─ Performance
│  ├─ Timer: 1s setInterval survives window minimize (Date math)
│  ├─ Ingestion: Batch window + concurrency limits
│  └─ UI: Debounced render (100ms); direct timer DOM updates
│
└─ Portability
   └─ Desktop only (Electron); no mobile support
```

### 10.2 Quality Scenarios

| ID | Quality | Scenario | Measure |
|----|---------|----------|---------|
| QS-1 | Testability | A developer adds a new bounded context | Service testable without Obsidian API; only EventBus mock needed |
| QS-2 | Extensibility | A developer adds a new hub | < 200 LOC: HubProvider + HubView + TabDefinitions |
| QS-3 | Reliability | Plugin crashes during active session | On reload, `SessionService.load()` resumes or expires the session; no data loss |
| QS-4 | Reliability | Ingestion job fails | Automatic retry (up to 3 times) with idempotency dedup; no duplicate processing |
| QS-5 | Performance | User has 200 sessions stored | Oldest-first eviction at `MAX_SESSIONS = 200`; O(n) operations bounded |
| QS-6 | Data Integrity | Two services write to storage simultaneously | PathMutex serializes writes per key; no corruption |
| QS-7 | Maintainability | Developer adds new event type | Compile error if event catalog entry missing (`satisfies Record<keyof FlowtiEventMap, ...>`) |

---

## 11. Risks and Technical Debt

### 11.1 Identified Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|------------|------------|
| EventBridge grows too large | Maintainability decreases | Medium | Monitor LOC (currently 613); split by concern if exceeding 800 |
| Single `data.json` bottleneck | Save latency on large state | Low | PathMutex serialization; consider splitting storage if measured |
| UserHubSessions approaching 600 LOC | Component becomes hard to maintain | Medium | Extract Timeline and TimeBreakdown as subcomponents at threshold |
| No mobile support | Limits user reach | Low (design choice) | Desktop-only by design; Electron APIs required |

### 11.2 Technical Debt Register

| Item | Type | Priority | Status |
|------|------|----------|--------|
| `session_focus` layout with 5 regions | Feature | Medium | Blocked on TD-49 (Layout Abstraction Layer) |
| Session artifact persistence as vault files | Feature | Medium | Open — currently in-memory only |
| VaultFilePickerModal promotion to public export | Tech Debt | Low | Watch — currently private, used only by NewSessionModal |
| UserHubSessions extraction at 600 LOC | Tech Debt | Low | Watch — currently at ~504 LOC |
| TD-49: Layout Abstraction Layer | Foundation | High | Open |

---

## 12. Glossary

| Term | Definition |
|------|-----------|
| **IBDE** | Integrated Business Development Environment — a framework for business process documentation in a knowledge base |
| **Bounded Context** | A self-contained domain module with its own service, types, events, and helpers |
| **EventBus** | Central pub-sub hub for all typed inter-domain communication |
| **EventBridge** | The adapter that translates between Obsidian's API and the EventBus |
| **Hub** | A top-level workspace view that aggregates domain-specific content (e.g., Event Catalog, Data Exchange, User Hub) |
| **Session** | A time-boxed Pomodoro work period with timer, focus file, artifacts, and timeline |
| **Focus File** | The vault file that anchors a session — its type determines available tools |
| **Context Files** | Additional files attached to a session as the working set alongside the focus file |
| **Session Document** | A markdown summary generated on session completion, making the session a first-class vault citizen |
| **Artifact** | A file created or modified during an active session, automatically tracked |
| **TypedStorage** | A type-safe, key-scoped storage wrapper with mutex serialization |
| **EventCatalog** | Runtime metadata registry for all event types; compile-time checked for completeness |
| **Ingestion** | The automated pipeline that processes vault file changes through job queue, batching, and retry |
| **Subscription** | A watch rule that matches events by type and glob-pattern filters |
| **DocType** | A frontmatter `type` value identifying the kind of document (EventDoc, ServiceDoc, SessionDocument, etc.) |
| **.base file** | A YAML-structured file used by Flowti as a queryable database-like format |
| **FocusFileProfile** | A detected file type category (markdown, canvas, PDF, image, CSV, unknown) with associated tools |
| **PathMutex** | A per-path lock mechanism preventing concurrent write corruption |
| **Middleware** | A function wrapping command execution (logging, error handling) in the CommandRegistry pipeline |
| **Three Amigos Review** | A structured review session with Product, Engineering, and QA perspectives (simulated) |
| **TASM** | Three Amigos Scoring Model — a 7-dimension scoring framework for increment reviews |
