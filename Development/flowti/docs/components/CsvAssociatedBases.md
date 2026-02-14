---
type: Component
domain: Flowti
stage: done
description: "Displays .base view files associated with the current CSV file's import target folders"
source: "[[Development/flowti/src/ui/csv/CsvAssociatedBases.ts|CsvAssociatedBases.ts]]"
parent: "[[CsvActionView]]"
tags:
  - csv
  - component
---

# CsvAssociatedBases

## Description

CsvAssociatedBases renders the "Associated Views" section on the CsvLanding page. It discovers `.base` files in the vault that are related to the current CSV file by matching against import config target folders and explicit base paths. Each found `.base` file is displayed as a clickable link that opens the view. The component supports incremental refresh (via the `refresh()` method) so newly created `.base` files appear after an import without re-rendering the entire landing page.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `CsvComponentDeps` | interface | Shared dependency bag providing app, state, and data exchange service |
| `dataExchangeService.getImportConfigsForFile()` | method | Retrieves saved import configs that reference the current CSV file |
| `app.vault.getFiles()` | method | Scans all vault files to find `.base` files |

## State

**Reads via `deps.getState()`:**
- (none directly -- queries the data exchange service and vault for discovery)

**Writes via `deps.setState()`:**
- (none)

## Renders

- **Section heading**: "Associated Views" (only rendered when at least one `.base` file is found)
- **Base views card**: card with table icon and "Base views" label
- **Base file rows**: each row contains a clickable file-code icon link (opens the `.base` file) and the full vault path in muted text

### Discovery Logic

The `findAssociatedBases()` method builds a list of `.base` files by:
1. Collecting target folders from all saved import configs referencing the current CSV file
2. Collecting explicit `basePath` values from those configs
3. Scanning all vault `.base` files for:
   - Direct matches against explicit base paths
   - Files located in or adjacent to a target folder

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | -- | CsvAssociatedBases does not interact with the event bus |

## Related

- Parent: [[CsvActionView]] (embedded by [[CsvLanding]])
- Siblings: [[CsvDataSnapshot]], [[CsvUsageSection]]
