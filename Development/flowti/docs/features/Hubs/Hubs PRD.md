---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: in-progress
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
  - hub.navigate
  - ui.openUserHub
maturity: L3
maturity_score_strategy: 5
maturity_score_scope: 5
maturity_score_architecture: 5
maturity_score_event_integration: 5
maturity_score_data_model: 4
maturity_score_ui_consistency: 4
maturity_score_validation_testing: 3
business_value: 5
implementation_cost: 5
maintenance_cost: 3
discovery_cost: 4
design_cost: 4
test_cost: 4
priority: 3
fri_score: 31
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
- Event Catalog and Data Exchange Hub operate as System Hubs with zero feature regression. **ACHIEVED** — both migrated, 1,725 tests pass.
- Adding a new Domain Hub (e.g., Product Hub) requires <200 LOC of adapter + config. **ACHIEVED** — UserHubView = 138 LOC.
- Tab definitions validate against layout + component manifests at startup. *Deferred (TD-52) — hardcoded arrays work at current scale.*
- ComponentView previews all of the used Hub Components. *Deferred (TD-38).*

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

- [x] Hub shell renders workspace ribbon + tab bar + content area — *BaseHubView (278 LOC), ADR-024*
- [x] Tab bar shows tabs defined in hub's tab configuration — *getTabDefinitions() abstract method*
- [x] Active tab highlighted; inactive tabs lazy-rendered — *navigateTo() in BaseHubView*
- [x] Shell provides shared state container accessible to all tabs — *getState()/setState() deps pattern*
- [ ] Status bar shows hub context (entity counts, session status)

### Dashboard

- [x] Dashboard tab uses `dashboard_grid` layout — *renderStatGrid() from shared/StatCard.ts*
- [x] Stats grid shows domain KPIs via adapter's `getDashboardData()` — *HubDashboardProvider.getSummary()*
- [x] Quick actions row provides domain-specific shortcuts — *UserHubDashboard, HubDashboard*
- [x] Stats update via event-driven refresh (no polling) — *scheduleRender() on event listeners*

### Entity Management

- [x] Table layout shows entities with search, filter, sort — *master/detail pattern across all tabs*
- [x] Split dock layout shows master list + detail/editor panel — *buildSplitLayout() helper*
- [x] Entity CRUD routes through `doc.create` / `doc.delete` events (DocService) — *all 6 entity tabs*
- [x] Cross-references show related entities from other tabs — *findRelatedFlows/Systems/Actors/Products helpers*

### Documentation Sessions

- [ ] Session Focus layout renders: header + timer + workspace + notes + artifacts
- [ ] Pomodoro timer with configurable duration (25/50 min)
- [ ] Session types: Event Storming, Service Design, Requirements Refinement, Backlog Structuring, Knowledge Cleanup
- [ ] Session lifecycle: Prepared → Scheduled → Active → Paused → Completed → Archived
- [ ] Artifacts persist as markdown files in session folder
- [ ] Session history visible per hub

### User Hub

- [x] Personal dashboard with today's summary, recent activity, documentation nudges — *UserHubDashboard: welcome + cross-hub cards + quick actions*
- [x] Inbox tab with actionable items from all domain hubs — *InboxService domain (increment 2): 4 source events, persistent state, mark read/dismiss/clear all*
- [x] Cross-hub summary aggregating stats from all registered hubs — *HubRegistry.getAll() → provider.getSummary() with tabId deep-linking*

### System Hub Migration

- [x] Event Catalog operates as System Hub with identical functionality — *extends BaseHubView, zero regression*
- [x] Data Exchange Hub operates as System Hub with identical functionality — *extends BaseHubView, gains tab bar*
- [x] Zero feature regression after migration — *1,725 tests pass across 77 suites*

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

### Produced (implemented)

- `hub.opened` — payload: `{ hubId, hubType }` — *BaseHubView emits on onOpen()*
- `hub.closed` — payload: `{ hubId }` — *BaseHubView emits on close()*
- `hub.tab.changed` — payload: `{ hubId, tabId, previousTabId }` — *BaseHubView emits on navigateTo()*
- `hub.navigate` — payload: `{ hubId, tabId?, entityId? }` — *HubRegistry.openHub() emits for cross-hub deep linking*
- `ui.openUserHub` — payload: `Record<string, never>` — *ribbon icon + command palette*

### Produced (planned — PBI-002 Documentation Sessions)

- `session.created` — payload: `{ sessionId, hubId, type }`
- `session.started` — payload: `{ sessionId, startedAt }`
- `session.paused` — payload: `{ sessionId }`
- `session.completed` — payload: `{ sessionId, completedAt, artifacts[] }`
- `session.timer.tick` — payload: `{ sessionId, remainingMs }`
- `session.artifact.created` — payload: `{ sessionId, artifactPath }`

### Consumed

- All existing domain events (for dashboard refresh and cross-references)
- `hub.navigate` — *BaseHubView listens for cross-hub tab switching*
- `settings.updated` — hub configuration changes
- `doc.created` / `doc.deleted` — entity CRUD notifications
- `inbox.itemAdded` / `inbox.itemsChanged` — *UserHubView re-renders on inbox changes*
- `settings.changed` — *main.ts updates InboxService enabled sources*

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
| User Hub | Dashboard, Inbox |
| Product Hub | Dashboard, Features, Backlog, Sessions |
| Project Hub | Dashboard, Work Items, Sessions |

---

## 9. Adapter Impact

### Implemented Architecture

The PRD originally envisioned a `HubAdapter` base interface with method-based data contracts. The actual implementation uses a simpler, more pragmatic pattern:

```
BaseHubView<T> (abstract class — 278 LOC)
├── Abstract methods (implemented by each hub):
│   getViewType(), getHubId(), getHubType(), getHubDisplayName()
│   getHubIcon(), getTabDefinitions(): TabDef[]
│   onHubOpen(), onHubClose(), onDashboardRender(), onTabRender(tabId)
│   renderTopBarActions(bar)
├── Shared shell: top bar, tab bar, dashboard/split toggle, search
├── Lifecycle: scheduleRender(), addUnsubscribe(), dispose
└── Hub events: hub.opened, hub.closed, hub.tab.changed

HubDashboardProvider (interface — cross-hub data aggregation)
├── getHubId(): string
├── getViewType(): string
├── getDisplayName(): string
├── getIcon(): string
└── getSummary(): HubSummary  { stats: HubStat[], healthLevel, actionItemCount }

HubRegistry (65 LOC — provider registry + navigation)
├── register(provider): void
├── getAll(): HubDashboardProvider[]
└── openHub(hubId, tabId?, entityId?): emits hub.navigate
```

### Implementations

| Hub | View Class | Provider | LOC | Tabs |
|-----|-----------|----------|-----|------|
| Event Catalog | EventCatalogView | EventCatalogProvider | 723 | Dashboard, Domains, Services, Events, Flows, Systems, Actors, Products, Health |
| Data Exchange | DataExchangeHubView | DataExchangeProvider | 477 | Dashboard, Imports, Exports, Reports, Properties, Pipelines, Types |
| User Hub | UserHubView | UserHubProvider | 148 | Dashboard, Inbox |

### Decision: No HubAdapter Interface (ADR-024)

The abstract `HubAdapter` interface was deferred (Three Amigos decision #2). Each hub subclass directly owns its domain logic — this is simpler and avoids premature abstraction for 3 hubs. The `HubDashboardProvider` interface handles the cross-hub aggregation need that originally motivated the adapter hierarchy. If a 4th+ hub introduces enough commonality, the adapter pattern can be extracted then.

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

- [x] Hub shell renders workspace ribbon, tab bar, and content area — *BaseHubView*
- [x] Tab bar navigates between tabs; active tab renders correct layout — *navigateTo() + onTabRender()*
- [x] Event Catalog works as System Hub with zero feature regression — *723 LOC, 8+1 tabs*
- [x] Data Exchange Hub works as System Hub with zero feature regression — *477 LOC, 6+1 tabs*
- [x] User Hub shows personal dashboard with cross-hub summary — *UserHubDashboard with tabId deep-linking*
- [ ] Documentation Session can be created, started (with timer), and completed with artifact persistence — *PBI-002*
- [ ] Tab definitions validate against layout and component manifests — *deferred (TD-52)*
- [x] Adding a new Domain Hub requires only adapter + tab definitions (<200 LOC) — *UserHubView = 138 LOC*
- [x] All existing 1,662+ tests pass after migration — *1,760 tests across 78 suites*
- [x] `npm run build` passes (vitest + typedoc + tsc + eslint + esbuild) — *green*

---

## 13. Definition of Done

- [ ] Layout manifest created (`src/ui/layouts/layout-manifest.json`) — *deferred (TD-49)*
- [ ] Component manifest created (`src/ui/components/component-manifest.json`) — *deferred (TD-51)*
- [ ] HubAdapter interface defined with unit tests — *deferred; HubDashboardProvider serves cross-hub needs*
- [x] Shell layout implemented and renders all hub types — *BaseHubView (278 LOC)*
- [x] At least 2 System Hubs migrated (Event Catalog, Data Exchange) — *both migrated, zero regression*
- [x] User Hub implemented with dashboard + inbox — *PBI-001 increment 1 (648 LOC) + increment 2 (398 LOC InboxService domain)*
- [ ] Documentation Sessions domain implemented with timer + artifacts — *PBI-002*
- [ ] Tab definition validation passes for all hub configs — *deferred (TD-52)*
- [x] Unit tests added for all new domain and infrastructure code — *92 tests: HubRegistry, providers, 3 UI components, inbox mappers, InboxService*
- [ ] Flow integration tests added for hub lifecycle
- [x] `npm run build` passes — *1,760 tests across 78 suites, green pipeline*
- [x] Architecture documentation updated — *ADR-024, sitemap, 3 component docs, Three Amigos reviews*

---

## Technical Debt Prerequisites

The following refactoring items were identified during PRD drafting. The actual implementation took a pragmatic approach — the Pre-Feature Development Review (2026-02-15) reclassified several TDs as superseded by the simpler BaseHubView pattern.

| TD | Title | Priority | Status |
|----|-------|----------|--------|
| [[TD-49 Layout abstraction layer]] | Extract declarative layout system | Critical | **Superseded** — BaseHubView + buildSplitLayout() covers actual needs |
| [[TD-50 Workspace shell layout]] | Shared shell with ribbon + tab bar | Critical | **Resolved** — BaseHubView (278 LOC) |
| [[TD-51 Component registry]] | Manifest-driven component discovery | High | **Deferred** — not needed at 3-hub scale |
| [[TD-52 Declarative tab definitions]] | JSON tab configs with validation | High | **Deferred** — getTabDefinitions() arrays work fine |
| [[TD-53 Shared UI primitive library]] | Extract inline styles to reusable primitives | Medium | **Deferred** — ft-* CSS classes cover current needs |
| [[TD-54 Event Catalog hub migration]] | Migrate Event Catalog to Hub pattern | High | **Resolved** — extends BaseHubView, 723 LOC |
| [[TD-55 Data Exchange hub migration]] | Migrate Data Exchange Hub to Hub pattern | High | **Resolved** — extends BaseHubView, 477 LOC, gained tab bar |

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

### Phase 1: Foundation (TD-50) — DONE

> Completed 2026-02-15. Three Amigos Review: 29/35 (Strong).

Extracted `BaseHubView` abstract class (278 LOC) from two existing System Hubs. ~220 LOC of duplicated shell logic unified. 3 hub lifecycle events registered in catalog (`hub.opened`, `hub.closed`, `hub.tab.changed`). TD-49, TD-51, TD-52, TD-53 deferred as unnecessary for the inheritance-based approach.

### Phase 2: System Hub Migration (TD-54, TD-55) — DONE

> Completed 2026-02-15. Three Amigos Review: 30/35 (Strong) after component extraction.

Both System Hubs migrated to BaseHubView. EventCatalogView: 864 → 723 LOC (-16%). DataExchangeHubView: 556 → 477 LOC (-14%, gained tab bar). Component extraction: ReportsTab (635→248 LOC), DomainsTab (565→387 LOC). 1,662 tests pass, zero regression.

### Phase 2.5: Cross-Hub Infrastructure — DONE

> Completed 2026-02-15. Three Amigos Review: 32/35 (Excellent).

Resolved 2 blockers from Pre-Feature Development Review: (1) HubRegistry + HubDashboardProvider for cross-hub data aggregation, (2) `hub.navigate` event + BaseHubView listener for cross-hub deep linking. Both System Hubs registered as providers. PBI-001 unblocked.

### Phase 3: User Hub (PBI-001) — INCREMENT 3 DONE

> Increment 1 completed 2026-02-15. Three Amigos Review: 33/35 (Excellent).
> Increment 2 completed 2026-02-15. Three Amigos Review: 34/35 (Excellent).

**Increment 1**: Delivered working User Hub with Dashboard (cross-hub summaries with tabId deep-linking) and Inbox (placeholder). Activity tab was later removed in increment 3 in favour of the standalone EventLogView sidebar.

**Increment 2**: Populated Inbox with real actionable items from domain events. New `InboxService` domain with TypedStorage persistence, 4 pure mapper functions, 4 source event listeners (subscription.matched, import completed/failed, export completed). Mark read, dismiss, clear all actions wired in UI. UserHubProvider shows unread count. 4 new domain files (398 LOC), 9 modified source files (+115 LOC), 2 new test files (29 tests). 1,786 tests pass across 79 suites.

**Increment 3**: Removed Activity tab (redundant with standalone EventLogView sidebar). Restyled dashboard inbox as always-visible mail-inbox section (after quick actions, accent borders for unread, source badges, max 5 with "View all" link). Added inbox source configuration (`inboxEnabledSources` setting with 4 per-source toggles in Settings → Inbox). `InboxService.setEnabledSources()` gates item creation. Dashboard inbox items deep-link to Inbox tab with pre-selected item. Inbox detail "Triggered by" links deep-link to Event Catalog via `HubRegistry.openHub()` + `onNavigateToEntity()` override. Active inbox row highlighted. Obsidian title bar hidden on all hubs (BaseHubView). 1,764 tests pass across 78 suites.

**Remaining for PBI-001:**
- Increment 4: User preferences panel, pipeline inbox items

### Phase 4: Sessions + Domain Hubs (PBI-002, PBI-003, PBI-004) — PLANNED

Add Documentation Sessions domain and first Domain Hubs (Product, Project). Not yet started.

---

## Stage History

| Date | Transition | Gate | FRI | Reviewer | Notes |
|---|---|---|---|---|---|
| — | → idea | — | — | — | Hub concept established as architectural vision |
| — | idea → open | Problem Gate | 23 | — | PRD drafted with full scope, requirements, data model, events, adapter hierarchy, 4 PBIs, 7 TD prerequisites, 4-phase implementation plan |
| 2026-02-15 | open → draft | — | 23 | — | Stage normalized from legacy `open` value to `draft` per Feature Lifecycle standardization |
| 2026-02-15 | draft → approved | Design Gate + Readiness Gate | 24 | Technical Architect | FRI re-scored (23 → 24, Event Integration 3→4). Technical Review: Pass. All Design Gate and Readiness Gate criteria met. PRD is development-ready. |
| 2026-02-15 | approved → in-progress | Implementation Start | 29 | Technical Architect | Phase 1+2 completed (BaseHubView + System Hub migrations). TASM 29/35 (Strong). 1,662 tests pass. |
| 2026-02-15 | in-progress | Phase 2.5 (blockers) | 29 | Technical Architect | HubRegistry + cross-hub navigation. TASM 32/35 (Excellent). PBI-001 unblocked. |
| 2026-02-15 | in-progress | Phase 3 increment 1 | 31 | Technical Architect | PBI-001 User Hub first increment. 63 tests added. tabId deep-linking. TASM 33/35 (Excellent). 1,725 tests pass across 77 suites. |
| 2026-02-15 | in-progress | Phase 3 increment 2 | 31 | Technical Architect | PBI-001 Inbox Population. InboxService domain (398 LOC). 4 source events, persistent state, CRUD actions. 29 tests added. TASM 34/35 (Excellent). 1,786 tests pass across 79 suites. |
| 2026-02-16 | in-progress | Phase 3 increment 3 | 31 | Technical Architect | Activity tab removed (redundant with EventLogView). Dashboard inbox restyled as always-visible mail-inbox. Inbox source config (4 toggles). Deep-linking: inbox→catalog via onNavigateToEntity. Title bar hidden on all hubs. 1,764 tests across 78 suites. |

---

## Related

- Architecture: [[Hubs]] (layout library, manifests, region contracts, JSON schemas)
- Template: [[PRD Template]] (defines FRI scoring dimensions)
- Technical Review: [[Technical Review 2026-02-15]]
- ADR: [[ADR-024 BaseHubView Shell Extraction]]
- TD Prerequisites: [[TD-49 Layout abstraction layer]], [[TD-50 Workspace shell layout]], [[TD-51 Component registry]], [[TD-52 Declarative tab definitions]], [[TD-53 Shared UI primitive library]], [[TD-54 Event Catalog hub migration]], [[TD-55 Data Exchange hub migration]]
- Three Amigos Reviews:
  - [[Three Amigos Review 2026-02-15]] (Phase 1-2: BaseHubView + System Hub migrations)
  - [[Three Amigos Review - Component Extraction 2026-02-15]] (ReportsTab + DomainsTab decomposition)
  - [[Pre-Feature Development Review 2026-02-15]] (Gap analysis before Phase 3)
  - [[Three Amigos Review - HubRegistry + Navigation 2026-02-15]] (Phase 2.5: cross-hub infrastructure)
  - [[Three Amigos Review - User Hub First Increment 2026-02-15]] (Phase 3: PBI-001 increment 1)
  - [[Three Amigos Review - User Hub Inbox Population 2026-02-15]] (Phase 3: PBI-001 increment 2)
- Sitemap: [[User Hub View]], [[Event Catalog View]], [[Data Exchange Hub View]]
- Components: [[UserHubView]], [[UserHubDashboard]], [[UserHubInbox]]
