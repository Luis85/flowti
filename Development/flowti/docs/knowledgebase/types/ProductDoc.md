---
type: DocumentType
name: ProductDoc
abbreviation: ""
folder: "{docsRoot}/Products/"
icon: package
---

# ProductDoc

A **ProductDoc** documents a product in the organization's portfolio. Products span domains, rely on services, and produce events. They represent the deliverable units that stakeholders care about.

ProductDocs are managed through the Event Catalog view's Products tab.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"ProductDoc"` | yes | Document type discriminator |
| `product` | string | yes | Product name |
| `description` | string | no | Brief product description |
| `events` | string[] | no | Key product events |
| `domains` | string[] | no | Domains this product spans |
| `services` | string[] | no | Services this product relies on |
| `created` | timestamp | no | Creation date |

**File pattern**: `{docsRoot}/Products/{productName}.md`

## Managed By

- **Tab**: Products (Event Catalog)
- **CRUD**: Create via "+" button, Delete via context menu

## Related Types

- [[DomainDoc]] — Domains this product spans
- [[ServiceDoc]] — Services this product relies on
- [[ActorDoc]] — Actors who use this product
