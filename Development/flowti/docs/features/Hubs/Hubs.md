---
domain: Flowti  
plugin: "[[Development/flowti/README|README]]"  
type: Feature  
stage: draft
---

# Feature: Domain Hubs

**Domain:** Flowti  
**Plugin:** Flowti – IBDE  
**Stage:** Draft for First Technical Review

---

## 1. Executive Summary

The **Hubs Feature** introduces structured, domain-centric workspaces inside Flowti.

Each Hub represents either:

- a **bounded domain** (Product, Project, Services, Areas, …), or
    
- the **User Hub** (personal cockpit), or
    
- a **System Hub** (Event Catalog, Data Exchange).
    

A Hub serves as:

- the **primary interaction surface** for a domain/person/system
    
- a **generator and maintainer of Event Catalog entries**
    
- a **documentation accelerator** (Event Storming, Service Design, RE sessions, etc.)
    
- a **knowledge graph enrichment interface**
    

Hubs unify:

- Event-driven modeling
    
- Documentation
    
- Project initiation
    
- Domain structuring
    
- Knowledge graph relationships
    

They make Flowti operational as an **Integrated Business Development Environment (IBDE)**.

---

## 2. Strategic Context

Flowti is a system where:

- the **Event Catalog is the Source of Truth**
    
- domains generate and consume events
    
- documentation and system state evolve together
    
- Git tracks structural evolution
    
- the Knowledge Graph reflects operational structure
    

Instead of navigating files → users navigate **Domains → Hubs → Events & Entities**.

---

## 3. Vision

> A Hub is the main entry point into a domain (or into the user’s work).  
> It is a dedicated workspace that:
> 
> - structures data
>     
> - generates event entries
>     
> - encourages documentation
>     
> - connects entities
>     
> - starts projects
>     
> - feeds the knowledge graph
>     

---

## 4. Core Principles

1. Event Catalog remains the authoritative backbone
    
2. Every Hub contributes to the Event Catalog
    
3. Hubs generate Entity Docs (Markdown)
    
4. Hubs encourage documentation discipline
    
5. Documentation Sessions are structured and time-boxed
    
6. Hubs are domain-bounded (except User Hub)
    
7. System Hubs and User Hubs are distinct
    
8. All relationships feed the knowledge graph
    

---

## 5. Hub Types and Conceptual Architecture

### 5.1 Conceptual Architecture

```
Flowti
│
├── User Hub (Personal cockpit)
│
├── System Hubs
│   ├── Event Catalog
│   └── Data Exchange
│
├── Domain Hubs (Core + User-generated)
│   ├── Product Hub
│   ├── Project Hub
│   ├── Services Hub
│   ├── Areas Hub
│   └── User-Generated Hubs
│
└── 01 - Projects (Project Instances)
```

### 5.2 System Hubs

Managed by Flowti Core:

- Event Catalog
    
- Data Exchange
    

Immutable structure, extensible content.

### 5.3 Domain Hubs (Core)

- Product Hub
    
- Project Hub
    
- Services Hub
    
- Areas Hub
    

### 5.4 User-Generated Hubs

Any domain entity can become a Hub (workspace) and must:

- generate entity documents
    
- contribute events
    
- have dashboard + documentation section
    
- support documentation sessions
    

### 5.5 User Hub (Personal)

The main entry point for the user, acting as:

- personal dashboard + action center
    
- inbox aggregation for cross-hub events
    
- unified “My Work” board
    
- session launcher and history
    
- contribution insights
    

---

## 6. Functional Requirements

### 6.1 Shared Hub Capabilities (All Hubs)

Each Hub must provide:

1. **Dashboard**
    
2. **Documentation** section
    
3. **Create + maintain entities** (domain dependent)
    
4. **Event integration**
    
5. **Relations** (knowledge graph connections)

6. **Integrations** trough well defined APIs or Touchpoints
    

### 6.2 Domain Hubs: Required Sections

#### A) Dashboard

- domain summary
    
- event statistics
    
- recent activity
    
- related projects
    
- documentation completeness indicator
    
- knowledge graph connections
    

#### B) Domain (Entities)

- create/edit domain entities
    
- attach events
    
- connect to other hubs/entities
    
- support table/board/outline (optional)
    

#### C) Documentation

- documentation summary
    
- list of sessions
    
- start session button
    
- templates (prepared sessions)
    
- saved session configurations
    
- artifacts overview
    

#### D) Relations

- graph view
    
- relations matrix (optional)
    
- timeline (optional)
    
- link creation wizard
    

#### E) Project Initiation

- create a project in `01 - Projects`
    
- link project to a domain entity
    
- attach project to event stream
    

### 6.3 User Hub: Required Sections

#### A) Dashboard

- today overview (tasks, deadlines, sessions)
    
- activity feed (“what changed”)
    
- documentation nudges (“what’s missing”)
    
- cross-hub involvement summary
    

#### B) Inbox

Event-driven aggregation:

- events mentioning user
    
- events from followed hubs/domains
    
- system notifications
    
- session reminders
    

#### C) My Work

Unified board across hubs:

- assigned entities
    
- derived tasks
    
- session follow-ups
    
- review items
    

#### D) Sessions

- active session card
    
- history
    
- templates
    
- start session CTA
    

#### E) Insights

- contribution metrics (events/entities/sessions/projects)
    
- breakdown by hub/domain
    
- consistency score (future)
    

---

## 7. Documentation Sessions

### 7.1 Concept

A Documentation Session is:

- time-boxed (Pomodoro-style)
    
- structured
    
- domain-specific
    
- optional props
    
- saveable as reusable template
    

### 7.2 Session Types (initial)

- Event Storming
    
- Service Design
    
- Requirements Refinement
    
- Backlog Structuring
    
- Knowledge Cleanup
    

### 7.3 Props

- Events
    
- Entities
    
- Templates
    
- Canvas
    
- Whiteboard
    

### 7.4 Lifecycle

```
Prepared → Scheduled → Active → Completed → Archived
```

Completion creates:

- Session Summary Markdown
    
- generated events
    
- updated entities
    
- knowledge graph links
    

---

## 8. Entity Document Generation

Whenever a Hub creates a domain entity, the system must:

- create a Markdown entity doc
    
- add frontmatter
    
- link to hub + related events
    
- register in knowledge graph
    

---

## 9. Data Model

### 9.1 Hub

```
hub_id
hub_type (system | domain | user)
domain_name
description
created_at
owner
```

### 9.2 Documentation Session

```
session_id
hub_id
session_type
duration
status
props
created_at
completed_at
```

### 9.3 Domain Entity

```
entity_id
hub_id
entity_type
linked_events[]
linked_projects[]
linked_areas[]
```

### 9.4 User Hub Additions

```
user_id
followed_hubs[]
assigned_entities[]
assigned_projects[]
active_sessions[]
inbox_items[]
personal_metrics
```

---

## 10. Non-Functional Requirements

- Event Catalog remains authoritative
    
- Hubs must not duplicate event logic
    
- Git state must reflect hub changes
    
- integrate with Knowledge Graph
    
- plugin modular architecture
    
- UI supports layout reuse
    
- hubs must be extendable via modules
    
- tables virtualized (performance)
    
- graph view must support scoping/filtering
    

---

## 11. UX Requirements

- unified hub layout
    
- reusable layout framework
    
- component-driven structure
    
- EventBus-driven communication
    
- fast entity creation
    
- documentation progress visibility
    
- clear boundary visualization (domain vs user vs system)
    

---

## 12. Risks

|Risk|Mitigation|
|---|---|
|Hub becomes redundant layer|Keep Event Catalog central|
|Documentation fatigue|Pomodoro + templates|
|Domain explosion|Bounded context enforcement|
|Knowledge graph overload|Scoping + smart filters|

---

## 13. Open Technical Questions

1. Are hubs stored as entities in Event Catalog? → **No** (Hubs are domains; visual representations of domains)
    
2. How to enforce bounded contexts? → TBD
    
3. Should user hubs be versioned? → **No**
    
4. How are session artifacts persisted? → **Markdown files**
    
5. Can hubs subscribe to EventBus namespaces? → TBD
    
6. How does a hub register itself? → TBD
    
7. Is there a HubRegistry service? → TBD
    

---

## 14. Acceptance Criteria

- user opens **User Hub** as default entry
    
- user opens **Domain Hub** from Event Catalog
    
- user opens **System Hubs** from navigation
    
- user creates domain entity from hub → markdown generated
    
- user starts documentation session → artifacts created
    
- hub dashboards update from events
    
- knowledge graph reflects changes
    
- projects created from hubs appear in `01 - Projects`
    
- user-generated hub behaves like core domain hub
    

---

## 15. Definition of Done (v1)

- Hub Registry implemented
    
- Hub base layout implemented
    
- User Hub implemented (Dashboard + Inbox + My Work + Sessions)
    
- Product Hub implemented (Dashboard + Domain + Documentation + Relations)
    
- documentation session MVP implemented
    
- entity auto-generation working
    
- event linking working
    
- dashboard metrics visible
    
- project creation from hub working
    

---

# UI Architecture Appendix: Layout Library & Composition

This section is for technical review and implementation planning.

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


# 1) JSON Schema: `flowti.tab-definition.schema.json`

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
        "commands": {
          "type": "array",
          "items": { "$ref": "#/$defs/command" }
        },
        "queries": {
          "type": "object",
          "additionalProperties": { "$ref": "#/$defs/query" }
        },
        "actions": {
          "type": "object",
          "additionalProperties": { "$ref": "#/$defs/action" }
        }
      }
    }
  },

  "$defs": {
    "tab": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "title", "layout", "bindings"],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[a-z0-9_\\-]+$",
          "description": "Stable tab identifier."
        },
        "title": { "type": "string" },
        "icon": { "type": "string", "description": "Icon id (e.g. lucide name)." },
        "order": { "type": "integer", "minimum": 0 },
        "visible_when": { "$ref": "#/$defs/condition" },
        "layout": { "$ref": "#/$defs/layout_ref" },
        "bindings": { "$ref": "#/$defs/bindings" },
        "regions": {
          "type": "object",
          "description": "Optional region overrides for the chosen layout.",
          "additionalProperties": { "$ref": "#/$defs/region_def" }
        },
        "shortcuts": {
          "type": "array",
          "items": { "$ref": "#/$defs/shortcut" }
        },
        "telemetry": { "$ref": "#/$defs/telemetry" }
      }
    },

    "layout_ref": {
      "type": "object",
      "additionalProperties": false,
      "required": ["layout_id"],
      "properties": {
        "layout_id": {
          "type": "string",
          "enum": [
            "dashboard_grid",
            "table",
            "split_dock",
            "board",
            "graph",
            "session_focus",
            "custom"
          ]
        },
        "variant": {
          "type": "string",
          "description": "Optional layout variant (e.g., 'compact', 'wide')."
        },
        "custom_layout_component": {
          "type": "string",
          "description": "When layout_id='custom', name of a registered layout component."
        },
        "layout_options": {
          "type": "object",
          "additionalProperties": true,
          "description": "Layout-specific options (breakpoints, column config, etc.)."
        }
      },
      "allOf": [
        {
          "if": { "properties": { "layout_id": { "const": "custom" } } },
          "then": { "required": ["custom_layout_component"] }
        }
      ]
    },

    "bindings": {
      "type": "object",
      "additionalProperties": false,
      "required": ["data_sources"],
      "properties": {
        "data_sources": {
          "type": "object",
          "description": "Named data sources referenced by regions/widgets.",
          "additionalProperties": { "$ref": "#/$defs/data_source" }
        },
        "actions": {
          "type": "object",
          "description": "Named actions available in this tab (toolbar buttons etc.).",
          "additionalProperties": { "$ref": "#/$defs/action_ref_or_inline" }
        },
        "event_bus": { "$ref": "#/$defs/event_bus" }
      }
    },

    "data_source": {
      "type": "object",
      "additionalProperties": false,
      "required": ["kind"],
      "properties": {
        "kind": {
          "type": "string",
          "enum": ["adapter_query", "store_selector", "computed", "static"]
        },
        "query_ref": {
          "type": "string",
          "description": "Reference to shared.queries.<name> when kind='adapter_query'."
        },
        "store": {
          "type": "string",
          "description": "Store id (when kind='store_selector')."
        },
        "selector": {
          "type": "string",
          "description": "Selector function name (when kind='store_selector')."
        },
        "compute": {
          "type": "object",
          "description": "Computed source definition (when kind='computed').",
          "additionalProperties": false,
          "required": ["inputs", "fn"],
          "properties": {
            "inputs": { "type": "array", "items": { "type": "string" } },
            "fn": { "type": "string", "description": "Registered compute function id." }
          }
        },
        "value": {
          "description": "Static value (when kind='static')."
        },
        "refresh_policy": { "$ref": "#/$defs/refresh_policy" }
      },
      "allOf": [
        {
          "if": { "properties": { "kind": { "const": "adapter_query" } } },
          "then": { "required": ["query_ref"] }
        },
        {
          "if": { "properties": { "kind": { "const": "store_selector" } } },
          "then": { "required": ["store", "selector"] }
        },
        {
          "if": { "properties": { "kind": { "const": "computed" } } },
          "then": { "required": ["compute"] }
        },
        {
          "if": { "properties": { "kind": { "const": "static" } } },
          "then": { "required": ["value"] }
        }
      ]
    },

    "refresh_policy": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "strategy": {
          "type": "string",
          "enum": ["on_enter", "interval", "event_driven", "manual"]
        },
        "interval_ms": { "type": "integer", "minimum": 250 },
        "events": {
          "type": "array",
          "items": { "type": "string" },
          "description": "EventBus events that trigger refresh (strategy=event_driven)."
        }
      },
      "allOf": [
        {
          "if": { "properties": { "strategy": { "const": "interval" } } },
          "then": { "required": ["interval_ms"] }
        },
        {
          "if": { "properties": { "strategy": { "const": "event_driven" } } },
          "then": { "required": ["events"] }
        }
      ]
    },

    "region_def": {
      "type": "object",
      "additionalProperties": false,
      "required": ["component"],
      "properties": {
        "component": {
          "type": "string",
          "description": "Registered component name for this region."
        },
        "props": {
          "type": "object",
          "additionalProperties": true,
          "description": "Component props."
        },
        "data_bindings": {
          "type": "object",
          "additionalProperties": { "type": "string" },
          "description": "Maps component prop names → data_source keys."
        },
        "actions": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Action ids enabled for this region."
        }
      }
    },

    "action_ref_or_inline": {
      "oneOf": [
        { "$ref": "#/$defs/action" },
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["ref"],
          "properties": {
            "ref": {
              "type": "string",
              "description": "Reference to shared.actions.<name>"
            }
          }
        }
      ]
    },

    "action": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "label", "kind"],
      "properties": {
        "id": { "type": "string", "pattern": "^[a-z0-9_\\-]+$" },
        "label": { "type": "string" },
        "icon": { "type": "string" },
        "kind": {
          "type": "string",
          "enum": ["event_emit", "adapter_call", "navigate", "open_modal", "command"]
        },
        "payload": {
          "type": "object",
          "additionalProperties": true,
          "description": "Payload template; can be enriched from selection context."
        },
        "requires_selection": { "type": "boolean", "default": false },
        "visible_when": { "$ref": "#/$defs/condition" },
        "enabled_when": { "$ref": "#/$defs/condition" }
      }
    },

    "event_bus": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "namespace": {
          "type": "string",
          "description": "Default namespace for this tab (e.g. 'hub.product')."
        },
        "subscriptions": {
          "type": "array",
          "items": { "$ref": "#/$defs/subscription" }
        },
        "emit_defaults": {
          "type": "object",
          "additionalProperties": true,
          "description": "Default fields attached to emitted events (hub_id, tab_id, etc.)."
        }
      }
    },

    "subscription": {
      "type": "object",
      "additionalProperties": false,
      "required": ["event", "handler"],
      "properties": {
        "event": { "type": "string" },
        "handler": {
          "type": "string",
          "description": "Registered handler id; updates stores or triggers refresh."
        },
        "debounce_ms": { "type": "integer", "minimum": 0 }
      }
    },

    "query": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "method"],
      "properties": {
        "id": { "type": "string", "pattern": "^[a-z0-9_\\-]+$" },
        "method": {
          "type": "string",
          "description": "Adapter method name (e.g., 'getDashboardData')."
        },
        "args": {
          "type": "object",
          "additionalProperties": true,
          "description": "Arguments passed to adapter method."
        },
        "cache": { "$ref": "#/$defs/cache_policy" }
      }
    },

    "cache_policy": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "strategy": {
          "type": "string",
          "enum": ["none", "ttl", "until_event"]
        },
        "ttl_ms": { "type": "integer", "minimum": 250 },
        "invalidate_on": {
          "type": "array",
          "items": { "type": "string" }
        }
      },
      "allOf": [
        {
          "if": { "properties": { "strategy": { "const": "ttl" } } },
          "then": { "required": ["ttl_ms"] }
        },
        {
          "if": { "properties": { "strategy": { "const": "until_event" } } },
          "then": { "required": ["invalidate_on"] }
        }
      ]
    },

    "command": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "title", "action_ref"],
      "properties": {
        "id": { "type": "string", "pattern": "^[a-z0-9_\\-]+$" },
        "title": { "type": "string" },
        "action_ref": { "type": "string" },
        "when": { "$ref": "#/$defs/condition" }
      }
    },

    "shortcut": {
      "type": "object",
      "additionalProperties": false,
      "required": ["keys", "action_ref"],
      "properties": {
        "keys": { "type": "string", "description": "e.g. 'Ctrl+K' or 'Cmd+Enter'" },
        "action_ref": { "type": "string" }
      }
    },

    "telemetry": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "screen_name": { "type": "string" },
        "track_on_enter": { "type": "boolean", "default": true }
      }
    },

    "condition": {
      "type": "object",
      "description": "Simple condition language (expand later if needed).",
      "additionalProperties": false,
      "properties": {
        "all": {
          "type": "array",
          "items": { "$ref": "#/$defs/condition_atom" }
        },
        "any": {
          "type": "array",
          "items": { "$ref": "#/$defs/condition_atom" }
        },
        "not": { "$ref": "#/$defs/condition_atom" }
      }
    },

    "condition_atom": {
      "type": "object",
      "additionalProperties": false,
      "required": ["path", "op", "value"],
      "properties": {
        "path": {
          "type": "string",
          "description": "Context path, e.g. 'selection.entity_type' or 'hub.hub_type'."
        },
        "op": {
          "type": "string",
          "enum": ["eq", "ne", "in", "not_in", "exists", "gt", "gte", "lt", "lte"]
        },
        "value": {}
      }
    }
  }
}
```

---

# 2) Semantics and Rules

### 2.1 Stable IDs

- `tab.id`, `action.id`, `query.id` must be stable (used for routing, persistence, telemetry).
    
- Use `snake_case` or `kebab-case` (schema allows both).
    

### 2.2 Layout-driven regions

- `layout.layout_id` selects a layout from the Layout Library.
    
- `regions` optionally overrides the default region components for that layout.
    

### 2.3 Data sources are named + reusable

- `bindings.data_sources.*` is the single place where data is described.
    
- Components only reference `data_bindings` (by name), never the adapter directly.
    

### 2.4 EventBus-first refresh

- Use `refresh_policy.strategy = event_driven` where possible.
    
- Avoid interval polling unless you must.
    

### 2.5 Actions are declarative

- Buttons, context menus, keyboard shortcuts all reference named actions.
    

---

# 3) Example: Product Hub Tabs (`domain` hub)

```json
{
  "schema_version": "1.0.0",
  "hub_type": "domain",
  "default_tab_id": "dashboard",
  "shared": {
    "queries": {
      "q_dashboard": { "id": "q_dashboard", "method": "getDashboardData", "cache": { "strategy": "ttl", "ttl_ms": 2000 } },
      "q_entities": { "id": "q_entities", "method": "getEntities", "cache": { "strategy": "until_event", "invalidate_on": ["entity.created", "entity.updated"] } },
      "q_sessions": { "id": "q_sessions", "method": "getSessions" },
      "q_relations": { "id": "q_relations", "method": "getRelations" }
    },
    "actions": {
      "a_create_entity": { "id": "a_create_entity", "label": "Create Entity", "kind": "open_modal", "payload": { "modal": "CreateEntityModal" } },
      "a_start_session": { "id": "a_start_session", "label": "Start Session", "kind": "open_modal", "payload": { "modal": "CreateSessionModal" } }
    }
  },
  "tabs": [
    {
      "id": "dashboard",
      "title": "Dashboard",
      "icon": "layout-dashboard",
      "order": 0,
      "layout": { "layout_id": "dashboard_grid" },
      "bindings": {
        "data_sources": {
          "dashboard": { "kind": "adapter_query", "query_ref": "q_dashboard", "refresh_policy": { "strategy": "event_driven", "events": ["event.created", "entity.updated"] } }
        },
        "actions": {
          "start_session": { "ref": "a_start_session" },
          "create_entity": { "ref": "a_create_entity" }
        }
      },
      "regions": {
        "KPIRegion": {
          "component": "KpiGrid",
          "data_bindings": { "data": "dashboard" }
        },
        "CardGridRegion": {
          "component": "DashboardCardGrid",
          "data_bindings": { "data": "dashboard" },
          "actions": ["start_session", "create_entity"]
        }
      }
    },
    {
      "id": "domain",
      "title": "Domain",
      "icon": "list",
      "order": 1,
      "layout": { "layout_id": "split_dock" },
      "bindings": {
        "data_sources": {
          "entities": { "kind": "adapter_query", "query_ref": "q_entities", "refresh_policy": { "strategy": "event_driven", "events": ["entity.created", "entity.updated"] } }
        }
      },
      "regions": {
        "PrimaryRegion": {
          "component": "DomainEntityList",
          "data_bindings": { "rows": "entities" }
        },
        "DockRegion": {
          "component": "EntityEditorDock"
        }
      }
    }
  ]
}
```

---

# 4) Example: User Hub Tabs (`user` hub)

```json
{
  "schema_version": "1.0.0",
  "hub_type": "user",
  "default_tab_id": "dashboard",
  "shared": {
    "queries": {
      "q_user_dashboard": { "id": "q_user_dashboard", "method": "getDashboardData" },
      "q_inbox": { "id": "q_inbox", "method": "getInbox" },
      "q_work": { "id": "q_work", "method": "getAssignedWork" }
    }
  },
  "tabs": [
    {
      "id": "dashboard",
      "title": "Dashboard",
      "layout": { "layout_id": "dashboard_grid" },
      "bindings": {
        "data_sources": {
          "dashboard": { "kind": "adapter_query", "query_ref": "q_user_dashboard", "refresh_policy": { "strategy": "event_driven", "events": ["*"] } }
        }
      }
    },
    {
      "id": "inbox",
      "title": "Inbox",
      "layout": { "layout_id": "table" },
      "bindings": {
        "data_sources": {
          "inbox": { "kind": "adapter_query", "query_ref": "q_inbox", "refresh_policy": { "strategy": "event_driven", "events": ["event.created", "notification.created"] } }
        }
      },
      "regions": {
        "ToolbarRegion": { "component": "InboxToolbar" },
        "BodyRows": { "component": "InboxTable", "data_bindings": { "rows": "inbox" } }
      }
    }
  ]
}
```

---

# 5) Example: Event Catalog Tab Config (`system` hub)

```json
{
  "schema_version": "1.0.0",
  "hub_type": "system",
  "hub_id": "event_catalog",
  "default_tab_id": "catalog",
  "shared": {
    "queries": {
      "q_events": { "id": "q_events", "method": "getEvents", "cache": { "strategy": "until_event", "invalidate_on": ["event.created", "event.updated"] } }
    }
  },
  "tabs": [
    {
      "id": "catalog",
      "title": "Catalog",
      "layout": { "layout_id": "split_dock" },
      "bindings": {
        "data_sources": {
          "events": { "kind": "adapter_query", "query_ref": "q_events", "refresh_policy": { "strategy": "event_driven", "events": ["event.created", "event.updated"] } }
        }
      }
    }
  ]
}
```


---

# A) Layout Region Contracts (Specification)

## A.1 Common Contract Rules (applies to all layouts)

### Region ID naming

- Region IDs are **PascalCase** and must match the layout contract exactly.
    
- Tab configs may only override regions that exist for the chosen layout.
    

### Region override semantics

- If a region is not provided in `tab.regions`, the layout uses its default component for that region.
    
- Region components must be registered in the ComponentLibrary registry.
    

### Minimal region object

Each region override is:

```json
{
  "component": "ComponentName",
  "props": {},
  "data_bindings": { "propName": "data_source_key" },
  "actions": ["action_id"]
}
```

---

# B) Region Catalog: Layout → Regions

## B.1 `dashboard_grid` Layout Contract

**Purpose:** KPI + card grid (dashboards)

**Regions:**

- `KPIRegion` (optional)
    
- `CardGridRegion` (required)
    
- `QuickActionsRegion` (optional)
    

**Contract:**

- `KPIRegion` component must accept a `data` prop (array/object of KPI values).
    
- `CardGridRegion` component must accept a `data` prop (cards config + content).
    
- `QuickActionsRegion` must accept `actions` or action refs.
    

**Default Components:**

- `KPIRegion` → `KpiGrid`
    
- `CardGridRegion` → `DashboardCardGrid`
    
- `QuickActionsRegion` → `QuickActionsRow`
    

---

## B.2 `table` Layout Contract

**Purpose:** filterable, virtualized list/table view

**Regions:**

- `ToolbarRegion` (optional)
    
- `FacetRegion` (optional) _(for left-side facets)_
    
- `HeaderRegion` (optional) _(for table header customization)_
    
- `BodyRegion` (required)
    
- `EmptyStateRegion` (optional)
    
- `FooterRegion` (optional)
    

**Contract:**

- `BodyRegion` must accept `rows` (array) and `columns` (optional).
    
- `ToolbarRegion` should expose filter/search inputs.
    
- If `FacetRegion` exists, `BodyRegion` must support filtered output.
    

**Default Components:**

- `ToolbarRegion` → `TableToolbar`
    
- `FacetRegion` → `FacetPanel`
    
- `BodyRegion` → `VirtualizedTable`
    
- `EmptyStateRegion` → `EmptyState`
    
- `FooterRegion` → `PaginationFooter`
    

---

## B.3 `split_dock` Layout Contract

**Purpose:** primary content + dock (editor/inspector)

**Regions:**

- `PrimaryRegion` (required)
    
- `DockRegion` (required)
    
- `DockHeaderRegion` (optional)
    
- `DockFooterRegion` (optional)
    

**Contract:**

- `PrimaryRegion` should emit selection events (e.g., `ui.selection.changed`)
    
- `DockRegion` consumes selection context (via RightRail / context injection)
    
- Dock must handle “no selection” state gracefully.
    

**Default Components:**

- `PrimaryRegion` → (none, must be provided by tab or adapter defaults)
    
- `DockRegion` → `InspectorPanel`
    
- `DockHeaderRegion` → `DockHeader`
    
- `DockFooterRegion` → `DockFooter`
    

---

## B.4 `board` Layout Contract

**Purpose:** Kanban-style board

**Regions:**

- `ToolbarRegion` (optional)
    
- `BoardRegion` (required)
    
- `SwimlaneRegion` (optional)
    
- `EmptyStateRegion` (optional)
    

**Contract:**

- `BoardRegion` must accept `columns` and `cards`
    
- Cards must emit selection events
    
- Drag/drop is optional but should be supported in future
    

**Default Components:**

- `ToolbarRegion` → `BoardToolbar`
    
- `BoardRegion` → `KanbanBoard`
    
- `EmptyStateRegion` → `EmptyState`
    

---

## B.5 `graph` Layout Contract

**Purpose:** graph visualization + controls

**Regions:**

- `ToolbarRegion` (optional)
    
- `GraphRegion` (required)
    
- `LegendRegion` (optional)
    
- `DetailsRegion` (optional) _(for selection details)_
    

**Contract:**

- `GraphRegion` accepts `nodes`, `edges`, `layout_options`
    
- Must support scoping/filtering via Toolbar
    
- Selection must propagate to context / InspectorPanel
    

**Default Components:**

- `ToolbarRegion` → `GraphToolbar`
    
- `GraphRegion` → `GraphCanvas`
    
- `LegendRegion` → `GraphLegend`
    
- `DetailsRegion` → `GraphDetailsPanel`
    

---

## B.6 `session_focus` Layout Contract

**Purpose:** distraction-free pomodoro + workspace

**Regions:**

- `SessionHeaderRegion` (required)
    
- `TimerRegion` (required)
    
- `WorkspaceRegion` (required)
    
- `NotesRegion` (optional)
    
- `ArtifactsRegion` (optional)
    

**Contract:**

- Timer emits `session.timer.tick`, `session.completed`
    
- Workspace can be Canvas/Board/Table depending on session type
    
- Notes region writes markdown artifacts
    

**Default Components:**

- `SessionHeaderRegion` → `SessionHeader`
    
- `TimerRegion` → `PomodoroTimer`
    
- `WorkspaceRegion` → `SessionWorkspace`
    
- `NotesRegion` → `SessionNotes`
    
- `ArtifactsRegion` → `SessionArtifacts`
    

---

# C) JSON Schema Extension: Validate Region Names Against Layout

JSON Schema can’t _perfectly_ enforce dynamic keys based on a field without `if/then` blocks per layout — but we can do it cleanly for your finite set of layouts.

### C.1 Replace `regions` with this

```json
{
  "type": "object",
  "description": "Region overrides for chosen layout.",
  "additionalProperties": false,
  "properties": {},
  "allOf": [
    { "$ref": "#/$defs/regions_for_dashboard_grid" },
    { "$ref": "#/$defs/regions_for_table" },
    { "$ref": "#/$defs/regions_for_split_dock" },
    { "$ref": "#/$defs/regions_for_board" },
    { "$ref": "#/$defs/regions_for_graph" },
    { "$ref": "#/$defs/regions_for_session_focus" },
    { "$ref": "#/$defs/regions_for_custom" }
  ]
}
```

### C.2 Add these defs to `$defs`

```json
{
  "regions_for_dashboard_grid": {
    "if": {
      "properties": {
        "layout": { "properties": { "layout_id": { "const": "dashboard_grid" } } }
      }
    },
    "then": {
      "properties": {
        "regions": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "KPIRegion": { "$ref": "#/$defs/region_def" },
            "CardGridRegion": { "$ref": "#/$defs/region_def" },
            "QuickActionsRegion": { "$ref": "#/$defs/region_def" }
          }
        }
      }
    }
  },

  "regions_for_table": {
    "if": {
      "properties": {
        "layout": { "properties": { "layout_id": { "const": "table" } } }
      }
    },
    "then": {
      "properties": {
        "regions": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "ToolbarRegion": { "$ref": "#/$defs/region_def" },
            "FacetRegion": { "$ref": "#/$defs/region_def" },
            "HeaderRegion": { "$ref": "#/$defs/region_def" },
            "BodyRegion": { "$ref": "#/$defs/region_def" },
            "EmptyStateRegion": { "$ref": "#/$defs/region_def" },
            "FooterRegion": { "$ref": "#/$defs/region_def" }
          }
        }
      }
    }
  },

  "regions_for_split_dock": {
    "if": {
      "properties": {
        "layout": { "properties": { "layout_id": { "const": "split_dock" } } }
      }
    },
    "then": {
      "properties": {
        "regions": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "PrimaryRegion": { "$ref": "#/$defs/region_def" },
            "DockRegion": { "$ref": "#/$defs/region_def" },
            "DockHeaderRegion": { "$ref": "#/$defs/region_def" },
            "DockFooterRegion": { "$ref": "#/$defs/region_def" }
          }
        }
      }
    }
  },

  "regions_for_board": {
    "if": {
      "properties": {
        "layout": { "properties": { "layout_id": { "const": "board" } } }
      }
    },
    "then": {
      "properties": {
        "regions": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "ToolbarRegion": { "$ref": "#/$defs/region_def" },
            "BoardRegion": { "$ref": "#/$defs/region_def" },
            "SwimlaneRegion": { "$ref": "#/$defs/region_def" },
            "EmptyStateRegion": { "$ref": "#/$defs/region_def" }
          }
        }
      }
    }
  },

  "regions_for_graph": {
    "if": {
      "properties": {
        "layout": { "properties": { "layout_id": { "const": "graph" } } }
      }
    },
    "then": {
      "properties": {
        "regions": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "ToolbarRegion": { "$ref": "#/$defs/region_def" },
            "GraphRegion": { "$ref": "#/$defs/region_def" },
            "LegendRegion": { "$ref": "#/$defs/region_def" },
            "DetailsRegion": { "$ref": "#/$defs/region_def" }
          }
        }
      }
    }
  },

  "regions_for_session_focus": {
    "if": {
      "properties": {
        "layout": { "properties": { "layout_id": { "const": "session_focus" } } }
      }
    },
    "then": {
      "properties": {
        "regions": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "SessionHeaderRegion": { "$ref": "#/$defs/region_def" },
            "TimerRegion": { "$ref": "#/$defs/region_def" },
            "WorkspaceRegion": { "$ref": "#/$defs/region_def" },
            "NotesRegion": { "$ref": "#/$defs/region_def" },
            "ArtifactsRegion": { "$ref": "#/$defs/region_def" }
          }
        }
      }
    }
  },

  "regions_for_custom": {
    "if": {
      "properties": {
        "layout": { "properties": { "layout_id": { "const": "custom" } } }
      }
    },
    "then": {
      "properties": {
        "regions": {
          "type": "object",
          "description": "Custom layouts may define any regions; validation is deferred.",
          "additionalProperties": { "$ref": "#/$defs/region_def" }
        }
      }
    }
  }
}
```

**How to apply:**  
These `if/then` defs live inside your tab schema under `$defs`. The `regions` property becomes layout-aware.

---

# D) Examples With Region Overrides

## D.1 DashboardGrid (User Hub Dashboard)

```json
{
  "id": "dashboard",
  "title": "Dashboard",
  "layout": { "layout_id": "dashboard_grid" },
  "bindings": {
    "data_sources": {
      "dashboard": {
        "kind": "adapter_query",
        "query_ref": "q_user_dashboard",
        "refresh_policy": { "strategy": "event_driven", "events": ["*"] }
      }
    }
  },
  "regions": {
    "KPIRegion": { "component": "KpiGrid", "data_bindings": { "data": "dashboard" } },
    "CardGridRegion": { "component": "UserDashboardCards", "data_bindings": { "data": "dashboard" } },
    "QuickActionsRegion": { "component": "QuickActionsRow" }
  }
}
```

## D.2 SplitDock (Domain Tab)

```json
{
  "id": "domain",
  "title": "Domain",
  "layout": { "layout_id": "split_dock" },
  "bindings": {
    "data_sources": { "entities": { "kind": "adapter_query", "query_ref": "q_entities" } }
  },
  "regions": {
    "PrimaryRegion": { "component": "DomainEntityList", "data_bindings": { "rows": "entities" } },
    "DockRegion": { "component": "EntityEditorDock" }
  }
}
```

---

# E) Implementation Notes (small but important)

- **Region names are part of the API** between layouts and config.
    
- Prefer **default components** in the layout and override only when needed.
    
- For performance and consistency:
    
    - `table.BodyRegion` should default to a `VirtualizedTable`
        
    - `graph.GraphRegion` should be lazy-loaded
        

---


## 1) Layout Manifest Document

Create a file like:

`Development/flowti/src/ui/layouts/layout-manifest.json`

```json
{
  "manifest_version": "1.0.0",
  "generated_at": "2026-02-15",
  "layouts": {
    "dashboard_grid": {
      "layout_id": "dashboard_grid",
      "title": "Dashboard Grid",
      "description": "KPI + card grid dashboard layout.",
      "regions": {
        "KPIRegion": { "required": false, "default_component": "KpiGrid" },
        "CardGridRegion": { "required": true, "default_component": "DashboardCardGrid" },
        "QuickActionsRegion": { "required": false, "default_component": "QuickActionsRow" }
      },
      "recommended": {
        "data_bindings": {
          "KPIRegion": { "data": "dashboard" },
          "CardGridRegion": { "data": "dashboard" }
        }
      }
    },

    "table": {
      "layout_id": "table",
      "title": "Table",
      "description": "Filterable, virtualized list/table layout.",
      "regions": {
        "ToolbarRegion": { "required": false, "default_component": "TableToolbar" },
        "FacetRegion": { "required": false, "default_component": "FacetPanel" },
        "HeaderRegion": { "required": false, "default_component": "TableHeader" },
        "BodyRegion": { "required": true, "default_component": "VirtualizedTable" },
        "EmptyStateRegion": { "required": false, "default_component": "EmptyState" },
        "FooterRegion": { "required": false, "default_component": "PaginationFooter" }
      },
      "recommended": {
        "data_bindings": {
          "BodyRegion": { "rows": "rows" }
        }
      }
    },

    "split_dock": {
      "layout_id": "split_dock",
      "title": "Split Dock",
      "description": "Primary content + dock for editor/inspector.",
      "regions": {
        "PrimaryRegion": { "required": true, "default_component": null },
        "DockRegion": { "required": true, "default_component": "InspectorPanel" },
        "DockHeaderRegion": { "required": false, "default_component": "DockHeader" },
        "DockFooterRegion": { "required": false, "default_component": "DockFooter" }
      }
    },

    "board": {
      "layout_id": "board",
      "title": "Board",
      "description": "Kanban-style board layout.",
      "regions": {
        "ToolbarRegion": { "required": false, "default_component": "BoardToolbar" },
        "BoardRegion": { "required": true, "default_component": "KanbanBoard" },
        "SwimlaneRegion": { "required": false, "default_component": null },
        "EmptyStateRegion": { "required": false, "default_component": "EmptyState" }
      }
    },

    "graph": {
      "layout_id": "graph",
      "title": "Graph",
      "description": "Graph visualization + controls.",
      "regions": {
        "ToolbarRegion": { "required": false, "default_component": "GraphToolbar" },
        "GraphRegion": { "required": true, "default_component": "GraphCanvas" },
        "LegendRegion": { "required": false, "default_component": "GraphLegend" },
        "DetailsRegion": { "required": false, "default_component": "GraphDetailsPanel" }
      }
    },

    "session_focus": {
      "layout_id": "session_focus",
      "title": "Session Focus",
      "description": "Distraction-free session layout for documentation sessions.",
      "regions": {
        "SessionHeaderRegion": { "required": true, "default_component": "SessionHeader" },
        "TimerRegion": { "required": true, "default_component": "PomodoroTimer" },
        "WorkspaceRegion": { "required": true, "default_component": "SessionWorkspace" },
        "NotesRegion": { "required": false, "default_component": "SessionNotes" },
        "ArtifactsRegion": { "required": false, "default_component": "SessionArtifacts" }
      }
    },

    "custom": {
      "layout_id": "custom",
      "title": "Custom",
      "description": "Custom layout; regions are not validated against a fixed contract.",
      "regions": {}
    }
  },

  "rules": {
    "region_override_policy": {
      "unknown_region_is_error": true,
      "missing_required_region_is_error": true
    },
    "recommended_practices": {
      "table_should_be_virtualized": true,
      "prefer_event_driven_refresh": true
    }
  }
}
```

---

## 2) Example Validator Function (TypeScript)

Create a file like:

`Development/flowti/src/ui/layouts/validate-tab-config.ts`

```ts
/* eslint-disable @typescript-eslint/no-explicit-any */

export type LayoutId =
  | "dashboard_grid"
  | "table"
  | "split_dock"
  | "board"
  | "graph"
  | "session_focus"
  | "custom";

export type LayoutManifest = {
  manifest_version: string;
  layouts: Record<
    string,
    {
      layout_id: LayoutId;
      title?: string;
      description?: string;
      regions: Record<
        string,
        {
          required: boolean;
          default_component: string | null;
        }
      >;
    }
  >;
  rules?: {
    region_override_policy?: {
      unknown_region_is_error?: boolean;
      missing_required_region_is_error?: boolean;
    };
    recommended_practices?: {
      table_should_be_virtualized?: boolean;
      prefer_event_driven_refresh?: boolean;
    };
  };
};

export type TabConfig = {
  id: string;
  title: string;
  layout: {
    layout_id: LayoutId;
    variant?: string;
    custom_layout_component?: string;
    layout_options?: Record<string, any>;
  };
  bindings: {
    data_sources: Record<string, any>;
    actions?: Record<string, any>;
    event_bus?: {
      namespace?: string;
      subscriptions?: Array<{ event: string; handler: string; debounce_ms?: number }>;
      emit_defaults?: Record<string, any>;
    };
  };
  regions?: Record<
    string,
    {
      component: string;
      props?: Record<string, any>;
      data_bindings?: Record<string, string>;
      actions?: string[];
    }
  >;
};

export type TabDefinitionDoc = {
  schema_version: string;
  hub_type: "user" | "domain" | "system";
  hub_id?: string;
  default_tab_id?: string;
  tabs: TabConfig[];
  shared?: any;
};

export type ValidationIssue = {
  level: "error" | "warning";
  code: string;
  message: string;
  path?: string;
};

export type ValidationResult = {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

/**
 * Validates tab definitions against the Layout Manifest.
 * - Ensures layout exists
 * - Ensures region overrides are valid region keys for layout (unless custom)
 * - Ensures required regions are provided by default OR overridden OR explicitly satisfied by default_component
 * - Some pragmatic checks (custom layout component presence, table virtualization recommendation, etc.)
 */
export function validateTabDefinitionsAgainstManifest(
  doc: TabDefinitionDoc,
  manifest: LayoutManifest,
  options?: {
    /**
     * If you have a registry of components, pass it to validate component names.
     * If omitted, component existence is not checked.
     */
    componentRegistry?: Set<string>;
    /**
     * If true, require PrimaryRegion override for split_dock because default is null.
     * Recommended.
     */
    requireSplitDockPrimaryOverride?: boolean;
  }
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const add = (issue: ValidationIssue) => issues.push(issue);

  const policy = manifest.rules?.region_override_policy ?? {};
  const unknownRegionIsError = policy.unknown_region_is_error ?? true;
  const missingRequiredIsError = policy.missing_required_region_is_error ?? true;

  const componentRegistry = options?.componentRegistry;
  const requireSplitDockPrimaryOverride = options?.requireSplitDockPrimaryOverride ?? true;

  // Basic doc checks
  if (!doc || !Array.isArray(doc.tabs) || doc.tabs.length === 0) {
    add({
      level: "error",
      code: "doc.tabs.missing",
      message: "Tab definition document must contain at least one tab.",
      path: "tabs"
    });
    return splitIssues(issues);
  }

  // Uniqueness of tab IDs
  const seen = new Set<string>();
  for (const tab of doc.tabs) {
    if (seen.has(tab.id)) {
      add({
        level: "error",
        code: "tab.id.duplicate",
        message: `Duplicate tab id '${tab.id}'. Tab ids must be unique within a hub config.`,
        path: `tabs[id=${tab.id}]`
      });
    }
    seen.add(tab.id);
  }

  // Validate each tab
  for (let i = 0; i < doc.tabs.length; i++) {
    const tab = doc.tabs[i];
    const tabPath = `tabs[${i}]`;

    // Layout exists?
    const layoutId = tab.layout?.layout_id;
    const layout = manifest.layouts[layoutId];

    if (!layout) {
      add({
        level: "error",
        code: "layout.unknown",
        message: `Unknown layout_id '${layoutId}'. Must be declared in layout-manifest.json.`,
        path: `${tabPath}.layout.layout_id`
      });
      continue;
    }

    // Custom layout requires custom_layout_component
    if (layoutId === "custom" && !tab.layout.custom_layout_component) {
      add({
        level: "error",
        code: "layout.custom.missing_component",
        message: `layout_id='custom' requires 'custom_layout_component'.`,
        path: `${tabPath}.layout.custom_layout_component`
      });
    }

    // Region validation (skip strict region set for custom layout)
    const overrides = tab.regions ?? {};
    const overrideKeys = Object.keys(overrides);

    if (layoutId !== "custom") {
      const allowedRegions = new Set(Object.keys(layout.regions));

      // Unknown regions
      for (const regionKey of overrideKeys) {
        if (!allowedRegions.has(regionKey)) {
          add({
            level: unknownRegionIsError ? "error" : "warning",
            code: "region.unknown",
            message: `Region '${regionKey}' is not valid for layout '${layoutId}'.`,
            path: `${tabPath}.regions.${regionKey}`
          });
        }
      }

      // Missing required regions
      for (const [regionKey, meta] of Object.entries(layout.regions)) {
        if (!meta.required) continue;

        const hasOverride = Object.prototype.hasOwnProperty.call(overrides, regionKey);
        const hasDefaultComponent = !!meta.default_component;

        // If required and no default component, it must be overridden
        if (!hasOverride && !hasDefaultComponent) {
          add({
            level: missingRequiredIsError ? "error" : "warning",
            code: "region.required.missing",
            message: `Required region '${regionKey}' for layout '${layoutId}' has no default component and must be provided in tab.regions.`,
            path: `${tabPath}.regions`
          });
        }
      }

      // Extra rule: SplitDock PrimaryRegion should be overridden (recommended)
      if (layoutId === "split_dock" && requireSplitDockPrimaryOverride) {
        const primaryMeta = layout.regions["PrimaryRegion"];
        const hasOverride = Object.prototype.hasOwnProperty.call(overrides, "PrimaryRegion");
        const hasDefault = !!primaryMeta?.default_component;
        if (!hasOverride && !hasDefault) {
          add({
            level: "error",
            code: "split_dock.primary.missing",
            message:
              "split_dock requires PrimaryRegion to be provided (no default). Add tab.regions.PrimaryRegion.",
            path: `${tabPath}.regions.PrimaryRegion`
          });
        }
      }
    }

    // Component registry checks (optional)
    if (componentRegistry) {
      for (const [regionKey, def] of Object.entries(overrides)) {
        if (!componentRegistry.has(def.component)) {
          add({
            level: "warning",
            code: "component.unknown",
            message: `Region '${regionKey}' references component '${def.component}', which is not present in the provided componentRegistry.`,
            path: `${tabPath}.regions.${regionKey}.component`
          });
        }
      }
    }

    // Pragmatic recommendations
    if (layoutId === "table" && manifest.rules?.recommended_practices?.table_should_be_virtualized) {
      const body = overrides["BodyRegion"];
      // If overridden, ensure it's a virtualized table (heuristic)
      if (body?.component && !looksVirtualized(body.component)) {
        add({
          level: "warning",
          code: "table.body.not_virtualized",
          message:
            `Table BodyRegion is overridden with '${body.component}'. Consider using a virtualized table component for performance.`,
          path: `${tabPath}.regions.BodyRegion.component`
        });
      }
    }

    if (manifest.rules?.recommended_practices?.prefer_event_driven_refresh) {
      const dataSources = tab.bindings?.data_sources ?? {};
      for (const [dsKey, ds] of Object.entries<any>(dataSources)) {
        const policy = ds?.refresh_policy?.strategy;
        // Encourage event-driven over interval polling
        if (policy === "interval") {
          add({
            level: "warning",
            code: "refresh.interval",
            message:
              `Data source '${dsKey}' uses interval refresh. Prefer event-driven refresh when possible.`,
            path: `${tabPath}.bindings.data_sources.${dsKey}.refresh_policy.strategy`
          });
        }
      }
    }
  }

  return splitIssues(issues);
}

function splitIssues(issues: ValidationIssue[]): ValidationResult {
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  return { ok: errors.length === 0, errors, warnings };
}

function looksVirtualized(componentName: string): boolean {
  const c = componentName.toLowerCase();
  return c.includes("virtual") || c.includes("virtualized");
}
```

---

## Optional: Tiny usage snippet (for unit tests)

```ts
import manifest from "./layout-manifest.json";
import { validateTabDefinitionsAgainstManifest } from "./validate-tab-config";

const result = validateTabDefinitionsAgainstManifest(tabDoc, manifest, {
  componentRegistry: new Set(["KpiGrid", "DashboardCardGrid", "VirtualizedTable", "InspectorPanel"]),
  requireSplitDockPrimaryOverride: true
});

if (!result.ok) {
  console.error(result.errors);
  throw new Error("Tab config validation failed");
}
console.warn(result.warnings);
```

---


## 1) Component Manifest Document

Create:

`Development/flowti/src/ui/components/component-manifest.json`

```json
{
  "manifest_version": "1.0.0",
  "generated_at": "2026-02-15",
  "components": {
    "KpiGrid": {
      "kind": "view",
      "description": "Displays KPI tiles in a grid.",
      "props_contract": {
        "required": ["data"],
        "optional": ["variant", "onSelect"]
      },
      "emits": ["ui.selection.changed"],
      "accepts_context": ["hub", "user", "selection"],
      "tags": ["dashboard", "kpi"]
    },

    "DashboardCardGrid": {
      "kind": "view",
      "description": "Renders dashboard cards in a responsive grid.",
      "props_contract": {
        "required": ["data"],
        "optional": ["actions", "variant"]
      },
      "emits": ["ui.navigate", "ui.action.triggered"],
      "accepts_context": ["hub", "user"],
      "tags": ["dashboard"]
    },

    "QuickActionsRow": {
      "kind": "view",
      "description": "Horizontal list of quick action tiles/buttons.",
      "props_contract": {
        "required": [],
        "optional": ["actions", "variant"]
      },
      "emits": ["ui.action.triggered"],
      "accepts_context": ["hub", "user"],
      "tags": ["actions"]
    },

    "TableToolbar": {
      "kind": "view",
      "description": "Search/filter toolbar for table views.",
      "props_contract": {
        "required": [],
        "optional": ["filters", "search", "onFilterChange"]
      },
      "emits": ["ui.filter.changed", "ui.search.changed"],
      "accepts_context": ["hub", "user"],
      "tags": ["table", "toolbar"]
    },

    "FacetPanel": {
      "kind": "view",
      "description": "Facet filters (left-side).",
      "props_contract": {
        "required": ["facets"],
        "optional": ["selected", "onChange"]
      },
      "emits": ["ui.filter.changed"],
      "accepts_context": ["hub"],
      "tags": ["table", "filter"]
    },

    "TableHeader": {
      "kind": "view",
      "description": "Optional header region for table layout.",
      "props_contract": {
        "required": [],
        "optional": ["columns", "variant"]
      },
      "emits": [],
      "accepts_context": ["hub"],
      "tags": ["table"]
    },

    "VirtualizedTable": {
      "kind": "view",
      "description": "High-performance table with virtualization.",
      "props_contract": {
        "required": ["rows"],
        "optional": ["columns", "rowActions", "onRowSelect", "variant"]
      },
      "emits": ["ui.selection.changed", "ui.action.triggered"],
      "accepts_context": ["hub", "user", "selection"],
      "tags": ["table", "performance", "virtualized"]
    },

    "PaginationFooter": {
      "kind": "view",
      "description": "Pagination controls for long lists.",
      "props_contract": {
        "required": ["page", "pageSize", "total"],
        "optional": ["onChange"]
      },
      "emits": ["ui.pagination.changed"],
      "accepts_context": ["hub"],
      "tags": ["table"]
    },

    "EmptyState": {
      "kind": "view",
      "description": "Standard empty state placeholder.",
      "props_contract": {
        "required": [],
        "optional": ["title", "message", "actions"]
      },
      "emits": ["ui.action.triggered"],
      "accepts_context": ["hub", "user"],
      "tags": ["ui", "empty"]
    },

    "InspectorPanel": {
      "kind": "panel",
      "description": "Context inspector (RightRail or Dock).",
      "props_contract": {
        "required": [],
        "optional": ["mode", "tabs", "onChange"]
      },
      "emits": ["ui.navigate", "ui.action.triggered"],
      "accepts_context": ["hub", "selection", "user"],
      "tags": ["panel", "inspector"]
    },

    "DockHeader": {
      "kind": "panel",
      "description": "Optional header for dock region.",
      "props_contract": {
        "required": [],
        "optional": ["title", "actions"]
      },
      "emits": ["ui.action.triggered"],
      "accepts_context": ["hub", "selection"],
      "tags": ["dock"]
    },

    "DockFooter": {
      "kind": "panel",
      "description": "Optional footer for dock region.",
      "props_contract": {
        "required": [],
        "optional": ["actions"]
      },
      "emits": ["ui.action.triggered"],
      "accepts_context": ["hub", "selection"],
      "tags": ["dock"]
    },

    "DomainEntityList": {
      "kind": "view",
      "description": "Domain entity list (table or hybrid list).",
      "props_contract": {
        "required": ["rows"],
        "optional": ["columns", "filters", "onSelect"]
      },
      "emits": ["ui.selection.changed", "ui.navigate"],
      "accepts_context": ["hub", "selection"],
      "tags": ["domain", "entity"]
    },

    "EntityEditorDock": {
      "kind": "view",
      "description": "Dock editor for selected entity.",
      "props_contract": {
        "required": [],
        "optional": ["entity", "schema", "onSave"]
      },
      "emits": ["entity.updated", "ui.action.triggered"],
      "accepts_context": ["hub", "selection"],
      "tags": ["domain", "editor"]
    },

    "BoardToolbar": {
      "kind": "view",
      "description": "Toolbar for boards (filters, grouping, quick actions).",
      "props_contract": {
        "required": [],
        "optional": ["filters", "onFilterChange", "actions"]
      },
      "emits": ["ui.filter.changed", "ui.action.triggered"],
      "accepts_context": ["hub", "user"],
      "tags": ["board", "toolbar"]
    },

    "KanbanBoard": {
      "kind": "view",
      "description": "Kanban board component.",
      "props_contract": {
        "required": ["columns", "cards"],
        "optional": ["swimlanes", "onMove", "onSelect"]
      },
      "emits": ["ui.selection.changed", "work.item.moved"],
      "accepts_context": ["hub", "user", "selection"],
      "tags": ["board", "work"]
    },

    "GraphToolbar": {
      "kind": "view",
      "description": "Controls for graph filtering and layout.",
      "props_contract": {
        "required": [],
        "optional": ["filters", "layoutOptions", "onChange"]
      },
      "emits": ["ui.filter.changed"],
      "accepts_context": ["hub"],
      "tags": ["graph", "toolbar"]
    },

    "GraphCanvas": {
      "kind": "view",
      "description": "Graph rendering surface.",
      "props_contract": {
        "required": ["nodes", "edges"],
        "optional": ["layout_options", "onSelect", "variant"]
      },
      "emits": ["ui.selection.changed"],
      "accepts_context": ["hub", "selection"],
      "tags": ["graph"]
    },

    "GraphLegend": {
      "kind": "view",
      "description": "Graph legend for node/edge types.",
      "props_contract": {
        "required": [],
        "optional": ["legend"]
      },
      "emits": [],
      "accepts_context": ["hub"],
      "tags": ["graph"]
    },

    "GraphDetailsPanel": {
      "kind": "panel",
      "description": "Selection details panel for graph view.",
      "props_contract": {
        "required": [],
        "optional": ["selection", "onAction"]
      },
      "emits": ["ui.action.triggered"],
      "accepts_context": ["hub", "selection"],
      "tags": ["graph", "panel"]
    },

    "SessionHeader": {
      "kind": "view",
      "description": "Session header (title, type, status, actions).",
      "props_contract": {
        "required": ["session"],
        "optional": ["actions"]
      },
      "emits": ["session.updated", "ui.action.triggered"],
      "accepts_context": ["hub", "user"],
      "tags": ["session"]
    },

    "PomodoroTimer": {
      "kind": "view",
      "description": "Pomodoro timer component for documentation sessions.",
      "props_contract": {
        "required": ["duration"],
        "optional": ["state", "onTick", "onComplete"]
      },
      "emits": ["session.timer.tick", "session.completed"],
      "accepts_context": ["hub", "user"],
      "tags": ["session", "timer"]
    },

    "SessionWorkspace": {
      "kind": "view",
      "description": "Main workspace area during a session (canvas/board/table).",
      "props_contract": {
        "required": ["session"],
        "optional": ["workspaceType", "resources"]
      },
      "emits": ["session.artifact.created", "ui.selection.changed"],
      "accepts_context": ["hub", "selection", "user"],
      "tags": ["session", "workspace"]
    },

    "SessionNotes": {
      "kind": "view",
      "description": "Notes region for a session; persists as markdown artifacts.",
      "props_contract": {
        "required": ["session"],
        "optional": ["path", "onSave"]
      },
      "emits": ["session.artifact.created"],
      "accepts_context": ["hub", "user"],
      "tags": ["session", "notes"]
    },

    "SessionArtifacts": {
      "kind": "view",
      "description": "List of artifacts created during a session.",
      "props_contract": {
        "required": ["artifacts"],
        "optional": ["onOpen"]
      },
      "emits": ["ui.navigate"],
      "accepts_context": ["hub"],
      "tags": ["session", "artifacts"]
    },

    "InboxToolbar": {
      "kind": "view",
      "description": "Toolbar for user inbox (filters, actions).",
      "props_contract": {
        "required": [],
        "optional": ["filters", "actions"]
      },
      "emits": ["ui.filter.changed", "ui.action.triggered"],
      "accepts_context": ["user", "hub"],
      "tags": ["user", "inbox"]
    },

    "InboxTable": {
      "kind": "view",
      "description": "Inbox list/table view.",
      "props_contract": {
        "required": ["rows"],
        "optional": ["columns", "onSelect"]
      },
      "emits": ["ui.selection.changed", "ui.action.triggered"],
      "accepts_context": ["user", "hub", "selection"],
      "tags": ["user", "inbox", "table"]
    },

    "UserDashboardCards": {
      "kind": "view",
      "description": "User hub dashboard cards (today, activity, docs nudges, cross-hub summary).",
      "props_contract": {
        "required": ["data"],
        "optional": ["variant", "actions"]
      },
      "emits": ["ui.navigate", "ui.action.triggered"],
      "accepts_context": ["user", "hub"],
      "tags": ["user", "dashboard"]
    }
  },

  "groups": {
    "layouts_default_components": [
      "KpiGrid",
      "DashboardCardGrid",
      "QuickActionsRow",
      "TableToolbar",
      "FacetPanel",
      "TableHeader",
      "VirtualizedTable",
      "PaginationFooter",
      "EmptyState",
      "InspectorPanel",
      "DockHeader",
      "DockFooter",
      "BoardToolbar",
      "KanbanBoard",
      "GraphToolbar",
      "GraphCanvas",
      "GraphLegend",
      "GraphDetailsPanel",
      "SessionHeader",
      "PomodoroTimer",
      "SessionWorkspace",
      "SessionNotes",
      "SessionArtifacts"
    ],
    "user_hub_components": [
      "UserDashboardCards",
      "InboxToolbar",
      "InboxTable"
    ],
    "domain_hub_components": [
      "DomainEntityList",
      "EntityEditorDock"
    ]
  }
}
```

---

## 2) Optional helper: Component Registry Loader

Create:

`Development/flowti/src/ui/components/component-registry.ts`

```ts
import manifest from "./component-manifest.json";

export type ComponentManifest = typeof manifest;

export function getComponentNameSet(): Set<string> {
  return new Set(Object.keys(manifest.components));
}

export function hasComponent(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(manifest.components, name);
}

export function getComponentMeta(name: string) {
  return (manifest.components as Record<string, unknown>)[name] ?? null;
}
```

---

## 3) Plug it into your existing validator

Where you call:

```ts
validateTabDefinitionsAgainstManifest(tabDoc, layoutManifest, {
  componentRegistry: getComponentNameSet()
});
```

✅ You now validate:

- Layout region keys (via layout manifest)
    
- Component names (via component manifest)
    
