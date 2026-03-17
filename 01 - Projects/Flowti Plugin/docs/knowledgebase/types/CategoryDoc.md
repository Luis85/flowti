---
type: DocumentType
name: CategoryDoc
abbreviation: ""
folder: "{docsRoot}/Categories/"
icon: folder
---

# CategoryDoc

A **CategoryDoc** documents an event category — a logical grouping of related events. Categories help organize the event landscape by concern (e.g., Core, User, Data Exchange, Hub, Session).

CategoryDocs are managed through the Event Catalog view and stored in `{docsRoot}/Categories/`.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"CategoryDoc"` | yes | Document type discriminator |
| `category` | string | yes | Category name |
| `eventCount` | number | no | Number of events in this category |
| `domains` | string[] | no | Domains that contribute events to this category |
| `services` | string[] | no | Services related to this category |
| `created` | timestamp | no | Creation date |

**File pattern**: `{docsRoot}/Categories/{categoryName}.md`

## Related Types

- [[EventDoc]] — Events that belong to this category
- [[DomainDoc]] — Domains that produce events in this category
