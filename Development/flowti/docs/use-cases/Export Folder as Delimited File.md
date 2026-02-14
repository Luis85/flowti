---
type: UseCase
domain: Flowti
stage: done
description: "Export all notes in a folder as a tab-delimited text file by right-clicking the folder"
view: "[[Export View]]"
feature: "[[Data Exchange Hub]]"
testplanRef: "UC-84"
tags:
  - use-case
  - export
---

# Export Folder as Delimited File

## Summary

A user right-clicks a folder in the file navigator and exports all of its notes as a tab-delimited `.txt` file, with columns automatically discovered from the notes' frontmatter properties.

## Preconditions

- A folder exists in the vault containing one or more Markdown notes with frontmatter properties.
- The user has write access to the target output location.

## Steps

1. Right-click a folder in the Obsidian file navigator and select **"Export as CSV/Tab"** from the context menu.
2. The Export wizard opens with the source path pre-filled to the selected folder and the source type set to "folder".
3. The wizard scans all `.md` files in the folder using the injected `listFiles` callback and discovers the union of all frontmatter property keys across every note.
4. The discovered properties are presented as column checkboxes. Select the columns to include or leave all checked for a full export.
5. Set the output format to **Tab** in the format dropdown. The default output filename updates to a `.txt` extension.
6. Specify an output file path or accept the default (same folder, named after the source folder).
7. Review the preview table showing discovered columns and the first rows of tab-separated data.
8. Click **Export** to generate the `.txt` file with tab-delimited values.

## Outcome

A `.txt` file is created at the specified path containing a header row with the selected property names separated by tabs, followed by one row per note. Notes missing a given property have an empty cell for that column. A success notice confirms the export.

## Variations

- **Nested subfolders**: Only direct children of the selected folder are scanned; nested subfolders are not traversed unless the base view filter specifies recursive matching.
- **CSV format instead**: The user may switch the format dropdown to "CSV" to produce a comma-separated `.csv` file instead.
- **No frontmatter**: Notes without any frontmatter contribute a row of empty cells (except for file-property columns like `file.name` if selected).
- **Single-column export**: When only one column is selected, the output contains no delimiter characters since there is nothing to separate.

## Related

- View: [[Export View]]
- Feature: [[Data Exchange Hub]]
- Test: UC-84 in [[Testplan]]
