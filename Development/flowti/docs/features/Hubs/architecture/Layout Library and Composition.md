---
type: ArchitectureReference
feature: "[[Hubs PRD]]"
status: deferred
note: "Layout library, JSON schemas, region contracts, manifests, and component registry. Most of this is deferred (TD-49, TD-51, TD-52) — BaseHubView + hardcoded arrays serve current needs."
---

# UI Architecture Reference: Layout Library & Composition

> **Status**: This reference captures the target architecture. The actual implementation uses a pragmatic subset — see [[Hubs PRD]] section 9 (Adapter Impact) for what was actually built.

---

## A1. Architectural Principles

1. Obsidian View = container only
2. Layouts are reusable; domains plug in via adapters
3. Composition layers:

```
Shell → Layout → Region → View → Component → Primitive
```

4. UI communicates via EventBus (no direct domain coupling)

---

## A2. Layout Library Specification

### A2.1 WorkspaceShellLayout

```
WorkspaceShellLayout
├─ TopBarRegion
├─ LeftRailRegion
├─ MainRegion
├─ RightRailRegion
└─ OverlayRegion
```

### A2.2 HubWorkspaceLayout

```
HubWorkspaceLayout
├─ HeaderRegion
├─ TabNavigationRegion
└─ ContentRegion
```

Config:

```
layout_id
hub_type
default_tab
tab_definitions[]
header_actions[]
```

### A2.3 DashboardGridLayout

```
DashboardGridLayout
├─ KPIRegion
└─ CardGridRegion
```

### A2.4 SplitDockLayout

```
SplitDockLayout
├─ PrimaryRegion
└─ DockRegion
```

### A2.5 TableLayout (Virtualized)

```
TableLayout
├─ ToolbarRegion
├─ HeaderRow
└─ BodyRows (virtualized)
```

### A2.6 BoardLayout

```
BoardLayout
├─ Column*
│  └─ Card*
```

### A2.7 GraphLayout

```
GraphLayout
├─ Toolbar
└─ GraphCanvas
```

### A2.8 SessionFocusLayout

```
SessionFocusLayout
├─ SessionHeader
├─ TimerRegion
├─ WorkspaceRegion
└─ NotesRegion
```

---

## A3. UI Composition Library

### A3.1 Global Composition

```
FlowtiApp
└─ WorkspaceShellLayout
   ├─ TopBar
   ├─ LeftRail
   ├─ RouterOutlet (MainRegion)
   ├─ RightRail
   └─ Overlays
```

### A3.2 Navigation Composition

```
LeftRail
├─ UserHubNavItem
├─ SystemHubsGroup
│  ├─ EventCatalogNavItem
│  └─ DataExchangeNavItem
├─ DomainHubsGroup
│  └─ HubNavItem*
└─ FooterControls
```

### A3.3 View Composition

#### User Hub View

```
UserHubView
└─ HubWorkspaceLayout (UserHubAdapter)
```

Tabs → Layout mapping:

- Dashboard → DashboardGridLayout
- Inbox → TableLayout
- My Work → BoardLayout (+ optional SplitDockLayout)
- Sessions → TableLayout
- Insights → DashboardGridLayout

#### Domain Hub View

```
DomainHubView
└─ HubWorkspaceLayout (DomainHubAdapter)
```

Tabs → Layout mapping:

- Dashboard → DashboardGridLayout
- Domain → SplitDockLayout
- Documentation → TableLayout
- Relations → GraphLayout

#### Event Catalog View (System Hub)

```
EventCatalogView
└─ SplitDockLayout
   ├─ TableLayout
   └─ InspectorPanel
```

#### Data Exchange View (System Hub)

```
DataExchangeView
└─ DashboardGridLayout
```

---

## A4. Adapter Interfaces

### A4.1 Base HubAdapter

```ts
interface HubAdapter {
  hub_id: string
  hub_type: 'system' | 'domain' | 'user'

  getDashboardData(): DashboardData
  getEntities(): Entity[]
  getSessions(): Session[]
  getRelations(): RelationGraph

  createEntity(payload: unknown): Promise<void>
  createEvent(payload: unknown): Promise<void>
  createProject(payload: unknown): Promise<void>

  calculateCoverage(): number
}
```

### A4.2 UserHubAdapter

```ts
interface UserHubAdapter extends HubAdapter {
  getInbox(): InboxItem[]
  getAssignedWork(): WorkItem[]
  getInsights(): UserMetrics
}
```

---

## A5. Shared Component Library

```
Primitives
├─ Button, Badge, Tag, Icon, Avatar, Tooltip

Cards
├─ EntityCard, EventCard, ProjectCard, SessionCard

Panels (RightRail)
├─ InspectorPanel
├─ RelationsPanel
└─ ActivityPanel

Utilities
├─ FilterBar, TagPicker, VirtualizedTable, EmptyState, LoadingState

Modals
├─ CreateEventModal
├─ CreateEntityModal
├─ CreateSessionModal
└─ CreateProjectModal
```

---

## A6. Composition Boundaries

- `WorkspaceShellLayout` has no domain logic
- `HubWorkspaceLayout` is a generic container
- `HubAdapter` is the only place for domain specialization
- RightRail panels react to selection context
- creation flows use shared modals + schemas

---

## A7. Extension Model

To add a new Hub:

1. register in HubRegistry
2. implement HubAdapter
3. bind to HubWorkspaceLayout
4. define tabs + layout mapping
5. implement dashboard mapping

No layout duplication required.

---

# JSON Schema: Tab Definition

## Schema: `flowti.tab-definition.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "flowti.tab-definition.schema.json",
  "title": "Flowti Tab Definition",
  "type": "object",
  "additionalProperties": false,
  "required": ["schema_version", "hub_type", "tabs"],
  "properties": {
    "schema_version": {
      "type": "string",
      "pattern": "^1\\.0\\.[0-9]+$",
      "description": "Semantic version of this schema."
    },
    "hub_type": {
      "type": "string",
      "enum": ["user", "domain", "system"],
      "description": "Defines which hub type this tab configuration targets."
    },
    "hub_id": {
      "type": "string",
      "description": "Optional: binds this configuration to a specific hub instance."
    },
    "default_tab_id": {
      "type": "string",
      "description": "Tab id opened by default. If omitted, first tab is used."
    },
    "tabs": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/tab" }
    },
    "shared": {
      "type": "object",
      "additionalProperties": false,
      "description": "Shared definitions usable by tabs (commands, queries, actions).",
      "properties": {
        "commands": { "type": "array", "items": { "$ref": "#/$defs/command" } },
        "queries": { "type": "object", "additionalProperties": { "$ref": "#/$defs/query" } },
        "actions": { "type": "object", "additionalProperties": { "$ref": "#/$defs/action" } }
      }
    }
  },
  "$defs": { "...see full schema in source..." }
}
```

> Full JSON schema is extensive (~400 lines). Key `$defs`: `tab`, `layout_ref`, `bindings`, `data_source`, `refresh_policy`, `region_def`, `action`, `event_bus`, `subscription`, `query`, `cache_policy`, `command`, `shortcut`, `telemetry`, `condition`, `condition_atom`.

## Semantics and Rules

### Stable IDs

- `tab.id`, `action.id`, `query.id` must be stable (used for routing, persistence, telemetry).
- Use `snake_case` or `kebab-case` (schema allows both).

### Layout-driven regions

- `layout.layout_id` selects a layout from the Layout Library.
- `regions` optionally overrides the default region components for that layout.

### Data sources are named + reusable

- `bindings.data_sources.*` is the single place where data is described.
- Components only reference `data_bindings` (by name), never the adapter directly.

### EventBus-first refresh

- Use `refresh_policy.strategy = event_driven` where possible.
- Avoid interval polling unless you must.

### Actions are declarative

- Buttons, context menus, keyboard shortcuts all reference named actions.

---

# Region Contracts

## Common Contract Rules

- Region IDs are **PascalCase** and must match the layout contract exactly.
- Tab configs may only override regions that exist for the chosen layout.
- If a region is not provided in `tab.regions`, the layout uses its default component for that region.

## Region Catalog

| Layout | Regions | Required |
|--------|---------|----------|
| `dashboard_grid` | KPIRegion, CardGridRegion, QuickActionsRegion | CardGridRegion |
| `table` | ToolbarRegion, FacetRegion, HeaderRegion, BodyRegion, EmptyStateRegion, FooterRegion | BodyRegion |
| `split_dock` | PrimaryRegion, DockRegion, DockHeaderRegion, DockFooterRegion | PrimaryRegion, DockRegion |
| `board` | ToolbarRegion, BoardRegion, SwimlaneRegion, EmptyStateRegion | BoardRegion |
| `graph` | ToolbarRegion, GraphRegion, LegendRegion, DetailsRegion | GraphRegion |
| `session_focus` | SessionHeaderRegion, TimerRegion, WorkspaceRegion, NotesRegion, ArtifactsRegion | SessionHeaderRegion, TimerRegion, WorkspaceRegion |

---

# Layout Manifest

Target location: `src/ui/layouts/layout-manifest.json`

Defines all layouts with their regions, required flags, and default components. Used by the tab definition validator (TD-52). See [[TD-49 Layout abstraction layer]] for the full manifest JSON.

---

# Component Manifest

Target location: `src/ui/components/component-manifest.json`

Defines all registered components with their kind, props contract, emitted events, accepted context, and tags. See [[TD-51 Component registry]] for the full manifest JSON and registry loader.

---

# Tab Definition Validator

Target location: `src/ui/layouts/validate-tab-config.ts`

TypeScript validator function that checks tab definitions against the layout and component manifests. Validates: layout existence, region overrides, required regions, component registry membership, virtualization recommendations, event-driven refresh preference. See [[TD-52 Declarative tab definitions]] for the full implementation.

---

# Tab Configuration Examples

## Product Hub (domain hub)

```json
{
  "schema_version": "1.0.0",
  "hub_type": "domain",
  "default_tab_id": "dashboard",
  "tabs": [
    { "id": "dashboard", "title": "Dashboard", "layout": { "layout_id": "dashboard_grid" } },
    { "id": "domain", "title": "Domain", "layout": { "layout_id": "split_dock" } }
  ]
}
```

## User Hub (user hub)

```json
{
  "schema_version": "1.0.0",
  "hub_type": "user",
  "default_tab_id": "dashboard",
  "tabs": [
    { "id": "dashboard", "title": "Dashboard", "layout": { "layout_id": "dashboard_grid" } },
    { "id": "inbox", "title": "Inbox", "layout": { "layout_id": "table" } }
  ]
}
```

## Event Catalog (system hub)

```json
{
  "schema_version": "1.0.0",
  "hub_type": "system",
  "hub_id": "event_catalog",
  "default_tab_id": "catalog",
  "tabs": [
    { "id": "catalog", "title": "Catalog", "layout": { "layout_id": "split_dock" } }
  ]
}
```
