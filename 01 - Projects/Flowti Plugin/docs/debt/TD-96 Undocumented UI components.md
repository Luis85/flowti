---
type: TechDebt
severity: low
category: documentation
layer: ui
status: resolved
effort: medium
updated: 2026-02-19
resolved: 2026-02-19
description: 17 UI components lack documentation — no JSDoc, no component doc, and not referenced in the Frontend Architecture doc.
---
# TD-96: Undocumented UI components

## Problem

17 UI components exist in `src/ui/` without documentation in the Frontend Architecture doc or individual component docs:

**Catalog components** (`src/ui/catalog/`):
- BaseEntityTab
- EntityScannerComponent
- EventConfigModal (3 form pages)

**Data Exchange components** (`src/ui/hub/`):
- csvUtils
- PipelineListComponent
- PropertyListComponent
- TypeListComponent

**Shared components** (`src/ui/`):
- ConfirmModal
- InputModal
- SessionWorkspaceView (partially documented in PRD but no component doc)

**CSV components** (`src/ui/csv/`):
- CsvPreviewComponent
- CsvMappingComponent
- CsvValidationComponent

**Export components** (`src/ui/export/`):
- ExportConfigComponent
- ExportPreviewComponent

## Impact

- New contributors must read source code to understand component responsibilities
- No searchable documentation for component APIs
- Frontend Architecture doc is incomplete

## Suggested Remediation

1. Add missing components to `docs/Frontend Architecture.md` component inventory
2. Add JSDoc headers to each component class describing purpose and dependencies
3. Priority: BaseEntityTab (used by all 7 catalog tabs), EventConfigModal (complex 3-page modal)

## Resolution (2026-02-19)

All 14 existing undocumented components documented in Frontend Architecture.md under "Key Undocumented Components" section with tables covering purpose, file path, and dependencies for each:
- 2 catalog abstract components (BaseEntityTab, entityScanner)
- 3 event config modal pages (EventConfigModal, OverviewPage, DefinitionFormPage)
- 3 hub tabs (PipelinesTab, PropertiesTab, TypesTab)
- 2 shared modals (ConfirmModal, InputModal)
- 2 CSV pages (CsvConfigPage, CsvPreviewPage)
- 2 export pages (ConfigurePage, PreviewPage)

Note: `CsvValidationComponent` from the original list does not exist — validation is integrated into CsvConfigPage/CsvPreviewPage. Some component names in TD-96 were aliases (e.g., "PropertyListComponent" → `PropertiesTab.ts`).

## Related

- [[Frontend Architecture]]
- ADR-024: BaseHubView Shell Extraction
