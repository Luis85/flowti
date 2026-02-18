---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: done
related_events:
  - dataExchange.import.execute
  - dataExchange.import.completed
  - dataExchange.import.failed
  - dataExchange.import.progress
  - dataExchange.export.execute
  - dataExchange.export.completed
  - dataExchange.export.failed
  - dataExchange.export.progress
  - dataExchange.export.preview
maturity: L4
business_value: 4
implementation_cost: 5
maintenance_cost: 3
discovery_cost: 3
design_cost: 4
test_cost: 4
priority: 4
tags:
  - core
---

# Data Exchange Hub PRD

## 1. Problem Statement

Obsidian excels at collecting, enriching, and linking data into a knowledge graph, but it lacks native CSV import/export capabilities. Organizations need to ingest external data (supplier lists, reports, catalogs), improve data quality inside Obsidian using Bases, and then publish clean datasets for downstream systems. Without a structured import/export pipeline, users resort to manual copy-paste workflows that are error-prone and unsustainable.

## 2. Outcome

Users can manage master data end-to-end within Obsidian: import CSV files as notes, leverage Bases for data exploration and quality improvement, and export curated datasets as CSV or tab-delimited files. Saved configurations make recurring data exchanges repeatable. The Data Exchange Hub provides a centralized dashboard for monitoring all import/export activity, managing data dictionaries, and executing pipelines.

## 3. Scope

### In Scope

- CSV file import as individual Obsidian notes with frontmatter
- Export from Obsidian Base files (`.base`) to CSV and tab-delimited formats
- Export from folders to CSV and tab-delimited formats
- File navigator context menu integration (right-click)
- Command palette integration (`flowti:import-csv`, `flowti:export-data`)
- Conflict resolution strategies (skip, update, overwrite for import; skip, append, overwrite for export)
- Saved import/export configurations with persistence
- External filesystem export (outside vault) via Electron dialog
- Formula resolution from `.base` YAML view definitions
- Data Exchange Hub view with 7 tabs (Dashboard, Reports, Types, Properties, Imports, Exports, Pipelines)
- Data dictionary builder for type and property documentation
- Column mapping during import

### Out of Scope

- Real-time sync / watcher-based auto-reimport (future)
- Canvas file import
- Non-CSV formats (JSON, XML, Excel)
- Direct database connectivity
- Multi-user collaboration / merge conflict resolution

## 4. UX Entry Points

- **File navigator context menu**: Right-click `.csv` file shows "Import as Notes"; right-click `.base` file or folder shows "Export as CSV/Tab"
- **Command palette**: `flowti:import-csv` and `flowti:export-data`
- **Data Exchange Hub view**: Dedicated sidebar view with 7 tabs for managing all data exchange activity
- **Import Modal**: 4-page wizard (Source, Configure, Preview, Execute)
- **Export Modal**: 3-4 page wizard (Source, Configure, Execute) with "Save to filesystem" option

## 5. Functional Requirements

- [x] Import CSV files as individual notes with YAML frontmatter
- [x] Support column-to-property mapping during import
- [x] Support conflict strategies: skip existing, update existing, overwrite existing
- [x] Export Base views to CSV format
- [x] Export Base views to tab-delimited text format (`.txt`)
- [x] Export folder contents to CSV/tab format
- [x] Resolve `.base` YAML formulas to actual frontmatter keys
- [x] Support external filesystem export via Electron save dialog
- [x] Export conflict strategies: skip, append, overwrite
- [x] Persist saved import/export configurations
- [x] Provide file-menu context actions for `.csv`, `.base`, and folders
- [x] Provide command palette commands for import and export
- [x] Emit progress events during import/export execution
- [x] Sanitize filenames derived from CSV data
- [x] Data Exchange Hub dashboard with activity overview
- [x] Data dictionary builder (Types, Properties tabs)

## 6. Data Model Impact

| Entity | Fields | Storage |
|--------|--------|---------|
| `SavedImportConfig` | name, targetFolder, nameColumn, columnMappings, conflictStrategy | `dataExchange` storage key |
| `SavedExportConfig` | name, sourcePath, sourceType, format, outputPath, columns, fileProperties | `dataExchange` storage key |
| `DataExchangeState` | savedImportConfigs, savedExportConfigs | Shared plugin storage |
| `ParsedCsv` | headers, rows | Runtime (papaparse) |
| `ParsedBaseFile` | filters, order, formulas | Runtime (YAML parse) |
| `ImportConfig` | sourcePath, targetFolder, nameColumn, columnMappings, conflictStrategy | Runtime |
| `ExportConfig` | sourcePath, sourceType, format, outputPath, columns, isExternal, conflictStrategy | Runtime |

## 7. Event Impact

### Produced

- `dataExchange.import.execute` -- Import pipeline started
- `dataExchange.import.completed` -- Import finished successfully
- `dataExchange.import.failed` -- Import encountered error
- `dataExchange.import.progress` -- Per-note import progress
- `dataExchange.export.execute` -- Export pipeline started
- `dataExchange.export.completed` -- Export finished successfully
- `dataExchange.export.failed` -- Export encountered error
- `dataExchange.export.progress` -- Per-record export progress
- `dataExchange.export.preview` -- Export preview generated

### Consumed

- File system events for context menu integration
- Settings events for configuration persistence

## 8. UI Layout Impact

- **ImportModal**: 4-page wizard integrated as Obsidian Modal
- **ExportModal**: 3-4 page wizard integrated as Obsidian Modal
- **Data Exchange Hub**: Full sidebar view with tab navigation (Dashboard, Reports, Types, Properties, Imports, Exports, Pipelines)
- **File menu**: 3 new context menu items

## 9. Adapter Impact

- `CsvParser`: Wraps papaparse for CSV parse/generate
- `BaseQueryEngine`: Parses `.base` YAML and evaluates filter expressions (inFolder, folderContains, extEquals, nameContains, propertyEquals, negation, AND/OR groups)
- `ImportService`: CSV-to-vault-notes pipeline
- `ExportService`: Vault-to-CSV/tab pipeline with `listFiles` callback injection
- `DataExchangeService`: Orchestrator facade with ConfigDocService, PipelineExecutor, ConfigPathTracker, DataDictionaryBuilder sub-modules
- `WriteExternalFileCallback`: Node.js `fs.writeFileSync` for external export
- `ReadExternalFileCallback`: Node.js file reading for append conflict strategy

## 10. Non-Functional Requirements

- Import of 1000-row CSV must complete within 30 seconds
- Export must handle Base views with 500+ records
- All operations must be idempotent when using skip conflict strategy
- Progress events must fire per-record for UI responsiveness
- Saved configurations must survive plugin reload

## 11. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large CSV files cause UI freeze | High | Concurrent job queue with configurable concurrency |
| `.base` YAML format changes in Obsidian update | Medium | Defensive parsing with fallback behavior |
| External filesystem permissions denied | Medium | Try/catch with user-friendly error messages |
| papaparse edge cases (encoding, BOM) | Low | `skipEmptyLines: true`, header normalization |

## 12. Acceptance Criteria

- [x] Right-click a `.csv` file and select "Import as Notes" opens the import wizard
- [x] Right-click a `.base` file and select "Export as CSV" opens the export wizard
- [x] Right-click a folder and select "Export" opens the export wizard
- [x] CSV import creates one note per row with correct frontmatter
- [x] Export generates valid CSV with headers matching Base view columns
- [x] Export generates valid tab-delimited `.txt` files
- [x] Saved configurations persist across plugin reloads
- [x] Import respects conflict strategy (skip/update/overwrite)
- [x] Export respects conflict strategy (skip/append/overwrite)
- [x] External export writes files outside the vault via save dialog
- [x] Formula columns resolve to actual frontmatter keys
- [x] Data Exchange Hub displays dashboard with activity summary
- [x] Commands `flowti:import-csv` and `flowti:export-data` work from command palette

## 13. Definition of Done

- All acceptance criteria verified manually
- Unit tests cover CsvParser, BaseQueryEngine, ImportService, ExportService, and DataExchangeService
- Integration tests cover end-to-end import and export pipelines
- Event catalog updated with all `dataExchange.*` events
- `npm run build` passes (vitest, tsc, eslint, esbuild)
