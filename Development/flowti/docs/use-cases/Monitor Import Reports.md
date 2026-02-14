---
type: UseCase
domain: Flowti
stage: done
description: "Browse vault CSV files and launch imports from the Hub Reports tab"
view: "[[Data Exchange Hub View]]"
feature: "[[Data Exchange Hub]]"
testplanRef: "UC-71"
tags:
  - use-case
  - hub
---

# Monitor Import Reports

## Summary

The user browses CSV files present in the vault through the Hub's Reports tab, previewing their content and metadata, and quickly launching an import with pre-filled settings from any selected report.

## Preconditions

- The Data Exchange Hub view is open.
- The vault contains at least one `.csv` file.
- The metadata cache has indexed the vault so CSV files are discoverable.

## Steps

1. The user opens the Data Exchange Hub and selects the **Reports** tab from the tab bar.
2. The master list displays all CSV files found in the vault, showing each file's name, folder location, and file size.
3. The user selects a CSV file from the list to open its detail panel.
4. The detail panel renders the file's metadata: path, size, last modified date, and number of rows/columns detected.
5. The detail panel shows a content preview table with the first several rows of the CSV, including headers and sample data.
6. The user clicks **Import** to launch an import using this CSV file; the system opens the Import Modal with the source file, detected columns, and a suggested target folder pre-filled.
7. The user adjusts any settings in the pre-filled Import Modal (such as column mappings or conflict strategy) and confirms the import.
8. After the import completes, the user returns to the Reports tab where the selected file remains highlighted for reference.

## Outcome

The user has reviewed a vault CSV file's metadata and content preview, then launched an import with pre-filled settings, reducing manual configuration and speeding up the import workflow.

## Variations

- **No CSV files in vault**: The master list shows an empty state with guidance on how to add CSV files to the vault.
- **Large CSV preview**: For CSV files with many rows, the preview table is truncated to a configurable number of rows with an indicator showing total row count.
- **Malformed CSV**: If a CSV file cannot be parsed, the detail panel shows an error message instead of the preview table, but metadata is still displayed.
- **Open source file**: The user clicks a link to open the CSV file directly in Obsidian's editor for manual inspection before importing.

## Related

- View: [[Data Exchange Hub View]]
- Feature: [[Data Exchange Hub]]
- Test: UC-71 in [[Testplan and Teststrategy]]
