---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: done
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

- [x] `ReflectionEntry` type: `{ id, type: "observation"|"blocker"|"idea"|"decision", content, timestamp }`
- [x] `reflections: ReflectionEntry[]` field on Session interface
- [x] `session.reflection.add` / `session.reflection.remove` command events *(added Inc 3)*
- [x] `session.reflection.added` event with `{ sessionId, entry: ReflectionEntry }`
- [x] `session.reflection.removed` event with `{ sessionId, entryId: string }`
- [x] `handleReflectionAdd()` and `handleReflectionRemove()` in SessionService (state guards: running/paused)
- [x] Each category rendered as separate section in workspace *(Inc 4)*
- [ ] Decision entries can emit `decision.recorded` domain event *(deferred)*
- [ ] Decisions can be converted to standalone decision records *(deferred)*
- [x] Reflections included in session summary grouped by type (with category icons)
- [ ] Sidebar: collapsed summary view showing count per category *(deferred — PBI-SW-017)*
- [ ] Backward compat: existing `decisions[]` migrated to `reflections[]` with `type: "decision"` *(deferred — decisions coexist)*
- [ ] Max reflections per session: 200 (50 per category recommended) *(deferred — no cap yet)*

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

- [x] Adding a reflection in any category creates an entry and emits event *(Inc 3)*
- [x] Removing a reflection removes it from the list *(Inc 3)*
- [x] 4 categories are rendered separately in workspace *(Inc 4)*
- [ ] Decisions retain their existing domain event capability *(deferred)*
- [x] Session summary includes reflections grouped by type *(Inc 3)*
- [x] Sessions without reflections load cleanly (backward compat) *(Inc 3)*
- [x] `npm test` passes (2,768 tests, 109 suites) *(Inc 3 + Inc 4)*

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

## Delivery Summary — Inc 3 (Domain)

- **Delivered in:** Cycle 8 Inc 3
- **Source LOC:** ~60 (handlers ~35, summary body ~10, template threading ~15)
- **Tests:** 15 new (9 service + 3 helpers + 3 template threading), 2,748 total

### Files Changed (Inc 3)

| File | Change |
|------|--------|
| `src/domain/session/events.ts` | Added `session.reflection.add` and `session.reflection.remove` command events |
| `src/domain/session/types.ts` | Added `reflections` field to `SessionTemplate` |
| `src/domain/session/SessionService.ts` | Added `handleReflectionAdd()`/`handleReflectionRemove()` handlers, command listeners, template threading (saveTemplate, rerun, createFromTemplate, handleCreate, exportTemplate) |
| `src/domain/session/helpers.ts` | Added Reflections section to `generateSessionSummaryBody()` with category icons |
| `src/infrastructure/events/catalog.ts` | Added 2 command event catalog entries |
| `tests/domain/session/SessionService.test.ts` | +12 reflection handler + template tests |
| `tests/domain/session/helpers.test.ts` | +3 summary body reflection tests |

## Delivery Summary — Inc 4 (UI)

- **Delivered in:** Cycle 8 Inc 4
- **Source LOC:** ~130 (SessionReflectionPanel component + view integration + subscription wiring)
- **Tests:** 20 new (17 component + 3 subscriptions), 2,768 total, 109 suites

### Files Changed (Inc 4)

| File | Change |
|------|--------|
| `src/ui/session/SessionReflectionPanel.ts` | **New** — category-grouped entries with Lucide icons, add form (dropdown + input), remove button, `refreshList()` |
| `src/ui/SessionWorkspaceView.ts` | Added `reflectionPanel` field, render call between decisions and activity, `getReflectionPanel` in subscription context |
| `src/ui/session/SessionWorkspaceSubscriptions.ts` | Added `getReflectionPanel()` to `SubscriptionViewContext`, wired `session.reflection.added`/`removed` subscriptions |
| `tests/ui/session/SessionReflectionPanel.test.ts` | **New** — 17 component tests (categories, add form, remove, state guards, refresh) |
| `tests/ui/session/SessionWorkspaceSubscriptions.test.ts` | +3 reflection subscription tests |

## Related

- PRD: [[Session Workspaces PRD]] (FR-13)
- Extends: [[PBI-SW-004 Decision Log]] (FR-03 foundation)
- Feeds: [[PBI-SW-014 Closure Ritual System]] (reflections included in closure)
