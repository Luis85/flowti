---
stage: done
domain: Flowti/System
plugin: "[[Development/flowti/README|README]]"
tags:
  - backend
---

# Flowti IBDE — Service Design Blueprint

> Comprehensive reference for every service, event, and lifecycle hook in the plugin.
> For the high-level architecture see the [[Development/flowti/README|README]] (Arc42).

---

## Overview

The Flowti IBDE plugin is built on an **event-driven, dependency-injected** service architecture. Services never call the Obsidian API directly — all platform interaction flows through the **EventBridge**, and all inter-service communication flows through the **EventBus**.

### Layers

| Layer | Purpose | Services |
|-------|---------|----------|
| **Infrastructure** | Generic plumbing, platform abstraction | EventBus, EventBridge, FileSystemClient, LoggerService, ErrorService, ServiceContainer, CommandRegistry, ViewRegistry |
| **Domain** | Business logic, one bounded context per folder | SettingsService, UserService, InstallerService |

### Communication Rules

1. Services emit events on the EventBus — they never import other services directly
2. The EventBridge is the sole Obsidian API contact point
3. File operations use the request/response pattern (`file.*.request` → `file.*.response`) correlated by `RequestId`
4. Domain services are registered in the ServiceContainer with explicit dependency declarations

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

**Workspace notifications**: `workspace.leaf-changed`, `workspace.file-opened`, `workspace.layout-changed`

**Metadata notifications**: `metadata.changed`, `metadata.resolved`

---

### FileSystemClient

| | |
|---|---|
| **ID** | Created ad-hoc in InstallerService factory |
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

| ID | Name | Description |
|----|------|-------------|
| `flowti:open-component-showcase` | Open Component Showcase | Opens the CSS component preview pane |

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

| Type | Display Name | Icon |
|------|-------------|------|
| `flowti-component-showcase` | Flowti Components | `palette` |

---

## Domain Layer

### SettingsService

| | |
|---|---|
| **ID** | `"settingsService"` |
| **Source** | `src/domain/settings/SettingsService.ts` |
| **Interface** | `ISettingsService` |
| **Dependencies** | None |
| **Lifecycle** | Phase 4 (initializeAll) |
| **Storage Key** | Top-level keys (e.g., `debugMode`) |

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

#### Events Emitted

| Event | Payload | When |
|-------|---------|------|
| `settings.changed` | `{ settings: FlowtiSettings }` | After `updateSettings()` |
| `settings.loaded` | `{ settings: FlowtiSettings }` | After `load()` |

#### Data Model

```typescript
FlowtiSettings {
  debugMode: boolean;  // default: false
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

56 events organized by category.

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

### User Domain (3)

| Event | Payload | Source |
|-------|---------|--------|
| `user.created` | `{ user: FlowtiUser }` | UserService |
| `user.updated` | `{ user: FlowtiUser }` | UserService |
| `user.loaded` | `{ user: FlowtiUser }` | UserService |

### Settings Domain (2)

| Event | Payload | Source |
|-------|---------|--------|
| `settings.changed` | `{ settings: FlowtiSettings }` | SettingsService |
| `settings.loaded` | `{ settings: FlowtiSettings }` | SettingsService |

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
│  ├─ registerAllServices()       → settingsService, userService, installerService
│  ├─ registerAllCommands()       → flowti:open-component-showcase
│  └─ registerAllViews()          → flowti-component-showcase
│
├─ Phase 4: Service Initialization
│  └─ services.initializeAll()    → topological sort:
│      ├─ 1. SettingsService       (no deps)
│      ├─ 2. UserService           (no deps)
│      └─ 3. InstallerService      (depends: userService)
│
├─ Phase 5: UI Binding
│  ├─ addSettingTab(FlowtiSettingTab)
│  ├─ bindViews()                 → registerView() for each
│  └─ bindCommands()              → addCommand() for each
│
└─ Phase 6: Post-Load (workspace.onLayoutReady)
    ├─ userService.load()
    ├─ installerService.load()
    ├─ InstallerWizardModal.showIfNeeded()
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

  // UserService
  user: {
    id: UUID,
    name: string,
    createdAt: string       // ISO 8601
  },

  // InstallerService
  installer: {
    installed: boolean,
    installedAt?: string,   // ISO 8601
    completedSteps: {
      [stepId: string]: {
        completedAt: string // ISO 8601
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
    ┌──────┼──────────────────┐
    │      │                  │
┌───▼──┐ ┌─▼──────┐ ┌────────▼────────┐
│Sett- │ │ User   │ │   Installer     │
│ings  │ │Service │ │   Service       │
│Servi-│ │        │ │                 │
│ce    │ │        │ │ ┌─────────────┐ │
│      │ │        │ │ │FileSystem   │ │
│      │ │        │◄├─│Client       │ │
│      │ │        │ │ └─────────────┘ │
└──────┘ └────────┘ └─────────────────┘

    ┌──────────────┐   ┌──────────────┐
    │CommandRegistry│   │ ViewRegistry │
    └──────────────┘   └──────────────┘
```

### Service Registration Order

| # | Service ID | Dependencies | Factory Creates |
|---|------------|-------------|-----------------|
| 1 | `settingsService` | — | `new SettingsService({ storage, eventBus })` |
| 2 | `userService` | — | `new UserService({ storage, eventBus })` |
| 3 | `installerService` | `userService` | `new InstallerService({ storage, eventBus, fileSystem, userService })` + register steps |

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
| `IStorageProvider` | `src/utils/types.ts` | SettingsService, UserService, InstallerService |
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
