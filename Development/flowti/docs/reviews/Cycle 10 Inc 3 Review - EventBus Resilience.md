---
type: IncrementReview
date: 2026-02-21
cycle: 10
increment: 3
feature: "Tech Debt Cleanup"
verdict: PASS
---

# Cycle 10 Inc 3 Review — EventBus Resilience

> Evaluated against [[Increment Lifecycle]] phases A–E.

---

## Phase A — Increment Planning

| Criterion | Status |
|-----------|--------|
| Scope defined | PASS — 3 TD items (TD-105, TD-117, TD-72) targeting EventBus error boundary, ESLint guardrail, and settings race condition |
| Files to create/modify listed | PASS — 3 source files + 1 test file |
| Implementation order stated | PASS — TD-72 validation first, then TD-105 (EventBus error boundary), then TD-117 (ESLint rule) |
| Test intent stated | PASS — ~10 tests for EventBus error boundary behavior |
| Documentation intent stated | PASS — Update 3 TD items to resolved, document EventBus error boundary pattern |

**Gate: Plan approved** — Scope defined in Cycle 10 plan, acceptance criteria listed.

---

## Phase B — Implementation

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Domain-first order | PASS | TD-72 confirmed already resolved → TD-105 (EventBus core) → TD-117 (tooling) |
| Build pipeline passes | PASS | `npm test` green: tsc + eslint + vitest (2,880 tests, 0 failures) |
| `npm run build` | PASS | No type signature changes that affect esbuild; tsc passes |
| Deviations documented | PASS | See below |

### Deviations from Plan

| Planned | Actual | Rationale |
|---------|--------|-----------|
| TD-72: "Add `PathMutex.withLock()` wrapper" | Already resolved in code — `saveMutex.withLock("settings", ...)` found at SettingsService.ts:186 | Code was fixed during a prior cycle but the TD item was not updated. Confirmed via code inspection and updated TD doc accordingly. No implementation needed. |
| TD-105: "Route errors through ErrorService" | Route errors through `onError` callback or `console.error` fallback | ErrorService emits events through EventBus — wiring EventBus errors to ErrorService would cause infinite recursion. The `onError` callback pattern allows the wiring site (main.ts) to choose the error routing strategy. `console.error` is the correct last-resort fallback. |
| 3 TD items to implement | 2 implemented + 1 confirmed pre-resolved | TD-72 was already fixed in code. Reduces Inc 3 effective scope from 3 to 2 items, but all 3 TDs are now resolved. |
| Estimated ~10 tests | Actual 6 tests | EventBus error boundary has 6 distinct scenarios; no tests needed for TD-117 (ESLint rule) or TD-72 (already resolved). |
| Estimated ~60 LOC | Actual +25 source, +65 test | EventBus changes are compact (~20 LOC). ESLint config is +5 LOC. Test coverage is thorough. |

### Files Modified (Source)

| File | Change | LOC |
|------|--------|-----|
| `src/infrastructure/events/EventBus.ts` | TD-105: `onError` callback in constructor, try-catch per handler in `emit()` and `emitCustom()`, `routeError()` private method | +20 |
| `eslint.config.mjs` | TD-117: Added `parserOptions.project: "./tsconfig.json"` and `"@typescript-eslint/no-floating-promises": "warn"` | +5 |

### Test Files

| File | New Tests | Purpose |
|------|-----------|---------|
| `tests/infrastructure/events/EventBus.test.ts` | 6 | Error boundary: catch + continue, onError routing, console.error fallback, wildcard errors, async rejections, emitCustom errors |

**Net new tests: 6.** Net test change: +6 (2,874 → 2,880).

**Gate: Build pipeline green.**

---

## Phase C — Review and Quality Assurance

### Three Amigos Review (Solo Delivery)

**Product Perspective:**
- TD-105 is the single highest-leverage fix in Cycle 10 — one change in EventBus.emit() addresses the root cause behind 60+ `void emit()` call sites that previously swallowed errors silently
- TD-117 establishes a lint guardrail that prevents future floating promise debt from accumulating
- The error boundary preserves the fire-and-forget ergonomics of `void emit()` while making failures observable
- No user-visible behavior change — errors that were previously invisible now surface in console output

**Engineering Perspective:**
- **Positive:** Per-handler try-catch in `emit()` and `emitCustom()` ensures one handler failure does not prevent subsequent handlers from executing — matches the principle of EventBus as a communication backbone that must not break due to subscriber bugs
- **Positive:** The `onError` callback is injected via constructor options, maintaining EventBus as a pure infrastructure component with no dependency on ErrorService or domain services
- **Positive:** `routeError()` private method centralizes the fallback logic (onError → console.error) — single responsibility within EventBus
- **Positive:** `no-floating-promises` at "warn" level is the correct graduated approach — existing `void` usages are explicitly allowed by the rule, and 19 legitimate warnings provide visibility without breaking the build
- **Observation:** The 19 lint warnings represent unhandled promises that should be triaged in a future increment — either wrap with `void` (intentional fire-and-forget) or add `await` (intentional wait)
- **Observation:** ErrorService cannot be wired as the `onError` callback because ErrorService itself emits through EventBus — infinite recursion risk. The wiring site (main.ts) should use `console.error` or a dedicated logger.

**QA Perspective:**
- **2,880 tests passing, 0 failures, 0 regressions** — all previous 2,874 tests still pass
- 6 new tests cover all error boundary code paths: sync throw, async rejection, onError callback, console.error fallback, wildcard handler errors, and emitCustom errors
- Tests verify handler isolation (handler2 called after handler1 throws) — critical behavioral guarantee
- All 13 flow integration tests pass — end-to-end behavior unchanged
- Build pipeline fully green (tsc + eslint + vitest; 19 lint warnings expected at warn level)

### TASM Scoring

| Dimension | Score | Notes |
|-----------|-------|-------|
| A) Product Value & Clarity | 5 | Single fix addresses 60+ silent failure sites; highest-leverage item in the cycle |
| B) Architectural Integrity | 5 | EventBus remains a pure infrastructure component; `onError` callback is clean DI; no circular dependencies |
| C) Event Discipline | 5 | Error boundary is in the event system itself — events now have built-in resilience; no new event types needed |
| D) Data Model Integrity | 5 | No type changes; EventBus API is backward-compatible (options parameter is optional) |
| E) UX & Flow Quality | 4 | No direct UX changes; errors now visible in console instead of silently lost |
| F) Performance & Scalability | 4 | try-catch per handler adds negligible overhead; no hot-path impact |
| G) Documentation Discipline | 5 | Full lifecycle review, deviations documented, 3 TD items resolved, lint rule documented |
| **Total** | **33/35** | **Excellent** |

### Findings

| # | Source | Finding | Classification | Action |
|---|--------|---------|---------------|--------|
| F-1 | Engineering | 19 lint warnings from `no-floating-promises` — unhandled promises that need triage | Observation | Future: triage each warning; add `void` prefix for intentional fire-and-forget, `await` for intentional wait |
| F-2 | Engineering | `onError` callback not wired in `main.ts` yet — EventBus uses `console.error` fallback | Observation | Wire `onError` in main.ts constructor when the plugin instantiates EventBus; route to a logger or error tracking if desired |
| F-3 | Engineering | TD-72 was found already resolved in code — documentation lagged behind implementation | Observation | Establish practice of updating TD items in the same commit as the code fix |

**Gate: No blockers. All tests pass. TASM recorded.**

---

## Phase D — Documentation

| Item | Status | Evidence |
|------|--------|----------|
| TD items updated | PASS | TD-105 and TD-117 marked `resolved` with `resolved_in: "Cycle 10 Inc 3"`; TD-72 confirmed pre-resolved |
| Cycle plan updated | PASS | Inc 3 delivery notes added, acceptance criteria checked |
| Architecture docs | N/A | EventBus error boundary is a behavioral improvement, not an architectural pattern change |
| Technical debt register | PASS | 2 items resolved this increment (14 open debt items remain in cycle scope) |
| MEMORY.md | PASS | Test count updated (2,874 → 2,880), debt counts updated |

**Gate: Documentation reflects current state.**

---

## Phase E — Closure and Feedback

### Definition of Done Checklist

- [x] **Acceptance criteria met** — All 6 criteria from cycle plan satisfied (see below)
- [x] **Tests added per TestPlan** — 6 new tests: EventBus error boundary coverage
- [x] **Build pipeline passes** — `npm test` green (tsc + eslint + vitest), 2,880 tests, 0 failures
- [x] **Three Amigos review completed** — Solo delivery reviewed above
- [x] **All blocker findings resolved** — No blockers found
- [x] **TASM score recorded** — 33/35 (Excellent)
- [x] **Documentation updated:**
  - [x] TD items — TD-105 and TD-117 marked resolved with `resolved_in: "Cycle 10 Inc 3"`; TD-72 confirmed pre-resolved
  - [x] Cycle plan — Inc 3 delivery notes + acceptance criteria checked
  - [x] Architecture docs — N/A
  - [x] Debt register — 2 resolved this increment
- [x] **Manifests updated** — N/A (no layout/component/tab changes)
- [x] **No architectural boundary violations** — EventBus change is within infrastructure; ESLint change is tooling
- [x] **Improvement items captured** — F-1 through F-3 logged above

### Acceptance Criteria (from Cycle 10 Plan)

- [x] EventBus.emit() catches subscriber errors and routes to onError callback — try-catch per handler in `emit()` and `emitCustom()`, `routeError()` helper
- [x] Existing `void emit()` call sites continue to work without modification — backward-compatible; `onError` is optional
- [x] ESLint `no-floating-promises` enabled (warning level); existing `void` usages pass — rule added, 19 warnings for non-void promises (expected)
- [x] `npm run lint` green with new rule — warnings only, no errors
- [x] SettingsService concurrent saves are serialized via mutex — confirmed already in place (`saveMutex.withLock("settings", ...)` at line 186)
- [x] `npm test` green — 2,880 tests, 0 failures

### Feed-Forward

- EventBus error boundary is the highest-leverage single fix in Cycle 10 — addresses root cause for 60+ call sites
- The `onError` callback pattern allows flexible error routing without circular dependencies
- 19 lint warnings should be triaged: add `void` prefix for intentional fire-and-forget, `await` for intentional wait
- F-2 (wiring `onError` in main.ts) should be done when ErrorService or logging strategy is formalized
- F-3 (TD-72 documentation lag) suggests co-locating TD updates with code fixes in the same commit

**Gate: DoD fully satisfied. Backlog captured.**

---

## Summary

| Metric | Target | Actual |
|--------|--------|--------|
| TD items resolved | 3 | **3** (2 implemented + 1 confirmed pre-resolved) |
| Production LOC changed | ~60 | **+25 source, +65 test** (90 total delta) |
| Tests added | ~10 | **6** (proportionate to fix complexity) |
| Tests passing | 2,874+ | **2,880** |
| Regressions | 0 | **0** |
| Files changed | ~5 | **3** (2 source + 1 test) |
| TASM | — | **33/35 (Excellent)** |

**Verdict: PASS** — All 3 TD items resolved (2 implemented, 1 confirmed pre-resolved). EventBus error boundary addresses 60+ silent failure sites. ESLint `no-floating-promises` rule prevents future floating promise debt. SettingsService race condition confirmed already fixed.
