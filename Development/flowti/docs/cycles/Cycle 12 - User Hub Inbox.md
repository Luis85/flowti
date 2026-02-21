---
type: DevelopmentCycle
feature: "[[Hubs PRD]]"
stage: ready
cycle: 12
date_planned: 2026-02-21
date_completed:
pbis:
  - "[[PBI-QC-001 Quick Capture Ribbons]]"
  - "[[PBI-005 Vault Folder Inbox]]"
bugs: []
bugs_fixed_precycle: []
tech_debt: []
estimated_increments: 3
actual_increments: 4
estimated_tests: 60
actual_tests: 79
total_tests_after: 3097
total_test_files_after: 124
---

# Cycle 12: User Hub Inbox

[[Development/flowti/docs/inbox/I want to connect the User Hub Inbox with a vault folder]]

## User Story

As a knowledge worker using Flowti, I want the User Hub Inbox to watch configured vault folders and surface untyped notes so that I can triage incoming captures inline — setting type and description — and start every note's data quality journey from a single workspace.

## User Pains

- Notes captured quickly (via Quick Capture, manual creation, or external tools) land in vault folders but are invisible to the inbox — they have no frontmatter, no type, no connection to the knowledge graph
- The current inbox only shows event-driven notifications (subscription matches, import/export results). There is no way to see "raw" unprocessed notes that need attention
- Discovering untyped notes requires manually browsing folder trees or running searches — breaks flow and adds cognitive overhead
- Without a triage interface, notes accumulate in inbox folders indefinitely, becoming a graveyard instead of a processing queue
- The gap between "capture" ([[Quick capture ribbons for ideas and feedback]]) and "organization" (typed, routed notes) has no bridge — users must context-switch to manually open each note and add frontmatter

## User Needs

- **Folder watching**: Configure one or more vault folders (with optional recursive mode) that the inbox monitors for new or untyped notes
- **Automatic surfacing**: When a note appears in a watched folder without frontmatter (or with empty type), it shows up as an inbox item
- **Inline triage**: Edit type and description directly in the inbox detail panel — no need to navigate to the file
- **Mark as read**: Single action that applies a note template's frontmatter properties, completing the initial data quality step
- **Target folder**: All notes processed through the primary inbox folder go to exactly one configured target folder
- **Inbox Zero**: Once a note is typed and marked as read, it disappears from the inbox — the inbox is a processing queue, not a permanent view
- **Source configuration**: Enable/disable folder watching per folder, consistent with existing inbox source toggles in Settings

## Use Cases

### UC-1: Triage a quick-captured note
1. User clicks "Add Idea" ribbon → note created in `00 - Inbox/inbox/` with title only
2. InboxService detects new file in watched folder via `file.created` event
3. Note appears in User Hub Inbox as unread item with title and "Vault Folder" source badge
4. User clicks the item → detail panel shows title, type dropdown, description field
5. User sets type to "idea", enters a one-line description
6. User clicks "Mark as Read" → frontmatter template applied, note moved to target folder
7. Item disappears from inbox

### UC-2: Catch empty notes from other folders
1. User has a second watched folder: `01 - Now/Project-X/notes/`
2. A collaborator creates `meeting-recap.md` with only a title
3. InboxService detects the note (empty frontmatter) and surfaces it in the inbox
4. User triages it by setting type to "meeting" and marking as read
5. Frontmatter properties are written to the file in-place (no move — only the primary inbox folder routes to a target)

### UC-3: Recursive folder watching
1. User configures `docs/inbox/` with recursive watching enabled
2. A note is created in `docs/inbox/signals/new-idea.md`
3. InboxService detects it via recursive watch and surfaces it in the inbox
4. User triages as normal

## Gherkin Scenarios

```gherkin
Scenario: New note in watched folder appears in inbox
  Given the inbox is configured to watch "00 - Inbox/inbox/"
  And a new note "Quick thought.md" is created in that folder with no frontmatter
  When InboxService processes the file.created event
  Then a new inbox item appears with title "Quick thought" and source "Vault Folder"
  And the inbox unread count increments by 1

Scenario: Mark as read applies template frontmatter and routes to target
  Given an inbox item from a watched folder with type set to "idea"
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

## Technical Feasibility

**Infrastructure ready:**
- `file.created` / `file.modified` events already emitted by File Events domain (L5, done)
- InboxService already supports source registration pattern (mapper + listener + source definition)
- Existing subscription system already filters events by path patterns — reusable for folder matching
- TypedStorage persistence for inbox state already handles `InboxItem[]`

**New components needed:**
- `mapVaultFolderNote`: Pure mapper function (file metadata → InboxItem)
- Folder watcher configuration in settings (paths + recursive flags + target folder)
- Inline type/description editor in inbox detail panel (extends current read-only detail)
- File move operation on mark-as-read (via existing `FileSystemClient`)
- Frontmatter template application (via existing `DocService`)

**Events (new):**
- `inbox.vaultFolder.noteDetected` — when untyped note found in watched folder
- `inbox.vaultFolder.noteTriaged` — when note marked as read with type/description



## Situation Assessment

### Pre-Cycle State (Cycle 10 completed, Cycle 11 delivered 2026-02-21)

**Plugin health (verified):**
- 3,018 tests passing (32 skipped), 118 test suites
- Build status: green (`npm test` + `npm run build` pass)
- Error handling foundation in place (Cycle 10 Inc 1)
- Resource leak patterns fixed (Cycle 10 Inc 2)
- EventBus resilience with error boundary (Cycle 10 Inc 3)
- Infrastructure correctness hardened (Cycle 10 Inc 4)
- Azure DevOps Integration delivered (Cycle 11 — 5/5 PBIs, FRI 30/35, RB-5 resolved)

**User Hub Inbox — current state:**

| Aspect | Status |
|--------|--------|
| InboxService | Operational — 8 source event listeners, TypedStorage persistence, 500-item capacity |
| Mappers | 8 pure functions: subscription.matched, import completed/failed, export completed, pipeline completed/failed, signal sync completed/failed |
| UI Component | Master-detail layout with filtering, read/unread state, source badges, dismiss/clear actions |
| Source Config | 8 per-source toggles in Preferences tab; `inboxEnabledSources` setting |
| Events | inbox.loaded, inbox.itemAdded, inbox.itemsChanged, inbox.refresh |
| Tests | 29 unit tests + 18 flow tests + UI tests (>50 total) |
| Delivered in | Phase 3 Inc 2 (Inbox Population), Inc 3 (UX & Source Config), Inc 4 (Pipeline Inbox & Preferences), Cycle 11 Inc 5 (Signal sync mappers) |

**Infrastructure available for this cycle:**
- `file.created` / `file.modified` events — emitted by EventBridge, consumed by IngestionService + SessionService
- `FileSystemClient.moveFile()` — file relocation with event emission
- `FileSystemClient.updateFrontmatter()` — in-place frontmatter modification
- `FileSystemClient.createFile()` — note creation with frontmatter template
- `INBOX_SOURCE_DEFINITIONS` pattern — extensible source registration
- Obsidian ribbon API — `plugin.addRibbonIcon()` for sidebar actions
- Command palette — `plugin.addCommand()` for keyboard-accessible actions

**What's missing — the capture-to-organization gap:**
- No frictionless capture mechanism — creating a note requires navigating to a folder, adding frontmatter manually
- Inbox only shows event-driven notifications; no way to surface "raw" unprocessed notes that need attention
- Notes captured quickly (manual creation, external tools) have no frontmatter, no type, no connection to the knowledge graph
- No bridge between "capture" and "organization" — users must context-switch to open each note and manually enrich it
- Without a triage interface, notes accumulate in inbox folders indefinitely

**Feature readiness:**

| PRD | Stage | FRI | Relevant PBIs |
|-----|-------|-----|---------------|
| [[Hubs PRD]] | in-progress | 33/35 | PBI-005 (Vault Folder Inbox) |
| [[Quick Capture PRD]] | approved | 19/35 | PBI-QC-001 (Quick Capture Ribbons) |

**Why this cycle comes before Release Preparation:**
Quick Capture and Vault Folder Inbox together create the capture-to-organization pipeline — the core workflow loop for Flowti's "Inbox Zero" philosophy. This is a dogfooding enabler: the team needs frictionless capture and triage to effectively use the system daily. Delivering this before release preparation ensures the product has a complete idea-to-organization flow, which is essential for first-run user experience and demonstrates core product value.

### Post-Cycle State (YYYY-MM-DD)
<!-- Filled post-delivery -->

**Plugin health:**
- X tests passing (Y skipped), Z test files (+N tests, +M files)

**Feature status:**
- PBI-QC-001: — brief summary
- PBI-005: — brief summary

---

## Cycle Goals

1. **Deliver frictionless capture** (PBI-QC-001) — Add "Add Idea" and "Add Feedback" ribbon actions and a universal "Quick Capture" command so users can capture thoughts in one click without leaving their current context
2. **Extend inbox with vault folder watching** (PBI-005) — Add a 7th inbox source that watches configured vault folders for untyped notes, surfaces them in the inbox, and enables inline triage with type/description editing
3. **Complete the capture-to-organization pipeline** — Wire Quick Capture output into watched folders so captured notes are automatically surfaced in the inbox for triage, creating a seamless flow from idea to typed, routed, organized note

---

## Tech Debt Bundled

**None bundled this cycle.** Cycle 12 is a feature cycle focused exclusively on the capture-to-organization pipeline. Remaining Cycle 10 tech debt (Inc 5-6: UI Performance Quick Wins, Component Extraction) is explicitly deferred to post-release cycles.

---

## Increment Plan

### Inc 1: Quick Capture Ribbons (PBI-QC-001)

**Goal:** Add "Add Idea" and "Add Feedback" ribbon actions and a universal "Quick Capture" command for frictionless note creation.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/capture/types.ts` | `CaptureType`, `CaptureConfig`, `CaptureResult` types | ~30 |
| 2 | `src/domain/capture/CaptureService.ts` | Create typed note in configured folder with frontmatter | ~80 |
| 3 | `src/domain/capture/events.ts` | `capture.idea.created`, `capture.feedback.created`, `capture.note.created` events | ~20 |
| 4 | `src/ui/capture/QuickCaptureModal.ts` | Minimal modal: title input, type selector, Enter to confirm | ~60 |
| 5 | `src/infrastructure/capture/captureCommands.ts` | Ribbon actions + command palette registration | ~40 |
| 6 | `tests/domain/capture/captureService.test.ts` | Note creation, frontmatter, folder routing, custom types | ~80 |
| 7 | `tests/ui/capture/quickCaptureModal.test.ts` | Modal rendering, type selection, keyboard shortcuts | ~40 |

**Est. total:** ~230 LOC source, ~120 LOC tests, ~25 new tests

**Test intent:** Unit tests for CaptureService (note creation, frontmatter template application, folder routing, custom type handling). UI tests for modal (rendering, type selector, Enter-to-confirm). Command registration tests. Event emission tests. Level: unit + UI.

**Documentation intent:** Create Quick Capture feature documentation. Update Settings documentation with capture type configuration. Register capture events in Event Catalog.

**Architecture seams:** New bounded context `src/domain/capture/`. Ribbon API integration (`plugin.addRibbonIcon()`). Command palette registration. Settings integration for configurable folders and custom types (`SettingsService`). Event emission for capture events.

**Acceptance criteria:**
- [x] "Add Idea" (lightbulb) and "Add Feedback" (message-circle) ribbon actions visible
- [x] Clicking ribbon opens minimal modal with title input
- [x] Notes created in configured folder with correct typed frontmatter
- [x] "Quick Capture" command available in command palette with type selector (+ dedicated Add Idea and Add Feedback commands)
- [ ] Custom capture types configurable in Settings — DEFERRED (negotiable per INVEST)
- [ ] Navigation option: stay or open new note after creation — DEFERRED (negotiable per INVEST)
- [x] Capture events emitted on note creation
- [x] `npm run build` passes

**Delivery notes (2026-02-21):** 214 LOC source, 23 tests (3,041 total). 5 capture actions: 2 ribbons + 3 commands. DoD: PASS with 2 deferred negotiable items. See [[Cycle 12 Inc 1 DoD Check - Quick Capture Ribbons]].

---

### Inc 2: Vault Folder Inbox — Folder Watcher Core (PBI-005, Increment 1)

**Goal:** Extend InboxService with vault folder watching (7th source type) so untyped notes in configured folders are automatically surfaced in the inbox.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/inbox/mappers/vaultFolderMapper.ts` | Pure mapper: file metadata -> InboxItem | ~40 |
| 2 | `src/domain/inbox/InboxService.ts` (extend) | Register `file.created`/`file.modified` listeners for watched folders | ~60 |
| 3 | `src/domain/inbox/types.ts` (extend) | Add `vaultFolder` to `INBOX_SOURCE_DEFINITIONS` (7th source) | ~15 |
| 4 | `src/domain/inbox/events.ts` (extend) | `inbox.vaultFolder.noteDetected` event | ~10 |
| 5 | `src/ui/settings/InboxFolderSettings.ts` | Watched folder config (add/remove, recursive toggle) | ~60 |
| 6 | `tests/domain/inbox/vaultFolderMapper.test.ts` | Mapper unit tests | ~50 |
| 7 | `tests/domain/inbox/inboxServiceFolder.test.ts` | Folder watching integration tests | ~50 |

**Est. total:** ~185 LOC source, ~100 LOC tests, ~20 new tests

**Test intent:** Unit tests for `mapVaultFolderNote` mapper (empty frontmatter detection, source badge, dedup by path). Integration tests for InboxService folder watching (event listener registration, filter by watched paths, typed note exclusion). Level: unit + integration.

**Documentation intent:** Update Inbox feature documentation with vault folder source. Update Settings documentation with folder watching configuration. Register inbox vault folder events in Event Catalog.

**Architecture seams:** InboxService extension point (`INBOX_SOURCE_DEFINITIONS`). Event listener seam (`file.created`, `file.modified` filtered by watched paths). Settings integration for folder configuration (`SettingsService`). Path filtering reuses existing event path matching from subscription system.

**Acceptance criteria:**
- [x] Settings UI: configure watched folders (add/remove paths, toggle recursive per folder)
- [x] InboxService registers new source type: `vaultFolder`
- [x] `INBOX_SOURCE_DEFINITIONS` extended with vault folder source entry
- [x] Notes with empty or missing `type` frontmatter in watched folders appear as inbox items
- [x] Notes with existing `type` frontmatter are excluded
- [x] Source badge shows "Vault Folder" for folder-sourced items
- [x] Per-source toggle for vault folder watching in Settings
- [x] `npm run build` passes

**Delivery notes (2026-02-21):** 32 LOC new source (mapper) + ~130 LOC modifications across 10 files. 25 tests (3,066 total, 122 suites). 9th inbox source type. 2 new events registered in catalog. DoD: PASS. See [[Cycle 12 Inc 2 DoD Check - Vault Folder Inbox]].

---

### Inc 3: Vault Folder Inbox — Triage & Routing (PBI-005, Increment 2)

**Goal:** Add inline triage UI and mark-as-read workflow with frontmatter application and file routing.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/userHub/VaultFolderTriagePanel.ts` | Type dropdown, description field, "Mark as Read" action | ~80 |
| 2 | `src/ui/userHub/UserHubInbox.ts` (extend) | Integrate triage panel for vault folder items in detail view | ~30 |
| 3 | `src/domain/inbox/InboxService.ts` (extend) | `triageVaultFolderItem()` — applies frontmatter, routes file | ~50 |
| 4 | `src/domain/inbox/events.ts` (extend) | `inbox.vaultFolder.noteTriaged` event | ~10 |
| 5 | `src/ui/settings/InboxFolderSettings.ts` (extend) | Target folder configuration for primary inbox routing | ~20 |
| 6 | `tests/domain/inbox/inboxServiceFolder.test.ts` (extend) | Triage flow, routing, frontmatter application | ~50 |
| 7 | `tests/ui/userHub/vaultFolderTriagePanel.test.ts` | Triage panel rendering, type selection, mark-as-read | ~30 |

**Est. total:** ~190 LOC source, ~80 LOC tests, ~15 new tests

**Test intent:** Triage flow tests (mark-as-read applies frontmatter, primary folder routes to target, secondary folder applies in-place). UI tests for triage panel (type dropdown, description field, mark-as-read button). Level: unit + integration + UI.

**Documentation intent:** Update UserHubInbox component documentation with triage panel. Document triage flow end-to-end. Update PBI-005 with delivery notes.

**Architecture seams:** Inbox detail panel extension for triage UI. DocService for frontmatter application. FileSystemClient for file move on primary inbox routing. Settings integration for target folder configuration.

**Acceptance criteria:**
- [x] Inbox detail panel shows type dropdown and description field for vault folder items
- [x] "Mark as Read" applies configured note template frontmatter to file
- [x] "Mark as Read" on primary inbox folder items moves note to target folder
- [x] "Mark as Read" on secondary watched folder items applies frontmatter in-place (no move)
- [x] Settings UI: configure target folder for primary inbox routing
- [x] Inbox item removed after mark-as-read
- [x] `inbox.vaultFolder.noteTriaged` event emitted on triage
- [x] `npm run build` passes

**Delivery notes (2026-02-21):** ~160 LOC source (VaultFolderTriagePanel 80 LOC + InboxService triage 50 LOC + settings 20 LOC + events 10 LOC), 20 tests (3,086 total, 124 suites). Triage panel with type dropdown (10 types), description field, mark-as-read with frontmatter application + primary folder routing. DoD: PASS.

---

### Inc 4: Expanded Quick Capture + Inbox Integration (PBI-QC-001 + PBI-005)

**Goal:** Expand Quick Capture from 3 to 10 entity types (General + RAID), wire captured notes into the inbox as info items, and add clickable file links in inbox detail view.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/capture/types.ts` | Expand `CaptureType` union to 10 types | ~5 |
| 2 | `src/infrastructure/commands/registry.ts` | 8 new `flowti:add-*` commands (note, task, question, bug, risk, assumption, issue, decision) | ~40 |
| 3 | `src/ui/capture/QuickCaptureModal.ts` | Replace 3-option dropdown with 10-type optgroup select (General / RAID) | ~30 |
| 4 | `src/domain/inbox/mappers.ts` | `mapCaptureNoteCreated` pure mapper function | ~15 |
| 5 | `src/domain/inbox/InboxService.ts` (extend) | Wire `capture.note.created` listener + add to `ALL_INBOX_SOURCES` | ~15 |
| 6 | `src/domain/inbox/types.ts` (extend) | Add Quick Capture source definition to `INBOX_SOURCE_DEFINITIONS` | ~5 |
| 7 | `src/domain/settings/settings.ts` (extend) | Add `capture.note.created` to default enabled sources | ~5 |
| 8 | `src/ui/userHub/VaultFolderTriagePanel.ts` (extend) | Expand `NOTE_TYPES` to 10 types | ~5 |
| 9 | `src/ui/userHub/types.ts` (extend) | Add `"capture.note.created": "Quick Capture"` to `SOURCE_EVENT_LABELS` | ~5 |
| 10 | `src/ui/userHub/UserHubInbox.ts` (extend) | Clickable file link in inbox detail view for items with `filePath` | ~15 |

**Est. total:** ~140 LOC source, ~50 LOC tests, ~11 new tests

**Test intent:** Mapper tests (mapCaptureNoteCreated produces correct InboxItem with title, sourceEvent, filePath). InboxService tests (capture.note.created listener adds item, disabled source skips). CaptureService tests (RAID types emit events). Command registry tests (all 10 add-* commands present). QuickCaptureModal tests (RAID types accepted). Inbox UI tests (clickable file link renders and calls openFile, no link when filePath absent, source label for capture events). Level: unit + UI.

**Documentation intent:** Update Quick Capture PRD with expanded type set. Update Hubs PRD inbox section with Quick Capture source. Update Event Catalog with `capture.note.created` source definition.

**Architecture seams:** CaptureType union extension. Command registry pattern. InboxService source registration pattern (mapper + listener + source definition). Settings default enabled sources. SOURCE_EVENT_LABELS UI map.

**Acceptance criteria:**
- [x] `CaptureType` union includes 10 types: idea, note, task, question, feedback, bug, risk, assumption, issue, decision
- [x] 8 new `flowti:add-*` commands registered in command palette (no new ribbons)
- [x] Quick Capture modal shows 10 types in General / RAID optgroups
- [x] `mapCaptureNoteCreated` mapper creates InboxItem with title, sourceEvent, filePath
- [x] InboxService listens to `capture.note.created` and adds inbox item
- [x] `INBOX_SOURCE_DEFINITIONS` includes Quick Capture source entry
- [x] `capture.note.created` enabled by default in inbox settings
- [x] Triage panel type dropdown includes all 10 types
- [x] Source badge shows "Quick Capture" for capture-sourced items
- [x] Inbox detail shows clickable file link for items with `filePath`
- [x] `npm test` passes (tsc + eslint + vitest)

**Delivery notes (2026-02-21):** ~140 LOC source across 10 files, 11 tests (3,097 total, 124 suites). 10 capture types (was 3), 13 total capture commands (was 5). Quick Capture → Inbox pipeline complete. Clickable note link enables direct file access from inbox. DoD: PASS.

---

## Dependency Graph

```
Inc 1: Quick Capture Ribbons — independent, no prerequisites
    ↓ (produces notes in watched folders)
Inc 2: Vault Folder Inbox — Folder Watcher Core — independent of Inc 1
    ↓ (surfaces notes in inbox)
Inc 3: Vault Folder Inbox — Triage & Routing — depends on Inc 2
    ↓ (triage panel in place)
Inc 4: Expanded Quick Capture + Inbox Integration — depends on Inc 1 + Inc 3
```

**Parallelism opportunities:**
- Inc 1 and Inc 2 are independent and can run in parallel
- Inc 3 requires Inc 2 (folder watcher) to be complete
- Inc 4 requires Inc 1 (capture types) + Inc 3 (triage panel, inbox detail)
- Inc 1 feeds Inc 2 functionally (Quick Capture creates notes that folder watcher surfaces) but has no code dependency

**Actual execution order:**
Phase A: Inc 1 + Inc 2 (parallel)
Phase B: Inc 3
Phase C: Inc 4

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Folder watcher performance with large vaults | Medium | Event-driven (not polling). Filter by configured paths only. Existing `file.created`/`file.modified` events are already throttled. |
| Quick Capture modal UX too minimal | Low | Start with title-only input. Type and description enriched via inbox triage (Inc 3). More fields can be added in future increments. |
| Dedup complexity for vault folder items | Medium | Dedup by file path (unique per vault). Existing 500-item cap applies. Items dismissed on frontmatter type detection. |
| Frontmatter template application conflicts with existing content | Low | Only apply to notes with empty/missing type. Existing DocService patterns handle merge safely. |
| Quick Capture PRD at FRI 19/35 | Low | FRI meets 19-point threshold for new features. Scope is small (1 PBI, well-defined). |

---

## Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Tests added | ~60 new | 79 new |
| Tests total | ~3,078+ (baseline: 3,018) | 3,097 (124 suites) |
| PBIs closed | 2/2 (QC-001, PBI-005) | 2/2 |
| New events | ~5 | 5 (capture.idea.created, capture.feedback.created, capture.note.created, inbox.vaultFolder.noteDetected, inbox.vaultFolder.noteTriaged) |
| Inbox sources | 8 → 9 (vault folder added) | 8 → 10 (vault folder + Quick Capture) |
| Capture actions | 5 new | 13 total (2 ribbons + 11 commands incl. 8 RAID) |
| Capture types | 3 | 10 (6 General + 4 RAID) |
| Build green | `npm test` + `npm run build` pass | PASS |

---

## Deferred Items

| Item | Reason | Target |
|------|--------|--------|
| Auto-routing typed inbox files to destination folders | Beyond triage scope; separate automation feature | Post-release |
| Voice/image capture | Out of scope for Quick Capture v1 | v2 |
| Rich text capture (markdown editor in modal) | Title-only modal is intentionally minimal | v2 |
| Bulk inbox operations (multi-select triage) | Single-item triage sufficient for v1 | Post-release |
| File type documentation nudge on creation | Separate feature (automation domain) | Post-release |
| Custom capture type persistence (database-backed) | Settings-based types sufficient for v1 | Post-release |

---

## Readiness Assessment

> Explicit verification against [[Definition of Ready (Cycle)]]. Updated 2026-02-21 post-Cycle 11 delivery.

### 1. Feature PRD Readiness

- [x] **PRD exists and is approved** — [[Hubs PRD]] (PBI-005) and [[Quick Capture PRD]] (PBI-QC-001) both exist
- [x] **PRD stage is approved or in-progress** — Hubs: in-progress (L3, FRI 33/35); Quick Capture: approved (L1, FRI 19/35)
- [x] **FRI scored** — Hubs FRI 33/35; Quick Capture FRI 19/35
- [x] **FRI meets threshold** — Hubs 33/35 (>=11 continuation); Quick Capture 19/35 (>=19 new)
- [x] **Technical Review passed** — Hubs PRD has extensive delivery history (Phases 1-3, Cycles 3-8). Quick Capture PRD reviewed as part of Cycle 12 readiness check (scope small, infrastructure validated, CONDITIONAL PASS — see DoR Check).

### 2. Backlog Readiness

- [x] **PBIs defined** — PBI-QC-001 and PBI-005 both have problem statements, solution approaches, acceptance criteria, and INVEST assessments
- [x] **PBIs chunked into increments** — 3 increments across 2 PBIs, each delivering end-to-end value
- [x] **Dependencies mapped** — No external dependencies. PBI-005 extends existing InboxService. PBI-QC-001 is greenfield with minimal infrastructure needs. Inc 3 depends on Inc 2.
- [x] **Priority ranked** — Both PBIs are high priority

### 3. Cycle Plan Document

- [x] **Cycle document exists** — Created with DevelopmentCycle frontmatter, all required fields populated
- [x] **Situation assessment written** — Pre-cycle state with verified plugin health (3,018 tests, 118 suites), inbox status, feature gap analysis
- [x] **Cycle goals defined** — 3 goals mapping to capture, folder watching, and end-to-end pipeline
- [x] **Proposed increments specified** — 3 increments, each with goal, step table, estimated LOC, estimated tests
- [x] **Dependency graph drawn** — Phase A (parallel) → Phase B ordering
- [x] **Risks identified** — 5 risks with impact ratings and mitigations
- [x] **Success metrics defined** — 7 measurable targets
- [x] **Deferred items documented** — 6 items explicitly excluded with rationale

### 4. Increment Readiness

For each of the 3 increments:
- [x] **Scope statement defined** — Each increment has a goal and step table
- [x] **Acceptance criteria written** — Testable criteria with checkboxes per increment
- [x] **Test intent stated** — Behaviors to test and testing level specified per increment
- [x] **Documentation intent stated** — Docs to create/update specified per increment
- [x] **Architecture seams confirmed** — Domain boundaries, adapters, events, and UI integration points identified
- [x] **Estimated size** — LOC and test count estimates provided per increment

### 5. Quality Baseline

- [x] **Build pipeline green** — `npm test` passes (3,018 tests, 32 skipped, 118 suites as of 2026-02-21). `npm run build` succeeds.
- [x] **No critical bugs open** — No open critical bugs blocking this cycle.
- [x] **Previous cycle closed** — Cycle 10 completed (6/6 increments, stage: completed). Cycle 11 delivered (5/5 PBIs, TASM avg 33/35, Three Amigos PASS, FRI 30/35).

### 6. Pre-Cycle Completion

- [x] **Pre-cycle work documented** — Backlog refinement (2026-02-20) reviewed inbox items and prioritized capture workflow. PBI-005 fully elaborated with Gherkin scenarios. PBI-QC-001 enriched with INVEST assessment, technical requirements, events table.
- [x] **Inbox signals reviewed** — Relevant inbox items linked: [[I want to connect the User Hub Inbox with a vault folder]] → PBI-005; [[Quick capture ribbons for ideas and feedback]] → PBI-QC-001; [[I want to capture feedback and input as fast as possible]] → PBI-QC-001.

### Open Actions Before Cycle Start

All prior blockers resolved. No open actions remaining.

---

## Related

- PRD: [[Hubs PRD]] (FRI 33/35), [[Quick Capture PRD]] (FRI 19/35)
- PBIs: [[PBI-QC-001 Quick Capture Ribbons]], [[PBI-005 Vault Folder Inbox]]
- Tech Debt: None bundled
- Inbox: [[I want to connect the User Hub Inbox with a vault folder]], [[Quick capture ribbons for ideas and feedback]], [[I want to capture feedback and input as fast as possible]], [[Whenever a File gets created, I want to document its type if not yet done]]
- Prior art: [[Phase 3 Inc 2 - Inbox Population]], [[Phase 3 Inc 3 - Inbox UX and Source Config]], [[Phase 3 Inc 4 - Pipeline Inbox and Preferences]]
- Reviews: [[backlog-refinement-2026-02-20]], [[Inbox Review 2026-02-20 Azure DevOps Prioritization]]
- Previous Cycle: [[Cycle 11 - Azure DevOps Integration]]
- Next Cycle: [[Cycle 13 - Train of Thoughts]]
