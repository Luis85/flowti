---
stage: done
domain: Flowti/System
plugin: "[[Development/flowti/README|README]]"
tags:
  - backend
---

# Flowti IBDE - Service Design Blueprint

> Comprehensive reference for every service, event, and lifecycle hook in the plugin.
> For the high-level architecture see the [[Development/flowti/README|README]] (Arc42).

---

## Overview

The Flowti IBDE plugin is built on an **event-driven, dependency-injected** service architecture. Services never call the Obsidian API directly — all platform interaction flows through the **EventBridge**, and all inter-service communication flows through the **EventBus**.

### Layers

| Layer | Purpose | Services |
|-------|---------|----------|
| **Infrastructure** | Generic plumbing, platform abstraction | EventBus, EventBridge, FileSystemClient, LoggerService, ErrorService, ServiceContainer, CommandRegistry, ViewRegistry |
| **Domain** | Business logic, one bounded context per folder | SettingsService, UserService, EventFilterService, EventNotificationService, DocService, DiscoveryService, SubscriptionService, IngestionService, EventDefinitionService, DataExchangeService, InstallerService |

### Communication Rules

1. Services emit events on the EventBus — they never import other services directly
2. The EventBridge is the sole Obsidian API contact point
3. File operations use the request/response pattern (`file.*.request` → `file.*.response`) correlated by `RequestId`
4. Domain services are registered in the ServiceContainer with explicit dependency declarations
5. Documentation file creation is centralized through the DocService via `doc.create` events

---

## Infrastructure Layer

### EventBus

| | |
|---|---|
| **ID** | Direct (not in ServiceContainer) |
| **Source** | `src/infrastructure/events/EventBus.ts` |
| **Interface** | `IEventBus` |
| **Lifecycle** | Phase 1 — created in `initializeEventBus()`, disposed via `clear()` in `onunload()` |
| **Storage** | None |

#### Interface

| Method | Signature | Description |
|--------|-----------|-------------|
| `emit` | `<T>(type: T, payload: EventPayload<T>): Promise<void>` | Emit event to all handlers |
| `on` | `<T>(type: T, handler: EventHandler<T>): () => void` | Subscribe (returns unsubscribe fn) |
| `on` | `(type: "*", handler: WildcardEventHandler): () => void` | Subscribe to all events |
| `once` | `<T>(type: T, handler: EventHandler<T>): () => void` | One-time handler, auto-unsubscribes |
| `off` | `<T>(type: T, handler: EventHandler<T>): void` | Unsubscribe specific handler |
| `clear` | `(): void` | Remove all handlers |

#### Constructor

No options — instantiated directly as `new EventBus()`.

#### Events

The EventBus is the backbone — it does not emit or consume events itself, it routes them.

#### Notes

- Event structure follows xstate v5: `{ type, payload, timestamp }`
- Handlers stored in `Map<EventType | "*", Set<Handler>>`
- Wildcard handlers fire after type-specific handlers

---

### EventBridge

| | |
|---|---|
| **ID** | Direct (not in ServiceContainer) |
| **Source** | `src/infrastructure/events/EventBridge.ts` |
| **Interface** | `IEventBridge` |
| **Lifecycle** | Phase 1 — created in `initializeEventBridge()`, `register()` called immediately, `dispose()` in `onunload()` |
| **Storage** | None |

#### Interface

| Method | Signature | Description |
|--------|-----------|-------------|
| `register` | `(): void` | Register all Obsidian listeners and request handlers |
| `registerVaultListeners` | `(): void` | Register vault/workspace/metadata listeners (deferred to Phase 6) |
| `dispose` | `(): void` | Clean up all EventBus subscriptions |

#### Constructor (`EventBridgeOptions`)

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `app` | `App` | Yes | Obsidian App instance |
| `eventBus` | `IEventBus` | Yes | Core event bus |
| `logger` | `ILogger` | Yes | Debug logging |
| `registerEvent` | `(ref: EventRef) => void` | Yes | Obsidian lifecycle event registration |

#### Events Consumed (request handlers)

| Event | Obsidian API Call |
|-------|-------------------|
| `file.create.request` | `vault.create()` |
| `file.read.request` | `vault.read()` |
| `file.update.request` | `vault.modify()` |
| `file.delete.request` | `vault.delete()` |
| `file.move.request` | `fileManager.renameFile()` |
| `file.rename.request` | `fileManager.renameFile()` |
| `frontmatter.get.request` | `metadataCache.getFileCache()` |
| `frontmatter.update.request` | `fileManager.processFrontMatter()` |
| `frontmatter.set.request` | `fileManager.processFrontMatter()` |

#### Events Emitted

**File operation responses**: `file.create.response`, `file.read.response`, `file.update.response`, `file.delete.response`, `file.move.response`, `file.rename.response`

**Frontmatter responses**: `frontmatter.get.response`, `frontmatter.update.response`, `frontmatter.set.response`

**Vault notifications** (forwarded from Obsidian): `file.created`, `file.modified`, `file.deleted`, `file.renamed`

**Folder notifications** (forwarded from Obsidian): `folder.created`, `folder.deleted`, `folder.renamed`

**Event file notifications**: `event.file.triggered` (fires when a file with `type: "Event"` frontmatter is created/modified/deleted/renamed)

**Workspace notifications**: `workspace.leaf-changed`, `workspace.file-opened`, `workspace.layout-changed`

**Metadata notifications**: `metadata.changed`, `metadata.resolved`

---

### FileSystemClient

| | |
|---|---|
| **ID** | Created ad-hoc in service factories |
| **Source** | `src/infrastructure/filesystem/FileSystemClient.ts` |
| **Interface** | `IFileSystemClient` |
| **Lifecycle** | Created in service registry factory, no lifecycle hooks |
| **Storage** | None |

#### Interface

| Method | Signature |
|--------|-----------|
| `createFile` | `(path: string, content: string, options?: CreateFileOptions): Promise<void>` |
| `readFile` | `(path: string, options?: FileOperationOptions): Promise<string>` |
| `updateFile` | `(path: string, content: string, options?: FileOperationOptions): Promise<void>` |
| `deleteFile` | `(path: string, options?: FileOperationOptions): Promise<void>` |
| `moveFile` | `(path: string, newPath: string, options?: FileOperationOptions): Promise<string>` |
| `renameFile` | `(path: string, newName: string, options?: FileOperationOptions): Promise<string>` |
| `getFrontmatter` | `(path: string, options?: FileOperationOptions): Promise<Record<string, unknown>>` |
| `updateFrontmatter` | `(path: string, data: Record<string, unknown>, options?: FileOperationOptions): Promise<Record<string, unknown>>` |
| `setFrontmatter` | `(path: string, data: Record<string, unknown>, options?: FileOperationOptions): Promise<void>` |

#### Constructor (`FileSystemClientOptions`)

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `eventBus` | `IEventBus` | Yes | For request/response events |
| `timeout` | `number` | No | Default timeout in ms (default: 5000) |

#### Communication Pattern

Each method emits a `*.request` event with a unique `RequestId`, then listens for the matching `*.response` via a wildcard handler. The Promise resolves when the response arrives or rejects on timeout.

---

### LoggerService

| | |
|---|---|
| **ID** | Direct (not in ServiceContainer) |
| **Source** | `src/infrastructure/logger/LoggerService.ts` |
| **Interface** | `ILogger` |
| **Lifecycle** | Phase 1 — created in `initializeLogger()` |
| **Storage** | None |

#### Interface

| Method | Signature | Description |
|--------|-----------|-------------|
| `debug` | `(message: string, data?: unknown): void` | Only shown when debugMode is enabled |
| `info` | `(message: string, data?: unknown): void` | Info-level log |
| `warn` | `(message: string, data?: unknown): void` | Warning-level log |
| `error` | `(message: string, data?: unknown): void` | Error-level log |
| `setContext` | `(context: string): ILogger` | Create a scoped child logger |
| `setDebugMode` | `(enabled: boolean): void` | Toggle debug output |

#### Constructor (`LoggerServiceOptions`)

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `eventBus` | `IEventBus` | No | Emits log events when present |
| `debugMode` | `boolean` | No | Initial debug state (default: `false`) |
| `prefix` | `string` | No | Log message prefix (default: `"Flowti"`) |

#### Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `log.entry` | `LogEntry` | Every log message |
| `log.error` | `LogEntry` | Error-level messages only |

#### Event Trace

When `debugMode` is enabled, the logger registers a wildcard `*` listener that logs every event to the console. Events starting with `log.*` are skipped to prevent infinite recursion.

---

### ErrorService

| | |
|---|---|
| **ID** | Direct (not in ServiceContainer) |
| **Source** | `src/infrastructure/errors/ErrorService.ts` |
| **Interface** | `IErrorService` |
| **Lifecycle** | Phase 1 — created in `initializeErrorService()`, stateless |
| **Storage** | None |

#### Interface

| Method | Signature | Description |
|--------|-----------|-------------|
| `handle` | `(error: FlowtiError \| Error, context?: string): void` | Log + emit error event |
| `create` | `(options: CreateErrorOptions): FlowtiError` | Create structured error |
| `wrap` | `<T>(operation: () => T \| Promise<T>, options: WrapErrorOptions): Promise<T>` | Execute with error handling |

#### Constructor (`ErrorServiceOptions`)

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `eventBus` | `IEventBus` | No | Emits error events |
| `logger` | `ILogger` | No | Severity-based logging |

#### Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `error.occurred` | `FlowtiErrorInfo` | When `handle()` is called |

#### Error Taxonomy

| Category | Severity Levels |
|----------|-----------------|
| `validation` | low, medium |
| `storage` | medium, high |
| `lifecycle` | high, critical |
| `service` | medium, high |
| `command` | medium, high |
| `event` | low, medium |

---

### ServiceContainer

| | |
|---|---|
| **ID** | Direct (stored as `this.services` in main.ts) |
| **Source** | `src/infrastructure/services/ServiceContainer.ts` |
| **Interface** | `IServiceContainer` |
| **Lifecycle** | Phase 2 — created in `initializeServiceContainer()`, `disposeAll()` in `onunload()` |
| **Storage** | None (services handle their own persistence) |

#### Interface

| Method | Signature | Description |
|--------|-----------|-------------|
| `register` | `<T>(registration: ServiceRegistration<T>): void` | Register with factory + dependencies |
| `get` | `<T>(id: string): Promise<T>` | Get or create service instance |
| `has` | `(id: string): boolean` | Check if registered |
| `getEventBus` | `(): IEventBus` | Get event bus (always available) |
| `getLogger` | `(): ILogger` | Get logger (always available) |
| `initializeAll` | `(): Promise<void>` | Initialize all singletons in topological order |
| `disposeAll` | `(): Promise<void>` | Dispose in reverse initialization order |

#### Constructor (`ServiceContainerOptions`)

| Option | Type | Required |
|--------|------|----------|
| `eventBus` | `IEventBus` | Yes |
| `logger` | `ILogger` | Yes |

#### Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `service.registered` | `{ serviceId }` | After `register()` |
| `service.initialized` | `{ serviceId }` | After successful init |
| `service.disposed` | `{ serviceId }` | After disposal |
| `service.error` | `{ serviceId, error: FlowtiErrorInfo }` | On init failure |

#### Key Concepts

- **Lifecycle**: `singleton` (shared instance, default) or `transient` (new per request)
- **Dependency resolution**: topological sort ensures correct initialization order
- **Circular detection**: throws immediately if circular dependency is found
- **IDisposable**: services implementing `dispose()` get cleaned up automatically

---

### CommandRegistry

| | |
|---|---|
| **ID** | Direct (stored as `this.commands` in main.ts) |
| **Source** | `src/infrastructure/commands/CommandRegistry.ts` |
| **Interface** | `ICommandRegistry` |
| **Lifecycle** | Phase 2 — created in `initializeCommandRegistry()`, `clear()` in `onunload()` |
| **Storage** | None |

#### Interface

| Method | Signature | Description |
|--------|-----------|-------------|
| `register` | `(command: CommandDefinition): void` | Register single command |
| `registerMany` | `(commands: CommandDefinition[]): void` | Register multiple |
| `use` | `(middleware: CommandMiddleware): void` | Add middleware to pipeline |
| `getCommands` | `(): CommandDefinition[]` | Get all commands |
| `getCommand` | `(id: string): CommandDefinition \| undefined` | Get by ID |
| `execute` | `(id: string, ctx: CommandContext): Promise<void>` | Execute command |
| `clear` | `(): void` | Remove all commands |

#### Constructor (`CommandRegistryOptions`)

| Option | Type | Required |
|--------|------|----------|
| `logger` | `ILogger` | No |
| `eventBus` | `IEventBus` | No |

#### Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `command.registered` | `{ commandId, commandName }` | After registration |
| `command.executing` | `{ commandId }` | Before handler runs |
| `command.executed` | `{ commandId, durationMs }` | On success |
| `command.failed` | `{ commandId, error: FlowtiErrorInfo }` | On error |

#### Middleware Pipeline

Middlewares execute in LIFO order (last registered runs first):

1. `createLoggingMiddleware()` — logs start/completion/duration
2. `createErrorMiddleware(onError)` — catches exceptions, routes to ErrorService

#### Registered Commands

| ID | Name | Icon | Description |
|----|------|------|-------------|
| `flowti:open-component-showcase` | Open Component Showcase | `palette` | Opens the CSS component preview pane |
| `flowti:open-event-catalog` | Open Event Catalog | `list` | Opens the main event catalog view |
| `flowti:open-event-log` | Open Event Log | `activity` | Opens the real-time event log |
| `flowti:manage-subscriptions` | Manage Watchers | `bell` | Opens the subscription manager modal |
| `flowti:import-csv` | Import CSV as Notes | `file-input` | Opens the CSV import wizard |
| `flowti:export-data` | Export as CSV | `file-output` | Opens the data export wizard |

> Commands 1–4 are registered via `CommandRegistry` in Phase 3. Commands 5–6 are added by `DataExchangeSetup` in Phase 6.

#### Command Context

```typescript
CommandContext {
  app: App;          // Obsidian App instance
  eventBus: IEventBus;
  logger: ILogger;
}
```

---

### ViewRegistry

| | |
|---|---|
| **ID** | Direct (stored as `this.views` in main.ts) |
| **Source** | `src/infrastructure/views/ViewRegistry.ts` |
| **Interface** | `IViewRegistry` |
| **Lifecycle** | Phase 2 — created in `initializeViewRegistry()`, `clear()` in `onunload()` |
| **Storage** | None |

#### Interface

| Method | Signature | Description |
|--------|-----------|-------------|
| `register` | `(view: ViewDefinition): void` | Register single view |
| `registerMany` | `(views: ViewDefinition[]): void` | Register multiple |
| `getViews` | `(): ViewDefinition[]` | Get all views |
| `getView` | `(type: string): ViewDefinition \| undefined` | Get by type |
| `clear` | `(): void` | Remove all views |

#### Constructor (`ViewRegistryOptions`)

| Option | Type | Required |
|--------|------|----------|
| `logger` | `ILogger` | No |
| `eventBus` | `IEventBus` | No |

#### Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `view.registered` | `{ type, displayName }` | After registration |

#### Registered Views

| Type | Display Name | Icon | Source |
|------|-------------|------|--------|
| `flowti-component-showcase` | Flowti Components | `palette` | `ViewRegistry` (Phase 3) |
| `flowti-event-catalog` | Event Catalog | `list` | `ViewRegistry` (Phase 3) |
| `flowti-event-log` | Activity Log | `activity` | `ViewRegistry` (Phase 3) |
| `flowti-data-exchange-hub` | Data Exchange Hub | `database` | `DataExchangeSetup` (Phase 6) |
| `flowti-csv-action` | CSV Action | `file-spreadsheet` | `DataExchangeSetup` (Phase 6) |
| `flowti-export` | Export | `file-output` | `DataExchangeSetup` (Phase 6) |

#### ViewStateProvider

Views opened mid-session receive live state through this interface:

```typescript
ViewStateProvider {
  getSettings: () => FlowtiSettings;
  getExcludedTypes: () => string[];
  getNotifiedTypes: () => string[];
  getDiscoveredEvents: () => DiscoveredEvent[];
  collapsedCategories: Set<string>;  // shared reference, survives view close/reopen
}
```

---

## Domain Layer

### SettingsService

| | |
|---|---|
| **ID** | `"settingsService"` |
| **Source** | `src/domain/settings/SettingsService.ts` |
| **Interface** | `ISettingsService` |
| **Dependencies** | None |
| **Lifecycle** | Phase 4 (initializeAll), `load()` called first in Phase 6 |
| **Storage Key** | Top-level keys (e.g., `debugMode`, `docsRootPath`) |

#### Interface

| Method | Signature | Description |
|--------|-----------|-------------|
| `getSettings` | `(): FlowtiSettings` | Get current settings (copy) |
| `load` | `(): Promise<void>` | Load from storage with Zod validation |
| `updateSettings` | `(updates: Partial<FlowtiSettings>): Promise<void>` | Merge, validate, persist |
| `setDebugMode` | `(enabled: boolean): Promise<void>` | Convenience toggle |

#### Constructor (`SettingsServiceOptions`)

| Option | Type | Required |
|--------|------|----------|
| `storage` | `IStorageProvider` | Yes |
| `eventBus` | `IEventBus` | No |

#### Events Consumed

| Event | Action |
|-------|--------|
| `settings.updateCatalogCategories` | Persists category visibility |
| `settings.updateCollapsedCategories` | Persists collapsed state |
| `settings.updateShowSystemEvents` | Persists system event toggle |
| `settings.updateCatalogDomains` | Persists domain visibility |
| `settings.updateCatalogServices` | Persists service visibility |

#### Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `settings.changed` | `{ settings: FlowtiSettings }` | After `updateSettings()` |
| `settings.loaded` | `{ settings: FlowtiSettings }` | After `load()` |

#### Data Model

```typescript
FlowtiSettings {
  debugMode: boolean;
  docsRootPath: string;
  showSystemEvents: boolean;
  catalogCategories: CatalogCategoryConfig[];
  collapsedCategories: string[];
  catalogDomains: CatalogCategoryConfig[];
  catalogServices: CatalogCategoryConfig[];
  entityPaths: Record<string, string>;
  ingestionConcurrency: number;
  ingestionBatchWindowMs: number;
  ingestionMaxRetries: number;
  ingestionWatchEventTypes: string[];
  watchFolders: string[];
}
```

Validated by Zod schema `FlowtiSettingsSchema`. Invalid data falls back to `DEFAULT_SETTINGS`.

#### Cross-Cutting Listener

`main.ts` listens for `settings.changed` to sync `logger.setDebugMode()`.

---

### UserService

| | |
|---|---|
| **ID** | `"userService"` |
| **Source** | `src/domain/user/UserService.ts` |
| **Interface** | `IUserService` |
| **Dependencies** | None |
| **Lifecycle** | Phase 4 (initializeAll), `load()` called in Phase 6 (onLayoutReady) |
| **Storage Key** | `user` |

#### Interface

| Method | Signature | Description |
|--------|-----------|-------------|
| `load` | `(): Promise<void>` | Load user from storage |
| `hasUser` | `(): boolean` | Check if user exists |
| `getUser` | `(): FlowtiUser \| null` | Get current user |
| `createUser` | `(name: string): Promise<FlowtiUser>` | Create with UUID v4 |
| `updateUserName` | `(name: string): Promise<void>` | Update name, persist |

#### Constructor (`UserServiceOptions`)

| Option | Type | Required |
|--------|------|----------|
| `storage` | `IStorageProvider` | Yes |
| `eventBus` | `IEventBus` | No |

#### Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `user.created` | `{ user: FlowtiUser }` | After `createUser()` |
| `user.updated` | `{ user: FlowtiUser }` | After `updateUserName()` |
| `user.loaded` | `{ user: FlowtiUser }` | After `load()` if user exists |

#### Data Model

```typescript
FlowtiUser {
  id: UUID;          // Branded string (v4 UUID)
  name: string;      // Non-empty (Zod validated)
  createdAt: string;  // ISO 8601 timestamp
}
```

---

### EventFilterService

| | |
|---|---|
| **ID** | `"eventFilterService"` |
| **Source** | `src/domain/eventFilter/EventFilterService.ts` |
| **Dependencies** | None |
| **Lifecycle** | Phase 4 (initializeAll), `load()` called in Phase 6 |
| **Storage Key** | `eventFilter` |

#### Interface

| Method | Signature | Description |
|--------|-----------|-------------|
| `load` | `(): Promise<void>` | Load filter state from storage |
| `isExcluded` | `(eventType: string): boolean` | Check if event type is excluded |
| `getExcludedTypes` | `(): string[]` | Get all excluded event types |
| `dispose` | `(): void` | Unsubscribe event listeners |

#### Constructor (`EventFilterServiceOptions`)

| Option | Type | Required |
|--------|------|----------|
| `storage` | `IStorageProvider` | Yes |
| `eventBus` | `IEventBus` | No |

#### Events Consumed

| Event | Action |
|-------|--------|
| `eventFilter.toggle` | Toggle single event type exclusion |
| `eventFilter.toggleCategory` | Toggle all events in a category |

#### Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `eventFilter.loaded` | `{ excludedTypes: string[] }` | After `load()` |
| `eventFilter.changed` | `{ excludedTypes: string[] }` | When exclusion list changes |

#### Data Model

```typescript
EventFilterState { excludedTypes: string[] }
```

---

### EventNotificationService

| | |
|---|---|
| **ID** | `"eventNotifyService"` |
| **Source** | `src/domain/eventNotify/EventNotificationService.ts` |
| **Dependencies** | None |
| **Lifecycle** | Phase 4 (initializeAll), `load()` called in Phase 6 |
| **Storage Key** | `eventNotify` |

#### Interface

| Method | Signature | Description |
|--------|-----------|-------------|
| `load` | `(): Promise<void>` | Load notification state from storage |
| `isNotified` | `(eventType: string): boolean` | Check if event type has notifications enabled |
| `getNotifiedTypes` | `(): string[]` | Get all notified event types |
| `dispose` | `(): void` | Unsubscribe event listeners |

#### Constructor (`EventNotificationServiceOptions`)

| Option | Type | Required |
|--------|------|----------|
| `storage` | `IStorageProvider` | Yes |
| `eventBus` | `IEventBus` | No |

#### Events Consumed

| Event | Action |
|-------|--------|
| `eventNotify.toggle` | Toggle single event type notification |
| `*` (wildcard) | Monitors all events; fires notification when notified event occurs (skips `log.*`, `eventNotify.*`) |

#### Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `eventNotify.loaded` | `{ notifiedTypes: string[] }` | After `load()` |
| `eventNotify.changed` | `{ notifiedTypes: string[] }` | When notification list changes |
| `eventNotify.fired` | `{ eventType, timestamp }` | When a notified event fires |

#### Data Model

```typescript
EventNotifyState { notifiedTypes: string[] }
```

---

### DocService

| | |
|---|---|
| **ID** | `"docService"` |
| **Source** | `src/domain/docs/DocService.ts` |
| **Dependencies** | None |
| **Lifecycle** | Phase 4 (initializeAll) |
| **Storage Key** | None (reads `docsRootPath` from settings events) |

#### Interface

| Method | Signature | Description |
|--------|-----------|-------------|
| `getDocsRootPath` | `(): string` | Get current docs root path |
| `dispose` | `(): void` | Unsubscribe event listeners |

#### Constructor (`DocServiceOptions`)

| Option | Type | Required |
|--------|------|----------|
| `eventBus` | `IEventBus` | Yes |
| `fileSystem` | `IFileSystemClient` | Yes |

#### Events Consumed

| Event | Action |
|-------|--------|
| `doc.create` | Creates documentation file (path resolution + content generation) |
| `doc.delete` | Deletes documentation file |
| `settings.loaded` | Syncs `docsRootPath` and `entityPaths` |
| `settings.changed` | Syncs `docsRootPath` and `entityPaths` |

#### Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `doc.created` | `{ path, created, updated?, docType, name, source? }` | After file creation/update |
| `doc.exists` | `{ path, docType, name, source? }` | File already exists (non-upsert) |
| `doc.failed` | `{ docType, name, error, source? }` | On error |
| `doc.deleted` | `{ path, source? }` | After file deletion |

#### Data Model

```typescript
DocType =
  | "EventDoc" | "DomainDoc" | "ArchitectureDoc" | "ServiceDoc"
  | "ServiceBlueprintDoc" | "CategoryDoc" | "FlowDoc" | "SystemDoc"
  | "ActorDoc" | "ProductDoc" | "AreaDoc"
  | "CsvDoc" | "PropertyDoc" | "ImportConfigDoc" | "ExportConfigDoc"
  | "PipelineConfigDoc" | "TypeDoc";

DocCreateRequest {
  docType: DocType;
  name: string;
  content?: string;       // bypasses content generator
  path?: string;          // bypasses path resolver
  entityType?: string;    // for path resolution
  upsert?: boolean;       // update if exists (default: false)
  source?: string;        // tracing label
}
```

#### Architecture Rule

All documentation file creation MUST go through `doc.create` events. Services and UI components must NOT call `fileSystemClient.createFile()` directly for documentation files. This centralizes path resolution, content generation, and existence checking.

---

### DiscoveryService

| | |
|---|---|
| **ID** | `"discoveryService"` |
| **Source** | `src/domain/discovery/DiscoveryService.ts` |
| **Dependencies** | None |
| **Lifecycle** | Phase 4 (initializeAll), `load()` called in Phase 6 |
| **Storage Key** | `discovery` |

#### Interface

| Method | Signature | Description |
|--------|-----------|-------------|
| `load` | `(): Promise<void>` | Load discovered events from storage |
| `getDiscoveredEvents` | `(): DiscoveredEvent[]` | Get all discovered events |
| `dispose` | `(): void` | Unsubscribe event listeners |

#### Constructor (`DiscoveryServiceOptions`)

| Option | Type | Required |
|--------|------|----------|
| `storage` | `IStorageProvider` | Yes |
| `eventBus` | `IEventBus` | No |

#### Events Consumed

| Event | Action |
|-------|--------|
| `event.file.triggered` | Discovers/updates event from vault file with `type: "Event"` frontmatter |
| `discovery.create` | Manually creates a custom event; optionally emits `doc.create` for EventDoc |
| `discovery.remove` | Removes a discovered event by name |

#### Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `discovery.loaded` | `{ discoveredEvents: DiscoveredEvent[] }` | After `load()` |
| `discovery.updated` | `{ event: DiscoveredEvent, isNew }` | When event is discovered or updated |
| `discovery.removed` | `{ eventName }` | After event removal |
| `doc.create` | `DocCreateRequest` | When `discovery.create` includes `docMeta` |

#### Data Model

```typescript
DiscoveredEvent {
  eventName: string;
  sourcePath: string;
  firstSeenAt: string;    // ISO 8601
  lastSeenAt: string;     // ISO 8601
  triggerCount: number;
  category?: string;
}

DiscoveryState { events: Record<string, DiscoveredEvent> }
```

---

### SubscriptionService

| | |
|---|---|
| **ID** | `"subscriptionService"` |
| **Source** | `src/domain/subscription/SubscriptionService.ts` |
| **Dependencies** | None |
| **Lifecycle** | Phase 4 (initializeAll), `load()` called in Phase 6 |
| **Storage Key** | `subscription` |

#### Interface

| Method | Signature | Description |
|--------|-----------|-------------|
| `load` | `(): Promise<void>` | Load subscriptions from storage |
| `getSubscriptions` | `(): Subscription[]` | Get all subscriptions |
| `getSubscription` | `(id: string): Subscription \| undefined` | Get by ID |
| `dispose` | `(): void` | Unsubscribe event listeners |

#### Constructor (`SubscriptionServiceOptions`)

| Option | Type | Required |
|--------|------|----------|
| `storage` | `IStorageProvider` | Yes |
| `eventBus` | `IEventBus` | No |

#### Events Consumed

| Event | Action |
|-------|--------|
| `settings.changed` / `settings.loaded` | Updates internal `enabled` flag |
| `subscription.create` | Creates a new subscription |
| `subscription.update` | Updates an existing subscription |
| `subscription.remove` | Deletes a subscription |
| `subscription.refresh` | Re-emits current state as `subscription.loaded` |
| `*` (wildcard) | Matches events against enabled subscriptions (skips `log.*`, `subscription.*`, `settings.*`) |

#### Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `subscription.loaded` | `{ subscriptions: Subscription[] }` | After `load()` or `refresh` |
| `subscription.created` | `{ subscription: Subscription }` | After creation |
| `subscription.updated` | `{ subscription: Subscription }` | After update |
| `subscription.deleted` | `{ subscriptionId }` | After deletion |
| `subscription.matched` | `{ eventType, subscriptionId, subscriptionLabel?, timestamp }` | When event matches a subscription |

#### Data Model

```typescript
Subscription {
  id: string;
  eventType: string;
  label?: string;
  filters: SubscriptionFilter;
  enabled: boolean;
  createdAt: string;      // ISO 8601
}

SubscriptionFilter {
  pathPattern?: string;   // glob pattern
  extension?: string;     // file extension filter
  namePattern?: string;   // name glob filter
}
// All filter fields use AND logic
```

---

### IngestionService

| | |
|---|---|
| **ID** | `"ingestionService"` |
| **Source** | `src/domain/ingestion/IngestionService.ts` |
| **Dependencies** | None |
| **Lifecycle** | Phase 4 (initializeAll), `load()` called in Phase 6 |
| **Storage Key** | `ingestion` |

#### Interface

| Method | Signature | Description |
|--------|-----------|-------------|
| `load` | `(): Promise<void>` | Load idempotency ledger; recover pending jobs |
| `getStats` | `(): IngestionStats` | Current queue statistics |
| `generateEventKey` | `(eventType: string, path?: string): string` | Deterministic dedup key |
| `isProcessed` | `(key: string): boolean` | Check if key is in ledger |
| `runCatchUp` | `(folders: string[], listFiles: Callback): Promise<void>` | Scan folders, enqueue new files |
| `dispose` | `(): void` | Clear timers and unsubscribe |

#### Constructor (`IngestionServiceOptions`)

| Option | Type | Required |
|--------|------|----------|
| `storage` | `IStorageProvider` | Yes |
| `eventBus` | `IEventBus` | No |
| `config` | `Partial<IngestionConfig>` | No |

#### Events Consumed

| Event | Action |
|-------|--------|
| `settings.changed` / `settings.loaded` | Updates internal `enabled` flag |
| `*` (wildcard) | Monitors watched event types; enqueues matching events into time-windowed batch (skips `log.*`, `ingestion.*`, `settings.*`) |

#### Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `ingestion.job.queued` | `{ jobId, eventType }` | Job added to queue |
| `ingestion.job.started` | `{ jobId, eventType }` | Job processing starts |
| `ingestion.job.completed` | `{ jobId, eventType, payload? }` | Job succeeded |
| `ingestion.job.failed` | `{ jobId, eventType, error, retryCount, willRetry }` | Job failed |
| `ingestion.batch.started` | `{ jobCount }` | Batch begins |
| `ingestion.batch.completed` | `{ processedCount, failedCount }` | Batch finishes |
| `ingestion.stats` | `{ stats: IngestionStats }` | Stats update |
| `ingestion.recovery.completed` | `{ recoveredCount }` | After crash recovery |
| `catchup.started` | `{ folderCount }` | Catch-up scan starts |
| `catchup.file.found` | `{ path }` | File found during catch-up |
| `catchup.completed` | `{ scannedCount, newCount }` | Catch-up finishes |

#### Data Model

```typescript
IngestionConfig {
  concurrency: number;        // default: 3
  batchWindowMs: number;      // default: 500
  maxRetries: number;         // default: 3
  baseRetryDelayMs: number;   // default: 1000
  watchEventTypes: string[];
}

IngestionStats { processedCount, failedCount, queuedCount, activeCount }

IngestionPersistentState {
  processedKeys: string[];    // idempotency ledger
  pendingJobs?: IngestionJob[];
}
```

- **Idempotency**: deterministic keys via `"eventType::path"`, stored in `processedKeys: Set<string>`
- **Ledger eviction**: MAX_LEDGER_SIZE = 10,000; oldest-first eviction when exceeded
- **Retry**: exponential backoff with `baseRetryDelayMs * 2^retryCount`
- **JobQueue**: generic concurrent queue with configurable concurrency, error swallowing

---

### EventDefinitionService

| | |
|---|---|
| **ID** | `"eventDefinitionService"` |
| **Source** | `src/domain/eventDefinition/EventDefinitionService.ts` |
| **Dependencies** | None |
| **Lifecycle** | Phase 4 (initializeAll), `load()` called in Phase 6 |
| **Storage Key** | `eventDefinition` |

#### Interface

| Method | Signature | Description |
|--------|-----------|-------------|
| `load` | `(): Promise<void>` | Load definitions from storage |
| `getDefinitions` | `(): EventDefinition[]` | Get all definitions |
| `getDefinition` | `(id: string): EventDefinition \| undefined` | Get by ID |
| `dispose` | `(): void` | Unsubscribe event listeners |

#### Constructor (`EventDefinitionServiceOptions`)

| Option | Type | Required |
|--------|------|----------|
| `storage` | `IStorageProvider` | Yes |
| `eventBus` | `IEventBus` | No |

#### Events Consumed

| Event | Action |
|-------|--------|
| `settings.changed` / `settings.loaded` | Updates internal `enabled` flag |
| `eventDefinition.create` | Creates a new definition |
| `eventDefinition.update` | Updates an existing definition |
| `eventDefinition.remove` | Deletes a definition |
| `eventDefinition.refresh` | Re-emits current state as `eventDefinition.loaded` |
| `ingestion.job.completed` | Matches against definitions; emits domain events via `emitCustom()` |

#### Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `eventDefinition.loaded` | `{ definitions: EventDefinition[] }` | After `load()` or `refresh` |
| `eventDefinition.created` | `{ definition: EventDefinition }` | After creation |
| `eventDefinition.updated` | `{ definition: EventDefinition }` | After update |
| `eventDefinition.deleted` | `{ definitionId }` | After deletion |
| `eventDefinition.matched` | `{ definitionId, domainEventName, sourcePath }` | When definition matches |
| *(custom)* | Extracted payload | Domain event emitted via `emitCustom()` |

#### Data Model

```typescript
EventDefinition {
  id: string;
  sourceEventType: string;
  filePattern?: string;
  domainEventName: string;
  payloadMappings: PayloadMapping[];
  emissionPolicy: EmissionPolicy;
  enabled: boolean;
  createdAt: string;
}

PayloadMapping {
  field: string;
  source: "path" | "metadata" | "derived";
  expression: string;
}

EmissionPolicy = "once" | "always";
// "once" deduplicates via emittedKeys (MAX_EMITTED_KEYS = 10,000)
```

---

### DataExchangeService

| | |
|---|---|
| **ID** | `"dataExchangeService"` |
| **Source** | `src/domain/dataExchange/DataExchangeService.ts` |
| **Dependencies** | None |
| **Lifecycle** | Phase 4 (initializeAll), `load()` called in Phase 6 |
| **Storage Key** | `dataExchange` |

#### Interface (key methods)

**State Management:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `load` | `(): Promise<void>` | Load persisted configs |
| `setListFiles` | `(callback): void` | Inject vault file listing callback |
| `setWriteExternalFile` | `(callback): void` | Inject external file writer |
| `setReadExternalFile` | `(callback): void` | Inject external file reader |
| `setDocsRootPath` | `(path: string): void` | Set docs root for config docs |
| `getImportService` | `(): ImportService` | Access import sub-service |
| `getExportService` | `(): ExportService` | Access export sub-service |
| `dispose` | `(): void` | Unsubscribe + dispose sub-services |

**Import Config CRUD:**

| Method | Signature |
|--------|-----------|
| `getSavedImportConfigs` | `(): SavedImportConfig[]` |
| `getImportConfig` | `(id: string): SavedImportConfig \| undefined` |
| `saveImportConfig` | `(config): Promise<SavedImportConfig>` |
| `deleteImportConfig` | `(id: string): Promise<void>` |
| `updateImportConfig` | `(id, updates): Promise<SavedImportConfig \| undefined>` |
| `toggleImportFavourite` | `(id: string): Promise<void>` |
| `getImportConfigsForFile` | `(csvPath: string): SavedImportConfig[]` |

**Export Config CRUD:**

| Method | Signature |
|--------|-----------|
| `getSavedExportConfigs` | `(): SavedExportConfig[]` |
| `getExportConfig` | `(id: string): SavedExportConfig \| undefined` |
| `saveExportConfig` | `(config): Promise<SavedExportConfig>` |
| `deleteExportConfig` | `(id: string): Promise<void>` |
| `updateExportConfig` | `(id, updates): Promise<SavedExportConfig \| undefined>` |
| `toggleExportFavourite` | `(id: string): Promise<void>` |

**Pipeline CRUD:**

| Method | Signature |
|--------|-----------|
| `getSavedPipelines` | `(): SavedMultiImportPipeline[]` |
| `getPipeline` | `(id: string): SavedMultiImportPipeline \| undefined` |
| `savePipeline` | `(config): Promise<SavedMultiImportPipeline>` |
| `deletePipeline` | `(id: string): Promise<void>` |
| `updatePipeline` | `(id, updates): Promise<SavedMultiImportPipeline \| undefined>` |
| `togglePipelineFavourite` | `(id: string): Promise<void>` |

**Documentation & Data Dictionary:**

| Method | Signature |
|--------|-----------|
| `buildDataDictionary` | `(): DataDictionaryEntry[]` |
| `createCsvDoc` | `(csvPath, headers, rowCount, delimiter?): Promise<string>` |
| `ensureConfigDoc` | `(configName, configType): Promise<string>` |
| `ensurePipelineDoc` | `(pipelineId): Promise<string>` |
| `createPropertyDoc` | `(propertyName): Promise<string>` |
| `createOrUpdateTypeDoc` | `(typeName): Promise<void>` |

#### Constructor (`DataExchangeServiceOptions`)

| Option | Type | Required |
|--------|------|----------|
| `eventBus` | `IEventBus` | Yes |
| `fileSystem` | `IFileSystemClient` | Yes |
| `storage` | `IStorageProvider` | No |
| `listFiles` | `ListFilesCallback` | No |

#### Sub-Modules

| Module | Source | Responsibility |
|--------|--------|----------------|
| `ConfigDocService` | `src/domain/dataExchange/ConfigDocService.ts` + `configDocContent.ts` | Path resolution + doc CRUD (435 LOC) + content builders (579 LOC) |
| `PipelineExecutor` | `src/domain/dataExchange/PipelineExecutor.ts` | Multi-source import pipeline execution |
| `ConfigPathTracker` | `src/domain/dataExchange/ConfigPathTracker.ts` | Tracks file/folder renames to update config paths |
| `DataDictionaryBuilder` | `src/domain/dataExchange/DataDictionaryBuilder.ts` | Builds data dictionary from configs |

#### Events Consumed

| Event | Action |
|-------|--------|
| `dataExchange.import.execute` | Executes CSV import pipeline |
| `dataExchange.export.execute` | Executes export pipeline |
| `dataExchange.pipeline.execute` | Executes multi-import pipeline |
| `file.renamed` | Updates config paths for renamed files |
| `folder.renamed` | Updates config paths for renamed folders |

#### Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `dataExchange.import.started` | `{ config, totalRows }` | Import begins |
| `dataExchange.import.progress` | `{ current, total, lastFilename }` | Each row processed |
| `dataExchange.import.completed` | `{ result: ImportResult }` | Import succeeds |
| `dataExchange.import.failed` | `{ error, config }` | Import fails |
| `dataExchange.export.started` | `{ config }` | Export begins |
| `dataExchange.export.completed` | `{ result: ExportResult }` | Export succeeds |
| `dataExchange.export.failed` | `{ error, config }` | Export fails |
| `dataExchange.pipeline.started` | `{ pipeline, totalSources }` | Pipeline begins |
| `dataExchange.pipeline.sourceCompleted` | `{ pipelineId, sourceIndex, totalSources, sourceResult }` | Each source done |
| `dataExchange.pipeline.completed` | `{ result: MultiImportResult }` | Pipeline succeeds |
| `dataExchange.pipeline.failed` | `{ error, pipelineId }` | Pipeline fails |
| `dataExchange.config.changed` | `{ importCount, exportCount }` | Config CRUD |

#### Data Model

```typescript
DataExchangeState {
  savedImportConfigs: SavedImportConfig[];
  savedExportConfigs: SavedExportConfig[];
  savedPipelines?: SavedMultiImportPipeline[];
  csvDisplaySettings?: Record<string, CsvDisplaySettings>;
  hiddenCsvPaths?: string[];
}
```

See `src/domain/dataExchange/types.ts` for full type definitions of `ImportConfig`, `ExportConfig`, `ImportResult`, `ExportResult`, `MultiImportResult`, etc.

---

### InstallerService

| | |
|---|---|
| **ID** | `"installerService"` |
| **Source** | `src/domain/installer/InstallerService.ts` |
| **Interface** | `IInstallerService` |
| **Dependencies** | `["userService"]` |
| **Lifecycle** | Phase 4 (initializeAll, after UserService), `load()` in Phase 6 |
| **Storage Key** | `installer` |

#### Interface

| Method | Signature | Description |
|--------|-----------|-------------|
| `load` | `(): Promise<void>` | Load persisted state |
| `isInstalled` | `(): boolean` | Check if installation complete |
| `getSteps` | `(): IInstallerStep[]` | All steps sorted by order |
| `registerStep` | `(step: IInstallerStep): void` | Register pluggable step |
| `runAll` | `(context: InstallerContext): Promise<boolean>` | Execute pipeline |
| `reset` | `(): Promise<void>` | Reset to pending state |
| `getState` | `(): InstallerState` | Get current state |

#### Constructor (`InstallerServiceOptions`)

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `storage` | `IStorageProvider` | Yes | Persist installer state |
| `eventBus` | `IEventBus` | No | Event emission |
| `fileSystem` | `IFileSystemClient` | No | File operations (created in factory) |
| `userService` | `IUserService` | No | User operations (injected in factory) |

#### Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `installer.loaded` | `{ state: InstallerState }` | After `load()` |
| `installer.started` | `{ stepCount }` | When `runAll()` begins |
| `installer.step.started` | `{ stepId, stepName }` | Before each step |
| `installer.step.completed` | `InstallerStepStatusEntry` | After each step |
| `installer.completed` | `{ state: InstallerState }` | All steps succeeded |
| `installer.failed` | `{ failedStepId, error }` | On first failure |

#### Registered Steps

| Step | ID | Order | Behavior |
|------|----|-------|----------|
| UserCreationStep | `user-creation` | 10 | Creates user profile, skips if user exists |
| FolderScaffoldStep | `folder-scaffold` | 20 | Scaffolds PARA folder structure (23 folders), skips existing |

#### Step Interface (`IInstallerStep`)

```typescript
IInstallerStep {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly intro: string;
  readonly order: number;
  execute(context: InstallerContext, deps: InstallerStepDeps): Promise<InstallerStepResult>;
}
```

#### Data Model

```typescript
InstallerState {
  installed: boolean;
  installedAt?: string;                               // ISO timestamp
  completedSteps: Record<string, { completedAt: string }>;
}

InstallerContext {
  userName?: string;         // Input
  user?: FlowtiUser;        // Output from UserCreationStep
  createdFolders?: string[]; // Output from FolderScaffoldStep
  [key: string]: unknown;   // Extensible
}
```

---

## Event Catalog

128 events organized by source. Domain events: 79. Infrastructure events: 49.

### Plugin Lifecycle (5)

| Event | Payload | Source |
|-------|---------|--------|
| `plugin.loading` | `{ timestamp }` | main.ts |
| `plugin.loaded` | `{ timestamp }` | main.ts |
| `plugin.ready` | `{ timestamp }` | main.ts |
| `plugin.unloading` | `{ timestamp }` | main.ts |
| `plugin.unloaded` | `{ timestamp }` | main.ts |

### Service Lifecycle (4)

| Event | Payload | Source |
|-------|---------|--------|
| `service.registered` | `{ serviceId }` | ServiceContainer |
| `service.initialized` | `{ serviceId }` | ServiceContainer |
| `service.disposed` | `{ serviceId }` | ServiceContainer |
| `service.error` | `{ serviceId, error: FlowtiErrorInfo }` | ServiceContainer |

### Commands (4)

| Event | Payload | Source |
|-------|---------|--------|
| `command.registered` | `{ commandId, commandName }` | CommandRegistry |
| `command.executing` | `{ commandId }` | CommandRegistry |
| `command.executed` | `{ commandId, durationMs }` | CommandRegistry |
| `command.failed` | `{ commandId, error: FlowtiErrorInfo }` | CommandRegistry |

### Views (1)

| Event | Payload | Source |
|-------|---------|--------|
| `view.registered` | `{ type, displayName }` | ViewRegistry |

### Logging (2)

| Event | Payload | Source |
|-------|---------|--------|
| `log.entry` | `LogEntry` | LoggerService |
| `log.error` | `LogEntry` | LoggerService |

### Errors (2)

| Event | Payload | Source |
|-------|---------|--------|
| `error.occurred` | `FlowtiErrorInfo` | ErrorService |
| `error.handled` | `{ error: FlowtiErrorInfo, recovered }` | ErrorService |

### File Operations — Request (6)

| Event | Payload | Direction |
|-------|---------|-----------|
| `file.create.request` | `{ requestId, path, content, createFolders? }` | Service → EventBridge |
| `file.read.request` | `{ requestId, path }` | Service → EventBridge |
| `file.update.request` | `{ requestId, path, content }` | Service → EventBridge |
| `file.delete.request` | `{ requestId, path }` | Service → EventBridge |
| `file.move.request` | `{ requestId, path, newPath }` | Service → EventBridge |
| `file.rename.request` | `{ requestId, path, newName }` | Service → EventBridge |

### File Operations — Response (6)

| Event | Payload | Direction |
|-------|---------|-----------|
| `file.create.response` | `{ requestId, success, path, error? }` | EventBridge → Service |
| `file.read.response` | `{ requestId, success, path, content?, error? }` | EventBridge → Service |
| `file.update.response` | `{ requestId, success, path, error? }` | EventBridge → Service |
| `file.delete.response` | `{ requestId, success, path, error? }` | EventBridge → Service |
| `file.move.response` | `{ requestId, success, path, newPath?, error? }` | EventBridge → Service |
| `file.rename.response` | `{ requestId, success, path, newPath?, error? }` | EventBridge → Service |

### File Notifications (4)

| Event | Payload | Direction |
|-------|---------|-----------|
| `file.created` | `{ path, source }` | Obsidian → EventBridge → Services |
| `file.modified` | `{ path, source }` | Obsidian → EventBridge → Services |
| `file.deleted` | `{ path, source }` | Obsidian → EventBridge → Services |
| `file.renamed` | `{ oldPath, newPath, source }` | Obsidian → EventBridge → Services |

### Folder Notifications (3)

| Event | Payload | Direction |
|-------|---------|-----------|
| `folder.created` | `{ path, source }` | Obsidian → EventBridge → Services |
| `folder.deleted` | `{ path, source }` | Obsidian → EventBridge → Services |
| `folder.renamed` | `{ oldPath, newPath, source }` | Obsidian → EventBridge → Services |

### Event File Notifications (1)

| Event | Payload | Direction |
|-------|---------|-----------|
| `event.file.triggered` | `{ eventName, path, action }` | EventBridge → DiscoveryService |

### Frontmatter — Request (3)

| Event | Payload | Direction |
|-------|---------|-----------|
| `frontmatter.get.request` | `{ requestId, path }` | Service → EventBridge |
| `frontmatter.update.request` | `{ requestId, path, data }` | Service → EventBridge |
| `frontmatter.set.request` | `{ requestId, path, data }` | Service → EventBridge |

### Frontmatter — Response (3)

| Event | Payload | Direction |
|-------|---------|-----------|
| `frontmatter.get.response` | `{ requestId, success, path, data?, error? }` | EventBridge → Service |
| `frontmatter.update.response` | `{ requestId, success, path, data?, error? }` | EventBridge → Service |
| `frontmatter.set.response` | `{ requestId, success, path, error? }` | EventBridge → Service |

### Workspace (3)

| Event | Payload | Direction |
|-------|---------|-----------|
| `workspace.leaf-changed` | `{ file? }` | Obsidian → EventBridge → Services |
| `workspace.file-opened` | `{ file? }` | Obsidian → EventBridge → Services |
| `workspace.layout-changed` | `{}` | Obsidian → EventBridge → Services |

### Metadata (2)

| Event | Payload | Direction |
|-------|---------|-----------|
| `metadata.changed` | `{ path, frontmatter? }` | Obsidian → EventBridge → Services |
| `metadata.resolved` | `{}` | Obsidian → EventBridge → Services |

### Settings Domain (7)

| Event | Payload | Source |
|-------|---------|--------|
| `settings.loaded` | `{ settings: FlowtiSettings }` | SettingsService |
| `settings.changed` | `{ settings: FlowtiSettings }` | SettingsService |
| `settings.updateCatalogCategories` | `{ categories: CatalogCategoryConfig[] }` | UI → SettingsService |
| `settings.updateCollapsedCategories` | `{ collapsed: string[] }` | UI → SettingsService |
| `settings.updateShowSystemEvents` | `{ showSystemEvents: boolean }` | UI → SettingsService |
| `settings.updateCatalogDomains` | `{ domains: CatalogCategoryConfig[] }` | UI → SettingsService |
| `settings.updateCatalogServices` | `{ services: CatalogCategoryConfig[] }` | UI → SettingsService |

### User Domain (3)

| Event | Payload | Source |
|-------|---------|--------|
| `user.created` | `{ user: FlowtiUser }` | UserService |
| `user.updated` | `{ user: FlowtiUser }` | UserService |
| `user.loaded` | `{ user: FlowtiUser }` | UserService |

### Event Filter Domain (4)

| Event | Payload | Source |
|-------|---------|--------|
| `eventFilter.loaded` | `{ excludedTypes: string[] }` | EventFilterService |
| `eventFilter.changed` | `{ excludedTypes: string[] }` | EventFilterService |
| `eventFilter.toggle` | `{ eventType }` | UI → EventFilterService |
| `eventFilter.toggleCategory` | `{ category }` | UI → EventFilterService |

### Event Notification Domain (4)

| Event | Payload | Source |
|-------|---------|--------|
| `eventNotify.loaded` | `{ notifiedTypes: string[] }` | EventNotificationService |
| `eventNotify.changed` | `{ notifiedTypes: string[] }` | EventNotificationService |
| `eventNotify.toggle` | `{ eventType }` | UI → EventNotificationService |
| `eventNotify.fired` | `{ eventType, timestamp }` | EventNotificationService |

### Discovery Domain (5)

| Event | Payload | Source |
|-------|---------|--------|
| `discovery.loaded` | `{ discoveredEvents: DiscoveredEvent[] }` | DiscoveryService |
| `discovery.updated` | `{ event: DiscoveredEvent, isNew }` | DiscoveryService |
| `discovery.create` | `{ eventName, category?, docMeta? }` | UI → DiscoveryService |
| `discovery.remove` | `{ eventName }` | UI → DiscoveryService |
| `discovery.removed` | `{ eventName }` | DiscoveryService |

### Subscription Domain (9)

| Event | Payload | Source |
|-------|---------|--------|
| `subscription.loaded` | `{ subscriptions: Subscription[] }` | SubscriptionService |
| `subscription.created` | `{ subscription: Subscription }` | SubscriptionService |
| `subscription.updated` | `{ subscription: Subscription }` | SubscriptionService |
| `subscription.deleted` | `{ subscriptionId }` | SubscriptionService |
| `subscription.create` | `{ eventType, label?, filters }` | UI → SubscriptionService |
| `subscription.update` | `{ subscriptionId, label?, filters?, enabled? }` | UI → SubscriptionService |
| `subscription.remove` | `{ subscriptionId }` | UI → SubscriptionService |
| `subscription.refresh` | `{}` | UI → SubscriptionService |
| `subscription.matched` | `{ eventType, subscriptionId, subscriptionLabel?, timestamp }` | SubscriptionService |

### Ingestion Domain (11)

| Event | Payload | Source |
|-------|---------|--------|
| `ingestion.job.queued` | `{ jobId, eventType }` | IngestionService |
| `ingestion.job.started` | `{ jobId, eventType }` | IngestionService |
| `ingestion.job.completed` | `{ jobId, eventType, payload? }` | IngestionService |
| `ingestion.job.failed` | `{ jobId, eventType, error, retryCount, willRetry }` | IngestionService |
| `ingestion.batch.started` | `{ jobCount }` | IngestionService |
| `ingestion.batch.completed` | `{ processedCount, failedCount }` | IngestionService |
| `ingestion.stats` | `{ stats: IngestionStats }` | IngestionService |
| `ingestion.recovery.completed` | `{ recoveredCount }` | IngestionService |
| `catchup.started` | `{ folderCount }` | IngestionService |
| `catchup.file.found` | `{ path }` | IngestionService |
| `catchup.completed` | `{ scannedCount, newCount }` | IngestionService |

### Event Definition Domain (9)

| Event | Payload | Source |
|-------|---------|--------|
| `eventDefinition.loaded` | `{ definitions: EventDefinition[] }` | EventDefinitionService |
| `eventDefinition.created` | `{ definition: EventDefinition }` | EventDefinitionService |
| `eventDefinition.updated` | `{ definition: EventDefinition }` | EventDefinitionService |
| `eventDefinition.deleted` | `{ definitionId }` | EventDefinitionService |
| `eventDefinition.create` | `{ sourceEventType, filePattern?, domainEventName, payloadMappings, emissionPolicy }` | UI → EventDefinitionService |
| `eventDefinition.update` | `{ definitionId, filePattern?, domainEventName?, payloadMappings?, emissionPolicy?, enabled? }` | UI → EventDefinitionService |
| `eventDefinition.remove` | `{ definitionId }` | UI → EventDefinitionService |
| `eventDefinition.refresh` | `{}` | UI → EventDefinitionService |
| `eventDefinition.matched` | `{ definitionId, domainEventName, sourcePath }` | EventDefinitionService |

### Data Exchange Domain (15)

| Event | Payload | Source |
|-------|---------|--------|
| `dataExchange.import.execute` | `{ config: ImportConfig }` | UI → DataExchangeService |
| `dataExchange.import.started` | `{ config, totalRows }` | DataExchangeService |
| `dataExchange.import.progress` | `{ current, total, lastFilename }` | ImportService |
| `dataExchange.import.completed` | `{ result: ImportResult }` | DataExchangeService |
| `dataExchange.import.failed` | `{ error, config }` | DataExchangeService |
| `dataExchange.export.execute` | `{ config: ExportConfig }` | UI → DataExchangeService |
| `dataExchange.export.started` | `{ config }` | DataExchangeService |
| `dataExchange.export.completed` | `{ result: ExportResult }` | DataExchangeService |
| `dataExchange.export.failed` | `{ error, config }` | DataExchangeService |
| `dataExchange.pipeline.execute` | `{ pipelineId }` | UI → DataExchangeService |
| `dataExchange.pipeline.started` | `{ pipeline, totalSources }` | PipelineExecutor |
| `dataExchange.pipeline.sourceCompleted` | `{ pipelineId, sourceIndex, totalSources, sourceResult }` | PipelineExecutor |
| `dataExchange.pipeline.completed` | `{ result: MultiImportResult }` | DataExchangeService |
| `dataExchange.pipeline.failed` | `{ error, pipelineId }` | DataExchangeService |
| `dataExchange.config.changed` | `{ importCount, exportCount }` | DataExchangeService |

### Documentation Domain (6)

| Event | Payload | Source |
|-------|---------|--------|
| `doc.create` | `DocCreateRequest` | UI / DiscoveryService → DocService |
| `doc.created` | `{ path, created, updated?, docType, name, source? }` | DocService |
| `doc.exists` | `{ path, docType, name, source? }` | DocService |
| `doc.failed` | `{ docType, name, error, source? }` | DocService |
| `doc.delete` | `{ path, source? }` | UI → DocService |
| `doc.deleted` | `{ path, source? }` | DocService |

### Installer Domain (6)

| Event | Payload | Source |
|-------|---------|--------|
| `installer.started` | `{ stepCount }` | InstallerService |
| `installer.step.started` | `{ stepId, stepName }` | InstallerService |
| `installer.step.completed` | `InstallerStepStatusEntry` | InstallerService |
| `installer.completed` | `{ state: InstallerState }` | InstallerService |
| `installer.failed` | `{ failedStepId, error }` | InstallerService |
| `installer.loaded` | `{ state: InstallerState }` | InstallerService |

---

## Initialization Sequence

### Startup (6 phases)

```
Plugin.onload()
│
├─ Phase 1: Core Infrastructure
│  ├─ loadSettings()              → Zod-validated settings from storage
│  ├─ initializeEventBus()        → new EventBus()
│  ├─ initializeLogger()          → new LoggerService({ debugMode })
│  ├─ initializeErrorService()    → new ErrorService({ eventBus, logger })
│  ├─ initializeEventBridge()     → new EventBridge(...).register()
│  └─ setupEventListeners()       → settings.changed → logger.setDebugMode()
│
├─ Phase 2: Containers
│  ├─ initializeServiceContainer() → new ServiceContainer({ eventBus, logger })
│  ├─ initializeCommandRegistry() → new CommandRegistry({ logger, eventBus })
│  │   └─ use(loggingMiddleware)
│  │   └─ use(errorMiddleware)
│  └─ initializeViewRegistry()    → new ViewRegistry({ logger, eventBus })
│
├─ Phase 3: Registration
│  ├─ registerAllServices()       → 11 services (see Service Registration Order)
│  ├─ registerAllCommands()       → 4 core commands
│  └─ registerAllViews()          → 3 core views
│
├─ Phase 4: Service Initialization
│  └─ services.initializeAll()    → topological sort:
│      ├─  1. SettingsService       (no deps)
│      ├─  2. UserService           (no deps)
│      ├─  3. EventFilterService    (no deps)
│      ├─  4. EventNotifyService    (no deps)
│      ├─  5. DocService            (no deps)
│      ├─  6. DiscoveryService      (no deps)
│      ├─  7. SubscriptionService   (no deps)
│      ├─  8. IngestionService      (no deps)
│      ├─  9. EventDefinitionService(no deps)
│      ├─ 10. DataExchangeService   (no deps)
│      └─ 11. InstallerService      (depends: userService)
│
├─ Phase 5: UI Binding
│  ├─ addSettingTab(FlowtiSettingTab)
│  ├─ bindViews()                 → registerView() for 3 core views
│  └─ bindCommands()              → addCommand() for 4 core commands
│
└─ Phase 6: Post-Load (workspace.onLayoutReady)
    ├─ settingsService.load()
    ├─ userService.load()
    ├─ installerService.load()
    ├─ InstallerWizardModal.showIfNeeded()
    ├─ eventFilterService.load()
    ├─ eventNotifyService.load()
    ├─ discoveryService.load()
    ├─ subscriptionService.load()
    ├─ ingestionService.load()
    ├─ eventDefinitionService.load()
    ├─ dataExchangeService.load()
    ├─ DataExchangeSetup
    │  ├─ wireCallbacks()         → setDocsRootPath, setListFiles, setWriteExternalFile, setReadExternalFile
    │  ├─ registerViews()         → 3 data exchange views
    │  ├─ registerFileMenuItems() → CSV import, base/folder export context menus
    │  └─ registerCommands()      → 2 data exchange commands
    ├─ ingestionService.runCatchUp() (if watchFolders configured)
    ├─ eventBridge.registerVaultListeners()  ← AFTER all loads (avoids file/metadata flood)
    └─ emit("plugin.ready")
```

### Shutdown (reverse order)

```
Plugin.onunload()
├─ emit("plugin.unloading")
├─ EventBridge.dispose()          → unsubscribe EventBus handlers
├─ services.disposeAll()          → dispose in reverse init order
├─ commands.clear()
├─ views.clear()
├─ eventBus.clear()               → last, so unload listeners still fire
└─ emit("plugin.unloaded")
```

---

## Storage Schema

All persistent data is merged into a single JSON object via Obsidian's `loadData()`/`saveData()`:

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
  user: {
    id: UUID,
    name: string,
    createdAt: string
  },

  // EventFilterService
  eventFilter: {
    excludedTypes: string[]
  },

  // EventNotificationService
  eventNotify: {
    notifiedTypes: string[]
  },

  // DiscoveryService
  discovery: {
    events: Record<string, DiscoveredEvent>
  },

  // SubscriptionService
  subscription: {
    subscriptions: Record<string, Subscription>
  },

  // IngestionService
  ingestion: {
    processedKeys: string[],
    pendingJobs?: IngestionJob[]
  },

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
    completedSteps: {
      [stepId: string]: {
        completedAt: string
      }
    }
  }
}
```

All services share a single `IStorageProvider` adapter that wraps `plugin.loadData()`/`plugin.saveData()`:

```typescript
IStorageProvider {
  load(): Promise<unknown>;
  save(data: unknown): Promise<void>;
}
```

---

## Dependency Graph

```
                    ┌──────────┐
                    │ EventBus │
                    └────┬─────┘
           ┌─────────────┼─────────────────────┐
           │             │                     │
     ┌─────▼─────┐ ┌────▼──────┐       ┌──────▼───────┐
     │  Logger   │ │ErrorService│       │ EventBridge  │
     └─────┬─────┘ └───────────┘       └──────────────┘
           │
     ┌─────▼────────────┐
     │ ServiceContainer │
     └─────┬────────────┘
           │
    ┌──────┴──────────────────────────────────────────────────┐
    │      │        │       │       │        │        │       │
┌───▼──┐┌──▼───┐┌───▼──┐┌──▼───┐┌──▼────┐┌──▼───┐┌──▼───┐┌──▼────────┐
│Sett- ││ User ││Event ││Event ││ Doc   ││Disco-││Subs- ││Ingestion  │
│ings  ││Servi-││Filter││Notify││Servi- ││very  ││crip- ││Service    │
│Servi-││ce    ││Servi-││Servi-││ce     ││Servi-││tion  ││           │
│ce    ││      ││ce    ││ce    ││       ││ce    ││Servi-││           │
└──────┘└──────┘└──────┘└──────┘└──────┘└──────┘│ce    │└───────────┘
                                                └──────┘
    ┌───────────┐  ┌────────────────┐
    │EventDef-  │  │ DataExchange   │
    │inition    │  │ Service        │
    │Service    │  │ ┌────────────┐ │
    │           │  │ │FileSystem  │ │
    │           │  │ │Client      │ │
    │           │  │ └────────────┘ │
    └───────────┘  └────────────────┘

    ┌──────────────────┐
    │  Installer       │
    │  Service         │
    │ ┌──────────────┐ │
    │ │FileSystem    │ │
    │ │Client        │ │
    │ └──────────────┘ │
    │ depends: User    │
    └──────────────────┘

    ┌──────────────┐   ┌──────────────┐
    │CommandRegistry│   │ ViewRegistry │
    └──────────────┘   └──────────────┘
```

### Service Registration Order

| # | Service ID | Dependencies | Factory Creates |
|---|------------|-------------|-----------------|
| 1 | `settingsService` | — | `new SettingsService({ storage, eventBus })` |
| 2 | `userService` | — | `new UserService({ storage, eventBus })` |
| 3 | `eventFilterService` | — | `new EventFilterService({ storage, eventBus })` |
| 4 | `eventNotifyService` | — | `new EventNotificationService({ storage, eventBus })` |
| 5 | `docService` | — | `new DocService({ eventBus, fileSystem })` |
| 6 | `discoveryService` | — | `new DiscoveryService({ storage, eventBus })` |
| 7 | `subscriptionService` | — | `new SubscriptionService({ storage, eventBus })` |
| 8 | `ingestionService` | — | `new IngestionService({ storage, eventBus })` |
| 9 | `eventDefinitionService` | — | `new EventDefinitionService({ storage, eventBus })` |
| 10 | `dataExchangeService` | — | `new DataExchangeService({ storage, eventBus, fileSystem })` |
| 11 | `installerService` | `userService` | `new InstallerService({ storage, eventBus, fileSystem, userService })` + register steps |

---

## Appendix: Type Reference

### Branded Types

| Type | Base | Source |
|------|------|--------|
| `UUID` | `string & { __brand: "UUID" }` | `src/utils/types.ts` |
| `RequestId` | `string & { __brand: "RequestId" }` | `src/infrastructure/events/events.ts` |

### Shared Interfaces

| Interface | Source | Used By |
|-----------|--------|---------|
| `IStorageProvider` | `src/utils/types.ts` | All persistent services |
| `IDisposable` | `src/infrastructure/services/types.ts` | Any service with cleanup logic |
| `FlowtiEvent<T>` | `src/infrastructure/events/types.ts` | All event handlers |
| `FlowtiErrorInfo` | `src/infrastructure/errors/types.ts` | ErrorService, event payloads |
| `LogEntry` | `src/infrastructure/logger/types.ts` | LoggerService, event payloads |

### Validation Schemas (Zod)

| Schema | Source | Validates |
|--------|--------|-----------|
| `FlowtiSettingsSchema` | `src/domain/settings/settings.ts` | Settings data on load |
| `FlowtiUserSchema` | `src/domain/user/types.ts` | User data on load |
| `UUIDSchema` | `src/domain/user/types.ts` | UUID format |
