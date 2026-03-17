---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: approved
related_events: []
maturity: L1
fri: 23
business_value: 5
implementation_cost: 3
maintenance_cost: 2
discovery_cost: 2
design_cost: 3
test_cost: 2
priority: 1
---

# Prioritization Hub PRD

## 1. Problem Statement

Product owners, delivery managers, and strategic systems builders working in information-rich Obsidian vaults face a critical gap: they can capture, structure, and document hundreds of ideas, PBIs, and inbox items — but have no tool-assisted way to prioritize them against each other. The current workflow relies on manual frontmatter edits (`priority: "01 - medium"`), Obsidian Bases for viewing, and gut feeling for ranking. As the vault grows (currently 265+ inbox items, 35 features, 125+ tech debt items), prioritization becomes overwhelming without structured scoring, ranking, and comparison tools.

## 2. Outcome

Users can run structured prioritization sessions within Flowti that produce scored, ranked backlogs. The system supports three prioritization modes:
1. **Scoring** — weighted multi-dimension scoring (importance, satisfaction, effort, risk)
2. **Ranking** — drag-and-drop rank ordering of items in a list
3. **ELO Comparison** — pairwise A/B comparison sessions that converge on a reliable ranking

Prioritization sessions are traceable: every score, rank change, and comparison decision is recorded. Results update frontmatter automatically, making them queryable via Obsidian Bases and Dataview.

## 3. Scope

### In Scope
- Prioritization domain with types, events, and service
- Three prioritization modes: Scoring, Ranking, ELO Comparison
- Folder/Base selection: choose which notes to prioritize (by folder, Base view, or type)
- Scoring dimensions: configurable weighted criteria (importance, satisfaction, effort, risk, urgency — Ulwick opportunity formula supported)
- ELO algorithm: pairwise comparison with Elo rating convergence
- Ranking view: drag-and-drop sortable list with position persistence
- Session integration: run prioritization as a session type
- Frontmatter updates: scores and ranks written back to note frontmatter
- Prioritization history: audit trail of decisions with timestamps
- Prioritization Hub view: dashboard showing scored/ranked lists, active sessions, comparison queue
- Events: prioritization lifecycle events (session started, item scored, comparison decided, session completed)

### Out of Scope
- AI-assisted prioritization (future — see AI inbox items)
- Multi-user collaborative prioritization (future)
- External tool sync for priorities (use Signal Integration)
- Custom prioritization algorithms beyond scoring/ranking/ELO
- Automated re-prioritization based on events

## 4. UX Entry Points
- **Command palette**: `flowti:start-prioritization` — opens prioritization session wizard
- **Hub**: Prioritization tab in a Hub view (or standalone Prioritization Hub)
- **Context menu**: Right-click folder → "Prioritize notes in folder"
- **Session**: Start a session of type "Prioritization" → opens prioritization workspace

## 5. Functional Requirements

- [ ] FR-01: Select notes for prioritization by folder path, Obsidian Base view, or frontmatter type filter
- [ ] FR-02: Score notes on configurable dimensions (1-5 scale) with customizable weights
- [ ] FR-03: Calculate opportunity score using Ulwick formula: `Importance + max(Importance - Satisfaction, 0)`
- [ ] FR-04: Rank notes via drag-and-drop with automatic position persistence to frontmatter
- [ ] FR-05: Run ELO comparison sessions with pairwise A/B presentation
- [ ] FR-06: Calculate and update ELO ratings after each comparison decision
- [ ] FR-07: Display prioritized list sorted by score, rank, or ELO rating
- [ ] FR-08: Write prioritization results back to note frontmatter (score, rank, elo_rating fields)
- [ ] FR-09: Record prioritization decisions in audit trail (timestamp, dimension, old/new value, reason)
- [ ] FR-10: Support prioritization as a session type with closure ritual integration
- [ ] FR-11: Show prioritization dashboard with overview statistics and active sessions
- [ ] FR-12: Emit events for all prioritization lifecycle stages

## 6. Data Model Impact

| Entity | Fields | Storage |
|--------|--------|---------|
| `PrioritizationState` | sessions, configs | `prioritization` storage key |
| `PrioritizationSession` | id, name, mode (score/rank/elo), targetFolder, targetType, items, status, created, completed | Persisted in state |
| `PrioritizationConfig` | id, name, dimensions, weights, eloK (K-factor), defaultMode | Persisted in state |
| `ScoredItem` | noteId, path, scores (dimension→value map), totalScore, opportunityScore | Runtime + frontmatter |
| `RankedItem` | noteId, path, rank, previousRank | Runtime + frontmatter |
| `EloItem` | noteId, path, eloRating, comparisons, wins, losses | Runtime + frontmatter |
| `ComparisonDecision` | itemA, itemB, winner, reason?, timestamp | Audit trail |
| `PrioritizationDimension` | id, name, description, weight, scale (1-5) | Config |

### Default Scoring Dimensions
| Dimension | Weight | Description |
|-----------|--------|-------------|
| Importance | 1.0 | How important is this to the user? |
| Satisfaction | 1.0 | How well is this need met today? |
| Effort | 0.5 | How much effort to implement? (inverse) |
| Risk | 0.5 | How risky is this if not addressed? |
| Urgency | 0.5 | How time-sensitive is this? |

### ELO Parameters
- **Initial rating**: 1200
- **K-factor**: 32 (default, configurable)
- **Minimum comparisons**: 5 per item for reliable ranking

## 7. Event Impact

### Produced
- `prioritization.session.started` — Session begins (payload: sessionId, mode, itemCount)
- `prioritization.session.completed` — Session finishes (payload: sessionId, results summary)
- `prioritization.item.scored` — Item receives score (payload: noteId, dimension, score)
- `prioritization.item.ranked` — Item rank changes (payload: noteId, oldRank, newRank)
- `prioritization.comparison.decided` — ELO comparison decided (payload: itemA, itemB, winner)
- `prioritization.config.saved` — Config created/updated (payload: configId)
- `prioritization.results.applied` — Results written to frontmatter (payload: itemCount)
- `prioritization.loaded` — State loaded from storage (payload: state)

### Consumed
- `session.started` — To bind prioritization to session context
- `session.completed` — To finalize prioritization when session ends

## 8. UI Layout Impact

### Prioritization Hub View (or tab within existing Hub)
- **Dashboard**: Active sessions, recent results, quick-start buttons
- **Scoring View**: Note list with dimension sliders, real-time total/opportunity scores
- **Ranking View**: Drag-and-drop sortable list with rank badges
- **ELO Comparison View**: Side-by-side card comparison with "A wins" / "B wins" / "Skip" buttons
- **Results View**: Sorted list with scores, sparklines for score history, export option

### Session Integration
- Prioritization as a session type in Session Workspace
- Closure ritual includes prioritization summary

## 9. Adapter Impact

- `PrioritizationService`: Session lifecycle, scoring engine, ELO calculator, ranking engine, frontmatter writer
- `FileSystemClient`: Read note frontmatter for item list, write updated scores/ranks
- `IStorageProvider`: Persist PrioritizationState
- `EventBus`: Emit prioritization events
- `SessionService`: Optional session binding

## 10. Non-Functional Requirements

- Scoring calculation must complete within 100ms for up to 500 items
- ELO comparison view must render within 200ms
- Drag-and-drop ranking must feel responsive (no visible lag)
- Frontmatter writes must be batched (not per-keystroke)
- Audit trail must not exceed 10,000 decisions (oldest evicted)

## 11. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| ELO convergence requires many comparisons | Medium | Show confidence indicator; suggest minimum 5 per item |
| Frontmatter writes conflict with manual edits | Medium | Batch writes on session completion, not real-time |
| Large item sets (500+) overwhelm comparison view | Medium | Sample-based comparison; focus on uncertain items |
| Users abandon sessions before completing | Low | Save session state; resume later |

## 12. FRI Score (Planning)

| Dimension | Score | Notes |
|-----------|-------|-------|
| Strategy | 3/5 | Clear problem (manual prioritization overwhelming at 265+ items). Aligned with Product Owner persona and product backlog JTBD. Not 5/5 — new untested domain, strategic value grows with usage data. |
| Scope | 4/5 | Well-defined in/out scope. 3 clear modes (Scoring, Ranking, ELO). 12 FRs. Clear deferrals (AI, multi-user, external sync). Not 5/5 — edge cases for large sets need refinement. |
| Architecture | 3/5 | New bounded context following proven patterns (Canvas, Signal). Service + TypedStorage + EventBus composition. Not 5/5 — no ADR yet, no proof of concept for ELO algorithm or drag-and-drop. |
| Event Integration | 4/5 | 8 events defined with payloads. 2 consumed events (session lifecycle). Follows established event composition pattern. Not 5/5 — no event sequence diagram yet. |
| Data Model | 4/5 | 8 entities clearly defined. ELO parameters specified. Default scoring dimensions with weights. Storage key defined. Not 5/5 — frontmatter write-back schema not fully specified. |
| UI Consistency | 2/5 | Hub view described with 5 tabs. Follows BaseHubView pattern. No wireframes or ASCII mockups yet. |
| Validation & Testing | 3/5 | Test intent stated per increment. Flow test planned. ~120 tests estimated. ELO convergence test planned. Not 5/5 — no Gherkin scenarios at PRD level. |
| **Total** | **23/35** | **Technically Ready** (threshold: ≥ 19/35 for new features) |

### FRI Improvement Path

| Dimension | Current | Target | How |
|-----------|---------|--------|-----|
| Architecture | 3 | 4 | Create ADR for ELO algorithm + frontmatter write-back pattern |
| UI Consistency | 2 | 4 | Add ASCII wireframes for scoring, ranking, and ELO views |
| Validation & Testing | 3 | 4 | Add Gherkin scenarios for each prioritization mode |

## 13. Acceptance Criteria

- [ ] User can select a folder of notes and score them on weighted dimensions
- [ ] Opportunity score (Ulwick) is calculated and displayed for each item
- [ ] User can drag-and-drop rank items in a sorted list
- [ ] User can run an ELO comparison session with pairwise A/B choices
- [ ] ELO ratings converge to a stable ranking after sufficient comparisons
- [ ] Scores, ranks, and ELO ratings are written to note frontmatter
- [ ] Prioritization decisions are recorded with timestamps in audit trail
- [ ] Prioritization can run as a session type with closure ritual
- [ ] All 8 prioritization events emit with correct payloads
- [ ] Dashboard shows overview of active sessions and recent results

## 14. Definition of Done

- All acceptance criteria verified manually
- Unit tests cover PrioritizationService, scoring engine, ELO calculator, ranking engine
- ELO convergence tested with known outcomes
- Frontmatter write/read round-trip tested
- Session integration tested
- Event emission verified in tests
- `npm run build` passes (vitest, tsc, eslint, esbuild)

## 15. Extended Backlog

| PBI | Title | Status | Priority | Depends On | Source |
|-----|-------|--------|----------|------------|--------|
| [[PBI-PRI-001 Scoring and Ranking Engine]] | Core prioritization engine with scoring, ranking, and ELO | Planned | High | — | [[We need a tool to prioritize notes]] |
| PBI-PRI-002 | Prioritization Hub View | Discovery | Medium | PBI-PRI-001 | Inbox triage 2026-02-22 |
| PBI-PRI-003 | Session Type Integration | Discovery | Low | PBI-PRI-001 | Inbox triage 2026-02-22 |

> **Inbox triage (2026-02-22):** PRD created from inbox item [[We need a tool to prioritize notes]]. 3 PBIs scoped. PBI-PRI-001 selected for Cycle 16.

## 16. Related

- Persona: [[The Product Owner (Operational Strategist)]], [[Strategic Systems Builder]]
- JTBD: [[I need to manage a product backlog]], [[I need an all-in-one Product Management Solution]]
- Inbox: [[We need a tool to prioritize notes]]
- ADR: (none yet — to be created during Cycle 16 if needed)
