---
type: DocumentType
name: View
abbreviation: ""
folder: sitemap/
icon: layout
---

# View

A **View** documents a top-level Obsidian view (pane) registered by the plugin. View docs describe the view's purpose, use cases, related flows, and architectural decisions — serving as the sitemap of the plugin's user interface.

View docs live in the `sitemap/` folder. The project documents 10 views covering all user-facing panes.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"View"` | yes | Document type discriminator |
| `stage` | enum | yes | `planned` · `development` · `done` |
| `domain` | string | yes | Plugin domain |
| `plugin` | wikilink | no | Link to plugin README |
| `description` | string | yes | One-sentence view summary |
| `viewType` | string | yes | Obsidian view type identifier (e.g., `flowti-event-catalog`) |
| `extends` | string | no | Base class (`ItemView` or `BaseHubView`) |
| `source` | wikilink | yes | Link to source file |
| `feature` | wikilink | no | Link to parent feature PRD |
| `parent` | wikilink | no | Link to parent view |
| `tags` | string[] | no | Categorization tags |

## Section Template

1. Description (prose explaining the view layout and purpose)
2. Use Cases (subsections per use case, prose descriptions)
3. Related Flows (bulleted wikilinks to flow docs)
4. Related Decisions (bulleted wikilinks to ADRs)

## Registered Views

| View | viewType | Extends | Description |
|------|----------|---------|-------------|
| Event Catalog | `flowti-event-catalog` | BaseHubView | Semantic map of domains, events, flows |
| Data Exchange Hub | `flowti-data-exchange` | BaseHubView | Import/export management |
| Event Log | `flowti-event-log` | ItemView | Real-time event activity feed |
| Export | `flowti-export` | ItemView | CSV export wizard |
| CSV Action | `flowti-csv-action` | ItemView | CSV import wizard |
| User Hub | `flowti-user-hub` | ItemView | User profile and inbox |
| Session Workspace | `flowti-session-workspace` | ItemView | Session execution environment |
| Train Main View | `flowti-train-main` | ItemView | Train thought navigator |
| Train Timeline Sidebar | `flowti-train-timeline` | ItemView | Vertical timeline graph with click-to-navigate |
| Component Showcase | `flowti-component-showcase` | ItemView | Design system reference |

## Relationship to Components

Each View has a corresponding [[Component]] doc that describes its internal structure. The View doc focuses on user-facing purpose; the Component doc focuses on technical implementation.
