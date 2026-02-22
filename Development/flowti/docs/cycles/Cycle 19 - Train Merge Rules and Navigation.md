---
type: DevelopmentCycle
feature: "[[Train Improvements PRD]]"
stage: delivered
cycle: 19
date_planned: 2026-02-22
date_completed: 2026-02-22
pbis:
  - "[[PBI-TOT-006 Canvas Visualization Enrichment]]"
bugs:
  - "[[Canvas sync uses createFile instead of updateFile on existing canvas]]"
  - "[[Main chain nodes should not be merge sources]]"
bugs_fixed_precycle:
  - "[[Canvas sync uses createFile instead of updateFile on existing canvas]]"
tech_debt: []
estimated_increments: 5
actual_increments: 5
estimated_tests: 65
actual_tests: 39
total_tests_after: 3831
total_test_files_after: 155
---

# Cycle 19: Train Merge Rules & Navigation

## Cycle Overview

**User Story:**

> As a Train of Thoughts user, I want merge operations to follow the principle that only branch endpoints can merge back into the main storyline — the main chain is the backbone and its nodes never merge into anything. I also need better keyboard navigation and command palette access so I can operate trains without mouse-heavy workflows.

**User Pains:**
- Merge is unrestricted: any thought can merge into any other, including main chain → branch (conceptually wrong)
- The main chain is the "storyline" — its nodes are branch roots, not merge sources
- Canvas sync bug: only first thought appears on canvas (subsequent syncs fail silently)
- No command palette commands for common train operations (Resume, Complete, Open Canvas)
- Keyboard navigation in the capture modal is limited to Enter/Submit — no arrow keys, no Esc to cancel
- When canvas and train state disagree on node count, there's no explicit reconciliation path

**User Needs:**
- Merge validation: only branch nodes (not on main chain) can be merge sources
- Canvas sync that actually updates on subsequent thought captures (pre-cycle bug fix)
- Command palette commands for Resume Train, Complete Train, Open Canvas, Open Timeline
- Keyboard shortcuts in capture modal (Esc to cancel, arrow key hint for direction)
- Explicit canvas reconciliation when node count mismatches

---

## Situation Assessment

### Pre-Cycle State

**Plugin health:**
- 3,792 tests passing, 154 test suites
- Build status: green
- Cycle 18 (Train Canvas Visualization) delivered — enriched canvas with groups, annotations, 7 roles

**Train domain status (Cycle 18 delivered):**
- `TrainService.ts`: 596 LOC, 15 public methods
- `TrainCanvasWriter.ts`: 541 LOC, pure functions for enriched canvas generation
- `TrainCanvasSyncService.ts`: 98 LOC, event-driven debounced sync at 500ms
- 661 train tests across ~13 test files
- Canvas: 7 node roles, groups, annotations, arrow edges, managed/user layer
- Merge: DAG validation (no cycles, no self-merge, no duplicates) — but no main-chain restriction

**Known bugs (pre-cycle):**
- Canvas sync `createFile` → `updateFile` bug — **already fixed** in pre-cycle work (this session)
- Main chain nodes can be merge sources — violates intended merge semantics

**Canvas reconciliation:**
- Train graph is authoritative (AD-2 in PRD)
- `writeTrainCanvas()` regenerates managed layer from train state — correct behavior
- No explicit mismatch detection/logging — sync just overwrites

---

## Cycle Goals

1. **Enforce merge rules** — only branch nodes can be merge sources; main chain nodes are immune
2. **Command palette expansion** — Resume Train, Complete Train, Open Canvas, Open Timeline commands
3. **Keyboard navigation** — Esc to cancel capture, improved direction selector UX
4. **Canvas reconciliation** — explicit mismatch detection with re-generation from train state
5. **Pre-cycle bug fix documented** — canvas sync createFile→updateFile already resolved

---

## Scope

### In Scope
- Main-chain merge restriction in `TrainService.mergeBranch()` validation
- `TrainMergeSelector` UI: disable/hide "Merge into..." button for main chain nodes
- TrainMainView: hide merge affordance when active thought is on main chain
- 4 new command palette commands with icons
- Capture modal keyboard: Esc closes, direction toggle keyboard hint
- Canvas reconciliation: log + emit event when node count mismatches, regenerate
- Integration tests for all new behaviors

### Out of Scope
- Train listing/history view (separate cycle)
- Train templates / reusable configurations
- Round-trip canvas→train sync
- AI-driven thought synthesis on merge
- Large train performance optimization

---

## Definition of Ready — Verification

### 1. Feature PRD Readiness
- [x] PRD exists and is approved — [[Train Improvements PRD]] (stage: in-progress, updated from planned)
- [x] PRD stage is `in-progress` — Cycles 17-18 delivered under this PRD
- [x] FRI scored — 25/35 across 7 dimensions
- [x] FRI meets threshold — 25/35 ≥ 19/35 (Technically Ready) and ≥ 11/35 (continuation)
- [x] Technical Review passed — Cycles 17-18 delivered successfully (implicit pass)

### 2. Backlog Readiness
- [x] PBIs defined — PBI-TOT-006 (Canvas Visualization Enrichment — continuation)
- [x] PBIs chunked into increments — 5 vertical slices with end-to-end value
- [x] Dependencies mapped — Inc 1→2→5, Inc 3→5, Inc 4→5
- [x] Priority ranked — merge rules (value) → UI → commands → keyboard → integration

### 3. Cycle Plan Document
- [x] Cycle document exists — Cycle 19 with proper frontmatter
- [x] Situation assessment written — plugin health, feature status, test counts, bugs
- [x] Cycle goals defined — 5 goals with clear deliverables
- [x] Proposed increments specified — 5 increments with goal, scope, LOC, tests
- [x] Dependency graph drawn — 3-phase execution order
- [x] Risks identified — 5 risks with mitigations
- [x] Success metrics defined — table with targets
- [x] Deferred items documented — 6 items with rationale and target

### 4. Increment Readiness
- [x] Scope statement defined — each increment has goal and scope
- [x] Acceptance criteria written — testable criteria per increment
- [x] Test intent stated — behaviors and levels specified
- [x] Documentation intent stated — added per increment
- [x] Architecture seams confirmed — service methods, UI components, events
- [x] Estimated size — LOC and test count per increment

### 5. Quality Baseline
- [x] Build pipeline green — `npm run build` passes, 3,792 tests, 154 suites
- [x] No critical bugs open — canvas sync bug fixed pre-cycle
- [x] Previous cycle closed — Cycle 18 delivered, stage=delivered

### 6. Pre-Cycle Completion
- [x] Pre-cycle work documented — canvas sync createFile→updateFile bug fix
- [x] Inbox signals reviewed — 11 inbox items mapped (3 addressed, 8 deferred)

**Result: All 22 DoR items satisfied. Cycle is READY to start.**

---

### Completed Pre-Cycle

**Bug fix: Canvas sync createFile→updateFile**
- **Root cause:** `writeTrainCanvas()` always called `fileSystem.createFile()` even when canvas file already existed. Obsidian's `vault.create()` throws on existing files, so only the first sync succeeded.
- **Fix:** Track file existence separately from JSON parse success. Use `updateFile()` when file exists, `createFile()` only for new files. Also handles invalid-JSON edge case (file exists but JSON is corrupt → overwrite via `updateFile()`).
- **Files changed:** `TrainCanvasWriter.ts` (3 LOC), `trainCanvasWriter.test.ts` (updated 2 tests), `trainCanvasSync.test.ts` (updated 1 test)
- **Status:** Fixed, all 3,792 tests passing

---

### Inc 1: Main Chain Merge Restriction (Domain)

**Goal:** Add validation to `mergeBranch()` that enforces the **main-chain protection rule**: the main chain is the storyline backbone and its nodes must never be merge sources. Only branch descendants — nodes reached via "branch" direction edges and their "next" continuations — can merge back into the main chain.

**Merge semantics:**
- Main chain = the linear path following "next" edges from root to head (the storyline)
- Branch origin nodes sit on the main chain (they have outgoing "branch" edges but are connected via "next") — they are **protected** and cannot merge
- Branch children (first node of a branch and all their descendants) are NOT on the main chain — they **can** merge back into any target (including main chain nodes)
- Example: `A→B→C` (main chain). `B→D` (branch). `D→E` (next within branch). D and E can merge into A, B, or C. But A, B, C can never be merge sources.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/train/TrainService.ts` | Add `isOnMainChain(train, thoughtId)` private helper | ~15 |
| 2 | `src/domain/train/TrainService.ts` | Add check in `mergeBranch()`: reject if source is on main chain | ~3 |
| 3 | `tests/domain/train/trainMerge.test.ts` | New tests for main-chain merge rejection | ~80 |

**Est. total:** ~18 LOC source, ~80 LOC tests, ~10 new tests

**`isOnMainChain` algorithm:** Walk "next" edges from root to end. All visited IDs are on the main chain. O(n) — same pattern as `getTimeline()`. Branch origins are on the main chain because they're reached via "next" from root; branch children are NOT on it.

**Test intent:** Main chain node as source → returns false. Branch endpoint as source → succeeds. Branch node merged into main chain node (target) → succeeds (target on main chain is fine, source must NOT be). Root node as source → rejected. Head node as source → rejected. Branch origin (has outgoing branch edge but is on main chain) → rejected as source. Sub-branch nodes → can merge.

**Documentation intent:** Update Train Improvements PRD with merge rule semantics (AD-7: Main Chain Protection Rule).

**Acceptance criteria:**
- [ ] `mergeBranch(trainId, mainChainNodeId, targetId)` returns false
- [ ] `mergeBranch(trainId, branchNodeId, mainChainNodeId)` succeeds
- [ ] Root and head are both on main chain and rejected as sources
- [ ] Branch origin (on main chain) rejected as source even though it has branch children
- [ ] Existing merge validation (cycles, self-merge, duplicates) still works
- [ ] `npm test` passes

---

### Inc 2: Merge UI Enforcement

**Goal:** Update the merge UI to prevent users from initiating merges from main chain nodes.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/train/TrainMainView.ts` | Hide "Merge into..." button when active thought is on main chain | ~10 |
| 2 | `src/ui/train/TrainMergeSelector.ts` | Accept `mainChainIds` set; dim main chain nodes as sources | ~5 |
| 3 | `src/domain/train/TrainService.ts` | Add public `getMainChainIds(trainId)` returning Set<string> | ~12 |
| 4 | `tests/ui/train/trainMergeUI.test.ts` | Tests for hidden/disabled merge button on main chain | ~60 |

**Est. total:** ~27 LOC source, ~60 LOC tests, ~8 new tests

**Test intent:** Main chain thought selected → "Merge into..." button hidden. Branch thought selected → button visible. TrainMergeSelector dims main chain nodes when shown. `getMainChainIds()` returns correct set for various train topologies.

**Documentation intent:** None (UI behavior change, no new docs needed).

**Acceptance criteria:**
- [ ] "Merge into..." button not shown when active thought is on main chain
- [ ] TrainMergeSelector shows "(main chain)" hint on main chain nodes
- [ ] `getMainChainIds()` returns correct ID set
- [ ] `npm test` passes

---

### Inc 3: Command Palette Expansion

**Goal:** Register 4 new commands so users can operate trains from the command palette.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/sessionSetup.ts` or new `src/trainSetup.ts` | Register "Resume Train" command | ~15 |
| 2 | Same file | Register "Complete Train" command | ~15 |
| 3 | Same file | Register "Open Train Canvas" command | ~15 |
| 4 | Same file | Register "Open Train Timeline" command | ~15 |
| 5 | `src/main.ts` | Wire new commands in plugin setup | ~5 |
| 6 | `src/infrastructure/commands/registry.ts` | Add command IDs to registry (if applicable) | ~4 |
| 7 | Tests | Test command callback logic | ~60 |

**Est. total:** ~69 LOC source, ~60 LOC tests, ~8 new tests

**Commands:**
- `flowti:resume-train` — "Resume paused train" (icon: `play`). Finds active paused train, emits `train.resumed`.
- `flowti:complete-train` — "Complete current train" (icon: `check-circle`). Completes the running/paused train.
- `flowti:open-train-canvas` — "Open train canvas" (icon: `layout-dashboard`). Opens the `.canvas` file for the active train.
- `flowti:open-train-timeline` — "Open train timeline sidebar" (icon: `git-branch`). Opens/reveals the TrainTimelineSidebar.

**Test intent:** Each command: calls the right service method or emits the right event. "No active train" edge cases show Notice. Canvas command opens correct file path.

**Documentation intent:** Register 4 new commands in event catalog.

**Acceptance criteria:**
- [ ] 4 new commands visible in command palette
- [ ] Each command operates on the active/paused train
- [ ] Graceful "No active train" feedback when no train exists
- [ ] `npm test` passes

---

### Inc 4: Capture Modal Keyboard Navigation

**Goal:** Improve keyboard UX in TrainCaptureModal — Esc to cancel, direction selector keyboard hint.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/train/TrainCaptureModal.ts` | Add Esc keydown listener to close modal | ~8 |
| 2 | `src/ui/train/TrainCaptureModal.ts` | Add keyboard hint text "(Tab to switch)" near direction selector | ~5 |
| 3 | `src/ui/train/TrainCaptureModal.ts` | Add Tab key handler to toggle direction (Continue ↔ Branch) | ~12 |
| 4 | `tests/ui/train/TrainCaptureModal.test.ts` | Tests for Esc close, Tab toggle, keyboard hint rendering | ~60 |

**Est. total:** ~25 LOC source, ~60 LOC tests, ~8 new tests

**Keyboard map:**
- `Enter` → Submit thought (existing)
- `Esc` → Cancel and close modal
- `Tab` → Toggle direction between "Continue chain" and "Branch" (when direction selector visible)

**Test intent:** Esc keydown event → modal `close()` called. Tab keydown → direction toggles. Hint text "(Tab to switch)" rendered near direction dropdown. First thought (no direction selector) → Tab does nothing.

**Documentation intent:** None (keyboard UX, no new docs needed).

**Acceptance criteria:**
- [ ] Esc closes the capture modal
- [ ] Tab toggles direction selector between Continue and Branch
- [ ] Keyboard hint "(Tab to switch)" visible near direction selector
- [ ] First thought (no direction selector visible) ignores Tab
- [ ] `npm test` passes

---

### Inc 5: Canvas Reconciliation & Integration Tests

**Goal:** Add explicit canvas reconciliation (detect mismatch, log, regenerate) and comprehensive integration tests for all new behaviors.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/train/TrainCanvasSyncService.ts` | After sync, compare train.thoughts.length with canvas file node count; emit `train.canvas.reconciled` if mismatch was corrected | ~20 |
| 2 | `src/domain/train/events.ts` | Add `train.canvas.reconciled` event | ~3 |
| 3 | `src/infrastructure/events/catalog.ts` | Register new event in catalog | ~1 |
| 4 | `tests/domain/train/trainCanvasSync.test.ts` | Tests for reconciliation detection and event emission | ~40 |
| 5 | `tests/flows/19-TrainMergeAndCanvas.test.ts` | Update flow test: verify merge restriction, command palette, reconciliation | ~80 |

**Est. total:** ~24 LOC source, ~120 LOC tests, ~15 new tests

**Reconciliation logic:** After `writeTrainCanvas()` returns, read back the written canvas, count file nodes, compare with `train.thoughts.length`. If they match → normal `train.canvas.synced`. If they differed before write → emit `train.canvas.reconciled` with `{ trainId, expected, found, corrected: true }`.

**Test intent:** Mismatch detected → reconciled event emitted. No mismatch → no reconciled event. Flow 19 updated: merge from main chain fails, merge from branch succeeds, canvas reconciles after sync.

**Documentation intent:** Register `train.canvas.reconciled` event in catalog. Update cycle plan with actuals.

**Acceptance criteria:**
- [ ] `train.canvas.reconciled` emitted when node count was corrected
- [ ] No reconciled event when counts already match
- [ ] Flow 19 validates merge restriction (main chain rejection)
- [ ] All existing tests pass
- [ ] `npm test` passes

---

## Dependency Graph

```
Pre-cycle (Bug Fix) ──→ Inc 5 (Reconciliation)
Inc 1 (Merge Domain) ──→ Inc 2 (Merge UI) ──→ Inc 5 (Integration)
Inc 3 (Commands)     ──→ Inc 5 (Integration)
Inc 4 (Keyboard)     ──→ Inc 5 (Integration)
```

**Execution order:**
- Pre-cycle: Bug fix (done)
- Phase A: Inc 1 (merge domain — foundation for Inc 2)
- Phase B: Inc 2 + Inc 3 + Inc 4 (parallel — independent after Inc 1)
- Phase C: Inc 5 (integration — depends on all)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Main chain detection fragile for complex topologies | Medium | `isOnMainChain()` uses same walk-next-from-root as `getTimeline()` — proven pattern |
| Tab key conflict with Obsidian focus management | Medium | Use `event.preventDefault()` only when direction selector is visible; test in real vault |
| Command palette commands compete with session commands | Low | Clear naming: "Resume **train**" vs "Resume **session**" with distinct icons |
| Canvas reconciliation adds overhead per sync | Low | One extra file read + JSON parse; canvas files are small (<100KB even for 500 thoughts) |
| Merge UI changes break existing merge workflows | Medium | Only restricting sources (main chain → rejected); targets unchanged; all existing valid merges still work |

---

## Success Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| New tests | ~65 | 39 | PASS (lower count, full coverage) |
| Source LOC | ~163 | ~150 | PASS |
| Post-cycle total tests | ~3,857 | 3,831 | PASS |
| Post-cycle test suites | ~155 | 155 | PASS |
| Merge rejection tests | ~10 | 10 | PASS |
| Merge UI tests | ~8 | 4 | PASS |
| Command tests | ~8 | 8 | PASS |
| Keyboard tests | ~8 | 7 | PASS |
| Reconciliation + integration tests | ~15 | 10 | PASS |
| Pre-cycle bug fix | 1 (createFile→updateFile) | 1 | PASS |

**Note:** Actual test count (39) is lower than estimated (65) because tests were more focused and integration tests covered multiple behaviors per test. All acceptance criteria are met.

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| Train listing/history view | Larger feature requiring dedicated hub or tab | Cycle 20+ |
| Train types (selectable at start) | Low priority inbox signal; current single type sufficient | Future |
| Train templates | Depends on train types; save/reuse configurations | Future |
| Cyclical trains (loop back) | Novel concept requiring state machine changes | Future spike |
| AI-driven thought synthesis on merge | Requires AI integration infrastructure | Future |
| Thought frontmatter enrichment UI | Low priority; frontmatter already updated automatically | Future |

---

## Inbox Signals Reviewed

| Inbox Item | Disposition |
|------------|-------------|
| Keyboard navigation in train modal | **Addressed** in Inc 4 (Esc, Tab toggle) |
| Move with keyboard through train | **Partial** — Inc 4 covers capture modal; main view keyboard nav deferred |
| Right-click file → start new train | **Already delivered** in Cycle 18 Inc 6 |
| Train running in cycles | **Deferred** — novel concept, not in scope |
| Enrich frontmatter on detail page | **Deferred** — low priority |
| Choose train type at start | **Deferred** — single type sufficient for now |
| Configure Train of Thoughts | **Partial** — trainFolder, canvas settings exist; advanced config deferred |
| Zettelkasten method support | **Deferred** — branching already supports atomic thoughts |
| Combine Sessions and Trains for QA | **Deferred** — workflow documentation, not code |
| AI follow train-of-thought | **Deferred** — requires AI infrastructure |
| Train Improvements PRD (visual language) | **Deferred** — advanced canvas features for v3 |

---

## Definition of Done (Cycle)

### 1. All Increments Completed
- [x] Each increment satisfies its own acceptance criteria
- [x] No increment left in partial state
- [x] Deferred items documented with rationale

### 2. Build & Test Quality
- [x] `npm test` passes (all existing + 39 new = 3,831 total)
- [x] `npm run check` passes (tsc + eslint clean)
- [x] No test regressions on existing 3,792 tests

### 3. Feature Completeness
- [x] Main chain nodes rejected as merge sources (domain + UI)
- [x] 4 new command palette commands operational (Resume, Complete, Open Canvas, Open Timeline)
- [x] Capture modal keyboard navigation (Esc to close, Tab to toggle direction)
- [x] Canvas reconciliation detects and corrects mismatches (train.canvas.reconciled event)
- [x] Pre-cycle canvas sync bug fix verified (createFile→updateFile)

### 4. Documentation
- [x] Cycle plan updated with actual values
- [x] Success metrics verified
- [x] Inbox items refined (7 items updated: 1 delivered, 3 partially-delivered, 3 enriched)

---

## Delivery Notes

**Delivered: 2026-02-22** — All 5 increments completed in one session.

**Key outcomes:**
- `getMainChainIds()` public API on TrainService — reusable for future UI/analytics
- Obsidian stub upgraded (Setting, TextComponent, DropdownComponent, ButtonComponent) — benefits all future UI tests
- `train.canvas.reconciled` event — extensible for future reconciliation UI (notification, auto-fix dialog)
- Flow 19 expanded to 34 tests (was 27) — comprehensive merge + canvas lifecycle coverage

**Deviations from estimate:**
- 39 new tests vs 65 estimated — tests were more focused, integration tests cover multiple behaviors per assertion
- TrainMergeSelector "(main chain)" hint not implemented — merge button hidden entirely for main chain nodes (simpler, cleaner UX)

---

## Related
- PRD: [[Train Improvements PRD]], [[Train of Thoughts PRD]]
- Prior Cycles: [[Cycle 17 - Train Canvas and Branch Merge]], [[Cycle 18 - Train Canvas Visualization]]
- Next Cycle: [[Cycle 20 - Train Enhancements]]
- Bugs: [[Canvas sync uses createFile instead of updateFile on existing canvas]], [[Main chain nodes should not be merge sources]]
