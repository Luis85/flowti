---
domain: Flowti/Plugin/PKM
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: done
maturity: L2
version: 1
created: 2026-02-21
updated: 2026-02-21
foundation: "[[Session Workspaces PRD]]"
maturity_score_strategy: 5
maturity_score_scope: 5
maturity_score_architecture: 5
maturity_score_event_integration: 5
maturity_score_data_model: 4
maturity_score_ui_consistency: 5
maturity_score_validation_testing: 4
business_value: 5
implementation_cost: 4
maintenance_cost: 3
discovery_cost: 3
design_cost: 4
test_cost: 3
priority: 3
fri_score: 33
tags:
  - capture
  - train-of-thought
  - innovation
planned_in:
  - "[[Cycle 13 - Train of Thoughts]]"
  - "[[Cycle 14 - Train View Polish]]"
---

# Feature PRD: Train of Thoughts — Serial Capture Sessions

> Inbox source: [[I want to have the option to create a serial note session on every enter a new quick capture modal opens with the last note title in the description]]

---

## 1. Vision & Strategic Context

> Thinking happens in chains, not in isolation. A Train of Thoughts session captures the flow of rapid ideation as a navigable, branching timeline of linked notes — turning fleeting thought sequences into a permanent, structured knowledge graph.

**Strategic position**: Train of Thoughts bridges Quick Capture (single-shot capture) and Sessions (structured execution). It creates a new modality: **serial capture sessions** where the act of capturing IS the session. This fills a gap in Flowti's execution model — currently there's no dedicated mode for rapid, sequential ideation where each thought connects to the previous one.

**Relationship to existing features:**
- **Quick Capture** provides the modal interface for single-shot capture
- **Session Workspaces** provides the lifecycle, state machine, and workspace infrastructure
- **Train of Thoughts** combines both into a new session mode with unique UI (timeline graph, branching navigation)

---

## 2. Problem Statement

### What Exists

- **Quick Capture**: fast single-shot note creation (10 types, command palette + ribbons)
- **Session Workspaces**: structured execution environments with lifecycle, intent, reflection, closure
- **Inbox**: surfaces captured notes for triage and routing

### What's Missing

When brainstorming or exploring a topic, thoughts arrive in rapid succession. Current tools force a choice:

1. **Quick Capture repeatedly** — notes are created but unrelated; the chain of thought is lost
2. **Session with notes** — structured but too heavy for rapid ideation; breaks the flow
3. **Long-form note** — captures everything but loses the granularity of individual thoughts and their connections

There is no way to:
- Capture thoughts serially with each one linked to the previous
- Visualize the journey of a thought chain over time
- Branch from any point in a thought sequence to explore alternatives
- Navigate a thought timeline interactively

### Impact

- Brainstorming sessions produce unstructured output with no trace of how ideas evolved
- Related thoughts are scattered across individual notes with no explicit connections
- The evolution of an idea from initial spark to refined concept is invisible
- Users cannot revisit the branching points where they chose one direction over another

---

## 3. Jobs To Be Done (JTBD)

### JTBD 1 — Rapid Serial Capture

> When I'm brainstorming, I want to capture each thought with minimal friction and have it automatically linked to my previous thought so that I don't break my flow to organize.

### JTBD 2 — Thought Chain Visualization

> When reviewing a brainstorming session, I want to see the full timeline of my thoughts as a navigable graph so that I can understand how my ideas evolved and branched.

### JTBD 3 — Exploratory Branching

> When I reach a fork in my thinking, I want to branch from any previous thought to explore an alternative direction so that I don't lose the original train while exploring a tangent.

### JTBD 4 — Thought Elaboration

> When a particular thought needs more detail, I want to open its underlying note and add content so that I can deepen an idea without leaving the session context.

### JTBD 5 — Session Context Preservation

> When I start a new train of thoughts while another is running, I want the current train paused and linked so that I can return to it later without losing context.

---

## 4. Personas

| Persona | Primary JTBD | Use Case |
|---------|-------------|----------|
| Knowledge Worker | Rapid Serial Capture | Morning brain dump, meeting notes, problem decomposition |
| Product Owner | Exploratory Branching | Feature ideation, stakeholder feedback processing |
| Domain Architect | Thought Chain Visualization | Domain exploration, concept mapping, decision trees |
| Researcher | Thought Elaboration | Literature review connections, hypothesis chains |

---

## 5. User Stories

### Epic: Serial Capture Loop

- As a user, I want to start a "Train of Thoughts" session from the command palette so that I enter a rapid capture mode
- As a user, I want the first thought to become the session title and description so that the session is named after its origin
- As a user, I want each Enter to save the current thought and open a new capture modal so that I can keep capturing without interruption
- As a user, I want the previous thought title shown as context in each new capture modal so that I remember where I left off
- As a user, I want to stop the train at any point by closing the modal so that I can review my journey

### Epic: Thought Linking & Relations

- As a user, I want each thought automatically linked to its predecessor with a "next" relation so that the chain is traceable
- As a user, I want to choose a direction (next, branch) when capturing so that I can create forks in my thinking
- As a user, I want the default direction to be "next" so that linear capture requires no extra input
- As a user, I want branch relations to create a tree structure so that alternative thought paths are preserved

### Epic: Train Main View

- As a user, I want a dedicated main view showing the current thought's content so that I can see what I'm working with
- As a user, I want to navigate between thoughts in the train so that I can review any point in my journey
- As a user, I want to see branch links when a thought has multiple continuations so that I can explore different paths
- As a user, I want to open the underlying note in Obsidian's editor so that I can add detail to any thought

### Epic: Timeline Sidebar

- As a user, I want a sidebar showing a top-down timeline graph of all thoughts so that I see the full journey at a glance
- As a user, I want to click any node in the timeline to navigate to that thought so that I can jump to any point
- As a user, I want branches visualized as tree forks so that the structure of my thinking is visible
- As a user, I want timestamps on the timeline axis so that I can see when each thought occurred

### Epic: Session Integration

- As a user, I want Train of Thoughts to use the existing session lifecycle (prepared, running, paused, reviewing, completed) so that it integrates with my session history
- As a user, I want to start a new train while another is running so that a sudden new direction doesn't require stopping the current train
- As a user, I want the paused train linked to the new one so that I can navigate between related trains
- As a user, I want the closure ritual to trigger when I end a train so that I reflect on what I captured

---

## 6. Outcome (Success Definition)

- "Start Train of Thoughts" command available in command palette
- First thought creates session + first note
- Each Enter creates a linked note and opens next capture modal
- Previous thought title shown as context in capture modal
- Dedicated Train Main View with thought detail and navigation
- Timeline Sidebar with top-down graph showing branches
- Session lifecycle integration (pause, resume, closure)
- Session nesting (new train pauses current)
- All thoughts are standard vault notes with frontmatter

---

## 7. Scope

### In Scope (v1)

- "Start Train of Thoughts" command
- Serial capture loop via Quick Capture modal
- ThoughtNode type with directional relations (next, branch)
- Train Main View (thought detail, navigation, branch links)
- Timeline Sidebar (graph visualization)
- Session lifecycle integration
- Session nesting (pause current, link trains)
- Closure ritual on train end

### Out of Scope (v1)

- Custom direction types beyond next/branch
- AI-assisted thought suggestions
- Collaborative trains (multi-user)
- Canvas rendering of thought graphs
- Export to external mind-mapping tools
- Drag-and-drop reordering of thoughts
- Merge/split operations on thought chains

---

## 8. Solution Concept

### Architecture

```
Train of Thoughts
 ├── Domain Layer
 │   ├── ThoughtNode type         # id, title, path, timestamp, relations[]
 │   ├── ThoughtRelation type     # from, to, direction (next|branch)
 │   ├── TrainState type          # sessionId, nodes[], activeNodeId, rootNodeId
 │   ├── TrainService             # CRUD for trains, node management, navigation
 │   └── Events                   # train.started, thought.added, thought.branched, train.paused, train.resumed
 │
 ├── UI Layer
 │   ├── TrainMainView            # extends ItemView — thought detail, navigation, branch links
 │   ├── TrainTimelineSidebar     # extends ItemView — top-down timeline graph
 │   ├── TrainCaptureModal        # extends QuickCaptureModal — serial capture with context
 │   └── TrainTimelineRenderer    # canvas-based timeline graph component
 │
 └── Integration
     ├── Session type config      # "train-of-thought" type in SessionService
     ├── Command registration     # "flowti:start-train" command
     └── Quick Capture bridge     # TrainCaptureModal → CaptureService → TrainService
```

### Data Model

```typescript
interface ThoughtNode {
  id: string;
  title: string;
  filePath: string;         // path to vault note
  timestamp: string;        // ISO creation time
  relations: ThoughtRelation[];
}

interface ThoughtRelation {
  targetId: string;
  direction: "next" | "branch";
}

interface TrainState {
  sessionId: string;
  rootNodeId: string;
  activeNodeId: string;
  nodes: ThoughtNode[];
}
```

### Event Model

| Event | Payload | When |
|-------|---------|------|
| `train.started` | `{ sessionId, firstThought }` | Train session created with first thought |
| `train.thought.added` | `{ sessionId, nodeId, parentId, direction }` | New thought captured and linked |
| `train.thought.activated` | `{ sessionId, nodeId }` | User navigates to a thought |
| `train.paused` | `{ sessionId }` | User closes capture modal to review |
| `train.resumed` | `{ sessionId, fromNodeId }` | User resumes capture from a point |
| `train.completed` | `{ sessionId, totalThoughts, branches }` | Train session ended |

### Key Interactions

```
[Command Palette: "Start Train of Thoughts"]
    │
    ▼
[TrainCaptureModal: "Enter first thought..."]
    │  Enter
    ▼
[Session created + Note created + TrainMainView opens]
    │
    ▼
[TrainCaptureModal: "Continue from: {last thought}..."]
    │  Enter          │  Escape/Pause
    ▼                 ▼
[Note linked →       [Review mode: navigate timeline,
 next modal]          browse thoughts, open notes]
                         │  Resume
                         ▼
                     [TrainCaptureModal reopens from active node]
```

---

## 9. Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | "Start Train of Thoughts" command creates session and opens first capture modal | Must | Done |
| FR-02 | Each Enter creates a vault note with typed frontmatter and opens next modal | Must | Done |
| FR-03 | Previous thought title displayed as context in capture modal | Must | Done |
| FR-04 | Notes linked with directional relations (next, branch) via frontmatter | Must | Done |
| FR-05 | Train Main View shows current thought detail with navigation and branch links | Must | Done |
| FR-06 | Timeline Sidebar shows top-down graph of all thoughts with branch visualization | Must | Done |
| FR-07 | User can navigate to any thought in the timeline (click in sidebar or via main view) | Must | Done |
| FR-08 | User can branch from any thought (navigate to it, then resume capture) | Should | Done |
| FR-09 | Session nesting: new train pauses current, trains are linked | Should | Done |
| FR-10 | Closure ritual triggers on session end | Should | Done |
| FR-11 | All thoughts are standard .md vault notes with type frontmatter | Must | Done |

---

## 10. Acceptance Criteria

- [x] "Start Train of Thoughts" command visible in command palette
- [x] First thought creates session + vault note
- [x] Each Enter creates linked note and opens next capture modal
- [x] Previous thought title shown as context in modal
- [x] Train Main View renders with thought navigation
- [x] Timeline Sidebar renders with graph visualization
- [x] User can navigate to any thought
- [x] User can branch from any thought
- [x] Session lifecycle (pause, resume, closure) works
- [x] npm test passes (3,342 tests, 153 new for Train of Thoughts across Cycles 13+14)

---

## 11. Feature Readiness Index (FRI)

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Strategy | 5/5 | Delivered — strategic fit proven. Bridges Quick Capture and Sessions as serial capture modality. Fills the ideation gap in Flowti's execution model. |
| Scope | 5/5 | v1 scope fully delivered. All 3 PBIs done (domain + views + lifecycle). Extended backlog items remain for v2. |
| Architecture | 5/5 | Domain layer (TrainService, ThoughtNode, TrainState), UI layer (TrainMainView, TrainTimelineSidebar, TrainCaptureModal), and integration (session nesting, commands, ribbons) all implemented. 10 views registered. |
| Event Integration | 5/5 | Delivered — train events implemented and wired. Session lifecycle integration complete (auto-pause, closure ritual). Inbox integration via dedicated train mappers (thought added, train completed). CaptureService skips generic `capture.note.created` for train thoughts to prevent duplicate inbox items. |
| Data Model | 4/5 | ThoughtNode + ThoughtRelation types working with TypedStorage. Frontmatter relations validated. Branching (next/branch directions) proven. -1 for potential schema evolution in v2. |
| UI Consistency | 5/5 | Delivered — TrainMainView, TrainTimelineSidebar, TrainCaptureModal, extracted panels (stats, controls, breadcrumb) all using `ft-*` design system classes, `renderStatGrid()`, `ft-btn`, `ft-section` layout. CSS styling complete (~130 lines). Ribbons, commands, User Hub integration all delivered. |
| Validation & Testing | 4/5 | 153 new tests across Cycles 13+14 (3,342 total). Flow docs, component docs, sitemap docs delivered. TrainService + UI views + integration all covered. -1 for visual/E2E testing of timeline renderer. |
| **Total FRI** | **33/35** | **Done** — v1 fully delivered across Cycles 13+14. Serial capture, branching, compass navigation, styled views (ft-* design system), session nesting, closure ritual, timeboxing, inbox integration, User Hub integration, and preferences all working. Extended backlog items remain for v2. |

---

## 12. Technical Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Timeline graph rendering complexity | High | Medium | Start with simple HTML/CSS tree; defer canvas-based rendering to v2 |
| Session nesting edge cases | Medium | Medium | Implement simple pause/resume first; defer multi-level nesting |
| Frontmatter relation format conflicts | Low | Low | Use dedicated `thought-relations` frontmatter key; validate on load |
| Performance with large thought chains (100+ nodes) | Medium | Low | Virtualize timeline sidebar; lazy-load thought content |

---

## 13. Dependencies

| Dependency | Status | Impact |
|------------|--------|--------|
| Session Workspaces v2 (lifecycle, state machine) | Delivered | TrainService uses session lifecycle directly |
| Quick Capture (modal, CaptureService) | Delivered | TrainCaptureModal extends capture modal pattern |
| EventBus + Event Catalog | Delivered | 6 new train events registered |
| FileSystemClient | Delivered | Note creation and linking |

All dependencies are met — this feature can begin implementation immediately.

---

## Product Backlog Items

| PBI | Title | Status | Priority | Est. Increments | Delivered In |
|-----|-------|--------|----------|-----------------|--------------|
| [[PBI-TOT-001 Train Domain and Serial Capture]] | Domain types, TrainService, serial capture loop | Done | Must | 2 | Cycle 13 |
| [[PBI-TOT-002 Train Main View and Timeline Sidebar]] | Dedicated views, navigation, branching | Done | Must | 2 | Cycle 13 |
| [[PBI-TOT-003 Session Nesting and Lifecycle]] | Pause/resume, nesting, closure integration | Done | Should | 1 | Cycle 13 |

---

## Stage History

| Date | Stage | FRI | Notes |
|------|-------|-----|-------|
| 2026-02-21 | discovery → approved | 20/35 | Initial PRD created from vault inbox idea. 3 PBIs defined, 5 increments estimated. Dependencies met (Session v2 + Quick Capture delivered). |
| 2026-02-21 | approved → in-progress | 31/35 | Cycle 13 delivery: v1 scope complete. All 3 PBIs done (TOT-001, TOT-002, TOT-003). 11/11 FRs delivered. 73 new tests (3,263 total). 10 views registered. Delivered: serial capture with thought linking, branching (next/branch), TrainMainView, TrainTimelineSidebar, session nesting with auto-pause, closure ritual with train-specific questions, timeboxed trains with countdown timer. Extended backlog items remain for v2. |
| 2026-02-21 | in-progress → done | 33/35 | Cycle 14 delivery: 8 increments. Visual refactor (ft-* design system, renderStatGrid, ft-btn, ft-section layout, ~130 lines CSS). Sidebar toggle, modal navigation (prev/next/branch from modal), active thought sync, train preferences in User Hub, dashboard train notice, inbox source configuration, 5 bugs fixed (stale sidebar, modal direction reset, capture.note.created bypass for thoughts, inbox enabledSources empty default, flow doc stale). 153 new tests total (3,342). FRI 31→33. |

---

## Related

- Inbox: [[I want to have the option to create a serial note session on every enter a new quick capture modal opens with the last note title in the description]]
- Parent: [[Session Workspaces PRD]]
- Sibling: [[Quick Capture PRD]]
- Domain: [[Session Workspaces PRD|Session domain]]
