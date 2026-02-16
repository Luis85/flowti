---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: done
related_events:
  - file.create.request
  - file.create.response
  - file.read.request
  - file.read.response
  - file.update.request
  - file.update.response
  - file.delete.request
  - file.delete.response
  - file.move.request
  - file.move.response
  - file.rename.request
  - file.rename.response
  - frontmatter.get.request
  - frontmatter.get.response
  - frontmatter.update.request
  - frontmatter.update.response
  - frontmatter.set.request
  - frontmatter.set.response
maturity: L5
business_value: 5
implementation_cost: 3
maintenance_cost: 2
discovery_cost: 1
design_cost: 2
test_cost: 2
priority: 0
---

# File System PRD

> Architecture reference: [[File System]]

---

## 1. Problem Statement

Services in Flowti need to perform file and frontmatter operations (create, read, update, delete, move, rename, get/set frontmatter) but must not import from the Obsidian API directly. Without a decoupled file system abstraction, every service would depend on `Vault`, `FileManager`, and `MetadataCache`, making unit testing require full Obsidian mocking and coupling the architecture to a single platform.

---

## 2. Outcome

The FileSystemClient provides a promise-based facade for all file and frontmatter operations. It uses an event-driven request/response pattern with requestId correlation, enabling services to perform file I/O through the EventBus without any Obsidian imports. Concurrent operations are fully supported via unique request IDs, and timeout handling prevents indefinite hangs. Services are fully unit-testable with a simple mock interface.

---

## 3. Scope

### In Scope
- 6 file operations: `createFile`, `readFile`, `updateFile`, `deleteFile`, `moveFile`, `renameFile`
- 3 frontmatter operations: `getFrontmatter`, `updateFrontmatter` (merge), `setFrontmatter` (replace)
- Branded `RequestId` (UUID v4) for compile-time type safety
- Wildcard listener pattern for request/response correlation
- Configurable timeout (per-operation, per-instance, or 5000ms default)
- `createFolders` option for automatic parent directory creation
- `IFileSystemClient` interface for mock injection in tests

### Out of Scope
- Retry logic (caller decides retry strategy)
- Batch file operations
- File watching or change detection (handled by EventBridge)
- Binary file support
- Direct Obsidian API access

---

## 4. UX Entry Points

The FileSystemClient has no direct UI. It is consumed by services internally:
- **InstallerService**: creates PARA folder structure with `.gitkeep` files via `createFolders: true`
- **Event Catalog**: creates/deletes documentation files (Domain, Service, Flow, System, Actor, Product docs)
- **ImportService**: creates vault notes from CSV data
- **ExportService**: creates export files in the vault
- **DataExchangeService**: reads and writes configuration state

---

## 5. Functional Requirements

- [x] `createFile(path, content, options?)` emits `file.create.request` and resolves on `file.create.response`
- [x] `readFile(path, options?)` emits `file.read.request` and resolves with file content string
- [x] `updateFile(path, content, options?)` emits `file.update.request` and resolves on success response
- [x] `deleteFile(path, options?)` emits `file.delete.request` and resolves on success response
- [x] `moveFile(path, newPath, options?)` emits `file.move.request` and resolves with new path
- [x] `renameFile(path, newName, options?)` emits `file.rename.request` and resolves with new path
- [x] `getFrontmatter(path, options?)` returns frontmatter as `Record<string, unknown>` (empty object if none)
- [x] `updateFrontmatter(path, data, options?)` merges data into existing frontmatter (like Object.assign)
- [x] `setFrontmatter(path, data, options?)` replaces entire frontmatter (clears existing keys first)
- [x] Each request carries a branded `RequestId` (UUID v4) for correlation
- [x] Wildcard listener filters by response event type + matching requestId
- [x] Timeout rejects the promise after configurable duration (operation > instance > 5000ms default)
- [x] `createFolders: true` creates parent directories before file creation
- [x] Failed responses reject with error message from `FileOperationError`
- [x] Wildcard listener and timeout are cleaned up on both success and failure

---

## 6. Data Model Impact

| Entity | Key Fields |
|--------|-----------|
| `RequestId` | Branded string type (UUID v4) |
| `CreateFileOptions` | `createFolders?: boolean`, `timeout?: number` |
| `FileOperationOptions` | `timeout?: number` |
| `FileResponseBase` | `requestId`, `success`, `path` |
| `FileOperationError` | `code`, `message`, `path` |
| `IFileSystemClient` | Interface with 9 methods for mock injection |

---

## 7. Event Impact

### Produced
- `file.create.request`, `file.read.request`, `file.update.request`, `file.delete.request`, `file.move.request`, `file.rename.request`
- `frontmatter.get.request`, `frontmatter.update.request`, `frontmatter.set.request`

### Consumed
- `file.create.response`, `file.read.response`, `file.update.response`, `file.delete.response`, `file.move.response`, `file.rename.response`
- `frontmatter.get.response`, `frontmatter.update.response`, `frontmatter.set.response`
- All responses consumed via wildcard (`*`) listener filtered by type + requestId

---

## 8. UI Layout Impact

None. The FileSystemClient is an infrastructure component with no UI surface. Services that use it may have their own UI (e.g., ImportModal, ExportModal, Event Catalog).

---

## 9. Adapter Impact

- FileSystemClient is the client-side of the request/response pattern
- EventBridge is the server-side adapter that translates requests to Obsidian Vault API calls
- The two components are fully decoupled -- connected only through EventBus events
- Any service can create its own FileSystemClient instance; only `eventBus` is required
- The EventBridge must be registered first (Phase 1) so request events have a handler

---

## 10. Non-Functional Requirements

- Concurrent operations supported via unique requestId per call (`Promise.all()` works correctly)
- 5000ms default timeout is reasonable for local file I/O; long operations can override per-call
- No retry logic in the client -- keeps it simple and predictable; callers decide retry strategy
- Branded `RequestId` type prevents accidentally passing plain strings as correlation IDs
- `IFileSystemClient` interface enables zero-cost mocking in tests (no EventBus needed)
- Wildcard listener is temporary -- removed immediately after response match or timeout

---

## 11. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Response never arrives (EventBridge not registered) | Low | High | Timeout rejects promise after configured duration |
| Multiple responses for same requestId | Very Low | Medium | First response wins; listener unsubscribes immediately |
| Wildcard listener leak on unhandled rejection | Low | Medium | Both timeout and response paths clean up listener |
| Large file operations exceed timeout | Medium | Medium | Per-operation timeout override available |
| RequestId collision (UUID v4) | Negligible | High | UUID v4 collision probability is astronomically low |

---

## 12. Acceptance Criteria

- [x] All 6 file operations emit correct request events and resolve/reject based on response
- [x] All 3 frontmatter operations work correctly (get returns object, update merges, set replaces)
- [x] `createFolders: true` creates parent directories before file creation
- [x] Each request has a unique branded RequestId (UUID v4)
- [x] Concurrent operations resolve independently via requestId correlation
- [x] Timeout rejects the promise with descriptive error message
- [x] Failed responses reject with error message from structured error codes
- [x] Wildcard listener and timeout are cleaned up on both success and failure paths
- [x] `IFileSystemClient` can be mocked for unit testing without EventBus or EventBridge
- [x] Root-level file renames compute correct new path (no leading slash)

---

## 13. Definition of Done

The File System feature is done when all 9 operations (6 file + 3 frontmatter) work correctly through the EventBus request/response pattern, concurrent operations resolve independently, timeouts prevent indefinite hangs, and the `IFileSystemClient` interface enables simple mocking. All tests pass and `npm run build` succeeds. No service in the codebase calls the Obsidian Vault API directly.
