---
stage: development
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
tags:
  - core
  - infrastructure
description: " Import and Export your Data"
type: Feature
---

# The Import and Export Features

Obsidian is a great tool to collect, enrich, and link data to become a knowledge-graph. Where Obsidian is lacking, is importing and exporting of CSV files, collaboration, and integration. 

We need a solution to collect the data we have, enrich those data, and provide a clean data-set for other systems downstream, all of that in a simple and connected workflow. We leverage the Obsidian Bases Feature to shape our data.

An Obsidian Base is used as our data anchor to form and shape our data. The Base itself will become the template for our Import and Export.


## Constraints

- All User interactions must also be able to be started by command

## Solution Idea

The basic idea is, that the user is able to manage and publish the master-data of his organization or his daily-business. He can import and export data and leverage the Obsidian Bases Feature to explore those data-records or look at the created Markdown. The import is for data-ingestion and preparation, Bases sits in-between providing tools for data-improvement and exploration, the export is used for publication, like providing a product-catalog for importing in another system.

The solution must support the following process: 

1. the supplier provides an article-list as CSV file
2. the user imports these articles as notes into obsidian
3. the user opens the master base, filtered to show just the imported files
4. the user works on the data, using the provided features for notes and bases
5. the user switches the bases view to the export view and checks the data
6. the user right-clicks the base in the file-navigator or uses the command (prompts for file path)
7. the user exports based on this view
8. or the user right-clicks a folder containing quality-data and exports the content to the desired format
9. the user provides the path to the export to others
10. the exported file gets ingested by other systems

### Task Flow

#### Ideas

- Import Canvas files from the file navigator

#### Importing

- in file navigator, right click on the provided CSV inside Obsidian
- Select Import
- Select from template or new
- Configure Importer with source, target, template, existing note handling
- Review preview of the importer with Key-Value mapping
- Have the option to save the configuration as template
- Have the option to create a watcher to keep notes in sync with the CSV
- Have the option to have a dry run to see what will be affected by the import
- Have the option to save this importer as action
- Have the option to open an importer view, showing all the saved imports and providing actions for them
- Execute the Import

#### Exporting via Obsidian File Navigator

- in file navigator, right click on the base you want to export
- The Exporter Modal will open
- Select Export
- Select "CSV" or "Text (Tab Stop)"
- Choose View to export
- Choose Target 
- Have the option to save the configuration as template
- Have the option to save this importer as action
- Have the option to open an exporter view, showing all saved exports and providing actions for them
- Execute the Export

- in file navigator, right-click on a folder you want to export
- The Exporter Modal will open
- Configure Export
- Execute Export

#### Exporting via Command

- use the "Export Base" Command
- Input the path to the base you want to export
- The Exporter Modal will open
- Configure the Export
- Execute the Export

## Jobs to be done

- I need to improve data-quality at my organization
- I need to ensure data-governance at my organization
- I need to maintain master-data to support high-quality-data
- I need to handle incoming data, massage this data, and provide the massaged data to others

## User Stories
### As User, I want to export an Obsidian Base as CSV file so that I can use that data for other systems.

#### Acceptance Criteria

- When I right-click a base file in the file navigator, I have the option to export this base file as CSV

### As User, I want to export an Obsidian Base as txt Tab Stopp file, so that I can use that data for other systems.

#### Acceptance Criteria

- When I right-click a base file in the file navigator, I have the option to export this base file as TXT Tab Stopp

### As User, I want to import a csv file into Obsidian, so that every line is one note.

#### Acceptance Criteria

- When I right-click a csv file in the file navigator, I have the option to import this file
- I can import notes based on a template
- I can save importer settings
- I can watch CSV files in my Vault and re-import on change

### As User, I want to configure event-driven imports so that I can update my notes based on incoming reports


### As User, I want to export the content of a folder
