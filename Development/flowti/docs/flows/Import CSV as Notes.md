---
type: Flow
domain: Flowti
stage: done
description: "End-to-end journey from clicking a CSV file through the import wizard to creating vault notes with frontmatter"
domains:
  - Data Exchange
services:
  - ImportService
  - DataExchangeService
  - CsvParser
events:
  - dataExchange.import.execute
  - dataExchange.import.progress
  - dataExchange.import.completed
tags:
  - flow
  - data-exchange
---

# Import CSV as Notes

## Overview

The CSV import flow transforms a CSV file into a collection of Obsidian notes, each with structured YAML frontmatter derived from the CSV columns. Users access the import wizard either by clicking a `.csv` file in the vault (which opens the CsvActionView landing page) or via the `flowti:import-csv` command. The 4-page wizard walks through preview, configuration, preview of results, and final execution with detailed progress reporting.

## Trigger

User clicks a `.csv` file in the file explorer, or runs the `flowti:import-csv` command.

## Steps

### 1. Open CSV File

- **View/Service**: CsvActionView (CsvLanding component)
- **User Action**: User clicks a `.csv` file in the Obsidian file explorer
- **System Response**: CsvActionView activates and renders the CsvLanding page. CsvParser reads the file content and parses it using papaparse. The landing page displays a preview table of the first several rows, column headers, and row count summary. An "Import as Notes" button is prominently shown
- **Events**: (none — UI only, file read via FileSystemClient)

### 2. Start Import Wizard

- **View/Service**: ImportModal (Welcome/Config page)
- **User Action**: User clicks "Import as Notes" on the landing page
- **System Response**: ImportModal opens as a 4-page wizard. The first page (CsvConfigPage) displays the parsed CSV data and presents configuration options: target folder path, name column dropdown (populated from CSV headers), column mapping table, and conflict strategy selector
- **Events**: (none — UI only)

### 3. Configure Column Mappings

- **View/Service**: ImportModal (CsvConfigPage)
- **User Action**: User selects the target folder for generated notes, chooses which CSV column to use as the note filename (name column), maps CSV columns to frontmatter property names via the column mapping table, and selects a conflict strategy for existing files
- **System Response**: CsvConfigPage updates the mapping preview in real-time as the user adjusts settings. Column mapping table shows source column → target property name with toggles for inclusion/exclusion. The conflict strategy dropdown offers skip (keep existing), update (merge frontmatter), or overwrite (replace entirely)
- **Events**: (none — UI only)

### 4. Preview Import Results

- **View/Service**: ImportModal (CsvPreviewPage)
- **User Action**: User clicks "Next" to advance to the preview page
- **System Response**: CsvPreviewPage renders a preview of the notes that will be created, showing the generated filenames, target paths, and a sample of the YAML frontmatter that will be written. Files that would conflict with existing notes are highlighted with the chosen resolution strategy indicator. A summary bar shows total files to create, update, and skip
- **Events**: (none — UI only)

### 5. Execute Import

- **View/Service**: ImportService
- **User Action**: User clicks "Execute Import" on the preview page
- **System Response**: ImportModal advances to the progress page. DataExchangeService receives the import configuration and delegates to ImportService. ImportService iterates through each CSV row: sanitizes the filename, builds note content with YAML frontmatter via `buildNoteContent()`, applies the conflict strategy, and creates or updates files via FileSystemClient. Progress events fire for each processed row
- **Events**: `dataExchange.import.execute` → `dataExchange.import.progress` (per row) → `dataExchange.import.completed`

### 6. Review Results

- **View/Service**: ImportModal (CsvResultPage)
- **User Action**: User views the import results summary
- **System Response**: CsvResultPage displays a detailed breakdown: total rows processed, notes created, notes updated, notes skipped (due to conflict strategy), and any errors encountered. Each result entry is clickable to navigate to the created note. A "Save Config" button allows persisting the import configuration for future reuse
- **Events**: (none — UI only)

### 7. Save Configuration (Optional)

- **View/Service**: DataExchangeService
- **User Action**: User clicks "Save Config" and enters a name for the configuration
- **System Response**: DataExchangeService persists the import configuration as a `SavedImportConfig` (name, target folder, name column, column mappings, conflict strategy) under the `dataExchange` storage key. The saved config becomes available in the Data Exchange Hub and in future import wizards via the "Load Config" dropdown
- **Events**: (none — direct service call, no events for config CRUD)

### 8. Close Wizard

- **View/Service**: ImportModal
- **User Action**: User clicks "Close" or "Done" to dismiss the modal
- **System Response**: Modal closes. The vault now contains the newly created notes. If `metadataCache` indexing is still in progress, scan-based views (Systems, Flows) may need a brief delay before reflecting the new files
- **Events**: (none — UI only)

## Decision Points

| Decision | Options | Default |
|----------|---------|---------|
| Conflict strategy | Skip / Update / Overwrite | Skip |
| Name column | Any CSV column header | First column |
| Column mappings | Include/exclude per column, rename target property | All included, original names |
| Create .base file | Generate a .base query file for the imported collection | No |
| Save configuration | Persist settings for reuse | Optional |

## Events Sequence

```
[file click] → [CsvLanding preview] → [wizard opens] → [user configures] → dataExchange.import.execute → dataExchange.import.progress (×N rows) → dataExchange.import.completed → [results displayed]
```

## Related Use Cases

- [[Export Vault Data]] (reverse operation — vault notes to CSV)
- [[Build Import Pipeline]] (saved import configs are reusable in pipelines)
- [[Browse and Configure Events]] (import events appear in the catalog)
