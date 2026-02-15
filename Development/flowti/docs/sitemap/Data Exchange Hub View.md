---
stage: development
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
tags:
  - core
  - view
description: Central management hub for import and export operations
type: View
viewType: flowti-data-exchange-hub
extends: ItemView
source: "[[Development/flowti/src/ui/DataExchangeHubView.ts|DataExchangeHubView.ts]]"
feature: "[[Data Exchange Hub]]"
parent: "[[User Hub View]]"
---

# Data Exchange Hub View

## Description

The Data Exchange Hub is the central management view for all import and export operations. It provides a master-detail layout across 7 tabs: **Dashboard**, **Imports**, **Exports**, **Reports**, **Properties**, **Pipelines**, and **Types**.

The hub acts as the operational control center for data flowing in and out of the vault. It tracks saved configurations, provides a data dictionary for documenting frontmatter properties, manages multi-step import pipelines, and catalogs CSV reports and type documentation.

## Use Cases

### Manage saved import configurations
The Imports tab lists all saved import configurations. Select one to review its settings (target folder, name column, column mappings, conflict strategy). Edit, duplicate, delete, or run an import directly from the detail panel.

### Manage saved export configurations
The Exports tab lists all saved export configurations. Review source path, format, output path, selected columns, and conflict strategy. Run an export, edit settings, or open the source file from the detail panel.

### Build a data dictionary
The Properties tab shows all frontmatter properties discovered across the vault. Select a property to document its purpose, expected values, and related domains. Documented properties are marked with a badge in the master list.

### Monitor import reports
The Reports tab surfaces CSV files in the vault. Select a report to see its metadata, preview content, and quickly launch an import with pre-filled settings.

### Orchestrate multi-step pipelines
The Pipelines tab manages multi-import pipelines that chain several import configurations into a single sequential run. Create, edit, reorder steps, and execute full pipelines from the detail panel.

### Document data types
The Types tab provides a registry for documenting the various data types (note types, record schemas) used across import and export configurations.

### Dashboard overview
The Dashboard tab shows aggregate counts for imports, exports, pipelines, and vault CSV files. Quick-action buttons let you start a new import, export, or open a CSV file directly.
