---
type: Flow
domain: Flowti
stage: done
description: "Import a canvas file as typed vault notes with configurable mappings, type exclusion, and artifact generation"
domains:
  - Canvas
  - Data Exchange
services:
  - CanvasService
  - CanvasParser
  - CanvasImporter
  - CanvasRebuilder
  - CanvasBaseGenerator
  - InboxService
events:
  - canvas.import.started
  - canvas.import.progress
  - canvas.import.completed
  - canvas.import.failed
  - canvas.legend.detected
  - canvas.entity.detected
  - canvas.config.saved
  - inbox.itemAdded
tags:
  - canvas
  - import
  - flow
---

# Import Canvas as Notes

## Overview

This flow describes how a user imports an Obsidian `.canvas` file into structured vault notes. Each canvas node becomes a typed markdown note with frontmatter containing type, parent relationships (from groups), and directional relationships (from edges). The importer supports color/shape-to-type mapping with Legend group override, three hierarchy modes, type exclusion, and optional artifact generation (rebuilt canvas, .base index).

## Trigger

- Right-click `.canvas` file → "Import Canvas" context menu item
- `flowti:import-canvas` command from command palette
- "Import" action from Data Exchange Hub Canvas tab
- Quick-run from Canvas Action View landing page (saved config)
- Pipeline execution containing canvas config steps

## Steps

### 1. Open Canvas Action View

**View**: CanvasActionView
**User Action**: Right-clicks `.canvas` file and selects "Import Canvas"
**System Response**: Opens Canvas Action View with landing page. If a saved config exists for this canvas path, it appears in the saved configs list.

### 2. Review Landing Page

**View**: CanvasLanding
**User Action**: Reviews canvas file info, saved config count, and last imported date
**System Response**: Displays dashboard stats and saved configurations with quick-run buttons

### 3. Configure Import Settings

**View**: CanvasConfigPage
**User Action**: Sets target folder, conflict strategy, hierarchy mode, color/shape mappings, type exclusion, artifact toggles
**System Response**: Split layout — general settings on left, mappings + type exclusion on right. Config name enables Save button.

### 4. Save Configuration (optional)

**View**: CanvasConfigPage
**User Action**: Enters config name and clicks "Save"
**System Response**: Saves config via CanvasService. Emits `canvas.config.saved`.
**Events**: `canvas.config.saved`

### 5. Parse and Preview

**View**: CanvasPreviewPage
**User Action**: Clicks "Preview" from config page
**System Response**:
1. Reads canvas JSON from vault
2. Parses into `CanvasData`
3. Extracts Legend group (if present) → emits `canvas.legend.detected`
4. Builds typed `CanvasItem[]` using color/shape maps
5. Resolves spatial parentage (groups contain children)
6. Builds directional relations from edges
7. Filters out Legend group nodes and excluded types
8. Shows impact summary: notes to create, type distribution, folder structure, legend

**Events**: `canvas.legend.detected` (if legend found)

### 6. Review Impact

**View**: CanvasPreviewPage
**User Action**: Reviews "What will happen" summary, type distribution table, group/product structure, detected legend
**Decision**: Proceed with import or go back to adjust settings

### 7. Execute Import

**View**: CanvasResultPage
**User Action**: Clicks "Import"
**System Response**:
1. Emits `canvas.import.started`
2. Per filtered item: creates vault note with frontmatter → emits `canvas.import.progress`
3. Each note gets: type, parent (wikilink to group slug), up/down/prev/next (wikilinks to related node slugs)
4. Conflict strategy applied per note (skip existing, update frontmatter, overwrite)
5. On completion: emits `canvas.import.completed`
6. If `createCanvas`: rebuilds canvas with file-node references
7. If `createBase`: writes `.base` index file
8. Reveals target folder in file explorer

**Events**: `canvas.import.started` → `canvas.import.progress` (×N) → `canvas.entity.detected` (×N) → `canvas.import.completed`

### 8. Review Results

**View**: CanvasResultPage
**User Action**: Reviews "What happened" summary, per-type breakdown, error details, artifact links
**System Response**: Shows import stats (imported, skipped, errors, duration), type breakdown table, first 20 errors (if any), artifact links (rebuilt canvas, base index)

### 9. Post-Import Actions

**View**: CanvasResultPage
**User Action**: Clicks "Open Target Folder", "Open Canvas", "Open Base View", "Run Again", "Edit Config", or "Close"
**System Response**: Navigates to selected destination. "Run Again" re-executes same config. "Edit Config" returns to config page.

### 10. Inbox Notification

**Service**: InboxService
**System Response**: On `canvas.import.completed`, creates inbox item with import summary (notes created, errors). On `canvas.import.failed`, creates error notification.
**Events**: `inbox.itemAdded`

## Decision Points

| Decision | Options | Default |
|----------|---------|---------|
| Hierarchy mode | Flat, Product (type subfolders), Group (canvas group subfolders) | Flat |
| Conflict strategy | Skip (don't overwrite), Update (merge frontmatter), Overwrite (replace) | Skip |
| Type exclusion | Any type can be excluded via checkbox grid | All included |
| Create rebuilt canvas | Yes / No | Yes |
| Create .base index | Yes / No | Yes |
| Color mapping | 6 colors → configurable types | Issue, Epic, Task, Test, Deliverable, Feature |
| Shape mapping | 7 shapes → configurable types | Event, Gateway, Data, Document, Database, Subprocess, Terminator |

## Event Sequence

```
canvas.import.started
  → canvas.import.progress (×N per node)
    → canvas.entity.detected (×N per node)
  → canvas.import.completed
    → inbox.itemAdded

(on failure):
canvas.import.failed
  → inbox.itemAdded
```

## Quick-Run (Saved Config)

When running a saved config from the landing page or right-click context menu:
1. Canvas Action View opens in auto-run mode
2. Skips landing and config pages
3. Jumps directly to result page
4. Executes `CanvasService.runImport(configId)` immediately
5. Shows live progress → completion summary

## Pipeline Execution

When a canvas config is part of a pipeline:
1. PipelineExecutor iterates `canvasConfigIds` after CSV sources
2. Calls `CanvasService.runImport(configId)` per canvas step
3. Aggregates results into pipeline totals (created, skipped, failed)
4. Emits `dataExchange.pipeline.sourceCompleted` per canvas step
5. Per-step errors don't stop the pipeline

## Related Use Cases

- [[Import CSV as Notes]] — CSV import follows a similar wizard pattern
- [[Build Import Pipeline]] — Canvas configs as pipeline input steps
- [[Manage Data Dictionary]] — Imported note properties feed the data dictionary

## Related Decisions

- [[ADR-034 HTTP Integration Patterns]] — Pattern precedent for external integrations
