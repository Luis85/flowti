---
type: DocumentType
name: ServiceDoc
abbreviation: ""
folder: "{docsRoot}/Services/"
icon: server
---

# ServiceDoc

A **ServiceDoc** documents a service within a domain. Services expose contracts, handle events, and encapsulate business logic. Each service belongs to one or more domains.

ServiceDocs are managed through the Event Catalog view's Services tab. They are created by the plugin and stored in `{docsRoot}/Services/`.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"ServiceDoc"` | yes | Document type discriminator |
| `service` | string | yes | Service name |
| `eventCount` | number | no | Number of events handled by this service |
| `domains` | string[] | no | Domains this service belongs to |
| `created` | timestamp | no | Creation date |

**File pattern**: `{docsRoot}/Services/{serviceName}.md`

## Managed By

- **Tab**: Services (Event Catalog)
- **CRUD**: Create via "+" button, Delete via context menu
- **Companion**: Each ServiceDoc may have a [[ServiceBlueprintDoc]] (`{serviceName}.blueprint.md`)

## Related Types

- [[ServiceBlueprintDoc]] — Detailed service blueprint with user interactions and data flows
- [[DomainDoc]] — Domain(s) this service belongs to
- [[EventDoc]] — Events this service produces or consumes
