---
type: DevelopmentCycle
feature: "[[Train Improvements PRD]]"
stage: delivered
cycle: 18
date_planned: 2026-02-22
date_completed: 2026-02-22
pbis:
  - "[[PBI-TOT-006 Canvas Visualization Enrichment]]"
bugs:
  - "[[Right-click Add to Train shows on completed trains]]"
bugs_fixed_precycle: []
tech_debt: []
estimated_increments: 7
actual_increments: 7
estimated_tests: 85
actual_tests: 48
total_tests_after: 3792
total_test_files_after: 154
---

# Cycle 18: Train Canvas Visualization

## Cycle Overview

**User Story:**

> As a Train of Thoughts user, I want the auto-generated canvas to be a genuinely useful spatial visualization of my thought journey — with readable nodes, visual grouping of branches, contextual annotations, and meaningful edge styling — so that opening the canvas provides real insight rather than a list of tiny rectangles.

**User Pains:**
- File nodes at 250×60px are too small for Obsidian to render any content preview — unreadable
- Only 3 node colors with no way to distinguish root, leaf, merge source from normal thoughts
- No grouping — branches float in space with no visual containment
- No metadata annotations — the canvas shows nothing about the train itself
- Fixed layout with minimal spacing produces a cramped, hard-to-navigate canvas
- Edges lack arrow heads — direction of thought flow is unclear
- Right-click "Add to" menu shows for completed train sessions (should offer "Start new Train")

**User Needs:**
- Nodes large enough to see Obsidian's content preview (minimum 400×200)
- Visual grouping of branches via canvas group nodes
- Contextual annotations for train metadata and branch labels
- Proper arrow heads with color differentiation by edge type
- Expanded role system with richer visual differentiation
- Train-aware right-click context menu

---

## Situation Assessment

### Pre-Cycle State

**Plugin health:**
- 3,744 tests passing, 153 test suites
- Build status: green
- Cycle 17 (Train Canvas & Branch Merge) delivered — canvas generation working but basic

**Train Canvas status (Cycle 17 delivered):**
- `TrainCanvasWriter.ts`: 268 LOC, pure functions for canvas generation
- `TrainCanvasSyncService.ts`: 98 LOC, event-driven debounced sync at 500ms
- Layout: top-to-bottom DFS with fixed spacing (NODE_WIDTH=250, NODE_HEIGHT=60, SPACING_Y=120)
- Node types: file nodes only, 3 role colors (head/branch-origin/merge-target)
- Edge types: next (no label), branch (label), merge (blue + label)
- Layer merge: `ft-*` prefix for managed elements, user elements preserved
- 68 canvas tests (36 writer + 14 sync + 18 flow)

**Canvas infrastructure available:**
- `CanvasGroupData`: `{ type: "group", label?, background?, backgroundStyle? }`
- `CanvasTextData`: `{ type: "text", text: string }` — supports markdown
- `CanvasEdgeData`: `fromEnd`/`toEnd` with `'none'|'arrow'`
- Colors: `'0'`–`'5'` built-in + hex custom
- Proven patterns in CanvasRebuilder and CanvasParser for groups and text nodes

---

## Cycle Goals

1. **Readable nodes** — increase file node size from 250×60 to 400×200 with appropriate spacing
2. **Expanded role system** — 7+ roles with richer color palette
3. **Edge enrichment** — arrow heads, color per type, improved merge routing
4. **Visual grouping** — canvas group nodes for main chain and branches
5. **Contextual annotations** — text nodes for train metadata and branch labels
6. **Train-aware file menu** — fix "Add to" for completed trains, add "Start new Train" option
7. **Integration validation** — updated flow tests, backward compatibility

---

## Scope

### In Scope
- Enlarge file nodes to 400×200 with proportional spacing
- Expand `NodeRole` from 4 to 7+ roles with color mapping
- Add `toEnd: "arrow"` on all edges with color by type
- Generate `CanvasGroupData` nodes for main chain and branches
- Generate `CanvasTextData` nodes for header and branch annotations
- New ID prefixes: `ft-g-` (groups), `ft-a-` (annotations)
- Fix session file-menu for train context awareness
- Add "Start new Train from this file" right-click option
- Backward compatibility: existing canvases upgrade on next sync

### Out of Scope
- Round-trip sync (canvas→train) — one-way only
- Horizontal / radial layout modes — vertical top-to-bottom only
- User-configurable node sizing or canvas settings
- Large train optimization (>100 thoughts)
- Thought content preview as companion text nodes

---

### Inc 1: Node Sizing & Layout Breathing Room

**Goal:** Make file nodes large enough for Obsidian to render content previews. Adjust all spacing.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/train/TrainCanvasWriter.ts` | Update constants: `NODE_WIDTH=400`, `NODE_HEIGHT=200`, `SPACING_Y=280`, `BRANCH_LANE_WIDTH=500` | ~8 |
| 2 | `tests/domain/train/trainCanvasWriter.test.ts` | Update all layout position assertions for new constants | ~30 |

**Est. total:** ~8 LOC source, ~30 LOC test updates, 0 new tests

**Test intent:** All existing layout tests pass with updated constant values. Node dimensions verified at 400×200. Spacing verified at 280px vertical, 500px between lanes.

**Acceptance criteria:**
- [ ] `NODE_WIDTH=400`, `NODE_HEIGHT=200`, `SPACING_Y=280`, `BRANCH_LANE_WIDTH=500`
- [ ] All existing layout tests pass with updated positions
- [ ] `npm test` passes

---

### Inc 2: Expanded Node Roles & Color Palette

**Goal:** Expand from 4 roles to 7+ with richer visual differentiation.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/train/TrainCanvasWriter.ts` | Expand `NodeRole` type: add `"root"`, `"leaf"`, `"merge-source"` | ~5 |
| 2 | `src/domain/train/TrainCanvasWriter.ts` | Update `computeNodeRoles()` with priority chain and new detection logic | ~40 |
| 3 | `src/domain/train/TrainCanvasWriter.ts` | Update `ROLE_COLOR` map with new colors | ~10 |
| 4 | `tests/domain/train/trainCanvasWriter.test.ts` | New tests for root/leaf/merge-source detection and priority | ~120 |

**Est. total:** ~55 LOC source, ~120 LOC tests, ~15 new tests

**Test intent:** Root: first thought with no incoming edges → yellow (`"3"`). Leaf: branch endpoint with no outgoing → purple (`"1"`). Merge-source: outgoing merge relation → custom hex. Priority: head > merge-target > merge-source > branch-origin > root > leaf > normal.

**Acceptance criteria:**
- [ ] `NodeRole` includes: `"root"`, `"head"`, `"leaf"`, `"branch-origin"`, `"merge-target"`, `"merge-source"`, `"normal"`
- [ ] Root gets yellow, leaf gets purple, merge-source gets distinct color
- [ ] Role priority resolves multi-role conflicts correctly
- [ ] `npm test` passes

---

### Inc 3: Edge Arrows & Visual Styling

**Goal:** Add directional arrow heads, color-code edges by type, improve merge routing.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/train/TrainCanvasWriter.ts` | Add `toEnd: "arrow"`, `fromEnd: "none"` on all edges | ~10 |
| 2 | `src/domain/train/TrainCanvasWriter.ts` | Branch edges: color `"2"` (orange). Merge: `fromSide: "right"`, `toSide: "left"` | ~8 |
| 3 | `tests/domain/train/trainCanvasWriter.test.ts` | Tests for arrow heads, edge colors, routing sides | ~80 |

**Est. total:** ~18 LOC source, ~80 LOC tests, ~10 new tests

**Acceptance criteria:**
- [ ] All edges have `toEnd: "arrow"` (visible direction)
- [ ] Branch edges colored orange (`"2"`)
- [ ] Merge edges route horizontally (right→left)
- [ ] `npm test` passes

---

### Inc 4: Canvas Groups for Visual Organization

**Goal:** Generate `CanvasGroupData` nodes to visually contain main chain and branches.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/train/TrainCanvasWriter.ts` | Add `GROUP_PREFIX = "ft-g-"`, `groupId()` helper | ~8 |
| 2 | `src/domain/train/TrainCanvasWriter.ts` | New `computeGroups(train, positions)`: main chain group + per-branch groups with bounding boxes | ~80 |
| 3 | `src/domain/train/TrainCanvasWriter.ts` | Update `generateTrainCanvasData()` to include group nodes, widen to `AllCanvasNodeData[]` | ~20 |
| 4 | `tests/domain/train/trainCanvasWriter.test.ts` | Tests for groups: bounding boxes, labels, IDs, padding, edge cases | ~150 |

**Est. total:** ~108 LOC source, ~150 LOC tests, ~20 new tests

**Test intent:** Main chain group contains all "next"-connected nodes with label "Main Chain" (color "3"). Branch groups per branch origin with label "Branch from: {title}" (color "2"). Bounding box encompasses contained nodes + GROUP_PADDING. `ft-g-*` IDs are managed elements. Single-thought trains produce no groups.

**Acceptance criteria:**
- [ ] Main chain group contains linear "next" chain, labeled "Main Chain"
- [ ] Branch groups contain branch descendants, labeled with origin
- [ ] Bounding boxes correct with padding
- [ ] Group IDs use `ft-g-` prefix (managed elements)
- [ ] Single-thought trains produce no groups
- [ ] `npm test` passes

---

### Inc 5: Header & Branch Annotations (Text Nodes)

**Goal:** Generate `CanvasTextData` nodes for train metadata and branch context.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/train/TrainCanvasWriter.ts` | Add `ANNOTATION_PREFIX = "ft-a-"`, `annotationId()` helper | ~8 |
| 2 | `src/domain/train/TrainCanvasWriter.ts` | New `computeAnnotations(train, positions)`: header + branch annotations | ~70 |
| 3 | `src/domain/train/TrainCanvasWriter.ts` | Update `generateTrainCanvasData()` to include annotations | ~10 |
| 4 | `tests/domain/train/trainCanvasWriter.test.ts` | Tests for annotation content, positioning, IDs, edge cases | ~120 |

**Est. total:** ~88 LOC source, ~120 LOC tests, ~15 new tests

**Test intent:** Header annotation (ID `ft-a-header`): positioned above root, markdown with `# {title}`, status, stats. Branch annotations (ID `ft-a-branch-{originId}`): positioned near branch group, `"Branch ({N} thoughts)"`. Empty trains produce no annotations. All use `ft-a-` prefix.

**Acceptance criteria:**
- [ ] Header annotation shows title, status, thought count, duration
- [ ] Branch annotations show thought counts near branch origins
- [ ] Annotation IDs use `ft-a-` prefix (managed elements)
- [ ] Empty/single-thought trains handled gracefully
- [ ] `npm test` passes

---

### Inc 6: File-Menu Fix — Train Context Awareness

**Goal:** Fix right-click: hide "Add to" for completed train sessions, add "Start new Train from this file."

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/sessionSetup.ts` | In `registerFileMenuItems()`, skip "Add to" when session is train-of-thought type AND train is completed | ~10 |
| 2 | `src/sessionSetup.ts` | Add train service reference to SessionSetupDeps | ~5 |
| 3 | `src/sessionSetup.ts` or `src/main.ts` | Add "Start new Train from this file" menu item for .md files | ~30 |
| 4 | `src/main.ts` | Pass trainService to sessionSetup deps | ~3 |
| 5 | New or existing test file | Tests for menu item visibility logic | ~80 |

**Est. total:** ~48 LOC source, ~80 LOC tests, ~10 new tests

**Acceptance criteria:**
- [ ] "Add to" hidden when session is a completed train session
- [ ] "Start new Train from this file" visible for .md files
- [ ] Clicking starts a train with the file pre-bound
- [ ] `npm test` passes

---

### Inc 7: Integration Tests & Polish

**Goal:** Update Flow 19, backward compatibility checks, full pipeline validation.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `tests/flows/19-TrainMergeAndCanvas.test.ts` | Update: verify groups, annotations, mixed node types | ~60 |
| 2 | `tests/domain/train/trainCanvasWriter.test.ts` | Backward compat: old canvas with only file nodes upgrades cleanly | ~40 |
| 3 | `tests/domain/train/trainCanvasWriter.test.ts` | Full pipeline: complex train → complete canvas with all element types | ~60 |

**Est. total:** ~0 LOC source, ~160 LOC tests, ~15 new tests

**Acceptance criteria:**
- [ ] Flow 19 validates groups and annotations in canvas output
- [ ] Old canvases upgrade on next sync
- [ ] User elements preserved through enriched sync
- [ ] All 3,744+ existing tests pass
- [ ] `npm test` passes

---

## Dependency Graph

```
Inc 1 (Node Sizing) ──→ Inc 4 (Groups)      ──→ Inc 7 (Integration)
                    └──→ Inc 5 (Annotations) ──→ Inc 7
Inc 2 (Roles)       ──→ Inc 7
Inc 3 (Edges)       ──→ Inc 7
Inc 6 (File Menu)   ──→ Inc 7  (independent of canvas incs)
```

**Recommended execution order:**
Phase A: Inc 1 (foundation — spacing for all subsequent incs)
Phase B: Inc 2 + Inc 3 + Inc 6 (parallel — independent)
Phase C: Inc 4 + Inc 5 (parallel — both use Inc 1 positions)
Phase D: Inc 7 (depends on all)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Larger nodes make complex trains overflow canvas viewport | Medium | Obsidian canvas supports infinite pan/zoom; structural navigation works regardless |
| Group bounding box calculation incorrect for nested branches | Medium | `computeGroups()` is pure and fully testable; comprehensive tests for all topologies |
| `mergeCanvasLayers()` type widening breaks callers | High | Already uses `CanvasData` which accepts `AllCanvasNodeData[]`; widening is compatible |
| Existing test assertions break due to constant changes | Medium | Inc 1 is mechanical constant update; run full suite after each change |
| Canvas file size grows with groups and annotations | Low | Even 500 thoughts adds ~100 extra JSON nodes — well under Obsidian limits |

---

## Success Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| New tests | ~85 | 48 | Below target (pure function tests cover more per test) |
| Source LOC | ~320 | ~280 | On target |
| Node sizing tests | 0 (updates) | 0 (updates) | Done |
| Role tests | ~15 | 8 | Done |
| Edge tests | ~10 | 4 | Done |
| Group tests | ~20 | 11 | Done |
| Annotation tests | ~15 | 10 | Done |
| File-menu tests | ~10 | 10 | Done |
| Integration tests | ~15 | 9 | Done |
| Post-cycle total | ~3,830 | 3,792 | Done |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| Round-trip canvas→train sync | Complex bidirectional; one-way proves concept first | Train v3 |
| Horizontal / radial layout | Vertical sufficient for enrichment; layout modes are a separate feature | Train v3 |
| User-configurable node sizing | Fixed sizes adequate; settings add complexity | Future |
| Thought preview text nodes | Risk of stale content on sync; file nodes show live preview | Future |
| Large train performance | Current pipeline O(n); acceptable at normal scale | Future spike |

---

## Definition of Done (Cycle)

### 1. All Increments Completed
- [x] Each increment satisfies its own acceptance criteria
- [x] No increment left in partial state
- [x] Deferred items documented with rationale

### 2. Build & Test Quality
- [x] `npm test` passes (all existing + 48 new = 3,792 total)
- [x] `npm run check` passes (tsc + eslint clean)
- [x] No test regressions on existing 3,744 tests

### 3. Feature Completeness
- [x] File nodes at 400×200 (readable in Obsidian canvas)
- [x] 7 node roles with color differentiation (root, head, leaf, branch-origin, merge-target, merge-source, normal)
- [x] All edges have arrow heads with type-based colors (branch=orange, merge=blue, next=default)
- [x] Group nodes contain main chain and each branch
- [x] Header annotation shows train title, status, thought count, duration
- [x] Branch annotations show thought counts
- [x] File-menu train-aware (no "Add to" on completed train, "Start new Train from this file" available)
- [x] User elements preserved across enriched canvas sync

### 4. Documentation
- [x] Cycle plan updated with actual values
- [x] Success metrics verified

---

## Related
- PRD: [[Train Improvements PRD]], [[Train of Thoughts PRD]]
- Prior Cycle: [[Cycle 17 - Train Canvas and Branch Merge]]
- Next Cycle: [[Cycle 19 - Train Merge Rules and Navigation]]
- Bug: [[Right-click Add to Train shows on completed trains]]
