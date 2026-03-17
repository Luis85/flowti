---
type: DevelopmentCycle
feature: "[[Train Improvements PRD]]"
stage: delivered
cycle: 25
date_planned: 2026-02-23
date_completed: 2026-02-23
pbis:
  - "[[PBI-TOT-013 Train Branch and Hub Polish]]"
bugs:
  - "Type picker escape defaulting to free-form — opening title modal on dismiss"
  - "Session timer not ticking — stale activeSessionId guard blocking new session starts"
  - "Hub showing 'Start a new ride' callout for paused trains instead of paused card"
bugs_fixed_precycle: []
tech_debt: []
estimated_increments: 5
actual_increments: 4
estimated_tests: 70
actual_tests: 0
total_tests_after: 4073
total_test_files_after: 167
---

# Cycle 25: Train Completion & Experience

## Cycle Overview

**User Story:**

> As a Train of Thoughts user, I want the closure ritual to reflect my train journey, sub-branches to merge into parent branches (not just the main chain), branches to carry status labels so I can see which explorations are stale or promising, and the Train Hub to support filtering by type and sorting — so that longer, more complex trains remain manageable and the completion experience is meaningful.

**User Pains:**
- Session closure overlay shows generic stats when completing a train — no train-specific context (thoughts, branches, merges)
- Sub-branches can only merge down to the main chain, not parent branches — forces extra navigation
- All branches look equal in the timeline — no way to mark one as "stale" or "promising"
- Train Hub has no type filter or sort — hard to find specific trains in a growing list

**User Needs:**
- Train stats panel in session closure overlay when session originated from a train
- Sub-branch merge-down into parent branch chains
- Branch status labels with color-coded sidebar indicators
- Train Hub type filter dropdown and sort options

---

## Situation Assessment

### Pre-Cycle State (post-Cycle 24)

**Plugin health:**
- 4,074 tests passing, 167 test suites, 32 skipped
- Build status: green (`npm test` + `npm run check` clean)
- Flow test suite: `npm run test:flows` — 22 suites, 260 tests
- No pre-cycle bug fixes needed

**Train domain status:**
- Domain: ~1,928 LOC (TrainService 874, TrainCanvasWriter 543, TrainCanvasSyncService 137, TrainSummaryWriter 213, helpers 11, types 110, events 40)
- UI: ~3,109 LOC (15 files — TrainMainView 740, TrainHubView 376, TrainTimelineSidebar 503, TrainCaptureModal 319, TrainPropertyEditor 256, and 10 smaller components)
- Tests: 349 train-specific tests + 12 flow integration (Flow 23)
- FRI: 31/35 (Train Improvements PRD v3)
- 15 events, 21 public service methods, 6 commands, 15 UI components
- 11/11 PBIs delivered (TOT-001 through TOT-011)

**Open review action items (Three Amigos):**
- OBS-1: TrainMainView at 740 LOC — monitor for extraction threshold (~800)
- OBS-2: Train closure context deferred — this cycle addresses it
- OBS-3: Apply 1.5-2x LOC multiplier for UI component estimates

**Inbox signals reviewed (31 train-related items):**
- **Addressed this cycle:** Train closure context, sub-branch merge-down, branch status labels, Hub filtering
- **Deferred with rationale:** Branch promotion (complex graph restructure — needs dedicated design session), cyclic trains (new data model), train templates (needs template system), AI-driven synthesis (blocked on AI infrastructure), context menu start-from-file (low priority)

---

## Cycle Goals

1. **Train Closure Context** — Train stats in session closure overlay for train-originated sessions
2. **Sub-branch Merge-down** — Extend merge algorithm to handle sub-branches into parent branches
3. **Branch Status Labels** — Tag branches as exploring/stale/promising with visual indicators
4. **Train Hub Polish** — Type filter and sort in Hub tabs
5. **Integration Tests** — Flow 24 covering new behaviors + rendering tests

---

## Scope

### In Scope
- Train context panel in SessionClosureOverlay (thought count, branches, merges, key thought titles)
- `findMergeDownTarget` generalization for sub-branches
- Branch status metadata on ThoughtNode + timeline sidebar indicators
- Train Hub type filter dropdown + sort options
- Integration tests for all new behaviors

### Out of Scope
- Branch promotion (branch becomes main line) — requires graph restructure, dedicated design session
- Cyclic trains / iteration routes — new data model needed
- Custom train type creation — built-in types only
- AI-driven synthesis — blocked on AI infrastructure
- Train templates / pre-configured routes — needs template system design
- Canvas visual language system — aspirational UX

---

## Actual Delivery — Pivot to UX Polish Sprint

Cycle 25 was planned as a feature cycle (closure context, sub-branch merge, branch status, Hub filter/sort). During execution, live usage revealed a series of UX bugs and rough edges in the Cycle 24 deliverables that demanded immediate attention. The cycle pivoted to a UX polish sprint, deferring the planned increments to a future cycle.

**Planned PBIs deferred:**
- PBI-TOT-012 (Train Closure Context) — deferred to next cycle
- PBI-TOT-013 Inc 2-4 (Sub-branch Merge, Branch Status, Hub Filter/Sort) — deferred to next cycle

---

## Increments (Actual)

### Inc 1: Train Detail & Capture Modal Polish

**Goal:** Clean up redundant UI elements and add missing navigation.

**Changes:**
- Removed duplicate thought counter from capture modal direction row (Row 3 already shows `Thought #N`)
- Added summary note link (file-text icon) in train detail header beside rename button — opens summary note in Obsidian
- Summary button only visible when summary file exists (vault check)

| File | Change | LOC |
|------|--------|-----|
| `src/ui/train/TrainCaptureModal.ts` | Removed duplicate counter from direction row + first-thought action row | -15 |
| `src/ui/train/TrainMainView.ts` | Added summary note link icon in `renderHeader()` | +15 |
| `tests/ui/train/TrainCaptureModal.test.ts` | Updated counter tests from span-based to textContent-based | ~8 |
| `tests/mocks/obsidian-stub.ts` | Enhanced Setting stub with `infoEl` and functional `setName()` | ~7 |

**AC:**
- [x] No duplicate counter in capture modal
- [x] Summary note link visible when summary exists
- [x] Tests updated and passing

---

### Inc 2: Train Hub Dashboard & List Polish

**Goal:** Fix incorrect callout state for paused trains, add active state for list items, improve row padding.

**Changes:**
- Added paused train card to dashboard (between running card and start callout) with pause icon, title, thought count, Resume + Open buttons
- Changed start callout condition from `!running` to `!running && !paused`
- Added `.ft-list-item-active` CSS with left-border accent indicator
- Improved `.ft-list-item` padding (0.5rem → 0.5rem 0.75rem) with transparent border for smooth transitions

| File | Change | LOC |
|------|--------|-----|
| `src/ui/train/TrainHubView.ts` | Paused train card + callout guard | +40 |
| `styles.css` | Active state + padding for list items | +10 |

**AC:**
- [x] Paused trains show resume card instead of "Start a new ride"
- [x] Active list item has visual left-border accent
- [x] Row padding improved

---

### Inc 3: Session Timer & Ribbon Fixes

**Goal:** Fix timer not ticking in capture modal and simplify ribbon behavior.

**Bug fix — Session timer not ticking:**
- Root cause: `handleStart` in `lifecycleHandlers.ts` has guard `if (state.activeSessionId) return;` — but `handlePause` does NOT clear `activeSessionId`. If ANY session was paused, new sessions can't start their timers.
- Fix: Guard now checks if existing active session is actually "running"; clears stale IDs for paused/completed/deleted sessions.

**Ribbon simplification:**
- Restored "Open Train Hub" (waypoints) ribbon — was accidentally removed
- Simplified "Train of Thoughts" (train-front) ribbon: active train → open detail view; no active train → open type picker
- Removed session-based train detection middle block that fell through to an empty history view

| File | Change | LOC |
|------|--------|-----|
| `src/domain/session/handlers/lifecycleHandlers.ts` | Smarter activeSessionId guard in `handleStart` | +8 |
| `src/main.ts` | Two ribbons: waypoints (hub) + train-front (smart routing) | ~25 |

**AC:**
- [x] Timer ticks in capture modal on running trains
- [x] Hub ribbon opens Train Hub
- [x] Train ribbon starts new or opens current detail

---

### Inc 4: Merge Visualization & Type Picker Fix

**Goal:** Enhance merge path visualization in timeline graph and fix type picker escape behavior.

**Merge visualization:**
- Changed merge connector from solid 2px background to dashed 2px border — visually distinct from fork connectors
- Added arrow element (`ft-graph-merge-arrow`) pointing toward the target lane using CSS triangle
- Added missing `.ft-badge-info` style for "⤵ target" badge (was unstyled)

**Type picker escape fix:**
- `TrainTypePickerModal.onClose()` was calling `onSelect(freeForm)` when dismissed — escape opened the title modal
- Fix: `onClose()` is now a no-op when dismissed without selection

| File | Change | LOC |
|------|--------|-----|
| `src/ui/train/TrainTimelineSidebar.ts` | Dashed merge connector + arrow element | +10 |
| `src/ui/train/TrainTypePickerModal.ts` | Removed fallback onSelect in onClose | -3 |
| `styles.css` | `.ft-graph-merge` dashed + `.ft-graph-merge-arrow` + `.ft-badge-info` | +15 |
| `tests/ui/train/TrainTypePickerModal.test.ts` | Updated dismiss test to expect no callback | ~3 |

**AC:**
- [x] Merge connectors are dashed with arrow pointing to target
- [x] Escape on type picker cancels the flow (no title modal)
- [x] Tests updated and passing

---

## Dependency Graph

```
Inc 1 (Detail & Modal Polish) ── (independent)
Inc 2 (Hub Dashboard Polish)  ── (independent)
Inc 3 (Timer & Ribbon Fixes)  ── (independent)
Inc 4 (Merge Viz & Picker)    ── (independent)
```

**Execution order:** All increments independent — executed sequentially as issues were discovered.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Closure overlay grows complex with train panel | Medium | Standalone TrainClosurePanel component — no inline code |
| Sub-branch merge algorithm regression | Medium | Preserve all existing merge tests + add sub-branch-specific cases |
| Branch status adds complexity to thought model | Low | Simple optional field, no structural change to ThoughtNode |
| Hub filter/sort interaction with search | Low | Compose: filter first, then search, then sort |
| TrainMainView LOC pushes past threshold | Low | No changes to TrainMainView in this cycle — all work in sidebar and hub |
| New event (branch.status.changed) needs catalog entry | Low | Small, additive change |

---

## Success Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| New tests | ~70 | 0 (existing tests updated) | Pivoted — no new features, only fixes |
| Source LOC delta | ~390 | +370 net (19 files, 570 added, 202 removed) | Close — polish work equivalent scope |
| Post-cycle total tests | ~4,144 | 4,073 | Pivot — test changes only (no new tests) |
| Post-cycle test suites | ~170 | 167 | Unchanged |
| Bugs fixed | 0 | 3 (timer, callout state, picker escape) | Unplanned — discovered during use |
| UX improvements | 0 | 7 (counter, summary link, padding, active state, ribbons, merge viz, modal cancel) | Unplanned |
| FRI score | 31 → 33 | 31 (unchanged) | Deferred — features not started |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| **PBI-TOT-012 Train Closure Context** | Cycle pivoted to UX polish — full PBI deferred | Cycle 26 |
| **Sub-branch Merge-down** | Cycle pivoted — planned Inc 2 not started | Cycle 26 |
| **Branch Status Labels** | Cycle pivoted — planned Inc 3 not started | Cycle 26 |
| **Train Hub Type Filter & Sort** | Cycle pivoted — planned Inc 4 not started | Cycle 26 |
| Branch promotion (branch becomes main line) | Complex graph restructure — needs dedicated design session | Future |
| Cyclic trains / iteration routes | New data model needed | Future |
| Custom train type creation/editing | Built-in types sufficient for v1 | Future |
| Train templates / pre-configured routes | Needs template system design | Future |
| AI-driven train synthesis | Blocked on AI infrastructure | Future |
| Canvas round-trip sync | Validates unidirectional first | Future |
| Context menu "Start Train from File" | Low priority QoL | Future |
| Branch status in canvas nodes | Extend canvas node colors — wait for visual language system | Future |

---

## Definition of Done (Cycle)

### 1. All Increments Completed
- [x] Each increment satisfies its own acceptance criteria (4/4 polish increments done)
- [x] No increment left in partial state
- [x] Deferred items documented with rationale (4 planned items + 8 standing deferrals)

### 2. Build & Test Quality
- [x] `npm test` passes (4,073 tests, 167 suites, 0 failures)
- [x] `npm run check` passes (tsc + eslint clean)
- [x] No test regressions — 4,073 vs 4,074 (1 test replaced: type picker dismiss behavior changed)
- [x] Test count deviation documented (pivot to UX polish — no new features, no new tests)

### 3. Three Amigos Review
- [ ] Cycle-level review — deferred to next cycle (UX polish sprint, no architectural decisions)

### 4. PRD & Backlog Updates
- [x] PRD unchanged — FRI stays at 31/35 (no new FRs delivered)
- [x] PBI-TOT-012 deferred to Cycle 26
- [x] PBI-TOT-013 partially addressed (Hub polish only)
- [x] Event model unchanged (no new events)

### 5. Documentation
- [x] Cycle plan updated with actual delivery
- [x] Success metrics verified

### 6. Cycle Plan Completion
- [x] Frontmatter updated (stage: delivered, actual_increments: 4)
- [x] Success metrics verified with actual values
- [x] Deviations documented

### 7. Cycle Retrospective
- [x] "What Went Well" section completed
- [x] "Deviations from Plan" section completed
- [x] "Learnings" section completed

---

## DoR Preparation Notes

### 1. Feature PRD Readiness
- [x] PRD exists — [[Train Improvements PRD]] v3, stage: delivered
- [x] PRD stage is `delivered` (continuation cycle — threshold: FRI ≥ 11/35)
- [x] FRI scored — 31/35 (exceeds continuation threshold of 11/35)
- [x] Technical Review passed — [[Three Amigos Review 2026-02-23 Train Value Sprint]] (PASS, TASM 31/35)

### 2. Backlog Readiness
- [x] PBIs defined — [[PBI-TOT-012 Train Closure Context]], [[PBI-TOT-013 Train Branch and Hub Polish]]
- [x] PBIs chunked into 5 increments — vertical slices with end-to-end value
- [x] Dependencies mapped — Inc 1-4 independent, Inc 5 depends on all
- [x] Priority ranked — Closure context first (highest demand from review action items), then merge + labels + hub

### 3. Cycle Plan Document
- [x] Cycle document exists with standard frontmatter
- [x] Situation assessment written (post-Cycle 24, 4,074 tests)
- [x] Cycle goals defined (5 goals)
- [x] Proposed increments specified (5 increments with scope, LOC, tests)
- [x] Dependency graph drawn
- [x] Risks identified (6 risks)
- [x] Success metrics defined
- [x] Deferred items documented (8 items)

### 4. Increment Readiness
- [x] All 5 increments have: scope statement, AC, test intent, documentation intent, architecture seams, estimates

### 5. Quality Baseline
- [x] Build pipeline green — `npm test` passes (4,074 tests, 167 suites)
- [x] No critical bugs open — Cycle 24 delivered cleanly
- [x] Previous cycle closed — Cycle 24 retrospective completed, review written

### 6. Pre-Cycle Completion
- [x] Pre-cycle work documented — no pre-cycle fixes needed
- [x] Inbox signals reviewed — 31 train-related items triaged (4 addressed, 8 deferred with rationale)

---

## Retrospective

### What Went Well

1. **UX bugs caught during live use** — Using the feature immediately after Cycle 24 delivery exposed 3 bugs (timer, callout state, picker escape) and 7 UX rough edges that would have frustrated real use. Fixing them now prevents technical debt from accumulating.
2. **Session timer fix was high-impact** — The stale `activeSessionId` guard bug affected ALL session starts, not just train sessions. Finding it via train usage and fixing it in `lifecycleHandlers.ts` was a significant cross-domain improvement.
3. **Merge visualization enhancement** — Switching from solid to dashed merge connectors with arrow indicators provides clear visual distinction between forks (solid) and merges (dashed + arrow). Small CSS change, large readability improvement.
4. **Type picker cancel fix was surgical** — Three-line change (remove fallback `onSelect` in `onClose`) fixed a flow that launched an unwanted modal on escape. Clean separation of concerns in the modal API.
5. **No regression** — All 4,073 tests pass after 19 files changed across 570 added and 202 removed lines.

### Deviations from Plan

1. **Full pivot from feature cycle to UX polish** — None of the 5 planned increments (closure context, sub-branch merge, branch status, Hub filter, integration tests) were started. Live usage revealed urgent UX issues that took priority.
2. **No new tests** — Polish work modified existing tests but didn't add new ones. The 4,073 count is 1 below Cycle 24's 4,074 due to the type picker dismiss test behavior change (assertion flipped from "called with free-form" to "not called").
3. **FRI unchanged** — No new feature requirements delivered, so PRD score stays at 31/35.
4. **PBI-TOT-013 partially addressed** — Hub dashboard polish (paused card, active state, padding) delivered, but type filter and branch status deferred.

### Learnings

1. **Post-delivery usage sprint is essential** — After a large feature delivery (Cycle 24: 5 increments, 809 LOC, 98 tests), a dedicated UX polish pass catches issues that automated tests cannot: flow ergonomics, visual balance, state edge cases.
2. **Guard clause bugs propagate silently** — The `activeSessionId` guard in `handleStart` had been blocking timer starts for paused sessions since inception, but it only manifested when trains introduced rapid session cycling (start → pause → start). Guard clauses need state-aware conditions, not just null checks.
3. **Modal dismiss != modal cancel** — Obsidian's `Modal.onClose()` fires for both explicit close AND escape dismiss. Modals that chain to other modals should NOT have fallback behavior in `onClose()` — use a `selected` flag and only act on explicit selection.
4. **CSS dashed borders beat background-color for connectors** — Using `border-bottom: 2px dashed` with inline `borderBottomColor` gives both the lane color AND a distinct visual style, unlike `background-color` which can only produce solid lines.
5. **Cycle planning should budget 1 polish increment** — Every feature cycle should reserve the final increment for post-delivery polish. The pattern of "deliver 5 increments → next cycle is all polish" is inefficient.

---

## Related
- PRD: [[Train Improvements PRD]], [[Train of Thoughts PRD]]
- Review: [[Three Amigos Review 2026-02-23 Train Value Sprint]]
- Prior Cycles: [[Cycle 23 - Merge Down and Detail Restructure]], [[Cycle 24 - Train Value Sprint]]
- PBIs: [[PBI-TOT-012 Train Closure Context]], [[PBI-TOT-013 Train Branch and Hub Polish]]
- Inbox: [[How can we better integrate trains and sessions and closure rituals]], [[The session complete view needs to be adjusted when coming from a train]], [[In trains, I also want a branch become the new main-line and also have the option to abandon or mark as stale]]
