---
type: DocumentType
name: SystemDoc
abbreviation: ""
folder: "{docsRoot}/Systems/"
icon: globe
---

# SystemDoc

A **SystemDoc** documents an external system that interacts with the organization's domains and services. Systems represent the technical landscape — tools, platforms, and integrations that actors use and services connect to.

SystemDocs are managed through the Event Catalog view's Systems tab.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"SystemDoc"` | yes | Document type discriminator |
| `system` | string | yes | System name |
| `description` | string | no | Brief system description |
| `domains` | string[] | no | Domains this system encompasses |
| `services` | string[] | no | Services that make up this system |
| `created` | timestamp | no | Creation date |

**File pattern**: `{docsRoot}/Systems/{systemName}.md`

## Managed By

- **Tab**: Systems (Event Catalog)
- **CRUD**: Create via "+" button, Delete via context menu

## Related Types

- [[DomainDoc]] — Domains this system encompasses
- [[ServiceDoc]] — Services within this system
- [[ActorDoc]] — Actors who use this system
