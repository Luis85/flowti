---
type: KnowledgeBase
domain: Flowti
stage: done
description: How to set up import and export configurations and navigate the Data Exchange Hub.
tags:
  - tutorial
  - data-exchange
  - import
  - export
---

# Building Data Exchange Configs

> The Data Exchange Hub is where data flows in and out of your vault. This tutorial explains how to set up reusable import and export configurations so you can move data efficiently.

---

## What Is the Data Exchange Hub?

The **Data Exchange Hub** is the central place for managing all data movement. It handles imports (bringing external data into your vault as notes) and exports (sending vault data out as files). Open it from the command palette by searching for **Open data exchange hub**, or click its icon in the sidebar.

The Hub is organized into several tabs:

| Tab | Purpose |
|-----|---------|
| **Dashboard** | Overview of recent import and export activity |
| **Reports** | CSV files discovered in your vault, ready to preview or import |
| **Types** | A registry where you describe the kinds of data you work with |
| **Properties** | Every frontmatter property found across your vault |
| **Imports** | Your saved import configurations |
| **Exports** | Your saved export configurations |
| **Pipelines** | Multi-step import sequences |

You do not need to use every tab right away. Start with Reports and Imports, and explore the rest as your needs grow.

---

## Understanding Import Configurations

An import configuration is a saved recipe for turning a CSV file into vault notes. Instead of reconfiguring the import wizard every time you receive an updated file, you save the settings once and rerun them whenever you need to.

An import configuration captures:

- **Source file** — which CSV file to read
- **Target folder** — where the new notes should be created
- **Name column** — which CSV column becomes the note title
- **Column mappings** — how each CSV column maps to a frontmatter property
- **Conflict strategy** — what to do if a note with the same name already exists (skip, update, or overwrite)

Once saved, the configuration appears in the **Imports** tab. You can run it again with one click, edit it, or delete it when it is no longer needed.

For a detailed walkthrough of importing a CSV file, see [[Importing CSV Data]].

---

## Understanding Export Configurations

Export configurations work in the other direction. They take structured vault data — notes with frontmatter — and produce clean CSV or tab-delimited files you can share, email, or feed into other systems.

An export configuration captures:

- **Source** — which folder or database view to export from
- **Columns** — which frontmatter properties to include
- **Format** — CSV or tab-delimited
- **Output location** — where to save the exported file
- **Conflict strategy** — what to do if the output file already exists

### Creating an Export Configuration

1. Open the command palette and search for **Export as CSV** (or **Export as tab-delimited**)
2. Alternatively, **right-click** on a folder or `.base` file and choose the export option
3. Walk through the wizard:
   - **Configure** — select columns, set the output format and destination
   - **Preview** — review the tabular output before writing
   - **Result** — the file is created
4. When the export completes, you will be offered the option to save the configuration for reuse

A saved export turns a recurring reporting task into a one-click operation. Weekly status report? Save the config and run it every Friday.

---

## The Properties Tab

As you import data and create notes, frontmatter properties accumulate across your vault. The **Properties** tab in the Data Exchange Hub shows all of them in one place.

For each property, you can see:

- How many notes use it
- What values it typically contains
- Whether it has been documented

Take a few minutes to browse through and add short descriptions to the most important properties. This small act of documentation pays forward — the next person who encounters a property called `status` will know whether it means "draft / done" or "open / closed / archived."

---

## Pipelines — Chaining Imports Together

When you have multiple saved import configurations, you can combine them into a **Pipeline** — a sequence of steps that run one after another.

Pipelines are useful when:

- You receive multiple CSV files from different sources each week
- The files need to be imported in a specific order
- You want to press one button instead of running imports individually

To create a pipeline:

1. Open the **Data Exchange Hub** and go to the **Pipelines** tab
2. Click **+** to create a new pipeline
3. Add your saved import configurations as steps
4. Drag to reorder if needed
5. Choose whether to stop on errors or continue
6. Save and run

The pipeline shows progress per step — how many rows were processed, which steps succeeded, and whether anything needs attention.

---

## Tips for Effective Configurations

**Name your configurations clearly.** "Weekly Sales Import" is better than "Import 1." Future you will thank present you.

**Use the update conflict strategy** for recurring imports. If you receive an updated CSV each week, "update" will refresh existing notes without creating duplicates.

**Document your properties.** The Properties tab is your data dictionary in the making. A few minutes of documentation now saves hours of confusion later.

**Start with one import and one export.** Get comfortable with the round-trip before building pipelines or complex configurations.

---

## Next Steps

- [[Importing CSV Data]] — Step-by-step guide for your first CSV import
- [[Connecting to Azure DevOps]] — Pull work items directly from Azure DevOps
- [[Creating Analytics Queries]] — Query the data you imported
