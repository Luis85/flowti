---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: done
related_events:
  - event.file.triggered
  - file.created
  - file.modified
  - file.deleted
  - file.renamed
  - metadata.changed
maturity: L4
business_value: 4
implementation_cost: 3
maintenance_cost: 2
discovery_cost: 2
design_cost: 2
test_cost: 3
priority: 0
---

# Event Files PRD

> Architecture reference: [[Event Files]]

---

## 1. Problem Statement

External systems (CI/CD pipelines, cron jobs, shell scripts, cloud sync services) need a way to trigger events inside Flowti without requiring API calls, webhooks, or plugin installations on the external side. There is no mechanism to use the vault's filesystem as an event interface, and Obsidian's native file detection does not interpret file metadata as semantic events.

---

## 2. Outcome

Any Markdown file with frontmatter `type: "Event"` becomes a trigger. When the file is created, modified, deleted, or renamed, the system emits an `event.file.triggered` event with the semantic event name, file path, and action. External tools can drop a file into the vault to trigger workflows. Event Files are regular notes that can be queried, linked, and organized like any other vault content, enabling a data-driven event catalog.

---

## 3. Scope

### In Scope
- Frontmatter convention: `type: "Event"` required, `name` optional
- Automatic event name derivation from filename (lowercase, dots for spaces)
- Detection on all vault actions: created, modified, renamed, deleted (best-effort)
- Deferred creation detection via pending-set handoff (vault.create fires before cache is populated)
- `event.file.triggered` emission with `eventName`, `path`, `action` payload
- Vault organization recommendations (dedicated `Events/` folder with subfolders)

### Out of Scope
- Arbitrary payload from file body (only name/path/action are carried)
- Multiple event types per file (single `event.file.triggered` type)
- Binary file support (must be valid Markdown with YAML frontmatter)
- Guaranteed detection on delete (cache may be cleared before listener runs)
- Workflow orchestration built on top of Event Files (separate concern)

---

## 4. UX Entry Points

- **Vault files**: any `.md` file with `type: "Event"` in frontmatter
- **File Explorer**: creating/editing/renaming/deleting event files triggers the system
- **External tools**: CI/CD pipelines, scripts, or sync services can write event files directly to disk
- **Dataview/Search**: event files are queryable via `WHERE type = "Event"`
- **Event Catalog**: `event.file.triggered` appears in the catalog as a system event

---

## 5. Functional Requirements

- [x] Files with frontmatter `type: "Event"` are detected as event files
- [x] Explicit `name` property in frontmatter is used as the event name when present
- [x] When `name` is omitted, event name is derived from filename: lowercase, spaces replaced with dots
- [x] `event.file.triggered` is emitted on file create, modify, rename, and delete (best-effort for delete)
- [x] Payload includes `eventName` (string), `path` (string), and `action` (created/modified/deleted/renamed)
- [x] Created files use deferred detection: vault.create records path in pending set, metadataCache.changed consumes it
- [x] Modified and renamed files read metadata cache immediately
- [x] Type check is case-sensitive: `"Event"` (uppercase E) required
- [x] File body content does not affect the event; it serves as human-readable context only

---

## 6. Data Model Impact

| Entity | Key Fields |
|--------|-----------|
| Event File frontmatter | `type: "Event"`, `name?: string` |
| `event.file.triggered` payload | `eventName: string`, `path: string`, `action: "created" \| "modified" \| "deleted" \| "renamed"` |
| Pending-set (internal) | `Set<string>` of file paths awaiting metadata cache population |

---

## 7. Event Impact

### Produced
- `event.file.triggered` with `{ eventName, path, action }` payload

### Consumed
- Vault events: `vault.on("create")`, `vault.on("modify")`, `vault.on("delete")`, `vault.on("rename")`
- `metadataCache.on("changed")` for deferred creation detection
- Standard `file.*` events are emitted first; `event.file.triggered` is emitted in addition

---

## 8. UI Layout Impact

None directly. Event Files are standard vault notes. The `event.file.triggered` event type appears in the Event Catalog under the "Event-File Notifications" category. Services can build notification UI, dashboards, or automation on top of this event.

---

## 9. Adapter Impact

- EventBridge handles all detection logic (part of the existing bridge, not a separate adapter)
- `metadataCache.getFileCache()` used to read frontmatter
- Pending-set handoff is internal to EventBridge (no external adapter needed)
- No additional Obsidian API imports required

---

## 10. Non-Functional Requirements

- Detection must be deterministic (no timestamp heuristics for created file handoff)
- Fire-and-forget emission: `void this.eventBus.emit(...)` for notifications
- No performance impact from checking frontmatter on every vault event (cache lookup is O(1))
- Event files work with any sync service (Obsidian Sync, iCloud, Syncthing, OneDrive, Git)

---

## 11. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Delete event missed due to cleared cache | High | Low | Documented as best-effort; services should not rely solely on delete detection |
| Malformed frontmatter (missing type) | Medium | None | File is simply ignored; no error emitted |
| Filename with special characters produces odd event names | Low | Low | Derivation uses simple lowercase + dot replacement; users can set explicit `name` |
| Sync conflict creates duplicate event files | Low | Medium | Idempotency in downstream services (IngestionService ledger) |
| Large vault with many event files | Low | Low | Cache lookup is O(1); no scanning overhead on vault events |

---

## 12. Acceptance Criteria

- [x] A file with `type: "Event"` and `name: "deploy.started"` emits `event.file.triggered` with `eventName: "deploy.started"` on creation
- [x] A file with `type: "Event"` and no `name` derives event name from filename (e.g., `Build Failed.md` -> `build.failed`)
- [x] `event.file.triggered` fires on create, modify, and rename actions
- [x] Created files are detected via deferred metadata cache handoff (not immediate)
- [x] Modified and renamed files read cache immediately and emit without delay
- [x] Files without `type: "Event"` frontmatter do not emit `event.file.triggered`
- [x] The standard `file.*` event is always emitted before `event.file.triggered`
- [x] External file sync (e.g., OneDrive) triggers detection the same as local creation
- [x] 13 tests pass covering all detection paths and edge cases

---

## 13. Definition of Done

Event Files is done when any Markdown file with `type: "Event"` frontmatter reliably triggers `event.file.triggered` on creation, modification, and rename. The deferred creation detection via pending-set handoff is deterministic. All 13 tests pass, the feature integrates with the EventBridge and Event Catalog, and external tools can trigger events by simply writing a file to the vault.
