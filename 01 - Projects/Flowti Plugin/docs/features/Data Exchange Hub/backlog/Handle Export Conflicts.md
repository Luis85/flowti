---
type: UseCase
domain: Flowti
stage: done
description: "Choose a conflict resolution strategy when the export output file already exists"
view: "[[Export View]]"
feature: "[[Data Exchange Hub]]"
testplanRef: "UC-86"
tags:
  - use-case
  - export
---

# Handle Export Conflicts

## Summary

A user selects a conflict resolution strategy (overwrite, skip, or append) when the target export file already exists, allowing control over whether existing data is replaced, preserved, or extended.

## Preconditions

- The Export wizard is open with a valid source and columns selected.
- A file already exists at the intended output path (either in the vault or on the filesystem).

## Steps

1. Configure the export source, columns, and format in the Export wizard as usual.
2. Specify an output path that points to an **existing file**.
3. In the configure page, locate the **Conflict Strategy** dropdown and select one of: **Overwrite**, **Skip**, or **Append**.
4. If **Overwrite** is selected, proceed to preview. The existing file will be completely replaced with the new export data.
5. If **Skip** is selected, the wizard checks whether the file exists. If it does, the export returns a `{ skipped: true }` result immediately and a notice informs the user that the file was skipped.
6. If **Append** is selected, the wizard reads the existing file content (via `ReadExternalFileCallback` for filesystem files or `FileSystemClient` for vault files), strips the header row from the new export content, and concatenates the data rows to the end of the existing file.
7. Review the preview table (for overwrite/append) to verify the data that will be written.
8. Click **Export** to execute the chosen conflict strategy.

## Outcome

The export completes according to the selected strategy: the file is replaced (overwrite), left untouched with a skip notice (skip), or extended with new rows appended below the existing data (append). A success or skip notice confirms the result.

## Variations

- **Append with mismatched columns**: If the existing file has different column headers than the new export, the append concatenates rows as-is. Column alignment is the user's responsibility.
- **File does not exist**: All three strategies behave identically when the target file is new -- the file is created with header and data rows regardless of the selected strategy.
- **External filesystem conflict**: The same strategies apply when `isExternal` is true. The `ReadExternalFileCallback` reads the existing external file for the append strategy.

## Related

- View: [[Export View]]
- Feature: [[Data Exchange Hub]]
- Test: UC-86 in [[Testplan and Teststrategy]]
