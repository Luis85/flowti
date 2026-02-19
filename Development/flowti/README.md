---
type: PluginReadme
title: Flowti - IBDE
description: The Integrated Business Development Environment
stage: development
platform: Obsidian (Desktop)
license: MIT
author: Luis Mendez
aliases:
  - Flowti IBDE
  - Flowti
  - Flowti Readme
  - Flowti Plugin
---

# Flowti - IBDE

The **Integrated Business Development Environment** - An Obsidian plugin that implements the Flowti IBDE concept: a framework for describing, managing, and visualizing digital twins of business processes inside a knowledge base by providing tools for systemic documenting and executing captured processes.

---

## How to get started

The easiest way is to clone this repo and open it as a Vault in Obsidian.

Then open the Vault folder in a terminal and build the Plugin from source.

1. `npm i`
2. `npm run build`
3. Restart Obsidian then activate the Plugin
4. Finish the Installer

---

## Roadmap

1. Automated Documentation Coverage of all created Domains, Services, Events, Flows
2. Test-coverage in every aspect of the Test Pyramide, finalized with an end-to-end test-suite build on top of Obsidian CLI
3. Automated Release Pipeline from Plugin View to Git
4. Release v0.0.1
5. ...
6. Release v1.0.0

---

## Product Features

![[Development/flowti/docs/02 - Features.base#Product Features|02 - Features]]

---

## 1. Introduction and Goals

Flowti IBDE turns an Obsidian vault into an integrated environment for business development. Instead of scattering documentation, process models, and operational data across disconnected tools, everything lives in one place - as Markdown files, enriched with structured frontmatter and linked through Obsidian's graph.

### Quality Goals

| Priority | Goal | Approach |
|----------|------|----------|
| 1 | **Testability** | Services never touch the Obsidian API directly; all I/O flows through the EventBus |
| 2 | **Extensibility** | Registry pattern for commands, views, and services - add features without modifying core |
| 3 | **Type Safety** | Full TypeScript with Zod validation at system boundaries |
| 4 | **Loose Coupling** | Event-driven architecture; components communicate through events, not direct references |

Read more about: 

- [[Frontend Architecture]]
- [[Backend Architecture]]
- [[Testplan and Teststrategy]]

---

## 2. Constraints

| Constraint | Detail |
|------------|--------|
| **Runtime** | Obsidian Desktop (Electron / Node 16+) |
| **Language** | TypeScript, compiled via esbuild |
| **Data Format** | Markdown with YAML frontmatter (Obsidian vault) |
| **Persistence** | Obsidian's `loadData` / `saveData` API for plugin state; vault files for user data |
| **Build** | Local build via npm; auto-deploys to the Obsidian plugins folder |

---

## 3. Context and Scope

```
┌─────────────────────────────────────────────┐
│                  Obsidian                    │
│                                             │
│  ┌────────────────────────────────────────┐ │
│  │          Flowti IBDE Plugin            │ │
│  │                                        │ │
│  │  ┌──────────┐     ┌────────────────┐   │ │
│  │  │ Services │◄───►│   EventBus     │   │ │
│  │  └──────────┘     └───────┬────────┘   │ │
│  │                           │            │ │
│  │                   ┌───────▼────────┐   │ │
│  │                   │  EventBridge   │   │ │
│  │                   └───────┬────────┘   │ │
│  └───────────────────────────┼────────────┘ │
│                              │              │
│  ┌───────────┐  ┌────────────▼──┐  ┌─────┐ │
│  │ Workspace │  │    Vault      │  │MetaD│ │
│  └───────────┘  └───────────────┘  └─────┘ │
└─────────────────────────────────────────────┘
         ▲                ▲
         │                │
    User interaction   File system
                      (external sync,
                       File Explorer)
```

The plugin sits between the user and Obsidian's core APIs. The **EventBridge** is the single point of contact with the Obsidian platform - services never import from `obsidian` directly.

---

## 4. Solution Strategy

### Event-Driven Architecture

All communication between components flows through a central **EventBus**. Events follow the xstate v5 convention `{ type, payload, timestamp }`, enabling future state machine integration.

### Request / Response Pattern

Services perform file and frontmatter operations by emitting request events (e.g. `file.create.request`). The **EventBridge** handles the Obsidian API call and replies with a response event (`file.create.response`), correlated by a unique `RequestId`. The **FileSystemClient** wraps this into a clean promise-based API.

### Registry Pattern

Commands, views, and services are defined declaratively in registry files and bound to Obsidian during plugin initialization. Adding a new command, view, or service requires only a new entry in the respective registry.


---

## 5. Building Block View

### Module Overview

```
src/                                 # ~42,493 LOC across 216 files
├── main.ts                          # Plugin lifecycle orchestrator (846 LOC)
├── dataExchangeSetup.ts             # Data Exchange UI wiring (368 LOC)
├── infrastructure/
│   ├── events/                      # EventBus, EventBridge, FlowtiEventMap (~190 events)
│   ├── errors/                      # Typed error hierarchy + ErrorService
│   ├── logger/                      # Logging with optional event trace
│   ├── services/                    # DI container with topological init
│   ├── commands/                    # Command registry with middleware
│   ├── views/                       # View registry with factory pattern
│   ├── ui/                          # UiCommandService — view/modal opening
│   └── filesystem/                  # Promise-based file ops via events
├── domain/                          # 15 bounded contexts
│   ├── dataExchange/                # CSV import/export, pipelines, type docs
│   ├── docs/                        # DocService + content generators + path resolvers
│   ├── discovery/                   # Vault scanning for user-defined events
│   ├── eventDefinition/             # Custom event mapping rules
│   ├── eventFilter/                 # Hidden event types
│   ├── eventNotify/                 # Notification preferences
│   ├── hub/                         # HubRegistry, providers, hub lifecycle events
│   ├── inbox/                       # InboxService, mappers, inbox state persistence
│   ├── ingestion/                   # File monitoring, job queue, catch-up
│   ├── installer/                   # First-run wizard steps
│   ├── nudge/                       # NudgeService — time-based session start prompts
│   ├── session/                     # SessionService — workspaces, activity, templates
│   ├── settings/                    # Plugin configuration persistence
│   ├── subscription/                # Event watchers with filters
│   └── user/                        # User identity
├── ui/                              # 106 files
│   ├── catalog/                     # Event Catalog components (15 files)
│   ├── hub/                         # Data Exchange Hub components (21 files)
│   ├── csv/                         # CSV import wizard components (10 files)
│   ├── export/                      # Export wizard components (7 files)
│   ├── session/                     # Session Workspace components (12 files)
│   ├── userHub/                     # User Hub components (8 files)
│   └── *.ts                         # Orchestrator views + modals
└── utils/                           # Shared helpers (glob, persistence, types)
```

### Key Components

#### Infrastructure

| Feature | Description |
|---------|-------------|
| **Event System** | Type-safe pub/sub EventBus with wildcard and one-time listeners, xstate v5 compatible event format |
| **EventBridge** | Translates all relevant Obsidian API events (Vault, Workspace, MetadataCache) into internal EventBus events |
| **FileSystemClient** | Promise-based file/frontmatter operations wrapping event request/response with timeout handling |
| **Service Container** | DI container with topological initialization order and lifecycle management (init/dispose) |
| **Command System** | Command registry with middleware pipeline (logging, error handling), auto-bound to Obsidian's command palette |
| **View System** | View registry with factory pattern, auto-bound to Obsidian's view system |
| **Error Handling** | Typed error hierarchy (Validation, Storage, Lifecycle, Service, Command) with centralized ErrorService |

#### Domain Services

| Service | Purpose |
|---------|---------|
| **Data Exchange** | CSV import/export with column mapping, conflict strategies, formula resolution, multi-source pipelines |
| **Discovery** | Vault scanning for user-defined events via frontmatter |
| **Event Definition** | Custom event mapping rules: source event + file pattern → domain event with payload extraction |
| **Hub Registry** | Cross-hub summary aggregation with providers for Event Catalog, Data Exchange, and User Hub |
| **Inbox** | Unified inbox with mappers for subscription, import, and export events; CRUD with 500-item eviction |
| **Ingestion** | File monitoring with job queue, time-windowed batching, retry with exponential backoff, catch-up scans |
| **Installer** | Step-based first-run pipeline (user creation, folder scaffolding, extensible) |
| **Nudge** | Time-based session start prompts with 60s interval scheduler, midnight rollover, dismissed-today tracking |
| **Session** | Timed documentation workspaces with 9 types, activity tracking, goals, decisions, templates, daily tracking |
| **Subscription** | Event watchers with path/extension/name filters; wildcard listener matching |

#### Frontend Views

| View | Purpose |
|------|---------|
| **Event Catalog** | 8-tab master-detail view: Dashboard, Domains, Services, Events, Flows, Systems, Actors, Products |
| **Data Exchange Hub** | 7-page master-detail hub: Dashboard, Imports, Exports, Reports, Properties, Pipelines, Types |
| **User Hub** | Personal cockpit: Dashboard (session cards, nudges, inbox, hub summaries), Inbox, Sessions, Preferences |
| **Session Workspace** | Focused session view: timer, goals, decisions, activity, context bindings, output artifacts |
| **CSV Action View** | Per-file CSV handler with column preview landing page and inline 4-page import wizard |
| **Export View** | 4-page export wizard with column scanning, preview, and native save dialog |
| **Event Log** | Activity feed with category/type filters and subscribed/all modes |

### Frontend Architecture

Complex views follow the **Orchestrator + Component** pattern:

- **Orchestrator** — thin Obsidian `ItemView` subclass owning lifecycle, state, scanning, and navigation
- **Components** — plain TypeScript classes receiving dependencies via injection, not inheritance
- **State** — no external libraries; orchestrators declare private state, expose `getState()` / `setState(partial)`, and debounce re-renders via `scheduleRender()` (16ms)
- **File-driven entities** — Domains, services, flows, systems, actors, and products are Markdown files with typed frontmatter, merged with code-registered catalog metadata

Both major views share extracted helpers to avoid duplication:

| Helper Module | Key Exports |
|---------------|-------------|
| `catalog/helpers.ts` | `buildSplitLayout()` (shared DOM layout), `openOrCreateEventDoc()`, `renderSubscriptionForm()` / `renderSubscriptionRow()`, frontmatter parsing, cross-reference finders |
| `hub/helpers.ts` | `renderStepBar()` (wizard stepper), `renderConfigDropdown()`, `openEventInCatalog()` |

Document creation is centralized through the **DocService** via `doc.create` events — UI components never call `fileSystemClient.createFile()` directly for documentation files.

See [[Frontend Architecture]] for the full view inventory, component architecture, state management details, and tech debt assessment.

### Documentation

| Directory | Count | Description |
|-----------|-------|-------------|
| `docs/components/` | 62 | Per-component documentation with dependencies, state, events, and cross-references |
| `docs/flows/` | 13 | End-to-end user journeys crossing multiple views and services |
| `docs/sitemap/` | 8 | View-level documentation with descriptions and use case summaries |
| `docs/features/` | 224 | Feature specifications, PRDs, PBIs, and related documents |
| `docs/decisions/` | 30 | Architecture Decision Records (ADR-001 through ADR-024 + related) |
| `docs/cycles/` | 4 | Development cycle planning and retrospectives (Cycles 2-5) |
| `docs/debt/` | 102 | Technical debt items (TD-01 through TD-99+) |

---

## 6. Runtime View

### Plugin Initialization

```
Plugin.onload()
    │
    ├── Phase 1: Core Infrastructure
    │   ├── loadSettings()           # Zod-validated settings from storage
    │   ├── initializeEventBus()     # Central communication backbone
    │   ├── initializeLogger()       # Logging with optional event trace
    │   ├── initializeErrorService() # Centralized error handling
    │   ├── initializeEventBridge()  # Obsidian API ↔ EventBus bridge
    │   └── setupEventListeners()    # Cross-cutting concerns (debug sync)
    │
    ├── Phase 2: Containers
    │   ├── initializeServiceContainer()
    │   ├── initializeCommandRegistry()  # + middleware (logging, errors)
    │   └── initializeViewRegistry()
    │
    ├── Phase 3: Registration
    │   ├── registerAllServices()    # 11 services (src/infrastructure/services/registry.ts)
    │   ├── registerAllCommands()    # 5 core commands (src/infrastructure/commands/registry.ts)
    │   └── registerAllViews()       # 3 core views (src/infrastructure/views/registry.ts)
    │
    ├── Phase 4: Service Initialization
    │   └── services.initializeAll() # Topological dependency resolution
    │
    ├── Phase 5: UI Binding
    │   ├── addSettingTab()
    │   ├── bindViews()              # Register with Obsidian's view system
    │   └── bindCommands()           # Register with command palette
    │
    └── Phase 6: Post-load (on layout ready)
        ├── settingsService.load()
        ├── userService.load()
        ├── installerService.load()
        ├── InstallerWizardModal.showIfNeeded()
        ├── eventFilterService.load()
        ├── eventNotifyService.load()
        ├── discoveryService.load()
        ├── subscriptionService.load()
        ├── ingestionService.load()
        ├── eventDefinitionService.load()
        ├── dataExchangeService.load()
        ├── inboxService.load()
        ├── sessionService.load()
        ├── nudgeService.load() + start()
        ├── DataExchangeSetup (views, commands, file menus, callbacks)
        ├── setupHubRegistry() (User Hub, Session Workspace, 4 session commands)
        ├── registerSessionFileMenu() (right-click add-to-session, create-session)
        ├── ingestionService.runCatchUp() (if watchFolders configured)
        ├── eventBridge.registerVaultListeners()
        └── emit("plugin.ready")
```

### Shutdown (reverse order)

```
Plugin.onunload()
    ├── EventBridge.dispose()    # Unsubscribe EventBus handlers
    ├── services.disposeAll()    # Dispose in reverse init order
    ├── commands.clear()
    ├── views.clear()
    └── eventBus.clear()         # Last, so unloaded listeners still fire
```

### Event Flow: File Operation

```
Service                 EventBus              EventBridge           Obsidian
  │                        │                      │                    │
  │ file.create.request    │                      │                    │
  ├───────────────────────►│                      │                    │
  │                        │ file.create.request  │                    │
  │                        ├─────────────────────►│                    │
  │                        │                      │ vault.create()     │
  │                        │                      ├───────────────────►│
  │                        │                      │                    │
  │                        │ file.create.response  │                   │
  │                        │◄─────────────────────┤                    │
  │ file.create.response   │                      │                    │
  │◄───────────────────────┤                      │                    │
```

---

## 7. Deployment View

The plugin is built locally and deployed directly into the Obsidian vault's plugin directory.

```
Development/flowti/          # Source code
    │
    │  npm run build
    │  (vitest → typedoc → tsc → eslint → esbuild)
    │
    ▼
.obsidian/plugins/flowti-ibde/
    ├── main.js              # Bundled plugin
    ├── manifest.json        # Plugin metadata
    ├── styles.css           # UI components
    └── .hotreload           # Dev: triggers Obsidian hot reload
```

---

## 8. Crosscutting Concepts

### Event System

The EventBus is the backbone of the application. All event types are defined in a single `FlowtiEventMap` interface, organized into categories:

| Category | Events | Direction |
|----------|--------|-----------|
| **Plugin Lifecycle** | `plugin.loading`, `plugin.loaded`, `plugin.ready`, `plugin.unloading`, `plugin.unloaded` | Plugin → Listeners |
| **File Requests** | `file.create.request`, `file.read.request`, `file.update.request`, `file.delete.request`, `file.move.request`, `file.rename.request` | Service → EventBridge |
| **File Responses** | `file.create.response`, `file.read.response`, etc. | EventBridge → Service |
| **File Notifications** | `file.created`, `file.modified`, `file.deleted`, `file.renamed` | EventBridge → Services |
| **Frontmatter** | `frontmatter.get.*`, `frontmatter.update.*`, `frontmatter.set.*` | Service ↔ EventBridge |
| **Workspace** | `workspace.leaf-changed`, `workspace.file-opened`, `workspace.layout-changed` | EventBridge → Services |
| **Metadata Cache** | `metadata.changed`, `metadata.resolved` | EventBridge → Services |
| **User / Settings** | `user.created`, `user.updated`, `settings.changed`, etc. | Service → Listeners |
| **Errors / Logging** | `error.occurred`, `error.handled`, `log.entry`, `log.error` | Service → Listeners |

### Event Trace (Debug Mode)

When `debugMode` is enabled in settings, the LoggerService registers a wildcard `*` listener that logs every event (except `log.*`) to the developer console:

```
[Flowti:EventTrace] file.created { path: "notes/new.md", source: "obsidian" }
[Flowti:EventTrace] metadata.changed { path: "notes/new.md", frontmatter: { ... } }
```

### Error Handling

Typed error hierarchy with categories (`validation`, `storage`, `lifecycle`, `service`, `command`) and severity levels (`low`, `medium`, `high`, `critical`). All errors are routed through the ErrorService and emitted as events for monitoring.

### CSS Component Library

All custom classes use the `ft-` prefix to avoid Obsidian conflicts. Views use Obsidian's CSS variables for theming (dark/light mode).

```css
/* Components:  */ .ft-btn, .ft-card, .ft-input, .ft-badge, .ft-alert-*, .ft-nav-link
/* Layout:      */ .ft-flex, .ft-flex-col, .ft-flex-1, .ft-flex-shrink-0, .ft-gap-*
/* View layout: */ .ft-view-root, .ft-view-dashboard, .ft-view-split
/* Spacing:     */ .ft-p-*, .ft-m-*, .ft-mt-*, .ft-mb-*, .ft-px-*, .ft-py-*
/* Typography:  */ .ft-heading, .ft-text-muted, .ft-text-sm, .ft-font-bold
/* Appearance:  */ .ft-icon-muted, .ft-icon-faint, .ft-icon-subtle, .ft-cursor-pointer
```

Use the Component Showcase view (`Flowti: Open Component Showcase`) to preview all available components.

---

## 9. Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **EventBridge as sole Obsidian contact point** | Services stay decoupled from the platform and are fully unit-testable with a mock EventBus |
| **Request/Response via events** | File operations are async by nature; event correlation with RequestId enables clean timeout and error handling |
| **xstate v5 event format** | `{ type, payload, timestamp }` makes future state machine integration straightforward |
| **Zod for validation** | Runtime schema validation at system boundaries (settings, user data) with TypeScript type inference |
| **Topological service initialization** | ServiceContainer resolves dependency order automatically, preventing manual ordering errors |
| **No barrel exports** | Each module is imported directly to keep dependency graphs explicit and avoid circular imports |
| **DDD folder structure** | `infrastructure/` (generic plumbing), `domain/` (business logic per bounded context), `ui/` (presentation) - new domains can be added without touching core infrastructure |
| **Per-domain event ownership** | Each domain defines its own event types; the central `FlowtiEventMap` composes them via interface extension |

---

## 10. Risks and Technical Debt

| Risk | Mitigation |
|------|------------|
| Obsidian API changes | EventBridge isolates all platform calls; only one file needs updating |
| Event bus as bottleneck | Wildcard listeners are O(n); event trace is disabled in production. 7 wildcard listeners, all properly filtered |
| No persistence encryption | Plugin data is stored as plain JSON via Obsidian's `saveData` |
| EventBridge boundary erosion | ~112 direct Obsidian API calls in UI layer; acceptable for read-only access patterns |

102 technical debt items tracked in `docs/debt/TD-01` through `TD-99` plus 3 additional items. Categories span event/communication, data/storage, testing/quality, architecture/performance, domain logic, file system, and documentation. See `docs/debt/` for individual items.

---

## 11. Testing

Every component has a corresponding test suite. Tests run as part of the build pipeline (`npm run test && npm run build`) and must pass before the plugin is bundled (`npm run publish`). The test infrastructure uses Vitest with a custom `obsidian-stub.ts` mock that provides minimal stubs for Obsidian's API surface.

```bash
npm test             # Run all tests
npm run test:watch   # Watch mode
npm run test:ui      # Vitest UI with browser-based report
npm run test:coverage # Coverage report
```

---

## 12. Installation and Development

### Prerequisites

- [Node.js](https://nodejs.org) (v16+)
- [Git](https://git-scm.com)
- [Obsidian](https://obsidian.md)

### Setup

```bash
# Clone the repository
git clone <repo-url>

# Open the repository root as an Obsidian vault

# Install dependencies
cd Development/flowti
npm install
```

### Build

The build script runs tests, generates docs, type-checks, lints, and bundles the plugin. The output is automatically placed in `.obsidian/plugins/flowti-ibde/`.

```bash
npm run build      # esBuild
npm run dev        # Watch mode with hot-reload
```

### Other Commands

```bash
npm run check      # TypeScript + ESLint
npm run docs       # Generate TypeDoc documentation
npm run publish    # Full pipeline + coverage report + report preview
```

### Extending the Plugin

**Add a command** in `src/infrastructure/commands/registry.ts`:
```typescript
{
  id: "flowti:my-command",
  name: "My Command",
  icon: "icon-name",
  handler: async (ctx) => { /* ctx.app, ctx.eventBus, ctx.logger */ },
}
```

**Add a service** in `src/infrastructure/services/registry.ts`:
```typescript
{
  id: "myService",
  dependencies: ["userService"],
  factory: (container) => new MyService({ eventBus: container.getEventBus() }),
}
```

**Add an event** — create a domain `events.ts` or extend `src/infrastructure/events/events.ts`:
```typescript
"task.created": { task: Task };
"task.completed": { taskId: string };
```

---

## Glossary

| Term | Definition |
|------|-----------|
| **IBDE** | Integrated Business Development Environment |
| **EventBus** | Central publish/subscribe system for decoupled communication |
| **EventBridge** | Translation layer between Obsidian's API and the internal EventBus |
| **FileSystemClient** | Promise-based API for file/frontmatter operations via events |
| **ServiceContainer** | Dependency injection container with lifecycle management |
| **Digital Twin** | A structured representation of a business process or entity in Markdown |
| **Orchestrator** | Thin `ItemView` subclass owning state, lifecycle, and navigation for a complex view |
| **Component** | Plain TypeScript class rendering a tab or panel, receiving dependencies via injection |
| **Event Catalog** | The primary view for browsing events, domains, services, flows, systems, actors, and products |
| **Data Exchange Hub** | The central management view for CSV imports, exports, pipelines, and data documentation |
