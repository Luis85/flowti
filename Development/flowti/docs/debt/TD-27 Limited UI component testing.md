---
severity: medium
category: testing
layer: ui
status: mitigated
created: 2026-02-14
description: Component-level rendering tests (individual tabs, pages) not yet covered. 1498 tests across 66 suites cover domain services, EventBus, utilities, pure functions, 6 view orchestrators, and extracted UI logic but not individual UI components.
updated: 2026-02-16
source: "[[Frontend Architecture]]"
---
# TD-27: Limited UI component testing

## Problem

1498 tests across 66 suites cover domain services, EventBus, utilities, pure functions (Tier 1: 298 tests), injectable services (Tier 2: 149 tests), 6 view orchestrators (`EventCatalogView`, `ExportView`, `DataExchangeHubView`, `EventLogView`, `EventConfigModal`, `IngestionStatusBar`), and extracted UI logic (`csvUtils`, `PipelineExecutor.buildPreview()`). However, individual UI components — tabs, pages, dashboard widgets — have no dedicated tests.

### Untested components (~40 files)

**Catalog**: `CatalogDashboard`, `DomainsTab`, `ServicesTab`, `EventsTab`, `EventsCategoryRenderer`, `EventsSettingsPanel`, `EventDetailPanel`, `FlowsTab`, `SystemsTab`, `ActorsTab`, `ProductsTab`

**Hub**: `HubDashboard`, `ImportsTab`, `ExportsTab`, `ReportsTab`, `PropertiesTab`, `TypesTab`, `PipelinesTab`, `DashboardImports`, `DashboardExports`, `DashboardPipelines`, `DashboardImportExecutor`

**Pipeline**: `PipelineDetail`, `PipelineEditForm`, `PipelinePreview`, `PipelineExecution`, `SourcesExportsGrid`

**CSV**: `CsvLanding`, `CsvConfigPage`, `CsvPreviewPage`, `CsvResultPage`, `CsvDataSnapshot`, `CsvUsageSection`, `CsvAssociatedBases`

**Export**: `ViewSelectPage`, `ConfigurePage`, `PreviewPage`, `ResultPage`

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

## Effort

Medium — ~40 test files, but each is lightweight (50-100 LOC) using the established mock pattern from orchestrator tests.

## Affected Files

- `tests/ui/catalog/*.test.ts` (new, ~11 files)
- `tests/ui/hub/*.test.ts` (new, ~11 files)
- `tests/ui/csv/*.test.ts` (new, ~7 files)
- `tests/ui/export/*.test.ts` (new, ~4 files)
- `tests/ui/hub/pipeline/*.test.ts` (new, ~5 files)
