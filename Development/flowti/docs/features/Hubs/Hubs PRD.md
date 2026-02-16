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
maturity_score_data_model: 5
maturity_score_ui_consistency: 4
maturity_score_validation_testing: 4
business_value: 5
implementation_cost: 5
maintenance_cost: 3
discovery_cost: 4
design_cost: 4
test_cost: 4
priority: 5
fri_score: 33
---

# Feature: Hubs - Domain-Centric Workspaces

> Architecture reference: [[Layout Library and Composition]] (layout library, manifests, region contracts, JSON schemas)
> Document types: [[ProductRequirementsDocument]], [[ProductBacklogItem]], [[Increment]], [[ReviewSession]], [[TechnicalReview]], [[UserStory]]

---

## 1. Vision & Strategic Context

> A Hub is the main entry point into a domain (or into the user's work).
> It is a dedicated workspace that structures data, generates event entries, encourages documentation, connects entities, starts projects, and feeds the knowledge graph.

**Strategic position**: Flowti is a system where the Event Catalog is the Source of Truth, domains generate and consume events, documentation and system state evolve together, Git tracks structural evolution, and the Knowledge Graph reflects operational structure. Instead of navigating files, users navigate **Domains → Hubs → Events & Entities**.

### Core Principles

1. Event Catalog remains the authoritative backbone
2. Every Hub contributes to the Event Catalog
3. Hubs generate Entity Docs (Markdown)
4. Hubs encourage documentation discipline
5. Documentation Sessions are structured and time-boxed
6. Hubs are domain-bounded (except User Hub)
7. System Hubs and User Hubs are distinct
8. All relationships feed the knowledge graph

### Conceptual Architecture

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
│   └── User-Generated Hubs (v2+)
│
└── 01 - Projects (Project Instances)
```

### Hub Types

| Type | Description | Examples |
|------|-------------|---------|
| **System Hub** | Managed by Flowti Core. Immutable structure, extensible content. | Event Catalog, Data Exchange |
| **Domain Hub** | Domain-bounded workspace for a specific business area. | Product Hub, Project Hub, Services Hub, Areas Hub |
| **User Hub** | Personal cockpit: dashboard, inbox, sessions, preferences. | User Hub (singleton) |
| **User-Generated Hub** (v2+) | Any domain entity can become a Hub workspace. | Custom domain hubs |

### Open Technical Questions (Resolved)

1. Are hubs stored as entities in Event Catalog? → **No** (Hubs are visual representations of domains)
2. How to enforce bounded contexts? → **HubAdapter pattern + domain-scoped events**
3. Should user hubs be versioned? → **No**
4. How are session artifacts persisted? → **Markdown files tracked via file.created/file.modified listeners**
5. Can hubs subscribe to EventBus namespaces? → **Yes, via wildcard listeners with category filtering**
6. How does a hub register itself? → **HubRegistry.register(provider) at plugin load**
7. Is there a HubRegistry service? → **Yes** (65 LOC, register + getAll + openHub)

---

## 2. Problem Statement

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

## 3. Outcome (Success Definition)

- **User can** open domain-centric Hubs from the ribbon or command palette, each with a consistent dashboard, entity tables, and session capabilities.
- **System can** render any Hub using a shared shell + declarative layout + adapter pattern, eliminating per-view DOM construction.
- **Domain gains** a reusable framework where adding a new Hub requires only an adapter and tab definitions — no new layout code.

Measurable success:
- Event Catalog and Data Exchange Hub operate as System Hubs with zero feature regression. **ACHIEVED** — both migrated, 1,988 tests pass.
- Adding a new Domain Hub (e.g., Product Hub) requires <200 LOC of adapter + config. **ACHIEVED** — UserHubView = 138 LOC.
- Tab definitions validate against layout + component manifests at startup. *Deferred (TD-52) — hardcoded arrays work at current scale.*
- ComponentView previews all of the used Hub Components. *Deferred (TD-38).*

---

## 4. Scope

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

## 5. UX Entry Points

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

## 6. Functional Requirements

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

- [x] Session Focus workspace: dedicated `SessionWorkspaceView` leaf with header + timer + goals + notes + focus file + artifacts — *Increment 7: 463 LOC view, 36 tests*
- [x] Pomodoro timer with configurable duration (25/50/15/45/60 min) — *SessionService with 1s setInterval, computeRemainingMs()*
- [x] Session types: Event Storming, Service Design, Requirements Refinement, Backlog Structuring, Knowledge Cleanup — *SessionType union, SESSION_TYPE_LABELS map*
- [x] Session lifecycle: Prepared → Active → Paused → Completed → Archived — *SessionService state machine (19 events)*
- [x] Artifacts tracked per session — *file.created/file.modified listeners → session.artifact.added events*
- [x] Session history visible in User Hub — *UserHubSessions component: master list + detail panel with timer, info, artifacts, contextual actions*
- [x] Session templates: save, create from template, prefill in NewSessionModal — *SessionService template CRUD (MAX_TEMPLATES=50)*
- [x] Session rerun: re-create completed/archived sessions with auto-generated title — *SessionService.rerunSession()*
- [x] Focus file: optional vault file picker in NewSessionModal, clickable link in detail panel — *VaultFilePickerModal + deps.openFile()*
- [x] Session timeline: chronological lifecycle action log with timestamps — *SessionTimelineEntry[] on Session, timeline.push() in each lifecycle handler*
- [x] Time breakdown: wall clock, active time, total pause, pause count — *computeTimelineSummary() + formatDurationHuman(), stat pill UI*
- [x] Clickable templates: template rows in detail panel create new sessions on click — *createFromTemplate() integration*
- [x] Session goals: `SessionGoal[]` with add/toggle/remove via events — *Increment 6: 4 handlers, 8 events, 29 tests. 2,017 tests across 82 suites.*
- [x] Session notes mutation via events: `session.notes.update/updated` — *Increment 6: handleNotesUpdate + persistence*
- [x] Session links: attach files via right-click "Add to Session", clickable links in workspace + sessions tab — *Increment 8: SessionLink type, 4 link events, context menu integration*
- [x] Session notes persistence: auto-set `notesFile` at `03 - Resources/Sessions/`, Markdown summary on completion — *Increment 8: generateSessionSummary + writeSessionSummary*
- [x] Session canvas: create `.canvas` from workspace, auto-embed `![[canvas]]` in notes — *Increment 8: canvasFile field, 2 events, canvas creation*
- [x] Duration editing for prepared sessions in workspace — *Increment 8: session.duration.update/updated events*
- [x] Save as Template for all session statuses — *Increment 8: removed status restriction*
- [x] "Open Workspace" button in sessions tab + dashboard — *Increment 8: workspaceSessionId + getCurrentSession()*
- [ ] Pre-session goal preparation in NewSessionModal — *planned Increment 9*
- [ ] Auto-open workspace + focus file on session start — *planned Increment 9*

### Session Focus Tools

Sessions are the primary mechanism for focused, time-boxed content creation and improvement inside the Vault. The focus file is the session's anchor — its type drives the available tooling, and its content drives the user's attention. Every session is oriented around two guiding questions: **"How should the next increment look like?"** and **"What can be improved?"**

- [ ] **Focus File Type Detection** — On session start, detect the focus file's extension and (for `.md`) its frontmatter `type` to determine the applicable tool profile
- [ ] **Focus File Profiles** — Provide contextual tools based on file type:
  - **Markdown (`.md`)** — Open in editor, show backlinks, outgoing links, tags. If frontmatter `type` matches a known DocType (EventDoc, ServiceDoc, etc.), show domain-specific actions (e.g., "Open in Event Catalog", "Show related Flows")
  - **Canvas (`.canvas`)** — Open canvas view, show node count, connection summary. Ideal for design sessions
  - **PDF (`.pdf`)** — Open PDF viewer, show page count, allow annotation notes
  - **Image (`.png`, `.jpg`, `.svg`, `.gif`, `.webp`)** — Show image preview, dimensions, file size. Allow creating annotation notes
  - **CSV (`.csv`)** — Open in Flowti table view, show row/column count, link to Data Exchange actions
  - **Unknown extensions** — Show basic file metadata (name, size, last modified, extension). Provide "Document as MD" action that creates a markdown file with metadata and a `[[link]]` to the original file
- [ ] **Context Files** — Attach additional files to a session beyond the focus file. Context files form the working set — the material the user needs alongside the focus file to get work done
  - Attach via vault file picker (reuse VaultFilePickerModal)
  - Displayed as a collapsible list in the session detail panel
  - Each context file shows a type icon, filename, and "remove" action
  - Persisted on the Session entity as `contextFiles: string[]`
- [ ] **Session Spawning** — From any session (active, completed, or archived), spawn a new session that inherits context:
  - "New Session from Focus" action: creates a new session with the same focus file
  - "Design Session" action: opens a file multi-picker to select which context files to carry over, then creates a new session with the focus file and selected context files
  - Enables iterative work: complete a session, review the output, spawn a follow-up session that picks up where you left off
- [ ] **Guiding Questions** — Always visible in the session detail panel during active/paused sessions:
  - "How should the next increment look like?"
  - "What can be improved?"
  - These orient the user's attention toward incremental improvement of the focus file's content
- [x] **Session Document** — On session completion, generate a session summary document (`.md`) that captures session metadata, focus file and canvas wikilinks, goals checklist, links, artifacts, timeline, time summary, and notes. Auto-saved to `03 - Resources/Sessions/` via `generateSessionSummary()` + `writeSessionSummary()`. — *Increment 8*

### User Hub

- [x] Personal dashboard with today's summary, recent activity, documentation nudges — *UserHubDashboard: welcome + cross-hub cards + quick actions*
- [x] Inbox tab with actionable items from all domain hubs — *InboxService domain (increment 2→4): 6 source events (inc. pipeline completed/failed), persistent state, mark read/dismiss/clear all*
- [x] Cross-hub summary aggregating stats from all registered hubs — *HubRegistry.getAll() → provider.getSummary() with tabId deep-linking*

### System Hub Migration

- [x] Event Catalog operates as System Hub with identical functionality — *extends BaseHubView, zero regression*
- [x] Data Exchange Hub operates as System Hub with identical functionality — *extends BaseHubView, gains tab bar*
- [x] Zero feature regression after migration — *2,125 tests pass across 83 suites*

---

## 7. Data Model Impact

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
  status: "prepared" | "active" | "paused" | "completed" | "archived"
  started_at?: string
  paused_at?: string
  completed_at?: string
  duration_minutes: number
  elapsed_before_pause_ms: number
  artifacts: SessionArtifact[]  (path + action: "created" | "modified")
  focus_file?: string  (vault file path — optional focus file for the session)
  timeline: SessionTimelineEntry[]  (chronological lifecycle action log)
  notes_path?: string
  focus_file: string | null  (vault file path — session anchor)
  context_files: string[]  (additional working set files)
  timeline: TimelineEntry[]  (lifecycle action log)

FocusFileProfile
  extension: string  (detected from focus_file path)
  category: "markdown" | "canvas" | "pdf" | "image" | "csv" | "unknown"
  doc_type: DocType | null  (from .md frontmatter, if applicable)
  tools: FocusFileTool[]  (contextual actions available for this file type)

FocusFileTool
  id: string  (e.g. "open-editor", "show-backlinks", "document-as-md")
  label: string
  icon: string
  action: string  (event or callback identifier)

SessionDocument  (generated on completion)
  path: string  (e.g. "Sessions/2026-02-16 Event Storming - My Topic.md")
  session_id: string
  focus_file: string | null
  context_files: string[]
  artifacts: string[]
  timeline_summary: string

SessionTemplate
  id: string
  name: string
  type: SessionType
  durationMinutes: number
  focusFile?: string
  createdAt: string

SessionTimelineEntry
  action: "started" | "paused" | "resumed" | "completed"
  timestamp: string  (ISO 8601)

SessionGoal  (Increment 6)
  id: string
  text: string
  completed: boolean
  completedAt: string | null

TabDefinition
  id: string
  label: string
  icon: string
  layout_ref: string  (references layout manifest)
  bindings: { data_sources, actions, event_bus }
  regions: Record<string, RegionOverride>
```

New fields on existing entities: none (Hubs wrap existing entities, not extend them).

State containers (TypedStorage):
- `sessions` — `{ sessions: Session[], savedTemplates: SessionTemplate[] }`
- `inbox` — `{ items: InboxItem[] }`

---

## 8. Event Impact

### Produced (implemented)

- `hub.opened` — payload: `{ hubId, hubType }` — *BaseHubView emits on onOpen()*
- `hub.closed` — payload: `{ hubId }` — *BaseHubView emits on close()*
- `hub.tab.changed` — payload: `{ hubId, tabId, previousTabId }` — *BaseHubView emits on navigateTo()*
- `hub.navigate` — payload: `{ hubId, tabId?, entityId? }` — *HubRegistry.openHub() emits for cross-hub deep linking*
- `ui.openUserHub` — payload: `Record<string, never>` — *ribbon icon + command palette*

### Produced (implemented — PBI-002 Documentation Sessions)

- `session.created` — payload: `{ session }` — *SessionService.createSession()*
- `session.started` — payload: `{ sessionId }` — *SessionService on session.start command*
- `session.paused` — payload: `{ sessionId }` — *SessionService on session.pause command*
- `session.resumed` — payload: `{ sessionId }` — *SessionService on session.resume command*
- `session.completed` — payload: `{ sessionId }` — *SessionService on session.complete or timer expiry*
- `session.archived` — payload: `{ sessionId }` — *SessionService on session.archive command*
- `session.deleted` — payload: `{ sessionId }` — *SessionService on session.delete command*
- `session.timer.tick` — payload: `{ sessionId, remainingMs }` — *1s setInterval during active sessions*
- `session.timer.completed` — payload: `{ sessionId }` — *emitted when timer reaches 0*
- `session.artifact.added` — payload: `{ sessionId, artifact }` — *file.created/file.modified listener*
- `session.loaded` — payload: `{ sessions, savedTemplates }` — *SessionService.load() on startup*
- `session.template.saved` — payload: `{ template }` — *SessionService.saveTemplate()*
- `session.template.deleted` — payload: `{ templateId }` — *SessionService.deleteTemplate()*
- Plus 8 command events: `session.create`, `session.start`, `session.pause`, `session.resume`, `session.complete`, `session.archive`, `session.delete`, `session.refresh`

### Produced (implemented — PBI-002 Increment 6: Goals & Notes)

- `session.goal.add` — payload: `{ sessionId, text }` — *command: add goal to session (SessionService.handleGoalAdd)*
- `session.goal.toggle` — payload: `{ sessionId, goalId }` — *command: check/uncheck goal (SessionService.handleGoalToggle)*
- `session.goal.remove` — payload: `{ sessionId, goalId }` — *command: remove goal (SessionService.handleGoalRemove)*
- `session.goal.added` — payload: `{ sessionId, goal }` — *state: goal was added*
- `session.goal.toggled` — payload: `{ sessionId, goalId, completed }` — *state: goal toggled*
- `session.goal.removed` — payload: `{ sessionId, goalId }` — *state: goal was removed*
- `session.notes.update` — payload: `{ sessionId, notes }` — *command: update notes (SessionService.handleNotesUpdate)*
- `session.notes.updated` — payload: `{ sessionId, notes }` — *state: notes were updated*

### Produced (implemented — PBI-002 Increment 8: Session Workspace Enrichment)

- `session.link.add` — payload: `{ sessionId, path }` — *command: add link to session*
- `session.link.added` — payload: `{ sessionId, link: SessionLink }` — *state: link was added*
- `session.link.remove` — payload: `{ sessionId, path }` — *command: remove link from session*
- `session.link.removed` — payload: `{ sessionId, path }` — *state: link was removed*
- `session.duration.update` — payload: `{ sessionId, durationMinutes }` — *command: update prepared session duration*
- `session.duration.updated` — payload: `{ sessionId, durationMinutes }` — *state: duration was updated*
- `session.notesFile.set` — payload: `{ sessionId, path }` — *command: set session notes file path*
- `session.notesFile.updated` — payload: `{ sessionId, path }` — *state: notes file path set*
- `session.canvasFile.set` — payload: `{ sessionId, path }` — *command: set session canvas file path*
- `session.canvasFile.updated` — payload: `{ sessionId, path }` — *state: canvas file path set*

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

## 9. UI Layout Impact

Layouts used:

| Layout | Hub Usage |
|--------|-----------|
| `dashboard_grid` | All hub dashboards (User, System, Domain) |
| `table` | Entity list tabs (events, imports, exports, entities) |
| `split_dock` | Entity detail tabs (master list + detail panel) |
| `session_focus` | Documentation sessions (header + timer + focus file tools + context files + guiding questions + workspace + notes) |

New layouts required: `session_focus` (new).

Tabs affected:

| Hub | Tabs |
|-----|------|
| Event Catalog | Dashboard, Domains, Services, Events, Flows, Systems, Actors, Products |
| Data Exchange | Dashboard, Reports, Types, Properties, Imports, Exports, Pipelines |
| User Hub | Dashboard, Inbox, Sessions, Preferences |
| Product Hub | Dashboard, Features, Backlog, Sessions |
| Project Hub | Dashboard, Work Items, Sessions |

---

## 10. Adapter Impact

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
| User Hub | UserHubView | UserHubProvider | ~273 | Dashboard, Inbox, Sessions, Preferences |

### Decision: No HubAdapter Interface (ADR-024)

The abstract `HubAdapter` interface was deferred (Three Amigos decision #2). Each hub subclass directly owns its domain logic — this is simpler and avoids premature abstraction for 3 hubs. The `HubDashboardProvider` interface handles the cross-hub aggregation need that originally motivated the adapter hierarchy. If a 4th+ hub introduces enough commonality, the adapter pattern can be extracted then.

---

## 11. Non-Functional Requirements

- **Performance**: VirtualizedTable for lists >100 rows; lazy tab rendering (only active tab mounts)
- **Event-driven refresh**: No polling — all dashboard updates via EventBus listeners
- **Validation**: Tab definitions validated against layout + component manifests at startup
- **Memory**: Dispose all listeners on hub close; no leaked subscriptions
- **Extensibility**: New hub = new adapter + tab definitions; no layout code changes

---

## 12. Risks

| Risk | Mitigation |
|------|------------|
| Massive refactoring scope | Incremental migration: shell first → system hubs → domain hubs. Each phase is independently shippable. |
| Breaking existing Event Catalog / Data Exchange views | System hub migration preserves 100% of current functionality. Feature-flag rollback if needed. |
| Performance regression from layout abstraction | Layout system adds one DOM wrapper per region — negligible. Benchmark before/after. |
| Adapter interface too rigid for diverse domains | Keep base interface minimal (5 methods). Domain-specific methods live on adapter subclasses. |
| Layout library complexity | v1 ships 4 layouts (dashboard, table, split_dock, session_focus). Board + graph deferred to v2. |

---

## 13. Acceptance Criteria

- [x] Hub shell renders workspace ribbon, tab bar, and content area — *BaseHubView*
- [x] Tab bar navigates between tabs; active tab renders correct layout — *navigateTo() + onTabRender()*
- [x] Event Catalog works as System Hub with zero feature regression — *723 LOC, 8+1 tabs*
- [x] Data Exchange Hub works as System Hub with zero feature regression — *477 LOC, 6+1 tabs*
- [x] User Hub shows personal dashboard with cross-hub summary — *UserHubDashboard with tabId deep-linking*
- [x] Documentation Session can be created, started (with timer), and completed with artifact tracking — *PBI-002 increments 1+2: SessionService domain + UserHubSessions tab*
- [x] Session templates, rerun, focus file, and timeline tracking — *PBI-002 increments 3-5: full session UX*
- [ ] Tab definitions validate against layout and component manifests — *deferred (TD-52)*
- [x] Adding a new Domain Hub requires only adapter + tab definitions (<200 LOC) — *UserHubView = 138 LOC*
- [x] All existing 1,662+ tests pass after migration — *2,125 tests across 83 suites*
- [x] `npm run build` passes (vitest + typedoc + tsc + eslint + esbuild) — *2,125 tests, green*

---

## 14. Definition of Done

- [ ] Layout manifest created (`src/ui/layouts/layout-manifest.json`) — *deferred (TD-49)*
- [ ] Component manifest created (`src/ui/components/component-manifest.json`) — *deferred (TD-51)*
- [ ] HubAdapter interface defined with unit tests — *deferred; HubDashboardProvider serves cross-hub needs*
- [x] Shell layout implemented and renders all hub types — *BaseHubView (278 LOC)*
- [x] At least 2 System Hubs migrated (Event Catalog, Data Exchange) — *both migrated, zero regression*
- [x] User Hub implemented with dashboard + inbox — *PBI-001 increment 1 (648 LOC) + increment 2 (398 LOC InboxService domain)*
- [x] Documentation Sessions domain implemented with timer, artifacts, templates, rerun, focus file, timeline, goals, notes, workspace, links, notes persistence, canvas, duration editing, preparation flow, notes merge — *PBI-002 increments 1-9: SessionService (37 events, TypedStorage) + UserHubSessions tab + SessionWorkspaceView (754 LOC)*
- [ ] Tab definition validation passes for all hub configs — *deferred (TD-52)*
- [x] Unit tests added for all new domain and infrastructure code — *~488 tests: HubRegistry, providers, 4 UI components, inbox mappers, InboxService (29 tests), SessionService (145 tests), UserHubSessions (77 tests), helpers (57 tests), SessionWorkspaceView (36+ tests), Dashboard (20+ tests)*
- [ ] Flow integration tests added for hub lifecycle
- [x] `npm run build` passes — *2,125 tests across 83 suites, green pipeline*
- [x] Architecture documentation updated — *ADR-024, sitemap, 5 component docs, 9 Three Amigos reviews*

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
| [[TD-57 Migration test strategy]] | Smoke tests for Hub tab rendering + CRUD | Medium | **Open** — can be addressed alongside PBI-003 |
| [[TD-60 Health widget Hub integration]] | Health score widget on Hub dashboards | Low | **Open** — deferred until Hub widget pattern established |

---

## Product Backlog Items

New feature work items, each tracked as a separate PBI in `docs/features/Hubs/backlog/`:

| PBI | Title | Status | Dependencies |
|-----|-------|--------|-------------|
| [[PBI-001 User Hub]] | Personal cockpit with dashboard, inbox, preferences | **COMPLETE** (4 increments) | TD-50 ✅ |
| [[PBI-002 Documentation Sessions]] | Time-boxed workflows with Pomodoro timer | **In progress** (9 done, 2 planned) | Inc 10: Focus Profiles; Inc 11: Spawning |
| [[PBI-003 Product Hub]] | Product domain workspace | **PLANNED** | BaseHubView ✅ |
| [[PBI-004 Project Hub]] | Project domain workspace | **PLANNED** | BaseHubView ✅ |

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

### Phase 3: User Hub (PBI-001) — DONE

> Increment 1 completed 2026-02-15. Three Amigos Review: 33/35 (Excellent).
> Increment 2 completed 2026-02-15. Three Amigos Review: 34/35 (Excellent).

**Increment 1**: Delivered working User Hub with Dashboard (cross-hub summaries with tabId deep-linking) and Inbox (placeholder). Activity tab was later removed in increment 3 in favour of the standalone EventLogView sidebar.

**Increment 2**: Populated Inbox with real actionable items from domain events. New `InboxService` domain with TypedStorage persistence, 4 pure mapper functions, 4 source event listeners (subscription.matched, import completed/failed, export completed). Mark read, dismiss, clear all actions wired in UI. UserHubProvider shows unread count. 4 new domain files (398 LOC), 9 modified source files (+115 LOC), 2 new test files (29 tests). 1,786 tests pass across 79 suites.

**Increment 3**: Removed Activity tab (redundant with standalone EventLogView sidebar). Restyled dashboard inbox as always-visible mail-inbox section (after quick actions, accent borders for unread, source badges, max 5 with "View all" link). Added inbox source configuration (`inboxEnabledSources` setting with 4 per-source toggles in Settings → Inbox). `InboxService.setEnabledSources()` gates item creation. Dashboard inbox items deep-link to Inbox tab with pre-selected item. Inbox detail "Triggered by" links deep-link to Event Catalog via `HubRegistry.openHub()` + `onNavigateToEntity()` override. Active inbox row highlighted. Obsidian title bar hidden on all hubs (BaseHubView). 1,764 tests pass across 78 suites.

**Increment 4**: Pipeline inbox items + Preferences tab. Added 2 pipeline mappers (`mapPipelineCompleted`, `mapPipelineFailed`) and InboxService listeners for `dataExchange.pipeline.completed/failed`. `INBOX_SOURCE_DEFINITIONS` shared constant (6 entries) consumed by both FlowtiSettingTab and Preferences. New `UserHubPreferences` component with user profile editing and 6 inbox source toggles. UserHubView now multi-tab (`"inbox" | "preferences"`) with search bar hidden on preferences. 1,786 tests pass across 79 suites.

**PBI-001 complete.** All functional requirements delivered across 4 increments.

### Phase 4: Sessions + Domain Hubs (PBI-002, PBI-003, PBI-004) — IN PROGRESS

**Increment 1** (PBI-002): Session Domain Core. New `SessionService` with full lifecycle state machine (prepared → active → paused → completed → archived), Pomodoro timer via 1s `setInterval`, artifact tracking via `file.created`/`file.modified` listeners, 19 events registered in catalog, TypedStorage persistence. Pure helpers (`computeRemainingMs`, `computeElapsedMs`, `formatDuration`, `isTimerExpired`, `createSession`). 60 tests added. 1,847 tests pass across 82 suites.

**Increment 2** (PBI-002): Sessions Tab in User Hub. New `UserHubSessions` component (~316 LOC) with master list (status-sorted, filter, accent border on active, "New" button) and detail panel (timer display, info, artifacts, contextual lifecycle action buttons). `UserHubView` (~273 LOC) wired with 9 session event listeners + timer tick optimization (direct DOM update via `updateTimerDisplay()`, no full re-render). Active session card on dashboard with Pause/Complete actions. `NewSessionModal` (~70 LOC) for session creation (title, type dropdown from `SESSION_TYPES`, duration dropdown). "New Session" buttons in both empty state and master header. 40 new tests. 1,887 tests pass across 82 suites.

**Increment 3** (PBI-002): Session Templates, Rerun & UX Polish. `SessionService` gained 7 methods: template CRUD (`saveTemplate`, `updateTemplate`, `deleteTemplate`, `saveTemplateFromSession`, `createFromTemplate`), session rerun (`rerunSession` + `generateRerunTitle`). New `SaveTemplateModal`. `NewSessionModal` extended with template chooser dropdown + prefill. UserHubSessions: Rerun/Save Template buttons on completed/archived, template list in detail panel, actions moved under header. Dashboard: `updateTimerDisplay()` for live timer, contextual Pause/Resume buttons, Paused badge. Backward-compat migration for `savedTemplates` in `load()`. +47 tests. 1,887 tests pass across 82 suites.

**Increment 4** (PBI-002): Focus File & Vault File Picker. `focusFile: string | null` added to Session, threaded through `handleCreate()`, `rerunSession()`, `createFromTemplate()`, `saveTemplateFromSession()`. Focus file text input + "Browse" button (folder-open icon) on `NewSessionModal`. New `VaultFilePickerModal` class using `FuzzySuggestModal`. Clickable focus file link in session detail panel via `deps.openFile()`. +9 tests. 1,887 tests pass across 82 suites.

**Increment 5** (PBI-002): Session Timeline & Pause Duration Tracking. `SessionTimelineEntry[]` on Session records every lifecycle action with ISO timestamps. 6 new pure functions in helpers: `computePauseSegments()`, `computeTotalPauseMs()`, `computeWallClockMs()`, `computeActiveTimeMs()`, `computeTimelineSummary()`, `formatDurationHuman()`. New UI sections: Time Breakdown (stat pills) + Timeline (chronological action log with icons). Backward-compat in `load()` initializes missing `timeline` to `[]`. +35 tests. 1,988 tests pass across 82 suites.

**UX Polish** (PBI-002): Clickable template rows create new sessions via `createFromTemplate()`. Delete button uses `stopPropagation()` to prevent accidental creation. Hint text "Click a template to start a new session". Timeline moved to last section in detail panel. +4 tests.

**PBI-002 core feature + goals domain + workspace delivery complete** (Increments 1-7). Increment 8 planned for Preparation Flow:

**Increment 6** (PBI-002): Goals & Notes Domain. `SessionGoal` interface (id, text, completed, completedAt). `goals: SessionGoal[]` on Session, `goals?: string[]` on SessionTemplate. 8 new events for goal CRUD + notes mutation. 4 new SessionService handlers (`handleGoalAdd`, `handleGoalToggle`, `handleGoalRemove`, `handleNotesUpdate`). Goals threaded through create, rerun, createFromTemplate, saveTemplateFromSession. `createGoal()` pure helper. Backward compat in `load()`. 8 catalog entries. +29 tests. 2,017 tests pass across 82 suites.

**Increment 7** (PBI-002): SessionWorkspaceView. New standalone `SessionWorkspaceView` extending `ItemView` directly (463 LOC): header with title + type badge + status badge + contextual action buttons (Pause/Resume/Complete per status), timer with incremental DOM update via `session.timer.tick`, goals checklist (add via Enter key, toggle via checkbox, remove via x button — all through EventBus), notes textarea with 500ms debounced save via `session.notes.update`, focus file link opening in adjacent leaf via `openLinkText("split")`, live artifacts list appended on `session.artifact.added`, empty state when no active session. 10 event subscriptions for lifecycle, timer, goals, notes, artifacts. Registered in `main.ts`, command `flowti:open-session-workspace`. +36 tests. 2,053 tests pass across 83 suites.

**Increment 8** (PBI-002): Session Workspace Enrichment. Seven capabilities: (1) Session links — `SessionLink` type, `links: SessionLink[]`, 4 link events, "Add to Session" right-click context menu, links UI in workspace + sessions tab. (2) Session notes persistence — auto-set `notesFile` at `03 - Resources/Sessions/`, `generateSessionSummary()` pure function, `writeSessionSummary()` on completion. (3) Session canvas — `canvasFile` on Session, 2 canvas events, "Create Session Canvas" button, auto-embed `![[canvas]]` in notes. (4) Duration editing for prepared sessions. (5) Save as Template for all statuses. (6) Context menu rename → "Create New Session". (7) Workspace for any session state via `workspaceSessionId` + `getCurrentSession()`. 10 new events, 5 new service handlers. `SessionWorkspaceView` grew from 463 → 737 LOC. +72 tests. 2,125 tests pass across 83 suites.

**Increment 9** (PBI-002): Preparation Flow & Auto-Open. Six capabilities: (1) Goals repeater in `NewSessionModal` — Enter-to-add, x-to-remove, template goals carry-through. (2) Title validation — inline "Title is required" error on empty Create. (3) Auto-open workspace on `session.started` via main.ts `crossCuttingListeners`. (4) Dedicated adjacent leaf management — `getLeaf("split")` tracking for all 6 workspace link handlers, focus on target after async open. (5) Session notes merge — `mergeSessionNotes()` preserves user-added frontmatter fields and markdown content before `## Session Summary` marker, replaces summary with latest data. (6) Vault-hygiene session type as first option in dropdown. Zero new events — existing contracts reused. `SessionWorkspaceView` 737 → 754 LOC, `helpers.ts` gained 6 pure functions. +18 tests. TASM 32/35 (Excellent). 2,141 tests pass across 84 suites.

### Phase 5: Domain Hubs (PBI-003, PBI-004) — PLANNED

Next increments planned (see backlog for full PBI details):

**Increment 1** (PBI-003): Product Hub Scaffold. New `ProductHubView` extending `BaseHubView`, `ProductHubProvider` for cross-hub stats. Dashboard tab with product-scoped KPIs (features count, backlog size, maturity breakdown). Ribbon icon + command `flowti:open-product-hub`. Register in `HubRegistry`. Follows UserHubView pattern (~150 LOC estimated).

**Increment 2** (PBI-003): Product Hub Entity Tabs. Features tab scanning `type: FeatureTemplate` files with maturity badges + FRI scores. Backlog tab scanning `type: ProductBacklogItemTemplate` files with status filters. Master-detail split layout reusing existing `buildSplitLayout()` pattern.

**Increment 3** (PBI-004): Project Hub Scaffold. New `ProjectHubView` extending `BaseHubView`, `ProjectHubProvider`. Dashboard with project-scoped stats (work items, documentation coverage). Same pattern as Product Hub.

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
| 2026-02-16 | in-progress | Phase 3 increment 4 | 31 | Technical Architect | Pipeline inbox items (2 mappers, 2 listeners). Preferences tab (profile editing, 6 source toggles). INBOX_SOURCE_DEFINITIONS shared constant. Multi-tab UserHubView. PBI-001 complete. 1,786 tests across 79 suites. |
| 2026-02-16 | in-progress | Phase 4 increment 1 | 31 | Technical Architect | PBI-002 Session Domain Core. SessionService (19 events, lifecycle state machine, Pomodoro timer, artifact tracking, TypedStorage). Pure helpers. 60 tests added. 1,847 tests across 82 suites. |
| 2026-02-16 | in-progress | Phase 4 increment 2 | 31 | Technical Architect | PBI-002 Sessions Tab. UserHubSessions component (~316 LOC). 9 event listeners + timer tick optimization. Active session card on dashboard. NewSessionModal (~70 LOC) for session creation (title/type/duration). "New Session" buttons in empty state + header. 40 tests added. 1,887 tests across 82 suites. |
| 2026-02-16 | in-progress | Phase 4 increment 3 | 31 | Technical Architect | PBI-002 Templates & Rerun. 7 new SessionService methods (template CRUD, rerun, createFromTemplate). SaveTemplateModal. NewSessionModal template chooser. Dashboard live timer with Pause/Resume. +47 tests. TASM 32/35. 1,887 tests across 82 suites. |
| 2026-02-16 | in-progress | Phase 4 increment 4 | 31 | Technical Architect | PBI-002 Focus File. focusFile on Session, VaultFilePickerModal, focus file link in detail panel. +9 tests. TASM 34/35 (Excellent). 1,887 tests across 82 suites. |
| 2026-02-16 | in-progress | Phase 4 increment 5 | 31 | Technical Architect | PBI-002 Timeline & Pause Tracking. SessionTimelineEntry[], 6 pure helpers, Time Breakdown + Timeline UI. +35 tests. TASM 34/35 (Excellent). 1,988 tests across 82 suites. |
| 2026-02-16 | in-progress | Phase 4 UX polish | 31 | Technical Architect | PBI-002 clickable templates, timeline reordering. +4 tests. PBI-002 core feature delivery complete. 1,988 tests across 82 suites. |
| 2026-02-16 | in-progress | Phase 4 increment 6 | 31 | Technical Architect | PBI-002 Goals & Notes Domain. SessionGoal interface, 8 new events, 4 handlers (goal add/toggle/remove, notes update), goals threaded through all creation paths, createGoal helper, backward compat. 8 catalog entries. +29 tests. 2,017 tests across 82 suites. |
| 2026-02-16 | in-progress | Phase 4 increment 7 | 31 | Technical Architect | PBI-002 SessionWorkspaceView. Standalone ItemView (463 LOC) with header, timer (incremental DOM update), goals checklist (add/toggle/remove via EventBus), notes textarea (500ms debounce), focus file (adjacent leaf), artifacts (live list). Command `flowti:open-session-workspace`. +36 tests. 2,053 tests across 83 suites. |
| 2026-02-16 | in-progress | Phase 4 increment 8 | 33 | Technical Architect | PBI-002 Session Workspace Enrichment. 7 capabilities: session links (SessionLink + 4 events + "Add to Session" context menu), notes persistence (auto-set notesFile + generateSessionSummary + writeSessionSummary), canvas (canvasFile + 2 events + auto-embed in notes), duration editing, template unlock, "Open Workspace" button, workspace for all statuses. 10 new events, 5 handlers. SessionWorkspaceView 463→737 LOC. +72 tests. TASM 34/35 (Excellent). 2,125 tests across 83 suites. |
| 2026-02-16 | in-progress | Phase 4 increment 9 | 33 | Technical Architect | PBI-002 Preparation Flow & Auto-Open. Goals repeater in NewSessionModal (Enter-to-add, template carry-through), title validation, auto-open workspace on session.started (main.ts), dedicated adjacent leaf management, session notes merge (mergeSessionNotes preserves user content + frontmatter), vault-hygiene session type. 0 new events, 6 new pure functions. +202 LOC net, +18 tests. TASM 32/35 (Excellent). 2,141 tests across 84 suites. |

---

## Related

- Architecture: [[Layout Library and Composition]] (layout library, manifests, region contracts, JSON schemas)
- Template: [[PRD Template]] (defines FRI scoring dimensions)
- Technical Review: [[Technical Review 2026-02-15]]
- ADR: [[ADR-024 BaseHubView Shell Extraction]]
- Document Types: [[ProductRequirementsDocument]], [[ProductBacklogItem]], [[Increment]], [[ReviewSession]], [[TechnicalReview]], [[UserStory]]
- TD Prerequisites: [[TD-49 Layout abstraction layer]], [[TD-50 Workspace shell layout]], [[TD-51 Component registry]], [[TD-52 Declarative tab definitions]], [[TD-53 Shared UI primitive library]], [[TD-54 Event Catalog hub migration]], [[TD-55 Data Exchange hub migration]]
- Three Amigos Reviews:
  - [[Three Amigos Review 2026-02-15]] (Phase 1-2: BaseHubView + System Hub migrations — TASM 29/35)
  - [[Three Amigos Review - Component Extraction 2026-02-15]] (ReportsTab + DomainsTab decomposition — TASM 30/35)
  - [[Pre-Feature Development Review 2026-02-15]] (Gap analysis before Phase 3)
  - [[Three Amigos Review - HubRegistry + Navigation 2026-02-15]] (Phase 2.5: cross-hub infrastructure — TASM 32/35)
  - [[Three Amigos Review - User Hub First Increment 2026-02-15]] (Phase 3: PBI-001 increment 1 — TASM 33/35)
  - [[Three Amigos Review - User Hub Inbox Population 2026-02-15]] (Phase 3: PBI-001 increment 2 — TASM 34/35)
  - [[Three Amigos Review - Inbox UX and Source Config 2026-02-16]] (Phase 3: PBI-001 increment 3)
  - [[Three Amigos Review - Pipeline Inbox and Preferences 2026-02-16]] (Phase 3: PBI-001 increment 4)
  - [[Three Amigos Review - Session Domain Core 2026-02-16]] (Phase 4: PBI-002 increment 1)
  - [[Three Amigos Review - Session Templates and Rerun 2026-02-16]] (Phase 4: PBI-002 increment 3 — TASM 32/35)
  - [[Three Amigos Review - Focus File and Timeline 2026-02-16]] (Phase 4: PBI-002 increments 4+5 — TASM 34/35)
  - [[Three Amigos Review - Session Workspace Enrichment 2026-02-16]] (Phase 4: PBI-002 increment 8 — TASM 34/35)
  - [[Three Amigos Review - Preparation Flow 2026-02-16]] (Phase 4: PBI-002 increment 9 — TASM 32/35)
- Sitemap: [[User Hub View]], [[Event Catalog View]], [[Data Exchange Hub View]]
- Components: [[UserHubView]], [[UserHubDashboard]], [[UserHubInbox]], [[UserHubSessions]], [[UserHubPreferences]]
- Workspace: [[SessionWorkspaceView]] (Inc 7→9: 754 LOC, dedicated adjacent leaf management)
- Modals: [[NewSessionModal]] (goals repeater, title validation), [[SaveTemplateModal]], [[VaultFilePickerModal]]
- Domain: [[SessionService]], [[InboxService]]
- Helpers: `src/domain/session/helpers.ts` (formatDuration, computeRemainingMs, computeElapsedMs, computeTimelineSummary, formatDurationHuman, generateSessionSummary, generateSessionFrontmatter, generateSessionSummaryBody, mergeSessionNotes)

# Backlog

```base
filters:
  and:
    - file.inFolder("Development/flowti/docs/features/Hubs/backlog")
views:
  - type: table
    name: Table
    order:
      - type
      - file.name
      - stage
      - priority
    sort:
      - property: type
        direction: ASC
    columnSize:
      note.type: 151
      file.name: 533

```

# Increments

```base
filters:
  and:
    - file.inFolder("Development/flowti/docs/features/Hubs/increments")
views:
  - type: table
    name: Table
    order:
      - file.name
      - stage
      - phase
      - increment
      - tasm_score
      - tests_total
      - date
    sort:
      - property: phase
        direction: ASC
      - property: increment
        direction: ASC
    columnSize:
      file.name: 400
      note.stage: 100

```

# Reviews

```base
filters:
  and:
    - file.inFolder("Development/flowti/docs/features/Hubs/reviews")
views:
  - type: table
    name: Table
    order:
      - file.name
      - summary
      - scores_health_level
      - scores_ux_quality
      - scores_product_value
      - scores_performance_scalability
      - scores_event_discipline
      - scores_documentation_discipline
      - scores_data_model_integrity
      - scores_architectural_integrity
      - date
    sort:
      - property: date
        direction: DESC
    columnSize:
      file.name: 430
      note.summary: 491

```

# Document Types

```base
filters:
  and:
    - file.inFolder("Development/flowti/docs/features/Hubs/types")
views:
  - type: table
    name: Table
    order:
      - file.name
      - abbreviation
      - folder
    sort:
      - property: file.name
        direction: ASC

```
