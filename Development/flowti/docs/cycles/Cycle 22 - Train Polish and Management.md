---
type: DevelopmentCycle
feature: "[[Train Improvements PRD]]"
stage: planned
cycle: 22
date_planned: 2026-02-22
date_completed:
pbis:
  - "[[PBI-TOT-008 Train Polish and Management]]"
bugs:
  - "trainMaxThoughts setting ignored — hardcoded 500 used instead of user setting"
bugs_fixed_precycle: []
tech_debt:
  - "Silent catch blocks in canvas writer/sync (TD-122 pattern)"
  - "Canvas path derivation duplicated across 3 files"
estimated_increments: 6
actual_increments:
estimated_tests: 70
actual_tests:
total_tests_after:
total_test_files_after:
---

# Cycle 22: Train Polish & Management

## Cycle Overview

**User Story:**

> As a Train of Thoughts user, I want to rename and delete trains, see the active thought clearly highlighted in the sidebar, and trust that my configured max-thought limit is respected — so that train management feels complete and reliable.

**User Pains:**
- `trainMaxThoughts` setting (1–1000, default 100) in Settings has **no effect** — hardcoded `MAX_THOUGHTS_PER_TRAIN = 500` is used instead
- Active thought dot in the sidebar timeline is only 2px larger than normal dots — no visible ring or glow to distinguish it
- No way to rename a train after creation (stuck with the initial title forever)
- No way to delete a train (history accumulates indefinitely; only workaround is manually editing plugin data)
- Canvas writer and sync service silently swallow errors — failures are invisible to the user
- Canvas path derivation (`${trainFolder}/${title}.canvas`) is duplicated in 3 locations

**User Needs:**
- Fix trainMaxThoughts setting so the user's configured limit actually applies
- Visible active thought ring in sidebar (box-shadow or outline, matching lane color)
- Rename train: edit icon in main view header + history card title
- Delete train: trash icon in history panel cards with confirmation, removes from state + optionally deletes notes
- Error logging in canvas catch blocks so failures are diagnosable
- Single canonical `getCanvasPath(train, trainFolder)` helper

---

## Situation Assessment

### Pre-Cycle State (post-Cycle 20)

**Plugin health:**
- 3,896 tests passing, 158 test suites
- Build status: green
- Cycle 20 delivered: sidebar nav, git graph timeline, keyboard nav, summary writer, history panel

**Train domain status (Cycle 20 delivered):**
- Domain: ~1,700 LOC (TrainService 638, TrainCanvasWriter 543, TrainCanvasSyncService 124, TrainSummaryWriter 206)
- UI: ~2,050 LOC (TrainMainView 510, TrainTimelineSidebar 384, TrainCaptureModal 245, TrainHistoryPanel 141, TrainStatsPanel 49, TrainTimelineSidebarSubscriptions 350)
- Tests: ~9,000 LOC across 20 test files
- All FRs delivered (13 + summary, history, keyboard, sidebar nav)
- Canvas: enriched groups, annotations, 7 roles, reconciliation, sync service

**Critical bugs found in refinement:**
1. **trainMaxThoughts setting ignored** — `TrainService.ts:172` uses `MAX_THOUGHTS_PER_TRAIN` (500) from types.ts instead of `this.getSettings().trainMaxThoughts` (user-configurable 1–1000, default 100). The setting is wired through SettingsService and displayed in both FlowtiSettingTab and UserHubTrainPreferences, but TrainService never reads it.
2. **Active dot CSS incomplete** — `.ft-graph-dot-active` at styles.css:1997 only defines `width: 12px; height: 12px;` — no `box-shadow`, `outline`, or visual ring. Comment says "subtle ring" but none is implemented.
3. **Silent canvas catch blocks** — `TrainCanvasWriter.ts:528` and `TrainCanvasSyncService.ts:120` have catch blocks with no logging, making failures invisible.

**Inbox signals addressed this cycle:**
- "trainMaxThoughts setting has no effect" → Inc 1 (critical bug fix)
- "Active thought hard to spot in sidebar" → Inc 2 (CSS ring)
- "No way to rename/delete trains" → Inc 3 + Inc 4

---

## Cycle Goals

1. **Fix trainMaxThoughts setting** — TrainService reads `getSettings().trainMaxThoughts` instead of hardcoded constant
2. **Active thought visual ring** — Box-shadow glow on `.ft-graph-dot-active` matching lane color
3. **Train rename** — In-place edit in main view header + history cards, updates state + note references
4. **Train delete** — Trash button in history panel, confirmation, removes from state
5. **Canvas error logging + path dedup** — Replace silent catches with event bus logging, extract shared `getCanvasPath()`
6. **Integration tests** — Flow 21 covering management operations

---

## Scope

### In Scope
- TrainService: replace `MAX_THOUGHTS_PER_TRAIN` with settings value, keep constant as absolute cap
- CSS: `box-shadow` on `.ft-graph-dot-active` (cyan glow or lane-colored ring)
- TrainService: `renameTrain(trainId, newTitle)` API — updates state, summary path, canvas path
- TrainMainView: editable title (click-to-edit or pencil icon) calling `renameTrain()`
- TrainHistoryPanel: pencil icon on hover for rename
- TrainService: `deleteTrain(trainId)` API — removes from state, optionally deletes thought notes
- TrainHistoryPanel: trash icon on cards with confirmation dialog
- Canvas catch blocks: emit `log.warn` or `console.warn` with error details
- Extract `getCanvasPath(train, trainFolder)` helper used by all 3 locations
- New events: `train.renamed`, `train.deleted`
- Integration tests for all new behaviors

### Out of Scope
- Bulk operations (delete all completed, etc.)
- Train archiving (separate from delete)
- Rename cascading to thought note titles (only train title changes)
- Undo for delete operations
- PRD update (deferred to after delivery)

---

## Definition of Ready — Verification

### 1. Feature PRD Readiness
- [x] PRD exists and is approved — [[Train Improvements PRD]] (stage: in-progress)
- [x] FRI scored — 25/35 (continuation threshold: 11/35)
- [x] Technical Review passed — Cycles 17-20 delivered successfully

### 2. Backlog Readiness
- [x] PBIs defined — PBI-TOT-008 (Train Polish & Management)
- [x] PBIs chunked into increments — 6 vertical slices
- [x] Dependencies mapped — Inc 1 independent, Inc 2 independent, Inc 3→6, Inc 4→6, Inc 5 independent
- [x] Priority ranked — critical bug fix → visual polish → rename → delete → infra → integration

### 3. Cycle Plan Document
- [x] Cycle document exists with proper frontmatter
- [x] Situation assessment written
- [x] Cycle goals defined — 6 goals with clear deliverables
- [x] Proposed increments specified — 6 increments with goal, scope, LOC, tests
- [x] Dependency graph drawn
- [x] Risks identified
- [x] Success metrics defined
- [x] Deferred items documented

### 4. Increment Readiness
- [x] Scope statement defined per increment
- [x] Acceptance criteria written per increment
- [x] Test intent stated per increment
- [x] Documentation intent stated per increment
- [x] Architecture seams confirmed
- [x] Estimated size per increment

### 5. Quality Baseline
- [x] Build pipeline green — `npm test` passes, 3,896 tests, 158 suites
- [x] No critical bugs open (trainMaxThoughts bug found in refinement — included as Inc 1)
- [x] Previous cycle closed — Cycle 20 delivered, stage=delivered

### 6. Pre-Cycle Completion
- [x] Inbox signals reviewed — 4 items addressed, remaining deferred with rationale
- [x] No pre-cycle bug fixes needed (trainMaxThoughts fix is Inc 1)

**Result: All DoR items satisfied. Cycle is READY to start.**

---

### Inc 1: Fix trainMaxThoughts Setting (Critical Bug)

**Goal:** Make the user-configured `trainMaxThoughts` setting actually control the max thought limit, instead of the hardcoded `MAX_THOUGHTS_PER_TRAIN = 500`.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/train/TrainService.ts` | Replace `MAX_THOUGHTS_PER_TRAIN` with `this.getSettings().trainMaxThoughts` at line 172 | ~3 |
| 2 | `src/domain/train/types.ts` | Add doc comment clarifying `MAX_THOUGHTS_PER_TRAIN` is absolute safety cap (not user-facing) | ~2 |
| 3 | `tests/domain/train/trainService.test.ts` | Tests: setting respected, absolute cap still applies, default 100 honored | ~60 |

**Estimated total:** ~5 LOC source, ~60 LOC tests, ~5 new tests

**Implementation detail:**
- Line 172: `if (train.thoughts.length >= MAX_THOUGHTS_PER_TRAIN) return null;` → `if (train.thoughts.length >= Math.min(this.getSettings().trainMaxThoughts, MAX_THOUGHTS_PER_TRAIN)) return null;`
- The hardcoded constant (500) remains as an absolute safety cap — the user setting (default 100) controls the effective limit
- `getSettings()` already exists on TrainService (used for `trainFolder`, `trainCanvasEnabled`, etc.)

**Test intent:** Verify setting value is respected; verify absolute cap (500) cannot be exceeded even if setting is >500; verify default (100) applies when no explicit setting.

**Acceptance criteria:**
- [ ] `trainMaxThoughts` setting controls max thoughts per train
- [ ] `MAX_THOUGHTS_PER_TRAIN` (500) serves as absolute safety cap
- [ ] Thought addition rejected when limit reached (returns null)
- [ ] `npm test` passes

---

### Inc 2: Active Thought Visual Ring

**Goal:** Make the active thought clearly visible in the sidebar git graph with a glowing ring effect.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `styles.css` | Add `box-shadow` to `.ft-graph-dot-active` — cyan glow ring | ~5 |
| 2 | `styles.css` | Add `transition` for smooth ring appearance | ~2 |
| 3 | `tests/ui/train/TrainTimelineSidebar.test.ts` | Verify active dot has the class applied (existing tests already check this) | ~0 |

**Estimated total:** ~7 LOC CSS, ~0 new tests (existing tests verify class application)

**Implementation detail:**
```css
.ft-graph-dot-active {
    width: 12px;
    height: 12px;
    box-shadow: 0 0 0 3px var(--interactive-accent, #7f6df2),
                0 0 8px var(--interactive-accent, #7f6df2);
    transition: box-shadow 150ms ease;
}
```

The existing tests in `TrainTimelineSidebar.test.ts` already verify that exactly 1 dot gets the `.ft-graph-dot-active` class (lines 287–301). No new test code needed — this is a pure CSS fix.

**Acceptance criteria:**
- [ ] Active thought dot has visible glow ring
- [ ] Ring uses `--interactive-accent` (adapts to theme)
- [ ] Normal dots remain unchanged (10px, no shadow)
- [ ] `npm test` passes

---

### Inc 3: Train Rename

**Goal:** Allow users to rename a train from the main view header and history panel.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/train/TrainService.ts` | `renameTrain(trainId: string, newTitle: string): boolean` method | ~20 |
| 2 | `src/domain/train/events.ts` | Add `train.renamed` event | ~2 |
| 3 | `src/infrastructure/events/catalog.ts` | Register `train.renamed` in catalog | ~1 |
| 4 | `src/ui/train/TrainMainView.ts` | Pencil icon next to title → click shows text input → Enter saves | ~30 |
| 5 | `src/ui/train/TrainHistoryPanel.ts` | Pencil icon on card hover → inline rename | ~20 |
| 6 | `tests/domain/train/trainService.test.ts` | Tests for rename: success, completed train, empty title, non-existent | ~50 |
| 7 | `tests/ui/train/TrainMainView.test.ts` | Tests for rename UI trigger | ~30 |
| 8 | `tests/ui/train/TrainHistoryPanel.test.ts` | Tests for rename in history | ~20 |

**Estimated total:** ~73 LOC source, ~100 LOC tests, ~10 new tests

**Implementation detail:**
- `renameTrain()` validates: train exists, newTitle non-empty and trimmed, different from current title
- Updates `train.title` in state, persists, emits `train.renamed` event
- Does NOT rename thought notes (titles are independent of train title)
- Does NOT rename existing canvas/summary files (would need file move — deferred)
- Emits `train.renamed: { trainId, oldTitle, newTitle }`
- Main view: pencil icon (`lucide-pencil`) in header row, contenteditable span or input overlay
- History panel: pencil icon appears on hover, same inline edit behavior

**Test intent:** Service: rename success, rejected for completed trains (or allowed?), empty title rejected, non-existent train returns false, event emitted. UI: pencil icon renders, clicking shows input, Enter saves, Escape cancels.

**Documentation intent:** Register `train.renamed` event in catalog.

**Acceptance criteria:**
- [ ] `renameTrain()` updates train title in state
- [ ] `train.renamed` event emitted with old + new title
- [ ] Pencil icon in main view header triggers rename
- [ ] Pencil icon in history cards triggers rename
- [ ] Empty/whitespace-only title rejected
- [ ] Canvas/summary files not renamed (documented limitation)
- [ ] `npm test` passes

---

### Inc 4: Train Delete

**Goal:** Allow users to delete trains from the history panel with confirmation.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/train/TrainService.ts` | `deleteTrain(trainId: string): boolean` method | ~25 |
| 2 | `src/domain/train/events.ts` | Add `train.deleted` event | ~2 |
| 3 | `src/infrastructure/events/catalog.ts` | Register `train.deleted` in catalog | ~1 |
| 4 | `src/ui/train/TrainHistoryPanel.ts` | Trash icon on cards → confirmation prompt → delete | ~35 |
| 5 | `tests/domain/train/trainService.test.ts` | Tests for delete: success, running train blocked, non-existent, event | ~60 |
| 6 | `tests/ui/train/TrainHistoryPanel.test.ts` | Tests for delete UI: button renders, click triggers callback | ~30 |

**Estimated total:** ~63 LOC source, ~90 LOC tests, ~8 new tests

**Implementation detail:**
- `deleteTrain()` validates: train exists, train is NOT running (can't delete active train — must complete or cancel first)
- Removes train from `state.trains`, persists
- Does NOT delete thought note files (notes may be linked from elsewhere — deletion is the user's responsibility)
- Emits `train.deleted: { trainId, title }`
- History panel: trash icon (`lucide-trash-2`) on card hover, `stopPropagation` to avoid triggering card click
- Confirmation: `confirm()` dialog — "Delete train '{title}'? This removes the train from history. Thought notes are preserved."
- If the deleted train is the current `trainId` in TrainMainView, reset to history view

**Test intent:** Service: delete success, running train rejected, paused train allowed, completed train allowed, non-existent returns false, event emitted, state persisted. UI: trash icon renders, clicking shows confirm (mocked), deletion triggers re-render.

**Documentation intent:** Register `train.deleted` event in catalog.

**Acceptance criteria:**
- [ ] `deleteTrain()` removes train from state
- [ ] Running trains cannot be deleted (returns false)
- [ ] Paused + completed trains can be deleted
- [ ] Thought note files are NOT deleted (preserved)
- [ ] `train.deleted` event emitted
- [ ] Confirmation dialog before delete
- [ ] History panel re-renders after delete
- [ ] `npm test` passes

---

### Inc 5: Canvas Error Logging + Path Dedup

**Goal:** Replace silent canvas catch blocks with observable error logging and extract the duplicated canvas path derivation.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/train/TrainCanvasWriter.ts` | Add `console.warn()` in catch at line 528 with error details | ~3 |
| 2 | `src/domain/train/TrainCanvasSyncService.ts` | Add `console.warn()` in catch at line 120 with error details | ~3 |
| 3 | `src/domain/train/helpers.ts` (NEW) | Extract `getCanvasPath(title: string, trainFolder: string): string` pure function | ~10 |
| 4 | `src/domain/train/TrainCanvasSyncService.ts` | Import + use `getCanvasPath()` at line 82 | ~2 |
| 5 | `src/ui/train/TrainMainView.ts` | Import + use `getCanvasPath()` at line 528 | ~2 |
| 6 | `src/main.ts` | Import + use `getCanvasPath()` at line 833 | ~2 |
| 7 | `tests/domain/train/helpers.test.ts` (NEW) | Tests for `getCanvasPath()`: basic, empty folder, special characters | ~30 |
| 8 | `tests/domain/train/trainCanvasWriter.test.ts` | Test that catch logs warning (vi.spyOn console.warn) | ~15 |

**Estimated total:** ~22 LOC source, ~45 LOC tests, ~6 new tests

**Implementation detail:**
- Canvas catch at `TrainCanvasWriter.ts:528`: `console.warn("[Flowti] Failed to read existing canvas for reconciliation:", canvasPath, error);`
- Canvas catch at `TrainCanvasSyncService.ts:120`: `console.warn("[Flowti] Failed to count managed nodes in canvas:", error);`
- `getCanvasPath(title, trainFolder)`: `return trainFolder ? \`${trainFolder}/${title}.canvas\` : \`${title}.canvas\`;`
- Three call sites updated to use the helper: `TrainCanvasSyncService.ts:82`, `TrainMainView.ts:528`, `main.ts:833`

**Test intent:** Helper: correct path for folder + title, empty folder, title with special chars. Canvas writer: spy on `console.warn` to verify error is logged on invalid JSON.

**Acceptance criteria:**
- [ ] Canvas read failures log a warning with the file path and error
- [ ] `getCanvasPath()` used in all 3 locations (no duplicated derivation)
- [ ] `getCanvasPath()` handles empty trainFolder gracefully
- [ ] `npm test` passes

---

### Inc 6: Integration Tests

**Goal:** Create Flow 21 covering train management operations (rename, delete, settings).

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `tests/flows/21-TrainManagement.test.ts` (NEW) | Integration tests for rename, delete, and maxThoughts setting | ~200 |

**Estimated total:** ~0 LOC source, ~200 LOC tests, ~12 new tests

**Test scenarios:**
1. **trainMaxThoughts respected**: Start train → add thoughts up to limit → verify next addThought returns null
2. **Absolute cap**: Set trainMaxThoughts to 600 → verify MAX_THOUGHTS_PER_TRAIN (500) still applies
3. **Rename lifecycle**: Start train → add thoughts → rename → verify state, event, getTrain returns new title
4. **Rename rejected for empty title**: verify returns false
5. **Delete completed train**: Start → complete → delete → verify removed from getAllTrains, event emitted
6. **Delete running train blocked**: Start → attempt delete → verify returns false, train still exists
7. **Delete paused train**: Start → pause → delete → verify success
8. **Delete with active view reset**: Delete the train that's currently viewed → verify view resets
9. **Full management lifecycle**: Start → add thoughts → rename → complete → summary → rename post-complete → delete → gone
10. **Canvas path consistency**: Verify `getCanvasPath()` matches the path used in sync events

**Acceptance criteria:**
- [ ] Flow 21 covers trainMaxThoughts setting enforcement
- [ ] Flow 21 covers rename lifecycle (success + rejection)
- [ ] Flow 21 covers delete lifecycle (success + rejection + running blocked)
- [ ] Flow 21 covers full management lifecycle
- [ ] All existing tests pass
- [ ] `npm test` passes

---

## Dependency Graph

```
Inc 1 (Max Thoughts Fix)  ──→ Inc 6 (Integration)
Inc 2 (Active Dot CSS)    ──→ (none — standalone)
Inc 3 (Rename)            ──→ Inc 6 (Integration)
Inc 4 (Delete)            ──→ Inc 6 (Integration)
Inc 5 (Canvas Error/Path) ──→ Inc 6 (Integration)
```

**Execution order:**
- Phase A: Inc 1 + Inc 2 + Inc 5 (parallel — all independent fixes)
- Phase B: Inc 3 + Inc 4 (parallel — rename and delete are independent)
- Phase C: Inc 6 (integration — depends on all service changes)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Rename breaks canvas/summary file references | Medium | Document limitation: rename updates state only, not file names. Canvas path uses current title at sync time. |
| Delete removes train state but leaves orphan notes | Low | By design — thought notes may be linked from elsewhere. Document in confirmation message. |
| trainMaxThoughts change affects in-flight trains | Low | Only applies at addThought time; existing thoughts not removed. |
| Inline edit UX conflicts with click-to-navigate | Medium | Pencil icon is separate click target; card body still navigates. stopPropagation on icon. |
| console.warn in catch blocks creates test noise | Low | Tests use `vi.spyOn(console, "warn")` to verify and suppress. |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~70 |
| Source LOC | ~170 |
| CSS LOC | ~7 |
| Post-cycle total tests | ~3,966 |
| Post-cycle test suites | ~161 |
| Critical bugs fixed | 1 (trainMaxThoughts) |
| New TrainService APIs | 2 (renameTrain, deleteTrain) |
| New events | 2 (train.renamed, train.deleted) |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| File rename on train rename | Needs `app.fileManager.renameFile()` — risky with linked references | Future |
| Delete thought notes on train delete | Notes may be linked from other contexts; deletion should be user-initiated | Future |
| Bulk delete/archive operations | Low priority with small train counts | Future |
| Undo for delete | Would need soft-delete + TTL cleanup — over-engineering for now | Future |
| Train types at creation | Needs type registry, settings UI, per-type config | Cycle 23+ |
| Dedicated Train Hub (BaseHubView) | Not enough content for a full hub yet | Future |
| Cyclical trains (loop back) | Novel concept requiring DAG→cycle state machine changes | Future |
| AI-driven thought synthesis | Requires AI infrastructure | Future |

---

## Inbox Signals Reviewed

| Inbox Item | Disposition |
|------------|-------------|
| trainMaxThoughts setting ignored | **Addressed** in Inc 1 (critical bug fix) |
| Active thought hard to spot | **Addressed** in Inc 2 (CSS ring) |
| No way to rename/delete trains | **Addressed** in Inc 3 + Inc 4 |
| Canvas errors swallowed silently | **Addressed** in Inc 5 (console.warn + path dedup) |
| Choose train type at start | **Deferred** — needs type registry, settings UI, templates |
| Better session integration | **Deferred** — summary doc bridges gap; deeper integration future |
| Trains running in cycles | **Deferred** — novel concept, unclear UX |
| Zettelkasten mode for trains | **Deferred** — needs backlink infrastructure |
| Train frontmatter enrichment UI | **Deferred** — low priority; frontmatter updates automatically |
| Multi-window train + canvas | **Deferred** — Obsidian-native, workaround exists |
| AI follow train-of-thought | **Deferred** — requires AI infrastructure |

---

## Related
- PRD: [[Train Improvements PRD]], [[Train of Thoughts PRD]]
- Prior Cycles: [[Cycle 17 - Train Canvas and Branch Merge]], [[Cycle 18 - Train Canvas Visualization]], [[Cycle 19 - Train Merge Rules and Navigation]], [[Cycle 20 - Train Enhancements]]
- Tech Debt: [[TD-122 Systemic empty catch blocks across codebase]] (addressed for train domain in Inc 5)
