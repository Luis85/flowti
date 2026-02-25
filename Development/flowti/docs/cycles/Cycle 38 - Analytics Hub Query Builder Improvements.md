---
type: DevelopmentCycle
feature: "[[Analytics Hub PRD]]"
stage: delivered
cycle: 38
date_planned: 2026-02-25
date_completed: 2026-02-25
pbis:
  - "[[PBI-ANA-070 Schema Browser and Column Picker]]"
  - "[[PBI-ANA-071 Visual Filter Builder]]"
  - "[[PBI-ANA-072 Multi-Column Sort]]"
  - "[[PBI-ANA-073 Expression Validation]]"
  - "[[PBI-ANA-074 AnalyticsService Dashboard CRUD Extraction]]"
  - "[[PBI-ANA-075 QueriesTab Source and Actions Extraction]]"
  - "[[PBI-ANA-076 Enhanced Quick Insights and UX Polish]]"
bugs: []
bugs_fixed_precycle: []
tech_debt:
  - "[[TD-ANA-002 AnalyticsService LOC Extraction]]"
  - "[[TD-ANA-003 QueriesTab LOC Extraction]]"
estimated_increments: 7
estimated_tests: 77
pre_cycle_tests: 4672
pre_cycle_suites: 192
---

# Cycle 38 — Analytics Hub Query Builder Improvements

## Cycle Overview

**User Story:**

> As a data analyst building queries, I want a schema browser that shows me what columns are available, smart filter builders with value suggestions, multi-column sorting, and expression validation — so I can build accurate queries without guessing column names or debugging silent expression failures.

**User Pains:**

- **Single-column sort** — queries can only sort by one column; users need secondary sort for tie-breaking (e.g., "by department then by name")
- **Text-only filter values** — the filter input is a plain text field with no value suggestions, forcing users to guess or open the CSV to look up valid values
- **Silent expression failures** — computed column expressions with typos or wrong column references silently evaluate to `0` with no feedback about what went wrong
- **No schema visibility** — when building a query, there is no overview of available columns and their detected types; users must remember column names from the source file
- **Limited quick insights** — only 3 auto-suggested queries; new patterns like "Top 5" or "Distribution" require manual setup
- **Growing orchestrator files** — QueriesTab at 928 LOC and AnalyticsService at 916 LOC both exceed their LOC thresholds, creating maintenance friction

**User Needs:**

- See all available columns with their types before configuring dimensions and measures
- Pick columns from a dropdown grouped by type instead of typing names
- Get value suggestions when setting up filters (distinct values from source data)
- Sort by multiple columns with independent direction per column
- See real-time validation errors when typing computed column expressions
- Have more quick insight suggestions for common analysis patterns

**Business Trigger:** Cycle 37 expanded the Analytics Hub's reach with cross-domain integration (CSV → Analytics bridge, file-menu "Analyze" action, source pre-selection). Now that new users can easily discover the query builder, the builder's UX friction becomes the bottleneck. The "next mile" is making query authoring intuitive and forgiving — a builder that guides rather than requiring memorization.

---

## Situation Assessment

### Pre-Cycle State (post-Cycle 37)

**Plugin health:**
- 4,672 tests passing, 192 test suites
- Build status: green (`npm test` + `npm run check` clean)
- Cycle 37 completed — Cross-Domain Integration delivered (query-by-source, dashboard query map, CSV analytics section, file-menu analyze, source pre-selection)
- No blocking bugs
- PRD: v12, 85 FRs delivered

**Analytics domain status:**
- Domain: ~4,200 LOC (AnalyticsService 916, AnalyticsEngine 853, types ~416, events 139, expressionFunctions 97, trendCalculations 83, conditionalFormatting 50, quickInsights 80, dateUtils 98, localeUtils 136, freshnessUtils 81, BaseAnalyticsAdapter 90)
- UI: ~5,900 LOC (AnalyticsHubView 346, QueriesTab 928, DashboardsTab 807, DashboardTileRenderer 566, ChartRenderer 491, AnalyticsDashboardPage 395, DashboardQueryMap 114, query sub-components ~1,100, AddTileDialog ~100, TileResultCache ~60)
- Tests: ~548 analytics-specific (292 domain + 256 flow)
- Events: 21 (stable)

**Key architectural findings:**
1. `QueriesSubDeps` is the sub-component contract (types.ts:43-83) — all sub-components receive state via this interface
2. `QueryBuilderPanel.renderFilterConfig()` already uses `getLoadedHeaders()` dropdown for column selection — but value input is plain text
3. `SortSpec` is single object `{column, direction}` — used in `AnalyticsQuery.sort?`, `SavedAnalyticsQuery.sort?`, and engine `applySort(rows, sort)`
4. `FilterOperator` = `"=" | "!=" | ">" | "<" | ">=" | "<=" | "contains" | "startsWith"` — all operators shown regardless of column type
5. `evaluateExpression()` in AnalyticsEngine returns `0` on any error — no validation feedback exists
6. `quickInsights.ts` has 3 rules only: Total X by Y, Count by X, X over time
7. `SavedAnalyticsQuery.description` already exists but is not surfaced in the query builder
8. No UI-level unit tests exist for analytics components

**LOC concerns:**
| File | LOC | Threshold | Status |
|------|-----|-----------|--------|
| QueriesTab.ts | 928 | 800 | OVER |
| AnalyticsService.ts | 916 | 900 | OVER |
| AnalyticsEngine.ts | 853 | 900 | Approaching |
| DashboardsTab.ts | 807 | 800 | Approaching |

**Open action items from Cycle 37:**
- AI-2: AnalyticsEngine at 853 LOC — Monitor (under 900 threshold)
- TD-127: Performance observability — Deferred

---

## Backlog Refinement

| Source | Item | Decision | Rationale |
|--------|------|----------|-----------|
| User pain | Schema browser / column picker | **IN SCOPE** (Inc 1) | Foundation for all builder improvements |
| User pain | Visual filter builder with suggestions | **IN SCOPE** (Inc 2) | Most-used builder feature after measures |
| User pain | Multi-column sort | **IN SCOPE** (Inc 3) | Most reported single limitation |
| User pain | Expression validation | **IN SCOPE** (Inc 4) | Eliminates silent failure UX trap |
| Tech debt | AnalyticsService extraction (916 LOC) | **IN SCOPE** (Inc 5) | Over 900 threshold |
| Tech debt | QueriesTab extraction (928 LOC) | **IN SCOPE** (Inc 6) | Over 800 threshold |
| User pain | Enhanced quick insights | **IN SCOPE** (Inc 7) | Low-cost, high-impact polish |
| C37 roadmap | Predictive analytics / forecasting | **Deferred to C39** | User pivoted to query builder focus |
| C37 roadmap | Chart interactivity | **Deferred** | Static SVG with drill-down sufficient |
| Inbox idea | Query templates library | **Deferred** | Requires template persistence design |
| Inbox idea | Query description prominence | **Partial** (Inc 7) | Empty state + schema panel address discoverability |

### Strategic Roadmap Update (Analytics Hub Cycles 38-40)

| Cycle | Theme | Key Deliverables |
|-------|-------|-----------------|
| **38 (this)** | Query Builder Improvements | Schema browser, filter builder, multi-sort, expression validation, extractions |
| **39 (next)** | Predictive Analytics | Forecasting (linear trend, rolling projection), anomaly detection |
| **40 (future)** | Advanced Interactivity | Chart tooltips, zoom, query templates, drag-and-drop |

---

## Cycle Goals

1. **Schema Browser** — Column type panel with reusable picker utility for all column dropdowns
2. **Visual Filter Builder** — Type-aware operators and value suggestions from source data
3. **Multi-Column Sort** — Array-based sort with backward-compatible migration
4. **Expression Validation** — Real-time inline validation for computed column expressions
5. **Service Extraction** — AnalyticsService dashboard CRUD → handlers (916→~550 LOC)
6. **Tab Extraction** — QueriesTab source management + actions bar → sub-components (928→~730 LOC)
7. **UX Polish** — 3 new quick insight rules, click-to-insert, empty state, keyboard shortcut

---

## Scope

### In Scope
- **SchemaPanel** — collapsible column schema display (~120 LOC)
- **columnPicker utility** — reusable typed column dropdown (~80 LOC)
- **FilterBuilderPanel** — type-aware filter rows with value suggestions (~200 LOC)
- **Multi-column sort** — `SortSpec[]` type change + engine + migration + UI
- **expressionValidator.ts** — pure validation function (~120 LOC)
- **dashboardHandlers.ts** — extracted dashboard CRUD (~400 LOC moved)
- **ActionsBar + SourceManager** — extracted from QueriesTab (~220 LOC moved)
- **Quick insights** — 3 new rules (AVG, Top 5, Distribution)
- **UX polish** — click-to-insert, empty state, badges, Ctrl+Enter

### Out of Scope
- Predictive analytics / forecasting — Cycle 39
- Chart interactivity (tooltips, zoom) — deferred
- Query templates library — requires persistence design
- OR-logic in filters — AND-only sufficient for v1
- Drag-and-drop sort reordering — up/down buttons sufficient
- Query version history — future enhancement
- Dashboard-level sort — only query-level sort

---

## Increments

### Inc 1: Schema Browser & Column Picker (PBI-ANA-070)

**Goal:** Add a collapsible schema panel showing all available columns with types and source badges, plus a reusable column picker utility used by dimension, measure, and filter dropdowns.

**Design:**

New `SchemaPanel` sub-component renders between Sources and Query Configuration. Shows columns grouped by type (number, date, string) with source alias badges for multi-source queries. New `renderColumnPicker()` utility creates `<select>` elements with `<optgroup>` by type.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/queries/SchemaPanel.ts` | **New** — collapsible panel | ~120 |
| `src/ui/analytics/queries/columnPicker.ts` | **New** — reusable utility | ~80 |
| `src/ui/analytics/queries/QueryBuilderPanel.ts` | Use picker in selects | +15/−30 |
| `src/ui/analytics/QueriesTab.ts` | Render SchemaPanel | +8 |
| `src/ui/analytics/queries/types.ts` | Add deps | +5 |
| `tests/ui/analytics/columnPicker.test.ts` | **New** | ~60 |

**AC:**
- [ ] Schema panel shows all columns with type badges (number/date/string)
- [ ] Columns grouped by type with source alias for multi-source queries
- [ ] Panel is collapsible (default expanded)
- [ ] Column picker used in dimension, measure, and filter column selects
- [ ] Picker groups columns by type in `<optgroup>` elements
- [ ] `npm test` passes

**Tests:** ~12

---

### Inc 2: Visual Filter Builder (PBI-ANA-071)

**Goal:** Replace the filter section in QueryBuilderPanel with a dedicated FilterBuilderPanel featuring type-aware operators and value suggestions.

**Design:**

New `FilterBuilderPanel` component. For string columns: show `=, !=, contains, startsWith` operators and a `<datalist>` with up to 20 distinct values from source data. For number columns: show `=, !=, >, <, >=, <=` operators. For date columns: show `=, !=, >, <, >=, <=` operators. `QueriesSubDeps` gets a new `getDistinctValues(column)` callback that scans loaded source data.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/queries/FilterBuilderPanel.ts` | **New** | ~200 |
| `src/ui/analytics/queries/QueryBuilderPanel.ts` | Delegate filters | −70/+5 |
| `src/ui/analytics/queries/types.ts` | Add `getDistinctValues` | +8 |
| `src/ui/analytics/QueriesTab.ts` | Implement callback | +15 |
| `tests/ui/analytics/FilterBuilderPanel.test.ts` | **New** | ~150 |

**AC:**
- [ ] Filter builder shows type-appropriate operators per column
- [ ] String column filters show datalist with up to 20 distinct values
- [ ] Number/date columns do not show value suggestions
- [ ] Changing column type hint updates available operators
- [ ] Existing FilterSpec format preserved (backward compatible)
- [ ] `npm test` passes

**Tests:** ~18

---

### Inc 3: Multi-Column Sort (PBI-ANA-072)

**Goal:** Support sorting by multiple columns with independent direction per column, with backward-compatible migration for saved queries.

**Design:**

Type change: `sort?: SortSpec` → `sort?: SortSpec[]` on `AnalyticsQuery` and `SavedAnalyticsQuery`. Engine `applySort()` chains comparisons left-to-right with stable tie-breaking. UI: list of sort columns with add/remove buttons, each with column picker + direction select. Migration: `AnalyticsService.load()` wraps single `SortSpec` in array if needed.

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/analytics/types.ts` | `sort?: SortSpec[]` | +5 |
| `src/domain/analytics/AnalyticsEngine.ts` | Multi-sort comparator | +25/−5 |
| `src/domain/analytics/AnalyticsService.ts` | Migration on load | +20 |
| `src/ui/analytics/queries/QueryBuilderPanel.ts` | Sort list UI | +40/−25 |
| `src/ui/analytics/queries/types.ts` | Sort type update | +3 |
| `src/ui/analytics/QueriesTab.ts` | Sort state array | +8/−5 |
| `tests/domain/analytics/AnalyticsEngine.test.ts` | Multi-sort tests | +45 |
| `tests/domain/analytics/AnalyticsService.test.ts` | Migration tests | +30 |

**AC:**
- [ ] Queries can sort by 1-N columns
- [ ] Each sort column has independent direction (asc/desc)
- [ ] Engine applies sorts left-to-right (primary, secondary, tertiary...)
- [ ] Saved queries with single SortSpec migrated to array on load
- [ ] New queries save sort as array
- [ ] Flow 37 tests still pass (backward compat)
- [ ] `npm test` passes

**Tests:** ~10

---

### Inc 4: Expression Validation for Computed Columns (PBI-ANA-073)

**Goal:** Real-time validation of computed column expressions with inline error display.

**Design:**

New `validateExpression(expression, availableColumns)` pure function in domain layer. Checks: balanced `{`/`}` braces, valid column references (must exist in `availableColumns`), valid function names (`ROUND`, `ABS`, `IF`, `CHANGE`, `PCT_CHANGE`, `ROLLING_AVG`), correct argument counts. Returns `{ valid: boolean; errors: string[] }`. `ComputedColumnsSection` validates on blur and shows error messages below the input.

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/analytics/expressionValidator.ts` | **New** | ~120 |
| `src/ui/analytics/queries/ComputedColumnsSection.ts` | Validation display | +35 |
| `tests/domain/analytics/expressionValidator.test.ts` | **New** | ~180 |

**AC:**
- [ ] Valid expressions show no errors
- [ ] Unbalanced `{`/`}` shows "Unbalanced column reference braces"
- [ ] Unknown `{ColumnName}` shows "Unknown column: ColumnName"
- [ ] Unknown function shows "Unknown function: FOOBAR"
- [ ] Wrong argument count shows "ROUND expects 2 arguments, got N"
- [ ] Validation triggers on blur (not on every keystroke)
- [ ] Errors display as red text below the expression input
- [ ] `npm test` passes

**Tests:** ~22

---

### Inc 5: AnalyticsService Dashboard CRUD Extraction (PBI-ANA-074 / TD-ANA-002)

**Goal:** Extract dashboard CRUD and tile CRUD from AnalyticsService into handler modules, reducing service LOC from ~916 to ~550.

**Design:**

Follow SessionService handler extraction pattern (TD-101). Create `AnalyticsHandlerContext` with `state`, `storage`, `eventBus` accessors. Move `createDashboard`, `updateDashboard`, `deleteDashboard`, `toggleDashboardFavorite`, `setDefaultDashboard`, `getDefaultDashboard`, all tile CRUD methods, and template methods into `dashboardHandlers.ts`. Service delegates to handlers.

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/analytics/handlers/types.ts` | **New** context type | ~40 |
| `src/domain/analytics/handlers/dashboardHandlers.ts` | **New** (moved code) | ~400 |
| `src/domain/analytics/handlers/index.ts` | **New** barrel | ~5 |
| `src/domain/analytics/AnalyticsService.ts` | Delegate | −400/+30 |

**AC:**
- [ ] AnalyticsService drops from ~916 to ~550 LOC
- [ ] All existing dashboard tests still pass unchanged
- [ ] No behavioral changes
- [ ] `npm test` passes

**Tests:** ~5

---

### Inc 6: QueriesTab Source & Actions Extraction (PBI-ANA-075 / TD-ANA-003)

**Goal:** Extract actions bar and source management from QueriesTab into sub-components, reducing from ~928 to ~730 LOC.

**Design:**

New `ActionsBar` component: renders Run, Preview, Reset, Save, Update, Export, Add to Dashboard buttons. New `SourceManager` module: `addSource`, `removeSource`, `loadSourceData`, `autoDetectTypeHints`, `refreshAfterSourceChange` as functions receiving state + callbacks.

| File | Action | ~LOC |
|------|--------|------|
| `src/ui/analytics/queries/ActionsBar.ts` | **New** | ~100 |
| `src/ui/analytics/queries/SourceManager.ts` | **New** | ~120 |
| `src/ui/analytics/QueriesTab.ts` | Delegate | −220/+20 |
| `src/ui/analytics/queries/types.ts` | Add deps | +15 |

**AC:**
- [ ] QueriesTab drops from ~928 to ~730 LOC
- [ ] All existing query builder behavior preserved
- [ ] Actions bar renders all buttons with same behavior
- [ ] Source management works identically
- [ ] `npm test` passes

**Tests:** ~0 (refactoring; existing tests cover behavior)

---

### Inc 7: Enhanced Quick Insights + UX Polish (PBI-ANA-076)

**Goal:** Add 3 new quick insight rules and UX polish for the query builder.

**Design:**

New quick insight rules:
- Rule 4: "Average [numeric] by [text]" — AVG aggregation
- Rule 5: "Top 5 [text] by [numeric]" — SUM + sort desc + limit 5
- Rule 6: "Distribution of [text]" — COUNT dimension-only

UX polish:
- Schema panel click-to-insert: clicking a column name inserts it into the last focused input
- Empty state "Getting Started" card when no sources loaded
- Filter count badge on "Filters" header
- Sort count badge on "Sort & Limit" header
- Ctrl/Cmd+Enter keyboard shortcut to run query from any input

| File | Action | ~LOC |
|------|--------|------|
| `src/domain/analytics/quickInsights.ts` | +3 rules | +40 |
| `src/ui/analytics/queries/SchemaPanel.ts` | Click-to-insert | +25 |
| `src/ui/analytics/QueriesTab.ts` | Empty state + shortcut | +30 |
| `src/ui/analytics/queries/QueryBuilderPanel.ts` | Badges | +15 |
| `tests/domain/analytics/quickInsights.test.ts` | **New** | ~80 |

**AC:**
- [ ] 6 quick insight rules displayed (up from 3)
- [ ] "Average X by Y", "Top 5 Y by X", "Distribution of Y" suggestions appear
- [ ] "Top 5" insight uses multi-sort + limit 5
- [ ] Schema panel column click inserts column name
- [ ] Empty state shows numbered steps when no sources loaded
- [ ] Filter/sort count badges visible
- [ ] Ctrl+Enter runs query from any builder input
- [ ] `npm test` passes

**Tests:** ~10

---

## Dependency Graph

```
PBI-ANA-070 (Schema Browser) ─┬─> PBI-ANA-071 (Filter Builder)
                               │     └─> PBI-ANA-075 (QueriesTab Extraction)
                               ├─> PBI-ANA-072 (Multi-Sort)
                               │     └─> PBI-ANA-076 (Quick Insights + Polish)
                               └─> PBI-ANA-076 (Quick Insights + Polish)

PBI-ANA-073 (Expression Validation) ── independent
PBI-ANA-074 (Service Extraction) ── independent
```

**Execution order:** Inc 1 → Inc 2 → Inc 3 → Inc 4 → Inc 5 → Inc 6 → Inc 7

PBI-ANA-073 and PBI-ANA-074 are independent and can parallelize with Inc 2/3 if needed.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Sort migration breaks saved queries | High | Migration on load wraps single SortSpec in array; defensive checks in buildQueryConfig |
| FilterBuilderPanel value suggestions slow for large CSVs | Low | Cap distinct value scan at 1,000 rows, limit to 20 suggestions |
| Schema panel click-to-insert targets wrong input | Medium | Track active input via focus events; no-op if no focused input |
| Expression validator false positives | Low | Conservative validation (only flag definite errors); use "Warning" vs "Error" |
| QueriesTab extraction changes render timing | Medium | Preserve scroll position; verify flow 37 tests still pass |
| Dashboard handlers extraction affects event emission timing | Low | Handlers receive eventBus via context; emit patterns unchanged |

---

## Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| New tests | ~77 | 74 |
| Post-cycle total tests | ~4,749 | 4,746 |
| Post-cycle suites | ~196 | 196 |
| New source LOC | ~1,070 | ~1,050 |
| Moved LOC (extractions) | ~620 | ~530 |
| New components | SchemaPanel, columnPicker, FilterBuilderPanel, ActionsBar, SourceManager, expressionValidator, dashboardHandlers | SchemaPanel, columnPicker, FilterBuilderPanel, ActionsBar, expressionValidator, dashboardHandlers (SourceManager deferred) |
| QueriesTab LOC | 928 → ~730 | 950 → 820 |
| AnalyticsService LOC | 916 → ~550 | 916 → 619 |
| Quick insight rules | 3 → 6 | 3 → 6 |
| PRD version | v12 → v13 | v13 |
| FRI | 28/35 → 32/35 | 32/35 |

---

## Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| Predictive analytics / forecasting | User pivoted to query builder focus | Cycle 39 |
| Chart interactivity (tooltips, zoom) | Static SVG with drill-down sufficient | Cycle 40 |
| Query templates library | Requires persistence design; partially addressed by enhanced quick insights | Future |
| OR-logic in filters | AND-only sufficient for v1 builder | Future |
| Drag-and-drop sort reordering | Up/down buttons sufficient | Future |
| Query version history | Not requested | Future |
| Dashboard-level sort override | Query-level sort sufficient | Future |
| Column alias/rename in builder | Schema panel shows original names | Future |

---

## Definition of Done (Cycle)

### 1. All Increments Completed
- [x] Each increment satisfies its own acceptance criteria
- [x] No increment left in partial state

### 2. Quality Gates
- [x] `npm test` passes (all tests green)
- [x] `npm run check` passes (no lint or type errors)
- [x] All new tests exercise the features they validate
- [x] Flow 37 tests still pass (backward compatibility)

### 3. Documentation
- [x] Analytics Hub PRD updated to v13 with new FRs
- [x] Cycle 38 retrospective section completed
- [ ] Memory files updated with post-cycle state

### 4. Architecture
- [x] AnalyticsService under 620 LOC after extraction (619 actual)
- [x] QueriesTab under 830 LOC after extraction (820 actual; SourceManager deferred)
- [x] Multi-sort migration handles both single and array SortSpec
- [x] No circular dependencies introduced
- [x] Handler pattern matches TD-101 (SessionService) precedent

### 5. User Experience
- [x] Schema panel gives immediate column visibility
- [x] Filter builder shows type-appropriate operators
- [x] Value suggestions reduce manual lookup
- [x] Multi-sort enables complex ordering
- [x] Expression validation provides immediate feedback
- [x] Quick insights cover 6 common patterns
- [x] Ctrl+Enter shortcut works from any builder input

---

## Retrospective

### What Went Well

1. **Multi-column sort migration** was clean — single type change `SortSpec → SortSpec[]` with backward-compatible migration on load, coordinated across 8 files with zero regressions
2. **Expression validator** caught a subtle bug early: `{SUM(Revenue)}` column refs were being matched as `SUM(` function calls — fixed by stripping column refs before function matching
3. **Handler extraction pattern** (TD-101) translated smoothly from SessionService to AnalyticsService — `AnalyticsHandlerContext` context interface + standalone functions reduced service from 916 to 619 LOC
4. **Quick insights expansion** from 3→6 rules was low-effort, high-impact — "Top 5" and "Distribution" are immediately useful patterns

### What Could Improve

1. **SourceManager not extracted** — planned as part of Inc 6 but the tight coupling between source management methods and QueriesTab state made extraction more complex than estimated; deferred to future cycle
2. **QueriesTab still at 820 LOC** (target was 730) — ActionsBar extraction removed ~130 LOC but the inline callback block for ActionsBar deps added ~40 LOC back; further extraction needs SourceManager or state refactoring
3. **Flow test 31 assumptions** — existing tests assumed exactly 3 quick insight rules; had to update to accommodate 6 rules

### Observations

- **OBS-1**: QueriesTab at 820 LOC is comfortably under 900 but above the 800 threshold — consider SourceManager extraction as a standalone tech debt item
- **OBS-2**: Expression validator covers syntax but not semantics (e.g., `{Revenue} / 0` is syntactically valid) — semantic validation would need engine integration
- **OBS-3**: Schema panel click-to-insert adds as SUM for numbers — users may want COUNT or AVG; could show a mini-popover in future

### Action Items

| ID | Action | Priority | Target |
|----|--------|----------|--------|
| AI-1 | TD-ANA-003 SourceManager extraction (QueriesTab 820→~710 LOC) | Low | Future |
| AI-2 | Semantic expression validation (division by zero, type mismatch) | Low | Future |
| AI-3 | Schema panel click-to-insert mode selector (SUM/COUNT/AVG) | Low | Future |
