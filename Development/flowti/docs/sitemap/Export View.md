---
stage: development
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
tags:
  - core
  - view
description: Wizard for exporting vault data as CSV or tab-delimited files
type: View
viewType: flowti-export
extends: ItemView
source: "[[Development/flowti/src/ui/ExportView.ts|ExportView.ts]]"
feature: "[[Data Exchange Hub]]"
---

# Export View

## Description

The Export View is a dedicated wizard for exporting vault data as CSV or tab-delimited files. It is triggered from context menus on folders or `.base` files, from the command palette, or from the Data Exchange Hub.

The view follows a multi-step wizard layout with a horizontal stepper: **View Select** (for `.base` sources with multiple views), **Configure** (columns, output path, conflict strategy), **Preview** (tabular preview of the export), and **Result** (success/error summary).

Exports can target either the vault (creates a file inside Obsidian) or the filesystem (uses a native save dialog to write outside the vault). Column selection supports both frontmatter properties and file metadata fields.

## Use Cases

### Export a Base view as CSV
Right-click a `.base` file in the file navigator and select "Export as CSV". The wizard parses the Base YAML, resolves formula columns, and lets you select which columns and file properties to include. Preview the output before exporting.

### Export a folder's notes as tab-delimited
Right-click a folder and select "Export as Tab-delimited". The wizard scans all notes in the folder, discovers their frontmatter properties, and generates a `.txt` file with tab-separated values.

### Save to the filesystem
Click the "Save to filesystem" button to open a native save dialog and write the export outside the vault. Useful for providing data to external systems or sharing with colleagues.

### Handle export conflicts
Choose between overwrite, skip, or append strategies when the output file already exists. The append strategy strips the header row from the new data and concatenates it to the existing file.

### Reuse export configurations
Save an export configuration for repeat use. Load a saved config to pre-fill source path, format, columns, and output path. Saved configs are also accessible from the Data Exchange Hub.

### Export with display name mapping
Rename columns in the export output using display name mappings. This lets you produce clean, human-readable headers without changing the underlying frontmatter property names.
