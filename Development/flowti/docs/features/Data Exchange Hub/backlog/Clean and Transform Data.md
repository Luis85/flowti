---
type: UseCase
domain: Flowti
stage: done
description: "Rename, exclude, or add frontmatter properties during CSV import using column mapping"
view: "[[CSV Action View]]"
feature: "[[Data Exchange Hub]]"
testplanRef: "UC-79"
tags:
  - use-case
  - csv
---

# Clean and Transform Data

## Summary

A user leverages the column mapping step of the import wizard to rename CSV headers into clean frontmatter property names, exclude irrelevant columns, and add custom fields, then previews the exact output before committing the import.

## Preconditions

- The Flowti IBDE plugin is installed and enabled.
- A `.csv` file is open in the CSV Action View and the user has entered the import wizard.
- The CSV contains headers that need renaming, removal, or augmentation before becoming frontmatter.

## Steps

1. **User enters the import wizard** and configures the target folder and name column on the first pages.
2. **System displays the column mapping interface** listing every CSV header with an editable frontmatter property name field and an include/exclude toggle.
3. **User renames a CSV header** (e.g., changes "emp_id" to "employeeId") by editing the frontmatter property name field for that column.
4. **User excludes irrelevant columns** (e.g., "internal_notes", "temp_flag") by toggling them off so they will not appear in the generated notes.
5. **User adds a custom frontmatter field** (e.g., "source: quarterly-report-2026") that will be applied uniformly to every imported note.
6. **User clicks "Preview"** and the system renders sample notes showing the exact YAML frontmatter and body content that will be written.
7. **User reviews the preview**, confirms that property names are correct, excluded columns are absent, and custom fields are present.
8. **User clicks "Execute Import"** and the system creates notes with the cleaned and transformed frontmatter as previewed.

## Outcome

Each imported note contains only the desired frontmatter properties with clean, consistent naming. Excluded columns do not appear anywhere in the notes. Any custom fields the user added are present in every note's frontmatter. The data is vault-ready without post-import cleanup.

## Variations

- **All columns excluded except name**: If the user excludes every column except the name column, each note is created with minimal frontmatter (just the mapped properties and any custom fields).
- **Duplicate property names**: If the user maps two CSV columns to the same frontmatter key, the system warns about the conflict and prevents execution until it is resolved.
- **Special characters in headers**: CSV headers containing spaces, dots, or special characters are automatically sanitized into valid YAML property names, with the user able to further edit the suggestion.
- **Undo changes**: The user can reset the column mapping to its original auto-detected state by clicking a reset button before executing.

## Related

- View: [[CSV Action View]]
- Feature: [[Data Exchange Hub]]
- Test: UC-79 in [[Testplan and Teststrategy]]
