# Flowti - IBDE

The **Integrated Business Development Environment** - An Obsidian plugin that implements the Flowti IBDE concept: a framework for describing, managing, and visualizing digital twins of business processes inside a knowledge base by providing tools for systemic documenting and executing captured processes.

> If you can think about it, you can build it!

---

## Getting Started

### 1. Clone and Start

```bash
git clone <repo-url>
flowti.cmd
```

The CLI automatically checks prerequisites (Git, Node.js v16+), installs dependencies if needed, and guides you through the setup.

### 2. Build the Plugin

Select **Build** (option 2) from the interactive menu, or run:

```bash
flowti.cmd build
```

After a successful build, the CLI tells you the next steps.

### 3. Activate in Obsidian

Open the repo root as an Obsidian vault, then enable the plugin:
**Settings → Community Plugins → Enable "Flowti - IBDE"**

Complete the Installer wizard that appears on first launch. The CLI returns to the normal main menu.

### 4. Explore the CLI

```bash
flowti.cmd                  # Interactive menu
flowti.cmd help             # Full command reference
flowti.cmd info             # Project stats, git status, config health
flowti.cmd help build       # Section-specific help
```

The CLI lives at `01 - Projects/Flowti CLI/` and follows a kernel-space architecture — see the [CLI README](../../01%20-%20Projects/Flowti%20CLI/README.md) and [Architecture](../../01%20-%20Projects/Flowti%20CLI/docs/Architecture.md) for details.

### For AI Agents

AI coding agents can use the CLI in non-interactive mode as a tool. All commands return deterministic exit codes (0 = success) and produce structured output on stdout:

```bash
flowti.cmd build                    # Build plugin (~2s)
flowti.cmd test                     # Type check + lint + vitest
flowti.cmd info                     # Project metadata
flowti.cmd help                     # Discover all commands
flowti.cmd make:hub --name=X        # Scaffold a new Hub
```

---

## Flowti CLI

The Flowti CLI (`flowti.cmd` / `./flowti.sh`) provides an interactive and non-interactive interface for building, testing, scaffolding, and publishing the plugin. Zero external dependencies — uses only Node.js built-ins. Source: `01 - Projects/Flowti CLI/`.

### Main Menu

```
1) Make        Scaffold new hub or plugin from templates
2) Build       Build the plugin (fast, full, watch, distribute)
3) Review      E2E test sessions, vault management
4) Publish     Gated pipeline: build → test → publish
5) Reports     Generate vault reports (14 generators)
6) Dev Tools   Plugin reload, console, frontmatter, test data
7) Info        Project stats, version, config
?) Help        Contextual man-pages
q) Quit
```

### Non-Interactive Commands

All commands can be run directly without the interactive menu. Use `flowti.cmd <command>` from vault root or `npm run flowti -- <command>` from `Development/flowti/`:

| Command | Description |
|---------|-------------|
| `flowti.cmd build` | Fast build (esbuild only, no reports) |
| `flowti.cmd build:increment` | Full CI: check → build → test → e2e → docs → distribute |
| `flowti.cmd build:watch` | Watch mode (add `--reload` for hot-reload) |
| `flowti.cmd test` | Type check + lint + vitest |
| `flowti.cmd test:e2e` | Build + flow tests + E2E suite |
| `flowti.cmd reports` | Generate all 14 report notes |
| `flowti.cmd report:{id}` | Generate a single report (e.g. `report:test`) |
| `flowti.cmd make:hub --name=X` | Scaffold a new hub |
| `flowti.cmd make:plugin --name=X` | Scaffold a new plugin |
| `flowti.cmd info` | Show project stats, version, config |
| `flowti.cmd help [section]` | Show help (sections: make, build, review, publish, reports, devtools, info) |

### Scaffolding

**New Hub** — generates 9 files following BaseHubView + DDD patterns:

```bash
flowti.cmd make:hub --name=Inventory --icon=package --type=domain --tabs=overview,items
```

Creates: UI view, domain types, domain events, domain service, hub provider, test file, CSS layer, PRD stub, E2E journey stub.

**New Plugin** — generates a standalone Obsidian plugin from Flowti patterns:

```bash
flowti.cmd make:plugin --name="My Plugin" --id=my-plugin --author="Author Name"
```

Creates: manifest.json, package.json, tsconfig.json, esbuild.config.mjs, main.ts, .gitignore — with DDD structure, EventBus, and CSS pipeline.

### Configuration

All CLI settings live in `flowti.config.json`:

```json
{
  "paths":   { "pluginRoot", "pluginOutput", "reports", "e2eVault", "endpointsFile" },
  "build":   { "entry", "minify", "sourcemap" },
  "make":    { "hub": { "ui", "domain", "tests", "css", "docs", "journeys" }, "plugin": { "output" } },
  "reports": { "scripts": [{ "id", "label", "script" }] }
}
```

### Auto-Generated Documentation

The CLI auto-generates its own reference documentation on every increment build:

- **Output**: `docs/reference/Flowti CLI Reference.md` — queryable vault note with YAML frontmatter
- **Content**: 25 CLI commands, 8 help sections, 37 npm scripts, 14 report generators, make config
- **Generate manually**: `flowti.cmd report:cli-ref`

---

## Roadmap

1. ~~Automated Documentation Coverage of all created Domains, Services, Events, Flows~~ Done
2. ~~Test-coverage in every aspect of the Test Pyramid, finalized with an end-to-end test-suite built on top of Obsidian CLI~~ Done (7,697 tests + 8 E2E journeys)
3. Automated Release Pipeline from Plugin View to Git
4. Release v0.0.1
5. ...
6. Release v1.0.0

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

See `docs/Frontend Architecture.md` and `docs/Backend Architecture.md` for detailed architecture documentation.

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
src/
├── main.ts                          # Plugin lifecycle orchestrator
├── infrastructure/
│   ├── events/                      # EventBus, EventBridge, FlowtiEventMap (406+ events)
│   ├── errors/                      # Typed error hierarchy + ErrorService
│   ├── logger/                      # Logging with optional event trace
│   ├── services/                    # DI container with topological init
│   ├── commands/                    # Command registry with middleware
│   ├── views/                       # View registry with factory pattern
│   ├── ui/                          # UiCommandService — view/modal opening
│   └── filesystem/                  # Promise-based file ops via events
├── domain/                          # 21 bounded contexts
│   ├── analytics/                   # AnalyticsService, engine, queries, dashboards, tiles
│   ├── canvas/                      # CanvasService, parser, importer, rebuilder
│   ├── capture/                     # CaptureService — quick capture modal
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
│   ├── onboarding/                  # OnboardingService — first-run guidance, callouts
│   ├── session/                     # SessionService — workspaces, activity, templates
│   ├── settings/                    # Plugin configuration persistence
│   ├── signal/                      # SignalService — Azure DevOps adapter, SecretStore
│   ├── subscription/                # Event watchers with filters
│   ├── train/                       # TrainService — canvas trains, branch merge, sync
│   └── user/                        # User identity
├── ui/                              # Presentation layer
│   ├── analytics/                   # Analytics Hub
│   ├── catalog/                     # Event Catalog
│   ├── hub/                         # Data Exchange Hub
│   ├── testManagement/              # Test Management Hub
│   ├── userHub/                     # User Hub
│   ├── train/                       # Train Hub
│   ├── session/                     # Session Workspace
│   ├── csv/                         # CSV import wizard
│   └── export/                      # Export wizard
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
| **Hub Registry** | Cross-hub summary aggregation with providers for all Hub views |
| **Inbox** | Unified inbox with mappers for subscription, import, and export events; CRUD with 500-item eviction |
| **Ingestion** | File monitoring with job queue, time-windowed batching, retry with exponential backoff, catch-up scans |
| **Installer** | Step-based first-run pipeline (user creation, folder scaffolding, extensible) |
| **Session** | Timed documentation workspaces with 9 types, activity tracking, goals, decisions, templates, daily tracking |
| **Subscription** | Event watchers with path/extension/name filters; wildcard listener matching |

#### Frontend Views

| View | Purpose |
|------|---------|
| **Event Catalog** | 6-tab master-detail view: Domains, Services, Events, Flows, Systems, Actors |
| **Data Exchange Hub** | 7-page master-detail hub: Dashboard, Imports, Exports, Reports, Properties, Pipelines, Types |
| **User Hub** | Personal cockpit: Dashboard, Inbox, Sessions, Commands, Preferences, Health |
| **Analytics Hub** | Dashboard builder with queries, chart tiles, stat cards, and date range filtering |
| **Test Management Hub** | Quality hub: Journeys, Pyramid, Coverage, Compliance, Feature Quality, Features, Processes, Products |
| **Train Hub** | Canvas trains with branches, merge, and sync |
| **Session Workspace** | Focused session view: timer, goals, decisions, activity, context bindings, output artifacts |

### Frontend Architecture

Complex views follow the **Orchestrator + Component** pattern:

- **Orchestrator** — thin Obsidian `ItemView` subclass owning lifecycle, state, scanning, and navigation
- **Components** — plain TypeScript classes receiving dependencies via injection, not inheritance
- **State** — no external libraries; orchestrators declare private state, expose `getState()` / `setState(partial)`, and debounce re-renders via `scheduleRender()` (16ms)
- **File-driven entities** — Domains, services, flows, systems, actors, and products are Markdown files with typed frontmatter, merged with code-registered catalog metadata

Document creation is centralized through the **DocService** via `doc.create` events — UI components never call `fileSystemClient.createFile()` directly for documentation files.

### Documentation

| Directory | Description |
|-----------|-------------|
| `docs/components/` | Per-component documentation with dependencies, state, events, and cross-references |
| `docs/flows/` | End-to-end user journeys crossing multiple views and services |
| `docs/features/` | Feature specifications, PRDs, PBIs, and related documents |
| `docs/decisions/` | Architecture Decision Records (ADR-001 through ADR-031+) |
| `docs/cycles/` | Development cycle planning and retrospectives |
| `docs/debt/` | Technical debt items (132 tracked, 89 resolved, 11 mitigated) |
| `docs/reference/` | Auto-generated references: Command Reference, Event Catalog, Data Dictionary, CLI Reference, Tool Reference |

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
    │   ├── registerAllServices()    # 20 services
    │   ├── registerAllCommands()    # 24 core commands
    │   └── registerAllViews()       # Hub views + Session Workspace
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
        ├── Load all services (settings, user, installer, discovery, ...)
        ├── InstallerWizardModal.showIfNeeded()
        ├── Setup hub registry, session, data exchange wiring
        └── emit("plugin.ready")
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

```
Development/flowti/              # Source code
    │
    │  flowti.cmd build                  (fast esbuild production)
    │  flowti.cmd build:increment        (full CI pipeline)
    │
    ▼
.obsidian/plugins/flowti-ibde/   # Primary output (always)
    ├── main.js              # Bundled plugin
    ├── manifest.json        # Plugin metadata
    ├── styles.css           # UI components
    └── .hotreload           # Dev: triggers Obsidian hot reload

    ▼ (distribution only)
Configured endpoint vaults       # Additional vaults via build-endpoints.json
    ├── main.js
    ├── manifest.json
    ├── styles.css
    └── data.json            # Preserved (never overwritten)
```

### Distribution

The `flowti.cmd build:dist` command distributes build artifacts to additional Obsidian vaults. Endpoints are configured in `build-endpoints.json`:

```json
{
  "endpoints": [
    { "name": "TeamVault", "path": "D:/Vaults/Team/.obsidian/plugins/flowti-ibde", "clean": true },
    { "name": "TestVault", "path": "C:/Vaults/Test/.obsidian/plugins/flowti-ibde", "clean": false }
  ]
}
```

---

## 8. Crosscutting Concepts

### Event System

The EventBus is the backbone of the application. All event types are defined in a single `FlowtiEventMap` interface, organized into categories:

| Category | Events | Direction |
|----------|--------|-----------|
| **Plugin Lifecycle** | `plugin.loading`, `plugin.loaded`, `plugin.ready`, `plugin.unloading`, `plugin.unloaded` | Plugin → Listeners |
| **File Requests** | `file.create.request`, `file.read.request`, `file.update.request`, `file.delete.request` | Service → EventBridge |
| **File Responses** | `file.create.response`, `file.read.response`, etc. | EventBridge → Service |
| **File Notifications** | `file.created`, `file.modified`, `file.deleted`, `file.renamed` | EventBridge → Services |
| **Frontmatter** | `frontmatter.get.*`, `frontmatter.update.*`, `frontmatter.set.*` | Service ↔ EventBridge |
| **Workspace** | `workspace.leaf-changed`, `workspace.file-opened`, `workspace.layout-changed` | EventBridge → Services |
| **User / Settings** | `user.created`, `user.updated`, `settings.changed`, etc. | Service → Listeners |

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
```

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
| **DDD folder structure** | `infrastructure/`, `domain/`, `ui/` - new domains can be added without touching core infrastructure |
| **Per-domain event ownership** | Each domain defines its own event types; the central `FlowtiEventMap` composes them via interface extension |

---

## 10. Risks and Technical Debt

| Risk | Mitigation |
|------|------------|
| Obsidian API changes | EventBridge isolates all platform calls; only one file needs updating |
| Event bus as bottleneck | Wildcard listeners are O(n); event trace is disabled in production |
| No persistence encryption | Plugin data is stored as plain JSON via Obsidian's `saveData` |

132 technical debt items tracked in `docs/debt/` (0 open, 89 resolved, 11 mitigated).

---

## 11. Testing

Every component has a corresponding test suite. Tests run as part of the verification pipeline (`npm test`) and must pass before the plugin is bundled. The test infrastructure uses Vitest with a custom `obsidian-stub.ts` mock.

**Current metrics (Mar 2026):** 7,697 tests across 331 suites. 9 E2E journeys (Prerequisites, Installer, Getting Started, Component Library, Canvas Session, Tool Reference, Journey Builder, Test Management Hub, Developer Onboarding).

```bash
# Unit + Integration
flowti.cmd test               # eslint → tsc → vitest
flowti.cmd test:coverage      # With coverage report

# End-to-End (Obsidian CLI)
flowti.cmd test:e2e           # Full E2E suite (all journeys)
flowti.cmd test:e2e:quick     # Installer + Getting Started only

# Or from Development/flowti/:
npm test                      # eslint → tsc → vitest
npm run test:e2e              # Full E2E suite
```

E2E tests run against a live Obsidian instance via the Obsidian CLI. A dedicated test vault (`flowti-e2e`) is scaffolded automatically. Each journey produces screenshots, event traces, and a JourneyConfig meta file for living documentation.

---

## 12. Installation and Development

### Prerequisites

- [Node.js](https://nodejs.org) (v16+)
- [Git](https://git-scm.com)
- [Obsidian](https://obsidian.md) (v1.12+ for CLI features)

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

The output is automatically placed in `.obsidian/plugins/flowti-ibde/`.

```bash
flowti.cmd build                    # Fast build (~2s, esbuild only)
flowti.cmd build:watch              # Watch mode with hot-reload
flowti.cmd build:increment          # Full CI: check → build → test → e2e → docs → distribute
```

### Verification

```bash
flowti.cmd test                     # eslint → tsc → vitest
flowti.cmd dev:check                # Type-check + lint only (no tests)
flowti.cmd info                     # Project health overview
```

### Pipeline Summary

| Goal | Command | What runs |
|------|---------|-----------|
| Fast build | `flowti.cmd build` | esbuild --production |
| Dev watch | `flowti.cmd build:watch` | esbuild --watch |
| Verify | `flowti.cmd test` | eslint → tsc → vitest |
| Increment | `flowti.cmd build:increment` | check → build → coverage → e2e → docs → reports → distribute |
| Reports | `flowti.cmd reports` | 14 report generators |
| Scaffold hub | `flowti.cmd make:hub --name=X` | 9 boilerplate files |
| Scaffold plugin | `flowti.cmd make:plugin --name=X` | 6 boilerplate files |

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

**Scaffold a new Hub** — the fastest way to add a complete Hub with all wiring:
```bash
flowti.cmd make:hub --name=TaskBoard --icon=kanban --tabs=board,backlog,archive
```

---

## Glossary

| Term | Definition |
|------|-----------|
| **IBDE** | Integrated Business Development Environment |
| **EventBus** | Central publish/subscribe system for decoupled communication (406+ event types) |
| **EventBridge** | Translation layer between Obsidian's API and the internal EventBus |
| **FileSystemClient** | Promise-based API for file/frontmatter operations via events |
| **ServiceContainer** | Dependency injection container with lifecycle management (20 services) |
| **Digital Twin** | A structured representation of a business process or entity in Markdown |
| **BaseHubView** | Abstract base class for all Hub views; internally uses WorkspaceShell for shared chrome |
| **WorkspaceShell** | Shared UI chrome (ribbon, tab bar, content area, status bar) used by all Hubs |
| **Session** | A time-boxed documentation workspace with 6-state lifecycle |
| **Journey** | An E2E test scenario exercising a complete user workflow against a live Obsidian instance |
| **Flowti CLI** | Interactive and non-interactive development tooling (`flowti.cmd` / `./flowti.sh`). Source: `01 - Projects/Flowti CLI/` |
