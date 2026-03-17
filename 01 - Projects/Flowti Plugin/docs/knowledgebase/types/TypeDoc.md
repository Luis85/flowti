---
type: DocumentType
name: TypeDoc
abbreviation: ""
folder: "{docsRoot}/Types/"
icon: file-type
---

# TypeDoc

A **TypeDoc** documents a note type used in the vault's data model. It defines what frontmatter properties a note of this type is expected to have and tracks how many import/export configurations reference it.

TypeDocs are managed through the Data Exchange Hub's Types tab.

> **Note**: TypeDoc (plugin-managed, `{docsRoot}/Types/`) is distinct from [[DocumentType]] (knowledgebase glossary entries in `knowledgebase/types/`). TypeDocs describe vault note types; DocumentType entries describe the documentation system's own types.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"TypeDoc"` | yes | Document type discriminator |
| `name` | string | yes | Note type name (e.g., `Asset`, `Contact`) |
| `description` | string | no | User-provided description |
| `properties` | string[] | no | Expected frontmatter properties for this type |
| `pipelines` | number | no | Total configs referencing this type |
| `created` | timestamp | no | Creation date |

**File pattern**: `{docsRoot}/Types/Type - {typeName}.md`

## Managed By

- **Tab**: Types (Data Exchange Hub)

## Related Types

- [[PropertyDoc]] — Properties that belong to this note type
- [[ImportConfigDoc]] — Import configs that produce notes of this type
