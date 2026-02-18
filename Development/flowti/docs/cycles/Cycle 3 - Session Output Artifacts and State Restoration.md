---
type: DevelopmentCycle
feature: "[[Session Workspaces PRD]]"
stage: in-progress
cycle: 3
date_planned: 2026-02-18
date_completed:
pbis:
  - "[[PBI-SW-006 State Restoration]]"
  - "[[PBI-SW-008 Session Output Artifacts]]"
tech_debt: []
estimated_increments: 4
actual_increments:
estimated_tests: 115
actual_tests:
total_tests_after:
total_test_files_after:
---

# Cycle 3: Session Output Artifacts & State Restoration

## Situation Assessment

### Pre-Cycle State (2026-02-18)

**Plugin health:**
- 2,250 tests passing (32 skipped), 87 test files
- Clean working tree, all builds green
- `npm run build` pipeline: vitest + typedoc + tsc + eslint + esbuild

**Session Workspaces feature:**
- PRD v4, FRI 29/35, stage: in-progress
- PBI-SW-001 (Activity Log): done
- PBI-SW-002 (Context Bindings): done
- PBI-SW-003 (Session Types): done — 8 built-in types, guiding questions, custom type creation
- PBI-SW-004 (Decision Log): done — structured decisions, workspace panel, summary integration
- PBI-SW-005 (Session Summary): done — frontmatter + body + decisions section
- Session domain: 1,941 LOC across 4 domain files; 1,347 LOC across 9 UI files
- 54 session events registered

**What's next per PRD priority ranking:**
1. PBI-SW-008 (Session Output Artifacts) — medium effort, all dependencies met (SW-004 done, SW-005 done)
2. PBI-SW-006 (State Restoration) — small effort, independent, closes TD-45

PBI-SW-006 is small and independent — it slots in as Inc 1. PBI-SW-008 is the main feature spanning Inc 2 and Inc 3. Together they round out the core session feature set: state preservation across pause/resume, and structured post-session deliverables.

### Post-Cycle State (YYYY-MM-DD)
<!-- Filled post-delivery -->

---

## Cycle Goals

1. **Deliver PBI-SW-006** — Workspace state (open files, active file) auto-saved on pause/complete, auto-restored on resume
2. **Deliver PBI-SW-008 domain layer** — Output types, 3 pre-built templates, `generateSessionOutput()` pure function, file creation, wikilink insertion
3. **Deliver PBI-SW-008 UI layer** — "Generate Output" action for completed sessions, template picker modal, custom templates in settings
4. **Flow test** — End-to-end integration test covering both PBIs (new flow test #12)
5. **Close Cycle 2 carry-forward** — Update Session Workspaces PRD (stage, FRI, requirements); create `Create and Manage Sessions.md` flow doc

---

## Carry-Forward from Cycle 2

The following items were deferred from Cycle 2 and must be addressed in this cycle:

1. **PRD update** — `Session Workspaces PRD.md` needs stage/FRI update reflecting Cycle 2 delivery (PBI-SW-003, SW-004, SW-005 closed; FR-03, FR-04, FR-05 delivered; event count 54). Deferred from Cycle 2 Inc 5. Will be updated in Inc 4 alongside Cycle 3 delivery status.
2. **Flow doc** — `Create and Manage Sessions.md` still missing despite 54 session events. Deferred from Cycle 2 Inc 5 to documentation audit. Will be created in Inc 4 covering the full session lifecycle including state restoration and output generation from Cycle 3.
3. **SessionWorkspaceView LOC monitoring** — At 697 LOC post-Cycle 2. Cycle 3 adds `SessionOutputPanel` (new component) and state save/restore subscriptions (~80 LOC to orchestrator). Must verify orchestrator stays below 780 LOC post-cycle; flag TD if exceeded.

---

## Tech Debt Bundled

**None bundled this cycle.** Both PBIs are clean feature additions with no prerequisite debt fixes. TD-45 (UI view state not persisted) will be partially resolved as a side effect of PBI-SW-006 delivery (session workspace state covered; hub view state remains open).

---

## Increment Plan

### Inc 1: PBI-SW-006 — State Restoration (Domain + UI)

**Goal:** Save open vault files + active file on pause/complete; restore on resume.

**Architecture decision:** `SessionService` cannot call `app.workspace` — it has no Obsidian API access. The flow:
- On `session.paused`/`session.completed`: service emits `session.state.save { sessionId }`
- `SessionWorkspaceView` listens, captures workspace snapshot via `app.workspace`, emits `session.state.saved { sessionId, state }`
- Service persists `workspaceState` on the session entity
- On `session.resumed`: service emits `session.state.restore { sessionId, state }` with saved data
- View listens, opens files via `app.workspace.openLinkText()`

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/session/types.ts` | `WorkspaceState` type; optional `workspaceState` field on `Session` | ~15 |
| 2 | `src/domain/session/events.ts` | 4 events: `session.state.save/saved/restore/restored` (all `["system"]`) | ~24 |
| 3 | `src/domain/session/SessionService.ts` | Persist on `state.saved`; emit `state.save` on pause/complete; emit `state.restore` on resume; backward compat guard | ~40 |
| 4 | `src/infrastructure/events/catalog.ts` | 4 catalog entries, tagged `["system"]`, category "Session" | ~6 |
| 5 | `src/ui/SessionWorkspaceView.ts` | Capture workspace on `state.save`; restore files on `state.restore`; skip missing files | ~55 |
| 6 | `tests/domain/session/SessionService.test.ts` | Backward compat; persist on saved; restore emitted on resume | ~15 |
| 7 | `tests/ui/SessionWorkspaceView.test.ts` | State capture on pause; restore on resume; missing files skipped | ~15 |

**Est. total:** ~140 LOC source, ~30 tests

**Event signatures:**

| Event | Payload | Tags |
|-------|---------|------|
| `session.state.save` | `{ sessionId: string }` | `["system"]` |
| `session.state.saved` | `{ sessionId: string; state: WorkspaceState }` | `["system"]` |
| `session.state.restore` | `{ sessionId: string; state: WorkspaceState }` | `["system"]` |
| `session.state.restored` | `{ sessionId: string }` | `["system"]` |

**Acceptance criteria:**
- [ ] `WorkspaceState` type: `{ openFiles: string[], activeFile: string | null, scrollPositions: Record<string, number> }`
- [ ] `session.workspaceState` optional field on `Session` (backward compat `s.workspaceState ??= null` in `load()`)
- [ ] Pausing or completing a session triggers workspace state capture
- [ ] Resuming a session with saved `workspaceState` restores open files
- [ ] Missing vault files skipped gracefully (no crash)
- [ ] 4 new events registered in catalog, all tagged `["system"]`
- [ ] `npm run build` passes

---

### Inc 2: PBI-SW-008 Domain Layer — Templates + Pure Function

**Goal:** Establish the domain foundation for output artifacts: types, 3 pre-built templates, `generateSessionOutput()` pure function, events, and service handler.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/session/types.ts` | `SessionOutputType` union; `SessionOutputSection`, `SessionOutputTemplate`, `SessionOutputArtifact` interfaces; `outputArtifacts` on `Session`; `MAX_OUTPUT_ARTIFACTS = 20` | ~55 |
| 2 | `src/domain/session/helpers.ts` | `generateSessionOutput(session, template): string`; `BUILT_IN_OUTPUT_TEMPLATES` constant; `resolvePlaceholder()` helper | ~85 |
| 3 | `src/domain/session/events.ts` | 2 events: `session.output.generate`, `session.output.generated` | ~10 |
| 4 | `src/domain/session/SessionService.ts` | Handler: validate completed → generate content → create file → append wikilink to notes → persist artifact → emit generated; backward compat `s.outputArtifacts ??= []` | ~60 |
| 5 | `src/infrastructure/events/catalog.ts` | 2 catalog entries, category "Session" | ~4 |
| 6 | `tests/domain/session/helpers.test.ts` | All 3 templates; all 8 placeholders; empty fields; custom template | ~30 |
| 7 | `tests/domain/session/SessionService.test.ts` | Generate → artifact persisted; wikilink inserted; backward compat; max 20 cap; rejected for active sessions | ~20 |

**Est. total:** ~234 LOC source, ~50 tests

**Pre-built templates:**

| Type | Title Pattern | Key Sections |
|------|--------------|-------------|
| `meeting-invite` | `Meeting Invite: {{title}}` | Overview (date, duration, type), Goals, Decisions, Context Bindings |
| `action-items` | `Action Items: {{title}}` | Summary, Action Items (from decisions), Files Changed (artifacts) |
| `review-summary` | `Review Summary: {{title}}` | Session Overview, Goals, Decisions, Artifacts, Notes |

**Placeholder set:**

| Placeholder | Resolves To |
|------------|------------|
| `{{title}}` | `session.title` |
| `{{date}}` | `session.completedAt` formatted as ISO date |
| `{{type}}` | Human-readable session type label (via `resolveTypeConfig`) |
| `{{duration}}` | `formatDurationHuman(activeTimeMs)` |
| `{{goals}}` | Bullet list of goal texts (checked/unchecked) |
| `{{decisions}}` | Bullet list of decision titles (with optional description) |
| `{{artifacts}}` | Wikilink list of artifacts |
| `{{context}}` | Comma-separated context binding labels |

**File naming:** `{SESSION_NOTES_FOLDER}/{session.title} - {outputType} ({shortId}).md`

**Wikilink insertion:** Appends `## Output Artifacts\n- [[{outputPath}]] *(generated {date})*\n` to the notes file body if `session.notesFile` exists, else no-op.

**Acceptance criteria:**
- [ ] `SessionOutputType`, `SessionOutputTemplate`, `SessionOutputArtifact` types defined
- [ ] `generateSessionOutput()` handles all 8 placeholders for all 3 template types
- [ ] 3 pre-built templates (`BUILT_IN_OUTPUT_TEMPLATES`) produce valid markdown
- [ ] File created at `SESSION_NOTES_FOLDER/{title} - {type} ({shortId}).md`
- [ ] Wikilink appended to session notes file (if it exists; skip gracefully if not)
- [ ] `SessionOutputArtifact` persisted on session entity, max 20 enforced
- [ ] Backward compat `s.outputArtifacts ??= []` in `load()`
- [ ] 2 new events in catalog
- [ ] `npm run build` passes

---

### Inc 3: PBI-SW-008 UI Layer — Panel + Picker + Settings

**Goal:** Wire output generation into the session workspace: a "Generate Output" button for completed sessions, a template picker modal, and custom template creation in settings.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/session/SessionOutputPanel.ts` | List existing output artifacts (wikilinks) + "Generate Output" button; `render()` + `refreshList()` | ~70 |
| 2 | `src/ui/SessionWorkspaceView.ts` | Import + render for completed/archived sessions; subscribe `session.output.generated` → refresh | ~25 |
| 3 | `src/ui/session/SessionOutputPickerModal.ts` | Modal: 3 built-in template cards + custom templates; on select → emit `session.output.generate` | ~55 |
| 4 | `src/ui/settings/FlowtiSettingTab.ts` | "Output Templates" section: list custom templates + add/delete | ~65 |
| 5 | `tests/ui/session/SessionOutputPanel.test.ts` | Renders artifact list; button presence; refreshList updates DOM | ~15 |
| 6 | `tests/ui/session/SessionOutputPickerModal.test.ts` | Renders 3 built-in + custom cards; selection emits event | ~10 |
| 7 | `tests/ui/SessionWorkspaceView.test.ts` | Output panel shown for completed; hidden for active; generated triggers refresh | ~10 |

**Est. total:** ~215 LOC source, ~35 tests

**Panel visibility:** `SessionOutputPanel` renders only when `session.status === "completed" || session.status === "archived"`.

**Acceptance criteria:**
- [ ] "Generate Output" button visible only for completed/archived sessions
- [ ] Clicking opens `SessionOutputPickerModal` with 3 built-in template cards
- [ ] Custom templates from settings appear in the picker modal
- [ ] Selecting a template emits `session.output.generate` command
- [ ] After generation, output artifact appears in panel as wikilink
- [ ] Custom templates can be created/deleted via settings tab
- [ ] `npm run build` passes

---

### Inc 4: Flow Integration Test + Docs + Closure

**Goal:** End-to-end integration test covering the full SW-006 + SW-008 flow. Close Cycle 2 carry-forward items: update PRD, create session flow doc.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `tests/flows/12-SessionOutputAndStateRestoration.test.ts` | Full lifecycle: create → start → pause (state saved) → resume (state restored) → complete → generate output (2 types) → verify artifacts + wikilinks | ~180 |
| 2 | `tests/domain/session/helpers.test.ts` | Edge cases: empty fields in templates; unknown placeholders preserved verbatim | ~10 |
| 3 | `docs/features/Session Workspaces/Session Workspaces PRD.md` | Update: stage, FRI score, check delivered FRs (FR-03 through FR-07), event count (60+), PBI status table, stage history | ~edit |
| 4 | `docs/flows/Create and Manage Sessions.md` | NEW flow doc: full session lifecycle including types, decisions, state restoration, output generation. Follow existing flow doc template. | ~new |

**Est. total:** ~190 LOC tests + ~2 doc files

**Flow test covers:**
1. Create session → verify `workspaceState` is `null` (backward compat field present)
2. Start session → pause → verify `session.state.save` emitted
3. Resume → verify `session.state.restore` emitted with saved files
4. Complete session → verify `workspaceState` persisted
5. Emit `session.output.generate` with `"review-summary"` → verify `session.output.generated` emitted
6. Verify output artifact recorded (`outputArtifacts.length === 1`)
7. Verify generated content contains session title, decisions, and goals
8. Generate again with `"action-items"` → verify 2 artifacts total
9. Verify `session.output.generate` on active session does nothing (only completed sessions)

**Acceptance criteria:**
- [ ] Flow test covers SW-006 state save/restore lifecycle
- [ ] Flow test covers SW-008 output generation with 2+ template types
- [ ] All PBI-SW-006 and PBI-SW-008 acceptance criteria checked off
- [ ] PRD updated: stage, FRI, checked FRs (Cycle 2 + Cycle 3), event count, PBI status (carry-forward from Cycle 2)
- [ ] Flow doc `Create and Manage Sessions.md` created with full session lifecycle events (carry-forward from Cycle 2)
- [ ] SessionWorkspaceView LOC verified < 780 (carry-forward: 697 + new subscriptions)
- [ ] `npm run build` passes — all tests green

---

## Dependency Graph

```
Inc 1: PBI-SW-006 — State Restoration (independent)
  |
  |  (parallel: no dependency between Inc 1 and Inc 2)
  |
Inc 2: PBI-SW-008 Domain — types, templates, pure function, events, service handler
  |
Inc 3: PBI-SW-008 UI — SessionOutputPanel, picker modal, settings UI
  |     (requires: Inc 2 types and events)
  |
Inc 4: Flow Integration Test
        (requires: Inc 1 + Inc 2 + Inc 3)
```

**Note:** Inc 1 and Inc 2 are fully independent and could be parallelized. Inc 3 requires Inc 2 types. Inc 4 requires all prior increments.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Workspace state capture requires `app.workspace` — architecture tension with domain purity | High | Keep capture/restore in View layer. Domain only persists the `WorkspaceState` payload received via events. No Obsidian API in SessionService. |
| File creation for output needs `FileSystemClient` or vault API in SessionService | Medium | Follow existing notes file creation pattern (`writeSessionSummary()` already calls `FileSystemClient`). |
| SessionService at 1,037 LOC grows further (~100 LOC from both PBIs) | Medium | Post-cycle estimate: ~1,140 LOC. Flag as TD if exceeds 1,150 LOC. Consider `SessionOutputService` extraction in future cycle. |
| Wikilink insertion into notes file fails if notes file doesn't exist | Low | Skip gracefully — output artifact still persisted on session. User can manually link later. |
| Custom templates in settings adds Zod schema complexity | Low | Follow exact `customSessionTypes` pattern: `z.array().default([])`. No migration needed. |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Tests added | ~115 new |
| Tests total | ~2,365+ |
| Test suites | ~90+ |
| LOC added (source) | ~590 |
| PBIs closed | PBI-SW-006, PBI-SW-008 |
| New events | 6 (4 state + 2 output) |
| Total session events | 60+ |
| Pre-built output templates | 3 (meeting-invite, action-items, review-summary) |
| Backward compat fields | 2 (`workspaceState ??= null`, `outputArtifacts ??= []`) |
| SessionService LOC | < 1,150 (flag TD if exceeded) |
| SessionWorkspaceView LOC | < 780 (from 697; carry-forward monitor) |
| PRD updated | Stage, FRI, FRs checked, event count (Cycle 2 carry-forward) |
| Flow doc created | `Create and Manage Sessions.md` (Cycle 2 carry-forward) |

---

## Cycle Retrospective
<!-- Filled post-delivery -->

### What Went Well
<!-- Observations -->

### Deviations from Plan
<!-- What changed and why -->

### Improvement Backlog (from this cycle)
<!-- - [ ] Items feeding into next cycle -->

### Learnings
<!-- - **L-NN**: Title — description -->

---

## Related

- PRD: [[Session Workspaces PRD]] (v4, FRI 29/35)
- PBIs: [[PBI-SW-006 State Restoration]], [[PBI-SW-008 Session Output Artifacts]]
- Tech Debt: TD-45 (partially resolved by PBI-SW-006 — session workspace state)
- Learnings (input): [[L-01 Start domain-first]], [[L-09 Thread new fields early]], [[L-11 Backward compat guard in load]], [[L-17 Wikilink insertion pattern]], [[L-20 Pure functions for testability]], [[L-23 Optional fields simplify UX]], [[L-24 Component extraction before feature addition]]
- Learnings (output): <!-- filled post-delivery -->
- Previous Cycle: [[Cycle 2 - Session Types and Decision Log]]
