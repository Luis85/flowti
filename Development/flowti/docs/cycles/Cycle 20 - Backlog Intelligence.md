---
type: DevelopmentCycle
feature: "[[Prioritization Hub PRD]]"
stage: deferred
cycle: 20
date_planned: 2026-02-22
date_completed:
pbis:
  - "[[PBI-PRI-001 Scoring and Ranking Engine]]"
bugs: []
bugs_fixed_precycle: []
tech_debt: []
estimated_increments: 8
actual_increments:
estimated_tests: 120
actual_tests:
total_tests_after:
total_test_files_after:
---

# Cycle 18: Backlog Intelligence

## Cycle Overview

**User Story:**

> As a product owner, I want structured prioritization tools built into my vault so that I can score, rank, and compare hundreds of inbox items, PBIs, and tech debt items using proven methods (Ulwick scoring, drag-and-drop ranking, ELO comparison) instead of manually editing priority frontmatter by gut feeling.

**User Pains:**
- 265+ inbox items, 35 features, 125+ tech debt items — manual prioritization is overwhelming
- Priority is set via frontmatter (`priority: "01 - medium"`) with no scoring methodology
- No way to compare items against each other — ranking lives in the user's head
- Priority changes leave no audit trail — decisions are invisible and unjustified
- Obsidian Bases show lists but provide no prioritization or comparison tools

**User Needs:**
- Score notes on configurable weighted dimensions (importance, satisfaction, effort, risk, urgency)
- Calculate Ulwick opportunity scores automatically: `Importance + max(Importance - Satisfaction, 0)`
- Rank notes via drag-and-drop with automatic position persistence to frontmatter
- Run ELO comparison sessions with pairwise A/B choices that converge on reliable rankings
- Audit trail recording every scoring/ranking/comparison decision with timestamps
- Prioritization Hub view showing dashboards, active sessions, and results
- Session integration: run prioritization as a session type with closure ritual

---

## Situation Assessment

### Pre-Cycle State (post-Cycle 15)

**Plugin health:**
- 3,548 tests passing, 141 test suites
- Build status: green
- Canvas Integration fully delivered (Cycle 15)

**Feature status across contributing PRDs:**

| PRD | Stage | FRI | Delivered So Far |
|-----|-------|-----|------------------|
| [[Prioritization Hub PRD]] | draft | —/35 | No PBIs delivered yet — greenfield domain |
| [[Hubs PRD]] | in-progress | 33/35 | User Hub, Event Catalog, Data Exchange Hub |
| [[Session Workspaces PRD]] | in-progress | 30/35 | Session v2 with closure ritual, activity intelligence |

**Infrastructure available:**
- BaseHubView: abstract base class for all Hub views (shell pattern, tab bar, debounced render)
- EventBus: full event tracing, per-domain event composition via `extends`
- TypedStorage: generic typed persistence (same pattern as CanvasService, SignalService)
- SessionService: session type registry, closure ritual, activity tracking
- FileSystemClient: frontmatter read/write, folder operations
- InboxService: event-driven inbox item creation (reuse mapper pattern)
- Entity path system: all entity types with standardized folder structures

**Backlog refinement context (2026-02-22):**
- 126 unassigned inbox items analyzed — prioritization identified as highest-impact new domain
- 9 personas updated — Product Owner pain points explicitly call for prioritization tools
- 21 JTBDs populated — "I need to manage a product backlog" is draft stage with no tool support
- Release blockers: 5 remaining (RB-1, RB-2, RB-4, RB-7, RB-8), none block this cycle

---

## Cycle Goals

1. **Prioritization domain foundation** (Inc 1-2) — Establish bounded context with types, events, and three pure-function engines (scoring, ranking, ELO)
2. **Service orchestrator** (Inc 3) — PrioritizationService with state persistence, session lifecycle, and folder scanning
3. **Frontmatter integration** (Inc 4) — Batch write-back of scores, ranks, and ELO ratings to note frontmatter
4. **Prioritization Hub View** (Inc 5-6) — Dashboard, scoring view, ranking view with drag-and-drop
5. **ELO comparison view** (Inc 7) — Pairwise A/B comparison interface with convergence indicators
6. **Session integration + verification** (Inc 8) — Session type registration, closure ritual, integration tests

---

## Scope

**In scope (PBI-PRI-001):**
- Prioritization domain: `src/domain/prioritization/` bounded context
- Types: PrioritizationState, PrioritizationSession, PrioritizationConfig, ScoredItem, RankedItem, EloItem, ComparisonDecision
- Events: 8 prioritization events (session lifecycle, item scored/ranked, comparison decided, config saved, results applied, loaded)
- Scoring engine: weighted multi-dimension scoring with Ulwick opportunity formula
- Ranking engine: position-based ordering with rebalance
- ELO engine: Elo rating algorithm with K-factor, confidence levels, pair selection
- PrioritizationService: CRUD, session lifecycle, state persistence
- Frontmatter writer: batch write scores/ranks/ELO to note frontmatter
- Prioritization Hub View: dashboard, scoring, ranking, ELO, results tabs
- Session integration: "Prioritization" session type with closure ritual
- Inbox integration: prioritization completion/failure inbox items
- Event Catalog registration: 8 events with category "Prioritization"

**Out of scope (future cycles):**
- AI-assisted prioritization (inbox items reference this — future)
- Multi-user collaborative prioritization
- External tool sync for priorities (use Signal Integration)
- Custom prioritization algorithms beyond scoring/ranking/ELO
- Automated re-prioritization based on events
- Context menu "Prioritize folder" (PBI-PRI-002)

---

## Tech Debt Bundled

None bundled — this is a greenfield domain cycle.

---

## Increment Plan

### Inc 1: Prioritization Domain Types & Events

**Goal:** Establish the prioritization domain bounded context with types, events, and constants.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/prioritization/types.ts` | PrioritizationState, PrioritizationSession, PrioritizationConfig, ScoredItem, RankedItem, EloItem, ComparisonDecision, PrioritizationDimension, DEFAULT_DIMENSIONS, ELO constants | ~100 |
| 2 | `src/domain/prioritization/events.ts` | PrioritizationEventMap: 8 events (session lifecycle, item scored/ranked, comparison decided, config saved, results applied, loaded) | ~40 |
| 3 | `src/infrastructure/events/events.ts` | Compose PrioritizationEventMap into FlowtiEventMap | +2 |
| 4 | `src/infrastructure/events/catalog.ts` | Register 8 prioritization events with category "Prioritization" | +16 |

**Est. total:** ~160 LOC source, ~40 LOC tests, ~10 new tests

**Test intent:**
- Unit tests: all types exported correctly, default dimensions have expected values
- Unit tests: event map type-checks with correct payload shapes
- Unit tests: catalog entries match event map keys

**Documentation intent:**
- Event Catalog: 8 prioritization events with descriptions
- Update `DEFAULT_CATALOG_CATEGORIES` with "Prioritization" category

**Architecture seams:**
- New bounded context `src/domain/prioritization/` — isolated from other domains
- PrioritizationEventMap composed into FlowtiEventMap via `extends` (same as Canvas, Signal)
- Pure types with no Obsidian dependencies

**Acceptance criteria:**
- [ ] All prioritization types exported from `types.ts`
- [ ] 5 default scoring dimensions defined with weights (importance 1.0, satisfaction 1.0, effort 0.5, risk 0.5, urgency 0.5)
- [ ] ELO constants: INITIAL_RATING=1200, DEFAULT_K_FACTOR=32, MIN_COMPARISONS=5
- [ ] 8 events registered in catalog with category "Prioritization"
- [ ] PrioritizationEventMap composed into FlowtiEventMap

---

### Inc 2: Scoring, Ranking & ELO Engines

**Goal:** Three pure-function engines implementing the prioritization algorithms.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/prioritization/ScoringEngine.ts` | `scoreDimension()`, `calculateWeightedScore()`, `calculateOpportunityScore()` | ~60 |
| 2 | `src/domain/prioritization/RankingEngine.ts` | `moveItem()`, `insertAtPosition()`, `rebalanceRanks()`, `removeItem()` | ~50 |
| 3 | `src/domain/prioritization/EloEngine.ts` | `calculateExpectedScore()`, `updateEloRating()`, `selectNextPair()`, `getConfidenceLevel()` | ~70 |

**Est. total:** ~180 LOC source, ~200 LOC tests, ~40 new tests

**Test intent:**
- Unit tests: scoring dimension validation (1-5 scale), weighted total calculation, Ulwick opportunity formula
- Unit tests: ranking move operations, position persistence, rebalance with gaps
- Unit tests: ELO expected score calculation, rating updates (winner gains, loser drops), K-factor effect, pair selection (fewest comparisons first), confidence levels (low < 5, medium 5-10, high > 10)

**Documentation intent:**
- JSDoc on all exported pure functions
- Consider ADR if ELO algorithm deviates from standard formula

**Architecture seams:**
- All three engines are pure functions — no side effects, no Obsidian dependencies, no EventBus
- Engines consumed by PrioritizationService (Inc 3) — no direct UI coupling

**Acceptance criteria:**
- [ ] `calculateWeightedScore()` produces correct totals for given dimension scores and weights
- [ ] `calculateOpportunityScore()` implements Ulwick: `Importance + max(Importance - Satisfaction, 0)`
- [ ] `moveItem()` reorders items and updates all affected positions
- [ ] `updateEloRating()` follows standard Elo formula with configurable K-factor
- [ ] `selectNextPair()` prioritizes items with fewest comparisons
- [ ] `getConfidenceLevel()` returns low/medium/high based on comparison count thresholds
- [ ] All engines are pure functions with no side effects

---

### Inc 3: PrioritizationService — Orchestrator & State

**Goal:** Service facade managing session lifecycle, CRUD, and state persistence.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/prioritization/PrioritizationService.ts` | Service facade: CRUD, session lifecycle (create/start/complete), folder scanning, state persistence | ~200 |
| 2 | `src/infrastructure/services/registry.ts` | Register PrioritizationService in ServiceContainer | +5 |
| 3 | `src/main.ts` | Instantiate and wire PrioritizationService (load on startup, dispose on unload) | +15 |

**Est. total:** ~220 LOC source, ~150 LOC tests, ~25 new tests

**Test intent:**
- Unit tests: session CRUD (create, get, list, delete)
- Unit tests: config CRUD (create, update, delete, defaults)
- Unit tests: session lifecycle (create → start → complete), invalid transitions rejected
- Unit tests: folder scanning loads notes by path and type filter
- Unit tests: state persistence across load/dispose cycles
- Unit tests: events emitted for session lifecycle and config changes

**Documentation intent:**
- Service registered in ServiceContainer (same pattern as CanvasService, SignalService)
- Update `main.ts` onload/unload lifecycle documentation comments

**Architecture seams:**
- PrioritizationService follows ServiceContainer pattern (TypedStorage, EventBus, FileSystemClient)
- Service registered in `registry.ts`, instantiated in `main.ts`
- Folder scanning uses FileSystemClient.listFiles() with type filter callback

**Acceptance criteria:**
- [ ] PrioritizationService registered in ServiceContainer with TypedStorage
- [ ] Session CRUD: create, get, list active, delete
- [ ] Config CRUD: create, update, delete, get defaults
- [ ] Session lifecycle: created → active → completed with event emissions
- [ ] Folder scanning: load notes from folder path with optional type filter
- [ ] State persistence: sessions and configs survive plugin reload
- [ ] `prioritization.loaded` event emitted on startup

---

### Inc 4: Frontmatter Writer — Score & Rank Write-back

**Goal:** Batch write prioritization results to note frontmatter.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/prioritization/FrontmatterWriter.ts` | `writeScoresToFrontmatter()`, `writeRanksToFrontmatter()`, `writeEloToFrontmatter()`, `batchWriteResults()` | ~80 |
| 2 | `src/domain/prioritization/PrioritizationService.ts` | Wire frontmatter writer to session completion + manual "Apply Results" | +20 |

**Est. total:** ~100 LOC source, ~80 LOC tests, ~15 new tests

**Test intent:**
- Unit tests: score fields written to frontmatter (`priority_score`, `opportunity_score`, `priority_dimensions`)
- Unit tests: rank field written (`priority_rank`)
- Unit tests: ELO fields written (`elo_rating`, `elo_comparisons`, `elo_confidence`)
- Unit tests: batch write processes multiple notes
- Unit tests: existing frontmatter preserved (only priority fields updated)
- Unit tests: `prioritization.results.applied` event emitted with item count

**Documentation intent:**
- Document frontmatter schema for prioritization fields (priority_score, priority_rank, elo_rating, etc.)
- Add to PRD §6 Data Model Impact with concrete field examples

**Architecture seams:**
- FrontmatterWriter uses FileSystemClient for all I/O — pure functions for field preparation
- Batch writes use sequential FileSystemClient.updateFrontmatter() with error collection per note

**Acceptance criteria:**
- [ ] Scores written: `priority_score`, `opportunity_score`, dimension scores
- [ ] Ranks written: `priority_rank` (integer position)
- [ ] ELO written: `elo_rating`, `elo_comparisons`, `elo_confidence`
- [ ] Batch write handles 100+ notes without timeout
- [ ] Existing frontmatter fields preserved
- [ ] `prioritization.results.applied` event emitted on completion

---

### Inc 5: Prioritization Hub View — Dashboard & Scoring

**Goal:** Hub view with dashboard overview and scoring interface.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/prioritization/PrioritizationHubView.ts` | Extends BaseHubView, 5 tabs: Dashboard, Scoring, Ranking, ELO, Results | ~150 |
| 2 | `src/ui/prioritization/types.ts` | PrioritizationViewState, PrioritizationComponentDeps, page types | ~40 |
| 3 | `src/ui/prioritization/DashboardPanel.ts` | Active sessions, recent results, quick-start buttons, statistics | ~120 |
| 4 | `src/ui/prioritization/ScoringPanel.ts` | Note list with dimension sliders, real-time total/opportunity scores | ~180 |
| 5 | `src/main.ts` | Register PrioritizationHubView | +10 |

**Est. total:** ~500 LOC source, ~100 LOC tests, ~15 new tests

**Test intent:**
- Unit tests: hub view registers with correct view type and tabs
- Unit tests: dashboard renders active session cards and statistics
- Unit tests: scoring panel renders dimension sliders for each note
- Unit tests: score changes trigger recalculation and display update
- Unit tests: "Apply Scores" button calls frontmatter writer

**Documentation intent:**
- Create component doc: `docs/components/PrioritizationHubView.md`
- Create component doc: `docs/components/DashboardPanel.md`
- Create component doc: `docs/components/ScoringPanel.md`
- Update Frontend Architecture.md with Prioritization Hub View in view inventory

**Architecture seams:**
- PrioritizationHubView extends BaseHubView (inherits tab bar, debounced render, split layout)
- VIEW_TYPE constant in `src/domain/hub/types.ts`, re-exported from view
- Components follow `constructor(el, deps)` + `renderMaster()` + `renderDetail()` pattern

**Acceptance criteria:**
- [ ] PrioritizationHubView extends BaseHubView with 5 tab definitions
- [ ] Dashboard tab: active sessions list, recent results, quick-start buttons
- [ ] Scoring tab: note list with dimension sliders (1-5 scale)
- [ ] Real-time total and opportunity score display per item
- [ ] "Apply Scores" action triggers frontmatter write-back
- [ ] Hub registered in `main.ts` with view type `flowti-prioritization-hub`

---

### Inc 6: Ranking View — Drag-and-Drop

**Goal:** Sortable ranking interface with drag-and-drop reordering.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/prioritization/RankingPanel.ts` | Sortable list with drag handles, rank badges, position indicators | ~200 |
| 2 | `src/ui/prioritization/RankingPanel.ts` | Drag-and-drop event handlers: dragstart, dragover, drop, visual feedback | +50 |
| 3 | `src/ui/prioritization/RankingPanel.ts` | "Apply Ranks" button, rank change indicators (moved up/down badges) | +30 |

**Est. total:** ~280 LOC source, ~80 LOC tests, ~12 new tests

**Test intent:**
- Unit tests: items render in ranked order with position badges
- Unit tests: drag-and-drop reorder updates positions correctly
- Unit tests: rank change indicators show movement direction
- Unit tests: "Apply Ranks" triggers frontmatter write-back
- Unit tests: empty state renders prompt to add items

**Documentation intent:**
- Create component doc: `docs/components/RankingPanel.md`
- Document drag-and-drop interaction pattern for reuse

**Architecture seams:**
- RankingPanel uses native HTML5 drag-and-drop API (dragstart, dragover, drop)
- Panel calls RankingEngine pure functions for position calculation — no direct state mutation
- "Apply Ranks" delegates to PrioritizationService → FrontmatterWriter

**Acceptance criteria:**
- [ ] Items displayed in sortable list with rank badges (#1, #2, ...)
- [ ] Drag-and-drop reorders items with visual drop indicator
- [ ] Rank change indicators: green up arrow / red down arrow for moved items
- [ ] "Apply Ranks" writes `priority_rank` to all item frontmatter
- [ ] Position persistence: ranks preserved across tab switches

---

### Inc 7: ELO Comparison View

**Goal:** Pairwise A/B comparison interface with convergence tracking.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/prioritization/EloComparisonPanel.ts` | Side-by-side card layout: item A vs item B with content preview | ~180 |
| 2 | `src/ui/prioritization/EloComparisonPanel.ts` | "A Wins" / "B Wins" / "Skip" buttons with keyboard shortcuts | +40 |
| 3 | `src/ui/prioritization/EloComparisonPanel.ts` | Progress: comparisons done, items compared, confidence bars per item | +60 |
| 4 | `src/ui/prioritization/EloComparisonPanel.ts` | Results summary: sorted by ELO rating, confidence indicators, comparison count | +50 |

**Est. total:** ~330 LOC source, ~80 LOC tests, ~12 new tests

**Test intent:**
- Unit tests: comparison view renders two item cards side-by-side
- Unit tests: "A Wins" updates both ratings via EloEngine
- Unit tests: "Skip" advances to next pair without rating change
- Unit tests: progress indicators update after each comparison
- Unit tests: results view shows items sorted by ELO rating
- Unit tests: confidence indicators (low/medium/high) display correctly
- Unit tests: session completes when minimum comparisons reached for all items

**Documentation intent:**
- Create component doc: `docs/components/EloComparisonPanel.md`
- Document keyboard shortcut mapping

**Architecture seams:**
- EloComparisonPanel calls EloEngine pure functions for rating calculation and pair selection
- Keyboard shortcuts registered via Obsidian scope (component-scoped, not global)
- Auto-completion wired to EloEngine.getConfidenceLevel() for all items

**Acceptance criteria:**
- [ ] Two items displayed side-by-side with title, description, and metadata
- [ ] "A Wins" / "B Wins" buttons update ELO ratings correctly
- [ ] "Skip" advances without rating change
- [ ] Keyboard shortcuts: `1` or `a` for A, `2` or `b` for B, `s` for Skip
- [ ] Progress: "X of Y comparisons", per-item confidence bars
- [ ] Results: items sorted by ELO rating with confidence badges
- [ ] Session auto-completes when all items have minimum comparisons

---

### Inc 8: Session Integration, Inbox & Integration Tests

**Goal:** Session type registration, inbox integration, flow tests, and end-to-end verification.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/prioritization/PrioritizationService.ts` | Register "Prioritization" session type, closure ritual summary | +30 |
| 2 | `src/domain/inbox/mappers.ts` | `mapPrioritizationCompleted()` — inbox item for completed prioritization | +15 |
| 3 | `src/domain/inbox/InboxService.ts` | Wire prioritization.session.completed listener | +3 |
| 4 | `tests/flows/19-Prioritization.test.ts` (new) | Flow test: scoring session, ranking session, ELO session, frontmatter round-trip | ~300 |
| 5 | `src/main.ts` | Register `flowti:start-prioritization` command | +5 |

**Est. total:** ~350 LOC source + tests, ~25 new tests

**Test intent:**
- Flow tests: scoring session end-to-end (select folder → score items → apply → verify frontmatter)
- Flow tests: ranking session end-to-end (load items → reorder → apply → verify frontmatter)
- Flow tests: ELO session end-to-end (start → compare pairs → verify convergence → apply)
- Flow tests: session integration (start session → run prioritization → closure ritual)
- Flow tests: inbox item created on completion
- Flow tests: event sequence verification (started → scored/ranked/compared → completed → applied)

**Documentation intent:**
- Create flow doc: `docs/flows/Prioritize Backlog Items.md` (scoring, ranking, ELO flows)
- Create sitemap entry: `docs/sitemap/Prioritization Hub View.md`
- Update Frontend Architecture.md: Prioritization domain, event scale, component count
- Update PRD: FRI re-score, delivery notes, acceptance criteria checked

**Architecture seams:**
- Session type registration via SessionService type registry (same as existing session types)
- Inbox mapper follows `mapXCompleted()` pattern (same as Canvas, Signal)
- Flow test follows `tests/flows/` pattern (19-Prioritization.test.ts)
- Command registered in `main.ts` via `addCommand()`

**Acceptance criteria:**
- [ ] "Prioritization" session type registered and runnable
- [ ] Closure ritual includes prioritization summary (items scored, top 3 items, mode used)
- [ ] Inbox item created for prioritization session completion
- [ ] `flowti:start-prioritization` command in palette
- [ ] Flow 19 covers scoring, ranking, and ELO end-to-end
- [ ] Frontmatter round-trip: write scores → reload → verify values
- [ ] Event sequence: started → progress events → completed → applied
- [ ] `npm test` passes with all new tests green

---

## Dependency Graph

```
Inc 1 (Types + Events)
    │
    ▼
Inc 2 (Scoring + Ranking + ELO Engines)
    │
    ▼
Inc 3 (PrioritizationService) → Inc 4 (Frontmatter Writer)
    │
    ▼
Inc 5 (Hub View + Dashboard + Scoring UI)
    │
    ▼
Inc 6 (Ranking View)
    │
    ▼
Inc 7 (ELO Comparison View)
    │
    ▼
Inc 8 (Session Integration + Tests)
```

Sequential build: types → engines → service → frontmatter → UI views → session integration → verification.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| ELO convergence requires many comparisons for large sets | Medium | Show confidence indicator; suggest minimum 5 per item; sample-based pairing for 100+ items |
| Frontmatter writes conflict with manual edits | Medium | Batch writes on "Apply Results" action, not real-time; warn on unsaved changes |
| Drag-and-drop performance with 200+ items | Medium | Virtual scrolling if needed; start with simple DOM ordering |
| Large item sets (500+) overwhelm comparison view | Medium | Sample-based comparison; focus on uncertain (low confidence) items first |
| Users abandon sessions before completing | Low | Save session state; resume later; "Continue Session" on dashboard |
| Multiple prioritization dimensions confuse users | Low | Start with Ulwick-standard 5 dimensions; allow simplification to 2 (importance + effort) |

---

## Success Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| New tests | ~120 | | |
| Source LOC | ~1,800 | | |
| Build status | green | | |
| FRI score | 0 → 20+ | | |
| Engines tested | 3/3 pure function engines | | |
| Frontmatter round-trip | verified | | |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| PBI-PRI-002 Prioritization Hub View (extended) | Context menu "Prioritize folder", Obsidian Base integration | Cycle 18 |
| PBI-PRI-003 Session Type Integration (advanced) | Workshop mode, multi-session comparison | Cycle 18+ |
| AI-assisted prioritization | Requires AI infrastructure not yet built | Future |
| Scheduled re-prioritization | Automated triggers — complex, low priority | Future |

---

## DoR Preparation Notes

### Gaps to Close Before Cycle 18 Starts

| # | Gap | Current | Required | Action |
|---|-----|---------|----------|--------|
| 1 | PRD stage | `draft` | `approved` | Review PRD with Three Amigos, promote to approved |
| 2 | FRI score | unscored | scored | Score PRD after review |
| 3 | Three Amigos review | Cycle 15 review pending | Cycle 15 + 16 DoR reviewed | Schedule combined review |
| 4 | ELO algorithm validation | Theoretical | Confirmed | Spike: validate Elo formula with known outcomes |

### Already Ready

- [x] PRD exists with clear vision, scope, data model, and event impact
- [x] PBI-PRI-001 defined with functional requirements and acceptance criteria
- [x] Persona and JTBD alignment confirmed (Product Owner + product backlog JTBD)
- [x] BaseHubView infrastructure available (shell pattern, tab bar, debounced render)
- [x] TypedStorage pattern proven (CanvasService, SignalService, SessionService)
- [x] EventBus composition pattern proven (CanvasEventMap, SignalEventMap)
- [x] Inbox mapper pattern proven (Canvas, Signal, Data Exchange mappers)
- [x] Frontmatter read/write via FileSystemClient proven

---

## Definition of Done (Cycle)

### 1. All Increments Completed

- [ ] Each increment satisfies its own acceptance criteria
- [ ] No increment left in partial state
- [ ] Deferred increments documented with rationale

### 2. Build & Test Quality

- [ ] `npm test` passes (vitest, tsc, eslint)
- [ ] Test count meets target (~120 new tests)
- [ ] No test regressions (3,548 pre-existing tests pass)
- [ ] No skipped tests introduced
- [ ] Pure functions tested (scoring, ranking, ELO engines)
- [ ] Service tested (PrioritizationService CRUD + lifecycle)
- [ ] UI tested (hub view, panels)
- [ ] Integration flow tested (19-Prioritization.test.ts)

### 3. Three Amigos Review

- [ ] Cycle-level review conducted
- [ ] All three perspectives represented
- [ ] All blocker findings resolved
- [ ] TASM scores recorded
- [ ] Observations documented

### 4. PRD & Backlog Updates

- [ ] PRD updated: FRI scored, functional requirements checked, delivery notes added
- [ ] PBI-PRI-001 updated: stage → done, acceptance criteria checked, technical requirements updated
- [ ] Event model current: 8 prioritization events registered

### 5. Documentation

- [ ] Component docs created for all new UI components
- [ ] Architecture docs updated (Frontend Architecture.md)
- [ ] Flow doc created: "Prioritize Backlog Items" flow
- [ ] Sitemap updated with Prioritization Hub View entry

### 6. Cycle Plan Completion

- [ ] Cycle plan frontmatter updated with actual values
- [ ] Success metrics verified
- [ ] Deviations documented
- [ ] Risks reviewed

---

## Related

- PRD: [[Prioritization Hub PRD]]
- PBI: [[PBI-PRI-001 Scoring and Ranking Engine]]
- JTBD: [[I need to manage a product backlog]], [[I need an all-in-one Product Management Solution]]
- Persona: [[The Product Owner (Operational Strategist)]], [[Strategic Systems Builder]]
- Inbox: [[We need a tool to prioritize notes]]
- Prior Cycle: [[Cycle 15 - Canvas Integration]]
- Backlog Refinement: [[backlog-refinement-2026-02-22]]
