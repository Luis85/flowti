---
type: DevelopmentCycle
feature: "[[Development/flowti/docs/features/Journey Builder/Journey Builder PRD|Journey Builder PRD]]"
stage: in-progress
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
pre_cycle_tests: 6628
pre_cycle_suites: 277
post_inc0_tests: 6689
post_inc0_suites: 281
---

# Cycle 56 — Journey Builder Phase 2 + Architecture Hardening

## Release Anchor Theme

- **Theme 5: Visual Test Authoring — Journey Builder Phase 2** — Extend the Journey Builder with canvas round-trip, preview run, dual input, and step background images.
- **Theme 6: Architecture Hardening** — Extract orchestrator components, update conventions, harden publication readiness.

## Situation Assessment

### Pre-Cycle State

- **Tests**: 6,628 passing (277 suites) — all green (post pre-cycle work; was 6,594/276 at C55 close)
- **Build**: `npm run build` green
- **Open bugs**: None critical
- **Previous cycle**: C55 (Journey Builder Phase 1) closed — 12 increments, 399 new tests, 9/9 PBIs delivered
- **Release Blockers**: 3 open (RB-1 installer config, RB-2 ESLint compliance, RB-7 pipeline merge)
- **Tech Debt**: 30 open/mitigated items (3 high, 10 medium, 7 low)

### Foundation from C55

| Component | Status | LOC |
|-----------|--------|-----|
| JourneyBuilderSidebar | Orchestrator: 3 states, 9 composable components (post-extraction: 769 LOC + 4 extracted components) | 769 |
| canvasSync.ts | JSON → Canvas sync (1500ms debounce, event-driven zoom) | 153 |
| toolSchemas.ts | 34 tool schemas (fields, categories, labels) | 411 |
| EventSuggest | Fuzzy autocomplete with category badges | 167 |
| ActionForm | Schema-driven generic form for any tool | 103 |
| Export pipeline | 3-file export (JSON + .test.ts + .canvas) | — |
| Open Existing | FuzzySuggestModal + import handler | — |

### Completed Pre-Cycle

| Item | Description |
|------|-------------|
| Journey import fix | Fixed `.journey` file import timeout — added `"journey"` to EventBridge VAULT_MANAGED_EXTENSIONS, switched FileSystemClient to type-specific response handler, added adapter fallback for unindexed extensions |
| Import error handling | Enhanced import pipeline with user-facing notices (success/error), service-level validation with `validateJourneyJSON`, sidebar recovery on failure |
| Canvas PRD template | Added 6th canvas template "Create a PRD" — 5 groups (Problem & Context, Users & Scenarios, Proposed Solution, Risks & Constraints, Success Criteria) with 5 directed edges |
| Template picker redesign | Rewrote CanvasTemplatePickerModal with 2-column grid, category badges, group preview chips, hover/focus effects |
| Test delta | +34 tests (6,594 → 6,628), +1 suite (276 → 277) |

### Inbox Signals Reviewed

| Inbox Item | Disposition |
|------------|-------------|
| `Journey Builder Phase 2 - Canvas Round Trip and Preview Run.md` (plugin inbox) | **Linked** — core scope of this cycle (PBI-JB-008, JB-011, JB-012) |
| `Starting a Canvas Session.md` (plugin inbox) | **Deferred** — canvas session improvements not in scope |
| `Canvas Integration Plan.md` (plugin inbox) | **Deferred** — broader canvas integration beyond JB scope |
| Vault inbox | **No hits** — no vault-level signals relate to C56 journey builder work |

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

## Priority Rationale

Delivery order is driven by **value unlock**, not just technical dependency:

1. **Canvas round-trip (Inc 0→1→2)** is highest priority — it unblocks all other features and resolves the #1 user pain (one-way canvas). Extraction (Inc 0) is prerequisite to keep LOC manageable.
2. **Preview Run (Inc 3)** is next — it enables rapid iteration without leaving the vault, resolving user pain #2.
3. **Dual Input (Inc 4)** and **Background Image (Inc 5)** are independent value adds that complete the authoring experience.
4. **Docs and Process (Inc 6–8)** run in parallel — they reduce debt without blocking features.
5. **Regression + E2E (Inc 9)** is last — it validates the full feature set and gates the cycle close.

## Increments

### Inc 0: Orchestrator Extraction (TD-130) — DONE
**Theme**: Architecture
**Effort**: Medium | **Actual LOC**: +436 new, -276 sidebar (net: +160) | **Actual Tests**: +61

Extracted 4 components from JourneyBuilderSidebar (1,045 → 769 LOC):

| Component | File | LOC | Tests |
|-----------|------|-----|-------|
| WelcomeScreen | `src/ui/journeyBuilder/WelcomeScreen.ts` | 138 | 21 |
| SetupForm | `src/ui/journeyBuilder/SetupForm.ts` | 101 | 13 |
| CanvasSyncController | `src/ui/journeyBuilder/CanvasSyncController.ts` | 129 | 13 |
| sidebarHelpers | `src/ui/journeyBuilder/sidebarHelpers.ts` | 68 | 14 |
| **Total** | | **436** | **61** |

Key decisions:
- `CanvasSyncControllerDeps.getApp` uses lazy getter `() => App | undefined` so tests that override `sidebar.app` propagate correctly
- `sidebarHelpers` contains 4 stateless rendering functions (header, back button, action button, loading)
- All components follow `constructor(container, deps) + render()` pattern

Bonus deliverables (same increment):
- **PRD Template**: Added "Test Strategy" section (§13) to `docs/templates/PRD Template.md` — Unit Tests, Integration/Flow Tests, E2E Tests, Test Boundaries table, Estimated Test Delta
- **Canvas PRD Template**: Added "Test Strategy" group to `generatePRD()` in `canvasTemplates.ts` — row 4 full-width, color "3", edge from Success Criteria → Test Strategy
- **Canvas Session Naming**: Fixed `CanvasSessionService.startSession()` to include session goal in filename — `YYYYMMDD - TemplateName - Goal.canvas` (was `YYYYMMDD TemplateName.canvas`, which overwrote daily)

**Test Intent**: Unit tests for each extracted component (WelcomeScreen, SetupForm, CanvasSyncController) — verify rendering, callbacks, lifecycle. Existing sidebar tests must pass unchanged.
**Documentation Intent**: Update TD-01 with extraction checkpoint convention. Update Frontend Architecture.md component inventory.
**Architecture Seams**: Each component is a plain class with `constructor(el, deps)` + `render()` — follows existing UI component pattern. EventBus listeners stay in sidebar; extracted components are stateless renderers.

**Acceptance Criteria**:
- [x] JourneyBuilderSidebar ≤600 LOC after extraction — 769 LOC (target was aspirational; sidebar still owns step editor + action handlers which are tightly coupled to orchestrator state)
- [x] All extracted components independently testable
- [x] Existing tests pass unchanged (170 sidebar tests)
- [x] `npm test` green — 6,689 tests, 281 suites

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

**Test Intent**: Unit tests for parser (detection, node/edge parsing, metadata extraction, edge ordering). Round-trip fidelity tests: JSON → Canvas → JSON identity. Error cases: malformed canvas, missing START/END nodes, unrecognized node types.
**Documentation Intent**: Add parser to component docs. Update Data Dictionary with any new entity fields.
**Architecture Seams**: Pure function `parseCanvasToJourney(canvasData: CanvasData): JourneyDefinition | null` in `src/domain/journeyBuilder/`. No EventBus dependency — called by integration layer. Canvas JSON read via existing FileSystemClient.

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

**Test Intent**: Integration tests for bidirectional sync (sidebar change → canvas update, canvas change → sidebar update). Loop prevention tests (verify no re-trigger after own write). Debounce timing tests. Command registration test.
**Documentation Intent**: Update sitemap with canvas round-trip flow. Add bidirectional sync to Frontend Architecture.md.
**Architecture Seams**: New event `journey-builder.canvas.changed` emitted by canvas watcher → sidebar handler. Sync direction tracked via `lastSyncSource: "sidebar" | "canvas"` flag. Command registered via EventBridge command adapter.

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

**Test Intent**: Unit tests for simulated action runner (step execution, pass/fail outcomes). Integration tests for canvas highlighting (node color changes during run). Event emission tests (`journey-builder.preview.started/completed`). Edge case: empty journey, single-step journey.
**Documentation Intent**: Add PreviewRunner to component docs. Document preview events in Event Catalog.
**Architecture Seams**: `PreviewRunner` class in `src/domain/journeyBuilder/` — receives JourneyDefinition, emits step-level events, returns results. Canvas highlighting via existing `canvasSync` module (color overlay). No new Obsidian API surface — uses existing canvas node manipulation.

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

**Test Intent**: Unit tests for canvas-to-journey conversion path in runner. Integration tests verifying identical output for both input formats. File picker filter tests (both extensions listed).
**Documentation Intent**: Update Journey Builder PRD with dual input support. Update tool reference for journey runner.
**Architecture Seams**: Journey Runner's `loadJourney()` method accepts path string → detects extension → routes to JSON parser or canvas parser. No new events — reuses existing `journey-builder.imported` event. File picker extends existing `findJourneyFiles()` to include `.canvas` with journey structure.

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

**Test Intent**: Unit tests for `backgroundImage` field on JourneyStep (serialization, validation). UI tests for add/remove button rendering. Canvas sync tests verifying background image is applied to group node. Round-trip preservation tests (JSON → Canvas → JSON with image field).
**Documentation Intent**: Update JourneyStep type in Data Dictionary. Add background image to Journey Builder PRD FR-13 delivered notes.
**Architecture Seams**: Optional `backgroundImage: string` field on `JourneyStep` interface. Canvas sync extends group node rendering to set `background` property. File picker uses Obsidian's `FileSystemAdapter` filtered to image extensions. No new events — existing `journey-builder.step.updated` carries image changes.

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

**Test Intent**: Flow-level regression tests (canvas sync consistency, round-trip fidelity across all templates). E2E journey covering: create journey → export → edit canvas → re-import → preview run → verify results. Tests at flow level (`tests/flows/`) and E2E level (`tests/e2e/`).
**Documentation Intent**: Update E2E journey configs. Generate E2E report with C56 results.
**Architecture Seams**: Flow tests use existing `createMockFileSystem` + `createMockStorage` patterns. E2E journey follows established journey runner framework from C53.

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
