---
type: DocumentType
name: ServiceBlueprintDoc
abbreviation: ""
folder: "{docsRoot}/Services/"
icon: server
---

# ServiceBlueprintDoc

A **ServiceBlueprintDoc** is a detailed service blueprint that expands on a [[ServiceDoc]] with user interactions, data flows, and operational concerns. It follows the service design blueprint pattern with four layers: User Actions, Frontstage, Backstage, and Supporting Systems.

ServiceBlueprintDocs are companions to ServiceDocs, stored in the same folder with a `.blueprint.md` suffix.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"ServiceBlueprintDoc"` | yes | Document type discriminator |
| `service` | string | yes | Service name (same as parent ServiceDoc) |
| `eventCount` | number | no | Number of events in blueprint scope |
| `domains` | string[] | no | Domains covered |
| `created` | timestamp | no | Creation date |

**File pattern**: `{docsRoot}/Services/{serviceName}.blueprint.md`

## Related Types

- [[ServiceDoc]] — Parent service overview
- [[DomainDoc]] — Domain(s) this service belongs to
