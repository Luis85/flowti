---
type: UseCase
domain: Flowti
stage: done
description: "Import only new or changed rows from a periodically refreshed CSV using conflict strategies"
view: "[[CSV Action View]]"
feature: "[[Data Exchange Hub]]"
testplanRef: "UC-80"
tags:
  - use-case
  - csv
---

# Handle Incremental Imports

## Summary

A user performs recurring imports from a CSV that is periodically refreshed with new or updated rows. By choosing the "skip" or "update" conflict strategy, the user ensures that only new data is imported or existing notes are merged with updated values, avoiding duplication or data loss.

## Preconditions

- The Flowti IBDE plugin is installed and enabled.
- A `.csv` file is open in the CSV Action View.
- The target folder already contains notes from a previous import of an earlier version of the same CSV.
- The CSV has been refreshed with new rows, updated rows, or both.

## Steps

1. **User opens the updated CSV file** in the CSV Action View and reviews the preview table to confirm new or changed data is present.
2. **User clicks "Import"** to enter the import wizard and selects the same target folder used in the previous import.
3. **User configures the name column and column mappings** (or loads a saved configuration from a previous import).
4. **User selects the conflict strategy** from the dropdown: "skip" to import only rows that do not already have a corresponding note, or "update" to merge new frontmatter values into existing notes.
5. **User clicks "Preview"** and the system analyzes the target folder, identifying which rows would create new notes, which would be skipped, and which would update existing notes.
6. **User reviews the preview summary** showing counts of new, skipped, and to-be-updated notes.
7. **User clicks "Execute Import"** and the system processes each row according to the selected conflict strategy.
8. **System displays a completion summary** reporting the exact count of notes created, notes skipped (already existing), and notes updated with new data.

## Outcome

The target folder reflects the latest state of the CSV. New rows have become new notes, unchanged rows are untouched (skip) or left as-is, and updated rows have their frontmatter merged with the latest values (update). No duplicate notes are created, and no existing data is lost.

## Variations

- **Skip strategy with all rows existing**: If every CSV row already has a corresponding note, the import completes with zero new notes and reports all rows as skipped.
- **Update strategy with new properties**: When the updated CSV introduces columns not present in the saved config, the user adjusts the column mapping to include the new properties before executing.
- **Overwrite strategy**: The user selects "overwrite" instead when they want to fully replace existing notes with the CSV data, discarding any manual edits made to those notes since the last import.
- **Saved config for recurring import**: The user loads a saved import configuration to ensure consistent mapping across repeated imports, only changing the conflict strategy as needed.
- **Deleted rows in CSV**: Rows that existed in a prior CSV but are absent from the updated CSV are not affected; their corresponding notes remain in the vault.

## Related

- View: [[CSV Action View]]
- Feature: [[Data Exchange Hub]]
- Test: UC-80 in [[Testplan and Teststrategy]]
