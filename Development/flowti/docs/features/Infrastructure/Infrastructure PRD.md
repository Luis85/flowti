---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: done
related_events:
  - plugin.loading
  - plugin.loaded
  - plugin.ready
  - plugin.unloading
  - plugin.unloaded
  - service.registered
  - service.initialized
  - service.disposed
  - service.error
  - log.entry
  - log.error
  - error.occurred
  - command.registered
  - command.executed
  - command.failed
  - file.created
  - file.modified
  - file.deleted
  - file.renamed
maturity: L5
business_value: 5
implementation_cost: 4
maintenance_cost: 2
discovery_cost: 2
design_cost: 3
test_cost: 3
priority: 5
---

# Feature: Infrastructure

> Architecture reference: [[Infrastructure]]

---

## 1. Problem Statement

Users rely on Flowti IBDE to manage complex knowledge vaults with dozens of domains, services, flows, and data exchange pipelines. All of this only works if the plugin is **stable**, **responsive**, and **transparent** when things go wrong. Without a reliable foundation:

- **Who is affected?** Every user — all features (Event Catalog, Data Exchange Hub, Documentation, Health Dashboard) depend on the infrastructure layer.
- **What breaks?** A single unhandled error can crash an entire view, leaving the user staring at a blank panel with no error message. File operations can silently fail or corrupt frontmatter. The plugin can leak memory or leave orphaned listeners after repeated open/close cycles.
- **Why it matters:** Users trust the plugin with their vault — the single source of truth for their domains, services, events, and documentation. Infrastructure is the invisible foundation that makes that trust possible.

---

## 2. Outcome

- **User can** open any Flowti view and trust it will render correctly, recover gracefully from errors, and reflect vault changes in real time.
- **User can** toggle debug mode when troubleshooting and see structured log output that traces what happened, when, and why.
- **User can** execute any plugin command from the command palette or via hotkeys, and receive clear feedback when a command fails.
- **System can** route all inter-feature communication through a typed event bus, bridge vault changes from Obsidian into the plugin's event model, and manage service lifecycles from startup to shutdown.
- **Domain gains** complete decoupling from Obsidian's API surface — every domain service operates through interfaces and events, making the system testable and modular.

Measurable success:
- Zero unhandled exceptions visible to users — all errors produce actionable messages
- Plugin startup completes in < 500ms (service initialization through layout-ready)
- All views update within 1s of a vault file change
- Debug mode produces structured traces for every event flow

---

## 3. Scope

### In Scope

- **Plugin Lifecycle**: orderly startup (loading → loaded → layout-ready → ready) and shutdown (unloading → disposed → unloaded) with service initialization sequencing
- **Reactive Vault Awareness**: automatic detection and propagation of file creates, modifications, deletions, renames, and folder changes through the event bus
- **Reliable File Operations**: promise-based file CRUD (create, read, update, delete, move, rename) plus frontmatter get/update/set — all via event-driven request/response
- **Error Handling & Recovery**: centralized error catching with severity classification, structured error events, and user-visible error toasts via Obsidian's Notice API
- **Structured Logging**: four-level logging (debug, info, warn, error) with context prefixes, event emission, and debug mode toggle
- **Event-Driven Communication**: typed event bus with publish/subscribe, wildcard listeners, and event tracing
- **Command Registration**: plugin commands registered in Obsidian's command palette with optional hotkeys and middleware pipeline
- **View Registration**: custom views registered as Obsidian sidebar leaves
- **Service Container**: dependency injection with lifecycle management for all domain services

### Out of Scope

- UI component rendering (see Event Catalog, Data Exchange Hub, etc.)
- Domain-specific business logic (settings, subscriptions, ingestion, etc.)
- External API integrations
- User-facing settings for infrastructure (debug mode toggle is in Settings)

---

## 4. UX Entry Points

Infrastructure is invisible by design — users experience it through every other feature. Key touchpoints:

| Entry Point | What the User Sees |
|---|---|
| **Plugin startup** | Ribbon icon appears; views become available; vault scan completes |
| **File changes** | Creating, renaming, or deleting a file automatically updates all open Flowti views |
| **Error toast** | When an operation fails, a notification appears with what went wrong |
| **Command palette** | All `flowti:*` commands available with descriptions and optional hotkeys |
| **Debug mode** | Toggling "Debug Mode" in Settings activates console-level event tracing |
| **View sidebar** | Event Catalog and Data Exchange Hub open as registered sidebar leaves |
| **Frontmatter operations** | Creating a doc (domain, flow, system, etc.) produces correct YAML frontmatter automatically |

---

## 5. Functional Requirements

### Plugin Lifecycle

- [x] Plugin emits `plugin.loading` → `plugin.loaded` → `plugin.ready` lifecycle events in sequence
- [x] Services register and initialize via ServiceContainer before `plugin.ready`
- [x] `onLayoutReady()` triggers service `.load()` calls for all state-persisting services
- [x] Plugin shutdown emits `plugin.unloading` → `plugin.unloaded` and disposes all services
- [x] All event listeners and registered callbacks are cleaned up on shutdown — no leaked subscriptions

### Reactive Vault Awareness

- [x] EventBridge translates Obsidian vault events (create, modify, delete, rename) into typed bus events
- [x] File notifications (`file.created`, `file.modified`, `file.deleted`, `file.renamed`) propagate to all subscribed services and views
- [x] Folder notifications (`folder.created`, `folder.deleted`, `folder.renamed`) propagate similarly
- [x] Workspace events (`workspace.leaf-changed`, `workspace.file-opened`, `workspace.layout-changed`) bridge to the event bus
- [x] Event-file detection: files with `type: "Event"` frontmatter trigger `event.file.triggered` on vault actions
- [x] Duplicate create suppression: `pendingCreatedPaths` set prevents double-firing during file creation flows

### Reliable File Operations

- [x] FileSystemClient provides 9 operations: `createFile`, `readFile`, `updateFile`, `deleteFile`, `moveFile`, `renameFile`, `getFrontmatter`, `updateFrontmatter`, `setFrontmatter`
- [x] All operations are promise-based with request/response correlation via branded `RequestId`
- [x] `createFile` supports `createFolders: true` option for nested path creation
- [x] `fileExists` check available for conditional operations
- [x] Frontmatter operations read and write YAML frontmatter without corrupting note content

### Error Handling & Recovery

- [x] ErrorService catches errors, classifies by category (validation, storage, lifecycle, service, command, event) and severity (low, medium, high, critical)
- [x] Errors emit `error.occurred` events with structured `FlowtiErrorInfo` payload
- [x] Error toasts surface to users via Obsidian's Notice API
- [x] `errorService.wrap()` provides operation wrapping with automatic error handling and optional fallback values
- [ ] Error boundaries in view render paths — render failures show error banner with retry button instead of blank view (TD-46)

### Structured Logging

- [x] Four log levels: debug, info, warn, error
- [x] Debug logs only emitted when debug mode is enabled (controlled by settings)
- [x] Logger emits `log.entry` and `log.error` events for downstream consumers
- [x] Context prefixes identify log source (e.g., `[UserService] User created`)
- [x] Event tracing: wildcard listener logs all non-log events to console when debug mode is active
- [x] Event trace skips `log.*` events to prevent infinite recursion

### Event-Driven Communication

- [x] Typed EventBus with `emit()`, `on()`, `off()`, `once()`, and wildcard `*` listener
- [x] `emitCustom()` for dynamic event types (used by Event Definition domain)
- [x] Handler errors are caught and logged — a failing handler never breaks the bus or other handlers
- [x] `clear()` removes all listeners for clean teardown

### Command Registration

- [x] CommandRegistry with `register()`, `registerMany()`, `execute()`, and `getCommands()`
- [x] Middleware pipeline for cross-cutting concerns (logging, error wrapping)
- [x] Commands emit `command.registered`, `command.executing`, `command.executed`, and `command.failed` events
- [ ] No `unregister()` method for dynamic command removal (TD-73)

### View Registration

- [x] ViewRegistry with `register()`, `registerMany()`, and `getViews()`
- [x] Each view definition includes type, display name, icon, and factory function
- [x] Views emit `view.registered` event on registration

---

## 6. Data Model Impact

No persistent entities — infrastructure operates in memory. Key interfaces:

| Interface | Purpose | Key Fields |
|---|---|---|
| `FlowtiEventMap` | Type-safe event map | Composed from all domain EventMap interfaces via `extends` |
| `FlowtiEvent<T>` | Event envelope | `type`, `payload`, `timestamp` |
| `IEventBus` | Pub/sub backbone | `emit()`, `on()`, `off()`, `once()`, `clear()` |
| `IEventBridge` | Obsidian adapter | `register()`, `registerVaultListeners()`, `dispose()` |
| `IFileSystemClient` | File operations | 9 methods (6 file + 3 frontmatter), all async |
| `IErrorService` | Error handling | `handle()`, `create()`, `wrap()` |
| `ILogger` | Structured logging | `debug()`, `info()`, `warn()`, `error()`, `setContext()` |
| `IServiceContainer` | Dependency injection | `register()`, `get()`, `has()`, `initializeAll()`, `disposeAll()` |
| `ICommandRegistry` | Command palette | `register()`, `execute()`, `getCommands()`, `use()` |
| `IViewRegistry` | Sidebar views | `register()`, `getViews()` |
| `CommandDefinition` | Command descriptor | `id`, `name`, `handler`, `hotkeys?`, `icon?` |

---

## 7. Event Impact

### Produced (30 events across 8 categories)

**Plugin Lifecycle** (5): `plugin.loading`, `plugin.loaded`, `plugin.ready`, `plugin.unloading`, `plugin.unloaded`

**Service Lifecycle** (4): `service.registered`, `service.initialized`, `service.disposed`, `service.error`

**Commands** (4): `command.registered`, `command.executing`, `command.executed`, `command.failed`

**Views** (1): `view.registered`

**Logging** (2): `log.entry`, `log.error`

**Errors** (2): `error.occurred`, `error.handled`

**File Operations** (12): `file.create.request/response`, `file.read.request/response`, `file.update.request/response`, `file.delete.request/response`, `file.move.request/response`, `file.rename.request/response`

**Vault Notifications** (8): `file.created`, `file.modified`, `file.deleted`, `file.renamed`, `folder.created`, `folder.deleted`, `folder.renamed`, `event.file.triggered`

All infrastructure events are tagged `["system"]` — hidden from the Event Catalog when "Show System Events" is disabled.

### Consumed

- Obsidian workspace events: `file-open`, `active-leaf-change`, `layout-change`
- Obsidian vault events: `create`, `modify`, `delete`, `rename`
- Obsidian metadata events: `changed` (metadata cache updates)
- `settings.changed` — Logger listens to toggle debug mode
- `frontmatter.update.request` / `frontmatter.get.request` / `frontmatter.set.request` — Frontmatter operations

---

## 8. UI Layout Impact

- No views, tabs, or modals owned by infrastructure
- Error toasts rendered via Obsidian's `Notice` constructor
- Debug mode console output visible in browser DevTools
- All registered views (Event Catalog, Data Exchange Hub) are sidebar leaves managed by ViewRegistry

---

## 9. Adapter Impact

Infrastructure provides the adapters that all other features consume:

```
EventBus<FlowtiEventMap>
├── emit<K>(type: K, payload: FlowtiEventMap[K]): Promise<void>
├── emitCustom(type: string, payload?: unknown): Promise<void>
├── on<K>(type: K, handler): () => void
├── on("*", wildcardHandler): () => void
├── once<K>(type: K, handler): () => void
├── off<K>(type: K, handler): void
└── clear(): void

EventBridge
├── register(): void               (register workspace/metadata listeners)
├── registerVaultListeners(): void  (register vault file/folder listeners)
└── dispose(): void                 (clean up all Obsidian event refs)

FileSystemClient
├── createFile(path, content, options?): Promise<void>
├── readFile(path): Promise<string>
├── updateFile(path, content): Promise<void>
├── deleteFile(path): Promise<void>
├── moveFile(path, newPath): Promise<string>
├── renameFile(path, newName): Promise<string>
├── fileExists(path): Promise<boolean>
├── getFrontmatter(path): Promise<Record<string, unknown>>
├── updateFrontmatter(path, data): Promise<Record<string, unknown>>
└── setFrontmatter(path, data): Promise<void>

ServiceContainer
├── register<T>(registration): void
├── get<T>(id): Promise<T>
├── has(id): boolean
├── getEventBus(): IEventBus
├── getLogger(): ILogger
├── initializeAll(): Promise<void>
└── disposeAll(): Promise<void>

CommandRegistry
├── register(command: CommandDefinition): void
├── registerMany(commands): void
├── use(middleware): void
├── execute(id, ctx): Promise<void>
├── getCommands(): CommandDefinition[]
├── getCommand(id): CommandDefinition | undefined
└── clear(): void

ViewRegistry
├── register(view: ViewDefinition): void
├── registerMany(views): void
├── getViews(): ViewDefinition[]
├── getView(type): ViewDefinition | undefined
└── clear(): void
```

---

## 10. Non-Functional Requirements

- **Reliability**: EventBus must never drop events; a failing handler must not break the bus or other handlers
- **Performance**: Wildcard listener overhead < 1ms per event emission; plugin startup < 500ms to `plugin.ready`
- **Data Safety**: File operations must not corrupt vault content; frontmatter updates must preserve note body
- **Memory**: All listeners cleaned up on `clear()` / `dispose()` — no leaked subscriptions across plugin lifecycle
- **Testability**: All infrastructure classes work without Obsidian runtime (via stubs in `tests/mocks/obsidian-stub.ts`)
- **Observability**: Debug mode provides complete event trace; errors carry category, severity, context, and timestamp
- **Resilience**: Storage fallback to defaults on corruption (TD-56 tracks notification gap); request/response timeout guards prevent dangling promises (TD-07 resolved)

---

## 11. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Infinite recursion from log events triggering log listeners | Low | High | Wildcard listener explicitly skips `log.*` events |
| Shared EventBus leaks between tests | Medium | Medium | Use isolated EventBus instances in test suites |
| EventBridge timing with metadataCache | High | Medium | `setTimeout()` delay for scan-based views after file creation |
| Storage corruption on concurrent writes | Medium | High | PathMutex wraps save operations (TD-33 resolved); read-merge-write race in SettingsService tracked as TD-72 |
| Memory growth from unbounded pendingCreatedPaths | Low | Low | Tracked as TD-65; TTL eviction planned |
| Blank view on render error | Medium | High | Error boundaries planned (TD-46) — currently no try/catch on render paths |
| FileSystemClient churn during bulk operations | Low | Medium | Tracked as TD-66; ResponseRouter pattern planned |

---

## 12. Acceptance Criteria

- [x] Plugin starts up and emits lifecycle events in correct sequence (loading → loaded → ready)
- [x] Plugin shuts down cleanly with all listeners and services disposed
- [x] Vault file changes (create, modify, delete, rename) are reflected in all open Flowti views
- [x] File operations (create, read, update, delete, move, rename) complete reliably with correct frontmatter
- [x] Errors produce user-visible toasts and structured error events
- [x] Debug mode toggle activates event tracing in console
- [x] All `flowti:*` commands are accessible from the command palette
- [x] Handler errors never crash the event bus
- [x] All 1,571+ tests pass with infrastructure in place
- [x] `npm run build` passes all stages (vitest → typedoc → tsc → eslint → esbuild)
- [ ] Render errors in any view produce error banner with retry button (TD-46)
- [ ] Storage corruption notifies users instead of silently falling back (TD-56)

---

## 13. Definition of Done

- [x] EventBus implemented with full typed API including wildcard and `emitCustom()`
- [x] EventBridge wired to Obsidian workspace, vault, and metadataCache events
- [x] FileSystemClient with 9 operations (6 file + 3 frontmatter) via request/response correlation
- [x] ServiceContainer with register, resolve, initialize, and dispose lifecycle
- [x] CommandRegistry with middleware pipeline and lifecycle events
- [x] ViewRegistry with factory-based view registration
- [x] LoggerService with debug mode, context prefixes, and event emission
- [x] ErrorService with severity classification, event emission, and operation wrapping
- [x] Per-domain `events.ts` files composed into `FlowtiEventMap`
- [x] All infrastructure events cataloged with metadata and tagged `["system"]`
- [x] Unit tests cover all infrastructure classes
- [x] `npm run build` passes

---

## Related Tech Debt

| TD | Title | Severity | Status |
|----|-------|----------|--------|
| TD-46 | No error boundaries in view render paths | medium | open |
| TD-56 | Storage corruption silent fallback | medium | open |
| TD-64 | file.renamed payload inconsistency | medium | open |
| TD-65 | pendingCreatedPaths Set has no eviction | low | open |
| TD-66 | FileSystemClient wildcard listener churn | medium | open |
| TD-67 | frontmatter.update.response may return stale data | medium | open |
| TD-73 | CommandRegistry has no unregister method | low | open |
| TD-74 | error.handled event is dead definition | medium | open |
