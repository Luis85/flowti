---
type: ProductBacklogItem
feature: "[[Data Exchange Hub PRD]]"
priority: high
stage: done
userStories:
  - "[[I want to have an overview of all bases in my Vault, so that I can export from the hub]]"
useCases:
  - "[[Export Base View as CSV]]"
  - "[[Export Folder as Delimited File]]"
  - "[[Format and Column Selection]]"
  - "[[Handle Export Conflicts]]"
  - "[[Save Export to Filesystem]]"
  - "[[Manage Export Configurations]]"
  - "[[Reuse Export Configurations]]"
---

## User Story

As a knowledge worker, I want to export vault notes and base views as CSV or tab-delimited files so that I can share structured data with external tools, colleagues, or backup systems, with full control over format, columns, conflict handling, and output destination.

## Functional Requirements

- [x] Export wizard launched from file-menu context actions on `.base` files and folders
- [x] Base view export: parse `.base` YAML, resolve `formula.X` references, discover columns from matched notes
- [x] Folder export: scan all `.md` files, discover union of frontmatter properties as columns
- [x] Column selection with checkboxes, display name mapping for custom headers, and file property toggles
- [x] Format selection: CSV (comma-separated `.csv`) or Tab (tab-delimited `.txt`)
- [x] Conflict strategies for existing output files: overwrite, skip, append (strip header and concatenate)
- [x] External filesystem export via Electron `remote.dialog.showSaveDialog` with `isExternal` flag
- [x] `WriteExternalFileCallback` using Node.js `fs.writeFileSync` + `fs.mkdirSync` for external output
- [x] Save and load export configurations via `DataExchangeService` persistence
- [x] Hub Exports tab displays saved export configs with detail panel for review, edit, delete, and run

## Acceptance Criteria

- [x] Right-clicking a `.base` file or folder shows "Export as CSV/Tab" context menu item
- [x] Export wizard produces correct CSV and tab-delimited output with selected columns
- [x] Formula columns in base views resolve to actual frontmatter property names
- [x] Conflict strategies (overwrite, skip, append) work for both vault and external files
- [x] "Save to filesystem" button opens native save dialog and writes outside the vault
- [x] Saved export configurations persist and reload correctly across sessions
- [x] Hub Exports tab supports full CRUD on saved export configurations
- [x] `npm run build` passes
