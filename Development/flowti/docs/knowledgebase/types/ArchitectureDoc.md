---
type: DocumentType
name: ArchitectureDoc
abbreviation: ""
folder: "{docsRoot}/Domains/"
icon: building
---

# ArchitectureDoc

An **ArchitectureDoc** is an Arc42 + C4 architecture document for a specific domain. It provides detailed architectural views — context, container, component, and deployment — beyond what the parent [[DomainDoc]] covers.

ArchitectureDocs are companions to DomainDocs, stored in the same folder with an `.architecture.md` suffix.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"ArchitectureDoc"` | yes | Document type discriminator |
| `domain` | string | yes | Domain name (same as parent DomainDoc) |
| `eventCount` | number | no | Number of events in architecture scope |
| `categories` | string[] | no | Event categories covered |
| `services` | string[] | no | Services in architecture scope |
| `created` | timestamp | no | Creation date |

**File pattern**: `{docsRoot}/Domains/{domainName}.architecture.md`

## Related Types

- [[DomainDoc]] — Parent domain overview
- [[ServiceDoc]] — Services within this domain's architecture
