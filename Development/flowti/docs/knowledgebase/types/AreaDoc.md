---
type: DocumentType
name: AreaDoc
abbreviation: ""
folder: "02 - Areas/"
icon: map
---

# AreaDoc

An **AreaDoc** represents a PARA (Projects, Areas, Resources, Archives) area in the vault. Areas are created from the "Mark as Area" action on a domain and represent ongoing responsibilities or themes of work.

AreaDocs live in the `02 - Areas/` vault folder.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"AreaDoc"` | yes | Document type discriminator |
| `area` | string | yes | Area name |
| `domain` | string | no | Linked domain |
| `created` | timestamp | no | Creation date |

**File pattern**: `02 - Areas/{areaName}/index.md`

## Related Types

- [[DomainDoc]] — Domain that this area was created from
