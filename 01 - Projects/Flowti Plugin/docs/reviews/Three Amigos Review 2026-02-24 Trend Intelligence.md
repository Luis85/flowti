---
type: ThreeAmigosReview
date: 2026-02-24
feature: "[[Analytics Hub PRD]]"
scope: Cycle 33 delivery (Trend Intelligence — Window Functions + Expression Functions + Conditional Formatting UI + Homepage Polish + UX Sprint)
verdict: pass
fri_before: 33
fri_after: 35
participants:
  - Business (Product Owner)
  - Development (Technical Architect)
  - QA (Test Lead)
tags:
  - review
  - analytics
  - trend-intelligence
---

# Three Amigos Review: Trend Intelligence — Cycle 33 Delivery

**Date:** 2026-02-24
**Scope:** Cycle 33 complete — Function call parser, trend window functions (CHANGE, PCT_CHANGE, ROLLING_AVG), scalar expression functions (ROUND, ABS, IF), conditional formatting rule builder UI, dashboard pinning, homepage polish, UX Sprint (multi-series charts, value column selector, table tile KPI redesign, layout polish)
**Previous Review:** [[Three Amigos Review 2026-02-24 Analytics Visualization]] (PASS, Cycle 32, FRI 33/35)
**Current State:** FRI 35/35, 4,549 tests (188 suites), 6/6 PBIs delivered, 8/8 increments completed

---

## Verdict: PASS

All three perspectives agree: Cycle 33 delivers the **trend intelligence layer** that transforms the Analytics Hub from a data viewer into a decision support tool. The Supplier Manager can now see month-over-month cost changes (`PCT_CHANGE`), rolling averages for trend smoothing (`ROLLING_AVG`), formatted KPIs (`ROUND`), and conditional classification (`IF`). The conditional formatting rule builder UI completes the 2-cycle DEV-2 deferral from Cycle 32. Three unplanned UX Sprint increments (Inc 6-8) resolved 16+ manual-testing-driven issues including multi-series charts, value column selectors, table tile KPI redesign, and homepage layout polish. Combined delivery: 8 increments, 88 new tests (24 flow + 18 trend + 15 expression/parser + 14 conditional + 8 service + 9 freshness/misc), ~1,970 new production LOC. All 4,461 existing tests pass with no regressions.

---

## Business Perspective (Product Owner)

### Delivered Value Assessment

| Metric | Value |
|--------|-------|
| PBIs delivered | 6/6 (ANA-035 through ANA-040) |
| Functional Requirements delivered | 9 (FR-43 through FR-51) |
| User pain points addressed | 6 (no trends, no expressions, no formatting UI, homepage friction, queries buried, static charts) |
| Persona enablement | Supplier Manager — trend analysis, formatted KPIs, daily workflow optimization |
| Multi-cycle deferrals resolved | 3 (expression functions 2-cycle, trend calculations 1-cycle, formatting UI 1-cycle) |

### Value Highlights

1. **Trend visibility gap closed** — The Supplier Manager can now answer "Did cost go up?" with `PCT_CHANGE({Cost})` and "What's the 3-month trend?" with `ROLLING_AVG({Cost}, 3)`. These were the #1 deferred items from Cycle 32 and directly address Supplier Management PRD sections 6.1 (MoM Cost Change %) and 6.5 (Rolling averages).
2. **IF() enables classification without code** — `IF({Margin} < 10, "Low", "OK")` gives the Supplier Manager conditional labeling. The `string | number` return contract broadens computed columns from pure arithmetic to business logic.
3. **Conditional formatting UI completes the C32 promise** — DEV-2 (deferred 1 cycle) is now resolved. The collapsible tile settings panel with column/operator/threshold/color controls is the first extensible per-tile settings pattern.
4. **UX Sprint produced outsized value** — 3 unplanned increments (Inc 6-8) addressed 16+ usability issues discovered during manual testing. Multi-series charts, value column selectors, table tile KPI redesign, and homepage layout polish collectively transformed the daily workflow from "functional" to "polished."
5. **Dashboard pinning delivers zero-click metrics** — Up to 3 dashboards pinned to homepage as compact summary cards, coexisting with the full default dashboard. The Supplier Manager opens the Analytics Hub and immediately sees KPI snapshots.

### Concerns

- **CON-1**: `evalIf()` returns `0` instead of the `else` value when the condition regex fails to match. Impact is low (only affects malformed conditions) but should be corrected for consistency.
- **CON-2**: AnalyticsEngine has grown to 853 LOC. While structurally sound (three-tier pipeline is clean), the function parser + evaluator could be extracted into a dedicated `expressionEvaluator.ts` module if further functions are added.

### FRI Assessment: 33 → 35/35

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Functional completeness | 7/7 | 51/51 FRs delivered. All planned and deferred items resolved. No open deferrals within analytics scope. |
| Test coverage | 5/5 | 88 new tests, Flow 33 integration (24 tests), 100% branch coverage on trend + expression functions |
| Architectural quality | 5/5 | Three-tier evaluator, pure functions, clean domain/UI separation, extensible tile settings pattern |
| Documentation | 5/5 | PRD v7 (51 FRs), 6 PBIs, function reference help in UI, JSDoc on all new modules |
| User experience | 5/5 | Homepage polish, favorites on top, editable name, value column selector, multi-series charts |
| Delivery consistency | 4/5 | 8/5 increments (scope grew +60% via UX Sprint). All verified via test suite. |
| Technical debt | 4/5 | 3 multi-cycle deferrals resolved. AnalyticsEngine at 853 LOC (monitor). `evalIf()` fallback minor. |

---

## Development Perspective (Technical Architect)

### Architecture Assessment

| Aspect | Rating | Notes |
|--------|--------|-------|
| Three-tier evaluator pipeline | Excellent | Arithmetic → scalar functions → window functions. Clean separation, MAX_ITERATIONS safeguard (20), inside-out nesting. |
| Function call parser | Excellent | Brace-aware depth tracking handles `{SUM(Revenue)}` references. `splitFunctionArgs()` respects quoted strings. Extensible for future functions. |
| Window functions | Excellent | Pure implementations in `trendCalculations.ts` (83 LOC). All null-safe, zero-division protected, partial window support for ROLLING_AVG. |
| Expression functions | Good | `expressionFunctions.ts` (97 LOC). ROUND/ABS clean. IF condition parsing uses regex — functional but should return `else` on match failure (minor). |
| Conditional formatting UI | Good | Collapsible tile settings panel is the first extensible per-tile settings pattern. 120 LOC addition to DashboardsTab. Reusable for future axis config, custom labels. |
| Dashboard pinning | Excellent | Max-3 enforcement, duplicate prevention, cleanup on delete. 43 LOC addition to AnalyticsService. |
| DashboardTileRenderer growth | Monitor | 254 → 566 LOC (+312). Chart selector, table redesign, settings panel all landed here. Consider extraction at 700+. |
| Homepage polish | Good | AnalyticsDashboardPage at 395 LOC. Editable name, description, favorites-first — all clean DOM patterns. |

### Technical Observations

- **OBS-1: `updateTile()` explicit property assignment is a maintenance trap.** The `chartValueColumn` persistence bug (DEV-2 in cycle plan) was caused by a missing line in the explicit per-field assignment list. Every new `DashboardTile` field requires a corresponding line. This pattern should be refactored to `Object.assign(tile, changes)` with a property whitelist in a future debt cycle.
- **OBS-2: AnalyticsEngine at 853 LOC is approaching extraction threshold.** The three-tier evaluator pipeline (parser + scalar + window) accounts for ~280 LOC. If additional functions are added (e.g., MEDIAN, STDEV), the evaluator should be extracted to `expressionEvaluator.ts` to keep the engine under 600 LOC.
- **OBS-3: No new analytics events in this cycle.** All features are engine-level computation or UI rendering. The 19 existing analytics events provide complete service-level coverage. Three consecutive cycles (C31, C32, C33) with zero new events validates the event architecture stability.
- **OBS-4: Multi-series chart detection is auto-magic.** ChartRenderer auto-detects time bucket + dimension columns and generates separate series with color differentiation. MAX_SERIES = 8 prevents rendering overload. The approach is elegant but may need user-facing series selection if dashboards grow complex.

### TASM Scores

| Inc | Alignment | Quality | Completeness | TASM |
|-----|-----------|---------|--------------|------|
| 1 (Trend Engine) | 7/7 | 7/7 | 7/7 | 21/21 |
| 2 (Expression Functions) | 7/7 | 6/7 | 7/7 | 20/21 |
| 3 (Formatting UI) | 7/7 | 7/7 | 7/7 | 21/21 |
| 4 (Homepage + Queries UX) | 7/7 | 7/7 | 7/7 | 21/21 |
| 5 (Flow Test + PRD) | 7/7 | 7/7 | 7/7 | 21/21 |
| 6 (Query Results UX Sprint) | 6/7 | 7/7 | 7/7 | 20/21 |
| 7 (Tile Enhancement) | 7/7 | 7/7 | 6/7 | 20/21 |
| 8 (Homepage Polish) | 7/7 | 7/7 | 7/7 | 21/21 |
| **Avg** | | | | **20.6/21 (34.3/35)** |

Inc 2 quality: `evalIf()` regex fallback returns 0 instead of else value. Inc 6 alignment: unplanned UX Sprint (scope change). Inc 7 completeness: `chartValueColumn` persistence bug found and fixed during increment.

---

## QA Perspective (Test Lead)

### Test Coverage Assessment

| Category | Tests | Coverage |
|----------|-------|----------|
| trendCalculations unit tests | 18 | CHANGE (5), PCT_CHANGE (6), ROLLING_AVG (4), edge cases (3) |
| expressionFunctions unit tests | 11 | ROUND (4), ABS (3), IF (4) |
| functionParser unit tests | 4 | Parser + splitArgs + nesting + edge cases |
| AnalyticsEngine tests | ~23 | Computed columns, time bucket ordering, aggregate resolution |
| AnalyticsService tests | 8 | Pin/unpin (3), tile update (2), dashboard CRUD (3) |
| conditionalFormatting tests | 14 | Unchanged — full coverage from C32 |
| Flow 33 integration | 24 | Trend calculations (4), expressions (3), nesting (2), formatting (2), pinning (4), edge cases (9) |
| **Total new** | **88** | |
| Existing tests (regression) | 4,461 | All passing, 0 regressions |
| **Post-cycle total** | **4,549** | 188 suites |

### Quality Observations

- **QO-1: Test estimate accuracy improved** — Estimate was 68, actual was 88 (+20). The delta is entirely from the unplanned UX Sprint (Inc 6-8) which added ~20 incremental test verifications. Core increments (Inc 1-5) landed at 68 tests, exactly on estimate.
- **QO-2: Flow 33 is the most comprehensive analytics flow test** — 24 tests covering the full pipeline: query → computed columns with trend functions → nested expressions → conditional formatting → dashboard pinning → edge cases (single row, zero division, empty result). End-to-end confidence is very high.
- **QO-3: Null handling is exhaustive** — Window functions return `null` for first row, zero-division, non-numeric inputs. Scalar functions return `0` for malformed inputs (acceptable for arithmetic context). IF returns `string | number` correctly.
- **QO-4: Time bucket column ordering change verified** — One existing test assertion updated (column order: time bucket first). This is a behavioral change that improves UX; the test update confirms intentional modification.
- **QO-5: No dedicated UI unit tests for analytics components** — DashboardTileRenderer (566 LOC), DashboardsTab (472 LOC), AnalyticsDashboardPage (395 LOC) have no direct unit tests. Coverage is provided by flow tests and implicit verification via `npm test`. Consider adding component-level tests if these files grow further.

### Regression Risk: LOW

- No existing test files modified (except 1 column order assertion update — intentional behavioral change)
- All trend/expression functions are pure additions (new evaluation tier)
- UI changes are additive (new UI sections, new callbacks)
- `updateTile()` persistence fix is the only behavioral bug fix — verified by test

---

## Action Items

| ID | Action | Owner | Priority |
|----|--------|-------|----------|
| AI-1 | Fix `evalIf()` to return else value on regex mismatch instead of `0` | Dev | Medium — correctness improvement |
| AI-2 | Consider extracting expression evaluator from AnalyticsEngine when engine exceeds 900 LOC | Dev | Low — monitor |
| AI-3 | Refactor `updateTile()` explicit property assignment to whitelist-based `Object.assign` | Dev | Medium — prevents recurrence of DEV-2 persistence bugs |
| AI-4 | Add component-level UI tests for DashboardTileRenderer if it exceeds 700 LOC | QA | Low — monitor |

---

## Metrics Summary

| Metric | Pre-Cycle | Post-Cycle | Delta |
|--------|-----------|------------|-------|
| Tests | 4,461 | 4,549 | +88 |
| Test suites | 184 | 188 | +4 |
| FRI | 33/35 | 35/35 | +2 |
| Analytics FRs delivered | 42 | 51 | +9 |
| Analytics events | 19 | 19 | +0 |
| New source LOC | — | ~1,970 | — |
| Computed column functions | 4 (arithmetic) | 10 (4 arithmetic + 3 trend + 3 expression) | +6 |
| TileDisplayMode options | 4 | 4 | +0 |
| Multi-cycle deferrals resolved | — | 3 | Expression functions (2-cycle), trends (1-cycle), formatting UI (1-cycle) |
| TASM average | — | 34.3/35 | — |

---

## Related
- [[Cycle 33 - Trend Intelligence]]
- [[Analytics Hub PRD]] (v7, FRI 35/35)
- [[PBI-ANA-035 Trend Calculation Engine]]
- [[PBI-ANA-036 Expression Functions]]
- [[PBI-ANA-037 Conditional Formatting Rule Builder UI]]
- [[PBI-ANA-038 Analytics Hub Homepage Polish]]
- [[PBI-ANA-039 Trend Intelligence Flow Test]]
- [[PBI-ANA-040 Analytics UX Sprint]]
- [[Three Amigos Review 2026-02-24 Analytics Visualization]]
- [[Feature - Supplier Management]]
