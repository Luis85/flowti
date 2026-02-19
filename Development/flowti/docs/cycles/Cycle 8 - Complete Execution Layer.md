---
type: DevelopmentCycle
feature: "[[Session Workspaces PRD]]"
stage: in-progress
cycle: 8
date_planned: 2026-02-19
pbis:
  - "[[PBI-SW-011 Energy Tracking]]"
  - "[[PBI-SW-016 Cognitive Overload Detection]]"
  - "[[PBI-SW-013 Structured Reflection]]"
bugs: []
bugs_fixed_precycle: []
tech_debt:
  - "[[TD-092 SessionService Handler Extraction]]"
  - "[[TD-100 Session performance and sync behaviour investigation]]"
estimated_increments: 4
estimated_tests: 75
---

# Cycle 8: Complete Execution Layer

## Situation Assessment

### Pre-Cycle State (2026-02-19)

**Plugin health:**
- 2,687 tests passing (32 skipped), 106 test suites
- Clean working tree, all builds green
- `npm test` pipeline: tsc + eslint + vitest
- Session domain: ~1,662 LOC SessionService, ~843 LOC helpers

**Session Workspaces feature:**
- PRD v8, FRI 28/35, stage: in-progress
- v1 scope: 8/8 FRs delivered, 7/8 v1 PBIs valid (PBI-SW-007 removed)
- v2 scope: 4/10 FRs delivered (FR-09, FR-10, FR-12, FR-14), 3/8 v2 PBIs done (SW-010, SW-012, SW-014)
- ADR-031: Session v2 Architecture — accepted
- 82+ total session events, state machine with 6 states, closure ritual gate
- Bidirectional note sync (forward + reverse) with content-based loop prevention

**Carry-forward from Cycle 7:**
- PBI-SW-016: Cognitive Overload Detection (spike deferred — cycle budget consumed by note sync expansion)
- TD-092: SessionService extraction (1,662 LOC — significantly above 1,300 threshold)
- "Create follow-up session" button (deferred from Inc 3 closure ritual)
- Settings schema for `defaultClosureTemplate` (deferred — works via parameter passing)

**Inbox refinement (completed pre-cycle):**
- Plugin inbox: 74 items — stale stages updated, 13 empty-frontmatter items triaged
- Vault inbox: 46 items — delivered items verified, missing-frontmatter items fixed

---

## Cycle Goals

1. **PBI-SW-011: Energy Tracking UI** — clickable 1–5 energy indicator in session workspace (FR-11, domain handlers exist from Cycle 6)
2. **PBI-SW-016: Cognitive Overload Detection** — threshold-based warnings for task/binding/duration/energy overload (FR-16, carried from Cycle 7)
3. **PBI-SW-013: Structured Reflection** — 4-category reflection system extending existing decision log (FR-13, domain + UI)
4. **TD-092: SessionService Handler Extraction** — reduce SessionService from ~1,662 LOC to ~600 LOC by extracting handler modules

**Delivery philosophy:** Energy UI first (quick win, unblocks SW-016), then Overload Detection (depends on energy), then Reflection (domain-first, UI-second). Tech debt extraction as final increment or stretch goal.

**Strategic rationale:** This cycle completes the **execution layer foundation** — after Cycle 8, all domain services for execution (tasks, energy, overload, reflection, closure) are in place. Cycle 9 can then focus on the major UI architecture: PBI-SW-017 (Main/Sidebar Mode Separation) with a clean, extracted service layer.

**Explicitly deferred to Cycle 9+:**
- PBI-SW-017 (Main/Sidebar Mode Separation) — largest v2 PBI, requires extracted service layer
- PBI-SW-015 (Activity Intelligence) — analytics layer, low priority
- PBI-SW-009 (Domain Design Session) — depends on Workshop mode (FR-18)
- TD-100 (Session performance and sync behaviour) — investigate before Cycle 9 UI work
- Feature Lifecycle PRD — stays approved, no planning yet
- "Create follow-up session" button — post-completion UX
- Settings schema for `defaultClosureTemplate`

---

## Proposed Increments

### Inc 1: Energy Tracking UI (PBI-SW-011)

**Goal:** Wire the existing energy domain handlers to a visible UI indicator in the session workspace.

**Scope:**
- `SessionEnergyIndicator` component: clickable 1–5 scale indicator
- Integrate into `SessionWorkspaceView` (between timer and execution plan sections)
- Wire `session.energy.changed` subscription in `SessionWorkspaceSubscriptions`
- Energy visible in both running and paused states, read-only in other states
- Energy persisted with session state (already done — domain layer)

**Out of scope:**
- Sidebar energy display (PBI-SW-017)
- Energy analytics or history chart (PBI-SW-015)

**Estimated size:**
- LOC: ~80 (component + view integration)
- Tests: ~15 (component rendering + event wiring + state guards)
- Files: 3–4 (new component, view update, subscriptions update, tests)

**Acceptance criteria:**
- [x] Clickable 1–5 energy indicator visible in running sessions
- [x] Clicking changes energy level and emits `session.energy.changed`
- [x] Energy persisted on session state across pause/resume
- [x] Energy level shown in session notes (note sync integration)
- [x] Read-only display in completed/archived states
- [x] Tests pass, `npm test` green (2,707 tests, 107 suites)

**Delivery summary:**
- **Source LOC:** ~90 (SessionEnergyIndicator)
- **Tests:** 20 new (14 component + 4 helpers + 2 subscriptions), 2,707 total, 107 suites
- **Files changed:** 7 source + 3 test files
- **Deviations:** Added `session.energy.set` command event (not in original plan — follows command/state event pattern from Cycle 7). Added energy to `generateSessionSummaryBody()` for note sync (unplanned but consistent with Inc 2.5).

**Definition of Done (Increment):**
- [x] Acceptance criteria met (6/6)
- [x] Tests added per TestPlan (20 new: 14 component, 4 helpers, 2 subscriptions)
- [x] Build pipeline passes (`npm test` green — 2,707 tests, 107 suites)
- [ ] Three Amigos review completed (solo delivery — deferred to cycle-level review)
- [x] All blocker findings resolved (none found)
- [ ] TASM score recorded (deferred to cycle-level review)
- [x] Documentation updated:
  - [x] Component docs (Frontend Architecture: +3 session components)
  - [x] PRD updated (FRI 28→29, FR-11 ✅, stage history, event table, backlog counts)
  - [x] PBI updated (PBI-SW-011 stage: planned → done, file list, test counts)
  - [x] Architecture docs updated (Frontend Architecture: session component list)
  - [x] Sitemap updated (N/A — no new use cases)
  - [x] Tech debt register updated (N/A — no new debt)
- [x] Manifests updated (N/A — no layout/component/tab manifest changes)
- [x] No architectural boundary violations (command → service → state event pattern)
- [x] Improvement items captured:
  - OBS-1: SessionService LOC continues to grow (~1,670+) — reinforce TD-092 priority for Inc 5
  - OBS-2: Energy indicator uses inline styles; consider extracting to CSS class in future UI polish
  - OBS-3: Three Amigos + TASM deferred again — pattern of solo delivery. Should batch at cycle level

---

### Inc 2: Cognitive Overload Detection (PBI-SW-016)

**Goal:** Add threshold-based warnings that alert users when sessions become overloaded.

**Scope:**
- `detectCognitiveOverload(session, thresholds)` pure function in helpers
- `CognitiveLoadAlert` component: non-blocking warning banner with reasons and suggestions
- Default thresholds: >5 tasks, >8 bindings, >90min duration, energy ≤2 + >3 tasks
- Thresholds configurable via `CognitiveLoadThresholds` (type already defined)
- Alert dismissible per session (dismissed state not persisted — session-scoped)
- Emit `session.overload.detected` event when thresholds exceeded

**Out of scope:**
- Auto-splitting sessions
- Persistent dismissed state across app restart
- Sidebar overload display (PBI-SW-017)

**Estimated size:**
- LOC: ~100 (pure function ~30, component ~40, integration ~30)
- Tests: ~15 (threshold logic + component rendering + event emission)
- Files: 4–5 (helper function, component, view integration, event registration, tests)

**Acceptance criteria:**
- [x] `detectCognitiveOverload()` pure function returns overload reasons
- [x] Warning banner renders in workspace when thresholds exceeded
- [x] Warning is dismissible (hides for current session)
- [x] Warning re-evaluates on task add/remove, energy change, binding change
- [x] `session.overload.detected` event emitted
- [x] Default thresholds: 5 tasks, 8 bindings, 120min, energy ≤2 + >3 tasks
- [x] Tests pass, `npm test` green (2,733 tests, 108 suites)

**Dependencies:** Inc 1 (energy UI provides the visual feedback that feeds overload detection)

**Delivery summary:**
- **Source LOC:** ~120 (detectCognitiveOverload ~40, CognitiveLoadAlert ~80, service wiring ~25)
- **Tests:** 26 new (12 helpers + 12 component + 2 subscriptions), 2,733 total, 108 suites
- **Files changed:** 6 source + 3 test files (1 new component, 1 new test file)
- **Deviations:** Duration threshold 90→120min (aligned with PBI spec). Settings UI deferred — defaults hardcoded. Service uses deduped emission (only emits when reasons change) to avoid listener flooding.

**Definition of Done (Increment):**
- [x] Acceptance criteria met (7/7)
- [x] Tests added per TestPlan (26 new: 12 helpers, 12 component, 2 subscriptions)
- [x] Build pipeline passes (`npm test` green — 2,733 tests, 108 suites)
- [ ] Three Amigos review completed (solo delivery — deferred to cycle-level review)
- [x] All blocker findings resolved (none found)
- [ ] TASM score recorded (deferred to cycle-level review)
- [x] Documentation updated:
  - [x] Component docs (Frontend Architecture: +1 session component)
  - [x] PRD updated (FRI 29→30, FR-16 ✅, stage history, event counts, backlog counts)
  - [x] PBI updated (PBI-SW-016 stage: planned → done, file list, test counts)
  - [x] Architecture docs updated (Frontend Architecture: session component list 13→14)
  - [x] Sitemap updated (N/A)
  - [x] Tech debt register updated (N/A)
- [x] Manifests updated (N/A)
- [x] No architectural boundary violations (pure function + event-driven detection)
- [x] Improvement items captured:
  - OBS-4: Settings UI for thresholds deferred — hardcoded defaults. Should add to PBI-SW-017 or separate small PBI
  - OBS-5: Duration check only fires on mutation events, not on timer tick — acceptable since other triggers fire frequently
  - OBS-6: Compound threshold (energy ≤2 + >3 tasks) may need tuning based on real usage

---

### Inc 3: Structured Reflection — Domain (PBI-SW-013 Part 1)

**Goal:** Add the domain layer for structured reflections with 4 categories.

**Scope:**
- `ReflectionEntry` type: `{ id, type: "observation" | "blocker" | "idea" | "decision", content, timestamp }`
- `reflections: ReflectionEntry[]` on Session interface (already defined in types)
- SessionService handlers: `addReflection`, `removeReflection`
- Events: `session.reflection.added`, `session.reflection.removed` (command + state pairs)
- Reflections included in `generateSessionSummaryBody()` (note sync)
- Template/rerun threading: `reflections` field in `SessionTemplate`
- Backward compat: existing `decisions[]` array coexists (no migration — reflections are additive)

**Out of scope:**
- Decision → reflection migration (keeping both arrays for backward compat)
- UI rendering (Inc 4)

**Estimated size:**
- LOC: ~120 (handlers + helpers + summary generation)
- Tests: ~25 (CRUD + events + note sync + template threading)
- Files: 4–5 (SessionService handlers, helpers update, events, types, tests)

**Acceptance criteria:**
- [ ] `addReflection(sessionId, type, content)` creates entry with timestamp
- [ ] `removeReflection(sessionId, reflectionId)` removes entry
- [ ] State guards: only in running/paused sessions
- [ ] Events emitted: `session.reflection.added`, `session.reflection.removed`
- [ ] Reflections included in session summary body
- [ ] Reflections threaded through template save/restore
- [ ] Backward compat: sessions without reflections load cleanly
- [ ] Tests pass, `npm test` green

---

### Inc 4: Structured Reflection — UI (PBI-SW-013 Part 2)

**Goal:** Render reflection entries in the session workspace with category-based organization.

**Scope:**
- `SessionReflectionPanel` component: tabbed/sectioned view for 4 categories
- Add entry: text input + category selector
- Remove entry: delete button per entry
- Integrate into `SessionWorkspaceView` (after execution plan, before activity log)
- Wire `session.reflection.added`/`removed` subscriptions
- Category icons and color coding for visual distinction
- Read-only in completed/archived states

**Out of scope:**
- Sidebar reflection display (PBI-SW-017)
- Reflection analytics or word cloud (PBI-SW-015)

**Estimated size:**
- LOC: ~100 (component + view integration)
- Tests: ~20 (component rendering + event wiring + category filtering)
- Files: 3–4 (new component, view update, subscriptions update, tests)

**Acceptance criteria:**
- [ ] Reflection panel renders 4 categories with visual distinction
- [ ] User can add reflection with category selection
- [ ] User can remove individual reflections
- [ ] Panel updates in real-time via event subscriptions
- [ ] Read-only in completed/archived states
- [ ] Tests pass, `npm test` green

---

### Inc 5 (Stretch): SessionService Handler Extraction (TD-092)

**Goal:** Reduce SessionService from ~1,662 LOC to ~600 LOC by extracting handler methods into focused modules.

**Scope:**
- Extract task handlers → `src/domain/session/handlers/taskHandlers.ts`
- Extract closure handlers → `src/domain/session/handlers/closureHandlers.ts`
- Extract note sync handlers → `src/domain/session/handlers/noteSyncHandlers.ts`
- Extract lifecycle handlers → `src/domain/session/handlers/lifecycleHandlers.ts`
- SessionService becomes orchestrator: state, save(), load(), dispose(), handler registration
- No behavior changes — pure refactoring

**Out of scope:**
- New features
- Test additions (existing tests validate behavior — refactoring should not break them)

**Estimated size:**
- LOC: ~0 new (refactoring — moves existing code)
- Tests: ~0 new (existing tests cover behavior)
- Files: 5–6 (4 new handler modules, updated SessionService, barrel export)

**Acceptance criteria:**
- [ ] SessionService < 700 LOC
- [ ] All handler modules < 400 LOC each
- [ ] No behavior changes — all existing tests pass unchanged
- [ ] `npm test` green
- [ ] No new exports needed by external consumers

---

## Dependency Graph

```
Inc 1: Energy UI (SW-011)
    ↓
Inc 2: Cognitive Overload (SW-016) — depends on energy

Inc 3: Reflection Domain (SW-013 Part 1) — independent
    ↓
Inc 4: Reflection UI (SW-013 Part 2) — depends on domain

Inc 5: Service Extraction (TD-092) — independent, stretch
```

Increments 1–2 and 3–4 can run in parallel chains. Inc 5 is independent.

---

## Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| SessionService grows further before TD-092 | Medium | High | Schedule TD-092 as Inc 5 (stretch) or promote to Inc 3 if LOC exceeds 1,800 |
| Reflection adds complexity to note sync | Low | Medium | Reuse existing `generateSessionSummaryBody()` pattern — reflections are additive |
| Overload thresholds need tuning | Low | Medium | Ship configurable defaults, adjust in Cycle 9 based on real usage |
| Energy UI interactions affect workspace layout | Low | Low | Use compact inline indicator (not a card) — minimal layout impact |

---

## Success Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| v2 FRs delivered | 7/10 (was 4/10) | FR-11, FR-13, FR-16 delivered |
| v2 PBIs delivered | 6/8 (was 3/8) | SW-011, SW-013, SW-016 delivered |
| FRI score | ≥ 30/35 | Target: ui_consistency 2→3 (energy + reflection UI) |
| Tests added | ~75 new | 2,687 → ~2,762 |
| SessionService LOC | < 700 (if TD-092 delivered) | Down from 1,662 |
| Build green | `npm test` passes | Continuous |

---

## Related

- [[Session Workspaces PRD]] — parent feature (FRI 28/35)
- [[Cycle 7 - Execution Plan and Closure Ritual]] — predecessor cycle (completed)
- [[PBI-SW-011 Energy Tracking]] — energy UI
- [[PBI-SW-016 Cognitive Overload Detection]] — threshold warnings
- [[PBI-SW-013 Structured Reflection]] — 4-category reflection system
- [[TD-092 SessionService Handler Extraction]] — tech debt
- [[Run Intentional Session]] — v2 flow (phases 2–3 affected)
- [[ADR-031 Session v2 Architecture]] — architectural foundation
