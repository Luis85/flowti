---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: Feature
stage: open
related_hubs:
  - User Hub
  - Event Catalog (System Hub)
  - Data Exchange (System Hub)
  - Product Hub
  - Project Hub
related_events:
  - hub.opened
  - hub.closed
  - hub.tab.changed
  - session.created
  - session.started
  - session.completed
maturity: L1
maturity_score_strategy: 5
maturity_score_scope: 4
maturity_score_architecture: 4
maturity_score_event_integration: 3
maturity_score_data_model: 3
maturity_score_ui_consistency: 3
maturity_score_validation_testing: 1
maturity_score_total: 23
maturity_score_status: technically_ready
---

# Feature: Hubs - Domain-Centric Workspaces

> Architecture reference: [[Hubs]] (detailed layout library, manifests, region contracts, JSON schemas)

---

## 1. Problem Statement

Obsidian users managing complex domains (products, projects, services, areas) lack structured workspaces that aggregate relevant entities, events, documentation, and actions into cohesive views.

- **Who is affected?** Product owners, project managers, system architects, and anyone managing multi-entity domains in a knowledge vault.
- **What currently breaks or causes friction?**
  - The Event Catalog and Data Exchange Hub are isolated views with no shared UI framework — each has its own DOM structure, tab management, and state handling.
  - No personal cockpit (User Hub) exists for aggregated activity, inbox, or cross-domain overview.
  - Domain-specific workflows (product tracking, project management) require manual navigation across scattered notes with no guided structure.
  - Documentation discipline is hard to maintain without structured, time-boxed workflows.
- **Why does this matter strategically?**
  - Hubs are the presentation backbone of Flowti IBDE — every domain interaction happens through a Hub.
  - Without a shared Hub framework, each new domain view duplicates layout logic, state management, and event wiring.

---

## 2. Outcome (Success Definition)

- **User can** open domain-centric Hubs from the ribbon or command palette, each with a consistent dashboard, entity tables, and session capabilities.
- **System can** render any Hub using a shared shell + declarative layout + adapter pattern, eliminating per-view DOM construction.
- **Domain gains** a reusable framework where adding a new Hub requires only an adapter and tab definitions — no new layout code.

Measurable success:
- Event Catalog and Data Exchange Hub operate as System Hubs with zero feature regression.
- Adding a new Domain Hub (e.g., Product Hub) requires <200 LOC of adapter + config.
- Tab definitions validate against layout + component manifests at startup.

---

## 3. Scope

### In Scope (v1)

- Workspace shell layout (ribbon, tab bar, content area, status bar)
- Layout library: `dashboard_grid`, `table`, `split_dock`, `session_focus`
- HubAdapter interface for domain specialization
- Declarative tab definitions with JSON schema validation
- Component registry with manifest
- System Hub migration: Event Catalog, Data Exchange Hub
- User Hub: personal dashboard, inbox, cross-hub summary
- Documentation Sessions: time-boxed workflows with Pomodoro timer
- Domain Hubs: Product, Project

### Out of Scope (v2+)

- User-Generated Hubs (custom hub creation via UI)
- Board layout (Kanban)
- Graph layout (relation visualization)
- Real-time multiplayer sessions
- Plugin API for third-party hub adapters

---

## 4. UX Entry Points

Where does this feature live?

- **Left ribbon**: Hub launcher icon (opens hub picker or last-used hub)
- **Command palette**: `flowti:open-hub:<hub_type>` commands
- **Leaf view**: Each hub opens as an Obsidian ItemView leaf

Primary interaction path:
1. User clicks hub icon in ribbon or invokes command
2. Shell renders: workspace ribbon (hub icon, name, actions) + tab bar + content area
3. User navigates tabs; each tab renders a layout populated by the adapter
4. Actions (CRUD, import, export, session start) route through EventBus

---

## 5. Functional Requirements

### Shell

- [ ] Hub shell renders workspace ribbon + tab bar + content area
- [ ] Tab bar shows tabs defined in hub's tab configuration
- [ ] Active tab highlighted; inactive tabs lazy-rendered
- [ ] Shell provides shared state container accessible to all tabs
- [ ] Status bar shows hub context (entity counts, session status)

### Dashboard

- [ ] Dashboard tab uses `dashboard_grid` layout
- [ ] Stats grid shows domain KPIs via adapter's `getDashboardData()`
- [ ] Quick actions row provides domain-specific shortcuts
- [ ] Stats update via event-driven refresh (no polling)

### Entity Management

- [ ] Table layout shows entities with search, filter, sort
- [ ] Split dock layout shows master list + detail/editor panel
- [ ] Entity CRUD routes through `doc.create` / `doc.delete` events (DocService)
- [ ] Cross-references show related entities from other tabs

### Documentation Sessions

- [ ] Session Focus layout renders: header + timer + workspace + notes + artifacts
- [ ] Pomodoro timer with configurable duration (25/50 min)
- [ ] Session types: Event Storming, Service Design, Requirements Refinement, Backlog Structuring, Knowledge Cleanup
- [ ] Session lifecycle: Prepared → Scheduled → Active → Paused → Completed → Archived
- [ ] Artifacts persist as markdown files in session folder
- [ ] Session history visible per hub

### User Hub

- [ ] Personal dashboard with today's summary, recent activity, documentation nudges
- [ ] Inbox tab with actionable items from all domain hubs
- [ ] Cross-hub summary aggregating stats from all registered hubs

### System Hub Migration

- [ ] Event Catalog operates as System Hub with identical functionality
- [ ] Data Exchange Hub operates as System Hub with identical functionality
- [ ] Zero feature regression after migration

---

## 6. Data Model Impact

New entities:

```
Hub
  hub_id: string (unique)
  hub_type: "user" | "system" | "domain"
  domain_name: string
  display_name: string
  icon: string
  tabs: TabDefinition[]
  created_at: string
  updated_at: string

DocumentationSession
  session_id: string
  hub_id: string
  type: "event_storming" | "service_design" | "requirements" | "backlog" | "knowledge_cleanup"
  status: "prepared" | "scheduled" | "active" | "paused" | "completed" | "archived"
  scheduled_at?: string
  started_at?: string
  completed_at?: string
  duration_minutes: number
  artifacts: string[]  (file paths)
  notes_path?: string

TabDefinition
  id: string
  label: string
  icon: string
  layout_ref: string  (references layout manifest)
  bindings: { data_sources, actions, event_bus }
  regions: Record<string, RegionOverride>
```

New fields on existing entities: none (Hubs wrap existing entities, not extend them).

---

## 7. Event Impact

### Produced

- `hub.opened` — payload: `{ hubId, hubType }`
- `hub.closed` — payload: `{ hubId }`
- `hub.tab.changed` — payload: `{ hubId, tabId, previousTabId }`
- `session.created` — payload: `{ sessionId, hubId, type }`
- `session.started` — payload: `{ sessionId, startedAt }`
- `session.paused` — payload: `{ sessionId }`
- `session.completed` — payload: `{ sessionId, completedAt, artifacts[] }`
- `session.timer.tick` — payload: `{ sessionId, remainingMs }`
- `session.artifact.created` — payload: `{ sessionId, artifactPath }`

### Consumed

- All existing domain events (for dashboard refresh and cross-references)
- `settings.updated` — hub configuration changes
- `doc.created` / `doc.deleted` — entity CRUD notifications

### Transformed

- None (hubs are consumers and presenters, not event transformers)

---

## 8. UI Layout Impact

Layouts used:

| Layout | Hub Usage |
|--------|-----------|
| `dashboard_grid` | All hub dashboards (User, System, Domain) |
| `table` | Entity list tabs (events, imports, exports, entities) |
| `split_dock` | Entity detail tabs (master list + detail panel) |
| `session_focus` | Documentation sessions (header + timer + workspace + notes) |

New layouts required: `session_focus` (new).

Tabs affected:

| Hub | Tabs |
|-----|------|
| Event Catalog | Dashboard, Domains, Services, Events, Flows, Systems, Actors, Products |
| Data Exchange | Dashboard, Reports, Types, Properties, Imports, Exports, Pipelines |
| User Hub | Dashboard, Inbox, Activity |
| Product Hub | Dashboard, Features, Backlog, Sessions |
| Project Hub | Dashboard, Work Items, Sessions |

---

## 9. Adapter Impact

New adapter hierarchy:

```
HubAdapter (base interface)
├── getDashboardData(): DashboardData
├── getEntities(filters): EntityRow[]
├── getEntityDetail(id): EntityDetail
├── getSessions(): SessionEntry[]
├── getRelations(): RelationEdge[]
├── getTabDefinitions(): TabDefinition[]
└── dispose(): void

UserHubAdapter extends HubAdapter
├── getInboxItems(): InboxItem[]
├── getRecentActivity(): ActivityEntry[]
└── getCrossHubSummary(): HubSummary[]

EventCatalogAdapter extends HubAdapter
DataExchangeAdapter extends HubAdapter
ProductHubAdapter extends HubAdapter
ProjectHubAdapter extends HubAdapter
```

Methods per adapter are domain-specific but follow the base contract.

---

## 10. Non-Functional Requirements

- **Performance**: VirtualizedTable for lists >100 rows; lazy tab rendering (only active tab mounts)
- **Event-driven refresh**: No polling — all dashboard updates via EventBus listeners
- **Validation**: Tab definitions validated against layout + component manifests at startup
- **Memory**: Dispose all listeners on hub close; no leaked subscriptions
- **Extensibility**: New hub = new adapter + tab definitions; no layout code changes

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| Massive refactoring scope | Incremental migration: shell first → system hubs → domain hubs. Each phase is independently shippable. |
| Breaking existing Event Catalog / Data Exchange views | System hub migration preserves 100% of current functionality. Feature-flag rollback if needed. |
| Performance regression from layout abstraction | Layout system adds one DOM wrapper per region — negligible. Benchmark before/after. |
| Adapter interface too rigid for diverse domains | Keep base interface minimal (5 methods). Domain-specific methods live on adapter subclasses. |
| Layout library complexity | v1 ships 4 layouts (dashboard, table, split_dock, session_focus). Board + graph deferred to v2. |

---

## 12. Acceptance Criteria

- [ ] Hub shell renders workspace ribbon, tab bar, and content area
- [ ] Tab bar navigates between tabs; active tab renders correct layout
- [ ] Event Catalog works as System Hub with zero feature regression
- [ ] Data Exchange Hub works as System Hub with zero feature regression
- [ ] User Hub shows personal dashboard with cross-hub summary
- [ ] Documentation Session can be created, started (with timer), and completed with artifact persistence
- [ ] Tab definitions validate against layout and component manifests
- [ ] Adding a new Domain Hub requires only adapter + tab definitions (<200 LOC)
- [ ] All existing 1,662+ tests pass after migration
- [ ] `npm run build` passes (vitest + typedoc + tsc + eslint + esbuild)

---

## 13. Definition of Done

- [ ] Layout manifest created (`src/ui/layouts/layout-manifest.json`)
- [ ] Component manifest created (`src/ui/components/component-manifest.json`)
- [ ] HubAdapter interface defined with unit tests
- [ ] Shell layout implemented and renders all hub types
- [ ] At least 2 System Hubs migrated (Event Catalog, Data Exchange)
- [ ] User Hub implemented with dashboard + inbox
- [ ] Documentation Sessions domain implemented with timer + artifacts
- [ ] Tab definition validation passes for all hub configs
- [ ] Unit tests added for all new domain and infrastructure code
- [ ] Flow integration tests added for hub lifecycle
- [ ] `npm run build` passes
- [ ] Architecture documentation updated

---

## Technical Debt Prerequisites

The following refactoring items must be completed before or during Hub implementation. Each is tracked as a separate TD item in `docs/debt/`:

| TD | Title | Priority | Dependency |
|----|-------|----------|------------|
| [[TD-49 Layout abstraction layer]] | Extract declarative layout system | Critical | None |
| [[TD-50 Workspace shell layout]] | Shared shell with ribbon + tab bar | Critical | TD-49 |
| [[TD-51 Component registry]] | Manifest-driven component discovery | High | None |
| [[TD-52 Declarative tab definitions]] | JSON tab configs with validation | High | TD-49, TD-51 |
| [[TD-53 Shared UI primitive library]] | Extract inline styles to reusable primitives | Medium | None |
| [[TD-54 Event Catalog hub migration]] | Migrate Event Catalog to Hub pattern | High | TD-49, TD-50 |
| [[TD-55 Data Exchange hub migration]] | Migrate Data Exchange Hub to Hub pattern | High | TD-49, TD-50 |

---

## Product Backlog Items

New feature work items, each tracked as a separate PBI in `docs/features/Hubs/backlog/`:

| PBI | Title | Dependencies |
|-----|-------|-------------|
| [[PBI-001 User Hub]] | Personal cockpit with dashboard, inbox, activity | TD-49, TD-50 |
| [[PBI-002 Documentation Sessions]] | Time-boxed workflows with Pomodoro timer | TD-49 (session_focus layout) |
| [[PBI-003 Product Hub]] | Product domain workspace | TD-49, TD-50, HubAdapter |
| [[PBI-004 Project Hub]] | Project domain workspace | TD-49, TD-50, HubAdapter |

---

## Implementation Phases

### Phase 1: Foundation (TD-49, TD-50, TD-51, TD-53)
Build the layout system, shell, component registry, and shared primitives. No user-visible changes yet.

### Phase 2: System Hub Migration (TD-54, TD-55, TD-52)
Migrate Event Catalog and Data Exchange Hub to the new framework. All existing features preserved. Tab definitions validated.

### Phase 3: User Hub (PBI-001)
Build the User Hub with personal dashboard, inbox, and cross-hub summary.

### Phase 4: Sessions + Domain Hubs (PBI-002, PBI-003, PBI-004)
Add Documentation Sessions domain and first Domain Hubs (Product, Project).


