---
type: DocumentType
name: EventDoc
abbreviation: ""
folder: "{docsRoot}/Events/"
icon: zap
---

# EventDoc

An **EventDoc** documents a domain event in the system. Events are the primary communication mechanism between bounded contexts — every significant state change produces an event that other services can observe and react to.

EventDocs are managed through the Event Catalog view's Events tab. They are created by the plugin when documenting events and stored in `{docsRoot}/Events/`.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"EventDoc"` | yes | Document type discriminator |
| `event` | string | yes | Event type identifier (e.g., `user.created`) |
| `description` | string | no | Brief description of the event |
| `category` | string | no | Event category (e.g., `Core`, `User`, `Data Exchange`) |
| `direction` | enum | no | `inbound` · `outbound` · `internal` |
| `domain` | string | no | Domain that owns this event |
| `services` | string | no | Service(s) that emit or handle this event |
| `stability` | enum | no | `draft` · `alpha` · `beta` · `stable` |
| `visibility` | enum | no | `public` · `internal` · `private` |
| `created` | timestamp | no | Creation date |

**File pattern**: `{docsRoot}/Events/{eventType}.md`

## Managed By

- **Tab**: Events (Event Catalog)
- **CRUD**: Create via "+" button, Delete via context menu
- **Auto-normalize**: Plugin updates non-conforming frontmatter to standard schema

## Related Types

- [[CategoryDoc]] — Groups events into categories
- [[DomainDoc]] — Domain that owns the event
- [[ServiceDoc]] — Service that produces or consumes the event
- [[Event]] — User-defined custom event file (different from EventDoc)
