---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: done
related_events:
  - file.created
  - file.modified
  - file.deleted
  - file.renamed
  - folder.created
  - folder.deleted
  - folder.renamed
  - event.file.triggered
  - workspace.leaf-changed
  - workspace.file-opened
  - workspace.layout-changed
  - metadata.changed
  - metadata.resolved
  - file.create.request
  - file.create.response
  - frontmatter.get.request
  - frontmatter.get.response
maturity: L5
---

# Event Bridge PRD

> Architecture reference: [[Event Bridge]]

---

## 1. Problem Statement

Services in Flowti IBDE must never import directly from the Obsidian API to remain decoupled and unit-testable. Without a translation layer, every service that needs file operations, workspace awareness, or metadata access would depend directly on Obsidian's `App`, `Vault`, `FileManager`, and `MetadataCache` classes, making them impossible to test in isolation and tightly coupling the entire codebase to a single platform.

---

## 2. Outcome

A single component -- the EventBridge -- serves as the sole contact point between Flowti and the Obsidian API. It translates platform events into internal EventBus events and handles file/frontmatter requests from services. Services remain fully decoupled, testable with mock EventBus instances, and unaware of the underlying platform. The bridge handles five categories of events covering vault notifications, workspace notifications, metadata notifications, file system requests, and frontmatter requests.

---

## 3. Scope

### In Scope
- Vault event translation: TFile create/modify/delete/rename to `file.*` events
- Vault event translation: TFolder create/delete/rename to `folder.*` events
- Event-file detection: files with `type: "Event"` frontmatter emit `event.file.triggered`
- Workspace event translation: active-leaf-change, file-open, layout-change
- Metadata event translation: cache changed, cache resolved
- File system request/response: 6 operations (create, read, update, delete, move, rename)
- Frontmatter request/response: 3 operations (get, update, set)
- Dual cleanup strategy: EventBus unsubscribers + Obsidian registerEvent refs
- Pending-set handoff for created file detection (vault.create fires before cache is populated)

### Out of Scope
- Direct service access to Obsidian API (by design)
- FileChangeSource differentiation beyond `"obsidian"` (future)
- Binary file handling
- Vault-level locking or transaction support

---

## 4. UX Entry Points

The EventBridge has no direct UI. It operates transparently as infrastructure:
- Services receive vault/workspace/metadata notifications via EventBus subscriptions
- Services perform file/frontmatter operations via the FileSystemClient (which uses EventBridge under the hood)
- Debug visibility through event trace logging (LoggerService wildcard listener)

---

## 5. Functional Requirements

- [x] Register Obsidian vault listeners for create, modify, delete, rename on both TFile and TFolder
- [x] Dispatch TFile events as `file.*` and TFolder events as `folder.*` with correct payloads
- [x] Detect event-files (`type: "Event"` in frontmatter) and emit `event.file.triggered`
- [x] Handle deferred event-file detection for newly created files via pending-set handoff
- [x] Derive event name from frontmatter `name` or from filename (lowercase, dots for spaces)
- [x] Register workspace listeners for active-leaf-change, file-open, layout-change
- [x] Extract file info from workspace leaf when available, emit `null` when no file
- [x] Register metadata cache listeners for changed and resolved events
- [x] Include frontmatter object in `metadata.changed` payload
- [x] Handle 6 file system request/response pairs with requestId correlation
- [x] Handle 3 frontmatter request/response pairs with requestId correlation
- [x] Support `createFolders` option on file.create.request
- [x] Compute rename path from current folder + new name (handle root-level files)
- [x] Wrap every handler in try-catch; emit `success: false` response with structured error codes on failure
- [x] Clean up all EventBus subscriptions via `dispose()`
- [x] Obsidian event refs auto-cleaned via `registerEvent()` on plugin unload

---

## 6. Data Model Impact

| Entity | Key Fields |
|--------|-----------|
| `EventBridgeOptions` | `app`, `eventBus`, `logger`, `registerEvent` |
| `FileChangeSource` | `"user" \| "obsidian" \| "sync" \| "plugin" \| "unknown"` |
| `FileOperationError` | `code`, `message`, `path` |
| `FileResponseBase` | `requestId`, `success`, `path` |
| Pending-set | `Set<string>` of file paths awaiting metadata cache |

---

## 7. Event Impact

### Produced
- `file.created`, `file.modified`, `file.deleted`, `file.renamed` (vault notifications)
- `folder.created`, `folder.deleted`, `folder.renamed` (vault notifications)
- `event.file.triggered` (event-file notifications)
- `workspace.leaf-changed`, `workspace.file-opened`, `workspace.layout-changed`
- `metadata.changed`, `metadata.resolved`
- 6 `file.*.response` events, 3 `frontmatter.*.response` events

### Consumed
- 6 `file.*.request` events from FileSystemClient
- 3 `frontmatter.*.request` events from FileSystemClient
- Obsidian `vault.on(create/modify/delete/rename)`, `workspace.on(active-leaf-change/file-open/layout-change)`, `metadataCache.on(changed/resolved)`

---

## 8. UI Layout Impact

None. The EventBridge is an infrastructure-only component with no UI surface.

---

## 9. Adapter Impact

The EventBridge IS the primary adapter. It is the only component in the system that imports from `obsidian`:
- `App`, `TFile`, `TFolder`, `EventRef` from Obsidian
- All other services communicate exclusively through the EventBus
- Mock `createMockApp()` in tests replaces the real Obsidian App

---

## 10. Non-Functional Requirements

- Vault/workspace/metadata notifications are fire-and-forget (`void this.eventBus.emit(...)`)
- Request/response handlers await the response emission for correct sequencing
- Every request handler guarantees a response (success or failure) -- never leaves the caller hanging
- Structured error codes enable programmatic error routing
- 52 tests covering all handler groups, error paths, and disposal

---

## 11. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Metadata cache cleared before delete listener runs | High | Low | Best-effort detection; `event.file.triggered` not guaranteed for deletions |
| Vault create fires before frontmatter is parsed | High | High | Pending-set handoff between vault.create and metadataCache.changed |
| Request handler throws unexpectedly | Low | High | Every handler wrapped in try-catch; structured error response always emitted |
| Obsidian API changes in future versions | Low | Medium | Single adapter point; changes isolated to EventBridge |
| Multiple rapid vault events cause ordering issues | Medium | Medium | Sequential handler execution in EventBus preserves ordering |

---

## 12. Acceptance Criteria

- [x] All vault file events (create, modify, delete, rename) emit corresponding `file.*` events with correct payloads
- [x] All vault folder events emit corresponding `folder.*` events; no `folder.modified` event exists
- [x] Files with `type: "Event"` frontmatter emit `event.file.triggered` with correct eventName and action
- [x] Newly created event-files are detected via deferred metadata cache handoff
- [x] Workspace events emit correct payloads with file info when available, null otherwise
- [x] Metadata events include frontmatter object; non-TFile changes are ignored
- [x] All 6 file request/response operations work correctly with requestId correlation
- [x] All 3 frontmatter request/response operations work correctly
- [x] `createFolders: true` creates parent directories before file creation
- [x] Failed operations emit `success: false` with structured error codes
- [x] `dispose()` removes all EventBus subscriptions; Obsidian refs auto-cleaned on unload
- [x] 52 tests pass covering all handler groups

---

## 13. Definition of Done

The EventBridge is done when it is the sole Obsidian API contact point, all vault/workspace/metadata events are translated correctly, all file/frontmatter request handlers guarantee responses, the pending-set handoff reliably detects created event-files, and all 52 tests pass. No service in the codebase imports from `obsidian` directly.
