---
type: DocumentType
name: CsvDoc
abbreviation: ""
folder: "{docsRoot}/Reports/"
icon: file-spreadsheet
---

# CsvDoc

A **CsvDoc** documents a CSV file that has been imported or analyzed by the Data Exchange system. It records the file's structure (columns, rows, delimiter) and serves as the report entry for imported data.

CsvDocs are managed through the Data Exchange Hub's Reports tab.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"CsvDoc"` | yes | Document type discriminator |
| `csvFile` | wikilink | yes | Link to the source CSV file |
| `filePath` | string | yes | Full vault path to the CSV file |
| `name` | string | yes | Filename |
| `description` | string | no | User-provided description |
| `columns` | number | no | Number of columns |
| `rows` | number | no | Number of data rows |
| `delimiter` | string | no | Column delimiter (`,` or `\t`) |
| `headers` | string[] | no | Column header names |
| `created` | timestamp | no | Creation date |

**File pattern**: `{docsRoot}/Reports/CSV - {csvName}.md`

## Managed By

- **Tab**: Reports (Data Exchange Hub)

## Related Types

- [[ImportConfigDoc]] — Import configuration that processed this CSV
- [[PropertyDoc]] — Properties derived from CSV columns
