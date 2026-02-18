---
type: DevelopmentCycle
feature: "[[Session Workspaces PRD]]"
stage: planning
cycle: 6
date_planned: 2026-02-19
date_completed:
pbis:
  - "[[PBI-SW-009 Domain Design Session]]"
bugs:
  - "[[when running a pipeline from the pipeline detail page, the progress bar does not update]]"
  - "[[when importing a report from the data-exchange hub dashboard and then starting another one, the progressbar gets confused and the first started export gets combined with the second one]]"
  - "[[The Data Exchange Dashboard does not know when a Pipeline, Import, or Export was started or is still running after leaving the view]]"
tech_debt:
  - "[[TD-05 main.ts exceeds orchestrator role]]"
estimated_increments: 4
actual_increments:
estimated_tests: 55
actual_tests:
total_tests_after:
total_test_files_after:
---

# Cycle 6: Session Templates, Quality Hardening & TD-05

## Situation Assessment

### Pre-Cycle State (2026-02-19)

**Plugin health:**
- 2,507 tests passing (32 skipped), 99 test files
- Clean working tree, all builds green
- `npm run build` pipeline: vitest + typedoc + tsc + eslint + esbuild
- 42,493 LOC across 216 source files, 15 bounded contexts
- 13 registered commands, ~190 events

**Session Workspaces feature:**
- PRD v7, FRI 34/35 (validation_testing 4→5), stage: in-progress
- PBI-SW-001 through PBI-SW-008: all done (8/9 PBIs delivered)
- PBI-SW-007: done (Cycles 4+5) — daily-tracking, concurrent sessions, auto-start, nudge system, daily summary
- PBI-SW-009: planned (Domain Design guided workflow) — Cycle 6 spike (ADR only)
- Session UX polish: done — command palette (create + resume), dashboard quick action, preferences split
- 68 session events registered (up from 60 at Cycle 3)
- SessionService: 1,267 LOC (33 LOC headroom under 1,300 extraction threshold)
- main.ts: 846 LOC (approaching TD-05 orchestrator threshold)

**DX bugs (3 — all fixed pre-cycle):**
1. ~~Pipeline progress bar does not update from detail page~~ — **fixed** via `operationId` pattern
2. ~~Starting a second import merges progress bars (shared state)~~ — **fixed** via per-operation `operationId` + `pipelineId` correlation
3. ~~Dashboard loses in-flight operation state on navigation~~ — **fixed** via `CsvDisplaySettings` persistence

**Fix implementation:** `operationId` UUID generated per operation start, carried through all `dataExchange.import.*` and `dataExchange.export.*` events. `pipelineId` added for multi-import pipeline correlation. `CsvDisplaySettings` type persisted via `DataExchangeState` for dashboard state recovery. Tests: 55 (ExportService) + 43 (DataExchangeService) + 43 (Pipeline) cover the fix.

**Three Amigos Review (2026-02-19) — PASS with 5 observations:**
1. PBI-SW-009 scope decision needed before spike (layout change vs. enhanced guiding questions)
2. Nudge flow integration test gap (FR-08c) — recommend Flow 14
3. Path reconciliation edge cases untested — extract pure helper
4. Daily tracking disable toggle — low-effort adoption unblock
5. Prioritize user-facing increments before tech debt

**Inbox signals (post-refinement + review):**
- Session template JSON import/export — high priority, low effort, frequently requested
- Three Amigos test quality gaps — medium priority, unblock production confidence
- PBI-SW-009 — large effort, not urgent (evaluate as stretch goal)

---

## Revised Cycle Goals

1. **Deliver session template JSON import/export** — export templates as JSON files, import from file picker, round-trip fidelity
2. **Close Three Amigos test gaps** — nudge flow test (Flow 14), path reconciliation edge cases + pure helper, command palette integration tests
3. **Extract session wiring from main.ts** — `sessionSetup.ts` module (commands, file menu, workspace helpers) to reduce main.ts below 700 LOC
4. **Evaluate PBI-SW-009** (stretch) — UI spike for domain design guided workflow; produce ADR-030

**Completed pre-cycle:**
- ~~Fix 3 DX progress tracking bugs~~ — all fixed via `operationId` pattern + `CsvDisplaySettings` persistence

**Explicitly deferred to Cycle 7+:**
- PBI-SW-010 (Guided session tours with quality gates) — depends on SW-009 patterns
- Daily tracking disable toggle (OBS-4) — low effort but non-blocking; revisit after Cycle 6
- Idea capture on User Hub — separate feature track
- Auto-generate command reference docs — documentation tooling track

---

## Proposed Increments

### Inc 1: Session Template JSON Import/Export

**Goal:** Allow users to export session templates as JSON and import them from file picker.

**Scope:**
- `SessionService.exportTemplate(id): SessionTemplateExport` — pure function returning JSON-serializable object
- `SessionService.importTemplate(data: unknown): SessionTemplate` — Zod-validated import with conflict detection
- UI: "Export" button on saved templates list → downloads JSON file
- UI: "Import" button → file picker → validate → add to saved templates
- Events: `session.template.exported`, `session.template.imported`
- Tests: export round-trip, import validation, duplicate detection, malformed input

**Est.:** ~120 LOC source, ~80 LOC tests, ~15 tests

### Inc 2: Three Amigos Quality Hardening

**Goal:** Close the test coverage gaps identified in the Three Amigos review (OBS-2, OBS-3, OBS-6).

**Scope:**

**2a — Flow 14: Daily Session Nudges (OBS-2)**
- End-to-end flow test: nudge trigger → Notice → accept/dismiss → session start
- Cover: nudge scheduling, dismissal persistence, template-based session creation
- Tests: ~8 new tests in `tests/flows/14-DailySessionNudges.test.ts`

**2b — Path Reconciliation Edge Cases (OBS-3)**
- Extract `updateSessionPathsForFolderMove(session, oldPath, newPath): boolean` pure helper from `SessionService.handleFolderRenamed` (82 LOC → ~20 LOC handler + pure helper)
- Test all 7 session path fields: focusFile, notesFile, canvasFile, contextBindings[].path, artifacts[].path, links[].path, activityFilter[]
- Test template path reconciliation
- Tests: ~10 new tests in `tests/domain/session/helpers.test.ts`

**2c — Command Palette Integration Tests (OBS-6)**
- Verify `flowti:create-session` and `flowti:resume-session` commands are registered
- Test resume behavior with no paused session (shows Notice)
- Tests: ~4 new tests

**Est.:** ~40 LOC source (path helper extraction), ~120 LOC tests, ~22 tests

### Inc 3: Extract sessionSetup.ts from main.ts (TD-05)

**Goal:** Move session commands, file menu, and workspace helpers from main.ts to a dedicated setup module.

**Scope:**
- New `src/sessionSetup.ts` (~200 LOC extracted from main.ts)
- Contains: session commands (`create-session`, `resume-session`), `registerSessionFileMenu()`, `openSessionWorkspaceInSidebar()`, `setupHubRegistry()` session portion
- main.ts calls `setupSessionCommands(plugin, eventBus, sessionService)` in `onLayoutReady()`
- main.ts drops from ~846 to ~650 LOC (below 700 threshold)
- No behavior change — pure extraction

**Est.:** ~10 LOC new (wrapper), ~200 LOC moved, ~5 tests (verification that commands still register)

### Inc 4: PBI-SW-009 Spike (stretch)

**Goal:** Evaluate UI patterns for domain design guided workflow. Produce a decision doc, not implementation.

**Pre-spike decision required (OBS-1):** Does Domain Design Session need:
- **(A) Layout change** — new wizard/stepper UI pattern within SessionWorkspaceView
- **(B) Enhanced guiding questions** — richer guiding question structure (substeps, links, checklists) within existing layout

This decision drives the ADR scope and Cycle 7 implementation approach.

**Scope:**
- Investigate guided wizard patterns in existing codebase (installer, import wizard)
- Sketch UI flow: domain model → bounded contexts → events → services → flows
- Output: `docs/decisions/ADR-030 Domain Design Session UI Pattern.md`
- Document the (A) vs. (B) decision with trade-offs
- If time permits: prototype a single guided step in SessionWorkspaceView

**Est.:** Research only (~0 LOC source, ADR document)

---

## Dependency Graph

```
Inc 1: Session Template Import/Export (independent)

Inc 2: Three Amigos Quality Hardening (independent)
  ├── 2a: Flow 14 Nudge Tests (independent)
  ├── 2b: Path Reconciliation Helper + Tests (independent)
  └── 2c: Command Palette Tests (independent)

Inc 3: Extract sessionSetup.ts (independent, after Inc 1–2 for clean diff)

Inc 4: PBI-SW-009 Spike (independent, stretch — requires OBS-1 pre-decision)
```

**Recommended execution order:** Inc 1 → Inc 2 → Inc 3 → Inc 4. User-facing feature first, then quality hardening, then tech debt, then research. Inc 2a/2b/2c can be parallelized.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Session template JSON schema versioning | Low | Include `version: 1` field in export format. Import validates via Zod schema. |
| Path reconciliation refactor introduces regression | Medium | Extract as pure helper first, test in isolation, then swap in SessionService |
| main.ts extraction introduces import cycle | Low | sessionSetup.ts only imports types + services, never the plugin class |
| PBI-SW-009 scope creep from spike | Medium | Strict timebox: spike produces ADR only, no implementation |
| Nudge flow test requires NudgeService mocking | Low | Use isolated EventBus + fake timers; no real scheduler needed |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Tests added | ~47 new (~15 + ~22 + ~5 + ~5 for verification) |
| Tests total | ~2,554+ |
| Test suites | ~101+ (99 + Flow 14 + potentially path reconciliation) |
| LOC added (source) | ~170 new (~120 template + ~40 path helper + ~10 wrapper) |
| LOC moved (refactor) | ~200 (main.ts → sessionSetup.ts) |
| Bugs fixed | 3 (DX progress — completed pre-cycle) |
| PBIs progressed | PBI-SW-009 (spike → decision via ADR-030) |
| New events | 2 (session.template.exported, session.template.imported) |
| main.ts LOC | <700 (from 846) |
| Three Amigos gaps closed | Flow 14 (nudges), path reconciliation helper + tests, command palette tests |
| New flow test suites | 1 (Flow 14: Daily Session Nudges) |

---

## Cycle Retrospective

### What Went Well
<!-- Filled post-delivery -->

### Deviations from Plan
<!-- Filled post-delivery -->

### Improvement Backlog (from this cycle)
<!-- Filled post-delivery -->

### Learnings
<!-- Filled post-delivery -->

---

## Related

- PRD: [[Session Workspaces PRD]] (v7, FRI 34/35)
- PRD: [[Data Exchange Hub PRD]] (3 bugs fixed pre-cycle)
- PBIs: [[PBI-SW-009 Domain Design Session]] (spike)
- Bugs: [[when running a pipeline from the pipeline detail page, the progress bar does not update]], [[when importing a report from the data-exchange hub dashboard and then starting another one, the progressbar gets confused and the first started export gets combined with the second one]], [[The Data Exchange Dashboard does not know when a Pipeline, Import, or Export was started or is still running after leaving the view]]
- Tech debt: [[TD-05 main.ts exceeds orchestrator role]]
- Review: [[Three Amigos Review 2026-02-19 Session Workspaces]] (PASS with 5 observations)
- Previous Cycle: [[Cycle 5 - Daily Summary and Session Nudges]]
