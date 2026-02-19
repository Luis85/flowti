---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: planned
priority: medium
effort: medium
dependencies: []
user_story: "[[I want to capture structured observations during sessions]]"
note: "Extends existing FR-03 Decision Log with 3 additional categories: Observations, Blockers, Ideas. Unified ReflectionEntry type replaces SessionDecision. Backward compat: existing decisions migrated to reflections with type 'decision'. Builds on proven decision CRUD pattern."
tags:
  - backlog
  - session-v2
---

## User Story — Problem Space

As a session user, I want to capture observations, blockers, ideas, and decisions as four distinct structured categories so that my session reflections are organized and actionable.

### User Pains

- Only decisions are captured as structured records — observations and ideas go into free-text notes
- Blockers encountered during sessions have no dedicated capture mechanism
- Notes become unstructured dumps mixing observations, ideas, and action items
- Session summaries only include decisions — no way to review all reflections by type

### User Needs

- 4 reflection categories: Observations, Blockers, Ideas, Decisions
- Each category with its own add/remove capability
- Reflections included in session summary by category
- Decisions retain existing capability to emit domain events
- Sidebar shows collapsed summary (count per category)

## Solution Statement

### Use Cases

**Gherkin:**
```gherkin
Given a running session
When the user adds a blocker "API rate limit prevents bulk import"
Then a ReflectionEntry with type "blocker" is created
And session.reflection.added event is emitted

Given a completed session with 3 observations, 1 blocker, 2 ideas, 4 decisions
When the session summary is generated
Then each category appears as a separate section
And decisions can be linked to domain decision records
```

### Functional Requirements

- [ ] `ReflectionEntry` type: `{ id, type: "observation"|"blocker"|"idea"|"decision", content, timestamp }`
- [ ] `reflections: ReflectionEntry[]` field on Session interface
- [ ] `session.reflection.added` event with `{ sessionId, entry: ReflectionEntry }`
- [ ] `session.reflection.removed` event with `{ sessionId, entryId: string }`
- [ ] `handleReflectionAdd()` and `handleReflectionRemove()` in SessionService
- [ ] Each category rendered as separate section in workspace
- [ ] Decision entries can emit `decision.recorded` domain event
- [ ] Decisions can be converted to standalone decision records
- [ ] Reflections included in session summary grouped by type
- [ ] Sidebar: collapsed summary view showing count per category
- [ ] Backward compat: existing `decisions[]` migrated to `reflections[]` with `type: "decision"` in `load()`
- [ ] Max reflections per session: 200 (50 per category recommended)

### Technical Requirements

- `ReflectionEntry` type in `src/domain/session/types.ts`
- Extends existing `SessionDecision` pattern from FR-03 / Cycle 2
- `handleReflectionAdd()`, `handleReflectionRemove()` follow existing handler pattern
- Existing `handleDecisionRecord()` deprecated → redirected to `handleReflectionAdd()` with `type: "decision"`
- Migration: `load()` maps `decisions.map(d => ({ ...d, type: "decision" as const }))` into `reflections`
- Thread `reflections` through creation paths per L-09

### Constraints

- Must maintain backward compatibility with existing decision data
- Decision-specific behavior (domain event emission) must be preserved for `type: "decision"`
- Session summary format changes — decisions section becomes reflection section with sub-categories

## Acceptance Criteria

- [ ] Adding a reflection in any category creates an entry and emits event
- [ ] Removing a reflection removes it from the list
- [ ] 4 categories are rendered separately in workspace
- [ ] Decisions retain their existing domain event capability
- [ ] Session summary includes reflections grouped by type
- [ ] Existing sessions with `decisions[]` load correctly as `reflections[]`
- [ ] `npm run build` passes

### INVEST Checklist

| Criterion | Met? | Notes |
|-----------|------|-------|
| **I**ndependent | Yes | Extends delivered FR-03 — no v2 dependencies |
| **N**egotiable | Yes | Category names and max limits are negotiable |
| **V**aluable | Yes | Structured reflection replaces free-text chaos |
| **E**stimable | Yes | ~120 LOC, ~20 tests |
| **S**mall | Yes | 1-2 increments |
| **T**estable | Yes | CRUD + migration testable as pure functions |

## Estimated Size

- **Source LOC:** ~120
- **Tests:** ~20
- **Increments:** 1-2

## Related

- PRD: [[Session Workspaces PRD]] (FR-13)
- Extends: [[PBI-SW-004 Decision Log]] (FR-03 foundation)
- Feeds: [[PBI-SW-014 Closure Ritual System]] (reflections included in closure)
