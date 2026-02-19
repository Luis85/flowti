---
type: DocumentType
name: Component
abbreviation: ""
folder: components/
icon: puzzle
---

# Component

A **Component** documents a UI component or view orchestrator in the plugin. Component docs describe what the component renders, its dependencies, internal state, and event contracts — serving as the specification for the presentation layer.

Component docs live in the `components/` folder. The project documents 47 components covering all views, modals, tabs, and reusable UI elements.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"Component"` | yes | Document type discriminator |
| `domain` | string | yes | Plugin domain (e.g., `Flowti`) |
| `stage` | enum | yes | `planned` · `development` · `done` |
| `description` | string | yes | One-sentence component summary |
| `source` | wikilink | yes | Link to source file |
| `parent` | wikilink | no | Link to parent component or plugin |
| `tags` | string[] | no | Categorization tags |

## Section Template

1. Description (prose explaining what the component does)
2. Dependencies (table: Dependency / Type / Purpose)
3. State (bulleted list of state fields with type annotations)
4. Renders (bulleted list of rendered elements with sub-bullets)
5. Events (table: Event / Direction [Listens/Emits] / Purpose)
6. Related (Children wikilinks, Opens wikilinks)

## Component Categories

| Category | Count | Examples |
|----------|-------|---------|
| View Orchestrators | 8 | EventCatalogView, DataExchangeHubView, CsvActionView |
| Modals | 6 | EventConfigModal, ConfigChooserModal, ConfirmModal |
| Tabs | 11 | DomainsTab, EventsTab, ImportsTab, ExportsTab |
| Pages | 5 | CsvPreviewPage, CsvResultPage, ViewSelectPage |
| Panels/Sections | 17 | EventDetailPanel, DashboardImports, CsvDataSnapshot |

## Pattern

Components follow the orchestrator + component pattern:
- **Orchestrator**: owns state, coordinates children, subscribes to events
- **Component**: receives `(masterEl, detailEl, deps)`, renders master/detail views
- **State**: orchestrator owns state; components use `deps.getState()` / `deps.setState(partial)`

See [[Frontend Architecture]] for the full component architecture.
