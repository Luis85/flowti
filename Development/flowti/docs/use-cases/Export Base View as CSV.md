---
type: UseCase
domain: Flowti
stage: done
description: "Export a .base view to CSV by right-clicking and walking through the export wizard"
view: "[[Export View]]"
feature: "[[Data Exchange Hub]]"
testplanRef: "UC-83"
tags:
  - use-case
  - export
---

# Export Base View as CSV

## Summary

A user right-clicks a `.base` file in the file navigator and exports its contents as a CSV file, with full control over which columns and file properties appear in the output.

## Preconditions

- A `.base` file exists in the vault with valid YAML defining a view (filters, column order, and optionally formulas).
- The notes referenced by the base view contain frontmatter properties that match the view's column definitions.

## Steps

1. Right-click a `.base` file in the Obsidian file navigator and select **"Export as CSV/Tab"** from the context menu.
2. The Export wizard opens with the source path pre-filled to the selected `.base` file and the source type set to "base".
3. The wizard parses the Base YAML, resolves any `formula.X` references in the view order against the `formulas` section, and presents the discovered columns as checkboxes.
4. Select or deselect individual columns to include in the export. Optionally toggle file properties (e.g., `file.name`, `file.path`) to add them as extra columns.
5. Choose **CSV** as the output format and specify an output file path within the vault (or accept the default).
6. Review the live preview table showing the first rows of the export with the selected columns and resolved formula values.
7. Click **Export** to generate the `.csv` file and write it to the vault.

## Outcome

A `.csv` file is created at the specified output path containing one header row (matching the selected columns) followed by one data row per note matched by the base view's filters. A success notice confirms the file path and row count.

## Variations

- **Formula columns present**: When the base view defines formulas, the wizard resolves `formula.X` entries to their underlying frontmatter property names. If no `formulas` section exists, the formula name is used as-is.
- **Empty base view**: If the base view's filters match zero notes, the export produces a file with only the header row and displays a warning notice.
- **Tab-delimited format**: The user may switch the format dropdown to "Tab" instead of CSV, producing a `.txt` file with tab separators.

## Related

- View: [[Export View]]
- Feature: [[Data Exchange Hub]]
- Test: UC-83 in [[Testplan and Teststrategy]]
