---
type: DevelopmentCycle
feature: "[[Session Workspaces PRD]]"
stage: planned
cycle: 6
date_planned: 2026-02-19
date_completed:
pbis:
  - "[[PBI-SW-010 Session Lifecycle v2 and Intent Layer]]"
bugs: []
bugs_fixed_precycle:
  - "[[when running a pipeline from the pipeline detail page, the progress bar does not update]]"
  - "[[when importing a report from the data-exchange hub dashboard and then starting another one, the progressbar gets confused and the first started export gets combined with the second one]]"
  - "[[The Data Exchange Dashboard does not know when a Pipeline, Import, or Export was started or is still running after leaving the view]]"
tech_debt: []
estimated_increments: 4
actual_increments:
estimated_tests: 67
actual_tests:
total_tests_after:
total_test_files_after:
---

# Cycle 6: Session Templates, Quality Hardening & Session v2 Foundation

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

**Session v2 PRD Refinement (2026-02-19):**
- Session Workspaces PRD evolved to v8: "Session v2 – Focus & Execution Environment"
- Executive Summary added: strategic purpose, business impact, strategic positioning, "what will change" breakdown (8 subsections)
- 10 new FRs (FR-09 through FR-18) added: lifecycle state machine, intent layer, energy tracking, execution plan, structured reflection, closure ritual, activity intelligence, cognitive overload, main/sidebar separation, workshop mode
- 8 new PBIs (PBI-SW-010 through PBI-SW-017) defined and priority-ranked
- New sections: Business Value (§16), Strategic Perspective (§17)
- **Daily tracking removed:** FR-08 (PBI-SW-007) deprecated — passive tracking conflicts with intentional execution philosophy. `daily-tracking` session type, auto-start, concurrent session routing, daily note integration, nudge system all deprecated.
- FRI re-scored 34→22/35 reflecting undelivered v2 scope
- Cycle 6 goals revised: Inc 3–4 pivoted from TD-05/PBI-SW-009 to Session v2 foundation work

---

## Revised Cycle Goals

1. **Deliver session template JSON import/export** — export templates as JSON files, import from file picker, round-trip fidelity
2. **Close Three Amigos test gaps** — nudge flow test (Flow 14), path reconciliation edge cases + pure helper, command palette integration tests
3. **Session v2 Architecture Spike** — produce ADR-031: Session v2 Architecture (state machine, dual rendering, closure system); define v2 domain types; register v2 event catalog entries
4. **Session v2 Lifecycle & Intent Domain** — PBI-SW-010 domain-first delivery: types, state machine, intent handlers, energy change handler, new events, tests

**Completed pre-cycle:**
- ~~Fix 3 DX progress tracking bugs~~ — all fixed via `operationId` pattern + `CsvDisplaySettings` persistence
- ~~Session Workspaces PRD v8 refinement~~ — Executive Summary, 10 new FRs, 8 new PBIs, v2 scope defined, FRI re-scored, Business Value + Strategic Perspective sections
- ~~Daily tracking feature removed~~ — FR-08 (PBI-SW-007) deprecated, conflicts with v2 intentional execution philosophy

**Explicitly deferred to Cycle 7+:**
- TD-05 main.ts extraction — still valuable, lower priority than v2 foundation
- PBI-SW-009 (Domain Design Session) — depends on Workshop mode patterns from FR-18
- PBI-SW-012 through PBI-SW-017 — v2 incremental delivery
- Daily tracking disable toggle (OBS-4) — superseded by daily tracking removal
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

### Inc 3: Session v2 Architecture Spike

**Goal:** Design the Session v2 architecture. Produce ADR-031 and define v2 domain types.

**Scope:**
- Produce `docs/decisions/ADR-031 Session v2 Architecture.md`:
  - 6-state lifecycle design (prepared → running → paused → reviewing → completed → archived)
  - Dual rendering architecture (Main vs Sidebar views)
  - Closure ritual system design (3-tier template inheritance)
  - Backward compatibility strategy (v1 → v2 migration)
  - Daily tracking removal plan (FR-08 deprecation)
- Define v2 domain types in `src/domain/session/types.ts` (types only, no implementation):
  - `SessionStatusV2`, `SessionIntent`, `SessionMode`, `EnergyLevel`
  - `ExecutionTask`, `ReflectionEntry`, `ClosureResponse`, `ClosureTemplate`, `ClosureQuestion`
  - `CognitiveLoadThresholds`
- Register v2 event catalog entries (planned, not wired)
- Validate UI Composition Map against BaseHubView patterns
- Validate against v2 flow docs: [[Run Intentional Session]], [[Monitor Session from Sidebar]]
- Design state machine transition validator: `isValidTransition(from, to)` pure function

**Est.:** ~60 LOC types, ~0 LOC implementation, ADR document, ~5 type definition tests

**Acceptance criteria:**
- [ ] ADR-031 produced covering: 6-state lifecycle, dual rendering, closure system, backward compat, daily tracking removal
- [ ] v2 domain types defined in `src/domain/session/types.ts` (types only, no implementation): `SessionStatusV2`, `SessionIntent`, `SessionMode`, `EnergyLevel`, `ExecutionTask`, `ReflectionEntry`, `ClosureResponse`, `ClosureTemplate`, `ClosureQuestion`, `CognitiveLoadThresholds`
- [ ] `isValidTransition(from, to)` pure function with tests
- [ ] v2 event catalog entries registered (planned, not wired)
- [ ] UI Composition Map validated against BaseHubView patterns
- [ ] Validated against v2 flow docs: [[Run Intentional Session]], [[Monitor Session from Sidebar]]
- [ ] `npm run build` passes

### Inc 4: Session v2 Intent & Lifecycle Domain (PBI-SW-010)

**Goal:** Deliver PBI-SW-010 domain-first: state machine + intent + energy handlers in SessionService.

**Scope:**
- Implement state machine transition logic in SessionService:
  - `handleStateTransition(sessionId, targetState)` with validation
  - Auto-transition: timer completion → `reviewing` (instead of `completed`)
  - `reviewing` → `completed` gated (placeholder: always allow until FR-14)
- Implement intent handlers:
  - `handleSetIntent(sessionId, intent: SessionIntent)`
  - `handleUpdateIntent(sessionId, intent: SessionIntent)`
  - Intent editable in `prepared`/`paused`, locked in `running`
- Implement energy handler:
  - `handleEnergyChange(sessionId, level: EnergyLevel)`
  - Energy adjustable in `running`/`paused`
- Wire new events: `session.intent.set`, `session.intent.updated`, `session.mode.set`, `session.energy.changed`, `session.review.started`
- Backward compat: `load()` maps `status: "active"` → `"running"`, `intent ??= null`, `energy ??= null`
- Thread `intent` and `energy` through all creation paths (create, rerun, template)
- Tests: state transitions, intent CRUD, energy changes, backward compat, event assertions
- **No UI in this increment** — domain-first, UI-second per L-01

**Est.:** ~200 LOC source, ~100 LOC tests, ~30 tests

**Acceptance criteria:**
- [ ] State machine transitions implemented: `prepared → running → paused → reviewing → completed → archived`
- [ ] `handleStateTransition(sessionId, targetState)` with validation via `isValidTransition()`
- [ ] Auto-transition: timer completion → `reviewing` (instead of `completed`)
- [ ] `reviewing` → `completed` gated (placeholder: always allow until FR-14 Closure Ritual)
- [ ] `handleSetIntent(sessionId, intent)` — editable in `prepared`/`paused`, locked in `running`
- [ ] `handleUpdateIntent(sessionId, intent)` — same state guards
- [ ] `handleEnergyChange(sessionId, level)` — adjustable in `running`/`paused`
- [ ] Events wired: `session.intent.set`, `session.intent.updated`, `session.mode.set`, `session.energy.changed`, `session.review.started`
- [ ] Backward compat: `load()` maps `status: "active"` → `"running"`, `intent ??= null`, `energy ??= null`
- [ ] `intent` and `energy` threaded through create, rerun, template paths
- [ ] No UI changes (domain-first per L-01)
- [ ] `npm run build` passes

---

## Dependency Graph

```
Inc 1: Session Template Import/Export (independent)

Inc 2: Three Amigos Quality Hardening (independent)
  ├── 2a: Flow 14 Nudge Tests (independent)
  ├── 2b: Path Reconciliation Helper + Tests (independent)
  └── 2c: Command Palette Tests (independent)

Inc 3: Session v2 Architecture Spike (independent — design only)

Inc 4: Session v2 Intent & Lifecycle Domain (depends on Inc 3 types)
```

**Recommended execution order:** Inc 1 → Inc 2 → Inc 3 → Inc 4. User-facing feature first, then quality hardening, then v2 design, then v2 domain implementation. Inc 2a/2b/2c can be parallelized. Inc 3 must precede Inc 4 (types defined before handlers).

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Session template JSON schema versioning | Low | Include `version: 1` field in export format. Import validates via Zod schema. |
| Path reconciliation refactor introduces regression | Medium | Extract as pure helper first, test in isolation, then swap in SessionService |
| v2 state machine backward compat breaks existing sessions | Medium | `load()` maps `active` → `running` explicitly. All new fields default to `null` or `[]`. Migration tested. |
| Daily tracking removal orphans existing daily sessions | Medium | `load()` handles `daily-tracking` type gracefully. Existing daily sessions marked `archived` on first load. |
| v2 scope creep from architecture spike | Low | Inc 3 produces ADR + types only. Inc 4 is domain-only (no UI). Strict L-01 boundary. |
| Nudge flow test requires NudgeService mocking | Low | Use isolated EventBus + fake timers; no real scheduler needed |
| SessionService exceeds extraction threshold (1,300 LOC) | Medium | Inc 4 adds ~150 LOC to SessionService (~1,267 currently). If threshold breached, extract v2 handlers to `SessionLifecycleHandlers.ts` in next cycle. |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Tests added | ~67 new (~15 + ~22 + ~5 + ~25 for Inc 3 types + Inc 4 domain) |
| Tests total | ~2,574+ |
| Test suites | ~101+ (99 + Flow 14 + path reconciliation + v2 lifecycle) |
| LOC added (source) | ~420 new (~120 template + ~40 path helper + ~60 types + ~200 service) |
| Bugs fixed | 3 (DX progress — completed pre-cycle) |
| PRD version | v8 (Session v2 – Focus & Execution Environment) |
| FRI score | 22/35 → target 24/35 after Inc 3-4 |
| PBIs defined | 8 new (PBI-SW-010 through PBI-SW-017) |
| PBIs progressed | PBI-SW-010 (domain-first delivery in Inc 4) |
| v2 FRs specified | 10 (FR-09 through FR-18) |
| New events | ~17 (2 template + ~15 v2 lifecycle/intent/energy) |
| ADRs produced | 1 (ADR-031: Session v2 Architecture) |
| Three Amigos gaps closed | Flow 14 (nudges), path reconciliation helper + tests, command palette tests |
| New flow test suites | 1 (Flow 14: Daily Session Nudges) |
| Feature removed | FR-08 daily tracking (PBI-SW-007 deprecated) |

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

- PRD: [[Session Workspaces PRD]] (v8, FRI 22/35 — Session v2 scope added)
- PRD: [[Data Exchange Hub PRD]] (3 bugs fixed pre-cycle)
- PBIs: [[PBI-SW-010 Session Lifecycle v2 and Intent Layer]] (Inc 4 delivery)
- Bugs: [[when running a pipeline from the pipeline detail page, the progress bar does not update]], [[when importing a report from the data-exchange hub dashboard and then starting another one, the progressbar gets confused and the first started export gets combined with the second one]], [[The Data Exchange Dashboard does not know when a Pipeline, Import, or Export was started or is still running after leaving the view]]
- Deferred: [[TD-05 main.ts exceeds orchestrator role]], [[PBI-SW-009 Domain Design Session]]
- Removed: [[PBI-SW-007 Auto-Session and Session Nudges]] (daily tracking deprecated)
- Flows: [[Run Intentional Session]] (v2 deep work + workshop), [[Monitor Session from Sidebar]] (v2 sidebar companion)
- Review: [[Three Amigos Review 2026-02-19 Session Workspaces]] (PASS with 5 observations)
- Previous Cycle: [[Cycle 5 - Daily Summary and Session Nudges]]
