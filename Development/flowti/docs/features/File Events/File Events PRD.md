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
  - metadata.changed
  - metadata.resolved
maturity: L4
business_value: 4
implementation_cost: 3
maintenance_cost: 2
discovery_cost: 2
design_cost: 2
test_cost: 3
priority: 0
---

# File Events PRD

> Architecture reference: [[File Events]]

---

## 1. Problem Statement

Services in Flowti need to react to file and folder changes in the vault (creation, modification, deletion, renaming) without coupling to the Obsidian API. Without a standardized notification layer, each service would need to register its own Obsidian vault listeners, creating duplication, inconsistent behavior, and making unit testing require full platform mocking. Additionally, event-file changes need special handling to emit semantic events alongside standard file notifications.

---

## 2. Outcome

File Events provide a unified notification layer for all vault changes. Three categories of events -- file notifications, folder notifications, and event-file notifications -- are emitted through the EventBus by the EventBridge. Services subscribe to the events they care about without touching the Obsidian API. The `FileChangeSource` field enables future differentiation between user edits, sync operations, and plugin-initiated changes.

---

## 3. Scope

### In Scope
- 4 file notification events: `file.created`, `file.modified`, `file.deleted`, `file.renamed`
- 3 folder notification events: `folder.created`, `folder.deleted`, `folder.renamed`
- 1 event-file notification: `event.file.triggered`
- 2 metadata events: `metadata.changed`, `metadata.resolved`
- `FileChangeSource` type on all file and folder event payloads
- TFile/TFolder dispatch: files and folders emit distinct event types
- Deferred event-file creation detection via pending-set handoff
- Standard file event always emitted before event-file notification

### Out of Scope
- `folder.modified` (folders have no content to modify)
- FileChangeSource differentiation beyond `"obsidian"` (future extension)
- File content in event payloads (only path and source are included)
- Request/response file operations (handled by File System feature)

---

## 4. UX Entry Points

File Events have no direct UI. They are consumed by services:
- **IngestionService**: listens to `file.created`/`file.modified` for batch processing
- **SubscriptionService**: wildcard listener checks events against enabled subscriptions
- **EventDefinitionService**: listens to `ingestion.job.completed` (downstream of file events)
- **Event Catalog**: displays file event types in the "File Notifications" and "Folder Notifications" categories
- **Debug logging**: LoggerService wildcard listener traces all file events

---

## 5. Functional Requirements

- [x] `file.created` emitted when a new TFile is added to the vault with `{ path, source }` payload
- [x] `file.modified` emitted when TFile content changes with `{ path, source }` payload
- [x] `file.deleted` emitted when a TFile is removed with `{ path, source }` payload
- [x] `file.renamed` emitted when a TFile path changes with `{ oldPath, newPath, source }` payload
- [x] `folder.created` emitted when a new TFolder is added with `{ path, source }` payload
- [x] `folder.deleted` emitted when a TFolder is removed with `{ path, source }` payload
- [x] `folder.renamed` emitted when a TFolder path changes with `{ oldPath, newPath, source }` payload
- [x] No `folder.modified` event (folders have no content)
- [x] `event.file.triggered` emitted when a file with `type: "Event"` frontmatter changes
- [x] `metadata.changed` emitted when Obsidian re-parses a file's metadata, includes frontmatter object
- [x] `metadata.resolved` emitted when all metadata references are resolved (after startup or bulk ops)
- [x] TFile and TFolder events are dispatched as distinct types from the same vault listeners
- [x] Non-TFile/TFolder abstract files are ignored
- [x] All file/folder events use `"obsidian"` as the source value
- [x] Standard `file.*` event always fires before `event.file.triggered` for the same vault action

---

## 6. Data Model Impact

| Entity | Key Fields |
|--------|-----------|
| File notification payload | `path: string`, `source: FileChangeSource` |
| File renamed payload | `oldPath: string`, `newPath: string`, `source: FileChangeSource` |
| Folder notification payload | `path: string`, `source: FileChangeSource` |
| Folder renamed payload | `oldPath: string`, `newPath: string`, `source: FileChangeSource` |
| Event-file payload | `eventName: string`, `path: string`, `action: "created" \| "modified" \| "deleted" \| "renamed"` |
| Metadata changed payload | `path: string`, `frontmatter: Record<string, unknown> \| undefined` |
| `FileChangeSource` | `"user" \| "obsidian" \| "sync" \| "plugin" \| "unknown"` |

---

## 7. Event Impact

### Produced
- `file.created`, `file.modified`, `file.deleted`, `file.renamed`
- `folder.created`, `folder.deleted`, `folder.renamed`
- `event.file.triggered`
- `metadata.changed`, `metadata.resolved`

### Consumed
- Obsidian `vault.on("create")`, `vault.on("modify")`, `vault.on("delete")`, `vault.on("rename")`
- Obsidian `metadataCache.on("changed")`, `metadataCache.on("resolved")`

---

## 8. UI Layout Impact

None. File Events are infrastructure-only notifications. They appear in the Event Catalog under "File Notifications", "Folder Notifications", and "Event-File Notifications" categories for documentation purposes.

---

## 9. Adapter Impact

- EventBridge is the sole adapter that translates Obsidian vault/metadata events into File Events
- Obsidian event refs registered via `registerEvent()` for automatic cleanup on plugin unload
- File event notifications are fire-and-forget (`void this.eventBus.emit(...)`)
- No additional adapters needed; all consumers use EventBus subscriptions

---

## 10. Non-Functional Requirements

- Fire-and-forget emission: vault/metadata notifications do not block the emitting listener
- Zero overhead for non-event files: frontmatter cache lookup is O(1)
- Event ordering: type-specific handlers fire before wildcard handlers
- All file events include `source` field for future change-origin differentiation
- Pending-set handoff for created event-files is deterministic (no timestamp heuristics)

---

## 11. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Metadata cache cleared before delete listener | High | Low | Best-effort detection; documented limitation |
| Vault create fires before cache populated | High | High | Pending-set handoff between vault.create and metadataCache.changed |
| Rapid vault events cause handler ordering issues | Medium | Low | Sequential handler execution in EventBus guarantees ordering |
| Non-TFile/TFolder abstract files passed to listeners | Low | None | Type check dispatches only TFile and TFolder; others ignored |
| FileChangeSource always "obsidian" limits filtering | Medium | Low | Future extension planned; source field already in payload |

---

## 12. Acceptance Criteria

- [x] All 4 file notification events emit correct payloads with path and source
- [x] All 3 folder notification events emit correct payloads; no `folder.modified` exists
- [x] `event.file.triggered` emits for files with `type: "Event"` frontmatter on create, modify, rename
- [x] Created event-files are detected via deferred metadata cache handoff
- [x] `metadata.changed` includes frontmatter object; non-TFile changes are ignored
- [x] `metadata.resolved` emits with empty payload after cache resolution
- [x] TFile events emit `file.*` types; TFolder events emit `folder.*` types from same vault listeners
- [x] Standard file event fires before event-file notification for the same vault action
- [x] All file/folder events include `FileChangeSource` field (currently `"obsidian"`)
- [x] Files synced via external tools are detected the same as locally created files

---

## 13. Definition of Done

File Events is done when all 11 notification events (4 file + 3 folder + 1 event-file + 2 metadata + 1 resolved) are emitted correctly by the EventBridge, the pending-set handoff for created event-files is deterministic, TFile and TFolder events are dispatched as distinct types, and all consuming services (IngestionService, SubscriptionService, Event Catalog) can react to vault changes without Obsidian API imports. All tests pass and `npm run build` succeeds.
