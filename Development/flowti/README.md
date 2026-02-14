---
title: Flowti - IBDE
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

Read more about: 

- [[Frontend Architecture]]

---

## Product Features

![[Development/flowti/docs/Features.base#Product Features|Features]]


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
├── main.ts                                   # Plugin lifecycle orchestrator
├── infrastructure/
│   ├── events/
│   │   ├── EventBus.ts                       # Pub/Sub with wildcard support
│   │   ├── EventBridge.ts                    # Obsidian API ↔ EventBus translation
│   │   ├── events.ts                         # Composed FlowtiEventMap
│   │   └── types.ts
│   ├── errors/
│   │   ├── ErrorService.ts                   # Centralized error handling
│   │   ├── FlowtiError.ts                    # Typed error hierarchy
│   │   └── types.ts
│   ├── logger/
│   │   ├── LoggerService.ts                  # Logging with event trace (debug mode)
│   │   └── types.ts
│   ├── services/
│   │   ├── ServiceContainer.ts               # DI container with topological init
│   │   ├── registry.ts                       # Service registrations
│   │   └── types.ts
│   ├── commands/
│   │   ├── CommandRegistry.ts                # Command execution with middleware
│   │   ├── registry.ts                       # Command definitions
│   │   └── types.ts
│   ├── views/
│   │   ├── ViewRegistry.ts                   # View registration and binding
│   │   ├── registry.ts                       # View definitions
│   │   └── types.ts
│   └── filesystem/
│       ├── FileSystemClient.ts               # Promise-based file ops via events
│       └── types.ts
├── domain/
│   ├── user/
│   │   ├── UserService.ts                    # User profile management
│   │   ├── UserSetupModal.ts                 # First-run setup modal
│   │   ├── events.ts                         # User domain events
│   │   └── types.ts
│   └── settings/
│       ├── SettingsService.ts                # Settings management
│       ├── FlowtiSettingTab.ts               # Settings UI
│       ├── settings.ts                       # Zod schema, types, defaults
│       ├── events.ts                         # Settings domain events
│       └── types.ts
├── ui/
│   └── ComponentShowcaseView.ts              # CSS component showcase
└── utils/
    ├── helpers.ts                            # UUID generation, utilities
    └── types.ts
```

### Key Components

| Feature | Description | Status |
|---------|-------------|--------|
| **Event System** | Type-safe pub/sub EventBus with wildcard and one-time listeners, xstate v5 compatible event format | Done |
| **EventBridge** | Translates all relevant Obsidian API events (Vault, Workspace, MetadataCache) into internal EventBus events | Done |
| **File Operations** | Full file CRUD (create, read, update, delete, move, rename) via event-based request/response pattern | Done |
| **Frontmatter Operations** | Get, update, and set frontmatter via events, decoupled from Obsidian's metadata API | Done |
| **FileSystemClient** | Promise-based client wrapping event request/response into async methods with timeout handling | Done |
| **Service Container** | Dependency injection with topological initialization order and lifecycle management (init/dispose) | Done |
| **Command System** | Command registry with middleware pipeline (logging, error handling), auto-bound to Obsidian's command palette | Done |
| **View System** | View registry with factory pattern, auto-bound to Obsidian's view system | Done |
| **Error Handling** | Typed error hierarchy (Validation, Storage, Lifecycle, Service, Command) with centralized ErrorService | Done |
| **Logging** | Four-level logger (debug, info, warn, error) with context prefixes and event emission | Done |
| **Event Trace** | Wildcard debug listener that logs all events to the developer console when debug mode is enabled | Done |
| **Settings** | Zod-validated plugin settings with UI tab and reactive event emission on changes | Done |
| **User Management** | User profile service with first-run setup modal, Zod validation, and event-driven persistence | Done |
| **Testing** | Comprehensive unit test suite covering all components, using Vitest with custom Obsidian stubs | Done |
| **Documentation** | TypeDoc-generated API docs, Arc42-structured README | Done |

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
    │   ├── registerAllServices()    # See src/services/registry.ts
    │   ├── registerAllCommands()    # See src/commands/registry.ts
    │   └── registerAllViews()       # See src/views/registry.ts
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
        ├── userService.load()
        ├── UserSetupModal.showIfNeeded()
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

Custom CSS utilities with `ft-` prefix to avoid Obsidian conflicts:

```css
/* Components: */ .ft-btn, .ft-card, .ft-input, .ft-badge, .ft-alert-*
/* Layout:     */ .ft-flex, .ft-flex-col, .ft-gap-*, .ft-items-center
/* Spacing:    */ .ft-p-*, .ft-m-*, .ft-mt-*, .ft-mb-*
/* Typography: */ .ft-heading, .ft-text-muted, .ft-text-sm, .ft-font-bold
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
| Event bus as bottleneck | Wildcard listeners are O(n); event trace is disabled in production |
| No persistence encryption | Plugin data is stored as plain JSON via Obsidian's `saveData` |

---

## 11. Testing

Every component has a corresponding test suite. Tests run as part of the build pipeline (`npm run build`) and must pass before the plugin is bundled. The test infrastructure uses Vitest with a custom `obsidian-stub.ts` mock that provides minimal stubs for Obsidian's API surface.

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
npm run build      # Full pipeline: tests → typedoc → tsc → eslint → esbuild
npm run dev        # Watch mode with hot-reload
```

### Other Commands

```bash
npm run check      # TypeScript + ESLint
npm run docs       # Generate TypeDoc documentation
npm run publish    # Full pipeline + coverage report + preview
```

### Extending the Plugin

**Add a command** in `src/commands/registry.ts`:
```typescript
{
  id: "flowti:my-command",
  name: "My Command",
  icon: "icon-name",
  handler: async (ctx) => { /* ctx.app, ctx.eventBus, ctx.logger */ },
}
```

**Add a service** in `src/services/registry.ts`:
```typescript
{
  id: "myService",
  dependencies: ["userService"],
  factory: (container) => new MyService({ eventBus: container.getEventBus() }),
}
```

**Add an event** in `src/events/events.ts`:
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
