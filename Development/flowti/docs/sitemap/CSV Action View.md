---
stage: development
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
tags:
  - core
  - view
description: CSV file viewer and import wizard
type: View
viewType: flowti-csv
extends: TextFileView
source: "[[Development/flowti/src/ui/CsvActionView.ts|CsvActionView.ts]]"
---

# CSV Action View

## Description

The CSV Action View replaces Obsidian's default text rendering for `.csv` files. It extends `TextFileView`, meaning it opens automatically when a CSV file is clicked in the file navigator.

The view has two modes: a **landing page** that shows a formatted preview of the CSV data, and a **3-step import wizard** (Configure, Preview, Result) that converts CSV rows into individual vault notes with YAML frontmatter.

Key features include automatic delimiter detection (comma, semicolon, tab), column-to-frontmatter mapping, conflict resolution strategies (skip, update, overwrite), optional `.base` file creation for the imported notes, and configuration persistence for repeat imports.

## Use Cases

### Preview a CSV file
Open any `.csv` file in Obsidian. The landing page renders a formatted table with sorting, column filtering, and configurable max-row display. This replaces the raw text view with a structured data preview.

### Import CSV rows as vault notes
Click "Import" on the landing page to enter the wizard. Configure the target folder, select which column provides the note filename, map CSV columns to frontmatter properties, and choose how to handle existing notes. Preview the mapping before executing.

### Reuse import configurations
Save an import configuration for repeat use. When opening the same or a similar CSV, load a saved config to pre-fill all settings. Saved configs are also accessible from the Data Exchange Hub.

### Create a Base file alongside import
Enable the "Create Base" option during import to automatically generate an Obsidian `.base` file that references the imported notes. This provides immediate structured exploration of the imported data.

### Clean and transform data before import
Use the column mapping step to rename properties, exclude irrelevant columns, or add custom frontmatter fields. The preview step shows exactly what each note will contain before committing.

### Handle incremental imports
Choose the "skip" conflict strategy to only import new rows, or "update" to merge new data into existing notes. This supports recurring imports where the CSV is periodically refreshed.
