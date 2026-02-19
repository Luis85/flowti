---
type: DocumentType
name: ImportConfigDoc
abbreviation: ""
folder: "{docsRoot}/Configs/"
icon: download
---

# ImportConfigDoc

An **ImportConfigDoc** documents a saved CSV import configuration. It records column mappings, target folder, conflict strategy, and other settings needed to repeatably import CSV data as vault notes.

ImportConfigDocs are managed through the Data Exchange Hub's Imports tab.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"ImportConfigDoc"` | yes | Document type discriminator |
| `configId` | string | yes | UUID of the saved config |
| `name` | string | yes | Config display name |
| `targetFolder` | string | no | Vault path where notes are created |
| `nameColumn` | string | no | CSV column used for note filenames |
| `namePrefix` | string | no | Optional filename prefix |
| `nameSuffix` | string | no | Optional filename suffix |
| `conflictStrategy` | enum | no | `skip` · `update` · `overwrite` |
| `columns` | number | no | Total column mappings |
| `includedColumns` | number | no | Enabled column mappings |
| `noteType` | string | no | Optional note type (e.g., `Event`) |
| `sourcePath` | string | no | Path to source CSV file |
| `created` | timestamp | no | Creation date |

**File pattern**: `{docsRoot}/Configs/Import - {configName}.md`

## Managed By

- **Tab**: Imports (Data Exchange Hub)

## Related Types

- [[CsvDoc]] — CSV file this config imports from
- [[PropertyDoc]] — Properties mapped by this config
- [[PipelineConfigDoc]] — Pipeline that orchestrates this import
