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
  - analytics.query.started
  - analytics.query.completed
  - analytics.query.failed
  - analytics.query.saved
  - analytics.query.deleted
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
- Data Exchange Hub view with 9 tabs (Dashboard, Reports, Types, Properties, Imports, Exports, Pipelines, Signals, Analytics)
- Data dictionary builder for type and property documentation
- Column mapping during import
- **In-memory CSV analytics engine** — join, group, aggregate across 2-3 CSV sources
- **Locale-aware parsing** — number and date parsing with 5 locale presets (en-US, de-DE, en-GB, nl-NL, fr-FR) + auto-detect
- **Analytics query builder** — visual interface for source/join/dimension/measure/time bucket configuration
- **Saved analytics queries** — persistent query configs for re-execution when CSVs are updated

### Out of Scope

- Real-time sync / watcher-based auto-reimport (future)
- Canvas file import — moved to [[Obsidian Canvas Integration PRD]] as dedicated feature
- Non-CSV formats (JSON, XML, Excel) — except EDI (see [[PBI-005 EDI Format Support]])
- Direct database connectivity
- Multi-user collaboration / merge conflict resolution
- Charts or visualizations — tables and stat cards for analytics (charts deferred)
- Calculated columns or formula expressions in analytics engine
- Scheduled or automated re-analysis

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
- [x] In-memory hash join on 2-3 CSV sources via specified key columns (inner + left join)
- [x] GROUP BY on 1-3 dimension columns with aggregation (SUM, COUNT, AVG, MIN, MAX)
- [x] Locale-aware number parsing: US (`1,234.56`), EU (`1.234,56`), FR (`1 234,56`)
- [x] Locale-aware date parsing: US (`MM/DD/YYYY`), EU (`DD/MM/YYYY`, `DD.MM.YYYY`), ISO (`YYYY-MM-DD`)
- [x] Time bucketing: month, quarter, year from locale-parsed date columns
- [x] Per-source locale selection (5 presets + auto-detect) and per-column type hints
- [x] Analytics query builder UI in DX Hub (9th tab)
- [x] Sortable results table with summary stat cards
- [x] Export analytics results as CSV
- [x] Saved analytics queries with persistence across reloads (state + JSON file)

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
| `AnalyticsQuery` | sources (with locale), joins, dimensions, measures, timeBucket, columnTypeHints | Runtime |
| `AnalyticsSource` | id, alias, csvPath, locale (SourceLocale) | Runtime |
| `SourceLocale` | id (en-US/de-DE/en-GB/nl-NL/fr-FR/auto), numberFormat, dateFormat | Runtime |
| `ColumnTypeHint` | column, type (number/date/string) | Runtime |
| `AnalyticsResult` | columns, rows, groupCount | Runtime |
| `SavedAnalyticsQuery` | id, name, query (AnalyticsQuery), lastRun, lastRowCount | `dataExchange` storage key |

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

- `analytics.query.started` -- Analytics query execution started
- `analytics.query.completed` -- Analytics query finished successfully
- `analytics.query.failed` -- Analytics query encountered error
- `analytics.query.saved` -- Analytics query saved to persistence
- `analytics.query.deleted` -- Saved analytics query removed

### Consumed

- File system events for context menu integration
- Settings events for configuration persistence

## 8. UI Layout Impact

- **ImportModal**: 4-page wizard integrated as Obsidian Modal
- **ExportModal**: 3-4 page wizard integrated as Obsidian Modal
- **Data Exchange Hub**: Full sidebar view with tab navigation (Dashboard, Reports, Types, Properties, Imports, Exports, Pipelines, Signals, Analytics)
- **Analytics Tab**: Query builder (sources + locale → type hints + joins → dimensions + measures → time bucket) + results table + saved queries list
- **File menu**: 3 new context menu items

## 9. Adapter Impact

- `CsvParser`: Wraps papaparse for CSV parse/generate
- `BaseQueryEngine`: Parses `.base` YAML and evaluates filter expressions (inFolder, folderContains, extEquals, nameContains, propertyEquals, negation, AND/OR groups)
- `ImportService`: CSV-to-vault-notes pipeline
- `ExportService`: Vault-to-CSV/tab pipeline with `listFiles` callback injection
- `DataExchangeService`: Orchestrator facade with ConfigDocService, PipelineExecutor, ConfigPathTracker, DataDictionaryBuilder sub-modules
- `WriteExternalFileCallback`: Node.js `fs.writeFileSync` for external export
- `ReadExternalFileCallback`: Node.js file reading for append conflict strategy
- `AnalyticsEngine`: Pure in-memory engine — join, group, aggregate with locale-aware parsing
- `AnalyticsService`: Orchestrator facade — load CSVs, execute engine, emit events, manage saved queries
- `localeUtils`: Number parsing with 5 locale presets + auto-detect heuristic
- `dateUtils`: Date parsing + time bucketing (month/quarter/year)

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
- [x] Analytics tab visible in DX Hub with query builder
- [x] Join 2-3 CSV files on shared key columns (inner + left join)
- [x] GROUP BY dimensions with SUM/COUNT/AVG/MIN/MAX aggregation
- [x] Locale-aware number/date parsing with per-source locale selection
- [x] Sortable results table with summary stat cards
- [x] Export analytics results as CSV
- [x] Saved analytics queries persist across plugin reloads (state + JSON file)

## 13. Definition of Done

- All acceptance criteria verified manually
- Unit tests cover CsvParser, BaseQueryEngine, ImportService, ExportService, and DataExchangeService
- Integration tests cover end-to-end import and export pipelines
- Event catalog updated with all `dataExchange.*` events
- `npm run build` passes (vitest, tsc, eslint, esbuild)

## 14. Extended Backlog (from Inbox Triage 2026-02-20)

| PBI | Title | Status | Priority | Source |
|-----|-------|--------|----------|--------|
| [[PBI-001 CSV Import Pipeline]] | CSV import pipeline | Done | — | Original scope |
| [[PBI-002 Data Export Pipeline]] | Data export pipeline | Done | — | Original scope |
| [[PBI-003 Data Dictionary and Hub Overview]] | Data dictionary and hub overview | Done | — | Original scope |
| [[PBI-004 Advanced Data Workflows]] | Advanced data workflows | Done | — | Original scope |
| [[PBI-005 EDI Format Support]] | EDI format as import source | Discovery | Low | [[EDI Integration]] |
| [[PBI-006 Pipeline Multi-Source Merge]] | Multi-source merge with master data builder | Planned | High (RB-7) | [[Pipeline multi-source merge with master data builder]] |
| [[PBI-007 Pipeline Step Preview]] | Intermediate Base views between pipeline steps | Discovery | Medium | [[Pipeline step preview with intermediate Base views]] |
| [[PBI-008 Execution Timing]] | Execution timing for import/export configs | Discovery | Low | [[I also want to know how long the execution of a Data Exchange Config took]] |
| [[PBI-009 Report Ingestion]] | Ingest test/coverage reports as vault notes | Discovery | Medium | [[I want to ingest a test-report, a coverage-report, prds, the git-history and lifecycle documents for further analysis]], [[Ingest build reports test reports and coverage as vault notes]] |
| [[PBI-010 Data Dictionary Integration]] | Entity config from settings into DX Hub data-dictionary | Discovery | Medium | [[We need to integrate the Entity configuration from the settings-tab into the Data Exchange Hub to build the data-dictionary in one place]] |
| [[PBI-ANA-001 Analytics Engine Core]] | In-memory join + GROUP BY + aggregation with locale-aware parsing | Done | Critical | [[When opening a CSV with Flowti, I want to be able to make an easy dashboard]] |
| [[PBI-ANA-002 Analytics Query Builder UI]] | Visual query builder in DX Hub Analytics tab | Done | Critical | [[When opening a CSV with Flowti, I want to be able to make an easy dashboard]] |
| [[PBI-ANA-003 Analytics Results View]] | Sortable results table + stat cards + export | Done | Critical | [[When opening a CSV with Flowti, I want to be able to make an easy dashboard]] |
| [[PBI-ANA-004 Saved Analytics Queries]] | Persistent query configs for re-execution + JSON file artifacts | Done | High | [[When opening a CSV with Flowti, I want to be able to make an easy dashboard]] |

> **Inbox triage (2026-02-22):** 3 new PBIs added. PBI-008 for execution timing tracking. PBI-009 for report ingestion (test, coverage, build reports). PBI-010 for settings-tab entity config integration into DX Hub data dictionary. Existing bugs tracked in inbox: exporter formula evaluation, exporter view properties, dashboard progress bar issues.

> **Analytics sprint (2026-02-23):** 4 PBIs added for in-memory CSV analytics engine. PBI-ANA-001 (engine core with locale-aware parsing), PBI-ANA-002 (query builder UI as 9th DX Hub tab), PBI-ANA-003 (results view + export), PBI-ANA-004 (saved queries). Planned for [[Cycle 27 - Analytics Sprint]]. Business trigger: US-locale CSVs (Items, Suppliers, Sales) arriving end of week.

> **Canvas import**: Moved to dedicated [[Obsidian Canvas Integration PRD]] with PBI-CAN-001 through PBI-CAN-003.
