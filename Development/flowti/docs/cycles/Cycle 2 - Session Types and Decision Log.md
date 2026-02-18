---
type: DevelopmentCycle
feature: "[[Session Workspaces PRD]]"
stage: planned
cycle: 2
date_planned: 2026-02-18
pbis:
  - "[[PBI-SW-003 Session Types]]"
  - "[[PBI-SW-004 Decision Log]]"
tech_debt:
  - "[[TD-72 SettingsService saveSettings read-merge-write race]]"
  - "[[TD-94 Missing Session Management flow doc and integration test]]"
  - "[[TD-01 UI files exceed size convention]]"
estimated_increments: 5
estimated_tests: 120
---

# Cycle 2: Session Types & Decision Log

## Situation Assessment

### Current State (2026-02-18)

**Plugin health:**
- 2,177 tests passing (32 skipped), 84 test files
- Clean working tree, all builds green
- `npm run build` pipeline: vitest + typedoc + tsc + eslint + esbuild

**Session Workspaces feature:**
- PRD v4, FRI 29/35, stage: in-progress
- Foundation (PBI-002): timer, goals, notes, focus file, artifacts, links, canvas, templates — fully delivered
- PBI-SW-001 (Activity Log): done — 4 file event types, dedup, cap at 1000, per-session + global folder filtering
- PBI-SW-002 (Context Bindings): done — bind/unbind/cycle, fuzzy picker, folder reveal, path reconciliation
- PBI-SW-005 (Session Summary): partial — core generation done, decisions section blocked by PBI-SW-004
- 592+ session-specific tests across 4 test files
- Session domain: 2,724 LOC across 5 source files

**What's next per PRD priority ranking:**
1. PBI-SW-003 (Session Types & Orchestration) — ranked #1, high priority
2. PBI-SW-004 (Decision Log) — ranked #2, medium priority, independent

These two PBIs are independent and can be developed in parallel. Together they deliver FR-03 (Decision Log) and FR-05 (Session Type Orchestration), and unblock the remaining acceptance criterion of PBI-SW-005 (decisions in summary).

---

## Cycle Goals

1. **Deliver PBI-SW-003** — Session types become functional: guiding questions, default duration/goals, custom type creation
2. **Deliver PBI-SW-004** — Structured decision recording with workspace panel and summary integration
3. **Close PBI-SW-005** — Decisions section in session summary (unblocked by PBI-SW-004)
4. **Fix TD-72** — SettingsService race condition (1-file fix, prerequisite for settings-adjacent session type work)
5. **Resolve TD-94** — Create session management flow integration test
6. **Address TD-01** — Extract SessionWorkspaceView components (1,037 LOC → orchestrator + components)

---

## Tech Debt Bundled

### TD-72: SettingsService saveSettings race (HIGH, small effort)

**Why now:** PBI-SW-003 adds custom session type configs to SettingsService. The existing `saveSettings()` method bypasses the `PathMutex` that protects `saveStateToStorage()`. Concurrent settings writes can silently lose data. Must fix before adding more settings-persisted state.

**Fix:** Route `saveSettings()` through the same `PathMutex` used by `saveStateToStorage()`. ~10 LOC change in `SettingsService.ts`.

### TD-94: Missing session flow integration test (MEDIUM, medium effort)

**Why now:** Session domain has 38+ events with no flow integration test. Every other major domain has one. Adding PBI-SW-003 and PBI-SW-004 will bring the event count to 46+. This is the right time to create the integration test — it validates the full lifecycle including the new features.

**Deliverable:** `tests/flows/session-management.flow.test.ts` covering: create → configure type → start → track activity → record decision → pause/resume → complete (verify summary includes decisions) → archive → template.

### TD-01: SessionWorkspaceView exceeds size convention (LOW, medium effort)

**Why now:** At 1,037 LOC, `SessionWorkspaceView.ts` is the largest file in the codebase. PBI-SW-003 adds a guiding questions panel (~40 LOC) and PBI-SW-004 adds a decisions panel (~60 LOC). Without extraction, the file would grow to ~1,140 LOC. Extract components before adding new panels.

**Approach:** Follow the established component extraction pattern (same as EventCatalogView: orchestrator + child components). Extract into `src/ui/session/` components:
- `SessionTimerPanel` — timer display + controls
- `SessionGoalsPanel` — goals checklist + add form
- `SessionActivityPanel` — activity log + filter input
- `SessionContextPanel` — context bindings display + add/cycle/remove
- `SessionNotesPanel` — notes textarea + links + canvas
- `SessionGuidingQuestions` — NEW (PBI-SW-003)
- `SessionDecisionPanel` — NEW (PBI-SW-004)

The orchestrator keeps lifecycle management, event subscriptions, and panel coordination.

---

## Increment Plan

### Inc 1: Component Extraction (TD-01 prerequisite)

**Goal:** Extract SessionWorkspaceView into orchestrator + components before adding new panels.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/session/SessionTimerPanel.ts` | Timer display, tick handling, duration edit | ~80 |
| 2 | `src/ui/session/SessionGoalsPanel.ts` | Goals checklist, add form, completion badge | ~90 |
| 3 | `src/ui/session/SessionActivityPanel.ts` | Activity log, filter input, folder suggest | ~120 |
| 4 | `src/ui/session/SessionContextPanel.ts` | Context bindings, add/cycle/remove, fuzzy picker | ~100 |
| 5 | `src/ui/session/SessionNotesPanel.ts` | Notes textarea, links, canvas section | ~80 |
| 6 | `src/ui/SessionWorkspaceView.ts` | Refactor to orchestrator importing components | ~400 |
| 7 | `tests/ui/session/*.test.ts` | Component-level tests for extracted panels | ~200 |
| 8 | `tests/ui/SessionWorkspaceView.test.ts` | Update orchestrator tests for new imports | ~adjust |

**Est. total:** ~870 LOC (redistribution, net new ~200 for component tests)
**Est. tests:** ~30 new component tests

**Acceptance criteria:**
- [ ] SessionWorkspaceView reduced to orchestrator (< 500 LOC)
- [ ] 5 extracted components each with constructor + render method
- [ ] All existing 86 SessionWorkspaceView tests still pass
- [ ] New component-level tests for each extracted panel
- [ ] No visual or behavioral changes — pure refactor
- [ ] `npm run build` passes

---

### Inc 2: TD-72 Fix + PBI-SW-003 Domain Layer

**Goal:** Fix settings race condition, then build session type config registry.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/settings/SettingsService.ts` | Route `saveSettings()` through PathMutex (TD-72) | ~10 |
| 2 | `src/domain/session/types.ts` | `SessionTypeConfig`, expand `SessionType` union (add `"domain-design"`), `SESSION_TYPE_CONFIGS` registry | ~60 |
| 3 | `src/domain/session/helpers.ts` | `resolveTypeConfig()` pure function | ~15 |
| 4 | `src/domain/session/events.ts` | 4 new events: `session.type.configure/configured`, `session.type.create/created` | ~16 |
| 5 | `src/domain/session/SessionService.ts` | Custom type CRUD handlers, backward compat `session.type ??= "documentation"` in `load()` | ~50 |
| 6 | `src/infrastructure/events/catalog.ts` | 4 new catalog entries | ~6 |
| 7 | `tests/domain/settings/SettingsService.test.ts` | Race condition regression test (TD-72) | ~15 |
| 8 | `tests/domain/session/helpers.test.ts` | `resolveTypeConfig()` tests | ~15 |
| 9 | `tests/domain/session/SessionService.test.ts` | Type config CRUD, backward compat, custom type tests | ~25 |

**Est. total:** ~212 LOC source, ~55 tests
**Pre-built type configs (8 types):**

| Type | Default Duration | Guiding Questions |
|------|-----------------|-------------------|
| Documentation | 25 min | What needs to be documented? What is the current gap? |
| Event Storming | 50 min | What events does this domain produce? What triggers each event? |
| Service Design | 50 min | What services does this domain expose? What are the contracts? |
| Domain Design | 50 min | What are the bounded contexts? What entities belong here? What events cross boundaries? |
| Requirements Refinement | 25 min | What are the acceptance criteria? What edge cases exist? |
| Backlog Structuring | 25 min | What are the priorities? What delivers the most value first? |
| Knowledge Cleanup | 25 min | What is outdated? What is missing? What is duplicated? |
| Vault Hygiene | 15 min | What files are orphaned? What links are broken? What needs reorganizing? |

**Acceptance criteria:**
- [ ] TD-72 fixed: `saveSettings()` uses PathMutex
- [ ] `SessionTypeConfig` type defined with all fields
- [ ] 8 pre-built type configs with sensible defaults
- [ ] `resolveTypeConfig()` returns config for any type (built-in or custom)
- [ ] `SessionType` union includes `"domain-design"`
- [ ] Backward compat: sessions without `type` default to `"documentation"`
- [ ] Custom types persisted via SettingsService
- [ ] 4 new events registered in catalog
- [ ] `npm run build` passes

---

### Inc 3: PBI-SW-003 UI Layer

**Goal:** Wire session types into the workspace UI and settings.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/session/SessionGuidingQuestions.ts` | Guiding questions panel component | ~50 |
| 2 | `src/ui/SessionWorkspaceView.ts` | Import + render guiding questions panel (active/paused only) | ~20 |
| 3 | `src/ui/user/NewSessionModal.ts` | Pre-fill duration and goals from type config on type selection | ~30 |
| 4 | `src/ui/settings/FlowtiSettingTab.ts` | Custom session type creation UI (name, questions, duration, goals) | ~60 |
| 5 | `tests/ui/session/SessionGuidingQuestions.test.ts` | Panel render tests | ~15 |
| 6 | `tests/ui/SessionWorkspaceView.test.ts` | Guiding questions integration tests | ~10 |
| 7 | `tests/ui/userHub/NewSessionModal.test.ts` | Pre-fill behavior tests | ~10 |

**Est. total:** ~160 LOC source, ~35 tests

**Acceptance criteria:**
- [ ] Selecting a session type pre-fills duration and goals in NewSessionModal
- [ ] Guiding questions displayed in workspace during active/paused sessions
- [ ] Guiding questions hidden for completed/archived sessions
- [ ] Custom session types can be created and edited via settings
- [ ] Pre-built types have sensible defaults for all 8 types
- [ ] Domain Design type available in type picker (foundation for PBI-SW-009)
- [ ] `npm run build` passes

---

### Inc 4: PBI-SW-004 Decision Log (Domain + UI)

**Goal:** Full decision recording — domain layer, workspace panel, and summary integration.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/session/types.ts` | `SessionDecision`, `MAX_SESSION_DECISIONS`, add `decisions` to `Session` and `SessionTemplate` | ~20 |
| 2 | `src/domain/session/events.ts` | 4 new events: `session.decision.record/recorded`, `session.decision.remove/removed` | ~16 |
| 3 | `src/domain/session/helpers.ts` | `formatDecisionsForSummary()` pure function | ~20 |
| 4 | `src/domain/session/SessionService.ts` | Decision record/remove handlers, field threading (create, rerun, template), backward compat `decisions ??= []` | ~60 |
| 5 | `src/domain/session/helpers.ts` | Integrate decisions into `generateSessionSummaryBody()` | ~10 |
| 6 | `src/infrastructure/events/catalog.ts` | 4 new catalog entries | ~6 |
| 7 | `src/ui/session/SessionDecisionPanel.ts` | Decision list + inline add form + remove button | ~80 |
| 8 | `src/ui/SessionWorkspaceView.ts` | Import + render decision panel (active/paused/completed) | ~15 |
| 9 | `tests/domain/session/helpers.test.ts` | `formatDecisionsForSummary()` tests, updated summary generation tests | ~20 |
| 10 | `tests/domain/session/SessionService.test.ts` | Decision CRUD, field threading, backward compat, cap enforcement | ~30 |
| 11 | `tests/ui/session/SessionDecisionPanel.test.ts` | Panel render, add, remove tests | ~15 |
| 12 | `tests/ui/SessionWorkspaceView.test.ts` | Decision panel integration tests | ~10 |

**Est. total:** ~227 LOC source, ~75 tests

**Acceptance criteria:**
- [ ] `SessionDecision` type with id, title, description, recordedAt, context?
- [ ] Record a decision with title and description during active session
- [ ] Decision appears in workspace decision panel
- [ ] Remove a decision from the panel
- [ ] Decisions persist across pause/resume
- [ ] Decisions carried through rerun and template flows
- [ ] Max 100 decisions enforced
- [ ] Decisions included in session summary on completion (closes PBI-SW-005)
- [ ] Legacy sessions load cleanly with `decisions: []`
- [ ] 4 new events registered in catalog
- [ ] `npm run build` passes

---

### Inc 5: Flow Integration Test + Verification (TD-94)

**Goal:** End-to-end integration test covering the full session lifecycle with all Cycle 2 features.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `tests/flows/session-management.flow.test.ts` | Full lifecycle flow test | ~300 |
| 2 | docs updates | Update PBI-SW-003, PBI-SW-004, PBI-SW-005 acceptance criteria | ~edit |
| 3 | `docs/features/Session Workspaces/Session Workspaces PRD.md` | Update FR status, event counts, lifecycle tracking | ~edit |
| 4 | `docs/flows/Create and Manage Sessions.md` | Add decision steps and type orchestration steps | ~edit |

**Flow test covers:**
1. Create session with "Domain Design" type → verify pre-filled duration (50 min) and goals
2. Start session → verify guiding questions available
3. Track activity (create/modify file) → verify filtered correctly
4. Record 2 decisions → verify persisted on session
5. Pause → resume → verify decisions + activity preserved
6. Complete → verify summary includes decisions section
7. Create template from completed session → verify decisions carried
8. Create from template → verify decisions seeded
9. Archive → verify activity cleared, decisions preserved in summary
10. Delete → verify session removed

**Est. total:** ~300 LOC tests

**Acceptance criteria:**
- [ ] Flow integration test covers full session lifecycle with types + decisions
- [ ] All PBI acceptance criteria checked off
- [ ] PRD updated with current delivery status
- [ ] Flow doc updated with new steps
- [ ] TD-94 resolved (flow test exists)
- [ ] PBI-SW-005 closed (decisions in summary)
- [ ] `npm run build` passes
- [ ] All tests green (est. ~2,300+ total)

---

## Dependency Graph

```
TD-72 (settings race fix)
  ↓
Inc 1: Component Extraction (TD-01) ──────────────────┐
  ↓                                                    │
Inc 2: PBI-SW-003 Domain (types, configs, events)      │
  ↓                                                    │
Inc 3: PBI-SW-003 UI (guiding questions, modal, settings)
  ↓                                                    │
Inc 4: PBI-SW-004 Decision Log (domain + UI + summary) ←┘
  ↓
Inc 5: Flow Integration Test + Docs (TD-94, PBI-SW-005 close)
```

**Note:** Inc 2 and Inc 4 domain layers are independent and could be parallelized. However, Inc 1 (component extraction) should precede both UI increments (Inc 3 and Inc 4) to keep the workspace view under control.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Component extraction breaks existing tests | High | Pure refactor — extract only, no behavior changes. Run full test suite after each extraction. |
| Custom type persistence adds complexity to SettingsService | Medium | Fix TD-72 first. Custom types are a simple `Record<string, SessionTypeConfig>` in settings — no new persistence mechanism. |
| SessionWorkspaceView orchestrator still large after extraction | Low | Target < 500 LOC. If still large, extract lifecycle management into a separate controller class. |
| Decision field threading misses a creation path | Medium | Follow the exact pattern used for `contextBindings` field threading (Inc 10). Test every creation path: create, rerun, template. |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Tests added | ~120 new tests |
| Tests total | ~2,300+ |
| Test suites | ~90+ |
| LOC added (source) | ~600 |
| LOC redistributed (refactor) | ~700 |
| SessionWorkspaceView size | < 500 LOC (from 1,037) |
| PBIs closed | PBI-SW-003, PBI-SW-004, PBI-SW-005 |
| TDs resolved | TD-72, TD-94, TD-01 (session) |
| FRs delivered | FR-03 (Decision Log), FR-05 (Session Type Orchestration) |
| FRs completed | FR-04 (Session Summary — decisions section) |
| New events | 8 (4 type + 4 decision) |
| Total session events | 46+ |

---

## Related

- PRD: [[Session Workspaces PRD]] (v4, FRI 29/35)
- PBIs: [[PBI-SW-003 Session Types]], [[PBI-SW-004 Decision Log]], [[PBI-SW-005 Session Summary]]
- Tech Debt: [[TD-72 SettingsService saveSettings read-merge-write race]], [[TD-94 Missing Session Management flow doc and integration test]], [[TD-01 UI files exceed size convention]]
- Learnings: [[L-01 Start domain-first]], [[L-09 Thread new fields early]], [[L-11 Backward compat guard in load]], [[L-13 Test domain before UI]], [[L-20 Pure functions for testability]]
- Previous Cycle: [[Inc 1 - Activity Log and Folder Filtering]] (delivered via PBI-002 Inc 10)
