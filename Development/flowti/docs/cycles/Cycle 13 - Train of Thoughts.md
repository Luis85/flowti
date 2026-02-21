---
type: DevelopmentCycle
feature: "[[Train of Thoughts PRD]]"
stage: refinement
cycle: 13
date_planned: 2026-02-21
date_completed:
pbis:
  - "[[PBI-TOT-001 Train Domain and Serial Capture]]"
  - "[[PBI-TOT-002 Train Main View and Timeline Sidebar]]"
  - "[[PBI-TOT-003 Session Nesting and Lifecycle]]"
bugs: []
bugs_fixed_precycle: []
tech_debt: []
estimated_increments: 5
actual_increments:
estimated_tests: 110
actual_tests:
total_tests_after:
total_test_files_after:
---

# Cycle 13: Train of Thoughts

## Cycle Overview

**User Story:**

> As a knowledge worker using Flowti, I want to start a "Train of Thoughts" session that captures a chain of linked ideas via rapid serial capture so that I can brainstorm without breaking my flow and later navigate, branch, and elaborate on my thought timeline.

**User Pains:**
- Quick Capture creates isolated notes — the chain of thought is lost
- No dedicated mode for rapid sequential ideation
- No way to visualize how ideas evolved and branched during brainstorming
- Previous thought context is lost between individual captures

**User Needs:**
- "Start Train of Thoughts" command that enters a serial capture loop
- Each thought linked to the previous, forming a navigable chain
- Dedicated main view for thought detail and navigation
- Timeline sidebar showing the full journey with branches
- Session nesting so new trains don't require stopping the current one

---

## Situation Assessment

### Pre-Cycle State (assumes Cycle 13 complete)

**Plugin health (projected):**
- ~3,300+ tests passing, ~135+ test suites
- Build status: green
- Repository restructured for marketplace (Cycle 13)
- CI/CD pipeline operational (Cycle 13)

**Feature status across contributing PRDs:**

| PRD | Stage | FRI | Delivered So Far |
|-----|-------|-----|------------------|
| [[Train of Thoughts PRD]] | approved | 20/35 | No PBIs delivered yet — greenfield |
| [[Session Workspaces PRD]] | in-progress | 31/35 | v1 complete (8/8 FRs), v2 partial (FR-11, FR-12, FR-13, FR-14, FR-16 delivered) |
| [[Quick Capture PRD]] | in-progress | 25/35 | PBI-QC-001 delivered (Cycle 12) — 10 types, ribbons, modal, command palette, inbox integration |

**Infrastructure available:**
- Session v2: lifecycle state machine, intent, energy, execution plan, reflection, closure ritual
- Quick Capture: 10-type modal, CaptureService, capture.note.created events
- EventBus + Event Catalog: full event tracing, per-domain event composition
- FileSystemClient: note creation, frontmatter management
- InboxService: capture.note.created already wired as inbox source

**What's next per feature priority:**
1. PBI-TOT-001 Train Domain and Serial Capture — critical, no dependencies, establishes domain
2. PBI-TOT-002 Train Main View and Timeline Sidebar — high, depends on PBI-TOT-001
3. PBI-TOT-003 Session Nesting and Lifecycle — medium, depends on PBI-TOT-001 + 002

### Post-Cycle State (YYYY-MM-DD)

_To be filled after delivery._

---

## Cycle Goals

1. **Establish the Train of Thoughts domain** (PBI-TOT-001) — ThoughtNode types, TrainService, serial capture loop with thought linking
2. **Deliver dedicated Train views** (PBI-TOT-002) — Train Main View for thought navigation and Timeline Sidebar for graph visualization
3. **Enable session nesting** (PBI-TOT-003) — Starting a new train pauses the current one, closure ritual integration

---

## Tech Debt Bundled

None bundled — this is a greenfield feature cycle.

---

## Increment Plan

### Inc 1: Train Domain Types + Serial Capture (PBI-TOT-001, Part 1)

**Goal:** Establish the ThoughtNode domain types, TrainService core, and serial capture loop via TrainCaptureModal.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/train/types.ts` | ThoughtNode, ThoughtRelation, TrainState, TrainEventMap | ~50 |
| 2 | `src/domain/train/events.ts` | Train event definitions: started, thought.added, paused, resumed | ~40 |
| 3 | `src/domain/train/TrainService.ts` | Train lifecycle: startTrain, addThought, pause, resume | ~200 |
| 4 | `src/ui/train/TrainCaptureModal.ts` | Serial capture modal with context display | ~100 |
| 5 | `src/infrastructure/commands/registry.ts` | `flowti:start-train` command | ~15 |
| 6 | `src/infrastructure/events/events.ts` | Compose TrainEventMap into FlowtiEventMap | ~5 |

**Est. total:** ~410 LOC source, ~180 LOC tests, ~35 new tests

**Test intent:**
- Unit tests for TrainService: startTrain creates session + first node, addThought links correctly, pause/resume state transitions
- Unit tests for TrainCaptureModal: renders with context, serial loop behavior
- Integration: command → modal → service → events flow

**Documentation intent:** Create "Start a Train of Thoughts" flow doc.

**Architecture seams:**
- New bounded context `src/domain/train/` — isolated from session internals
- TrainService delegates to SessionService for session lifecycle and CaptureService for note creation
- TrainEventMap composed into FlowtiEventMap via `extends`

**Acceptance criteria:**
- [ ] "Start Train of Thoughts" command visible in command palette
- [ ] First thought creates a session + vault note
- [ ] Each Enter creates a linked note and opens next modal
- [ ] Previous thought title shown as context in modal
- [ ] `train.started` and `train.thought.added` events emitted
- [ ] Escape/close pauses the session

---

### Inc 2: Thought Linking + Branching (PBI-TOT-001, Part 2)

**Goal:** Wire thought-to-thought linking via frontmatter relations, add branch support, and enable navigation within TrainService.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/train/TrainService.ts` | addThought with directional linking, getTimeline, getBranches | ~120 |
| 2 | `src/domain/train/TrainService.ts` | Branch support: resume from any node, branch direction | ~80 |
| 3 | `src/ui/train/TrainCaptureModal.ts` | Direction selector (next/branch default), branching UX | ~40 |
| 4 | `src/domain/train/TrainService.ts` | Frontmatter: `thought-relations` field on vault notes | ~40 |

**Est. total:** ~280 LOC source, ~120 LOC tests, ~25 new tests

**Test intent:**
- Unit tests: directional linking, branch creation, timeline traversal, getBranches helper
- Unit tests: frontmatter relation serialization/deserialization

**Acceptance criteria:**
- [ ] Thoughts linked with "next" direction by default
- [ ] User can select "branch" direction in capture modal
- [ ] Frontmatter includes `thought-relations` field
- [ ] TrainService.getTimeline returns ordered chain with branches
- [ ] `train.thought.added` payload includes `direction` field

---

### Inc 3: Train Main View (PBI-TOT-002, Part 1)

**Goal:** Dedicated main view for thought navigation, detail display, and branch links.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/train/TrainMainView.ts` | ItemView: thought detail, nav buttons, branch links | ~300 |
| 2 | `src/ui/train/types.ts` | VIEW_TYPE_TRAIN_MAIN, VIEW_TYPE_TRAIN_TIMELINE | ~10 |
| 3 | `src/main.ts` | Register TrainMainView + leaf activation | ~15 |
| 4 | Integration | Wire train events to view re-render | ~30 |

**Est. total:** ~355 LOC source, ~100 LOC tests, ~20 new tests

**Test intent:**
- Unit tests: renders active thought, navigation buttons, branch links
- Unit tests: "Open in editor" link, "Resume capture" button
- Event subscription: re-renders on thought.added, thought.activated

**Acceptance criteria:**
- [ ] Train Main View registered as Obsidian view
- [ ] Active thought content displayed with title and properties
- [ ] Previous/Next navigation buttons
- [ ] Branch links shown for thoughts with multiple continuations
- [ ] "Open in editor" opens the vault note
- [ ] "Resume capture" reopens the serial capture modal

---

### Inc 4: Timeline Sidebar (PBI-TOT-002, Part 2)

**Goal:** Sidebar timeline graph visualization with click-to-navigate and branch rendering.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/train/TrainTimelineRenderer.ts` | HTML/CSS tree graph component | ~200 |
| 2 | `src/ui/train/TrainTimelineSidebar.ts` | ItemView wrapper for timeline | ~250 |
| 3 | `src/main.ts` | Register sidebar view | ~10 |
| 4 | Integration | Click-to-navigate, active node highlight, auto-scroll | ~40 |

**Est. total:** ~500 LOC source, ~80 LOC tests, ~15 new tests

**Test intent:**
- Unit tests: timeline renderer produces correct DOM structure for linear chains
- Unit tests: branch forks rendered correctly
- Unit tests: click events dispatch thought.activated
- Integration: active node highlight syncs with TrainMainView

**Acceptance criteria:**
- [ ] Timeline Sidebar registered as Obsidian view
- [ ] Graph shows all thoughts as nodes with connections
- [ ] Branches visualized as tree forks
- [ ] Active node highlighted
- [ ] Click navigates to that thought in Main View
- [ ] Timestamps shown on timeline

---

### Inc 5: Session Nesting + Closure (PBI-TOT-003)

**Goal:** Enable session nesting for trains and integrate with the closure ritual system.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/train/TrainService.ts` | Nesting: pause active, link sessions | ~80 |
| 2 | `src/domain/train/types.ts` | DEFAULT_TRAIN_CLOSURE_TEMPLATE, session type config | ~30 |
| 3 | `src/domain/session/types.ts` | `train-of-thought` in SessionTypeConfig map | ~10 |
| 4 | `src/ui/train/TrainMainView.ts` | "Resume" button, spawned-from link display | ~40 |
| 5 | Integration | Wire nesting events, closure template resolution | ~30 |

**Est. total:** ~190 LOC source, ~80 LOC tests, ~15 new tests

**Test intent:**
- Unit tests: starting new train pauses active, links sessions
- Unit tests: resume pauses the other train
- Unit tests: closure template resolved for train-of-thought type
- Flow test: full nesting lifecycle

**Acceptance criteria:**
- [ ] Starting a new train pauses the currently running train
- [ ] New train links to the paused train
- [ ] Resuming a train pauses the current one
- [ ] Closure ritual triggers on train completion
- [ ] Train-specific closure questions shown
- [ ] Train sessions appear in session history

---

## Dependency Graph

```
Inc 1: Train Domain + Serial Capture
  │
  ▼
Inc 2: Thought Linking + Branching
  │
  ├──────────────────┐
  ▼                  ▼
Inc 3: Main View   Inc 4: Timeline Sidebar
  │                  │
  └────────┬─────────┘
           ▼
    Inc 5: Session Nesting + Closure
```

Inc 3 and Inc 4 can be developed in parallel after Inc 2 is complete.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Timeline graph rendering complexity | High | Start with simple HTML/CSS tree (nested divs + CSS grid); defer canvas/SVG to future cycle |
| Serial capture modal UX (rapid succession) | Medium | Prototype with existing QuickCaptureModal; test with 10+ thoughts for responsiveness |
| Frontmatter relation format conflicts with other plugins | Low | Use dedicated `thought-relations` key; validate on load; document schema |
| Large thought chains (100+ nodes) performance | Medium | Virtualize timeline sidebar; lazy-load thought content; defer to v2 if needed |
| Session nesting edge cases (3+ concurrent trains) | Medium | Hard limit at 1 level of nesting for v1; log warning for attempted deeper nesting |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| New tests | 110+ | `npm test` count delta |
| Source LOC | ~1,735 | Sum of increment estimates |
| Test LOC | ~560 | Sum of test estimates |
| Build status | green | `npm test` passes |
| FRI score | 20 → 25+ | Post-cycle FRI re-score |
| Train sessions created in first week | 5+ | Manual verification |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| Canvas rendering of thought graphs | Complex; HTML/CSS tree sufficient for v1 | Cycle 15+ |
| Custom direction types beyond next/branch | Scope creep; two directions cover 95% of use cases | Cycle 15+ |
| AI-assisted thought suggestions | Requires external API; out of scope for initial delivery | Future |
| Multi-level session nesting (train-in-train-in-train) | Edge case; 1 level covers the primary use case | Cycle 15+ |
| Thought merge/split operations | Complex UX; defer until user feedback validates need | Future |
| Export to external mind-mapping tools | Integration work; not core functionality | Future |

---

## Readiness Assessment

### 1. Feature PRD Readiness

- [x] [[Train of Thoughts PRD]] exists at `docs/features/Train of Thoughts/`
- [x] Stage: approved
- [x] FRI scored: 20/35 (Technically Ready threshold: 19)
- [ ] Technical Review: pending (to be conducted pre-cycle)

### 2. Backlog Readiness

- [x] 3 PBIs defined: PBI-TOT-001, PBI-TOT-002, PBI-TOT-003
- [x] Chunked into 5 increments with dependencies mapped
- [x] Priority ranked: 001 (Must) → 002 (Must) → 003 (Should)

### 3. Cycle Plan Document

- [x] All required sections present (situation, goals, increments, dependency graph, risks, metrics, deferred)

### 4. Increment Readiness

- [x] Each increment has: scope, step table, LOC estimates, test intent, acceptance criteria

### 5. Quality Baseline

- [ ] Build pipeline green (verify pre-cycle)
- [ ] No critical bugs blocking this cycle
- [ ] Previous cycle (Cycle 13) closed

### 6. Pre-Cycle Completion

- [x] Inbox source idea enriched and linked
- [x] PRD created with JTBD, User Stories, FRI scoring
- [x] PBIs created with Gherkin use cases and functional requirements

---

## Related

- PRD: [[Train of Thoughts PRD]]
- Parent: [[Session Workspaces PRD]]
- Sibling: [[Quick Capture PRD]]
- Inbox: [[I want to have the option to create a serial note session on every enter a new quick capture modal opens with the last note title in the description]]
- Prior Cycles: [[Cycle 12 - User Hub Inbox]]
