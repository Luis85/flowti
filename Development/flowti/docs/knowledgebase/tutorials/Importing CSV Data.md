---
type: KnowledgeBase
domain: Flowti
stage: done
description: Step-by-step guide for importing a CSV file as vault notes, including column mapping, previewing, and running the import.
tags:
  - tutorial
  - data-exchange
  - csv
  - import
---

# Importing CSV Data

> Turn a spreadsheet export into structured vault notes. This tutorial walks you through every step of the CSV import process, from selecting a file to reviewing the results.

---

## Before You Begin

Make sure your CSV file is already in your vault. You can drop it into any folder — Flowti will discover it automatically. The file should have a header row with column names in the first line and one record per row after that.

If you are not sure whether your file is formatted correctly, open the **Data Exchange Hub** (search for **Open data exchange hub** in the command palette) and navigate to the **Reports** tab. Every CSV file in your vault appears here with a preview. Check that the columns and rows look right before importing.

---

## Starting the Import

There are two ways to begin:

1. **Right-click** on a CSV file in the file explorer and choose **Import as Notes**
2. Open the command palette and search for **Import CSV as notes**, then select the file

Both paths open the same import wizard. The wizard has four steps: Source, Configure, Preview, and Result.

---

## Step 1 — Source

The source step confirms which file you are importing. The file you selected is already loaded. You will see a summary of the file: how many rows it contains, how many columns, and a quick preview of the first few rows.

If everything looks right, move to the next step.

---

## Step 2 — Configure

This is where the real decisions happen.

### Target Folder

Choose where the new notes should be created. Pick an existing folder or type a new folder path — Flowti will create it for you if it does not exist yet.

### Name Column

Select which CSV column becomes the **note title**. For a list of customers, this might be "Company Name." For a product catalog, it might be "Product ID." Choose something unique — if two rows have the same value in the name column, the conflict strategy determines what happens.

### Column Mappings

Each CSV column can be mapped to a frontmatter property on the created note. By default, all columns are included. For each column, you can:

- **Rename it** — change the property name to something cleaner (e.g., "Cust. ID" becomes "customerId")
- **Skip it** — exclude columns you do not need
- **Set a type** — hint whether the column contains text, numbers, or dates

Good property names are lowercase, consistent, and descriptive. See the Properties tab in the [[Building Data Exchange Configs|Data Exchange Hub]] to check what property names you are already using across your vault.

### Conflict Strategy

What happens if a note with the same title already exists?

| Strategy | Behavior |
|----------|----------|
| **Skip** | Leave the existing note untouched |
| **Update** | Merge new frontmatter fields into the existing note, preserving any content you added by hand |
| **Overwrite** | Replace the existing note entirely with the imported version |

For a first-time import, the strategy does not matter much. For recurring imports with updated data, **Update** is usually the best choice.

---

## Step 3 — Preview

Before anything is written, the wizard shows you exactly what will be created. You will see a list of the notes with their titles and the frontmatter that will be applied to each one.

Check a few entries:

- Do the titles look right?
- Are the properties named correctly?
- Are there any unexpected blank values?

If something is off, go back to Configure and adjust. The preview updates in real time.

---

## Step 4 — Result

Click **Run** and the import executes. The result screen tells you:

- How many notes were **created**
- How many were **updated** (if using the Update strategy)
- How many were **skipped** (if using the Skip strategy and duplicates exist)
- Whether any errors occurred

When the import finishes, the wizard offers to **save the configuration**. Saving it means you can rerun the same import next time with one click — no need to reconfigure everything. Saved configurations appear in the **Imports** tab of the Data Exchange Hub (see [[Building Data Exchange Configs]]).

---

## What Happens After Import

Your imported notes now live in the vault with structured frontmatter. Open any note and you will see the properties at the top. These properties make the notes:

- **Searchable** — use Obsidian's search or Flowti's analytics to find notes by property values
- **Filterable** — narrow down results by type, status, date, or any other property
- **Connectable** — link notes to domains, events, and each other
- **Queryable** — build [[Creating Analytics Queries|analytics queries]] and [[Building Dashboards|dashboards]] on top of the imported data

The data that was sitting in a static spreadsheet is now alive inside your vault.

---

## Importing Canvas Files

In addition to CSV, Flowti can import **Obsidian canvas files** as notes. Open the command palette and search for **Import canvas as notes**. Each node on the canvas becomes a separate note, preserving the content and any connections. This is useful for turning visual brainstorming sessions into structured documentation.

---

## Tips for Successful Imports

**Clean your CSV first.** Remove blank rows, fix inconsistent column names, and ensure the header row is complete before importing.

**Choose meaningful name columns.** The name column becomes the note title and the file name. Avoid columns with very long values or special characters.

**Start small.** Import a file with 10-50 rows first. Verify the results look right before importing thousands of records.

**Save your configuration.** If you will receive updated versions of this file in the future, save the import config so you can rerun it without reconfiguring.

---

## Next Steps

- [[Building Data Exchange Configs]] — Manage all your import and export configurations
- [[Creating Analytics Queries]] — Query the data you just imported
- [[Building Dashboards]] — Visualize your imported data on a dashboard
