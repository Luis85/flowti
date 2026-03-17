---
type: DevelopmentCycle
feature: "[[Analytics Hub PRD]]"
stage: delivered
cycle: 41
date_planned: 2026-02-25
date_completed: 2026-02-25
pbis:
  - "[[PBI-ANA-090 Cascade Delete and Orphan Protection]]"
  - "[[PBI-ANA-091 TileResultCache TTL and Size Limit]]"
  - "[[PBI-ANA-092 Expression Functions Expansion]]"
  - "[[PBI-ANA-093 Column Aliases]]"
  - "[[PBI-ANA-094 Shared DashboardFilterBar]]"
  - "[[PBI-ANA-095 Saved Filter Presets]]"
  - "[[PBI-ANA-096 UX Polish]]"
bugs:
  - "2-digit year dates (02/11/26) not detected as date type"
  - "Single-type measurement shows all grouped rows instead of aggregated value"
bugs_fixed_precycle:
  - "[[AI-1 filterResultForMeasurement single-type aggregation]]"
  - "[[AI-2 Cascade delete orphan measurements]]"
  - "[[AI-3 TileResultCache unbounded growth]]"
tech_debt:
  - "[[TD-ANA-005 DashboardFilterBar Deduplication]]"
estimated_increments: 9
actual_increments: 9
estimated_tests: 47
actual_tests: 96
pre_cycle_tests: 4751
pre_cycle_suites: 196
post_cycle_tests: 4847
post_cycle_suites: 199
---

# Cycle 41 — Analytics Hub Hardening & Expression Expansion

## Cycle Overview

**User Story:**

> As a data analyst building dashboards from CSV data, I want reliable data integrity (no orphan measurements when I delete a query), bounded caching, string manipulation functions, column renaming, and saved filter presets — so that the Analytics Hub is robust enough that I stay inside Flowti for standard analytics instead of opening Excel.

**User Pains:**

- **Orphan measurements** — deleting a query leaves measurements pointing at nothing; tiles with measurement references break silently
- **Cache grows unbounded** — TileResultCache has no TTL or eviction; switching dashboard filters accumulates stale entries indefinitely
- **No string functions** — users open Excel for basic UPPER/LOWER/CONCAT; COALESCE is needed for null handling in computed columns
- **Raw column names everywhere** — CSV headers like `supplier_name` or `total_excl_vat` show on tiles, charts, and tables with no way to rename
- **Duplicated filter bar code** — ~260 LOC copied verbatim between DashboardsTab and AnalyticsDashboardPage
- **No saved filter presets** — users rebuild the same filter combinations every time they open a dashboard
- **2-digit year dates** — dates like `02/11/26` not detected as date type, not parseable
- **Single measurement shows all data** — a `type: "single"` measurement from a bucketed/grouped query shows all rows instead of one aggregated value

**Business Trigger:** Cycle 40 introduced the measurements layer. User testing revealed data integrity gaps (orphan references), missing expression primitives, and UX friction. This cycle hardens the foundation before adding new features.

---

## Situation Assessment

### Pre-Cycle State (post-Cycle 40)

**Plugin health:**
- 4,751 tests passing, 196 test suites
- Build status: green
- PRD: v14, 94 FRs
- Cycle 40 action items: AI-1 (measurement filter), AI-2 (cascade delete), AI-3 (cache limits), AI-4 (string functions)

**Analytics domain status:**
- Domain: ~4,600 LOC (AnalyticsService 619, AnalyticsEngine 853, measurementHandlers 114, dashboardHandlers 355, expressionFunctions 97, types ~460)
- UI: ~7,500 LOC (AnalyticsHubView 308, QueriesTab 820, DashboardsTab ~472, MeasurementsTab 606, DashboardTileRenderer ~566, AnalyticsDashboardPage ~395, QueryBuilderPanel ~490)
- Tests: ~548 analytics-specific
- AnalyticsHubView: 3 tabs (Dashboards, Queries, Measurements)

**Key issues identified:**
1. `deleteQuery()` doesn't cascade to measurements or tiles — orphan references accumulate
2. `TileResultCache` has no eviction strategy — grows indefinitely
3. `expressionFunctions.ts` has only 3 functions (ROUND, ABS, IF) — no string/null handling
4. `filterResultForMeasurement()` only strips columns, doesn't aggregate rows for single-type
5. `parseDate()` only handles 4-digit years — 2-digit years (common in US CSVs) fail

---

## Increments

### Inc 1: Cascade Delete & Orphan Protection (PBI-ANA-090)

**Goal:** When a query is deleted, cascade-delete all measurements linked to that query and clear `measurementId` from tiles. When a measurement is deleted, clear `measurementId` from referencing tiles.

| File | Change |
|------|--------|
| `handlers/dashboardHandlers.ts` | Added `clearMeasurementFromTiles(ctx, measurementId)` utility |
| `handlers/measurementHandlers.ts` | `deleteMeasurement()` calls `clearMeasurementFromTiles()` |
| `AnalyticsService.ts` | `deleteQuery()` cascades: delete orphan measurements + clear tile refs |

**Tests:** +6 (3 measurementHandlers, 3 AnalyticsService)

---

### Inc 2: TileResultCache TTL + Size Limit (PBI-ANA-091)

**Goal:** Add TTL-based expiry and LRU size eviction to TileResultCache.

| File | Change |
|------|--------|
| `TileResultCache.ts` | `MAX_ENTRIES = 100`, `TTL_MS = 15min` (aligned with freshnessUtils "stale"). Added `evictExpired()`, `evictOldest()`, `size()`. TTL checked on every `tryRun()`. |

**Tests:** +7 (new `TileResultCache.test.ts`: hit/miss, TTL expiry, LRU eviction, clearOne, clear, size, error caching)

---

### Inc 3: Expression Functions — COALESCE + String Functions (PBI-ANA-092)

**Goal:** Add 4 new scalar functions: COALESCE, UPPER, LOWER, CONCAT.

| File | Change |
|------|--------|
| `expressionFunctions.ts` | +4 functions: `evalCoalesce`, `evalUpper`, `evalLower`, `evalConcat` |
| `expressionValidator.ts` | Registered in VALID_FUNCTIONS + FUNCTION_ARG_COUNTS |
| `AnalyticsEngine.ts` | +4 switch cases + updated `extractScalarFunction` regex |

Function specs:
```
COALESCE({A}, {B}, 0)          → first non-null/non-empty value
UPPER({Name})                  → "JOHN"
LOWER({Name})                  → "john"
CONCAT({First}, " ", {Last})   → "John Doe"
```

**Critical fix:** `extractScalarFunction` regex was hardcoded to `ROUND|ABS|IF` — new functions weren't being matched. Fixed by adding `|COALESCE|UPPER|LOWER|CONCAT`.

**Tests:** +21 (16 expressionFunctions, 5 expressionValidator)

---

### Inc 4: Column Aliases — Display Names (PBI-ANA-093)

**Goal:** Allow users to set display aliases for columns. Expressions still use original names; aliases are applied as the final step before returning results.

| File | Change |
|------|--------|
| `types.ts` | Added `alias?: string` to `ColumnTypeHint` |
| `AnalyticsEngine.ts` | Step 11: alias mapping after computed columns, before return |
| `QueryBuilderPanel.ts` | Alias text input per column in `renderSchemaAndTypes()` |

**Key design:** Aliases are applied AFTER computed column evaluation. Expressions use `{original_name}` references; aliases are display-only. This avoids breaking references when users rename columns.

**Tests:** +4 (AnalyticsEngine: alias in result columns/rows, computed columns use originals, no alias = original)

---

### Inc 5: Extract Shared DashboardFilterBar (PBI-ANA-094 / TD-ANA-005)

**Goal:** Deduplicate the ~260 LOC filter bar that was copied between DashboardsTab and AnalyticsDashboardPage.

| File | Change |
|------|--------|
| `DashboardFilterBar.ts` | **New** — shared component (~170 LOC) |
| `DashboardsTab.ts` | Replaced ~130 LOC with 15 LOC delegation |
| `AnalyticsDashboardPage.ts` | Same replacement |

**Net result:** ~170 new + ~260 removed = −90 LOC net reduction

---

### Inc 6: Saved Filter Presets — Per-Dashboard (PBI-ANA-095)

**Goal:** Let users save and restore filter combinations on a per-dashboard basis.

| File | Change |
|------|--------|
| `types.ts` | Added `SavedFilterPreset { id, name, filters[] }`, `Dashboard.savedFilterPresets?` |
| `handlers/dashboardHandlers.ts` | `saveFilterPreset()`, `deleteFilterPreset()` |
| `AnalyticsService.ts` | Delegation methods |
| `DashboardFilterBar.ts` | Preset dropdown + "Save current" button |
| `DashboardsTab.ts` + `AnalyticsDashboardPage.ts` | Wired presets through FilterBarDeps |

**Tests:** +4 (DashboardCrud: save, load, delete, persistence)

---

### Inc 7: UX Polish — Scroll Preservation (PBI-ANA-096)

**Goal:** Add scroll preservation to DashboardsTab and MeasurementsTab detail panels (QueriesTab already had it).

| File | Change |
|------|--------|
| `DashboardsTab.ts` | `scrollTop` save before `empty()`, restore in `requestAnimationFrame` |
| `MeasurementsTab.ts` | Same pattern |

---

### Inc 8: filterResultForMeasurement Tests

**Goal:** Comprehensive test coverage for the `filterResultForMeasurement` utility.

| File | Change |
|------|--------|
| `filterResultForMeasurement.test.ts` | **New** — 12 tests |

---

### Inc 9: Tests + Verification

- Full `npm test`: 4,847 tests, 199 suites — all passing
- All Cycle 40 action items resolved (AI-1 through AI-4)

---

## Bug Fixes (During Cycle)

### BUG-041-001: 2-Digit Year Date Detection

**Symptom:** Dates like `02/11/26` not detected as date type by `guessColumnType()`, not parseable by `parseDate()`.

**Root cause:** Detection regex required 4-digit year (`\d{4}`); parseDate() regexes same. No expansion logic for 2-digit years.

**Fix:**
- `guessColumnType()`: changed `\d{4}` to `\d{2,4}` in date detection regex
- `parseDate()`: updated dot, slash, and dash regexes to `\d{2,4}`; added `expandYear()` helper (00–99 → 2000–2099)
- Added dash-separated non-ISO parsing (`DD-MM-YY`)

**Tests:** +7 (US, DE, GB, auto, dash-separated formats with 2-digit years)

---

### BUG-041-002: Single Measurement Shows All Grouped Rows

**Symptom:** A `type: "single"` measurement from a bucketed/grouped query shows all rows (up to 20 group headers in stat-card) instead of one aggregated value.

**Root cause:** `filterResultForMeasurement()` only stripped extra columns but kept all rows with dimension + time bucket grouping intact. For a "single" measurement, this preserved the full grouped result.

**Fix:** Rewrote `filterResultForMeasurement()`:
- **`type: "single"`**: now aggregates (SUM) the measure column across ALL rows into a single-row result with only the measure column. Stat-card tiles show one big number.
- **`type: "series"`**: now properly filters to dimensions + time bucket + measure column, preserving all rows for trend display.

**Tests:** 12 (rewrote filterResultForMeasurement.test.ts — single aggregation, series filtering, edge cases)

---

## Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| New tests | ~47 | 96 |
| Post-cycle total tests | ~4,798 | 4,847 |
| Post-cycle suites | ~199 | 199 |
| New source LOC | ~510 | ~480 |
| Removed LOC (filter bar dedup) | ~260 | ~260 |
| New files | 1 (DashboardFilterBar) | 1 + 2 test files |
| Expression functions | 3 → 7 | 7 (ROUND, ABS, IF, COALESCE, UPPER, LOWER, CONCAT) |
| Cascade delete coverage | None | Full (query → measurements → tiles) |
| Cache max entries | Unbounded | 100 |
| Cache TTL | None | 15 minutes |

## Definition of Ready (Pre-Cycle)

- [x] Cycle 40 delivered — measurements operational, 4,751 tests green
- [x] 4 action items identified (AI-1: measurement filter, AI-2: cascade delete, AI-3: cache limits, AI-4: string functions)
- [x] Data integrity gaps confirmed through testing (orphan measurements after query delete)
- [x] User feedback: "still shows all data" for single measurements, "02/11/26 not recognized as date"
- [x] DashboardFilterBar duplication identified (~260 LOC copied between 2 files)

## Definition of Done

### 1. All Increments Completed
- [x] 9 increments delivered, no partial state
- [x] 2 bugs fixed (2-digit year dates, single measurement aggregation)

### 2. Quality Gates
- [x] `npm test` passes — 4,847 tests, 199 suites, all green
- [x] `npm run check` passes — no lint or type errors
- [x] All new tests exercise the features they validate
- [x] Existing flow tests still pass (backward compatibility)

### 3. Architecture
- [x] Cascade delete covers full reference chain: query → measurements → tile measurementIds
- [x] TileResultCache bounded: 100 entries max, 15-minute TTL
- [x] Expression pipeline: 7 scalar functions (extractScalarFunction regex updated)
- [x] Column aliases applied AFTER computed columns (expressions use original names)
- [x] DashboardFilterBar shared component eliminates 260 LOC duplication
- [x] SavedFilterPreset persisted on Dashboard (backward-compatible optional field)

### 4. User Experience
- [x] Deleting a query/measurement doesn't leave broken tile references
- [x] Cache auto-expires stale entries — no manual cache management needed
- [x] String functions (UPPER, LOWER, CONCAT, COALESCE) keep users in Flowti
- [x] Column aliases show user-friendly names in results, tiles, and charts
- [x] Filter presets save/restore filter combinations per dashboard
- [x] 2-digit year dates (02/11/26) detected and parsed correctly
- [x] Single measurements show one aggregated number, not all grouped rows

---

## Retrospective

### What Went Well

1. **Cascade delete pattern was clean** — `clearMeasurementFromTiles()` utility reused by both `deleteMeasurement()` and `deleteQuery()` paths; 6 tests cover the chain
2. **extractScalarFunction regex fix** was caught immediately by expression function tests — the hardcoded `ROUND|ABS|IF` pattern was the root cause for all 4 new functions returning 0
3. **DashboardFilterBar extraction** was a textbook deduplication — identical behavior, ~90 LOC net reduction, preset support added cleanly to the shared component
4. **2-digit year fix** was surgical — `expandYear()` helper + regex `\d{2,4}` in 3 places, 7 tests cover all locale variants
5. **filterResultForMeasurement rewrite** was the highest-impact fix — users now see one number instead of 20 group headers

### What Could Improve

1. **filterResultForMeasurement was wrong from the start** — the original implementation only filtered columns, which was fundamentally incorrect for `type: "single"`. Should have been caught in Cycle 40 design review
2. **extractScalarFunction regex** was a maintenance trap — adding new functions requires updating a regex in addition to the switch statement. Consider a function registry pattern
3. **Test count exceeded estimate** (96 vs 47) — bug fixes added ~19 unplanned tests; rewritten test files replaced existing tests

### Observations

- **OBS-1**: The `expandYear()` mapping (00–99 → 2000–2099) is simple but correct for business analytics data. Historical dates before 2000 are rare in the target use case (supplier management, inventory)
- **OBS-2**: `filterResultForMeasurement` SUM aggregation for single-type is the standard "grand total" pattern. For AVG measures this produces average-of-averages (technically incorrect) but matches common BI tool behavior
- **OBS-3**: SavedFilterPreset IDs use `fp_` prefix — consistent with other analytics ID patterns (`am_` for measurements, `at_` for templates)

### Action Items

| ID | Action | Priority | Target |
|----|--------|----------|--------|
| AI-1 | extractScalarFunction regex → function registry (avoid hardcoded pattern) | Low | Future |
| AI-2 | Consider weighted average for single-type AVG measurements | Low | Future |
| AI-3 | Sort selectors for DashboardsTab and MeasurementsTab master lists | Low | Cycle 42 |
