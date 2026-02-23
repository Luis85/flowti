---
domain: Session
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: delivered
maturity: L2
version: 3
created: 2026-02-22
updated: 2026-02-23
foundation: "[[Train of Thoughts PRD]]"
maturity_score_strategy: 4
maturity_score_scope: 5
maturity_score_architecture: 5
maturity_score_event_integration: 4
maturity_score_data_model: 4
maturity_score_ui_consistency: 5
maturity_score_validation_testing: 4
business_value: 4
implementation_cost: 3
maintenance_cost: 3
discovery_cost: 2
design_cost: 3
test_cost: 3
priority: 3
fri_score: 31
tags:
  - session
  - train-of-thought
  - canvas
  - merge
planned_in:
  - "[[Cycle 17 - Train Canvas and Branch Merge]]"
  - "[[Cycle 22 - Train Polish and Management]]"
  - "[[Cycle 23 - Merge Down and Detail Restructure]]"
  - "[[Cycle 24 - Train Value Sprint]]"
  - "[[Cycle 25 - Train Completion and Experience]]"
---

# Feature PRD: Train of Thoughts — Branch Merge & Canvas Journey

> Inbox source: [[Train Improvements]]

---

## 1. Vision & Strategic Context

> Thinking happens in chains — and sometimes chains converge. This increment extends Train of Thoughts with branch merge capabilities and a synchronized Canvas visualization of the thought journey.

**Strategic position**: Train of Thoughts (Cycles 13-14) established serial capture with branching. This increment adds the two most requested capabilities: convergence (merge) and spatial visualization (canvas). Together they complete the non-linear thinking model — diverge, explore, converge, visualize.

**Builds on:**
- **Train of Thoughts PRD** (FRI 33/35, done): serial capture, branching, timeline sidebar, session integration
- **Canvas Integration** (Cycle 15): canvas parsing, rebuilding, `.canvas` file generation

**Canvas strategy**: Train Canvas is a **derived but interactive** view of the train graph. The train graph (ThoughtNode[] + ThoughtRelation[]) is authoritative. Canvas is regenerated from graph state while preserving user-added elements.

---

## 2. Problem Statement

### What Exists
- Serial thought capture with Enter-key flow (Train of Thoughts, Cycle 13)
- Branching from earlier thoughts (divergence)
- Timeline sidebar with tree visualization
- Train Main View with navigation and detail
- Canvas import pipeline with `.canvas` file read/write (Cycle 15)

### What's Missing
- **No convergence**: branches diverge but cannot merge back. Users who explore alternatives have no way to synthesize insights.
- **No spatial visualization**: the timeline sidebar is hierarchical but not spatial. Users cannot see the full journey structure at a glance.
- **No elaboration workspace**: after pausing, users can review thoughts but cannot visually organize them in spatial context.

### User Need
When thinking non-linearly, users need to diverge (branch), converge (merge), and spatially organize (canvas). The current feature supports only divergence.

---

## 3. Objectives

### Primary
1. Enable merging of thought branches (structural metadata connection, not content merge)
2. Auto-generate a Train Canvas as synchronized visual journey map
3. Keep capture frictionless — canvas updates happen in background
4. Preserve user additions to canvas (non-destructive sync)

### Secondary
1. Establish a reusable managed/user layer pattern for future canvas features
2. Prepare foundation for Story Maps, Event Maps, and other visual features

---

## 4. Non-Goals

- No semantic/content merging (merge is structural connection only)
- No AI-based restructuring
- No replacement of Timeline sidebar (canvas is complementary)
- No manual Canvas maintenance required from user
- No breaking changes to capture loop
- No round-trip sync (canvas→train) — one-way only (train→canvas)
- No visual language system in this increment (deferred to v2)

---

## 5. Architecture Decisions

### AD-1: Train Graph is a DAG
The train graph is a Directed Acyclic Graph. Cycles are not allowed. Merge validation must prevent cycle creation. This keeps the graph simple and the timeline renderable.

### AD-2: Canvas is a Derived View
Train graph (ThoughtNode[] + ThoughtRelation[]) is the single source of truth. Canvas is regenerated from graph state. Canvas file is never the authority — it is always rebuildable from the graph.

### AD-3: Managed/User Layer via ID Namespace
System-managed canvas elements use deterministic IDs with `ft-` prefix (e.g., `ft-t-{thoughtId}` for nodes, `ft-e-{fromId}-{toId}` for edges). On sync, the system replaces all `ft-` prefixed elements and preserves everything else. This cleanly separates managed from user elements without requiring metadata tags or dual files.

### AD-4: Deterministic Layout
Top-to-bottom direction (time flows down). Main chain centered at x=0. Branches offset right by `BRANCH_LANE_WIDTH` per branch index. Fixed node dimensions (250w × 60h). New nodes appended at bottom — existing positions remain stable.

### AD-5: Canvas Creation Timing
Canvas is created on first thought capture (not on train start). This avoids empty canvas files. A setting controls whether canvas generation is enabled at all.

### AD-6: Sync is Event-Driven and Debounced
Canvas sync triggers on train events (`train.thought.added`, `train.branch.merged`, `train.branch.merge.undone`). Sync is debounced at 500ms to avoid rapid-fire writes during fast capture.

---

## 6. Functional Requirements

### FR-01: Branch Merge
The system must allow merging a branch endpoint into a target thought on the main chain or another branch.

**Behavior:**
- User selects a branch endpoint thought
- User selects a merge target (any thought not on the same branch)
- System creates a `"merge"` relation from source to target
- Source thought gets `merge-target` frontmatter link
- Merge is visible in timeline sidebar and canvas

**Validation rules:**
- No self-merge (source ≠ target)
- Target must exist in the same train
- No duplicate merges (same source→target pair)
- No cycle creation (target must not be a descendant of source in any path)

### FR-02: Undo Merge
The system must allow reversing a merge operation.

**Behavior:**
- User selects a merged thought
- System removes the merge relation
- Source thought's `merge-target` frontmatter link is removed
- Timeline and canvas update to reflect removal

### FR-03: Train Canvas Auto-Generation
The system must auto-generate a `.canvas` file per train that visually represents the thought journey.

**Behavior:**
- Canvas created on first thought capture (not train start)
- Canvas placed in train folder: `{trainFolder}/{trainTitle}.canvas`
- Canvas contains: thought nodes, linear edges, branch edges, merge edges
- Layout: top-to-bottom, deterministic positions
- Canvas regenerated from graph on each sync

### FR-04: Canvas Sync on Train Events
The system must update the canvas whenever the train graph changes.

**Events triggering sync:**
- `train.thought.added` — add node + edge
- `train.branch.merged` — add merge edge
- `train.branch.merge.undone` — remove merge edge

**Sync rules:**
- Replace all managed elements (ft-* prefixed IDs)
- Preserve all user-added elements (non ft-* IDs)
- Debounce at 500ms
- Handle missing canvas (full regeneration)

### FR-05: Open Canvas from Train Views
The system must provide a way to open the Train Canvas from Train views.

**Behavior:**
- "Open Canvas" button in TrainMainView header
- "Open Canvas" button in TrainTimelineSidebar header
- Button visible only when canvas exists
- Opens canvas in Obsidian's native canvas viewer

### FR-06: Merge UI in Timeline Sidebar
The timeline sidebar must visually represent merges and provide merge controls.

**Behavior:**
- Merge indicator badge on merge target nodes (incoming merge)
- "Merge into..." action on branch endpoint thoughts
- Target selection: clickable nodes in sidebar (valid targets highlighted, invalid dimmed)
- Undo merge button on merged thoughts

### FR-07: Canvas Node Styling
Canvas nodes must be visually distinct by role.

**Node colors:**
- Current head: accent color (Obsidian color 5 — green)
- Branch origin: fork indicator color (Obsidian color 2 — orange)
- Merge target: convergence color (Obsidian color 4 — blue)
- Normal thought: no color (default)

**Edge styles:**
- Linear: default edge
- Branch: labeled "branch"
- Merge: labeled "merge", different color

### FR-08: Train Rename
The system must allow renaming a train. Rename updates the train title, renames the folder, updates all thought note paths, and syncs the canvas.

**Delivered:** Cycle 22. Uses `InputModal` (not `prompt()` which fails in Electron).

### FR-09: Train Delete
The system must allow deleting a train with confirmation. Delete removes the train folder and all thought notes, removes the train from state, and emits `train.deleted`.

**Delivered:** Cycle 22. Confirmation via `InputModal` with "DELETE" confirmation text.

### FR-10: Train Max Thoughts Enforcement
The system must enforce the `trainMaxThoughts` setting. When the limit is reached, the capture modal auto-completes the train instead of allowing more thoughts.

**Delivered:** Cycle 22. Pre-existing setting was not enforced; now checked in `openTrainModal()`.

### FR-11: Merge Down Auto-Target
The system must provide `findMergeDownTarget(trainId, sourceId)` that determines the best merge target for a branch endpoint. The algorithm walks backward from source to find the branch origin (first main-chain ancestor), then returns the next main-chain node after origin.

**Delivered:** Cycle 23. Pure graph traversal with 11 unit tests + 11 integration tests.

### FR-12: Detail View Layout Restructure
The detail view must prioritize actionable controls at the top. New order: Header → Nav bar + Controls → Stats → Thought detail → Canvas callout → Content preview → Branches → Merge → Breadcrumb (last).

**Delivered:** Cycle 23. Includes one-click "Merge down" button with auto-target, canvas callout section, and "Path" heading on breadcrumb.

### FR-15: Train Hub View
The system must provide a dedicated Train Hub (`TrainHubView`) extending `BaseHubView<TrainHubPage>` with dashboard, active, and history pages. Dashboard shows active train card + aggregate statistics (total, active, completed, avg thoughts). Active tab lists running/paused trains with Resume/Pause/Open/Delete actions. History tab lists completed trains, searchable by title.

**Delivered:** Cycle 24 Inc 1. TrainHubView 376 LOC.

### FR-16: Train Hub Command
The system must register `flowti:open-train-hub` command in the command palette to open the Train Hub.

**Delivered:** Cycle 24 Inc 1. Registered in `src/infrastructure/commands/registry.ts`.

### FR-17: Head Node Utility
The system must provide `getHeadNode(trainId)` on TrainService that returns the last main-chain thought node. Returns null for empty trains.

**Delivered:** Cycle 24 Inc 2. Pure graph traversal via `getTimeline()`.

### FR-18: Jump-to-End Button
The system must show a "Jump to end" button in TrainMainView nav bar when the active thought is not the head node. Clicking navigates to the head thought via `train.thought.activated` event.

**Delivered:** Cycle 24 Inc 2. Button with `ft-train-jump-to-end-btn` class, fast-forward icon.

### FR-19: Smart Resume Modal
When resuming a paused train and the active thought is not the head node, the system must show a resume modal with three options: "Jump to end" (navigates to head + opens capture), "Branch from here" (stays on current node + opens capture with branch direction), "Stay here" (dismisses without action).

**Delivered:** Cycle 24 Inc 2. TrainResumeModal 109 LOC.

### FR-20: Inline Property Editor
The system must show an inline frontmatter property editor on the thought detail section. Reads via `metadataCache.getCache(path)?.frontmatter`, writes via `app.fileManager.processFrontMatter()` with 500ms debounce. Built-in properties (type, train, direction, order, parent) are read-only with lock icon. Users can add new key-value properties.

**Delivered:** Cycle 24 Inc 3. TrainPropertyEditor 256 LOC.

### FR-21: Built-in Train Types
The system must define `TrainTypeConfig` interface and `BUILT_IN_TRAIN_TYPES` constant with 4 types: brainstorm (15min, lightbulb), research (25min, search), decision (10min, scale), free-form (0min, pen-line).

**Delivered:** Cycle 24 Inc 4. Types in `src/domain/train/types.ts`.

### FR-22: Type Picker Modal
The system must show a type picker modal (`TrainTypePickerModal`) before creating a new train. Displays 4 types as icon cards in 2x2 grid. Selection provides type config (including default duration) to caller. Defaults to free-form on dismiss.

**Delivered:** Cycle 24 Inc 4. TrainTypePickerModal 68 LOC.

### FR-23: Type Badge Display
The system must show a type badge with icon in both TrainMainView header and TrainHubView list rows. Existing trains without a type display "Free-form" fallback.

**Delivered:** Cycle 24 Inc 4. Uses `typeConfig?.label ?? "Free-form"` and `typeConfig?.icon ?? "pen-line"`.

---

## 7. Jobs To Be Done

| # | JTBD | FR |
|---|------|-----|
| 1 | When I capture thoughts, I want visual structure without manual setup | FR-03, FR-04 |
| 2 | When I branch, I want alternatives clearly represented in the canvas | FR-04, FR-07 |
| 3 | When I want to synthesize, I need to merge branches intentionally | FR-01, FR-06 |
| 4 | When I pause, I want to open a visual map to elaborate further | FR-05 |
| 5 | When I change my mind, I want to undo a merge cleanly | FR-02 |

---

## 8. Data Model Extensions

### ThoughtDirection (extended)
```
"next" | "branch" | "merge"
```

### New TrainService Methods
```
mergeBranch(trainId, sourceThoughtId, targetThoughtId): void
undoMerge(trainId, sourceThoughtId, targetThoughtId): void
getMerges(trainId): ThoughtRelation[]
```

### New Events
```
train.branch.merged:       { trainId, sourceId, targetId }
train.branch.merge.undone: { trainId, sourceId, targetId }
train.canvas.created:      { trainId, canvasPath }
train.canvas.synced:       { trainId, canvasPath, nodeCount }
```

### New Settings
```
trainCanvasEnabled:   boolean  (default: true)
trainCanvasAutoOpen:  boolean  (default: false)
```

---

## 9. PBI Summary

| PBI | Title | FRs | Priority | Status |
|-----|-------|-----|----------|--------|
| PBI-TOT-004 | Branch Merge | FR-01, FR-02, FR-06 | 1 (must-have) | Done (Cycle 17) |
| PBI-TOT-005 | Train Canvas Generation & Sync | FR-03, FR-04, FR-05, FR-07 | 2 (must-have) | Done (Cycle 17) |
| PBI-TOT-008 | Train Polish and Management | FR-08, FR-09, FR-10 | 3 (should-have) | Done (Cycle 22) |
| PBI-TOT-009 | Merge Down Direction | FR-11, FR-12 | 4 (should-have) | Done (Cycle 23) |
| PBI-TOT-010 | Train Hub | FR-15, FR-16 | 5 (should-have) | Done (Cycle 24) |
| PBI-TOT-011 | Train UX Sprint | FR-17–FR-23 | 6 (should-have) | Done (Cycle 24) |

---

## 10. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Merge creates invalid cycles | High | DAG validation before commit |
| Canvas sync overwrites user work | High | ID namespace separation (ft-* prefix) |
| Canvas sync performance on large trains | Medium | Debounce at 500ms, full regeneration only when needed |
| Rapid capture causes write conflicts | Medium | Debounce + single-writer pattern |
| Canvas layout degrades with many branches | Medium | Branch lane algorithm with deterministic spacing |

---

## 11. Success Metrics

- Merge used in ≥30% of trains with branches
- Canvas generated for ≥80% of trains (when enabled)
- Zero structural corruption incidents (DAG integrity)
- Canvas sync latency <1s for trains with ≤100 thoughts
- User-added canvas elements never lost during sync

---

## 12. Stage History

| Version | FRI | Stage | Cycles | Notes |
|---------|-----|-------|--------|-------|
| v1 | 25/35 | in-progress | Cycle 17 | Initial delivery: branch merge, canvas generation & sync |
| v2 | 28/35 | delivered | Cycles 22, 23 | Train polish (rename, delete, maxThoughts) + merge-down auto-target + detail view restructure |
| v3 | 31/35 | delivered | Cycle 24 | Train Hub, jump-to-end, smart resume, property editor, train types. 23 FRs across 6 PBIs. |

### FRI v2 → v3 Changes

| Dimension | v2 | v3 | Rationale |
|-----------|----|----|-----------|
| Architecture | 4 | 5 | BaseHubView reuse for TrainHubView, pure `getHeadNode()` graph utility, standalone component pattern (TrainPropertyEditor, TrainResumeModal) |
| Data Model | 3 | 4 | `TrainTypeConfig` interface, `BUILT_IN_TRAIN_TYPES` constant, `trainType` optional field on TrainState — backward compatible type system |
| UI Consistency | 4 | 5 | 4 new UI components all follow established patterns: BaseHubView, Modal, standalone component. Type badges, property editor, resume modal — consistent with Obsidian UX conventions |

### FRI v1 → v2 Changes

| Dimension | v1 | v2 | Rationale |
|-----------|----|----|-----------|
| Scope | 4 | 5 | All 12 FRs delivered across 4 PBIs. Clear deferred items. |
| Architecture | 3 | 4 | `findMergeDownTarget()` pure graph traversal, `TrainCanvasSyncService` event-driven sync, clean handler extraction |
| Validation & Testing | 3 | 4 | 3,952 tests total. Train domain tests: merge (11), canvas sync (4), merge-down flow (11), modal (26), main view (15+) |

---

## 13. Deferred to v3

| Item | Rationale |
|------|-----------|
| Visual language system (node types, edge types, color semantics) | Aspirational UX refinement — v1 uses simple Obsidian canvas colors |
| Round-trip sync (canvas→train) | Complex bidirectional sync deferred until v1 validates the pattern |
| Deterministic layout engine | v1 uses simple top-to-bottom positioning; layout engine for complex topologies is v2 |
| Canvas elaboration mode (context nodes influence layout) | v1 preserves user elements but doesn't optimize layout around them |
| Story Maps / Event Maps reuse | Future features will build on the managed/user layer pattern established here |
| Merge preview ghost edge | Nice-to-have UX polish deferred to avoid scope creep |
| Merge-down for sub-branches into parent branches | Only main chain targeted in Cycle 23 |
| Auto-merge all branches on completeTrain() | Changes completion semantics |
| ~~Train types at creation~~ | ~~Needs type registry + design session~~ — **Delivered in v3 (Cycle 24)** |

---

## Related

- Foundation: [[Train of Thoughts PRD]] (FRI 33/35, done)
- Canvas: [[Obsidian Canvas Integration PRD]] (FRI 30/35, done)
- Inbox: [[Train Improvements]], [[I want to configure my Train of Thoughts]], [[How can I combine Sessions and Trains to create a Quality AssuranceWorkflow]]
- Cycles: [[Cycle 13 - Train of Thoughts]], [[Cycle 14 - Train View Polish]], [[Cycle 15 - Canvas Integration]], [[Cycle 22 - Train Polish and Management]], [[Cycle 23 - Merge Down and Detail Restructure]], [[Cycle 24 - Train Value Sprint]]
- Reviews: [[Three Amigos Review 2026-02-22 Train Polish and Merge Down]], [[Three Amigos Review 2026-02-23 Train Value Sprint]]
