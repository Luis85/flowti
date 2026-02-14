---
severity: medium
category: testing
layer: ui
status: open
created: 2026-02-14
description: Component-level rendering tests (individual tabs, pages) not yet covered. 854 tests cover domain services, EventBus, utilities, and 6 view orchestrators but not individual UI components.
source: "[[Frontend Architecture]]"
---
# TD-27: Limited UI component testing

## Problem

854 tests across 45 files cover domain services, EventBus, utilities, and 6 view orchestrators (`EventCatalogView`, `ExportView`, `DataExchangeHubView`, `EventLogView`, `EventConfigModal`, `IngestionStatusBar`). However, individual UI components — tabs, pages, dashboard widgets — have no dedicated tests.

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

## Effort

Medium — ~40 test files, but each is lightweight (50-100 LOC) using the established mock pattern from orchestrator tests.

## Affected Files

- `tests/ui/catalog/*.test.ts` (new, ~11 files)
- `tests/ui/hub/*.test.ts` (new, ~11 files)
- `tests/ui/csv/*.test.ts` (new, ~7 files)
- `tests/ui/export/*.test.ts` (new, ~4 files)
- `tests/ui/hub/pipeline/*.test.ts` (new, ~5 files)
