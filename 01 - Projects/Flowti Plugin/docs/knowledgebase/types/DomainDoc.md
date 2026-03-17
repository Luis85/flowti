---
type: DocumentType
name: DomainDoc
abbreviation: ""
folder: "{docsRoot}/Domains/"
icon: boxes
---

# DomainDoc

A **DomainDoc** documents a business domain (bounded context) in the system. Domains group related services, events, and categories — they are the organizational backbone of the Event Catalog.

DomainDocs are managed through the Event Catalog view's Domains tab. They are created by the plugin and stored in `{docsRoot}/Domains/`.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"DomainDoc"` | yes | Document type discriminator |
| `domain` | string | yes | Domain name |
| `eventCount` | number | no | Number of events in this domain |
| `categories` | string[] | no | Event categories covered by this domain |
| `services` | string[] | no | Services that belong to this domain |
| `created` | timestamp | no | Creation date |

**File pattern**: `{docsRoot}/Domains/{domainName}.md`

## Managed By

- **Tab**: Domains (Event Catalog)
- **CRUD**: Create via "+" button, Delete via context menu
- **Companion**: Each DomainDoc may have an [[ArchitectureDoc]] (`{domainName}.architecture.md`)

## Related Types

- [[ArchitectureDoc]] — Arc42 + C4 architecture document for this domain
- [[ServiceDoc]] — Services belonging to this domain
- [[EventDoc]] — Events produced within this domain
- [[Domain]] — Business-level domain stub (different from plugin-managed DomainDoc)
