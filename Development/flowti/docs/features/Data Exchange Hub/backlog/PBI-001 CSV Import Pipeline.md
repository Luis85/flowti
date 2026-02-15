---
type: ProductBacklogItem
feature: "[[Data Exchange Hub PRD]]"
priority: high
stage: done
userStories:
  - "[[I want to clean up my data before importing from CSV]]"
  - "[[I want to combine multiple reports into one import]]"
  - "[[I want to have an overview of all csv files in my Vault, so that I can import from the hub]]"
useCases:
  - "[[Import CSV as Notes]]"
  - "[[Handle Incremental Imports]]"
  - "[[Preview CSV File]]"
  - "[[Manage Import Configurations]]"
  - "[[Reuse Import Configurations]]"
  - "[[Monitor Import Reports]]"
---

## User Story

As a knowledge worker, I want to import CSV data into my vault as structured notes so that I can work with tabular data inside Obsidian using frontmatter properties, conflict-aware incremental updates, and reusable configurations.

## Functional Requirements

- [x] CSV Action View renders `.csv` files as interactive tables with sortable columns and row limits
- [x] Import wizard with 4-step flow: target folder, name column, column mappings, preview and execute
- [x] Column mapping interface allows renaming headers, excluding columns, and adding custom fields
- [x] Conflict strategies: skip (ignore existing), update (merge frontmatter), overwrite (replace note)
- [x] Incremental import detects existing notes and applies the chosen conflict strategy per row
- [x] Import progress events emitted during execution with completion summary (created, skipped, failed)
- [x] Save and load import configurations via `DataExchangeService` persistence (`dataExchange` storage key)
- [x] Hub Reports tab lists all vault CSV files with metadata (path, size, row/column count) and content preview
- [x] Hub Imports tab displays saved import configs with detail panel for review, edit, delete, and run
- [x] Load Config dropdown in Import Modal pre-fills all wizard fields from a saved configuration

## Acceptance Criteria

- [x] Opening a `.csv` file renders the CSV Action View with a formatted preview table
- [x] Import wizard creates one note per CSV row with correct YAML frontmatter
- [x] Conflict strategies (skip, update, overwrite) behave correctly for existing notes
- [x] Saved import configurations persist across plugin reloads
- [x] Hub Reports tab discovers and previews all vault CSV files
- [x] Hub Imports tab supports full CRUD on saved import configurations
- [x] `npm run build` passes
