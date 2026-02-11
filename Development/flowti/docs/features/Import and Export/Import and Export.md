# The Import and Export Features

Obsidian is a great tool to collect, enrich, and link data to become a knowledge-graph. Where Obsidian is lacking, is importing and exporting, collaboration, and integration. 

We need a solution to collect the data we have, enrich those data, and provide a clean data-set for other systems downstream, all of that in a simple and connected workflow. We leverage the Obsidian Bases Feature to shape our data.

## Constraints

- All User interactions must also be able to start by command

## Solution Idea

The basic idea is, that the User is able to manage und publish the master-data of his organization. He can import and export data and leverage the Obsidian Bases Feature to explore those data-records or look at the created Markdown. The import is for data-ingestion and preparation, Bases sits in-between providing tools for data-improvement, the export is used for publication, like providing a product-catalog for importing in another system.

The solution must support the following process: 

1. the supplier provides an article-list as CSV file
2. the user imports these articles as notes into obsidian
3. the user opens the master base, filtered to show just the imported files
4. the user works on the data
5. the user has a separate view in the base with all business logic in specific formulas as a last check
6. the user exports based on this view
7. the exported file gets ingested by other system

### Task Flow

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

#### Exporting

- in file navigator, right click on the base you want to export
- Select Export
- Select "CSV" or "Text (Tab Stop)"
- Choose View to export
- Choose Target 
- Have the option to save the configuration as template
- Have the option to save this importer as action
- Have the option to open an exporter view, showing all saved exports and providing actions for them

## Jobs to be done

- I need to improve data-quality at my organization
- I need to ensure data-governance at my organization
- I need to maintain master-data
- I need to provide master-data
- I need to handle incoming data, massage this data, provide the massaged data to others

## User Stories
### As User, I want to export a base as CSV file so that I can use that data for other systems.

#### Acceptance Criteria

- When I right-click a base file in the file navigator, I have the option to export this base file as CSV

### As User, I want to export a base as txt Tab Stopp file, so that I can use that data for other systems.

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
