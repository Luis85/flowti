---
type: DocumentType
name: FlowDoc
abbreviation: ""
folder: "{docsRoot}/Flows/"
icon: git-branch
---

# FlowDoc

A **FlowDoc** is a plugin-generated flow document managed through the Event Catalog's Flows tab. It documents a business flow with an ordered event sequence, involved domains, and participating services.

FlowDocs are distinct from [[Flow]] documents (which live in `docs/flows/` and are manually authored development process flows). FlowDocs are part of the plugin's self-documentation system.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"FlowDoc"` | yes | Document type discriminator |
| `flow` | string | yes | Flow name |
| `description` | string | no | Brief flow description |
| `events` | string[] | no | Ordered event types in this flow |
| `domains` | string[] | no | Domains involved in this flow |
| `services` | string[] | no | Services participating |
| `created` | timestamp | no | Creation date |

**File pattern**: `{docsRoot}/Flows/{flowName}.md`

## Managed By

- **Tab**: Flows (Event Catalog)
- **CRUD**: Create via "+" button, Delete via context menu

## Related Types

- [[Flow]] — Development process flow (manually authored, different purpose)
- [[EventDoc]] — Events referenced in the flow sequence
- [[DomainDoc]] — Domains involved in the flow
