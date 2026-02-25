---
type: DevelopmentCycle
feature: "[[Analytics Hub PRD]]"
stage: delivered
cycle: 39
date_planned: 2026-02-25
date_completed: 2026-02-25
pbis:
  - "[[BUG-039-001 Currency and Date Type Detection]]"
  - "[[BUG-039-002 CSV Detail Callout and Report Type Persistence]]"
  - "[[BUG-039-003 Duplicate Export CSV and Refresh All]]"
  - "[[FEAT-039-001 Analyze Button on Reports Page]]"
bugs:
  - "Currency values ($22,543.65) detected as string instead of number"
  - "Dates like 2/3/2025 detected as string instead of date"
  - "CSV detail page callout not updating after doc creation"
  - "Report Type not persisting in UI after save"
  - "Duplicate Export CSV button in query results"
  - "Missing Refresh All button on homepage dashboard"
bugs_fixed_precycle: []
tech_debt: []
estimated_increments: 5
estimated_tests: 8
pre_cycle_tests: 4746
pre_cycle_suites: 196
---

# Cycle 39 — Data Robustness & UX Fixes

## Cycle Overview

Post-Cycle 38, user testing with real sales data revealed 6 bugs and 2 feature requests. This cycle addresses all 8 issues with targeted fixes — no new domains or architecture changes.

## Increments

### Inc 1: Currency & Date Type Detection Fix (BUG-039-001)
- **Root cause**: `guessColumnType()` number regex didn't match currency-prefixed values; date regex missing dash separator; 70% threshold too strict for dates
- **Fix**: Strip `€$£¥₹` before number test; add `-` to date separators; lower date threshold to 50%
- **Tests**: +5 new (currency, euro, slash dates, dash dates, empty cells)
- **TASM**: 35/35

### Inc 2: CSV Detail Callout + Report Type Fixes (BUG-039-002)
- **CSV callout**: After doc creation, `CsvLanding.createCsvDocAndOpen()` now calls `renderContent()` with 500ms delay
- **Report Type**: After saving noteType, immediately update local `report.frontmatter` + `scheduleRender()` with 500ms delay
- **TASM**: 34/35

### Inc 3: Remove Duplicate Export CSV + Add Refresh All (BUG-039-003)
- **Export CSV**: Removed `onExportCsv` callback from `AnalyticsResultsPanel` in `ResultsSection` — ActionsBar "Save to CSV" is the canonical button
- **Refresh All**: Added button in `AnalyticsDashboardPage.renderDefaultDashboard()` header area, mirroring DashboardsTab pattern
- **TASM**: 35/35

### Inc 4: Analyze Button on Reports Page (FEAT-039-001)
- Added "Analyze" button to both documented report and undocumented CSV file detail views
- Uses `eventBus.emit("ui.openAnalyticsHub")` — same pattern as command registry
- **TASM**: 34/35

### Inc 5: Test Verification & Cycle Finalization
- Full `npm test`: 4,751 tests, 196 suites — all passing
- Created cycle document, updated PRD

## Success Metrics

| Metric | Pre-Cycle | Actual |
|--------|-----------|--------|
| Currency detection | Broken (string) | Working (number) |
| Date detection ("2/3/2025") | Broken (string) | Working (date) |
| CSV doc callout refresh | Stale | Auto-refreshes |
| Report Type persistence | Broken | Persists + reflects in UI |
| Duplicate Export CSV | 2 buttons | 1 button (ActionsBar only) |
| Homepage Refresh All | Missing | Present |
| Reports → Query Builder | No navigation | "Analyze" button |
| New tests | 0 | 5 |
| Post-cycle total tests | 4,746 | 4,751 |
| Post-cycle total suites | 196 | 196 |

## Definition of Done

- [x] All 4,751 tests passing (196 suites)
- [x] No lint errors
- [x] No type errors
- [x] All 6 bugs addressed
- [x] Both feature requests implemented
- [x] Cycle document created

## Retrospective

### What Went Well
- Root cause analysis was precise — each bug had a clear, surgical fix
- No regressions from any change
- Currency + date detection fixes were pure function changes with excellent test coverage

### What Could Improve
- `guessColumnType()` should have had currency and dash-date handling from the start
- The duplicate Export CSV button existed since Cycle 38 Inc 6 extraction — should have been caught

### Observations
- The 50% date threshold is a reasonable trade-off: dates are unambiguous patterns (dd/mm/yyyy) that rarely appear in non-date columns
- The "Analyze" button uses EventBus directly rather than navigation callbacks — simpler but less type-safe; acceptable for a cross-hub navigation
