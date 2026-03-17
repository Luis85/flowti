---
type: ProductBacklogItem
feature: "[[Prioritization Hub PRD]]"
stage: planned
priority: high
phase: 1
dependencies:
  - "[[Hubs PRD]]"
tags:
  - prioritization
  - backlog-intelligence
planned_in: "[[Cycle 18 - Backlog Intelligence]]"
user_story: "[[We need a tool to prioritize notes]]"
---

## User Story - Problemspace

As a product owner, I want to score, rank, and compare vault notes using structured prioritization methods so that I can make data-driven decisions about what to build next instead of relying on gut feeling and manual frontmatter edits.

### User Pains

- Priority is set manually via frontmatter (`priority: "01 - medium"`) with no structured methodology
- No way to compare items against each other — ranking lives only in the user's head
- 265+ inbox items, 35 features, 125+ tech debt items make manual prioritization overwhelming
- Obsidian Bases show lists but provide no prioritization tools
- No audit trail — priority changes are invisible and unjustified

### User Needs

- Score notes on configurable weighted dimensions (importance, satisfaction, effort, risk, urgency)
- Calculate Ulwick opportunity scores automatically
- Rank notes via drag-and-drop with automatic position persistence
- Run ELO comparison sessions with pairwise A/B choices that converge on reliable rankings
- Write prioritization results back to note frontmatter for queryability
- Record every scoring/ranking/comparison decision with timestamps

## Solutionstatement

### Use Case

- Flow: User opens Prioritization Hub → selects folder of notes → chooses mode (Score / Rank / ELO) → works through items → results written to frontmatter
- Gherkin:
  ```gherkin
  Given a folder with 20 inbox items
  When the user starts a scoring session with Ulwick dimensions
  Then each item displays dimension sliders (importance, satisfaction, effort, risk, urgency)
  And the opportunity score is calculated as Importance + max(Importance - Satisfaction, 0)
  And scores are written to note frontmatter on session completion
  And the audit trail records each scoring decision with timestamp

  Given a folder with 15 PBI notes
  When the user starts a ranking session
  Then items are displayed in a sortable list
  And the user can drag-and-drop to reorder
  And rank positions are written to note frontmatter

  Given a folder with 30 tech debt items
  When the user starts an ELO comparison session
  Then items are presented in pairwise A/B cards
  And choosing a winner updates both items' ELO ratings
  And after 5+ comparisons per item the ranking stabilizes
  ```

### Functional Requirements

- [ ] FR-01: Create `src/domain/prioritization/` bounded context with types, events, service
- [ ] FR-02: `PrioritizationConfig` with configurable scoring dimensions and weights
- [ ] FR-03: Score items on 1-5 scale per dimension with weighted total calculation
- [ ] FR-04: Calculate Ulwick opportunity score: `Importance + max(Importance - Satisfaction, 0)`
- [ ] FR-05: Rank items via position-based ordering with drag-and-drop persistence
- [ ] FR-06: ELO comparison engine: pairwise presentation, winner selection, rating update
- [ ] FR-07: ELO algorithm: initial rating 1200, K-factor 32 (configurable), minimum 5 comparisons
- [ ] FR-08: Select notes for prioritization by folder path or frontmatter type filter
- [ ] FR-09: Write scores, ranks, and ELO ratings back to note frontmatter
- [ ] FR-10: Record prioritization decisions in audit trail (timestamp, dimension, old/new value)
- [ ] FR-11: Emit events for all prioritization lifecycle stages (8 events)
- [ ] FR-12: PrioritizationService: orchestrator with state persistence via TypedStorage
- [ ] FR-13: Prioritization Hub View with dashboard, scoring, ranking, ELO, and results pages
- [ ] FR-14: Show prioritization dashboard with overview statistics and active sessions
- [ ] FR-15: Support prioritization as a session type with closure ritual integration

### Technical Requirements

- New bounded context: `src/domain/prioritization/` (isolated domain, same pattern as `src/domain/canvas/`, `src/domain/signal/`)
- `types.ts`: PrioritizationState, PrioritizationSession, PrioritizationConfig, ScoredItem, RankedItem, EloItem, ComparisonDecision, PrioritizationDimension (~80 LOC)
- `events.ts`: PrioritizationEventMap with 8 events (session lifecycle, item scored/ranked, comparison decided, config saved, results applied, loaded) (~30 LOC)
- `ScoringEngine.ts`: Pure functions — `calculateWeightedScore()`, `calculateOpportunityScore()`, `scoreDimension()` (~60 LOC)
- `RankingEngine.ts`: Pure functions — `moveItem()`, `insertAtPosition()`, `rebalanceRanks()` (~40 LOC)
- `EloEngine.ts`: Pure functions — `calculateExpectedScore()`, `updateEloRating()`, `selectNextPair()`, `getConfidenceLevel()` (~60 LOC)
- `PrioritizationService.ts`: Service facade with CRUD, session lifecycle, state persistence via TypedStorage key "prioritization" (~200 LOC)
- `FrontmatterWriter.ts`: Batch write scores/ranks/ELO to note frontmatter via FileSystemClient (~50 LOC)
- `src/infrastructure/events/events.ts`: Compose PrioritizationEventMap into FlowtiEventMap
- `src/infrastructure/events/catalog.ts`: Register 8 prioritization events with category "Prioritization"
- Inbox mappers: `mapPrioritizationCompleted()` wired in InboxService
- Hub View: `PrioritizationHubView` extending BaseHubView with 5 tabs (Dashboard, Scoring, Ranking, ELO, Results)
- Session integration: "Prioritization" session type in SessionService type registry

## Acceptance Criteria

- [ ] Scoring: weighted multi-dimension scoring calculates correct totals and opportunity scores
- [ ] Ranking: drag-and-drop reorder persists positions correctly
- [ ] ELO: pairwise comparison updates ratings per Elo algorithm (K=32, initial 1200)
- [ ] ELO convergence: after 5+ comparisons per item, ranking stabilizes (validated in tests)
- [ ] Folder selection: notes loaded from target folder with type filter support
- [ ] Frontmatter write-back: scores, ranks, and ELO ratings written to note frontmatter
- [ ] Audit trail: all decisions recorded with timestamps (max 10,000 entries with eviction)
- [ ] Events: 8 prioritization events emit with correct payloads
- [ ] State persistence: sessions and configs survive plugin reload
- [ ] Hub View: dashboard shows active sessions, scoring/ranking/ELO views functional
- [ ] Session type: prioritization runs as session with closure ritual summary
- [ ] npm test passes with all new tests green

## Related

- PRD: [[Prioritization Hub PRD]]
- JTBD: [[I need to manage a product backlog]], [[I need an all-in-one Product Management Solution]]
- Persona: [[The Product Owner (Operational Strategist)]], [[Strategic Systems Builder]]
- Inbox: [[We need a tool to prioritize notes]]
