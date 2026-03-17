---
type: ThreeAmigosReview
date: 2026-02-23
feature: "[[Data Exchange Hub PRD]]"
scope: Cycle 27 delivery (Analytics Engine + Query Builder + Results View + Saved Queries)
verdict: pass
fri_before: 0
fri_after: 30
participants:
  - Business (Product Owner)
  - Development (Technical Architect)
  - QA (Test Lead)
tags:
  - review
  - data-exchange
  - analytics
---

# Three Amigos Review: Analytics Sprint — Cycle 27 Delivery

**Date:** 2026-02-23
**Scope:** Cycle 27 complete — In-memory CSV analytics engine with locale-aware parsing, visual query builder, sortable results view, saved queries with JSON file persistence, integration tests
**Previous Review:** [[Three Amigos Review 2026-02-23 Train Value Sprint]] (PASS, TASM 31/35)
**Current State:** FRI 30/35 (greenfield), 4,271 tests (176 suites), 4/4 PBIs delivered, 5/5 increments completed

---

## Verdict: PASS

All three perspectives agree: the Analytics Sprint delivers **transformative new capability** for the Data Exchange domain. Cycle 27 addressed the highest-demand inbox item — CSV analytics without leaving Obsidian. The analytics engine joins multiple CSV sources with locale-aware number/date parsing, groups by dimensions, and aggregates with SUM/COUNT/AVG/MIN/MAX. Combined delivery: 5 increments, 1,864 production LOC (1,058 domain + 806 UI), 163 new tests (157 domain/flow + 6 JSON persistence), 6 new domain files + 2 UI components. All existing 4,108 tests pass with no regressions. Post-cycle additions (JSON file persistence, join editor bug fix) demonstrate operational maturity.

---

## Business Perspective (Product Owner)

### Delivered Value Assessment

| Metric | Value |
|--------|-------|
| PBIs delivered | 4/4 (ANA-001, ANA-002, ANA-003, ANA-004) |
| New events | 5 (started, completed, failed, saved, deleted) |
| Inbox items addressed | 1 (primary: CSV dashboard/analytics capability) |
| Tests added | 163 |
| FRI score | 0 → 30/35 (greenfield domain) |

**Strengths:**
- **Client-ready on day one** — the two target questions ("cost per item/supplier by month" and "sales count per item/supplier by month") are answerable directly from the Analytics tab with the 3 US-locale CSV files
- **Locale-aware parsing** eliminates the #1 data quality risk — US numbers (`1,234.56`) and dates (`MM/DD/YYYY`) parse correctly without manual preprocessing
- **Saved queries** make recurring analysis repeatable — update the CSV, rerun the query, get fresh results
- **JSON file persistence** (post-plan addition) makes saved queries visible as vault artifacts — inspectable, version-controllable, shareable
- **Export as CSV** enables downstream delivery of aggregated results without external tools

**Gaps identified (deferred):**
1. "Import as Notes" from analytics results — deferred to Cycle 28 (tables + CSV export covers immediate need)
2. Delete confirmation modal — service-level delete works, UI confirmation deferred
3. Dashboard summary cards (PBI-ANA-005) — polish item for next cycle
4. Charts/visualizations — tables answer immediate questions; chart library is a larger investment

---

## Development Perspective (Technical Architect)

### Architecture Assessment

| Area | Rating | Notes |
|------|--------|-------|
| AnalyticsEngine | Excellent | 331 LOC, pure stateless class. Hash join O(n+m), inner + left join, 3-way chain. Clean separation of parsing → joining → grouping → aggregation. |
| localeUtils | Excellent | 136 LOC, 5 locale presets + auto-detect heuristic. Sample-based detection scans position of `.` vs `,` to infer thousands/decimal. |
| dateUtils | Excellent | 98 LOC, 3 format families (US/EU/ISO) + month/quarter/year bucketing. Pure functions with null returns for unparseable. |
| AnalyticsService | Good | 242 LOC (grew from ~120 estimate). Orchestrator: load CSV → execute engine → emit events → CRUD saved queries → JSON file persistence. `setReadCsv()` + `setQueryFolder()` late-bound pattern follows SignalService/SessionService precedent. |
| types.ts | Good | 205 LOC (grew from ~100 estimate). Thorough interface definitions for 11 types. Type IDs well-namespaced. |
| events.ts | Excellent | 46 LOC. 5 events with proper category, tags, description. Registered in catalog. |
| AnalyticsTab (UI) | Good | 806 LOC (grew from ~400 estimate). Single file handles query builder + saved query list + join editor + results display. Growth driven by locale picker, type hints UI, and saved query CRUD. |
| AnalyticsResultsPanel (UI) | Good | 166 LOC. Sortable table, stat cards, CSV export. Follows shared component pattern. |

**Architecture observations:**

1. **Pure-domain engine validated** — AnalyticsEngine has zero Obsidian dependencies. All locale parsing, joining, grouping, and aggregation is testable in isolation. 80 engine tests run in < 1 second.
2. **DXTab pattern scales** — 9th tab (Analytics) added to DataExchangeHubView with zero changes to BaseHubView. Tab bar accommodates the growth gracefully.
3. **Late-bound callback pattern mature** — `setReadCsv()` injection (same as SignalService adapter injection) decouples domain from infrastructure. Service works in tests without vault access.
4. **JSON file persistence follows CaptureService pattern** — `FileSystemClient.createFile(path, content, { createFolders: true })` with `sanitizeFileName()` for safe paths. Dual storage (state + file) gives both fast CRUD and user-visible artifacts.
5. **AnalyticsTab at 806 LOC** — above the 800 LOC monitoring threshold (OBS-1 from Cycle 24). Query builder, results panel, and saved query management are all in one file. Component extraction into `AnalyticsQueryBuilder`, `AnalyticsSavedQueryList` would improve maintainability.

**New files created:**

| File | LOC | Purpose |
|------|-----|---------|
| `src/domain/analytics/types.ts` | 205 | All type definitions (11 interfaces) |
| `src/domain/analytics/AnalyticsEngine.ts` | 331 | Join + group + aggregate engine |
| `src/domain/analytics/localeUtils.ts` | 136 | Number parsing + locale presets + auto-detect |
| `src/domain/analytics/dateUtils.ts` | 98 | Date parsing + bucketing |
| `src/domain/analytics/events.ts` | 46 | 5 event definitions |
| `src/domain/analytics/AnalyticsService.ts` | 242 | Service facade + persistence |
| `src/ui/hub/AnalyticsTab.ts` | 806 | Query builder + saved queries + results |
| `src/ui/hub/AnalyticsResultsPanel.ts` | 166 | Results table + stats + export |

**Tech debt created:**
- **TD candidate: AnalyticsTab 806 LOC** — monitor and consider extraction if it grows past 900 in the next analytics cycle (see OBS-1 below)

---

## QA Perspective (Test Lead)

### Coverage Summary

| Area | Tests | Notes |
|------|-------|-------|
| AnalyticsEngine | 80 | Join (inner, left, chain), grouping (1-3 dims), aggregation (5 functions), edge cases, performance |
| localeUtils | 25 | 5 locale presets, auto-detect, edge cases (empty, null, mixed) |
| dateUtils | 21 | 3 format families, bucketing (month/quarter/year), edge cases |
| AnalyticsService | 31 | CRUD, event emission, query execution, JSON file persistence (6 tests) |
| AnalyticsTab UI | — | Tested indirectly via service + flow tests; no dedicated UI unit tests (OBS-2) |
| AnalyticsResultsPanel UI | — | Tested indirectly via service + flow tests |
| Flow 25 integration | 27 | Full pipeline, time bucketing, saved queries, event sequence, end-to-end |
| **Total new** | **163** | **Exceeds 120 estimate (+36%)** |

### Increment TASM Progression

| Inc | Description | Tests | TASM |
|-----|-------------|-------|------|
| 1 | Analytics Engine Core | 80 | 34/35 |
| 2 | Domain Wiring | 25 | 33/35 |
| 3 | Query Builder UI | — (covered by Inc 5) | 32/35 |
| 4 | Results View + Export | — (covered by Inc 5) | 33/35 |
| 5 | Saved Queries + Integration | 58 (31 service + 27 flow) | 33/35 |

### Test Progression

| Milestone | Tests | Suites |
|-----------|-------|--------|
| Pre-Cycle 27 | 4,108 | 169 |
| Post-Cycle 27 | 4,271 | 176 |
| **Delta** | **+163** | **+7** |

### Coverage Gaps

1. **AnalyticsTab UI (806 LOC)** (Medium): No dedicated UI unit tests — rendering, interaction, and state management tested only indirectly via service tests and flow tests. Recommend adding ~20 UI tests in next analytics cycle.
2. **AnalyticsResultsPanel UI (166 LOC)** (Low): Sort interaction and stat card rendering untested at unit level. Mitigated by flow tests that verify end-to-end result correctness.
3. **Locale auto-detect ambiguity** (Low): Auto-detect heuristic handles common cases but ambiguous values (e.g., `1,234` — thousands or decimal?) have defined behavior. Edge case tests exist for this.
4. **Large CSV performance** (Low): 10k-row performance test exists and passes (< 2 seconds). No test for 50k+ rows. Accept for now — profile before optimizing.

### Test Quality

- **Pure-domain testing**: 80 engine tests run without Obsidian stubs — fastest test suite in the project
- **Locale coverage**: Every locale preset has dedicated tests for both number and date parsing
- **Mock isolation**: `createMockStorage<DataExchangeState>` provides isolated persistence per test
- **Flow test comprehensiveness**: 27 integration tests cover the complete pipeline from CSV loading to result verification
- **File persistence tests**: 6 dedicated tests for JSON file write/delete including sanitization and error handling

---

## Consolidated Observations

### OBS-1: AnalyticsTab at 806 LOC — Monitor for Extraction
**Owner:** Technical Architect
**Priority:** Medium
**Action:** Grew from 400 estimate to 806 LOC. Combines query builder, saved query list, join editor, results display, and locale/type-hint configuration. If next analytics cycle adds charts, calculated columns, or query history, extraction into `AnalyticsQueryBuilder` + `AnalyticsSavedQueryList` components should be prioritized. Threshold: extract at 900+ LOC.

### OBS-2: No Dedicated UI Unit Tests for Analytics Components
**Owner:** QA
**Priority:** Medium
**Action:** AnalyticsTab and AnalyticsResultsPanel have no dedicated UI unit tests. All coverage comes from service-level and flow integration tests. Recommend ~20 UI tests (tab rendering, source picker interaction, join editor column updates, saved query list, sort interaction) in next analytics-focused cycle.

### OBS-3: Source and Test LOC Exceeded Estimates
**Owner:** Development
**Priority:** Informational
**Action:** Domain LOC 1,058 vs 650 estimate (+63%), UI LOC 972 vs 750 (+30%), tests 163 vs 120 (+36%). Types file (205 LOC) and locale utilities (136+98 LOC) drove domain growth. Consistent with prior observation (Cycle 24 OBS-3) — apply 1.5x multiplier for domain estimates with locale/parsing components.

### OBS-4: "Import as Notes" Deferred
**Owner:** Business
**Priority:** Low
**Action:** PBI-ANA-003 AC item "Import as Notes creates notes from result rows" was deferred. Tables + CSV export covers the immediate business need. Track for Cycle 28 if user demand materializes.

---

## Action Items

| # | Action | Owner | Target | Status |
|---|--------|-------|--------|--------|
| 1 | Add ~20 UI unit tests for AnalyticsTab + ResultsPanel | QA | Next analytics cycle | Open |
| 2 | Monitor AnalyticsTab LOC (806) — extract at 900+ | Architect | Ongoing | Open |
| 3 | Track "Import as Notes" from results for future cycle | Business | Backlog | Open |
| 4 | Apply 1.5x LOC multiplier for locale/parsing domain estimates | All | Next cycle | Open |
| 5 | Consider delete confirmation modal for saved queries | UX | Next analytics cycle | Open |

---

## Metrics Snapshot

| Metric | Pre-Cycle 27 | Post-Cycle 27 | Delta |
|--------|-------------|---------------|-------|
| Tests total | 4,108 | 4,271 | +163 |
| Test suites | 169 | 176 | +7 |
| DX domain LOC | ~2,500 | ~3,558 | +1,058 |
| DX UI LOC | ~3,200 | ~4,172 | +972 |
| DX events | 9 | 14 | +5 |
| DX Hub tabs | 8 | 9 | +1 (Analytics) |
| Locale presets | 0 | 5 | +5 (en-US, de-DE, en-GB, nl-NL, fr-FR) |
| Saved query support | — | JSON file + state persistence | New |
| Analytics PBIs | 0 | 4 delivered | +4 |

---

## TASM Scoring Summary

```yaml
tasm:
  product_value_clarity: 5  # Direct client need addressed. 2/2 business questions answerable from day one. Locale-aware parsing eliminates #1 data quality risk. JSON file persistence adds vault-native artifact visibility.
  architectural_integrity: 5  # Pure stateless engine, DDD domain isolation, DXTab pattern reuse, late-bound callback injection, dual storage (state + file). Zero Obsidian dependencies in engine.
  event_discipline: 4  # 5 new events well-categorized and registered. Event lifecycle (started→completed/failed) follows established pattern. -1: no event for locale auto-detect result or column type hint changes.
  data_model_integrity: 5  # 11 well-typed interfaces. SourceLocale + ColumnTypeHint + SavedAnalyticsQuery fully typed. Backward-compatible DataExchangeState extension (optional array). sanitizeFileName() for safe file paths.
  ux_flow_quality: 4  # Visual query builder covers full workflow. Locale picker + type badges + join editor functional. -1: no delete confirmation modal, no dedicated UI tests to catch interaction regressions.
  performance_scalability: 4  # Hash join O(n+m), 10k rows in < 2 seconds. -1: synchronous execution on UI thread; no Web Worker for 50k+ row CSVs.
  documentation_discipline: 4  # Cycle doc, PRD updated, PBIs updated, review written, test data CSVs created. -1: no user-facing flow doc for Analytics workflow (inline help only).
  total: 31
  max: 35
  health_level: excellent
```

---

## Related

- [[Data Exchange Hub PRD]] (updated with analytics section, FRI 30/35)
- [[Cycle 27 - Analytics Sprint]] (delivered, 5 increments)
- [[PBI-ANA-001 Analytics Engine Core]] (stage: done)
- [[PBI-ANA-002 Analytics Query Builder UI]] (stage: done)
- [[PBI-ANA-003 Analytics Results View]] (stage: done)
- [[PBI-ANA-004 Saved Analytics Queries]] (stage: done)
- [[Three Amigos Review 2026-02-23 Train Value Sprint]] — prior review
