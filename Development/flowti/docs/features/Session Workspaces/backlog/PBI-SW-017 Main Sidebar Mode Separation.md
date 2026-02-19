---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: planned
priority: high
effort: large
dependencies:
  - "[[PBI-SW-010 Session Lifecycle v2 and Intent Layer]]"
user_story: "[[I want a compact monitoring view in the sidebar while working]]"
note: "Major UI architecture change. Separates SessionWorkspaceView into SessionMainView (full execution environment) and SessionSidebarView (monitoring control surface). State-based rendering rules per session state. Sidebar = monitor, not workspace. Largest v2 PBI by LOC. Depends on PBI-SW-010 for v2 lifecycle states."
tags:
  - backlog
  - session-v2
---

## User Story — Problem Space

As a session user, I want a full execution environment in the main workspace and a compact monitoring view in the sidebar so that I can work on content while staying aware of session state.

### User Pains

- Current sidebar and main views show the same content — no role separation
- Sidebar is overloaded with action buttons that belong in the main workspace
- No concept of "above the fold" — sidebar shows everything regardless of importance
- State-specific rendering doesn't exist — reviewing state looks the same as running state
- Workshop facilitators need a control surface visible while sharing Canvas in main

### User Needs

- Main workspace: full execution environment with all cards and actions
- Sidebar: compact monitoring surface with snapshots and toggles only
- State-based rendering: each lifecycle state shows different content in each mode
- No add/create/configure buttons in sidebar above fold
- Sidebar above fold: only state, timer, energy, progress

## Solution Statement

### Use Cases

**Flow:**
User opens session in main → sees all cards (Intent, Timer, Execution, Context, Reflection, Activity) → opens sidebar → sees compact snapshots (status, time, energy, progress, task toggles) → switches between main and sidebar as needed

**Gherkin:**
```gherkin
Given a running session opened in the sidebar
When the user looks at the sidebar
Then they see: state indicator, remaining time, energy level, progress bar
And they do NOT see: add task button, add context button, template editing

Given a session in "reviewing" state opened in the main workspace
When the closure overlay appears
Then the overlay replaces the main content
And the sidebar shows "Review Required" status badge
```

### Functional Requirements

**Main mode (FR-17):**
- [ ] `SessionMainView` renders all v2 cards: Header, Intent, TimerEnergy, Execution, Context, Reflection, Activity, CognitiveLoadAlert
- [ ] All add/remove/configure actions available
- [ ] Full drag-and-drop for task reordering
- [ ] `SessionReviewOverlay` rendered conditionally when state === `reviewing`

**Sidebar mode (FR-17):**
- [ ] `SessionSidebarView` renders snapshots: StatusHeader, IntentSnapshot, ExecutionSnapshot, ContextSnapshot, ActivitySnapshot, EventTimeline
- [ ] No add/create/configure buttons above fold
- [ ] Task toggle allowed (check/uncheck)
- [ ] Energy indicator clickable
- [ ] Event timeline collapsible

**State-based rendering:**
- [ ] `prepared`: Main editable, Sidebar static snapshot
- [ ] `running`: Main all cards active, Sidebar monitoring dashboard
- [ ] `paused`: Main editable, Sidebar monitoring + Resume indicator
- [ ] `reviewing`: Main overlay replaces content, Sidebar "Review Required"
- [ ] `completed`: Main read-only, Sidebar compact summary
- [ ] `archived`: Main read-only, Sidebar minimal meta only

**Shared components:**
- [ ] Reusable atomic components: ProgressBar, EnergyIndicator, TaskItem, ContextCard, TimelineEventItem, SectionCard, StateBadge
- [ ] Components usable across domains (not session-specific)

### Technical Requirements

- Refactor existing `SessionWorkspaceView` (~479 LOC) into two view classes
- `SessionMainView` extends `ItemView` (full workspace)
- `SessionSidebarView` extends `ItemView` (compact surface)
- Both share component dependencies via `SessionViewDeps` interface
- State-based rendering via `renderForState(state, mode)` dispatcher
- Existing `SessionWorkspaceSubscriptions.ts` reused for event wiring
- Component extraction: each card/snapshot becomes a standalone component class

### Constraints

- Depends on PBI-SW-010 for v2 lifecycle states (state-based rendering)
- Must maintain backward compatibility with existing view registration
- Sidebar must work both as standalone panel and as Obsidian sidebar leaf
- Performance: rendering must be < 16ms (debounced via `scheduleRender()`)

## Acceptance Criteria

- [ ] Main view shows all v2 cards with full action capability
- [ ] Sidebar view shows compact snapshots with limited actions
- [ ] State-based rendering changes content based on session state
- [ ] No action clutter above fold in sidebar
- [ ] Task toggle works in sidebar
- [ ] Energy indicator clickable in sidebar
- [ ] Review overlay renders in main during reviewing state
- [ ] Sidebar shows "Review Required" during reviewing state
- [ ] Atomic components reusable across domains
- [ ] Both views register correctly in Obsidian
- [ ] `npm run build` passes

### INVEST Checklist

| Criterion | Met? | Notes |
|-----------|------|-------|
| **I**ndependent | No | Depends on PBI-SW-010 (lifecycle states drive rendering) |
| **N**egotiable | Yes | Which cards appear in sidebar, state-rendering details |
| **V**aluable | Yes | Core v2 UX — separates execution from monitoring |
| **E**stimable | Yes | ~400 LOC (largest v2 PBI), ~40 tests |
| **S**mall | Partial | 3+ increments needed for full delivery |
| **T**estable | Yes | Rendering per state testable via DOM assertions |

## Estimated Size

- **Source LOC:** ~400 (main ~150, sidebar ~120, components ~100, types ~30)
- **Tests:** ~40
- **Increments:** 3 (main view, sidebar view, shared components)

## Related

- PRD: [[Session Workspaces PRD]] (FR-17)
- Depends on: [[PBI-SW-010 Session Lifecycle v2 and Intent Layer]] (state-based rendering)
- Refactors: `src/ui/SessionWorkspaceView.ts` (current 479 LOC)
- Pattern: [[BaseHubView]] (UI composition reference, but sessions use ItemView)
- Extraction: [[SessionWorkspaceSubscriptions]] (reused for event wiring)
