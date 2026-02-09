---
stage: done
domain: Flowti/System
plugin: "[[Development/flowti/README|README]]"
---

# EventBridge

The EventBridge is the sole contact point between the plugin and the Obsidian API. It translates platform events into internal EventBus events and handles file/frontmatter requests from services. Services never import from `obsidian` — they emit requests and receive responses through the EventBus.

## Architecture

```
src/infrastructure/events/
├── EventBridge.ts   # Obsidian ↔ EventBus translation (5 handler groups)
├── EventBus.ts      # Pub/sub backbone
├── events.ts        # FlowtiEventMap — all event type definitions
└── types.ts         # IEventBridge, EventBridgeOptions
```

### How It Works

The EventBridge handles five categories of events:

```
Obsidian API                EventBridge               EventBus
                                                        │
Vault.create/modify/     ──► setupVaultListeners()    ──► file.created / file.modified / ...
  delete/rename                                        ──► folder.created / folder.deleted / ...
                                                        │
                                                        │
Workspace.active-leaf-   ──► setupWorkspaceListeners() ─► workspace.leaf-changed / ...
  change/file-open/                                     │
  layout-change                                         │
                                                        │
MetadataCache.changed/   ──► setupMetadataCache-       ─► metadata.changed / ...
  resolved                    Listeners()               │
                                                        │
                            setupFileSystem-           ◄─ file.*.request
                              Handlers()               ─► file.*.response
                                                        │
                            setupFrontmatter-          ◄─ frontmatter.*.request
                              Handlers()               ─► frontmatter.*.response
```

| Category | Direction | What Happens |
|----------|-----------|-------------|
| **Vault notifications** | Obsidian → EventBus | Forwards create/modify/delete/rename as `file.*` and `folder.*` events |
| **Workspace notifications** | Obsidian → EventBus | Forwards leaf-change/file-open/layout-change as `workspace.*` events |
| **Metadata notifications** | Obsidian → EventBus | Forwards cache changes as `metadata.changed`, `metadata.resolved` |
| **File system requests** | EventBus → Obsidian → EventBus | Listens for `file.*.request`, calls Vault API, emits `file.*.response` |
| **Frontmatter requests** | EventBus → Obsidian → EventBus | Listens for `frontmatter.*.request`, calls metadata API, emits `frontmatter.*.response` |

---

## API Reference

| Method | Signature | Description |
|--------|-----------|-------------|
| `register` | `(): void` | Set up all Obsidian listeners and request handlers |
| `dispose` | `(): void` | Clean up all EventBus subscriptions |

### Constructor (`EventBridgeOptions`)

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `app` | `App` | Yes | Obsidian App instance |
| `eventBus` | `IEventBus` | Yes | Core event bus |
| `logger` | `ILogger` | Yes | Debug logging |
| `registerEvent` | `(ref: EventRef) => void` | Yes | Obsidian lifecycle event registration |

### Instantiation

```typescript
// In main.ts, Phase 1
const bridge = new EventBridge({
  app: this.app,
  eventBus: this.eventBus,
  logger: this.logger,
  registerEvent: (ref) => this.registerEvent(ref),
});
bridge.register();
```

---

## Vault Notifications

The EventBridge registers listeners on `app.vault` via Obsidian's `registerEvent()` (auto-cleaned on plugin unload). Both `TFile` and `TFolder` events are forwarded as separate event types.

### File Events

| Obsidian Event | Internal Event | Payload |
|----------------|----------------|---------|
| `vault.on("create")` + `TFile` | `file.created` | `{ path, source: "obsidian" }` |
| `vault.on("modify")` + `TFile` | `file.modified` | `{ path, source: "obsidian" }` |
| `vault.on("delete")` + `TFile` | `file.deleted` | `{ path, source: "obsidian" }` |
| `vault.on("rename")` + `TFile` | `file.renamed` | `{ oldPath, newPath, source: "obsidian" }` |

### Folder Events

| Obsidian Event | Internal Event | Payload |
|----------------|----------------|---------|
| `vault.on("create")` + `TFolder` | `folder.created` | `{ path, source: "obsidian" }` |
| `vault.on("delete")` + `TFolder` | `folder.deleted` | `{ path, source: "obsidian" }` |
| `vault.on("rename")` + `TFolder` | `folder.renamed` | `{ oldPath, newPath, source: "obsidian" }` |

Folder modify events are not emitted — folders don't have content to modify.

### `FileChangeSource`

The `source` field indicates who caused the change:

```typescript
type FileChangeSource = "user" | "obsidian" | "sync" | "plugin" | "unknown";
```

Currently all vault notifications use `"obsidian"` as the source. Future extensions can differentiate between user edits, sync operations, and plugin-initiated changes.

### Listening for Changes

```typescript
eventBus.on("file.created", (event) => {
  console.log(`New file: ${event.payload.path}`);
});

eventBus.on("folder.created", (event) => {
  console.log(`New folder: ${event.payload.path}`);
});

eventBus.on("file.renamed", (event) => {
  console.log(`${event.payload.oldPath} → ${event.payload.newPath}`);
});
```

---

## Event-File Notifications

Files can act as event declarations by setting the frontmatter property `type: "Event"`. When such a file triggers any vault action, the EventBridge emits an additional `event.file.triggered` event.

### Frontmatter Convention

```yaml
---
type: Event
name: deployment.started
---
```

The `name` property is optional. If omitted, the event name is derived from the file's title (basename without extension), transformed to **all lowercase** with **`.` instead of spaces**:

| File | `name` in frontmatter | Resulting `eventName` |
|------|----------------------|----------------------|
| `Deployment Started.md` | `deployment.started` | `deployment.started` |
| `Deployment Started.md` | _(missing)_ | `deployment.started` |
| `Config Updated.md` | _(missing)_ | `config.updated` |

### How It Works

On every vault event (create, modify, delete, rename), after emitting the standard `file.*` event, the EventBridge checks the file's metadata cache. If `frontmatter.type === "Event"`, it emits:

| Internal Event | Payload |
|----------------|---------|
| `event.file.triggered` | `{ eventName, path, action }` |

Where `action` is one of `"created"`, `"modified"`, `"deleted"`, or `"renamed"`.

### Subscribing

```typescript
eventBus.on("event.file.triggered", (event) => {
  const { eventName, path, action } = event.payload;
  console.log(`Event "${eventName}" triggered by ${action} at ${path}`);
});
```

### Cache Availability

The EventBridge reads frontmatter from `metadataCache.getFileCache()`. On delete events the cache may already be cleared, so `event.file.triggered` is not guaranteed to fire for deletions.

### Created File Detection

On file creation, Obsidian's `vault.on("create")` fires **before** the metadata cache has parsed the frontmatter. This means `getFileCache()` returns `null` and the event-file check would miss the file.

To solve this, the EventBridge uses a **pending-set handoff** between the two listeners:

1. `vault.on("create")` records the file path in `pendingCreatedPaths`
2. `metadataCache.on("changed")` checks and consumes the path — if found, calls `emitEventFileTriggered(file, "created")`

```
vault.on("create")             metadataCache.on("changed")
  │                                │
  ├─ emit file.created             ├─ emit metadata.changed
  └─ pendingCreatedPaths.add()     └─ if pendingCreatedPaths has path:
                                        delete from set
                                        emitEventFileTriggered("created")
```

This is deterministic — no timestamp heuristics.

---

## Workspace Notifications

| Obsidian Event | Internal Event | Payload |
|----------------|----------------|---------|
| `workspace.on("active-leaf-change")` | `workspace.leaf-changed` | `{ file: { path, basename, extension } \| null }` |
| `workspace.on("file-open")` | `workspace.file-opened` | `{ file: { path, basename, extension } \| null }` |
| `workspace.on("layout-change")` | `workspace.layout-changed` | `{}` |

### File Resolution

- `leaf-changed`: The EventBridge inspects `leaf.view.file` — if it's a `TFile`, the file info is extracted. Otherwise `file` is `null`.
- `file-opened`: If the argument is a `TFile`, file info is extracted. Otherwise `null`.
- `layout-changed`: No payload (empty object).

```typescript
eventBus.on("workspace.leaf-changed", (event) => {
  if (event.payload.file) {
    console.log(`Active file: ${event.payload.file.path}`);
  } else {
    console.log("No file active (e.g. graph view, settings)");
  }
});
```

---

## Metadata Notifications

| Obsidian Event | Internal Event | Payload |
|----------------|----------------|---------|
| `metadataCache.on("changed")` | `metadata.changed` | `{ path, frontmatter: Record \| undefined }` |
| `metadataCache.on("resolved")` | `metadata.resolved` | `{}` |

### How It Works

- `changed`: Fires when Obsidian re-parses a file's metadata (frontmatter, tags, links). The EventBridge reads the fresh cache and includes the `frontmatter` object. Only `TFile` events are forwarded.
- `resolved`: Fires when all metadata references in the vault have been resolved (typically after startup or bulk operations).

```typescript
eventBus.on("metadata.changed", (event) => {
  const { path, frontmatter } = event.payload;
  if (frontmatter?.status === "completed") {
    markTaskDone(path);
  }
});
```

---

## File System Request Handlers

The EventBridge listens for `file.*.request` events, performs the Obsidian Vault API call, and emits a `file.*.response` with the same `requestId`. This is the server side of the request/response pattern used by the [[Development/flowti/docs/features/File System/File System|FileSystemClient]].

### Request → API → Response

| Request Event | Obsidian API | Response Event |
|---------------|-------------|----------------|
| `file.create.request` | `vault.create(path, content)` | `file.create.response` |
| `file.read.request` | `vault.read(tFile)` | `file.read.response` |
| `file.update.request` | `vault.modify(tFile, content)` | `file.update.response` |
| `file.delete.request` | `vault.delete(tFile)` | `file.delete.response` |
| `file.move.request` | `fileManager.renameFile(tFile, newPath)` | `file.move.response` |
| `file.rename.request` | `fileManager.renameFile(tFile, newPath)` | `file.rename.response` |

### File Lookup

For read, update, delete, move, and rename operations, the EventBridge first resolves the path to a `TFile`:

```typescript
const file = this.app.vault.getAbstractFileByPath(path);
if (!file || !(file instanceof TFile)) {
  throw new Error(`File not found: ${path}`);
}
```

For create, the file doesn't need to exist yet.

### `createFolders` Option

When `file.create.request` includes `createFolders: true`, the EventBridge creates the parent directory before creating the file:

```typescript
if (createFolders) {
  const folderPath = path.substring(0, path.lastIndexOf("/"));
  if (folderPath && !this.app.vault.getAbstractFileByPath(folderPath)) {
    await this.app.vault.createFolder(folderPath);
  }
}
await this.app.vault.create(path, content);
```

### Rename Path Computation

For `file.rename.request`, the EventBridge computes the new full path from the current folder and the new name:

```typescript
const folderPath = path.substring(0, path.lastIndexOf("/"));
const newPath = folderPath ? `${folderPath}/${newName}` : newName;
await this.app.fileManager.renameFile(file, newPath);
```

Root-level files (no `/` in path) are renamed directly to `newName`.

### Error Handling

Every handler wraps the Obsidian API call in a try-catch. On failure, a response with `success: false` is emitted:

```typescript
// Success
await this.eventBus.emit("file.create.response", {
  requestId,
  success: true,
  path,
});

// Failure
await this.eventBus.emit("file.create.response", {
  requestId,
  success: false,
  path,
  error: {
    code: "FILE_CREATE_FAILED",
    message: error.message,
    path,
  },
});
```

### Error Codes

| Operation | Error Code |
|-----------|-----------|
| `file.create` | `FILE_CREATE_FAILED` |
| `file.read` | `FILE_READ_FAILED` |
| `file.update` | `FILE_UPDATE_FAILED` |
| `file.delete` | `FILE_DELETE_FAILED` |
| `file.move` | `FILE_MOVE_FAILED` |
| `file.rename` | `FILE_RENAME_FAILED` |
| `frontmatter.get` | `FRONTMATTER_GET_FAILED` |
| `frontmatter.update` | `FRONTMATTER_UPDATE_FAILED` |
| `frontmatter.set` | `FRONTMATTER_SET_FAILED` |

---

## Frontmatter Request Handlers

| Request Event | Obsidian API | Response Event |
|---------------|-------------|----------------|
| `frontmatter.get.request` | `metadataCache.getFileCache()` | `frontmatter.get.response` |
| `frontmatter.update.request` | `fileManager.processFrontMatter()` | `frontmatter.update.response` |
| `frontmatter.set.request` | `fileManager.processFrontMatter()` | `frontmatter.set.response` |

### Get

Reads frontmatter from Obsidian's metadata cache (no file I/O):

```typescript
const cache = this.app.metadataCache.getFileCache(file);
const data = cache?.frontmatter ?? {};
```

### Update (merge)

Merges new fields into existing frontmatter via `processFrontMatter`:

```typescript
await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
  Object.assign(frontmatter, data);
});
```

Existing keys not in `data` are preserved.

### Set (replace)

Clears all existing keys, then assigns new data:

```typescript
await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
  for (const key of Object.keys(frontmatter)) {
    delete frontmatter[key];
  }
  Object.assign(frontmatter, data);
});
```

---

## Cleanup and Lifecycle

| Phase | What Happens |
|-------|-------------|
| Phase 1 (Core) | `new EventBridge(options)` + `bridge.register()` |
| Register | Sets up 9 request handlers (EventBus subscriptions) + 9 Obsidian listeners |
| `onunload()` | `bridge.dispose()` removes all EventBus subscriptions |
| Obsidian cleanup | `registerEvent()` refs are auto-cleaned by Obsidian's plugin lifecycle |

### Dual Cleanup Strategy

- **EventBus handlers** (file/frontmatter requests): stored in `this.unsubscribers[]`, cleaned up by `dispose()`.
- **Obsidian event refs** (vault/workspace/metadata): passed to `this.registerEvent()`, cleaned up automatically by Obsidian when the plugin unloads.

```typescript
dispose(): void {
  for (const unsub of this.unsubscribers) {
    unsub();
  }
  this.unsubscribers = [];
}
```

---

## Testing

### Mock Obsidian App

The test suite creates a mock App with `createMockApp()` that provides mock Vault, FileManager, MetadataCache, and Workspace objects with trigger functions:

```typescript
const mockApp = createMockApp();
const bridge = new EventBridge({
  app: mockApp as never,
  eventBus,
  logger,
  registerEvent: vi.fn(),
});
bridge.register();
```

### Testing File Operations

Emit a request and assert the response:

```typescript
it("should create a file and emit success response", async () => {
  const handler = vi.fn();
  eventBus.on("file.create.response", handler);

  await eventBus.emit("file.create.request", {
    requestId: "req-1" as RequestId,
    path: "notes/test.md",
    content: "# Hello",
  });

  expect(mockApp.vault.create).toHaveBeenCalledWith("notes/test.md", "# Hello");
  expect(handler).toHaveBeenCalledWith(
    expect.objectContaining({
      payload: expect.objectContaining({
        requestId: "req-1",
        success: true,
        path: "notes/test.md",
      }),
    }),
  );
});
```

### Testing Error Responses

Mock the Obsidian API to throw:

```typescript
it("should emit error response on failure", async () => {
  mockApp.vault.create.mockRejectedValue(new Error("File exists"));
  const handler = vi.fn();
  eventBus.on("file.create.response", handler);

  await eventBus.emit("file.create.request", {
    requestId: "req-2" as RequestId,
    path: "test.md",
    content: "",
  });

  expect(handler).toHaveBeenCalledWith(
    expect.objectContaining({
      payload: expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "FILE_CREATE_FAILED",
          message: "File exists",
        }),
      }),
    }),
  );
});
```

### Testing Vault Notifications

Trigger the mock Obsidian event and assert the internal event:

```typescript
it("should emit file.created on vault create", async () => {
  const handler = vi.fn();
  eventBus.on("file.created", handler);

  const tFile = createTFile("new-file.md");
  mockApp._triggerVaultEvent("create", tFile);
  await new Promise((r) => setTimeout(r, 10));

  expect(handler).toHaveBeenCalledWith(
    expect.objectContaining({
      payload: { path: "new-file.md", source: "obsidian" },
    }),
  );
});
```

### Testing Disposal

```typescript
it("should unsubscribe all EventBus handlers on dispose", async () => {
  bridge.dispose();

  const handler = vi.fn();
  eventBus.on("file.create.response", handler);

  await eventBus.emit("file.create.request", {
    requestId: "req-99" as RequestId,
    path: "test.md",
    content: "",
  });

  // Bridge handler no longer fires → no response emitted
  expect(handler).not.toHaveBeenCalled();
});
```

### Test Coverage

| Describe Block | Tests | What it Covers |
|---------------|-------|----------------|
| `file.create` | 3 | Success, createFolders, error |
| `file.read` | 2 | Success, not found |
| `file.update` | 2 | Success, not found |
| `file.delete` | 2 | Success, not found |
| `file.move` | 2 | Success, not found |
| `file.rename` | 2 | Subfolder, root-level |
| `frontmatter.get` | 2 | Success, not found |
| `frontmatter.update` | 1 | Merge |
| `frontmatter.set` | 2 | Replace, clears old keys |
| Vault listeners | 5 | create/modify/delete/rename, non-TFile/TFolder ignored |
| Folder listeners | 4 | folder.created, folder.deleted, folder.renamed, no folder.modified |
| Event-file triggered | 8 | modify/rename via vault, deferred create via metadata.changed, name derivation from basename, negative cases |
| Workspace listeners | 6 | leaf-changed (with file, null leaf, no-file view), file-opened, layout-changed |
| Metadata listeners | 4 | changed (with/without frontmatter), non-TFile ignored, resolved |
| Dispose | 1 | All handlers unsubscribed |
| **Total** | **47** | |

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Single Obsidian contact point** | Services stay decoupled from the platform and are fully unit-testable |
| **`registerEvent()` for Obsidian listeners** | Leverages Obsidian's built-in cleanup on plugin unload |
| **`void this.eventBus.emit(...)` for notifications** | Vault/workspace/metadata events are fire-and-forget — no need to await |
| **`await this.eventBus.emit(...)` for responses** | Request handlers await the response emission to ensure sequencing |
| **TFile/TFolder dispatch on vault events** | Files and folders emit distinct event types (`file.*` vs `folder.*`) for targeted handling |
| **Error wrapping in try-catch** | Every request handler guarantees a response (success or failure) — never leaves the caller hanging |
| **Structured error codes** | Enables programmatic error routing (e.g. `FILE_READ_FAILED` vs generic Error) |
| **Pending-set handoff for event-file creation** | Vault create fires before cache is populated; the create listener records the path and metadata.changed consumes it — deterministic, no timestamp heuristics |
