---
type: TechDebt
severity: medium
category: testing
layer: ui
status: mitigated
created: 2026-02-14
description: Component-level rendering tests incrementally being added. 1787 tests across 79 suites cover domain services, EventBus, utilities, pure functions, 6 view orchestrators, extracted UI logic, select UI components, and User Hub components. Mock factory consolidation (2026-02-16) provides shared createMockStorage/createMockFileSystem/createMockTFile factories under tests/mocks/.
updated: 2026-02-16
source: "[[Frontend Architecture]]"
---
# TD-27: Limited UI component testing

## Problem

1760 tests across 78 suites cover domain services, EventBus, utilities, pure functions (Tier 1: 298 tests), injectable services (Tier 2: 149 tests), 6 view orchestrators (`EventCatalogView`, `ExportView`, `DataExchangeHubView`, `EventLogView`, `EventConfigModal`, `IngestionStatusBar`), extracted UI logic (`csvUtils`, `PipelineExecutor.buildPreview()`), select UI components (DomainsTab, ServicesTab, entityScanner, helpers visibility, CsvDataSnapshot), and the User Hub component suite. Individual coverage is expanding incrementally.

### Untested components (~32 files)

**Catalog**: `CatalogDashboard`, ~~`DomainsTab`~~, ~~`ServicesTab`~~, `EventsTab`, `EventsCategoryRenderer`, `EventsSettingsPanel`, `EventDetailPanel`, `FlowsTab`, `SystemsTab`, `ActorsTab`, `ProductsTab`

**Hub**: `HubDashboard`, `ImportsTab`, `ExportsTab`, `ReportsTab`, `PropertiesTab`, `TypesTab`, `PipelinesTab`, `DashboardImports`, `DashboardExports`, `DashboardPipelines`, `DashboardImportExecutor`

**Pipeline**: `PipelineDetail`, `PipelineEditForm`, `PipelinePreview`, `PipelineExecution`, `SourcesExportsGrid`

**CSV**: `CsvLanding`, `CsvConfigPage`, `CsvPreviewPage`, `CsvResultPage`, ~~`CsvDataSnapshot`~~, `CsvUsageSection`, `CsvAssociatedBases`

**Export**: `ViewSelectPage`, `ConfigurePage`, `PreviewPage`, `ResultPage`

**User Hub**: ~~`UserHubDashboard`~~, ~~`UserHubInbox`~~ — both tested. `UserHubActivity` was removed (functionality moved to standalone `EventLogView` sidebar).

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

### User Hub component coverage (2026-02-16)

- ~~`tests/ui/userHub/UserHubActivity.test.ts`~~ — removed (component deleted; functionality in standalone `EventLogView`)
- `tests/ui/userHub/UserHubInbox.test.ts` — 11 tests: renderMaster (empty state, items, filter by title, bold unread, click selection), renderDetail (placeholder, item detail, action badge, empty description). Coverage: 95.7%
- `tests/ui/userHub/UserHubDashboard.test.ts` — 24 tests: welcome (user name, generic greeting), hub summaries (stat cards, self-filter, no-providers, tabId click, no-tabId click), inbox section (always visible, empty state, unread badge, bold unread, accent border, max 5, view all, click navigation, source badges, clear all), quick actions (4 buttons, event emission), re-render idempotency. Coverage: 97.2%
- `tests/domain/inbox/InboxService.test.ts` — includes 4 `setEnabledSources` tests for configurable notification sources
- Combined ui/userHub coverage: **~96.6% statements, ~91.5% branches**

### Mock factory consolidation (2026-02-16)

28+ duplicated mock factory functions across 25 test files consolidated into 3 shared modules:

- `tests/mocks/storage.ts` — `createMockStorage<T>(initialState?)` returns `{ storage: ITypedStorage<T>, getData }` with in-memory persistence. Replaces 13 identical local factories.
- `tests/mocks/filesystem.ts` — `createMockFileSystem(existingFiles?)` (full in-memory Map) + `createMockFileSystemStub()` (simple defaults). Replaces 15 identical local factories.
- `tests/mocks/obsidian-stub.ts` — added `createMockTFile(path, basename, ext)` + `createMockTFolder(path, children)`. Replaces 3 identical local factories.
- `tests/flows/testHelpers.ts` — barrel re-exports from shared mocks for backward compatibility

All 25 updated test files pass with shared factories. Generic type parameter `<T>` enforces correct typing at every call site.

## Effort

Medium — ~32 remaining test files, each lightweight (50-100 LOC) using the established mock pattern from orchestrator tests.

## Affected Files

- `tests/ui/catalog/*.test.ts` (new, ~11 files)
- `tests/ui/hub/*.test.ts` (new, ~11 files)
- `tests/ui/csv/*.test.ts` (new, ~7 files)
- `tests/ui/export/*.test.ts` (new, ~4 files)
- `tests/ui/hub/pipeline/*.test.ts` (new, ~5 files)
- `tests/ui/userHub/*.test.ts` (done: 3 files, 59 tests)
- `tests/mocks/storage.ts` (new — shared mock factory)
- `tests/mocks/filesystem.ts` (new — shared mock factory)
