---
type: DevelopmentCycle
feature: "[[Session Workspaces PRD]]"
stage: in-progress
cycle: 9
date_planned: 2026-02-19
date_updated: 2026-02-21
pbis:
  - "[[PBI-SW-015 Activity Intelligence]]"
bugs: []
bugs_fixed_precycle:
  - "[[The Activity Log does not respect set filters]]"
  - "[[Sessions list does not disambiguate same-titled sessions]]"
  - "[[Closure review does not open when completing from dashboard with sidebar occupied]]"
tech_debt:
  - "[[TD-101 SessionService Handler Extraction]]"
  - "[[TD-100 Session performance and sync behaviour investigation]]"
estimated_increments: 4
estimated_tests: 60
---

# Cycle 9: Service Extraction and Intelligence

## Situation Assessment

### Pre-Cycle State (2026-02-20)

**Plugin health:**
- 2,794 tests passing (32 skipped), 110 test suites
- Clean working tree, all builds green
- `npm test` pipeline: tsc + eslint + vitest

**Session Workspaces feature:**
- PRD v8, FRI 30/35, stage: in-progress
- v1 scope: 8/8 FRs delivered, 7/8 v1 PBIs valid (PBI-SW-007 removed)
- v2 scope: 7/10 FRs delivered (FR-09, FR-10, FR-11, FR-12, FR-13, FR-14, FR-16), 6/8 v2 PBIs done (SW-010, SW-011, SW-012, SW-013, SW-014, SW-016)
- 98 total session events (90 active)
- SessionService at **1,766 LOC** — 466 lines above 1,300 threshold

**Pre-cycle hotfixes (2026-02-20):**
- Activity log display-time filtering (8 new tests, 4 source files + 8 test files)
- Session title disambiguation in User Hub sessions list (1 new test)
- Closure review auto-open on `session.closure.started` (2 source files)

**Carry-forward from Cycle 8:**
- TD-101: SessionService Handler Extraction (promoted from stretch to required)
- TD-100: Session performance and sync behaviour investigation
- MAX_REFLECTIONS guard (Three Amigos AI-3)

**Remaining v2 PBIs:**
- PBI-SW-015: Activity Intelligence (low priority, small effort)
- PBI-SW-017: Main/Sidebar Mode Separation (high priority, large effort — blocked by TD-101)
- PBI-SW-009: Domain Design Session (deferred — depends on FR-18 Workshop mode)

### Cycle Goals

1. **Reduce SessionService to manageable size** (TD-101) — must complete before PBI-SW-017
2. **Investigate and fix sync performance** (TD-100) — prerequisite for good UX
3. **Deliver Activity Intelligence** (PBI-SW-015) — small, builds on existing data
4. **Stabilize and harden** — MAX_REFLECTIONS cap, any quick debt cleanup

---

## Scope

### Inc 1: SessionService Handler Extraction (TD-101) — Required

**Goal:** Extract ~35 handler methods from SessionService into free-function modules.

**Approach:** Create `src/domain/session/handlers/` directory with:

| Module | Handlers | Est. LOC |
|--------|----------|----------|
| `lifecycleHandlers.ts` | start, pause, resume, complete, archive, rerun | ~180 |
| `fieldHandlers.ts` | setIntent, setMode, setEnergy, updateNotes, updateDuration, links, context, decisions | ~160 |
| `taskHandlers.ts` | goalAdd/Toggle/Remove/Reorder, addTask/toggleTask/removeTask/reorderTasks | ~180 |
| `closureHandlers.ts` | completeClosure, skipClosure, finishReview | ~70 |
| `syncHandlers.ts` | scheduleSyncNotesFile, syncNotesFile, executeReverseSync, scheduleReverseSync | ~120 |
| `trackingHandlers.ts` | trackActivity, trackArtifact, checkCognitiveOverload, pathReconciliation | ~120 |

**SessionHandlerContext interface:**
```typescript
interface SessionHandlerContext {
    eventBus: IEventBus;
    state: SessionState;
    fileSystem: IFileSystemClient | null;
    save(): void;
    scheduleSyncNotesFile(sessionId: string): void;
    checkCognitiveOverload(sessionId: string): void;
    globalActivityFilter: string[];
    noteSyncTimers: Map<string, ReturnType<typeof setTimeout>>;
    lastSyncedContent: Map<string, string>;
    reverseSyncTimers: Map<string, ReturnType<typeof setTimeout>>;
    lastOverloadReasons: Map<string, string>;
}
```

**Target:** SessionService reduced from 1,766 → ~600 LOC (constructor + public API + delegation).

**Acceptance criteria:**
- [ ] All handler methods extracted to `src/domain/session/handlers/` modules
- [ ] `SessionHandlerContext` interface defined and implemented
- [ ] SessionService delegates to handler modules (1-2 line methods)
- [ ] SessionService LOC < 700
- [ ] All existing 224 service tests pass unchanged
- [ ] `npm test` green (2,794+ tests, 0 regressions)
- [ ] `npm run build` passes

**Test intent:** Existing 224 service tests validate behavior is preserved. New handler-level tests optional — only add if handler has complex standalone logic not covered by service tests.

**Documentation intent:** Update TD-101 status to resolved. Update MEMORY.md with new handler module paths.

**Est. LOC:** ~830 (new handler modules) + ~-1,100 (removed from SessionService) = net -270 LOC reduction in SessionService

**Delivery (2026-02-20):** SessionService reduced from **1,766 → 613 LOC** (target: < 700). 6 handler modules + types + barrel = 1,025 LOC under `src/domain/session/handlers/`. `HandlerContextProxy` class bridges service internals to handler context. All 2,794 tests passing, 0 regressions. TD-101 status: **resolved**. All acceptance criteria met.
- [x] All handler methods extracted to `src/domain/session/handlers/` modules
- [x] `SessionHandlerContext` interface defined and implemented
- [x] SessionService delegates to handler modules (1-2 line methods)
- [x] SessionService LOC < 700 (613)
- [x] All existing 224 service tests pass unchanged
- [x] `npm test` green (2,794 tests, 0 regressions)
- [x] `npm run build` passes

### Inc 2: Session Performance Investigation (TD-100)

**Goal:** Profile and fix sync performance issues.

**Scope:**
- Profile forward sync debounce (currently 2,500ms — may need tuning)
- Profile reverse sync suppression window (currently 1,000ms)
- Investigate `file.modified` event frequency during note sync
- Test with large sessions (20+ tasks, 50+ reflections, 200+ activity entries)
- Fix any race conditions found
- Document performance characteristics

**Acceptance criteria:**
- [ ] Performance report documenting current sync timings
- [ ] Forward sync debounce value validated or adjusted
- [ ] Reverse sync suppression window validated or adjusted
- [ ] No race conditions between forward and reverse sync
- [ ] Large session performance acceptable (sync < 500ms)
- [ ] TD-100 status: resolved or mitigated with documented findings

**Test intent:** Add timing assertions if performance regressions are likely. Profile tests may be `it.skip` for CI (manual profiling).

**Documentation intent:** Performance report document. Update TD-100 status.

**Deliverable:** Performance report + any fixes applied. TD-100 resolved or mitigated.

**Delivery (2026-02-21):** Investigation complete. **HIGH** finding: SessionWorkspaceView had no render debounce — every event caused immediate full DOM rebuild. Added 16ms `scheduleRender()` + `schedulePanelRefresh()` batching (matching BaseHubView pattern). Sync timing validated at 500ms (corrected documentation discrepancy). No race conditions found — `lastSyncedContent` cache works correctly. All 2,805 tests passing, 0 regressions. TD-100 status: **resolved**.
- [x] Performance report documenting current sync timings (findings table in TD-100)
- [x] Forward sync debounce value validated (500ms — not 2,500ms as documented)
- [x] Reverse sync suppression window validated (500ms)
- [x] No race conditions between forward and reverse sync (confirmed safe)
- [x] Large session performance acceptable (render coalescing eliminates cascade)
- [x] TD-100 status: resolved

### Inc 3: Activity Intelligence (PBI-SW-015)

**Goal:** Add computed analytics to sessions — FR-15 delivery.

**Scope:**
- `computeActivityIntelligence(session)` pure function in helpers.ts
- `ActivityIntelligence` type: `{ filesModified, tasksCompleted, eventsEmitted, activeTimeMs, pauseTimeMs }`
- Compact stats row rendered in session workspace
- Analytics included in session summary (note sync)

**Acceptance criteria:**
- [ ] `computeActivityIntelligence()` returns correct counters for all fields
- [ ] Stats row visible in session workspace (both sidebar and main)
- [ ] Analytics included in session summary when syncing notes
- [ ] Pure function — no side effects, < 16ms computation
- [ ] `npm test` passes with new tests

**Test intent:** ~15 tests: edge cases (empty session, single activity, many activities), counter accuracy, time computation.

**Documentation intent:** Update PRD FR-15 status to delivered. Update FRI if applicable.

**Effort:** Small — pure computation on existing data, ~100 LOC production, ~15 tests.

### Inc 4: Hardening + Debt Cleanup

**Goal:** Address Three Amigos action items and quick wins.

**Scope:**
- MAX_REFLECTIONS cap (200, with 50 per category recommended) — AI-3 from Cycle 8
- MAX_EXECUTION_TASKS cap (50) — parallel to MAX_REFLECTIONS
- Review and close any newly-resolved TD items
- Update documentation with Cycle 9 delivery

**Acceptance criteria:**
- [ ] MAX_REFLECTIONS (200) enforced in handleReflectionAdd
- [ ] MAX_EXECUTION_TASKS (50) enforced in addTask
- [ ] Guard behavior tested (cap reached → event emitted, no addition)
- [ ] TD items reviewed — resolved items closed
- [ ] Cycle retrospective documented

**Test intent:** ~10 tests: cap enforcement for reflections and tasks, boundary conditions.

**Documentation intent:** Close resolved TD items. Update cycle plan stage to delivered. Three Amigos review preparation.

---

## Increment Dependencies

```
Inc 1: TD-101 extraction — independent, must complete first
Inc 2: TD-100 investigation — easier after extraction (handler modules are clearer)
Inc 3: PBI-SW-015 — independent of Inc 1/2
Inc 4: Hardening — after all others
```

**Recommended order:** Inc 1 → Inc 2 → Inc 3 → Inc 4

---

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Handler extraction breaks existing tests | Low | High | Extract one module at a time, `npm test` after each |
| Handler context interface too complex | Medium | Medium | Start with minimal context, expand only as needed |
| Performance investigation reveals deep architectural issue | Low | High | Time-box to 1 increment; document findings for future cycle |
| SessionService grows further during extraction | Low | Medium | Freeze feature work on session domain during Inc 1 |

---

## Success Criteria

| Metric | Target | Notes |
|--------|--------|-------|
| SessionService LOC | < 700 | Down from 1,766 |
| Test suite | All 2,794+ passing | Zero regressions |
| TD-101 status | Resolved | Handler extraction complete |
| TD-100 status | Resolved or Mitigated | Performance investigated |
| FR-15 status | Done | Activity Intelligence delivered |
| FRI | 31/35 | +1 from FR-15 delivery |

---

## Completed Pre-Cycle

| Item | Date | Description |
|------|------|-------------|
| Activity log filter bug | 2026-02-20 | Display-time filtering with retroactive support, completed/archived bypass |
| Session title disambiguation | 2026-02-20 | Added creation date+time to session list rows |
| Closure review auto-open | 2026-02-20 | Added `session.closure.started` listener + `sessionId` in `setViewState()` |
| Inbox review | 2026-02-20 | 3 bug tickets created/updated (all fixed) |

---

## Related

- PRD: [[Session Workspaces PRD]] (FRI 30/35 → target 31/35)
- Tech Debt: [[TD-101 SessionService Handler Extraction]], [[TD-100 Session performance and sync behaviour investigation]]
- PBI: [[PBI-SW-015 Activity Intelligence]]
- Previous: [[Cycle 8 - Complete Execution Layer]] (FRI 28→30/35)
- Next candidate: PBI-SW-017 (Main/Sidebar Mode Separation) — unblocked by TD-101 completion
