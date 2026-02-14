---
type: UseCase
domain: Flowti
stage: done
description: "Automatically generate an Obsidian .base file alongside imported notes for structured exploration"
view: "[[CSV Action View]]"
feature: "[[Data Exchange Hub]]"
testplanRef: "UC-82"
tags:
  - use-case
  - csv
---

# Create Base File with Import

## Summary

A user enables the "Create Base" option during a CSV import so that, in addition to the individual notes, the system generates an Obsidian `.base` file referencing the imported folder. This provides immediate structured, database-like exploration of the imported data.

## Preconditions

- The Flowti IBDE plugin is installed and enabled.
- A `.csv` file is open in the CSV Action View and the user has entered the import wizard.
- The user has configured the target folder and column mappings.
- Obsidian supports `.base` files (Properties / Database view).

## Steps

1. **User configures the import** by selecting the target folder, name column, and column mappings as usual.
2. **User enables the "Create Base" toggle** on the configuration page of the import wizard.
3. **System displays a base-file name field** pre-filled with the target folder name, which the user can edit.
4. **User proceeds to the preview step** where the system shows the notes that will be created along with a summary of the `.base` file that will be generated.
5. **User clicks "Execute Import"** to begin the import process.
6. **System creates all notes** in the target folder with the configured frontmatter mappings.
7. **System generates the `.base` file** in the target folder with a YAML definition that uses an `inFolder` filter pointing to the imported notes and includes columns derived from the mapped frontmatter properties.
8. **User opens the generated `.base` file** and sees all imported notes displayed in Obsidian's structured database view with sortable, filterable columns matching the import mapping.

## Outcome

The target folder contains the imported notes and a `.base` file. Opening the `.base` file presents a database-style view of all imported notes with columns corresponding to the frontmatter properties defined during import. The user can immediately sort, filter, and explore the data without manual setup.

## Variations

- **Base file already exists**: If a `.base` file with the same name already exists in the target folder, the system applies the import's conflict strategy (skip, update, or overwrite) to the base file as well.
- **Subset of columns in base**: The user can deselect columns from the base file's column list during configuration so that only the most relevant properties appear in the database view.
- **Import without base**: When the "Create Base" toggle is left off (default), the import proceeds normally and no `.base` file is generated.
- **Re-import with existing base**: On subsequent imports to the same folder, the existing `.base` file continues to work because new notes matching the folder filter are automatically included.

## Related

- View: [[CSV Action View]]
- Feature: [[Data Exchange Hub]]
- Test: UC-82 in [[Testplan and Teststrategy]]
