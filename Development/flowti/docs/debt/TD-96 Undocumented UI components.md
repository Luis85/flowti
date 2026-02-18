---
type: TechDebt
severity: low
category: documentation
layer: ui
status: open
effort: medium
updated: 2026-02-18
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

## Related

- [[Frontend Architecture]]
- ADR-024: BaseHubView Shell Extraction
