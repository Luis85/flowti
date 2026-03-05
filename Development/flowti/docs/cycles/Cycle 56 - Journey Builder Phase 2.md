---
type: DevelopmentCycle
feature: "[[Development/flowti/docs/features/Journey Builder/Journey Builder PRD|Journey Builder PRD]]"
stage: planned
cycle: 56
release_anchor:
  - "Theme 5: Visual Test Authoring — Journey Builder Phase 2"
  - "Theme 6: Architecture Hardening"
pbis:
  - "PBI-JB-008: Canvas → JSON Conversion"
  - "PBI-JB-011: Preview Run"
  - "PBI-JB-012: Dual Input"
  - "PBI-JB-013: Step Background Image"
bugs: []
tech_debt:
  - TD-130
  - TD-01
  - TD-85
  - TD-24
  - TD-30
  - TD-92
estimated_increments: 10
estimated_loc: 570
estimated_tests: 90
pre_cycle_tests: 6594
pre_cycle_suites: 276
---

# Cycle 56 — Journey Builder Phase 2 + Architecture Hardening

## Release Anchor Theme

- **Theme 5: Visual Test Authoring — Journey Builder Phase 2** — Extend the Journey Builder with canvas round-trip, preview run, dual input, and step background images.
- **Theme 6: Architecture Hardening** — Extract orchestrator components, update conventions, harden publication readiness.

## Situation Assessment

### Pre-Cycle State

- **Tests**: 6,594 passing (276 suites) — all green
- **Build**: `npm run build` green
- **Open bugs**: None critical
- **Previous cycle**: C55 (Journey Builder Phase 1) closed — 12 increments, 399 new tests, 9/9 PBIs delivered
- **Release Blockers**: 3 open (RB-1 installer config, RB-2 ESLint compliance, RB-7 pipeline merge)
- **Tech Debt**: 30 open/mitigated items (3 high, 10 medium, 7 low)

### Foundation from C55

| Component | Status | LOC |
|-----------|--------|-----|
| JourneyBuilderSidebar | Orchestrator: 3 states, 9 composable components | 549 |
| canvasSync.ts | JSON → Canvas sync (1500ms debounce, event-driven zoom) | 153 |
| toolSchemas.ts | 34 tool schemas (fields, categories, labels) | 411 |
| EventSuggest | Fuzzy autocomplete with category badges | 167 |
| ActionForm | Schema-driven generic form for any tool | 103 |
| Export pipeline | 3-file export (JSON + .test.ts + .canvas) | — |
| Open Existing | FuzzySuggestModal + import handler | — |

### Carried Forward from C55

| Item | Classification | Action |
|------|----------------|--------|
| PBI-JB-008: Canvas → JSON | Phase 2 feature | This cycle |
| PBI-JB-011: Preview Run | Phase 2 feature | This cycle |
| PBI-JB-012: Dual Input | Phase 2 feature | This cycle |
| Save-back to source file with dirty tracking | Enhancement | Fold into canvas round-trip work |
| Canvas layout deduplication (TD-131) | Tech debt | Defer to C57 |
| Drag-and-drop action reordering | Enhancement | Stretch goal |
| Accordion collapse/expand for step sections | Enhancement | Stretch goal |

## Cycle Overview

Cycle 56 completes the Journey Builder's **bidirectional canvas round-trip**: users can now edit journeys from either the sidebar or the canvas, with changes syncing both ways. Preview Run adds dry-run execution with live canvas highlighting. Step Background Images enable attaching wireframes or mockups during journey design.

In parallel, the architecture dimension addresses JourneyBuilderSidebar size creep (TD-130), establishes orchestrator extraction conventions, and clears 3 documentation-focused tech debt items. Process improvements include the PR workflow definition (TD-92) and ESLint compliance (RB-2).

## User Pains

1. **Canvas is one-way** — Edits flow from sidebar → canvas but not canvas → sidebar. Users who prefer visual editing hit a dead end.
2. **No way to preview a journey** — The only way to see if a journey works is to run the full E2E suite against the test vault.
3. **No visual context on steps** — Journey steps are text-only during design; wireframes and mockups live in separate files.
4. **Orchestrator grows unchecked** — JourneyBuilderSidebar (549 LOC in C55, projected to grow in C56) lacks extraction checkpoints.

## Cycle Goals

1. **Canvas → JSON** — Parse companion canvas back to journey definition (bidirectional round-trip)
2. **Preview Run** — Dry-run a journey step sequence with simulated output and canvas highlighting
3. **Dual Input** — Support both JSON editing and canvas editing as entry points
4. **Step Background Images** — Attach wireframes/mockups to steps, rendered on canvas group nodes
5. **Orchestrator extraction** — Extract WelcomeScreen, SetupForm, CanvasSyncController from sidebar
6. **Documentation cleanup** — TD-85, TD-24, TD-30
7. **PR workflow** — TD-92 + ESLint compliance (RB-2)

## Scope

### In Scope

- PBI-JB-008: Canvas → JSON conversion (FR-08 in JB PRD)
- PBI-JB-011: Preview Run (FR-09 in JB PRD)
- PBI-JB-012: Dual Input for Journey Runner (FR-12 in JB PRD)
- PBI-JB-013: Step Background Image (FR-13 in JB PRD)
- TD-130: JourneyBuilderSidebar extraction (target: <600 LOC)
- TD-01: Orchestrator convention documentation
- TD-85: Batch-add type frontmatter to ~40% of docs
- TD-24: Update AGENTS.md
- TD-30: Reclassify as mitigated
- TD-92: PR workflow definition + branch protection
- RB-2: ESLint Obsidian rules compliance

### Out of Scope

- Test Management Hub (C57)
- Journey Executor (C57)
- CI/CD pipeline (C58)
- Action recording (macro mode)
- Visual regression / screenshot diffing
- RB-7: Pipeline multi-source merge (deferred to v1.1)

## Increments

### Inc 0: Orchestrator Extraction (TD-130)
**Theme**: Architecture
**Effort**: Medium | **Est. LOC**: ~100 (net reduction) | **Est. Tests**: ~10

Extract from JourneyBuilderSidebar:
- `WelcomeScreen` component (welcome state rendering)
- `SetupForm` component (metadata collection)
- `CanvasSyncController` (canvas sync scheduling and lifecycle)
- Target: sidebar ≤600 LOC (from ~549 + Phase 2 additions)
- Document extraction checkpoint convention in TD-01

**Acceptance Criteria**:
- [ ] JourneyBuilderSidebar ≤600 LOC after extraction
- [ ] All extracted components independently testable
- [ ] Existing tests pass unchanged
- [ ] `npm test` green

### Inc 1: Canvas → JSON Parser (PBI-JB-008a)
**Theme**: Feature
**Effort**: Large | **Est. LOC**: ~150 | **Est. Tests**: ~20

Build the canvas-to-journey parser:
- Detect journey-structured canvas (START node + step groups + END node pattern)
- Parse step group labels → `steps[i].title` and `guideSection`
- Parse config text nodes → structured metadata (description, events, commands)
- Parse action nodes → `steps[i].actions[]`
- Edge ordering → step sequence
- Improvement cards (yellow, color "3") → `steps[i].improvements[]`
- Background image on group node → `steps[i].backgroundImage`

**Acceptance Criteria**:
- [ ] Parser detects journey-structured canvases
- [ ] Round-trip: JSON → Canvas → JSON produces identical definition
- [ ] `npm test` green

### Inc 2: Canvas → JSON Integration (PBI-JB-008b)
**Theme**: Feature
**Effort**: Medium | **Est. LOC**: ~80 | **Est. Tests**: ~10

Wire the parser into the sidebar workflow:
- "Convert to Journey" command on canvas files
- Detection: opening a `.canvas` with journey structure offers conversion
- Canvas edits trigger re-parse and sidebar update (reverse sync)
- Debounced bidirectional sync (prevent infinite loops)
- Conflict resolution: last-write-wins with visual indicator

**Acceptance Criteria**:
- [ ] Bidirectional sync works (sidebar ↔ canvas)
- [ ] No infinite sync loops
- [ ] `npm test` green

### Inc 3: Preview Run (PBI-JB-011)
**Theme**: Feature
**Effort**: Medium | **Est. LOC**: ~150 | **Est. Tests**: ~15

Dry-run execution with visual feedback:
- "Preview Run" button in step editor toolbar
- Executes journey definition using simulated action runner
- Steps execute sequentially; canvas nodes update in real-time (green = pass, red = fail, gray = pending)
- Event trace collected and shown in Events Summary node
- Does NOT require test vault — runs simulation in current vault
- Results inspectable: click any step node to see pass/fail details

**Acceptance Criteria**:
- [ ] Preview executes all steps with simulated pass/fail
- [ ] Canvas highlights active step during run
- [ ] Results shown per step
- [ ] `npm test` green

### Inc 4: Dual Input (PBI-JB-012)
**Theme**: Feature
**Effort**: Small | **Est. LOC**: ~80 | **Est. Tests**: ~10

Support both JSON and canvas as input formats:
- Journey Runner accepts `.canvas` files (parsed via Inc 1 conversion)
- Journey Builder can be opened from either a `.journey.json` or a `.canvas` file
- Results output format identical regardless of input format
- File picker shows both `.journey.json` and `.canvas` files

**Acceptance Criteria**:
- [ ] Journey Runner accepts `.canvas` input
- [ ] Journey Builder opens from canvas files
- [ ] Results identical for both input formats
- [ ] `npm test` green

### Inc 5: Step Background Image (PBI-JB-013)
**Theme**: Feature
**Effort**: Small | **Est. LOC**: ~80 | **Est. Tests**: ~10

Attach wireframes/mockups to journey steps:
- Optional `backgroundImage` field on JourneyStep
- Step card shows "Add Background" button (or thumbnail preview if set)
- File picker filtered to image files (PNG, JPG, SVG)
- Canvas group node renders background image
- Preserved through export/import and canvas round-trip
- Remove button clears field and canvas background

**Acceptance Criteria**:
- [ ] Background image can be added/removed from step card
- [ ] Canvas renders background on step group node
- [ ] Round-trip preserves background image
- [ ] `npm test` green

### Inc 6: Documentation Cleanup (TD-85, TD-24, TD-30)
**Theme**: Documentation / Debt
**Effort**: Medium | **Est. LOC**: ~0 (docs only) | **Est. Tests**: 0

- TD-85: Batch-add type frontmatter to remaining ~40% of docs lacking it
- TD-24: Update AGENTS.md with current stats (~260 files, 50K LOC, 276 suites)
- TD-30: Reclassify as mitigated — remaining untested areas are bootstrap/wiring with low ROI at 6,594 tests

**Acceptance Criteria**:
- [ ] >90% of docs have type frontmatter
- [ ] AGENTS.md reflects current codebase state
- [ ] TD-30 status changed to mitigated with rationale
- [ ] `npm test` green

### Inc 7: Frontend Architecture Refresh
**Theme**: Documentation
**Effort**: Small | **Est. LOC**: ~0 (docs only) | **Est. Tests**: 0

- Update Frontend Architecture.md with C55/C56 metrics and Journey Builder domain
- Create component docs for new C56 components (canvas parser, preview runner)
- Update sitemap for canvas round-trip flow
- Update orchestrator convention documentation (TD-01)

**Acceptance Criteria**:
- [ ] Frontend Architecture.md reflects current state
- [ ] Component docs created for new components
- [ ] Sitemap updated

### Inc 8: PR Workflow + ESLint (TD-92, RB-2)
**Theme**: Process
**Effort**: Medium | **Est. LOC**: ~0 (config only) | **Est. Tests**: 0

- Define PR workflow: branch naming convention, draft → review → merge
- Add branch protection on master (require CI pass when CI exists)
- Complete ESLint Obsidian rules compliance (RB-2 — in progress from C55)

**Acceptance Criteria**:
- [ ] PR workflow documented
- [ ] Branch protection configured (or documented for when CI is added in C58)
- [ ] ESLint Obsidian rules pass (RB-2 closed)

### Inc 9: Regression Suite + E2E Journey
**Theme**: Quality
**Effort**: Medium | **Est. LOC**: ~100 | **Est. Tests**: ~15

- Regression suite: 10 tests for bidirectional canvas consistency
- E2E journey: Journey Builder canvas round-trip (full flow)
- Verify all Phase 2 features work end-to-end

**Acceptance Criteria**:
- [ ] 10 regression tests for canvas sync consistency
- [ ] E2E journey for canvas round-trip passes
- [ ] `npm test` green
- [ ] `npm run build` green

## Dependency Graph

```
Inc 0 (Extraction)        ──→ Inc 1, Inc 5
Inc 1 (Canvas Parser)     ──→ Inc 2 (Integration), Inc 4 (Dual Input)
Inc 2 (Bidirectional Sync) ──→ Inc 3 (Preview Run)
Inc 3 (Preview Run)        ──→ Independent after Inc 2
Inc 4 (Dual Input)         ──→ Independent after Inc 1
Inc 5 (Background Image)   ──→ Independent after Inc 0
Inc 6 (Docs Cleanup)       ──→ Independent (parallel)
Inc 7 (Arch Docs)          ──→ After Inc 5 (needs final component list)
Inc 8 (PR Workflow)        ──→ Independent (parallel)
Inc 9 (Regression + E2E)   ──→ After Inc 4 (needs all features)
```

**Parallelizable**: Inc 6 (Docs), Inc 8 (Process) can run alongside any feature increment.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Canvas → JSON parsing is lossy (canvas text doesn't preserve all metadata) | High | Design config text node format to include all fields; accept some metadata loss for hand-edited canvases |
| Bidirectional sync creates infinite loops | Medium | Debounce + change source tracking (skip sync triggered by own write) |
| Preview Run blocks UI during execution | Medium | Execute via setTimeout/requestAnimationFrame yielding; show progress indicator |
| Background image paths break on vault move | Low | Store vault-relative paths; accept breakage on vault restructure |
| JB Sidebar exceeds 600 LOC target after Phase 2 additions | Medium | Aggressive extraction in Inc 0; monitor LOC after each increment |
| Canvas format changes in future Obsidian versions | Low | Version-check canvas JSON schema; defensive parsing with fallbacks |

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~90 |
| Post-cycle tests | ~6,700+ |
| New suites | ~5 |
| Source LOC | ~570 |
| PBIs delivered | 4 (JB-008, JB-011, JB-012, JB-013) |
| TD items addressed | 5 (TD-130, TD-01, TD-85, TD-24, TD-30) |
| Release blockers closed | 1 (RB-2) |
| Canvas round-trip fidelity | 100% lossless (JSON → Canvas → JSON) |
| Increments | ~10 |

## Definition of Done

- [ ] Canvas → JSON parser implemented and tested
- [ ] Bidirectional canvas sync works without loops
- [ ] Preview Run executes with canvas highlighting
- [ ] Dual Input accepts both .journey.json and .canvas
- [ ] Step background images render on canvas
- [ ] JourneyBuilderSidebar ≤600 LOC
- [ ] TD-85, TD-24, TD-30 addressed
- [ ] PR workflow documented (TD-92)
- [ ] ESLint Obsidian compliance (RB-2)
- [ ] Regression suite (10 tests) + E2E journey passes
- [ ] `npm run build` green
- [ ] Three Amigos review completed
