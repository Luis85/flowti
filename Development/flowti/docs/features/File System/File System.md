---
stage: done
domain: Flowti/System
plugin: "[[Development/flowti/README|README]]"
type: Feature
---

# FileSystemClient

The FileSystemClient is a promise-based facade for all file and frontmatter operations. It decouples services from the Obsidian API by using an event-driven request/response pattern — services never import from `obsidian` directly.

## Architecture

```
src/infrastructure/
├── filesystem/
│   ├── FileSystemClient.ts      # Promise-based client (request/response)
│   └── types.ts                 # IFileSystemClient, CreateFileOptions, etc.
└── events/
    ├── EventBridge.ts           # Obsidian API handler (the other side)
    ├── events.ts                # FlowtiEventMap (request/response payloads)
    └── types.ts                 # IEventBus, RequestId, FileResponseBase
```

### How It Works

1. A service calls `fileSystem.createFile("notes/doc.md", "# Hello")`.
2. The client generates a unique `RequestId` (UUID v4, branded type) and emits `file.create.request` on the EventBus.
3. Before emitting, the client registers a temporary **wildcard listener** (`*`) that filters for the matching `file.create.response` + `requestId`.
4. The **EventBridge** receives the request, calls the Obsidian Vault API (`vault.create()`), and emits `file.create.response` with the same `requestId`.
5. The wildcard listener matches the response, clears the timeout, unsubscribes itself, and resolves (or rejects) the Promise.
6. If no response arrives within the timeout (default 5000 ms), the Promise rejects with a timeout error.

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
  │                        │ file.create.response │                    │
  │                        │◄─────────────────────┤                    │
  │ Promise resolves       │                      │                    │
  │◄───────────────────────┤                      │                    │
```

---

## API Reference

### File Operations

| Method | Signature | Returns |
|--------|-----------|---------|
| `createFile` | `(path, content, options?: CreateFileOptions)` | `Promise<void>` |
| `readFile` | `(path, options?: FileOperationOptions)` | `Promise<string>` |
| `updateFile` | `(path, content, options?: FileOperationOptions)` | `Promise<void>` |
| `deleteFile` | `(path, options?: FileOperationOptions)` | `Promise<void>` |
| `moveFile` | `(path, newPath, options?: FileOperationOptions)` | `Promise<string>` |
| `renameFile` | `(path, newName, options?: FileOperationOptions)` | `Promise<string>` |

### Frontmatter Operations

| Method | Signature | Returns |
|--------|-----------|---------|
| `getFrontmatter` | `(path, options?: FileOperationOptions)` | `Promise<Record<string, unknown>>` |
| `updateFrontmatter` | `(path, data, options?: FileOperationOptions)` | `Promise<Record<string, unknown>>` |
| `setFrontmatter` | `(path, data, options?: FileOperationOptions)` | `Promise<void>` |

### Frontmatter Semantics

| Method | Behavior |
|--------|----------|
| `getFrontmatter` | Returns current frontmatter as object (`{}` if none) |
| `updateFrontmatter` | Merges `data` into existing frontmatter (like `Object.assign`), returns updated result |
| `setFrontmatter` | Replaces entire frontmatter — existing keys not in `data` are removed |

---

## Options

### `CreateFileOptions`

```typescript
interface CreateFileOptions {
  /** Create parent folders if they don't exist */
  createFolders?: boolean;
  /** Custom timeout for this operation */
  timeout?: number;
}
```

### `FileOperationOptions`

```typescript
interface FileOperationOptions {
  /** Custom timeout for this operation */
  timeout?: number;
}
```

### Constructor

```typescript
const client = new FileSystemClient({
  eventBus,          // required — the EventBus instance
  timeout: 10000,    // optional — default timeout in ms (default: 5000)
});
```

---

## The `createFolders` Option

When `createFolders: true` is passed to `createFile`, the EventBridge creates parent directories before creating the file:

```typescript
await client.createFile("deep/nested/path/file.md", "content", {
  createFolders: true,
});
// EventBridge checks if "deep/nested/path/" exists
// → creates it via vault.createFolder() if missing
// → then creates the file
```

This is used by `FolderScaffoldStep` in the installer to create the PARA folder structure with `.gitkeep` placeholders.

---

## Request/Response Correlation

Every request carries a branded `RequestId` (UUID v4) that the EventBridge copies into the response. The client uses a wildcard listener to match them:

```typescript
// Simplified internal flow
const requestId = generateRequestId(); // UUID v4 as RequestId

const unsubscribe = eventBus.on("*", (event) => {
  if (event.type !== "file.create.response") return;
  if (event.payload.requestId !== requestId) return;

  clearTimeout(timeoutId);
  unsubscribe();

  if (event.payload.success) {
    resolve();
  } else {
    reject(new Error(event.payload.error?.message ?? "Operation failed"));
  }
});

await eventBus.emit("file.create.request", { requestId, path, content });
```

This pattern supports **concurrent requests** — each call has its own `requestId`, so multiple `readFile()` calls can run in parallel via `Promise.all()`.

---

## Timeout Handling

If no response arrives within the timeout window, the Promise rejects:

```typescript
const timeoutId = setTimeout(() => {
  unsubscribe();                    // clean up wildcard listener
  reject(new Error(`Request timed out after ${timeoutMs}ms`));
}, timeoutMs);
```

| Priority | Source | Default |
|----------|--------|---------|
| 1 (highest) | Per-operation `options.timeout` | — |
| 2 | Constructor `options.timeout` | — |
| 3 (lowest) | Hardcoded fallback | 5000 ms |

---

## Error Handling

### Response Structure

Every response follows `FileResponseBase`:

```typescript
interface FileResponseBase {
  requestId: RequestId;
  success: boolean;
  path: string;
}
```

Failed responses include a `FileOperationError`:

```typescript
interface FileOperationError {
  code: string;     // e.g. "FILE_CREATE_FAILED"
  message: string;  // e.g. "File already exists"
  path: string;
}
```

### Error Codes

| Operation | Error Code | Typical Cause |
|-----------|-----------|---------------|
| `createFile` | `FILE_CREATE_FAILED` | File already exists, permission denied |
| `readFile` | `FILE_READ_FAILED` | File not found |
| `updateFile` | `FILE_UPDATE_FAILED` | File not found |
| `deleteFile` | `FILE_DELETE_FAILED` | File not found |
| `moveFile` | `FILE_MOVE_FAILED` | Source not found, destination exists |
| `renameFile` | `FILE_RENAME_FAILED` | Source not found |
| `getFrontmatter` | `FRONTMATTER_GET_FAILED` | File not found, no cache entry |
| `updateFrontmatter` | `FRONTMATTER_UPDATE_FAILED` | processFrontMatter error |
| `setFrontmatter` | `FRONTMATTER_SET_FAILED` | processFrontMatter error |

### Client-Side Error Handling

The client rejects with a standard `Error` whose `message` comes from the response:

```typescript
try {
  await client.readFile("nonexistent.md");
} catch (error) {
  // error.message === "File not found" (from EventBridge)
  // or "Request timed out after 5000ms" (from timeout)
}
```

---

## Events

### Request Events (Service → EventBridge)

| Event | Payload |
|-------|---------|
| `file.create.request` | `{ requestId, path, content, createFolders? }` |
| `file.read.request` | `{ requestId, path }` |
| `file.update.request` | `{ requestId, path, content }` |
| `file.delete.request` | `{ requestId, path }` |
| `file.move.request` | `{ requestId, path, newPath }` |
| `file.rename.request` | `{ requestId, path, newName }` |
| `frontmatter.get.request` | `{ requestId, path }` |
| `frontmatter.update.request` | `{ requestId, path, data }` |
| `frontmatter.set.request` | `{ requestId, path, data }` |

### Response Events (EventBridge → Service)

| Event | Payload |
|-------|---------|
| `file.create.response` | `{ requestId, success, path, error? }` |
| `file.read.response` | `{ requestId, success, path, content?, error? }` |
| `file.update.response` | `{ requestId, success, path, error? }` |
| `file.delete.response` | `{ requestId, success, path, error? }` |
| `file.move.response` | `{ requestId, success, path, newPath?, error? }` |
| `file.rename.response` | `{ requestId, success, path, newPath?, error? }` |
| `frontmatter.get.response` | `{ requestId, success, path, data?, error? }` |
| `frontmatter.update.response` | `{ requestId, success, path, data?, error? }` |
| `frontmatter.set.response` | `{ requestId, success, path, error? }` |

### File Notification Events (Obsidian → EventBridge → Services)

These are emitted by the EventBridge when Obsidian reports external changes — they are **not** triggered by FileSystemClient requests:

| Event | Payload |
|-------|---------|
| `file.created` | `{ path, source }` |
| `file.modified` | `{ path, source }` |
| `file.deleted` | `{ path, source }` |
| `file.renamed` | `{ oldPath, newPath, source }` |

`source` is a `FileChangeSource`: `"user" | "obsidian" | "sync" | "plugin" | "unknown"`.

---

## Usage Examples

### Basic CRUD

```typescript
const client = new FileSystemClient({ eventBus });

// Create
await client.createFile("notes/meeting.md", "# Meeting Notes\n\n");

// Read
const content = await client.readFile("notes/meeting.md");

// Update
await client.updateFile("notes/meeting.md", content + "\n- Action item 1");

// Delete
await client.deleteFile("notes/meeting.md");
```

### Move and Rename

```typescript
// Move to a different folder (returns new path)
const newPath = await client.moveFile("notes/draft.md", "archives/draft.md");

// Rename in same folder (returns new path)
const renamed = await client.renameFile("archives/draft.md", "2026-02-draft.md");
```

### Frontmatter

```typescript
// Read frontmatter
const fm = await client.getFrontmatter("projects/alpha.md");
// → { status: "active", tags: ["project"] }

// Merge new fields (existing fields preserved)
const updated = await client.updateFrontmatter("projects/alpha.md", {
  status: "completed",
  completedAt: new Date().toISOString(),
});
// → { status: "completed", tags: ["project"], completedAt: "2026-02-09T..." }

// Replace entire frontmatter (existing fields removed)
await client.setFrontmatter("projects/alpha.md", {
  title: "Alpha (Archived)",
  archived: true,
});
// → { title: "Alpha (Archived)", archived: true }
```

### Concurrent Operations

Each request has its own `requestId`, so multiple calls can run in parallel:

```typescript
const [a, b, c] = await Promise.all([
  client.readFile("notes/a.md"),
  client.readFile("notes/b.md"),
  client.readFile("notes/c.md"),
]);
```

### Custom Timeout

```typescript
// Large file — give it more time
await client.createFile("data/export.csv", largeContent, {
  timeout: 30000,  // 30 seconds
});
```

### Error Recovery

```typescript
async function safeRead(path: string, fallback = ""): Promise<string> {
  try {
    return await client.readFile(path, { timeout: 2000 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("timed out")) {
      console.warn(`Read timed out for ${path}, using fallback`);
    }
    return fallback;
  }
}
```

### Creating Files with Folders

```typescript
// Parent folders created automatically
await client.createFile("03 - Resources/Templates/Daily Note.md", "# {{date}}", {
  createFolders: true,
});
```

---

## Listening to File Notifications

The EventBridge forwards Obsidian vault events as notifications. Use these to react to external changes (user edits, sync, File Explorer):

```typescript
eventBus.on("file.created", (e) => {
  console.log(`New file: ${e.payload.path} (source: ${e.payload.source})`);
});

eventBus.on("file.renamed", (e) => {
  console.log(`Renamed: ${e.payload.oldPath} → ${e.payload.newPath}`);
});

eventBus.on("metadata.changed", (e) => {
  console.log(`Frontmatter updated: ${e.payload.path}`, e.payload.frontmatter);
});
```

---

## Instantiation

The FileSystemClient is not registered in the ServiceContainer as a standalone service. It is created inside the `installerService` factory in `infrastructure/services/registry.ts`:

```typescript
{
  id: "installerService",
  dependencies: ["userService"],
  factory: async (container: IServiceContainer) => {
    const eventBus = container.getEventBus();
    const fileSystem = new FileSystemClient({ eventBus });
    // ...
    return service;
  },
}
```

Any service that needs file operations can create its own instance — only the `eventBus` is required. The EventBridge must be registered first (Phase 1) so that request events have a handler.

---

## Testing

### Testing with a Mock FileSystemClient

Services that depend on `IFileSystemClient` can be tested without the EventBus or EventBridge:

```typescript
import { vi } from "vitest";
import type { IFileSystemClient } from "../infrastructure/filesystem/types";

function createMockFileSystem(): IFileSystemClient {
  return {
    createFile: vi.fn(),
    readFile: vi.fn(async () => ""),
    updateFile: vi.fn(),
    deleteFile: vi.fn(),
    moveFile: vi.fn(async (_p, newPath) => newPath),
    renameFile: vi.fn(async (_p, newName) => newName),
    getFrontmatter: vi.fn(async () => ({})),
    updateFrontmatter: vi.fn(async () => ({})),
    setFrontmatter: vi.fn(),
  } as IFileSystemClient;
}
```

### Testing the Request/Response Flow

To test the EventBridge side (how requests map to Obsidian API calls), use the pattern from `EventBridge.test.ts`:

```typescript
import { EventBus } from "../EventBus";
import { EventBridge } from "../EventBridge";
import type { RequestId } from "../events";

const eventBus = new EventBus();
const mockApp = createMockApp(); // mock vault, fileManager, metadataCache

const bridge = new EventBridge({
  app: mockApp as never,
  eventBus,
  logger,
  registerEvent: vi.fn(),
});
bridge.register();

// Emit request, assert Obsidian API called, assert response emitted
const handler = vi.fn();
eventBus.on("file.create.response", handler);

await eventBus.emit("file.create.request", {
  requestId: "req-1" as RequestId,
  path: "test.md",
  content: "# Hello",
});

expect(mockApp.vault.create).toHaveBeenCalledWith("test.md", "# Hello");
expect(handler).toHaveBeenCalledWith(
  expect.objectContaining({
    payload: expect.objectContaining({
      requestId: "req-1",
      success: true,
    }),
  }),
);
```

### Testing Error Scenarios

```typescript
mockApp.vault.create.mockRejectedValue(new Error("File already exists"));

await eventBus.emit("file.create.request", {
  requestId: "req-2" as RequestId,
  path: "existing.md",
  content: "",
});

expect(handler).toHaveBeenCalledWith(
  expect.objectContaining({
    payload: expect.objectContaining({
      success: false,
      error: expect.objectContaining({
        code: "FILE_CREATE_FAILED",
        message: "File already exists",
      }),
    }),
  }),
);
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Event-based, not direct API** | Services stay decoupled from Obsidian and are fully unit-testable with a mock EventBus |
| **Wildcard listener for correlation** | Single pattern works for all 9 operation types; listener is temporary (removed after match) |
| **Branded `RequestId` type** | Compile-time safety prevents accidentally passing a plain string as a correlation ID |
| **5000 ms default timeout** | Reasonable for local file I/O; long operations override per-call |
| **No retry logic** | Caller decides retry strategy — keeps the client simple and predictable |
| **`createFolders` on create only** | Other operations expect the file to already exist; folder creation is a creation-time concern |
