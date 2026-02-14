---
type: UseCase
domain: Flowti
stage: done
description: "Open a CSV file and view it as a formatted, sortable table instead of raw text"
view: "[[CSV Action View]]"
feature: "[[Data Exchange Hub]]"
testplanRef: "UC-81"
tags:
  - use-case
  - csv
---

# Preview CSV File

## Summary

A user opens a `.csv` file in Obsidian and immediately sees the data rendered as a structured, interactive table with sorting and filtering capabilities, replacing the default raw-text view.

## Preconditions

- The Flowti IBDE plugin is installed and enabled.
- A `.csv` file exists in the vault (or is accessible via the file explorer).
- The CSV file contains a header row followed by one or more data rows.

## Steps

1. **User opens a `.csv` file** by clicking it in the Obsidian file explorer or using the Quick Switcher.
2. **System detects the `.csv` extension** and activates the CSV Action View instead of the default text editor.
3. **System parses the CSV content** using the CsvParser, extracting headers and data rows.
4. **System renders the landing page** displaying a formatted HTML table with all columns and rows, up to the configured max-row limit.
5. **User clicks a column header** to sort the table ascending or descending by that column's values.
6. **User toggles column visibility** using the column filter controls to hide irrelevant columns from the preview.
7. **User adjusts the max-row display setting** to view more or fewer rows if the CSV is large.
8. **System updates the table in real time** reflecting the current sort order, visible columns, and row limit.

## Outcome

The user sees the CSV data presented as a clean, readable table with interactive sort and filter controls. The raw comma-separated text is never shown. The landing page also provides action buttons (Import, Export) for further operations.

## Variations

- **Empty CSV**: If the file contains only a header row and no data, the system displays the column headers with an empty-state message indicating zero data rows.
- **Malformed CSV**: If the parser encounters inconsistent column counts or encoding issues, the system displays a warning banner above the table with details about the parsing problem.
- **Large CSV (many rows)**: When the CSV exceeds the max-row limit, the system renders only the first N rows and shows a notice indicating how many rows are hidden.
- **Single-column CSV**: The table renders with a single column; sort and filter controls still function normally.

## Related

- View: [[CSV Action View]]
- Feature: [[Data Exchange Hub]]
- Test: UC-81 in [[Testplan and Teststrategy]]
