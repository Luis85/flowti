---
stage: development
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
tags:
  - core
  - view
  - canvas
description: Canvas file importer with 4-page wizard (landing, configure, preview, result)
type: View
viewType: flowti-canvas
extends: ItemView
source: "[[Development/flowti/src/ui/CanvasActionView.ts|CanvasActionView.ts]]"
feature: "[[Obsidian Canvas Integration]]"
parent: "[[Data Exchange Hub View]]"
---

# Canvas Action View

## Description

The Canvas Action View provides a dedicated import workflow for `.canvas` files. Unlike the CSV Action View (which extends `TextFileView`), this view uses `ItemView` because Obsidian owns the `.canvas` file extension and does not allow custom file handlers for it.

The view navigates through 4 pages: a **landing page** showing canvas file info and saved configurations, a **configuration page** with split layout for general settings and color/shape mappings, a **preview page** showing impact analysis and type distribution, and a **result page** with live progress bar and post-import summary.

Key features include color/shape-to-type mapping with Legend group override, spatial group-to-parent containment, edge-to-relationship direction mapping, type exclusion filtering, hierarchy modes (flat, product, group), optional rebuilt canvas file creation, optional `.base` index file creation, and configuration persistence for repeatable imports.

## Use Cases

### Import a canvas as typed vault notes
Right-click a `.canvas` file in the file explorer → "Import Canvas". The wizard opens, pre-filled with the canvas path. Configure the target folder, mappings, and conflict strategy, then preview the impact before executing. Each canvas node becomes a vault note with typed frontmatter (type, parent, relationships).

### Use Legend group for custom type mapping
If your canvas contains a group named "Legend" with color-coded nodes labeled with type names, the importer detects and uses these as overrides to the default color-to-type mapping. The preview page shows the detected legend before import.

### Exclude specific types from import
In the configuration page, use the type exclusion grid to deselect types you don't want to import. The preview page shows the excluded count and the result page confirms which types were filtered.

### Run a saved configuration
On the landing page, select a saved configuration and click "Run" for immediate import without re-configuring. Saved configs are also accessible from the Data Exchange Hub's Canvas tab and from the right-click context menu as quick-run items.

### Include canvas configs in pipelines
Saved canvas configurations can be added as input steps in multi-import pipelines, allowing a single pipeline run to orchestrate both CSV and canvas imports.

### Create artifacts alongside import
Enable "Create rebuilt canvas" to generate a `.canvas` file where text nodes are replaced with file-node references to the imported notes. Enable "Create .base index" to generate a table-view index of all imported notes.

## Related Flows

These flow docs describe end-to-end user journeys that pass through this view:

- [[Import Canvas as Notes]] — The primary flow: right-click canvas → configure → preview → import → review results
- [[Build Import Pipeline]] — Saved canvas configs become input steps in multi-import pipelines

## Related Decisions

- [[ADR-034 HTTP Integration Patterns]] — Established patterns for external service integration
