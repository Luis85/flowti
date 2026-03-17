---
type: DocumentType
name: PipelineConfigDoc
abbreviation: ""
folder: "{docsRoot}/Configs/"
icon: git-merge
---

# PipelineConfigDoc

A **PipelineConfigDoc** documents a multi-source import pipeline configuration. Pipelines orchestrate multiple import steps in sequence, optionally followed by an export step — enabling batch data processing workflows.

PipelineConfigDocs are managed through the Data Exchange Hub's Pipelines tab.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"PipelineConfigDoc"` | yes | Document type discriminator |
| `configId` | string | yes | UUID of the saved config |
| `name` | string | yes | Pipeline display name |
| `sources` | number | no | Number of import sources |
| `hasExport` | boolean | no | Whether the pipeline includes an export step |
| `created` | timestamp | no | Creation date |

**File pattern**: `{docsRoot}/Configs/Pipeline - {pipelineName}.md`

## Managed By

- **Tab**: Pipelines (Data Exchange Hub)

## Related Types

- [[ImportConfigDoc]] — Import configs used as pipeline sources
- [[ExportConfigDoc]] — Export config used as pipeline output
- [[CsvDoc]] — CSV files processed by the pipeline
