---
type: DocumentType
name: ActorDoc
abbreviation: ""
folder: "{docsRoot}/Actors/"
icon: user
---

# ActorDoc

An **ActorDoc** documents a user persona or role that interacts with the system. Actors have goals, key events, and service interactions — they represent the human side of the domain model.

ActorDocs are managed through the Event Catalog view's Actors tab.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"ActorDoc"` | yes | Document type discriminator |
| `actor` | string | yes | Actor/persona name |
| `description` | string | no | Brief actor description |
| `events` | string[] | no | Key events for this actor |
| `domains` | string[] | no | Domains this actor interacts with |
| `services` | string[] | no | Services this actor relies on |
| `created` | timestamp | no | Creation date |

**File pattern**: `{docsRoot}/Actors/{actorName}.md`

## Managed By

- **Tab**: Actors (Event Catalog)
- **CRUD**: Create via "+" button, Delete via context menu

## Related Types

- [[Persona]] — Detailed persona documentation (development-side, richer than ActorDoc)
- [[DomainDoc]] — Domains this actor works within
- [[ServiceDoc]] — Services this actor relies on
