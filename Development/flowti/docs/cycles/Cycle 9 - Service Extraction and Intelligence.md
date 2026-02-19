---
type: DevelopmentCycle
feature: "[[Session Workspaces PRD]]"
stage: planned
cycle: 9
date_planned: 2026-02-19
pbis:
  - "[[PBI-SW-015 Activity Intelligence]]"
bugs: []
bugs_fixed_precycle: []
tech_debt:
  - "[[TD-101 SessionService Handler Extraction]]"
  - "[[TD-100 Session performance and sync behaviour investigation]]"
estimated_increments: 4
estimated_tests: 60
---

# Cycle 9: Service Extraction and Intelligence

## Situation Assessment

### Pre-Cycle State (2026-02-19)

**Plugin health:**
- 2,768 tests passing (32 skipped), 109 test suites
- Clean working tree, all builds green
- `npm test` pipeline: tsc + eslint + vitest

**Session Workspaces feature:**
- PRD v8, FRI 30/35, stage: in-progress
- v1 scope: 8/8 FRs delivered, 7/8 v1 PBIs valid (PBI-SW-007 removed)
- v2 scope: 7/10 FRs delivered (FR-09, FR-10, FR-11, FR-12, FR-13, FR-14, FR-16), 6/8 v2 PBIs done (SW-010, SW-011, SW-012, SW-013, SW-014, SW-016)
- 98 total session events (90 active)
- SessionService at 1,729 LOC — 429 lines above 1,300 threshold

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
| `fieldHandlers.ts` | setIntent, setMode, setEnergy, updateNotes, updateDuration | ~80 |
| `taskHandlers.ts` | goalAdd/Toggle/Remove/Reorder, addTask/toggleTask/removeTask/reorderTasks | ~180 |
| `reflectionHandlers.ts` | reflectionAdd, reflectionRemove, recordDecision | ~80 |
| `syncHandlers.ts` | scheduleSyncNotesFile, syncNotesFile, executeReverseSync, scheduleReverseSync | ~100 |
| `trackingHandlers.ts` | trackActivity, checkCognitiveOverload | ~60 |

**SessionHandlerContext interface:**
```typescript
interface SessionHandlerContext {
    eventBus: EventBus;
    state: SessionState;
    fileSystem: FileSystemClient | null;
    save(): void;
    scheduleSyncNotesFile(sessionId: string): void;
    checkCognitiveOverload(sessionId: string): void;
    noteSyncTimers: Map<string, ReturnType<typeof setTimeout>>;
    noteSyncWriteTimestamps: Map<string, number>;
    reverseSyncTimers: Map<string, ReturnType<typeof setTimeout>>;
    overloadReasonKeys: Map<string, string>;
}
```

**Target:** SessionService reduced from 1,729 → ~580 LOC (constructor + public API + delegation).

**Tests:** Existing 224 service tests must pass unchanged. New handler-level unit tests optional.

**Verification:** `npm test` green after each module extraction.

### Inc 2: Session Performance Investigation (TD-100)

**Goal:** Profile and fix sync performance issues.

**Scope:**
- Profile forward sync debounce (currently 2,500ms — may need tuning)
- Profile reverse sync suppression window (currently 1,000ms)
- Investigate `file.modified` event frequency during note sync
- Test with large sessions (20+ tasks, 50+ reflections, 200+ activity entries)
- Fix any race conditions found
- Document performance characteristics

**Deliverable:** Performance report + any fixes applied. TD-100 resolved or mitigated.

### Inc 3: Activity Intelligence (PBI-SW-015)

**Goal:** Add computed analytics to sessions — FR-15 delivery.

**Scope:**
- `computeActivityIntelligence(session)` pure function in helpers.ts
- `ActivityIntelligence` type: `{ filesModified, tasksCompleted, eventsEmitted, activeTimeMs, pauseTimeMs }`
- Compact stats row rendered in session workspace
- Analytics included in session summary (note sync)

**Effort:** Small — pure computation on existing data, ~60 LOC production, ~15 tests.

### Inc 4: Hardening + Debt Cleanup

**Goal:** Address Three Amigos action items and quick wins.

**Scope:**
- MAX_REFLECTIONS cap (200, with 50 per category recommended) — AI-3 from Cycle 8
- MAX_EXECUTION_TASKS cap (50) — parallel to MAX_REFLECTIONS
- Review and close any newly-resolved TD items
- Update documentation with Cycle 9 delivery

---

## Increment Dependencies

```
Inc 1: TD-101 extraction — independent, must complete first
Inc 2: TD-100 investigation — can run parallel with Inc 1 if careful, easier after extraction
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
| SessionService LOC | < 700 | Down from 1,729 |
| Test suite | All 2,768+ passing | Zero regressions |
| TD-101 status | Resolved | Handler extraction complete |
| TD-100 status | Resolved or Mitigated | Performance investigated |
| FR-15 status | Done | Activity Intelligence delivered |
| FRI | 31/35 | +1 from FR-15 delivery |

---

## Related

- PRD: [[Session Workspaces PRD]] (FRI 30/35 → target 31/35)
- Tech Debt: [[TD-101 SessionService Handler Extraction]], [[TD-100 Session performance and sync behaviour investigation]]
- PBI: [[PBI-SW-015 Activity Intelligence]]
- Previous: [[Cycle 8 - Complete Execution Layer]] (FRI 28→30/35)
- Next candidate: PBI-SW-017 (Main/Sidebar Mode Separation) — unblocked by TD-101 completion
