---
severity: medium
category: testing
layer: ui
status: mitigated
created: 2026-02-14
description: Component-level rendering tests incrementally being added. 1725 tests across 77 suites cover domain services, EventBus, utilities, pure functions, 6 view orchestrators, extracted UI logic, select UI components, and full User Hub component suite (3 components, 37 tests, 97.9% coverage).
updated: 2026-02-15
source: "[[Frontend Architecture]]"
---
# TD-27: Limited UI component testing

## Problem

1725 tests across 77 suites cover domain services, EventBus, utilities, pure functions (Tier 1: 298 tests), injectable services (Tier 2: 149 tests), 6 view orchestrators (`EventCatalogView`, `ExportView`, `DataExchangeHubView`, `EventLogView`, `EventConfigModal`, `IngestionStatusBar`), extracted UI logic (`csvUtils`, `PipelineExecutor.buildPreview()`), select UI components (DomainsTab, ServicesTab, entityScanner, helpers visibility, CsvDataSnapshot), and the full User Hub component suite. Individual coverage is expanding incrementally.

### Untested components (~32 files)

**Catalog**: `CatalogDashboard`, ~~`DomainsTab`~~, ~~`ServicesTab`~~, `EventsTab`, `EventsCategoryRenderer`, `EventsSettingsPanel`, `EventDetailPanel`, `FlowsTab`, `SystemsTab`, `ActorsTab`, `ProductsTab`

**Hub**: `HubDashboard`, `ImportsTab`, `ExportsTab`, `ReportsTab`, `PropertiesTab`, `TypesTab`, `PipelinesTab`, `DashboardImports`, `DashboardExports`, `DashboardPipelines`, `DashboardImportExecutor`

**Pipeline**: `PipelineDetail`, `PipelineEditForm`, `PipelinePreview`, `PipelineExecution`, `SourcesExportsGrid`

**CSV**: `CsvLanding`, `CsvConfigPage`, `CsvPreviewPage`, `CsvResultPage`, ~~`CsvDataSnapshot`~~, `CsvUsageSection`, `CsvAssociatedBases`

**Export**: `ViewSelectPage`, `ConfigurePage`, `PreviewPage`, `ResultPage`

**User Hub**: ~~`UserHubDashboard`~~, ~~`UserHubInbox`~~, ~~`UserHubActivity`~~ — all tested

## Impact

- Regressions in UI rendering go undetected until manual testing
- Refactoring UI components is riskier without safety net
- DOM structure assumptions untested (e.g., correct CSS classes, element counts)

## Suggested Approach

Add lightweight unit tests per component using the existing `obsidian-stub` polyfills:

1. Create `tests/ui/catalog/DomainsTab.test.ts` etc. mirroring source tree
2. Instantiate component with mock `CatalogComponentDeps`
3. Call `renderMaster()` / `renderDetail()` on a real `HTMLDivElement`
4. Assert: element counts, text content, CSS classes, event handler wiring
5. Target: 1-3 tests per component covering happy path rendering

## Resolution (2026-02-15)

Established replicable UI component testing pattern:
- `tests/ui/catalog/testHelpers.ts` — reusable `createMockCatalogDeps()` factory
- `tests/ui/catalog/DomainsTab.test.ts` — 16 tests as exemplar (scan, renderMaster, renderDetail, selection, CRUD)
- Uses `happy-dom` environment via `// @vitest-environment happy-dom` pragma
- Pattern: instantiate component with mock deps, call render, assert DOM structure + event emissions
- Remaining ~39 components can be tested following this pattern incrementally
- ADR-023 extracted critical business logic from modals: `csvUtils` (41 tests) and `PipelineExecutor.buildPreview()` (12 tests) now fully covered

### Additional coverage (2026-02-15)

- `tests/ui/catalog/helpers.test.ts` — 23 new tests for `getVisibleEntries()`, `discoveredToCatalogEntries()`, `resolveEntry()`, `getConfiguredCount()`, `getFollowedCount()` (67 tests total in file)
- `tests/ui/csv/CsvDataSnapshot.test.ts` — 28 new tests covering rendering, column visibility, filtering, sorting, row limit, and combined operations
- `tests/mocks/obsidian-stub.ts` — added `appendText` polyfill for broader UI component testing

### User Hub component coverage (2026-02-15)

- `tests/ui/userHub/UserHubActivity.test.ts` — 16 tests: event capture (wildcard, skip internals, newest-first, 200 cap, unsubscribe, catalog category), renderMaster (empty state, rows, filter by type/category, selection, click), renderDetail (placeholder, details, JSON payload). Coverage: 98.9%
- `tests/ui/userHub/UserHubInbox.test.ts` — 11 tests: renderMaster (empty state, items, filter by title, bold unread, click selection), renderDetail (placeholder, item detail, action badge, empty description). Coverage: 100%
- `tests/ui/userHub/UserHubDashboard.test.ts` — 10 tests: welcome (user name, generic greeting), hub summaries (stat cards, self-filter, no-providers, tabId click, no-tabId click), quick actions (4 buttons, event emission), re-render idempotency. Coverage: 93.6%
- Combined ui/userHub coverage: **97.9% statements, 89.7% branches**

## Effort

Medium — ~32 remaining test files, each lightweight (50-100 LOC) using the established mock pattern from orchestrator tests.

## Affected Files

- `tests/ui/catalog/*.test.ts` (new, ~11 files)
- `tests/ui/hub/*.test.ts` (new, ~11 files)
- `tests/ui/csv/*.test.ts` (new, ~7 files)
- `tests/ui/export/*.test.ts` (new, ~4 files)
- `tests/ui/hub/pipeline/*.test.ts` (new, ~5 files)
- `tests/ui/userHub/*.test.ts` (done: 3 files, 37 tests)
