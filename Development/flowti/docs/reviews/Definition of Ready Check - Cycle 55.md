---
type: ReadinessCheck
date: 2026-03-02
cycle: 55
feature: "[[Development/flowti/docs/features/Journey Builder/Journey Builder PRD|Journey Builder PRD]]"
result: PASS
conditions:
  - "PRD stage upgraded from draft to in-progress (resolved in-session)"
---

# Definition of Ready Check: Cycle 55 — Journey Builder

**Cycle**: [[Cycle 55 - Journey Builder]]
**Feature/Driver**: [[Journey Builder PRD]] (Theme 5: Visual Test Authoring — Journey Builder)
**FRI**: 21/35 (new-feature threshold: ≥19/35) — **PASS**
**Date**: 2026-03-02
**Result**: **PASS** (1 condition resolved in-session)

## Readiness Summary

| Section | Status | Notes |
|---------|--------|-------|
| 1. Feature PRD Readiness | PASS | FRI 21/35; PRD v1.0 with 12 FRs; stage upgraded draft → in-progress; exceeds new-feature threshold |
| 2. Backlog Readiness | PASS | 12 PBIs (9 in C55 scope); chunked into 10 increments; dependency graph documented; priority ranked |
| 3. Cycle Plan Document | PASS | Full plan with situation assessment, 7 goals, 10 increments with estimates, dependency graph, risks, success metrics, deferred items |
| 4. Increment Readiness | PASS | All 11 increments have: scope, AC, LOC/test estimates. Architecture seams implied by component names |
| 5. Quality Baseline | PASS | 6,195 tests (265 suites), green build, 0 errors (5 warnings), no critical bugs, C54 closed |
| 6. Pre-Cycle Completion | PASS | C54 closed (stage: done, 15 increments), spike validated foundation, inbox reviewed |

## FRI Score Breakdown

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Strategy | 4/5 | Directly serves Theme 5 "Visual Test Authoring". Journey Builder is the next logical step after Journey Runner (C54). Closes the authoring loop: visual editing → JSON → test execution → canvas report. PRD tagged `core` with priority 5/5 and business_value 5/5. Gap: no multi-cycle roadmap beyond C56. |
| Scope | 3/5 | 12 FRs in PRD; 9 PBIs in C55 scope; clear in/out boundaries. 3 PBIs explicitly deferred to C56. Phase 1 (editor, actions, preview) and start of Phase 2 (canvas sync, open existing) well-bounded. Gap: FR-02 (Action Builder) covers 26 tools — full surface area not specified per tool. |
| Architecture | 3/5 | C54 spike validated: sidebar → events → service → file pipeline. EventBridge adapter fallback proven. JourneyBuilderSidebar (427 LOC) and JourneyBuilderService (80 LOC) exist as foundation. StepDefinition/JourneyStep type system in place. Gap: new components (NavBar, StepCard, JSONPanel, CanvasSyncService) not yet designed at interface level; Inc 0 addresses this. |
| Event Integration | 4/5 | 20 events specified in PRD frontmatter. 6 events already implemented and tested (opened, create-new, open-existing, metadata.updated, step.added, exported). New events follow established pattern (domain.entity.verb). Reuses existing file pipeline (file.create.request/response, file.update.request/response). Gap: canvas.synced event interaction with CanvasSessionMonitor not specified. |
| Data Model | 3/5 | JourneyDefinition, StepDefinition, JourneyStep interfaces defined in [[Development/flowti/tests/e2e/helpers/journeyTypes.ts\|journeyTypes.ts]] (~200 LOC). Step improvements field added. StepEditorState interface specified in PRD §5. Gap: per-tool action form schemas not formally typed; action template data structures not defined. |
| UI Consistency | 2/5 | Sidebar pattern proven (3 states: welcome → setup → steps). Accordion pattern exists in AnalyticsHub (DashboardsTab). Autocomplete pattern not yet established in codebase. 26-tool action builder is the most complex UI surface in the plugin. Gap: no mockups or wireframes; StepCard/NavBar/JSONPanel need design iteration during Inc 0. |
| Validation & Testing | 2/5 | ~275 new tests targeted across 10 increments. E2E blueprint exists (13 steps, 8 dev-flagged). Per-increment test counts estimated. All increments have `npm test` green criterion. obsidian-stub supports DOM extensions needed for sidebar testing. Gap: no flow-level integration test specified; test strategy is implicitly unit-focused. |
| **Total** | **21/35** | **Exceeds new-feature threshold (19/35). Gaps concentrated in UI Consistency and Validation — expected for a new UI-heavy feature.** |

## Section-by-Section Verification

### 1. Feature PRD Readiness

- [x] PRD exists: [[Journey Builder PRD]] — v1.0, core feature, 12 Functional Requirements
- [x] Stage: `in-progress` (upgraded from `draft` during this check — C54 spike validates technical approach)
- [x] FRI scored: 21/35 across 7 dimensions
- [x] FRI meets threshold: 21 ≥ 19 (new feature) ✓
- [x] Technical review: C54 Inc 14 spike — JourneyBuilderSidebar (427 LOC), JourneyBuilderService (80 LOC), EventBridge adapter fallback, 6 events wired, canvas improvement cards rendering confirmed

**Condition resolved**: PRD stage upgraded from `draft` to `in-progress`. The C54 spike (Inc 14) demonstrates working code across all architectural layers: UI (sidebar), domain (service), infrastructure (EventBridge adapter). This constitutes sufficient technical validation for the `in-progress` gate.

### 2. Backlog Readiness

- [x] PBIs defined with problem statement (backlog refinement gap analysis table), solution approach (per-PBI descriptions), acceptance criteria (per-PBI AC checklists), and INVEST assessment (vertical slices with end-to-end value)
- [x] PBIs chunked into increments: 9 PBIs across 10 increments (JB-001 split into Inc 1 + Inc 2, JB-002 split into Inc 4 + Inc 5, JB-009 + JB-010 combined into Inc 10)
- [x] Dependencies mapped: dependency graph in cycle plan with parallelism identified (Inc 3 parallel with Inc 1+2; Inc 8 independent after Inc 0)
- [x] Priority ranked: must-have PBIs first (JB-001 → JB-004 → JB-007 → JB-009 → JB-010), should-have last (JB-005, JB-006)
- [x] LOC and test estimates per PBI (total: ~2,120 LOC, ~275 tests)

### 3. Cycle Plan Document

- [x] Frontmatter present: type, feature, stage, cycle, release_anchor, pbis, bugs, tech_debt, estimated_increments (10), estimated_tests (275), pre_cycle_tests (6195), pre_cycle_suites (265)
- [x] Situation assessment written: pre-cycle state with test counts, E2E status, build status, C54 close summary, foundation table (6 components with LOC), carried-forward items
- [x] Cycle goals defined: 7 goals with clear deliverables (step editor, action builder, smart inputs, JSON preview, canvas sync, export, open existing)
- [x] Proposed increments: 10 increments + Inc 0 (architecture), each with scope, AC, LOC/test estimates
- [x] Dependency graph drawn: ASCII diagram with parallelism identified
- [x] Risks identified: 6 risks with impact ratings and mitigations
- [x] Success metrics defined: 9 measurable targets (test count, files, PBIs, tool coverage, event coverage, file types, sync latency, increments)
- [x] Deferred items documented: 6 items with target cycle (JB-008/011/012 → C56, RB-7 → C56, settleMs → JB-002, CI/CD → PBI-RP-003)

### 4. Increment Readiness

For each increment, checking: scope ✓/✗, AC ✓/✗, test intent ✓/✗, doc intent ✓/✗, architecture seams ✓/✗, estimated size ✓/✗

#### Inc 0: Sidebar Architecture Refactor
- [x] Scope: Extract NavBar, StepCard, JSONPanel from monolithic sidebar; sidebar becomes orchestrator
- [x] AC: 6 criteria including component rendering, state coordination, existing tests passing
- [x] Test intent: ~25 tests — NavBar rendering (4), StepCard rendering (4), JSONPanel formatting (4), orchestrator coordination (6), state management (4), edge cases (3)
- [x] Doc intent: JSDoc on extracted components; architecture seams documented in code
- [x] Architecture seams: New components in `src/ui/journeyBuilder/`; JourneyBuilderSidebar refactored (internal, API unchanged)
- [x] Estimate: ~200 LOC production, ~25 tests

#### Inc 1: Step Editor — Metadata Fields (PBI-JB-001a)
- [x] Scope: Full step metadata editor with all fields, accordion sections, chip lists
- [x] AC: 6 criteria including field editability, accordion behavior, chip list CRUD, event emission
- [x] Test intent: ~30 tests — field rendering (8), accordion collapse/expand (4), chip list add/remove (6), event emission (6), data round-trip (4), validation (2)
- [x] Doc intent: JSDoc on StepCard fields; PRD FR-01 checkboxes updated
- [x] Architecture seams: StepCard component (from Inc 0); step.updated event payload typed
- [x] Estimate: ~250 LOC production, ~30 tests

#### Inc 2: Step Editor — Navigation (PBI-JB-001b)
- [x] Scope: Prev/next navigation, add/remove step, reordering, keyboard shortcuts
- [x] AC: 6 criteria including navigation, add/remove with confirmation, reordering, keyboard shortcuts
- [x] Test intent: ~15 tests — prev/next navigation (4), boundary conditions (2), add step (2), remove step with confirmation (2), reorder (3), keyboard shortcuts (2)
- [x] Doc intent: None (incremental feature on existing component)
- [x] Architecture seams: NavBar component (from Inc 0); step.added/removed/reordered events
- [x] Estimate: ~120 LOC production, ~15 tests

#### Inc 3: Event Autocomplete (PBI-JB-003)
- [x] Scope: Reusable EventAutocomplete component over EVENT_CATALOG, fuzzy match, keyboard nav
- [x] AC: 6 criteria including dropdown rendering, 360+ events, category grouping, keyboard navigation
- [x] Test intent: ~25 tests — dropdown rendering (4), fuzzy matching (6), category grouping (3), keyboard navigation (5), integration with inputs (4), edge cases (3)
- [x] Doc intent: JSDoc on EventAutocomplete; reuse documentation for Assert Builder
- [x] Architecture seams: New `src/ui/journeyBuilder/EventAutocomplete.ts`; EVENT_CATALOG data source
- [x] Estimate: ~200 LOC production, ~25 tests

#### Inc 4: Action Builder — Core (PBI-JB-002a)
- [x] Scope: Tool picker (26 tools, 6 categories), per-tool forms, action list with reordering
- [x] AC: 5 criteria including tool picker, per-tool forms, action list reordering, expandable cards
- [x] Test intent: ~35 tests — tool picker rendering (6), category grouping (4), per-tool form fields (10), action list CRUD (6), reordering (4), card expansion (3), edge cases (2)
- [x] Doc intent: JSDoc on ActionBuilder; PRD FR-02 checkboxes updated
- [x] Architecture seams: New `src/ui/journeyBuilder/ActionBuilder.ts`; action.added/updated/removed events
- [x] Estimate: ~350 LOC production, ~35 tests

#### Inc 5: Action Templates (PBI-JB-002b)
- [x] Scope: 4 quick-add templates with fill-in-the-blank forms, multi-action group insertion
- [x] AC: 5 criteria including template picker, 4 template patterns, fill-in forms, custom fallthrough
- [x] Test intent: ~10 tests — template picker rendering (2), per-template action generation (4), form filling (2), custom fallthrough (1), edge cases (1)
- [x] Doc intent: None (builds on Inc 4 documentation)
- [x] Architecture seams: Template definitions as data (array of ActionTemplate configs); ActionBuilder integration
- [x] Estimate: ~100 LOC production, ~10 tests

#### Inc 6: Command Picker (PBI-JB-004)
- [x] Scope: Searchable command dropdown for command actions, data from command registry
- [x] AC: 4 criteria including command list, search by ID/name, selection auto-populates
- [x] Test intent: ~15 tests — dropdown rendering (3), search filtering (4), selection (2), integration with action builder (3), edge cases (3)
- [x] Doc intent: JSDoc on CommandPicker; PRD FR-05 checkboxes updated
- [x] Architecture seams: New `src/ui/journeyBuilder/CommandPicker.ts`; command registry query mechanism
- [x] Estimate: ~120 LOC production, ~15 tests

#### Inc 7: Assert Builder (PBI-JB-005)
- [x] Scope: Guided assert form with type selector, 8 subtypes, dynamic per-type fields
- [x] AC: 5 criteria including all 8 types, dynamic fields, event autocomplete integration, validation
- [x] Test intent: ~30 tests — type selector rendering (2), per-type field rendering (8), dynamic switching (4), event autocomplete integration (3), validation (6), data round-trip (4), edge cases (3)
- [x] Doc intent: JSDoc on AssertBuilder; PRD FR-03 checkboxes updated
- [x] Architecture seams: New `src/ui/journeyBuilder/AssertBuilder.ts`; reuses EventAutocomplete (Inc 3)
- [x] Estimate: ~250 LOC production, ~30 tests

#### Inc 8: Live JSON Preview (PBI-JB-006)
- [x] Scope: Collapsible JSON panel, real-time updates, copy-to-clipboard, toggle button
- [x] AC: 5 criteria including valid JSON rendering, debounced updates, collapsible, copy-to-clipboard
- [x] Test intent: ~15 tests — JSON rendering (3), debounced updates (3), collapse/expand (2), copy-to-clipboard (2), toggle button (2), edge cases (3)
- [x] Doc intent: JSDoc on JSONPanel; PRD FR-06 checkboxes updated
- [x] Architecture seams: JSONPanel component (from Inc 0); debounce utility
- [x] Estimate: ~150 LOC production, ~15 tests

#### Inc 9: Canvas Sync — JSON → Canvas (PBI-JB-007)
- [x] Scope: CanvasSyncService, real-time canvas generation, layout matching report pipeline, debounced writes
- [x] AC: 7 criteria including canvas creation, layout match, real-time updates, split pane, step/action reflection
- [x] Test intent: ~45 tests — canvas JSON generation (10), layout correctness (8), node types (6), step add/remove (4), action reflection (4), debounce (3), file write events (4), edge ordering (3), edge cases (3)
- [x] Doc intent: JSDoc on CanvasSyncService; PRD FR-07 checkboxes updated; architecture notes on layout extraction
- [x] Architecture seams: New `src/domain/journeyBuilder/CanvasSyncService.ts`; reuses layout constants from `generate-e2e-report.mjs`; canvas.synced event; file.create/update events
- [x] Estimate: ~400 LOC production, ~45 tests

#### Inc 10: Export + Open Existing (PBI-JB-009, PBI-JB-010)
- [x] Scope: 3-file export (JSON + .test.ts + .canvas), file picker for existing journeys, dirty tracking
- [x] AC: 6 criteria including 3-file export, file picker, field population, save-back, dirty tracking
- [x] Test intent: ~30 tests — JSON export (3), .test.ts generation (4), .canvas export (3), file picker (4), load-into-editor (5), save-back (3), dirty tracking (4), edge cases (4)
- [x] Doc intent: JSDoc on export/import functions; PRD FR-10 + FR-11 checkboxes updated
- [x] Architecture seams: FuzzySuggestModal for file picker; EventBridge file pipeline; exported event payload extended with 3 paths
- [x] Estimate: ~250 LOC production, ~30 tests

### 5. Quality Baseline

- [x] Build pipeline green: `npm run check` passes — 0 errors, 5 warnings (pre-existing, non-blocking)
- [x] Test suite green: `npm test` → 6,195 tests, 265 suites, 0 failures, 32 skipped (verified 2026-03-02)
- [x] No critical bugs open (verified post-C54)
- [x] Previous cycle closed: C54 stage `done`, date_completed 2026-03-02, 15 increments delivered, 294 new tests, 18 new files

### 6. Pre-Cycle Completion

- [x] Pre-cycle work documented: C54 Inc 14 (Journey Builder Spike) — sidebar (3 states), service wired, EventBridge adapter, 6 events, canvas improvement cards
- [x] Backlog refinement completed: [[backlog-refinement-2026-03-02|Backlog Refinement — Journey Builder]] — 12 PBIs with estimates, dependencies, acceptance criteria
- [x] Inbox signals reviewed:
  - **[[Canvas Integration Plan]]** — Canvas domain (C54) addresses Phase 1-2. Journey Builder canvas sync (PBI-JB-007) builds on this. Already in scope.
  - **[[I want to trigger a process from within a Canvas document]]** — Future canvas interactivity. Not in C55 scope. Deferred.
  - **[[I want to create a flow step by step following service design blueprint]]** — Step-by-step authoring concept aligns with Journey Builder UX. Session Workshop mode (FR-18) is the target vehicle, not Journey Builder. Deferred.
  - E2E inbox items (automated test suite, manual test strategy) — addressed by Journey Runner (C54) and Journey Builder (C55). Already in scope.

## Observations

1. **C54 spike de-risks the architecture**: The spike delivered working code across all layers — UI (JourneyBuilderSidebar, 427 LOC), domain (JourneyBuilderService, 80 LOC), infrastructure (EventBridge adapter, ~60 LOC), and test support (obsidian-stub extensions). This is more foundation than most new-feature cycles start with.

2. **Inc 0 (architecture refactor) is the critical enabler**: Extracting NavBar, StepCard, and JSONPanel from the monolithic sidebar establishes the component boundaries that all subsequent increments build on. If Inc 0 delivers clean interfaces, Inc 1–10 can proceed with confidence.

3. **Action Builder (Inc 4) is the highest-risk increment**: 26 tools across 6 categories, each with unique form fields. The action template pattern (Inc 5) mitigates this by covering ~80% of real-world use cases with 4 quick-add patterns. The full per-tool form is progressive disclosure.

4. **Event Autocomplete (Inc 3) is parallelizable**: It has no dependency on the step editor chain (Inc 0→1→2). Starting Inc 3 alongside Inc 1+2 shortens the critical path. The EventAutocomplete component is then ready when Assert Builder (Inc 7) needs it.

5. **Canvas sync extraction requires careful design**: The layout logic currently lives in `generate-e2e-report.mjs` (a Node.js script). Inc 9 must either extract shared constants or reimplement in TypeScript for plugin runtime. Minor duplication is acceptable; unification deferred to C56.

6. **E2E blueprint covers the full cycle**: The journey-builder.journey.json has 13 steps (5 existing + 8 dev-flagged). As each increment lands, the corresponding dev step can be activated — providing both a test and a living specification.

7. **FRI UI Consistency gap (2/5) is expected**: This is a new UI-heavy feature with no existing mockups. The sidebar pattern is proven, but accordion sections, autocomplete dropdowns, tool pickers, and 8-subtype assert forms are new interaction patterns for the plugin. Inc 0's architecture refactor is the mitigation — establishing patterns before scaling them.

## Related

- [[Cycle 55 - Journey Builder]]
- [[Journey Builder PRD]]
- [[backlog-refinement-2026-03-02|Backlog Refinement — Journey Builder]]
- [[Cycle 54 - Canvas Sessions and Signal Hardening]]
- [[Definition of Ready Check - Cycle 52]]
- [[Definition of Ready (Cycle)]]
- [[Development/flowti/tests/e2e/helpers/journeyTypes.ts|StepDefinition Type System]]
