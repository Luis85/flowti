---
domain: Session
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: in-progress
maturity: L1
version: 1
created: 2026-02-22
updated: 2026-02-22
foundation: "[[Train of Thoughts PRD]]"
maturity_score_strategy: 4
maturity_score_scope: 4
maturity_score_architecture: 3
maturity_score_event_integration: 4
maturity_score_data_model: 3
maturity_score_ui_consistency: 4
maturity_score_validation_testing: 3
business_value: 4
implementation_cost: 3
maintenance_cost: 3
discovery_cost: 2
design_cost: 3
test_cost: 3
priority: 3
fri_score: 25
tags:
  - session
  - train-of-thought
  - canvas
  - merge
planned_in:
  - "[[Cycle 17 - Train Canvas and Branch Merge]]"
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

| PBI | Title | FRs | Priority |
|-----|-------|-----|----------|
| PBI-TOT-004 | Branch Merge | FR-01, FR-02, FR-06 | 1 (must-have) |
| PBI-TOT-005 | Train Canvas Generation & Sync | FR-03, FR-04, FR-05, FR-07 | 2 (must-have) |

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

## 12. Deferred to v2

| Item | Rationale |
|------|-----------|
| Visual language system (node types, edge types, color semantics) | Aspirational UX refinement — v1 uses simple Obsidian canvas colors |
| Round-trip sync (canvas→train) | Complex bidirectional sync deferred until v1 validates the pattern |
| Deterministic layout engine | v1 uses simple top-to-bottom positioning; layout engine for complex topologies is v2 |
| Canvas elaboration mode (context nodes influence layout) | v1 preserves user elements but doesn't optimize layout around them |
| Story Maps / Event Maps reuse | Future features will build on the managed/user layer pattern established here |
| Merge preview ghost edge | Nice-to-have UX polish deferred to avoid scope creep |

---

## Related

- Foundation: [[Train of Thoughts PRD]] (FRI 33/35, done)
- Canvas: [[Obsidian Canvas Integration PRD]] (FRI 30/35, done)
- Inbox: [[Train Improvements]], [[I want to configure my Train of Thoughts]], [[How can I combine Sessions and Trains to create a Quality AssuranceWorkflow]]
- Cycles: [[Cycle 13 - Train of Thoughts]], [[Cycle 14 - Train View Polish]], [[Cycle 15 - Canvas Integration]]
