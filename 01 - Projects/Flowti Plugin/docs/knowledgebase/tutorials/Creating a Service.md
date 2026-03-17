---
stage: done
domain: Flowti/System
plugin: "[[Development/flowti/README|README]]"
actor: Obsidian Plugin Developer
---

# Tutorial: Creating a New Service

This tutorial walks you through building a complete domain service from scratch. You'll create a **BookmarkService** that saves bookmarks to storage, creates note files in the vault, and communicates with other services through events.

By the end you'll understand:

- How to define domain events
- How to implement a service with the Options pattern
- How to use the EventBus to emit and subscribe to events
- How to use the FileSystemClient to create and read files
- How to register a service in the ServiceContainer
- How to test everything with mocks

### Prerequisites

Read the [[Development/flowti/docs/features/Event System/Event System|Event System]] and [[Development/flowti/docs/features/File System/File System|File System]] feature docs for background on those systems.

---

## Step 1: Define Domain Events

Each domain owns its events. Create `src/domain/bookmark/events.ts`:

```typescript
// src/domain/bookmark/events.ts

import type { Bookmark } from "./types";

/**
 * Event types owned by the Bookmark domain.
 */
export interface BookmarkEventMap {
  /** Emitted when a bookmark is created */
  "bookmark.created": { bookmark: Bookmark };
  /** Emitted when a bookmark is deleted */
  "bookmark.deleted": { bookmarkId: string };
  /** Emitted when bookmarks are loaded from storage */
  "bookmark.loaded": { count: number };
}
```

**Key pattern:** The interface name follows the convention `<Domain>EventMap`. Each key is a dot-separated event type (`domain.action`), and the value is the payload shape. See `src/domain/user/events.ts` for a real example.

---

## Step 2: Define the Service Interface

Create `src/domain/bookmark/types.ts`:

```typescript
// src/domain/bookmark/types.ts

export interface Bookmark {
  id: string;
  title: string;
  path: string;
  createdAt: string;
}

export interface IBookmarkService {
  /** Load bookmarks from storage */
  load(): Promise<void>;
  /** Get all bookmarks */
  getAll(): Bookmark[];
  /** Add a bookmark and optionally create a note file */
  add(title: string, path: string): Promise<Bookmark>;
  /** Remove a bookmark by ID */
  remove(id: string): Promise<void>;
}
```

**Key pattern:** Define a clear interface (`IBookmarkService`) that other services and UI components depend on. The implementation is swappable and testable.

---

## Step 3: Implement the Service

Create `src/domain/bookmark/BookmarkService.ts`:

```typescript
// src/domain/bookmark/BookmarkService.ts

import type { IEventBus } from "../../infrastructure/events/types";
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import type { IStorageProvider } from "../../utils/types";
import type { Bookmark, IBookmarkService } from "./types";
import { generateUUID } from "../../utils/uuid";

export interface BookmarkServiceOptions {
  storage: IStorageProvider;
  eventBus?: IEventBus;
  fileSystem?: IFileSystemClient;
}

export class BookmarkService implements IBookmarkService {
  private bookmarks: Bookmark[] = [];
  private storage: IStorageProvider;
  private eventBus?: IEventBus;
  private fileSystem?: IFileSystemClient;

  constructor(options: BookmarkServiceOptions) {
    this.storage = options.storage;
    this.eventBus = options.eventBus;
    this.fileSystem = options.fileSystem;
  }

  // ... methods below
}
```

### Constructor & Options Pattern

Every service receives its dependencies through an **options object** — never through global imports. This is the same pattern used by `UserService`, `InstallerService`, and all other services.

Dependencies that aren't always needed (like `eventBus` and `fileSystem`) are optional. The service works without them, which makes unit testing simple.

### Loading from Storage

```typescript
async load(): Promise<void> {
  const data = (await this.storage.load()) as { bookmarks?: Bookmark[] } | null;
  if (data?.bookmarks) {
    this.bookmarks = data.bookmarks;
  }
  await this.eventBus?.emit("bookmark.loaded", {
    count: this.bookmarks.length,
  });
}
```

**Key pattern:** The `IStorageProvider` abstracts Obsidian's `loadData()`/`saveData()`. All services share the same storage object, so you must **merge** your data with existing data when saving (see `saveBookmarks()` below). This is the same pattern `UserService` uses.

### Emitting Events

```typescript
async add(title: string, path: string): Promise<Bookmark> {
  const bookmark: Bookmark = {
    id: generateUUID(),
    title,
    path,
    createdAt: new Date().toISOString(),
  };

  this.bookmarks.push(bookmark);
  await this.saveBookmarks();

  // Notify the rest of the system
  await this.eventBus?.emit("bookmark.created", { bookmark });

  return bookmark;
}

async remove(id: string): Promise<void> {
  this.bookmarks = this.bookmarks.filter((b) => b.id !== id);
  await this.saveBookmarks();

  await this.eventBus?.emit("bookmark.deleted", { bookmarkId: id });
}
```

**Key pattern:** Use `await this.eventBus?.emit(...)` with optional chaining. The `?.` ensures the service works even when no EventBus is provided (useful in tests). Events are awaited so handlers complete before the method returns.

### Working with Files via FileSystemClient

```typescript
async add(title: string, path: string): Promise<Bookmark> {
  const bookmark: Bookmark = {
    id: generateUUID(),
    title,
    path,
    createdAt: new Date().toISOString(),
  };

  // Create a note file for the bookmark
  if (this.fileSystem) {
    const content = [
      "---",
      `title: "${title}"`,
      `bookmarkId: "${bookmark.id}"`,
      `created: ${bookmark.createdAt}`,
      "---",
      "",
      `# ${title}`,
      "",
    ].join("\n");

    await this.fileSystem.createFile(path, content, { createFolders: true });
  }

  this.bookmarks.push(bookmark);
  await this.saveBookmarks();
  await this.eventBus?.emit("bookmark.created", { bookmark });

  return bookmark;
}
```

**Key pattern:** The `FileSystemClient` is a promise-based facade over the EventBus request/response pattern. You call it like any async API:

| Method | What it does |
|--------|-------------|
| `createFile(path, content, options?)` | Create a file (optionally creating parent folders) |
| `readFile(path)` | Read file content |
| `updateFile(path, content)` | Overwrite file content |
| `deleteFile(path)` | Delete a file |
| `moveFile(path, newPath)` | Move a file |
| `renameFile(path, newName)` | Rename a file |
| `getFrontmatter(path)` | Read frontmatter as an object |
| `updateFrontmatter(path, data)` | Merge fields into frontmatter |
| `setFrontmatter(path, data)` | Replace entire frontmatter |

Under the hood, `createFile()` emits a `file.create.request` event. The EventBridge picks it up, calls the Obsidian Vault API, and emits a `file.create.response`. The FileSystemClient resolves the promise. Your service never imports from `obsidian`.

The `{ createFolders: true }` option tells the EventBridge to create parent directories automatically.

### Saving to Shared Storage

```typescript
private async saveBookmarks(): Promise<void> {
  const existingData = ((await this.storage.load()) as object) || {};
  await this.storage.save({
    ...existingData,
    bookmarks: this.bookmarks,
  });
}
```

**Key pattern:** Always spread existing data before writing your own key. Multiple services share the same storage object — overwriting without merging would destroy other services' data.

### Reading All Bookmarks

```typescript
getAll(): Bookmark[] {
  return [...this.bookmarks];
}
```

Return a copy to prevent external mutation.

---

## Step 4: Register the Service

Open `src/infrastructure/services/registry.ts` and add a registration:

```typescript
import { BookmarkService } from "../../domain/bookmark/BookmarkService";
import { FileSystemClient } from "../filesystem/FileSystemClient";

// Inside createServiceRegistrations():
{
  id: "bookmarkService",
  factory: (container: IServiceContainer) =>
    new BookmarkService({
      storage,
      eventBus: container.getEventBus(),
      fileSystem: new FileSystemClient({
        eventBus: container.getEventBus(),
      }),
    }),
},
```

### With Dependencies

If your service needs another service (e.g., `UserService`), declare it:

```typescript
{
  id: "bookmarkService",
  dependencies: ["userService"],
  factory: async (container: IServiceContainer) => {
    const userService = await container.get<IUserService>("userService");
    return new BookmarkService({
      storage,
      eventBus: container.getEventBus(),
      fileSystem: new FileSystemClient({
        eventBus: container.getEventBus(),
      }),
      userService,
    });
  },
},
```

**Key pattern:** The `dependencies` array tells the `ServiceContainer` to initialize those services first. The container resolves the dependency graph in topological order and detects circular dependencies at registration time.

---

## Step 5: Wire Up in main.ts

If your service needs to run logic after the vault is ready (loading data, checking state), add it to `onLayoutReady()` in `src/main.ts`:

```typescript
private async onLayoutReady(): Promise<void> {
  try {
    // Existing services...
    this.userService = await this.services.get<IUserService>("userService");
    await this.userService.load();

    // Your new service
    const bookmarkService = await this.services.get<IBookmarkService>("bookmarkService");
    await bookmarkService.load();

    // ...
  } catch (error) {
    this.errorService.handle(
      error instanceof Error ? error : new Error(String(error)),
      "onLayoutReady"
    );
  }
}
```

**Key pattern:** `services.get<T>(id)` returns a promise because the factory might be async. Always wrap in try/catch and delegate to `errorService.handle()`.

---

## Step 6: Write Tests

Create `tests/domain/bookmark/BookmarkService.test.ts`:

### Mock Setup

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { BookmarkService } from "../../../src/domain/bookmark/BookmarkService";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { IStorageProvider } from "../../../src/utils/types";
import type { IFileSystemClient } from "../../../src/infrastructure/filesystem/types";

function createMockStorage(initialData: Record<string, unknown> = {}) {
  let data = { ...initialData };
  return {
    storage: {
      load: vi.fn(async () => data),
      save: vi.fn(async (newData: unknown) => {
        data = newData as Record<string, unknown>;
      }),
    } as IStorageProvider,
    getData: () => data,
  };
}

function createMockFileSystem(): IFileSystemClient {
  return {
    createFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(""),
    updateFile: vi.fn().mockResolvedValue(undefined),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    moveFile: vi.fn().mockResolvedValue(undefined),
    renameFile: vi.fn().mockResolvedValue(undefined),
    getFrontmatter: vi.fn().mockResolvedValue({}),
    updateFrontmatter: vi.fn().mockResolvedValue({}),
    setFrontmatter: vi.fn().mockResolvedValue({}),
  } as IFileSystemClient;
}
```

**Key pattern:** Create factory functions for mocks. Mock `IStorageProvider` with a closure over a `data` variable so you can inspect what was saved. Mock `IFileSystemClient` with `vi.fn()` stubs.

### Test Suite

```typescript
describe("BookmarkService", () => {
  let service: BookmarkService;
  let eventBus: IEventBus;
  let storage: IStorageProvider;
  let fileSystem: IFileSystemClient;
  let getData: () => Record<string, unknown>;

  beforeEach(() => {
    const mock = createMockStorage();
    storage = mock.storage;
    getData = mock.getData;
    eventBus = new EventBus();
    fileSystem = createMockFileSystem();
    service = new BookmarkService({ storage, eventBus, fileSystem });
  });

  describe("add", () => {
    it("should create a bookmark and persist it", async () => {
      const bookmark = await service.add("My Note", "bookmarks/my-note.md");

      expect(bookmark.title).toBe("My Note");
      expect(bookmark.path).toBe("bookmarks/my-note.md");
      expect(bookmark.id).toBeDefined();
      expect(service.getAll()).toHaveLength(1);
      expect(storage.save).toHaveBeenCalled();
    });

    it("should create a file via FileSystemClient", async () => {
      await service.add("My Note", "bookmarks/my-note.md");

      expect(fileSystem.createFile).toHaveBeenCalledWith(
        "bookmarks/my-note.md",
        expect.stringContaining("# My Note"),
        { createFolders: true }
      );
    });

    it("should emit bookmark.created event", async () => {
      const handler = vi.fn();
      eventBus.on("bookmark.created", handler);

      const bookmark = await service.add("My Note", "bookmarks/my-note.md");

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "bookmark.created",
          payload: { bookmark },
        })
      );
    });
  });

  describe("remove", () => {
    it("should remove a bookmark and emit event", async () => {
      const bookmark = await service.add("Test", "test.md");
      const handler = vi.fn();
      eventBus.on("bookmark.deleted", handler);

      await service.remove(bookmark.id);

      expect(service.getAll()).toHaveLength(0);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: { bookmarkId: bookmark.id },
        })
      );
    });
  });

  describe("load", () => {
    it("should load bookmarks from storage", async () => {
      const mock = createMockStorage({
        bookmarks: [
          { id: "1", title: "Saved", path: "saved.md", createdAt: "2026-01-01" },
        ],
      });
      const svc = new BookmarkService({
        storage: mock.storage,
        eventBus,
      });

      await svc.load();

      expect(svc.getAll()).toHaveLength(1);
      expect(svc.getAll()[0].title).toBe("Saved");
    });

    it("should emit bookmark.loaded event", async () => {
      const handler = vi.fn();
      eventBus.on("bookmark.loaded", handler);

      await service.load();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: { count: 0 },
        })
      );
    });
  });

  describe("shared storage", () => {
    it("should preserve other services' data when saving", async () => {
      const mock = createMockStorage({ debugMode: true, user: { name: "Test" } });
      const svc = new BookmarkService({ storage: mock.storage, eventBus });

      await svc.add("Test", "test.md");

      const saved = mock.getData();
      expect(saved.debugMode).toBe(true);
      expect(saved.user).toEqual({ name: "Test" });
      expect(saved.bookmarks).toHaveLength(1);
    });
  });

  describe("without optional dependencies", () => {
    it("should work without EventBus or FileSystemClient", async () => {
      const svc = new BookmarkService({ storage });

      const bookmark = await svc.add("Test", "test.md");

      expect(bookmark.title).toBe("Test");
      expect(svc.getAll()).toHaveLength(1);
    });
  });
});
```

### What to Test

| Category | What to Assert |
|----------|---------------|
| **State** | Service state changes after operations |
| **Persistence** | `storage.save` called with correct data |
| **Events** | `eventBus.on(...)` handler called with correct payload |
| **File ops** | `fileSystem.createFile` called with correct args |
| **Shared storage** | Other services' data not overwritten |
| **Optional deps** | Service works without EventBus/FileSystem |
| **Edge cases** | Empty input, missing data, errors |

---

## Step 7: Compose Events into FlowtiEventMap

Open `src/infrastructure/events/events.ts` and wire your events into the global type:

```typescript
// Add import at the top
import type { BookmarkEventMap } from "../../domain/bookmark/events";

// Extend FlowtiEventMap
export interface FlowtiEventMap
  extends UserEventMap, SettingsEventMap, InstallerEventMap, BookmarkEventMap {
  // Infrastructure events...
}
```

**Key pattern:** Domain events are composed via TypeScript `extends` — a compile-time-only dependency. No runtime registration needed. The EventBus is now fully type-safe for your new events.

After this, any typo or payload mismatch will be caught at compile time:

```typescript
// OK
await eventBus.emit("bookmark.created", { bookmark });

// Compile error — wrong payload
await eventBus.emit("bookmark.created", { title: "oops" });

// Compile error — unknown event
await eventBus.emit("bookmark.saved", {});
```

---

## Subscribing to Events from Other Services

Services communicate through events, never by importing each other. To react to bookmarks from another service:

```typescript
// In any other service's constructor or init
this.eventBus.on("bookmark.created", (event) => {
  console.log(`New bookmark: ${event.payload.bookmark.title}`);
});
```

To react to file changes from the vault (forwarded by the EventBridge):

```typescript
// Listen for files being created in the vault
this.eventBus.on("file.created", (event) => {
  if (event.payload.path.startsWith("bookmarks/")) {
    console.log(`Bookmark file created: ${event.payload.path}`);
  }
});

// Listen for folder changes
this.eventBus.on("folder.created", (event) => {
  console.log(`Folder created: ${event.payload.path}`);
});
```

---

## Listening for File Changes vs Making File Requests

There are two distinct file-related patterns:

| Pattern | Direction | Use Case |
|---------|-----------|----------|
| **Notification events** (`file.created`, `folder.deleted`, ...) | Obsidian → your service | React to changes made by the user or other plugins |
| **FileSystemClient** (`createFile()`, `readFile()`, ...) | Your service → Obsidian | Programmatically create/read/update/delete files |

Notifications are passive (you subscribe). FileSystemClient calls are active (you initiate).

---

## Checklist

When adding a new service, touch these files:

| # | File | Action |
|---|------|--------|
| 1 | `src/domain/<name>/events.ts` | Define `<Name>EventMap` |
| 2 | `src/domain/<name>/types.ts` | Define `I<Name>Service` interface + data types |
| 3 | `src/domain/<name>/<Name>Service.ts` | Implement the service |
| 4 | `src/infrastructure/events/events.ts` | Import and extend `FlowtiEventMap` |
| 5 | `src/infrastructure/services/registry.ts` | Add `ServiceRegistration` entry |
| 6 | `src/main.ts` | Call `load()` in `onLayoutReady()` (if needed) |
| 7 | `tests/domain/<name>/<Name>Service.test.ts` | Write tests |

---

## Reference

| Topic | Document |
|-------|----------|
| Event System (EventBus API, wildcards, type safety) | [[Development/flowti/docs/features/Event System/Event System\|Event System]] |
| Event Bridge (vault/workspace/metadata notifications) | [[Development/flowti/docs/features/Event Bridge/Event Bridge\|Event Bridge]] |
| File System Client (request/response, timeouts, errors) | [[Development/flowti/docs/features/File System/File System\|File System]] |
| Service Design Blueprint (all services, events, init phases) | [[Backend Architecture\|Service Design Blueprint]] |
| Installer (complex service with steps and file system usage) | [[Development/flowti/docs/features/Installer/Installer\|Installer]] |
