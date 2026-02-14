---
type: UseCase
domain: Flowti
stage: done
description: "Import rows from a CSV file as individual Obsidian notes with frontmatter properties"
view: "[[CSV Action View]]"
feature: "[[Data Exchange Hub]]"
testplanRef: "UC-77"
tags:
  - use-case
  - csv
---

# Import CSV as Notes

## Summary

A user clicks "Import" on the CSV Action View landing page to launch the import wizard, configures how CSV rows map to vault notes, previews the result, and executes the import to create one note per row with structured frontmatter.

## Preconditions

- The Flowti IBDE plugin is installed and enabled.
- A `.csv` file is open in the CSV Action View, displaying the preview table.
- The CSV file contains a header row and at least one data row.
- The user has write access to the vault.

## Steps

1. **User clicks the "Import" button** on the CSV Action View landing page to enter the import wizard.
2. **System displays the target folder selection page** where the user picks or creates the vault folder that will contain the imported notes.
3. **User selects the name column** from a dropdown of CSV headers, choosing which column value becomes each note's filename.
4. **User maps CSV columns to frontmatter properties** using the column mapping interface, assigning each CSV header to a frontmatter key (or excluding it).
5. **User selects a conflict strategy** ("skip", "update", or "overwrite") to control how the import handles notes that already exist in the target folder.
6. **User clicks "Preview"** and the system renders a sample of the notes that will be created, showing the exact frontmatter and body content for each.
7. **User reviews the preview** and clicks "Execute Import" to begin the import process.
8. **System creates one note per CSV row** in the target folder, emitting progress events, and displays a completion summary with the count of created, skipped, and failed notes.

## Outcome

The target folder contains one Markdown note per CSV data row. Each note has a YAML frontmatter block with the mapped properties and the filename derived from the chosen name column. The user sees a summary confirming how many notes were created.

## Variations

- **Duplicate filenames in CSV**: When two rows produce the same filename, the conflict strategy determines whether the second row is skipped, merged, or overwrites the first.
- **Missing name column values**: Rows where the name column is empty are skipped, and the completion summary reports them as failures.
- **Cancel mid-wizard**: The user can close the wizard at any step without side effects; no notes are created until "Execute Import" is confirmed.
- **Large CSV import**: For CSVs with hundreds of rows, the system processes imports in batches and shows a progress bar during execution.

## Related

- View: [[CSV Action View]]
- Feature: [[Data Exchange Hub]]
- Test: UC-77 in [[Testplan]]
