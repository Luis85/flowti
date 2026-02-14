---
type: Component
domain: Flowti
stage: done
description: "Wrapper around Electron's native save dialog for external CSV/Tab file exports"
source: "[[Development/flowti/src/ui/electronDialog.ts|electronDialog.ts]]"
parent: "[[Flowti Plugin]]"
tags:
  - standalone
  - component
---

# ElectronDialog

## Description

ElectronDialog is a standalone utility module that wraps Electron's `remote.dialog.showSaveDialog` for use in external file export workflows. It provides a single async function `showNativeSaveDialog()` that opens the OS-native save dialog with appropriate file filters for CSV or tab-delimited exports. It gracefully returns `null` if Electron is unavailable (e.g., in mobile or non-Electron environments).

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `ExportFormat` | type | Determines file extension and dialog filter configuration (`"csv"` or `"tab"`) |
| `electron.remote` | runtime | Accesses native dialog and current window via Electron's remote module |

## State

This is a stateless utility function. It does not read or write any shared state.

## Renders

This component does not render DOM elements. It opens a native OS dialog and returns a result object:

- **`NativeSaveDialogOptions`**: input with `format` (`"csv"` or `"tab"`) and optional `defaultFilename`
- **`NativeSaveDialogResult`**: output with `canceled: boolean` and optional `filePath: string`
- **CSV format**: filters for `.csv` files, defaults to `export.csv`
- **Tab format**: filters for `.txt` / `.tsv` files, defaults to `export.txt`

## Events

This component does not emit or listen to any events.

## Related

- Parent: Flowti Plugin
- Siblings: [[ExportModal]] (primary consumer of this dialog utility)
- Children: none
