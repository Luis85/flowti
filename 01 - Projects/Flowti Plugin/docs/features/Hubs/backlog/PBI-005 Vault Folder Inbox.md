---
type: ProductBacklogItem
feature: "[[Hubs PRD]]"
stage: planned
priority: high
phase: 5
planned_in: "[[Cycle 12 - User Hub Inbox]]"
estimated_loc: 380
estimated_tests: 35
dependencies:
  - "[[PBI-001 User Hub]]"
tags:
  - inbox
  - capture
  - data-quality
user_story: "[[I want to connect the User Hub Inbox with a vault folder]]"
related:
  - "[[PBI-QC-001 Quick Capture Ribbons]]"
  - "[[I want my files in the inbox routed to the correct folder once they are typed]]"
  - "[[Phase 3 Inc 2 - Inbox Population]]"
  - "[[Phase 3 Inc 3 - Inbox UX and Source Config]]"
note: "Extends the existing inbox (6 event-driven sources) with a 7th source type: vault folder watching. Bridges capture (Quick Capture) and organization (typed, routed notes). Synergistic with PBI-QC-001 but not blocking — works with any note creation method."
---

# PBI-005: Vault Folder Inbox

## User Story — Problem Space

As a knowledge worker using Flowti, I want the User Hub Inbox to watch configured vault folders and surface untyped notes so that I can triage incoming captures inline — setting type and description — and start every note's data quality journey from a single workspace.

### User Pains

- Notes captured quickly (via Quick Capture, manual creation, or external tools) land in vault folders but are invisible to the inbox — they have no frontmatter, no type, no connection to the knowledge graph
- The current inbox only shows event-driven notifications (subscription matches, import/export results). There is no way to see "raw" unprocessed notes that need attention
- Discovering untyped notes requires manually browsing folder trees or running searches — breaks flow and adds cognitive overhead
- Without a triage interface, notes accumulate in inbox folders indefinitely, becoming a graveyard instead of a processing queue
- The gap between "capture" ([[Quick capture ribbons for ideas and feedback]]) and "organization" (typed, routed notes) has no bridge — users must context-switch to manually open each note and add frontmatter

### User Needs

- **Folder watching**: Configure one or more vault folders (with optional recursive mode) that the inbox monitors for new or untyped notes
- **Automatic surfacing**: When a note appears in a watched folder without frontmatter (or with empty type), it shows up as an inbox item
- **Inline triage**: Edit type and description directly in the inbox detail panel — no need to navigate to the file
- **Mark as read**: Single action that applies a note template's frontmatter properties, completing the initial data quality step
- **Target folder**: All notes processed through the primary inbox folder go to exactly one configured target folder
- **Inbox Zero**: Once a note is typed and marked as read, it disappears from the inbox — the inbox is a processing queue, not a permanent view
- **Source configuration**: Enable/disable folder watching per folder, consistent with existing inbox source toggles in Settings

---

## Solution Statement

### Use Cases

**UC-1: Triage a quick-captured note**
1. User clicks "Add Idea" ribbon → note created in `00 - Inbox/inbox/` with title only
2. InboxService detects new file in watched folder via `file.created` event
3. Note appears in User Hub Inbox as unread item with title and "Vault Folder" source badge
4. User clicks the item → detail panel shows title, type dropdown, description field
5. User sets type to "idea", enters a one-line description
6. User clicks "Mark as Read" → frontmatter template applied, note moved to target folder
7. Item disappears from inbox

**UC-2: Catch empty notes from other folders**
1. User has a second watched folder: `01 - Now/Project-X/notes/`
2. A note `meeting-recap.md` is created with only a title
3. InboxService detects the note (empty frontmatter) and surfaces it in the inbox
4. User triages it by setting type to "meeting" and marking as read
5. Frontmatter properties are written to the file in-place (no move — only the primary inbox folder routes to a target)

**UC-3: Recursive folder watching**
1. User configures `docs/inbox/` with recursive watching enabled
2. A note is created in `docs/inbox/signals/new-idea.md`
3. InboxService detects it via recursive watch and surfaces it in the inbox
4. User triages as normal

### Gherkin

```gherkin
Scenario: New note in watched folder appears in inbox
  Given the inbox is configured to watch "00 - Inbox/inbox/"
  And a new note "Quick thought.md" is created in that folder with no frontmatter
  When InboxService processes the file.created event
  Then a new inbox item appears with title "Quick thought" and source "Vault Folder"
  And the inbox unread count increments by 1

Scenario: Mark as read applies template frontmatter and routes to target
  Given an inbox item from the primary watched folder with type set to "idea"
  When the user clicks "Mark as Read"
  Then the note receives frontmatter properties from the configured note template
  And the note is moved to the configured target folder
  And the inbox item is removed

Scenario: Typed note auto-dismissed from inbox
  Given a note in a watched folder already has a non-empty "type" frontmatter
  When InboxService scans the folder
  Then the note does not appear in the inbox

Scenario: Secondary watched folder triages in-place
  Given the inbox watches a secondary folder "01 - Now/notes/"
  And a new note appears with empty frontmatter
  When the user marks it as read from the inbox
  Then frontmatter is applied to the note in-place
  And the note remains in its original folder (no routing)
```

### Functional Requirements

- [ ] `mapVaultFolderNote`: Pure mapper function (file metadata → InboxItem) — follows pattern of existing 6 mappers in `src/domain/inbox/mappers.ts`
- [ ] `INBOX_SOURCE_DEFINITIONS` extended with `vaultFolder` source entry — 7th source alongside subscription, import completed/failed, export completed, pipeline completed/failed
- [ ] InboxService registers `file.created` and `file.modified` event listeners filtered by configured watched folder paths
- [ ] Notes with empty or missing `type` frontmatter in watched folders create inbox items; notes with existing `type` are excluded
- [ ] Settings: configure watched folders — add/remove paths, toggle recursive per folder
- [ ] Settings: configure target folder for primary inbox routing
- [ ] Per-source toggle for vault folder watching in Settings → Inbox — consistent with existing 6 source toggles
- [ ] Inbox detail panel shows type dropdown and description field for vault folder items — extends current read-only detail view
- [ ] "Mark as Read" applies configured note template frontmatter to the file via DocService
- [ ] "Mark as Read" on primary inbox folder items moves the note to the target folder via FileSystemClient
- [ ] "Mark as Read" on secondary watched folder items applies frontmatter in-place (no move)
- [ ] Source badge shows "Vault Folder" for folder-sourced items
- [ ] Inbox item removed after mark-as-read

### Technical Requirements

- Extend `InboxService` (existing `src/domain/inbox/InboxService.ts`, ~200 LOC) — do not create a new service
- New mapper follows pure function pattern (no side effects, unit-testable in isolation)
- Path filtering reuses existing event path matching from subscription system where applicable
- Folder watcher configuration stored via existing `SettingsService` alongside `inboxEnabledSources`
- Frontmatter application via `DocService.updateFrontmatter()` or equivalent existing method
- File move via `FileSystemClient.move()` — existing infrastructure
- Events registered in catalog with category "Inbox"

### Constraints

- Must not trigger on `.obsidian/`, `node_modules/`, or other system folders — default exclusion list
- Must not create duplicate inbox items for the same file (dedup by file path)
- Folder watching must be event-driven (react to `file.created`/`file.modified`), not interval-based polling
- Inbox item cap (existing 500-item limit) applies across all sources including vault folder items
- Must not break existing 6 inbox source behaviors

---

## Increments

### Increment 1: Folder Watcher Core (~200 LOC, ~20 tests)

**Scope**: Detection and surfacing of untyped notes from watched folders.

- `mapVaultFolderNote` mapper function
- InboxService extension: listen to `file.created`/`file.modified` filtered by watched folder paths
- `INBOX_SOURCE_DEFINITIONS` extended with `vaultFolder` entry
- Settings UI: configure watched folders (add/remove paths, recursive toggle per folder)
- Per-source toggle for vault folder watching
- Source badge "Vault Folder" on inbox items
- Notes with empty/missing `type` appear; notes with existing `type` excluded

**Gate**: Untyped note created in watched folder → appears in inbox with correct source badge.

### Increment 2: Triage & Routing (~180 LOC, ~15 tests)

**Scope**: Inline editing and mark-as-read workflow with file routing.

- Inline type dropdown and description field in inbox detail panel for vault folder items
- "Mark as Read" applies note template frontmatter via DocService
- "Mark as Read" on primary inbox items: move note to configured target folder
- "Mark as Read" on secondary watched folder items: apply frontmatter in-place
- Settings UI: configure target folder
- Inbox item removed after triage

**Gate**: Full triage flow — capture → surface → type → mark read → note moved with frontmatter → item gone.

---

## INVEST Assessment

| Criterion | Met? | Notes |
|-----------|------|-------|
| Independent | Yes | Extends existing InboxService. Works without Quick Capture (any note creation method triggers it). No hard dependency on PBI-QC-001 |
| Negotiable | Yes | Increment split allows delivering detection without triage UI. Secondary folder watching could be deferred |
| Valuable | Yes | Bridges capture-to-organization gap. Enables Inbox Zero workflow. Directly serves dogfooding goal |
| Estimable | Yes | ~380 LOC total, ~35 tests. Existing inbox infrastructure (Inc 2-4) provides clear reference for estimation |
| Small | Yes | 2 increments, each deliverable in a single development session. Extends existing domain rather than creating new one |
| Testable | Yes | Pure mapper function unit-testable. Gherkin scenarios map directly to integration tests. Build gate: `npm run build` |

---

## Events

| Event | Category | Direction | Payload |
|-------|----------|-----------|---------|
| `inbox.vaultFolder.noteDetected` | Inbox | Produced | `{ path: string, title: string, hasType: boolean }` |
| `inbox.vaultFolder.noteTriaged` | Inbox | Produced | `{ path: string, type: string, targetPath: string }` |
| `file.created` | File Events | Consumed | `{ path: string }` |
| `file.modified` | File Events | Consumed | `{ path: string }` |
| `inbox.itemAdded` | Inbox | Produced | `{ item: InboxItem }` (existing) |
| `inbox.itemsChanged` | Inbox | Produced | `{ items: InboxItem[] }` (existing) |

---

## Acceptance Criteria

- [ ] Settings UI: configure watched folders (add/remove paths, toggle recursive per folder)
- [ ] Settings UI: configure target folder for primary inbox routing
- [ ] InboxService registers a new source type: `vaultFolder`
- [ ] `INBOX_SOURCE_DEFINITIONS` extended with vault folder source entry
- [ ] Mapper function `mapVaultFolderNote` creates InboxItem from file metadata
- [ ] Inbox listens to `file.created` and `file.modified` events filtered by watched folder paths
- [ ] Notes with empty or missing `type` frontmatter in watched folders appear as inbox items
- [ ] Notes with existing `type` frontmatter are excluded
- [ ] Inbox detail panel shows type dropdown and description field for vault folder items
- [ ] "Mark as Read" applies configured note template frontmatter to the file
- [ ] "Mark as Read" on primary inbox folder items moves the note to the target folder
- [ ] "Mark as Read" on secondary watched folder items applies frontmatter in-place (no move)
- [ ] Inbox item removed after mark-as-read
- [ ] Source badge shows "Vault Folder" for folder-sourced items
- [ ] Per-source toggle for vault folder watching in Settings → Inbox
- [ ] `npm run build` passes

---

## Related

- PRD: [[Hubs PRD]]
- Inbox idea: [[I want to connect the User Hub Inbox with a vault folder]]
- Companion: [[PBI-QC-001 Quick Capture Ribbons]] (capture side)
- Downstream: [[I want my files in the inbox routed to the correct folder once they are typed]] (auto-routing)
- Prior art: [[Phase 3 Inc 2 - Inbox Population]], [[Phase 3 Inc 3 - Inbox UX and Source Config]], [[Phase 3 Inc 4 - Pipeline Inbox and Preferences]]
