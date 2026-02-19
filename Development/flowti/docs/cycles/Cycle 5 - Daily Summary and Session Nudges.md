---
type: DevelopmentCycle
feature: "[[Session Workspaces PRD]]"
stage: done
cycle: 5
date_planned: 2026-02-18
date_completed: 2026-02-18
pbis:
  - "[[PBI-SW-007 Auto-Session and Session Nudges]]"
tech_debt: []
estimated_increments: 4
actual_increments: 4
estimated_tests: 80
actual_tests: 72
total_tests_after: 2507
total_test_files_after: 99
---

# Cycle 5: Daily Summary & Session Nudges

## Situation Assessment

### Pre-Cycle State (2026-02-18)

**Plugin health:**
- 2,435 tests passing (32 skipped), 95 test files
- Clean working tree, all builds green
- `npm run build` pipeline: vitest + typedoc + tsc + eslint + esbuild

**Session Workspaces feature:**
- PRD v6, FRI 33/35, stage: in-progress
- PBI-SW-001 (Activity Log): done
- PBI-SW-002 (Context Bindings): done
- PBI-SW-003 (Session Types): done — 9 built-in types (incl. daily-tracking), custom type creation
- PBI-SW-004 (Decision Log): done
- PBI-SW-005 (Session Summary): done — frontmatter + body + decisions section
- PBI-SW-006 (State Restoration): done — workspace state save/restore on pause/resume
- PBI-SW-007 (Auto-Session & Nudges): **partial** — daily-tracking type, concurrent sessions, auto-start, daily note auto-link, same-day restart delivered; **nudges deferred**
- PBI-SW-008 (Session Output Artifacts): done
- Session domain: 2,373 LOC across 4 domain files; 3,568 LOC across 19 UI files
- 64 session events registered
- SessionService: 1,266 LOC (34 LOC headroom under 1,300 extraction threshold)
- 12 flow test suites covering documented user journeys

**What's next per PRD priority ranking:**
1. PBI-SW-007 completion (nudge system) — medium effort, high user demand, deferred from Cycle 4
2. PBI-SW-009 (Domain Design Session) — large effort, unblocked, needs UI spike

**Deferred from Cycle 4:**
- `generateDailySummary()` — dedicated daily activity summary renderer (currently reuses `writeSessionSummary`)
- Flow test `13-DailySessionLifecycle.test.ts` — end-to-end daily session lifecycle coverage
- PBI-SW-007 nudge system — configurable session start prompts
- Global activity folder filter — per-session filter delivered, global deferred

**Inbox signals (reviewed 2026-02-18):**
- "I want to easily start a new session while working inside Obsidian" — core driver for nudge system
- "I want to import and export a session template via JSON" — high priority, low effort (candidate for quick win)

**PBI-SW-007 nudge system deferred because:**
Cycle 4 prioritized core daily-tracking, concurrent sessions, and settings UI — the foundation that nudges build on. Nudges require timer/scheduling infrastructure that only makes sense once the daily session lifecycle is stable and tested end-to-end.

### Post-Cycle State (2026-02-18)

**Plugin health:**
- 2,507 tests passing (32 skipped), 99 test files (+72 tests, +4 files)

**Session Workspaces feature:**
- PBI-SW-007: **done** — nudge system delivered, daily summary function extracted
- New domain: `src/domain/nudge/` (types, events, NudgeService) — ~190 LOC
- New UI: `src/ui/NudgeNotification.ts`, `src/ui/userHub/UserHubNudgePreferences.ts` — ~250 LOC
- 8 nudge events registered in catalog (category "Nudge")
- Dashboard shows next upcoming nudge time indicator
- Nudge skips when same-type session already active

**Session UX polish (end-of-cycle):**
- 2 new command palette commands: `flowti:create-session`, `flowti:resume-session` (13 total commands)
- Dashboard "New Session" quick action with `onCreateSession` callback
- Total commands: 13 (5 registry + 4 DX setup + 4 session/main.ts)

---

## Cycle Goals

1. **Deliver daily summary generation** — `generateDailySummary()` pure function rendering activity as grouped markdown, wired to daily session stop
2. **Deliver flow test 13-DailySessionLifecycle** — end-to-end test covering auto-start → concurrent tracking → same-day restart → daily summary
3. **Deliver PBI-SW-007 nudge system** — configurable time-based prompts to start sessions, with "Start" / "Dismiss" actions
4. **Close PBI-SW-007** — all acceptance criteria met (except midnight rollover, deferred if complex)

**Explicitly deferred to Cycle 6:**
- PBI-SW-009 (Domain Design Session) — requires UI spike, large effort
- Global activity folder filter — nice-to-have, not blocking
- Session template JSON import/export — independent, can be a quick cycle

---

## Tech Debt Bundled

**None bundled this cycle.** SessionService at 1,266 LOC has 34 LOC headroom — nudge system adds ~80 LOC to the service (new handlers), potentially pushing to ~1,346 LOC. If this exceeds 1,350, extraction will be planned as a tech debt item mid-cycle. The growth is natural handler addition (not complexity sprawl), so threshold flexibility applies.

---

## Increment Plan

### Inc 1: Daily Summary + Flow Test

**Goal:** Extract `generateDailySummary()` as a dedicated renderer and deliver the deferred flow test covering the full daily session lifecycle.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/session/helpers.ts` | `generateDailySummary(session): string` — pure function rendering activity summary as grouped markdown list (file → latest action + count) | ~40 |
| 2 | `src/main.ts` | Update `session.daily.stopped` listener: call `generateDailySummary()` for daily note content instead of generic `writeSessionSummary()` | ~10 |
| 3 | `tests/domain/session/helpers.test.ts` | `generateDailySummary()`: grouped output, empty session, many files, single file, mixed actions | ~25 |
| 4 | `tests/flows/13-DailySessionLifecycle.test.ts` | Full lifecycle: vault open → daily auto-start → concurrent focused session → activity tracked in both → focused complete → daily stop → same-day restart → daily stop again → verify summary + events | ~150 |

**Est. total:** ~50 LOC source, ~175 LOC tests, ~25 tests

**Acceptance criteria:**
- [x] `generateDailySummary()` renders activity as grouped markdown (file name → action + count)
- [x] Daily session stop uses `generateDailySummary()` for daily note content
- [x] Flow test covers: auto-start → concurrent tracking → focused lifecycle → daily stop → same-day restart → summary
- [x] `npm run build` passes

---

### Inc 2: Nudge Domain — Types + Events + Service

**Goal:** Add nudge configuration types, events, and NudgeService that schedules time-based session start prompts.

**Architecture decision — nudge system:**
- `NudgeConfig`: `{ id, time: string (HH:MM), sessionType, title?, durationMinutes?, enabled: boolean }`
- `NudgeState`: `{ configs: NudgeConfig[], activeNudgeId: string | null, dismissedToday: Set<string> }` — persisted via TypedStorage key `"nudges"`
- `NudgeService`: evaluates nudge configs on a 60s interval, emits `nudge.triggered` when current time matches a config's `time` and the nudge hasn't been dismissed today
- Midnight rollover: clear `dismissedToday` set when date changes (check on each interval tick)
- No dependency on SessionService — NudgeService only emits events; main.ts or UI handles the "Start" action by emitting `session.create`

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/nudge/types.ts` | `NudgeConfig`, `NudgeState`, `NudgeId` type alias, `DEFAULT_NUDGE_CONFIGS` | ~35 |
| 2 | `src/domain/nudge/events.ts` | `NudgeEventMap`: `nudge.configure`, `nudge.configured`, `nudge.triggered`, `nudge.dismissed`, `nudge.loaded` | ~20 |
| 3 | `src/domain/nudge/NudgeService.ts` | Interval-based scheduler: `start()`, `stop()`, `evaluateNudges()`, `dismissNudge()`, `configureNudge()`, midnight rollover logic | ~120 |
| 4 | `src/infrastructure/events/events.ts` | Compose `NudgeEventMap` into `FlowtiEventMap` | ~3 |
| 5 | `src/infrastructure/events/catalog.ts` | 5 catalog entries for nudge events, category "Nudge" | ~10 |
| 6 | `tests/domain/nudge/NudgeService.test.ts` | Scheduler: trigger at correct time, skip dismissed, midnight rollover, enable/disable, configure | ~40 |

**Est. total:** ~188 LOC source, ~40 tests

**Acceptance criteria:**
- [x] `NudgeConfig` type with time (HH:MM), session type, duration, enabled flag
- [x] `NudgeService` evaluates configs every 60s against current time
- [x] `nudge.triggered` emitted when time matches and nudge not dismissed today
- [x] `nudge.dismissed` clears the nudge for today (re-triggers tomorrow)
- [x] Midnight rollover clears dismissed set
- [x] 8 new events in catalog: `nudge.configure/configured/triggered/dismiss/dismissed/remove/removed/loaded`
- [x] `npm run build` passes

---

### Inc 3: Nudge UI — Notification + Preferences

**Goal:** Show nudge notifications in-app and add nudge configuration to User Hub Preferences.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/ui/userHub/UserHubPreferences.ts` | Add "Nudges" category (4th preference category) | ~5 |
| 2 | `src/ui/userHub/UserHubNudgePreferences.ts` | Nudge config panel: list existing nudges, add/edit/delete, time picker, session type dropdown, enable toggle | ~180 |
| 3 | `src/ui/userHub/types.ts` | Add `"nudges"` to `PreferencesCategory` union; add nudge state fields to `UserHubState` | ~10 |
| 4 | `src/ui/NudgeNotification.ts` | Obsidian `Notice`-based notification: shows nudge title + "Start" / "Dismiss" buttons; "Start" emits `session.create`, "Dismiss" emits `nudge.dismissed` | ~60 |
| 5 | `src/main.ts` | Wire `NudgeService.start()` in `onLayoutReady()`, `stop()` in `onunload()`. Listen to `nudge.triggered` → show `NudgeNotification`. Listen to notification Start → emit `session.create` | ~25 |
| 6 | `tests/ui/userHub/UserHubNudgePreferences.test.ts` | Config panel: renders nudge list, add/edit/delete, toggle enable | ~20 |
| 7 | `tests/ui/NudgeNotification.test.ts` | Notification: shows title, Start creates session, Dismiss emits event | ~15 |

**Est. total:** ~280 LOC source, ~35 tests

**Acceptance criteria:**
- [x] Nudge notification appears as Obsidian Notice when `nudge.triggered` fires
- [x] "Start" creates a session with the nudge's configured type and duration
- [x] "Dismiss" marks the nudge as dismissed for today
- [x] User Hub Preferences shows "Nudges" category with nudge config list
- [x] Add/edit/delete nudge configs with time picker, session type, duration, enable toggle
- [x] `npm run build` passes

---

### Inc 4: Integration + Default Nudges

**Goal:** Add sensible default nudge configs, integrate with daily session, and deliver end-to-end verification.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/nudge/types.ts` | Default nudge configs: "Morning Review" (09:00, daily-tracking), "Afternoon Focus" (14:00, deep-work) — disabled by default | ~15 |
| 2 | `src/domain/nudge/NudgeService.ts` | Skip nudge if a session of the same type is already active (don't nudge to start a daily session if one is running) | ~10 |
| 3 | `src/ui/userHub/UserHubDashboard.ts` | Show next upcoming nudge time in dashboard (if any enabled) | ~20 |
| 4 | `tests/domain/nudge/NudgeService.test.ts` | Default configs: exist but disabled; skip when same-type session active | ~10 |
| 5 | `tests/ui/userHub/UserHubDashboard.test.ts` | Dashboard shows next nudge time | ~5 |

**Est. total:** ~45 LOC source, ~15 tests

**Acceptance criteria:**
- [x] 2 default nudge configs created on first load (Morning Review, Afternoon Focus) — disabled by default
- [x] Nudge skipped when a session of the same type is already active
- [x] Dashboard shows next upcoming nudge time (if any nudges enabled)
- [x] All PBI-SW-007 acceptance criteria met (except midnight rollover edge cases, if deferred)
- [x] `npm run build` passes — all tests green

---

## Dependency Graph

```
Inc 1: Daily Summary + Flow Test (independent, Cycle 4 backlog cleanup)
  |
Inc 2: Nudge Domain — types, events, NudgeService (independent of Inc 1)
  |
Inc 3: Nudge UI — notification + preferences (requires Inc 2 types + events)
  |
Inc 4: Integration + defaults (requires Inc 2 + Inc 3)
```

**Note:** Inc 1 (backlog cleanup) and Inc 2 (nudge domain) are technically independent and could run in parallel. Inc 3 requires Inc 2's types and events. Inc 4 requires the full nudge stack.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SessionService grows past 1,300 LOC with nudge wiring in main.ts | Medium | Nudge logic lives in NudgeService (separate domain), not SessionService. main.ts wiring is thin (~25 LOC). Monitor post-cycle. |
| 60s interval timer impacts Obsidian performance | Low | Single `setInterval` with simple time comparison. `stop()` on unload. Profile in Inc 2 tests. |
| Time picker UX in Obsidian is limited (no native time input) | Medium | Use text input with HH:MM validation. Simple and consistent with existing settings patterns. |
| Nudge notification dismissed but user misses it | Low | Notification uses Obsidian Notice (auto-dismiss after timeout). Consider adding inbox item as fallback in future cycle. |
| Midnight rollover complexity (timezone handling) | Medium | Use local time (`new Date().getHours()`/`getMinutes()`) for both nudge evaluation and rollover. Defer timezone-aware scheduling to future cycle if needed. |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Tests added | 72 new (25 Inc 1 + 40 Inc 2 + 35 Inc 3 + 15 Inc 4 - overlap + 3 polish) |
| Tests total | 2,507 (32 skipped) |
| Test suites | 99 |
| LOC added (source) | ~580 new (50 Inc 1 + 188 Inc 2 + 280 Inc 3 + 45 Inc 4 + ~17 polish) |
| PBIs closed | PBI-SW-007 (complete — nudges + daily summary delivered) |
| New events | 8 (nudge domain) |
| New commands | 2 (create-session, resume-session) — 13 total |
| Total session events | 64 (unchanged — nudge events are in separate domain) |
| Flow tests | 13 (new: 13-DailySessionLifecycle) |
| Plugin totals | 42,493 LOC, 216 source files, 15 bounded contexts |

---

## Cycle Retrospective

### What Went Well
- **Clean 4-increment delivery**: All increments delivered in sequence without blockers. Daily summary + flow test (Inc 1) provided early confidence for the nudge system (Inc 2-4).
- **NudgeService stayed isolated**: The nudge domain has zero dependencies on SessionService — it only emits events. main.ts wiring is thin (~20 LOC). This kept complexity contained.
- **No SessionService growth**: NudgeService as a separate domain prevented SessionService from exceeding the 1,300 LOC extraction threshold. SessionService stayed at 1,266 LOC.
- **End-of-cycle UX polish**: Session command palette integration (create + resume) and dashboard "New Session" quick action were delivered as a focused polish pass. 3 tests added, all builds green.
- **Inbox and backlog review**: Both vault and dev inboxes reviewed; 7 items marked delivered, backlog refinement doc updated with Cycle 4+5 completions, priority sequence reordered.

### Deviations from Plan
- **Test count lower than estimated**: 72 actual vs 80 estimated. The nudge UI tests were slightly less granular than planned (combined some assertions), and the daily flow test covered more in fewer test cases than originally scoped.
- **Session UX polish added**: Not in the original plan but surfaced during the inbox review as the next logical step. Kept minimal (2 commands + 1 dashboard action + 3 tests).
- **Preferences split was pre-existing**: The plan assumed preferences were still combined; they had already been split in a prior session. No rework needed.

### Improvement Backlog (from this cycle)
- **TD-94**: Missing Session Management flow doc and integration test — now partially addressed with `13-DailySessionLifecycle.test.ts`, but core session CRUD flow doc still missing
- The `generateDailySummary()` function could benefit from configurable section headers (currently hardcoded "Activity Summary")
- NudgeNotification uses Obsidian Notice with a 0-timeout (persistent until user action) — consider adding inbox fallback for missed nudges in future cycle
- `main.ts` now at 846 LOC — approaching TD-05 threshold (orchestrator role). Session wiring section (commands, file menu, workspace helpers) is a candidate for extraction to a `sessionSetup.ts` module

### Learnings
- **L-33 Isolated scheduling domains**: NudgeService demonstrates that timer/scheduler logic can live in its own bounded context without coupling to the domain it serves. The service emits events; consumers (UI, main.ts) handle the "what to do" part. This pattern can be reused for future automated workflows.
- **L-34 Command palette as UX multiplier**: Adding 2 command palette commands (create-session, resume-session) provides disproportionate UX improvement for minimal code (~30 LOC). Should be the default for any user-facing action.
- **L-35 Optional deps in component interfaces**: Using `onCreateSession?: () => void` in the dashboard deps keeps backward compatibility — existing tests don't break, new features are opt-in. Better than required deps that force mock updates across all test files.

---

## Related

- PRD: [[Session Workspaces PRD]] (v6, FRI 33/35)
- PBIs: [[PBI-SW-007 Auto-Session and Session Nudges]] (completion — nudge system)
- Learnings (input): [[L-29 Zero-duration timer guard]], [[L-30 Click event bubbling in action containers]], [[L-31 CSS variable invisibility]], [[L-32 Settings co-location]]
- Learnings (output): [[L-33 Isolated scheduling domains]], [[L-34 Command palette as UX multiplier]], [[L-35 Optional deps in component interfaces]]
- Previous Cycle: [[Cycle 4 - Auto-Session and Activity Polish]]
