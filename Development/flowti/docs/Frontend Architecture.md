---
stage: open
domain: Flowti/System
plugin: "[[Development/flowti/README|README]]"
tags:
  - frontend
---

# Frontend Architecture

This document describes the current frontend architecture of the Flowti IBDE Obsidian plugin, its design principles, view inventory, and refactoring history with planned next phases.

> Last updated: 2026-02-16 (Session domain + Sessions tab added)

---

## Design Principles

1. **EventBus-first** — All inter-layer communication flows through a typed EventBus. Views emit commands, services emit facts. Direct service calls from UI are limited to read-only queries and operation triggers.

2. **Event Catalog as self-documentation** — The application documents itself by registering its events, services, domains, commands, and flows in the Event Catalog. Users document their own domain by using the application.

3. **Domain Hubs** — The application is organized around domains. Each hub provides focused interfaces that support the user's jobs to be done.

4. **Hub Shell Pattern** — Hub views extend `BaseHubView<TPage>`, which owns the shared shell lifecycle (wrapper, top bar, tab bar, split layout, render scheduling, cleanup, hub lifecycle events). Subclasses implement domain-specific rendering via abstract methods. See [[ADR-024 BaseHubView Shell Extraction]].

5. **Orchestrator + Component pattern** — Complex views are split into a thin orchestrator (lifecycle, state, scanning, navigation) and plain TypeScript component classes (rendering). Components receive dependencies via injection, not inheritance.

6. **File-driven entities** — Domains, services, flows, systems, actors, and products are defined as Markdown files with typed frontmatter. The catalog merges file-driven entries with code-registered metadata to produce a unified view.

7. **Obsidian-native styling** — All UI uses Obsidian's CSS variables for theming (dark/light mode). Custom classes use the `ft-` prefix to avoid collisions.

8. **DocService centralization** — All documentation file creation goes through `doc.create` events handled by the DocService. UI components never call `fileSystemClient.createFile()` directly for docs.

9. **UI Command Bus** — All user entry points (Obsidian commands, ribbon icons, file-menu items) emit `ui.*` events on the EventBus. The `UiCommandService` handles the actual view/modal opening, making all user navigation observable and traceable.

---

## Layer Overview

```
src/                     # ~31,467 LOC across 154 files
├── main.ts              # Plugin orchestrator (482 LOC)
├── dataExchangeSetup.ts # Data Exchange UI wiring (~310 LOC, CommandBus Phase 8: commands + file-menu emit ui.* events)
├── infrastructure/      # Generic plumbing — events, services, commands, views, filesystem, logger, errors
│   ├── events/          # EventBus, EventBridge, catalog, FlowtiEventMap
│   ├── services/        # ServiceContainer (DI), registry
│   ├── commands/        # CommandRegistry, middleware
│   ├── errors/          # FlowtiError hierarchy, ErrorService
│   ├── filesystem/      # FileSystemClient (async ops + events)
│   ├── logger/          # LoggerService (in-memory buffer + events)
│   ├── ui/              # UiCommandService (ui.* command bus)
│   └── views/           # ViewRegistry
├── domain/              # Business logic (DDD, each owns events.ts)
│   ├── dataExchange/    # Import/Export orchestration (11 files, ~3,600 LOC)
│   ├── docs/            # DocService + content generators + path resolvers
│   ├── ingestion/       # Vault file batching + retry pipeline
│   ├── installer/       # First-run wizard + folder scaffold
│   ├── settings/        # Settings persistence + migration
│   ├── subscription/    # Event subscription CRUD + matching
│   ├── eventDefinition/ # Source event → domain event mapping
│   ├── eventFilter/     # Activity Log visibility toggles
│   ├── eventNotify/     # Notice popups on event fire
│   ├── discovery/       # Vault scan for custom events
│   ├── session/         # Documentation sessions (timer, artifacts, lifecycle)
│   ├── inbox/           # User inbox items (mappers, service, persistence)
│   └── user/            # User profile management
├── ui/                  # Presentation layer (~17,127 LOC)
│   ├── catalog/         # Event Catalog components (15 files, 4,573 LOC)
│   ├── hub/             # Data Exchange Hub components (21 files, 4,414 LOC)
│   ├── csv/             # CSV import wizard components (10 files, 1,752 LOC)
│   ├── export/          # Export wizard components (7 files, 994 LOC)
│   ├── userHub/         # User Hub components (4 files: Dashboard, Inbox, Sessions, Preferences)
│   └── *.ts             # Orchestrator views + modals
└── utils/               # Shared helpers (persistence, glob, types)
```

### Communication Flow

```
User Action → Obsidian Entry Point → EventBus (ui.* command) → UiCommandService → View/Modal
View Component → EventBus (domain command) → Domain Service → EventBus (domain fact) → View Component (re-render)
```

Views read state via `deps.getState()` and write via `deps.setState(partial)`. The orchestrator debounces re-renders with `scheduleRender()` (16ms).

---

## View Inventory

### Obsidian ItemView Subclasses

| View | Type Constant | LOC | Base Class | Layout | Purpose |
|------|--------------|-----|------------|--------|---------|
| `BaseHubView<TPage>` | — (abstract) | ~278 | `ItemView` | shell (wrapper + top bar + tab bar + split) | Abstract base: shared Hub lifecycle, navigation, render scheduling, cleanup |
| `EventCatalogView` | `flowti-event-catalog` | ~723 | `BaseHubView<CatalogTab>` | master-detail | 8-tab catalog: Dashboard, Domains, Services, Events, Flows, Systems, Actors, Products |
| `DataExchangeHubView` | `flowti-data-exchange-hub` | ~477 | `BaseHubView<DXTab>` | master-detail + tab bar | 7-page hub: Dashboard, Imports, Exports, Reports, Properties, Pipelines, Types |
| `EventLogView` | `flowti-event-log` | ~581 | log list | Activity feed with category/type filters and subscribed/all modes |
| `ExportView` | `flowti-export` | ~655 | wizard stepper | 4-page export wizard: View Select, Configure, Preview, Result |
| `CsvActionView` | `flowti-csv` | ~747 | landing + wizard | CSV file handler: column preview landing page + 4-page inline import wizard |
| `UserHubView` | `flowti-user-hub` | ~273 | `BaseHubView<UserHubTab>` | 3-tab user hub: Dashboard, Inbox, Sessions (+ Preferences) |
| `ComponentShowcaseView` | `flowti-component-showcase` | ~297 | showcase | Development view for previewing all CSS components |

### Modals

| Modal | LOC | Purpose |
|-------|-----|---------|
| `EventConfigModal` | ~628 | Per-event config hub (3 pages: overview, subscription form, definition form) |
| `PipelineSourceModal` | ~468 | Add/edit CSV sources within import pipelines |
| `InstallerWizardModal` | ~400 | First-run setup wizard (4 pages: Welcome, Review, Progress, Complete) |
| `SubscriptionManagerModal` | ~191 | Manage all event subscriptions (list + form pages) |
| `ConfirmModal` | ~40 | Simple confirmation dialog |
| `InputModal` | ~60 | Single text input dialog |
| `CreateEventModal` | ~70 | Event creation with name + category |
| `NewSessionModal` | ~70 | Session creation with title, type, and duration |
| `ConfigChooserModal` | ~30 | Fuzzy-searchable config picker (`FuzzySuggestModal`) |
| `FilePickerModal` | ~40 | Fuzzy-searchable file picker with extension filter |
| `FolderPickerModal` | ~70 | Fuzzy-searchable folder picker with create-on-type |

### Component Architecture (Decomposed Views)

Both major views extend `BaseHubView<TPage>` and follow the **orchestrator + component** pattern:

**Event Catalog** (`src/ui/catalog/`, 15 files):
- `CatalogDashboard` — Stats grid, quick actions, recent activity
- `DomainsTab`, `ServicesTab` — Hybrid file + catalog entity scanning
- `EventsTab` — Category tree orchestrator, filter state, scanning
- `EventsCategoryRenderer` — Collapsible category groups, event items with status dots, category actions
- `EventsSettingsPanel` — Filter toggles (configured, followed), system events toggle, category visibility/ordering
- `EventDetailPanel` — Event detail header, info card, actions, watchers, transforms, related entities
- `FlowsTab`, `SystemsTab`, `ActorsTab`, `ProductsTab` — File-driven entity management

**Data Exchange Hub** (`src/ui/hub/`, 21 files):
- `HubDashboard` — Dashboard orchestrator delegating to sub-components
- `DashboardPipelines` — Pipeline summary table section
- `DashboardImports` — Import configs table with inline execution
- `DashboardExports` — Export configs table section
- `DashboardImportExecutor` — Inline import progress row with auto-dismiss
- `ImportsTab`, `ExportsTab` — Saved config management with inline execution
- `PipelinesTab` — Multi-source import pipeline builder
- `TypesTab` — Note type documentation with CRUD lifecycle events and frontmatter scan issues banner
- `PropertiesTab` — Data dictionary with cross-config usage tracking
- `ReportsTab` — CSV file documentation browser with frontmatter validation alerts and name disambiguation

**CSV Import** (`src/ui/csv/`, 10 files):
- `CsvLanding` — Landing page orchestrator delegating to sub-components
- `CsvDataSnapshot` — Interactive data preview table with sorting, filtering, column chips
- `CsvUsageSection` — Import config usage display + inline import execution
- `CsvAssociatedBases` — Associated .base file finder/renderer
- `CsvConfigPage` — Form + column mapping grid
- `CsvPreviewPage` — Parsed data preview
- `CsvResultPage` — Import results

**Export** (`src/ui/export/`):
- `ViewSelectPage` — Source selection
- `ConfigurePage` — Settings form + property grid
- `PreviewPage` — Export preview
- `ResultPage` — Results display

**User Hub** (`src/ui/userHub/`, 4 files):
- `UserHubDashboard` — Welcome section, cross-hub summary cards, active session card, inbox preview, quick actions
- `UserHubInbox` — Inbox master list (filter, source badges, read/unread) + detail panel (type badge, source event link, actions)
- `UserHubSessions` — Session master list (status sort, accent border on active, filter, "New" button) + detail panel (timer, info, artifacts, contextual lifecycle actions). Empty state shows "New Session" button opening `NewSessionModal`
- `UserHubPreferences` — User profile editing + inbox source toggles

**Pipeline Detail** (`src/ui/hub/pipelines/`):
- `PipelineDetail` — Single pipeline view
- `PipelineEditForm` — Edit form
- `PipelinePreview` — Preview/confirm step
- `PipelineExecution` — Execution + progress
- `SourcesExportsGrid` — Two-column sources/exports layout

Each component follows the same constructor pattern:
```typescript
class SomeTab {
  constructor(
    private masterEl: HTMLElement,
    private detailEl: HTMLElement,
    private deps: ComponentDeps
  ) {}

  renderMaster(): void { /* list rendering */ }
  renderDetail(): void { /* detail panel rendering */ }
}
```

### Shared Helpers

Both decomposed views share extracted helper modules to avoid duplication:

**`catalog/helpers.ts`** (~501 LOC):
- `buildSplitLayout()` — creates the dashboard + master/detail DOM structure used by both orchestrators
- `openOrCreateEventDoc()` — finds existing event doc or creates from template
- `renderSubscriptionForm()` / `renderSubscriptionRow()` — subscription UI shared between `EventConfigModal` and `SubscriptionManagerModal`
- `readFrontmatter()`, `fmString()`, `fmStringArray()`, `normalizeDocFrontmatter()` — frontmatter parsing + normalization
- `findRelatedFlows()`, `findRelatedSystems()`, `findRelatedActors()`, `findRelatedProducts()` — cross-reference helpers
- Category ordering, entity scanning, visibility filtering

> Note: `createEntityDoc()` was removed in Phase 8. All doc creation now goes through `doc.create` events to the DocService.

**`hub/helpers.ts`** (~358 LOC):
- `renderStepBar()` — generic wizard stepper bar shared between `CsvActionView` and `ExportView`
- `renderConfigDropdown()` — config save/load dropdown shared between `CsvActionView` and `ExportView`
- `openEventInCatalog()` — cross-view navigation to Event Catalog
- `renderDashboardSectionHeader()`, `renderEmptyDetail()` — common hub UI patterns
- `validateCsvDocFrontmatter()` — validates CsvDoc frontmatter fields (type, csvFile/filePath, headers, columns, rows)
- `validateTypeDocFrontmatter()` — validates TypeDoc frontmatter fields (type, name, properties)
- `validateDocFrontmatter()` — generic frontmatter validator (missing/wrong type detection)
- `renderFrontmatterAlert()` — renders per-entry frontmatter warning alert in detail panels
- `renderScanIssuesBanner()` — renders collapsible scan-level warning banner (skipped files count + details)

---

## State Management

There are no external state libraries (Redux, Zustand, etc.). State is managed directly by orchestrators.

### Pattern

1. **Orchestrator** declares private state fields (e.g., `selectedDomainName`, `importConfigs[]`)
2. **State interface** defines the shape (e.g., `CatalogState`, `HubState`)
3. **`getState()`** returns a snapshot object for components to read
4. **`setState(partial)`** applies partial updates and optionally triggers re-render
5. **EventBus listeners** in the orchestrator update state in response to domain events:

```typescript
// In orchestrator constructor
this.eventBus.on("subscription.created", () => {
  this.subscriptions = [...];
  this.scheduleRender();
});
```

### Persistence

10 domain services persist state via shared helpers in `src/utils/persistence.ts`:

```typescript
loadStateFromStorage<T>(storage, key): Promise<T | undefined>
saveStateToStorage<T>(storage, key, state): Promise<void>
```

Each service uses a unique storage key (`"subscription"`, `"eventDefinition"`, `"installer"`, `"dataExchange"`, `"discovery"`, `"eventFilter"`, `"eventNotify"`, `"ingestion"`, `"sessions"`, `"inbox"`, `"user"`) within a shared `IStorageProvider`. The `load()` method must be called in `onLayoutReady()` to prevent the dual-state bug where default state overwrites persisted data.

---

## Navigation

### Within-View Navigation

Hub views inherit `navigateTo(page)` from `BaseHubView`, which handles dashboard/split visibility toggling, title updates, tab bar highlighting, and hub event emission. Subclass-specific navigation is exposed via `deps.navigation`:

- **Event Catalog**: `navigateToDomain(name)`, `navigateToEvent(type)`, `navigateToService(name)`, etc.
- **Data Exchange Hub**: `showImportConfig(id)`, `openCsvImport(path)`, `openExport(cfg)`, etc.

Tab switching toggles DOM visibility and triggers debounced re-rendering via `scheduleRender()`.

### Cross-View Navigation

Views navigate to each other by finding or creating Obsidian leaves:

```typescript
const existing = workspace.getLeavesOfType(VIEW_TYPE_EVENT_CATALOG);
if (existing.length > 0) {
  workspace.revealLeaf(existing[0]);
  (existing[0].view as EventCatalogView).navigateToEvent(eventType);
} else {
  const leaf = workspace.getLeaf(true);
  void leaf.setViewState({ type: VIEW_TYPE_EVENT_CATALOG, active: true })
    .then(() => /* navigate after init */);
}
```

Cross-view coupling is minimized: `CsvActionView` uses an injected callback instead of importing `DataExchangeHubView` directly.

### Navigation Map

```
EventCatalogView ─────→ EventLogView        (open activity log in sidebar)
                 ─────→ SubscriptionManagerModal
                 ─────→ EventConfigModal     (per-event config from catalog)

DataExchangeHubView ──→ EventCatalogView     (show event in catalog)
                     ──→ ExportView           (open export wizard)
                     ──→ CsvActionView        (open CSV import)

CsvActionView ────────→ DataExchangeHubView  (via injected callback)

main.ts ──────────────→ All views            (factory registration + callback wiring)
dataExchangeSetup.ts ─→ Hub, CSV, Export     (view registration + file menu wiring)
```

---

## EventBus

### Scale

The `FlowtiEventMap` type union contains **155 events** across 14 domains:

| Domain | Events | Examples |
|--------|--------|---------|
| Plugin Lifecycle | 5 | `plugin.loading`, `plugin.ready`, `plugin.unloaded` |
| Service Lifecycle | 4 | `service.registered`, `service.initialized` |
| Commands | 4 | `command.registered`, `command.executed` |
| Views | 1 | `view.registered` |
| Logging / Errors | 4 | `log.entry`, `log.error`, `error.occurred`, `error.handled` |
| File Operations | 17 | `file.create.request`, `file.created`, `file.modified` |
| Folder Notifications | 3 | `folder.created`, `folder.deleted`, `folder.renamed` |
| Event File | 1 | `event.file.triggered` |
| Frontmatter | 6 | `frontmatter.get.request`, `frontmatter.update.response` |
| Workspace / Metadata | 5 | `workspace.leaf-changed`, `metadata.changed` |
| Settings | 7 | `settings.loaded`, `settings.changed`, `settings.updateCatalogCategories` |
| User | 3 | `user.created`, `user.updated`, `user.loaded` |
| Event Filter | 4 | `eventFilter.loaded`, `eventFilter.toggle` |
| Event Notification | 4 | `eventNotify.loaded`, `eventNotify.fired` |
| Discovery | 5 | `discovery.loaded`, `discovery.updated`, `discovery.create` |
| Subscription | 9 | `subscription.create`, `subscription.loaded`, `subscription.matched` |
| Ingestion | 11 | `ingestion.job.queued`, `ingestion.job.completed`, `catchup.started` |
| Event Definition | 9 | `eventDefinition.create`, `eventDefinition.loaded`, `eventDefinition.matched` |
| Data Exchange | 15 | `dataExchange.import.execute`, `dataExchange.export.completed` |
| Documentation | 6 | `doc.create`, `doc.created`, `doc.exists`, `doc.failed` |
| Hub | 3 | `hub.opened`, `hub.closed`, `hub.tab.changed` |
| Session | 19 | `session.create`, `session.started`, `session.timer.tick`, `session.artifact.added` |
| Inbox | 5 | `inbox.itemAdded`, `inbox.itemsChanged`, `inbox.cleared` |
| Installer | 6 | `installer.started`, `installer.step.completed` |

### Conventions

- **Naming**: `domain.action` for commands, `domain.fact` for events
- **System tags**: Infrastructure events tagged `["system"]`, filterable in catalog
- **Hub lifecycle events**: `hub.opened`, `hub.closed`, `hub.tab.changed` — emitted by `BaseHubView` automatically for all Hub views
- **Wildcard listener**: EventLogView uses `eventBus.on("*", ...)` for activity feed (skips `log.*` to avoid recursion)
- **Per-domain event files**: Each domain exports its own `EventMap` interface, composed into `FlowtiEventMap` via `extends`

---

## Styling

- **Stylesheet**: `styles.css` at project root
- **Prefix**: All custom classes use `ft-` (e.g., `ft-btn`, `ft-card`, `ft-badge`)
- **Obsidian integration**: Uses CSS variables (`--interactive-accent`, `--background-secondary`, `--text-normal`, etc.)
- **Utility classes**: Flexbox (`ft-flex`, `ft-flex-1`, `ft-flex-shrink-0`, `ft-gap-*`), spacing (`ft-p-*`, `ft-m-*`), typography (`ft-text-sm`, `ft-text-muted`, `ft-heading-*`), appearance (`ft-icon-muted`, `ft-icon-faint`, `ft-icon-subtle`, `ft-cursor-pointer`), layout (`ft-view-root`, `ft-view-dashboard`, `ft-view-split`)
- **View header override**: Catalog and Hub views hide Obsidian's default view header via `.workspace-leaf-content[data-type="flowti-*"] .view-header { display: none; }`

---

## Domain Service Composition (DataExchangeService)

`DataExchangeService` (579 LOC) uses composition with a facade pattern. Five sub-modules handle distinct responsibilities:

| Sub-module | LOC | Responsibility |
|------------|-----|----------------|
| `ConfigDocService` | 435 | Path resolution, doc CRUD, event doc emission |
| `configDocContent` | 579 | Content builders (import/export/pipeline/CSV docs) |
| `PipelineExecutor` | 223 | Multi-source pipeline execution + .base file creation |
| `ConfigPathTracker` | 127 | File/folder rename → config path updates |
| `DataDictionaryBuilder` | 125 | Pure function: aggregate property usage across configs |

Sub-modules receive dependencies via typed interfaces (`ConfigDocServiceDeps`, `PipelineExecutorDeps`, `ConfigPathTrackerDeps`). The parent service remains the public API — all consumers see the same interface. `ConfigStateAccessor` provides read-only state access to sub-modules.

---

## File Size Distribution (Feb 2026, post Phase 1-10)

### Files over 500 LOC (14 files)

| LOC | File | Role | Status |
|-----|------|------|--------|
| 723 | `ui/EventCatalogView.ts` | Catalog orchestrator | Extends BaseHubView, delegates to 15 components |
| 747 | `ui/CsvActionView.ts` | CSV import orchestrator | Delegates to 7 components |
| 708 | `domain/docs/contentGenerator.ts` | Markdown generators | **Candidate for further split** |
| 655 | `ui/ExportView.ts` | Export orchestrator | Delegates to 4 components |
| 629 | `ui/EventConfigModal.ts` | Event config modal (3 pages) | **Candidate for extraction** |
| 613 | `infrastructure/events/EventBridge.ts` | Obsidian API bridge | Core infrastructure — careful |
| 581 | `ui/EventLogView.ts` | Activity log orchestrator | Single-purpose view |
| 579 | `domain/dataExchange/DataExchangeService.ts` | Data Exchange facade | Delegates to 5 sub-modules |
| 579 | `domain/dataExchange/configDocContent.ts` | Config doc content builders | Extracted from ConfigDocService (Phase 10b) |
| 563 | `ui/catalog/DomainsTab.ts` | Domains tab | File + catalog hybrid scanning |
| 544 | `ui/hub/ExportsTab.ts` | Exports tab | Saved config management |
| 540 | `ui/hub/ImportsTab.ts` | Imports tab | Saved config management |
| 507 | `ui/catalog/ServicesTab.ts` | Services tab | File + catalog hybrid scanning |
| 501 | `ui/catalog/helpers.ts` | Shared catalog helpers | Cross-cutting utilities |

---

## Completed Refactoring

### Phase 1 — ExportView Decomposition
**ExportView.ts**: extracted 4-page wizard into `src/ui/export/`
- `ViewSelectPage.ts` — source selection
- `ConfigurePage.ts` — settings form + property grid
- `PreviewPage.ts` — export preview
- `ResultPage.ts` — results display
- `exportUtils.ts` — shared helpers
- `types.ts` — state + deps types

### Phase 2 — CsvActionView Decomposition
**CsvActionView.ts**: extracted CSV import wizard into `src/ui/csv/`
- `CsvLanding.ts` — file info, snapshot table, config usage
- `CsvConfigPage.ts` — form + column mapping grid
- `CsvPreviewPage.ts` — parsed data preview
- `CsvResultPage.ts` — import results
- `csvUtils.ts` — delimiter detection, formatting
- `types.ts` — state + deps types

### Phase 3 — PipelinesTab Decomposition
**PipelinesTab.ts**: extracted pipeline detail UI into `src/ui/hub/pipelines/`
- `PipelineDetail.ts` — single pipeline view
- `PipelineEditForm.ts` — edit form
- `PipelinePreview.ts` — preview/confirm step
- `PipelineExecution.ts` — execution + progress
- `SourcesExportsGrid.ts` — two-column sources/exports layout
- `types.ts` — pipeline component types

### Phase 4 — EventsTab Detail Extraction
**EventsTab.ts** (1,040 → 329 LOC): extracted detail panel, settings panel, and category renderer
- `EventDetailPanel.ts` — header, info card, actions, watchers, transforms, related entities
- `EventsSettingsPanel.ts` — filter toggles (configured, followed), system events toggle, category visibility/ordering (Phase 9d)
- `EventsCategoryRenderer.ts` — collapsible category groups, event items with status dots, category actions (Phase 9d)
- EventsTab retains master list orchestration, filter state, scanning

### Phase 5 — HubDashboard Import Executor
**HubDashboard.ts** (854 → 766 LOC): extracted inline import executor into `src/ui/hub/DashboardImportExecutor.ts`
- Progress row, event listeners, auto-dismiss

### Phase 6 — DataExchangeService Decomposition
**DataExchangeService.ts** (1,802 → 579 LOC, 68% reduction): extracted 4 sub-modules

| File | LOC | Responsibility |
|------|-----|----------------|
| `ConfigDocService.ts` | 435 | Path resolution, doc CRUD, event doc emission |
| `configDocContent.ts` | 579 | Content builders (import/export/pipeline/CSV/property/type docs) |
| `PipelineExecutor.ts` | 223 | Multi-source pipeline execution + .base file creation |
| `ConfigPathTracker.ts` | 127 | File/folder rename → config path updates |
| `DataDictionaryBuilder.ts` | 125 | Pure function: aggregate property usage across configs |

**Pattern**: Composition with facade — DataExchangeService remains the public API, sub-modules are internal. Zero UI consumer changes, zero test modifications. `ConfigStateAccessor` interface provides read-only state access.

### Phase 7 — main.ts Decomposition
**main.ts** (978 → 482 LOC, 51% reduction): extracted Data Exchange UI wiring into `src/dataExchangeSetup.ts` (368 LOC).

`DataExchangeSetup` handles:
- View registration (Hub, CSV, Export — 3 views)
- Command registration (import-csv, export-data — 2 commands)
- File menu items (CSV import, base/folder export context menus)
- Vault callback wiring (setDocsRootPath, setListFiles, setWriteExternalFile, setReadExternalFile)

**main.ts after**: 482 LOC — pure lifecycle orchestration. Instantiates `DataExchangeSetup` in `onLayoutReady()`.

### Phase 8 — DocService Centralization
Centralized all documentation file creation into `src/domain/docs/DocService.ts` via `doc.create` → `doc.created` event cycle.

**Changes**:
- Created `DocService` with path resolution + content generation for all 16 doc types
- Migrated 6 catalog tabs from `createEntityDoc()` to `doc.create` events
- Migrated `DiscoveryService` from direct `fileSystem.createFile()` to `doc.create` events
- Removed `createEntityDoc()` from `catalog/helpers.ts`
- Added `doc.created`/`doc.exists` listeners in `EventCatalogView` for post-creation navigation

**Pattern**: Event-driven doc creation — callers emit intent, DocService handles path resolution, content generation, existence checking, and file creation. Result events enable reactive UI updates.

### Phase 9 — Large UI Component Extraction

#### 9a. HubDashboard.ts (766 → 295 LOC, 62% reduction)
Extracted 3 dashboard sections into standalone components:

| File | LOC | Responsibility |
|------|-----|----------------|
| `DashboardPipelines.ts` | 165 | Pipeline summary table section |
| `DashboardImports.ts` | 180 | Import configs table with inline execution |
| `DashboardExports.ts` | 175 | Export configs table section |

#### 9b. CsvLanding.ts (701 → 236 LOC, 66% reduction)
Extracted 3 landing page sections into standalone components:

| File | LOC | Responsibility |
|------|-----|----------------|
| `CsvDataSnapshot.ts` | 225 | Interactive data preview table with sorting, filtering, column chips |
| `CsvUsageSection.ts` | 192 | Import config usage display + inline import execution |
| `CsvAssociatedBases.ts` | 107 | Associated .base file finder/renderer |

**Pattern**: Callbacks for cross-component communication — `persistDisplaySettings()` and `refreshAssociatedBases()` passed as callbacks to sub-components from the orchestrator.

#### 9c. EventsTab.ts (655 → 329 LOC, 50% reduction)
Extracted settings panel and category tree rendering:

| File | LOC | Responsibility |
|------|-----|----------------|
| `EventsSettingsPanel.ts` | 133 | Filter toggles, system events toggle, category visibility/ordering |
| `EventsCategoryRenderer.ts` | 276 | Collapsible category groups, event items with status dots, category actions |

**Pattern**: `CategoryRenderContext` interface bundles state + callbacks for the extracted renderer. `EventsSettingsPanelCallbacks` interface passes filter toggle callbacks.

### Phase 10 — Content Generation & Doc Service Extraction

#### 10a. ConfigDocService.ts (934 → 435 LOC, 53% reduction)
Extracted content builders into a separate pure-function module:

| File | LOC | Responsibility |
|------|-----|----------------|
| `configDocContent.ts` | 579 | Content builders for import, export, pipeline, CSV, property, and type docs |

**ConfigDocService.ts after**: 435 LOC — path resolution + doc CRUD (create/ensure/update).

### Phase 11 — Entity Tab Deduplication (TD-34)

Created `BaseEntityTab<T>` abstract class with `EntityTabConfig<T>` configuration object. All 4 entity tabs refactored to thin subclasses.

| File | Before | After | Reduction |
|------|--------|-------|-----------|
| `FlowsTab.ts` | 314 LOC | 113 LOC | -201 LOC |
| `ActorsTab.ts` | 314 LOC | 112 LOC | -202 LOC |
| `ProductsTab.ts` | 320 LOC | 117 LOC | -203 LOC |
| `SystemsTab.ts` | 318 LOC | 116 LOC | -202 LOC |
| `BaseEntityTab.ts` (new) | — | 370 LOC | +370 LOC |
| **Total** | **1,266 LOC** | **828 LOC** | **-438 LOC** |

**Design**: Composition via config, not inheritance overrides. `SystemsTab` uses `filterIncludesEvents: false` and custom `renderDirectEventsSection()` for `EventCatalogEntry[]` (vs string-based resolution in other tabs). Backward-compatible accessor methods preserved on subclasses.

### Phase 12 — BaseHubView Shell Extraction (ADR-024)

Extracted shared Hub shell lifecycle into `BaseHubView<TPage>` abstract base class. Both System Hub views now extend it.

| File | Before | After | Change |
|------|--------|-------|--------|
| `BaseHubView.ts` (new) | — | 278 LOC | Abstract base: wrapper, top bar, tab bar, split layout, render scheduling, hub events |
| `EventCatalogView.ts` | 864 LOC | 723 LOC | -141 LOC — shell code moved to base class |
| `DataExchangeHubView.ts` | 556 LOC | 477 LOC | -79 LOC — shell code moved to base class, gains tab bar |
| `hub/events.ts` (new) | — | 11 LOC | HubEventMap (3 lifecycle events) |

**Pattern**: Inheritance with generic type parameter. `BaseHubView<TPage>` owns the Obsidian `ItemView` lifecycle. Subclasses implement ~10 abstract methods for domain-specific rendering. The `onTabChanged()` virtual hook allows tab-specific DOM toggling without overriding `navigateTo()`.

**Hub lifecycle events**: `hub.opened`, `hub.closed`, `hub.tab.changed` — registered in EVENT_CATALOG with category "Hub", tagged `["system"]`, hidden by default in catalog.

**Key design decisions**:
- `getViewType()` NOT in base class — Obsidian view types differ from hub IDs
- HubAdapter interface deferred — premature for 2 System Hubs
- Declarative tab definitions deferred — hardcoded arrays work at current scale

### Frontmatter Validation & User Feedback (Feb 2026)

Added scan-level and per-entry frontmatter validation across the Data Exchange Hub:

**Scan-level tracking** (`DataExchangeHubView`):
- `scanCsvDocs()` and `scanTypeDocs()` collect `FrontmatterIssue[]` for files with missing/wrong-type frontmatter
- Issues stored in `HubState.frontmatterIssues` and passed to tab components

**Per-entry validation** (`hub/helpers.ts`):
- `validateCsvDocFrontmatter()` checks type, csvFile/filePath, headers (required array), columns/rows (optional numbers)
- `validateTypeDocFrontmatter()` checks type, name (required string), properties (optional array)
- `validateDocFrontmatter()` generic validator for type-checking any doc file

**UI feedback**:
- `renderScanIssuesBanner()` — collapsible `<details>` banner at top of master lists showing "N files skipped" with per-file issue details
- `renderFrontmatterAlert()` — warning alert in detail panels with bullet list of field-level issues
- Warning triangle icon on master list items with frontmatter issues (tooltip shows issue summary)
- ReportsTab and TypesTab both show scan issues banners filtered to their respective doc folders

### Name Collision Disambiguation (Feb 2026)

Added `displayName` field to `CsvFileEntry` to handle same-named CSV files in different folders:

- Post-scan pass in `scanCsvFiles()` detects name collisions via `Map<string, number>`
- Colliding names get parent folder appended: `employees.csv (HR)` vs `employees.csv (Finance)`
- Root-level files without a parent folder keep their plain name
- `displayName` used throughout: master list items, detail headers, filter search, dashboard imports table
- Sort order uses `displayName` for consistent alphabetical grouping

---

## Planned Refactoring

### Phase 11 — Remaining Large UI Component Extraction

#### 11a. EventConfigModal.ts (629 LOC)
Currently has 3 pages: overview, subscription form, definition form.

**Proposed extraction**:

| New File | Responsibility | Est. LOC |
|----------|---------------|----------|
| `EventConfigOverview.ts` | Overview page: info + subscription list + definition list | ~200 |
| `SubscriptionForm.ts` | Subscription create/edit form | ~150 |
| `DefinitionForm.ts` | Event definition create/edit form | ~150 |

**EventConfigModal.ts after**: ~150 LOC — page navigation + modal chrome.

#### 11b. DomainsTab.ts (563 LOC)
Hybrid file + catalog entity scanning with detail panel.

**Proposed extraction**: Extract domain detail panel + domain actions into `DomainDetailPanel.ts`.

#### 11c. contentGenerator.ts (708 LOC)
Pure content generation file with markdown builders for 8+ entity types. Could split by category:

| New File | Responsibility | Est. LOC |
|----------|---------------|----------|
| `entityDocContent.ts` | Event, Domain, Service, Category doc content | ~300 |
| `relationalDocContent.ts` | Flow, System, Actor, Product doc content | ~300 |
| `docHelpers.ts` | Shared frontmatter builders, wikilink formatting | ~100 |

**Risk**: Low — pure functions, easily testable.

---

## Tech Debt

### Resolved

| Item | Resolution |
|------|-----------|
| **TD-1**: `ExportView` monolith (~1,355 LOC) | Phase 1: Decomposed into orchestrator (655 LOC) + 4 page components in `src/ui/export/` |
| **TD-2**: `CsvActionView` monolith (~2,190 LOC) | Phase 2: Decomposed into orchestrator (747 LOC) + 4 page components in `src/ui/csv/` |
| **TD-3**: No shared layout system | `buildSplitLayout()` in `catalog/helpers.ts` creates the dashboard + master/detail DOM structure. CSS classes `ft-view-root`, `ft-view-dashboard`, `ft-view-split` replace inline styles. Both orchestrators now use the shared builder. |
| **TD-4**: Inline styles in component code | ~170 inline `style.*` assignments replaced with CSS utility classes (`ft-icon-muted`, `ft-flex-shrink-0`, `ft-cursor-pointer`, `ft-flex-1`, etc.). Remaining ~300 inline styles are lower-frequency patterns with more variation. |
| **TD-5**: Subscription form duplication | `renderSubscriptionForm()` and `renderSubscriptionRow()` extracted to `catalog/helpers.ts`. Both `EventConfigModal` and `SubscriptionManagerModal` use the shared functions. |
| **TD-6**: Duplicated navigation logic | `openOrCreateEventDoc()` and `openEventInCatalog()` consolidated into shared helpers. `createEntityDoc()` replaced by `doc.create` events. |

### Remaining

| Item | Problem | Target | Debt File |
|------|---------|--------|-----------|
| **TD-7**: Limited UI testing | 1,887 tests across 82 files cover domain services, EventBus, utilities, pure functions, 6 view orchestrators, and 4 User Hub components. Component-level rendering tests expanding. | Add lightweight unit tests for remaining tab components with mock deps and DOM assertions via `obsidian-stub` polyfills. | [[TD-27 Limited UI component testing]] |
| **TD-8**: Scanner duplication between Catalog and Hub | Catalog tabs use `entityScanner.ts`; Hub tabs implement their own scanning logic. | Generalize scanner utility. Low ROI — Hub tabs are storage-driven. | [[TD-28 Scanner duplication between Catalog and Hub]] |

---

## Refactoring Principles

1. **Facade preservation**: Public APIs never change. All consumers see the same interface after extraction.
2. **Zero test changes**: Extracted code is internal — existing test suites pass without modification.
3. **Composition over inheritance**: Sub-modules receive deps interfaces, not parent class references.
4. **Build verification**: `npm run build` (1,883 tests + tsc + eslint + esbuild) after every step.
5. **Incremental extraction**: One module at a time, verify, then proceed. Never batch multiple extractions without build checks.
6. **No premature abstraction**: Extract when a file exceeds ~600 LOC or when distinct responsibilities are clearly identifiable. Don't extract for the sake of extracting.
7. **DocService for all docs**: Use `doc.create` events instead of direct `fileSystemClient.createFile()` calls for documentation files.

---

## Architecture Metrics

### Before Refactoring (Jan 2026)
- Largest file: `EventCatalogView.ts` at 3,714 LOC
- `DataExchangeService.ts` at 1,802 LOC
- 4 files over 1,000 LOC

### After Phase 1-12 (Feb 2026)
- Largest file: `CsvActionView.ts` at 747 LOC (orchestrator)
- No files over 1,000 LOC
- `EventCatalogView.ts`: 3,714 → 723 LOC (81% reduction, extends BaseHubView)
- `DataExchangeHubView.ts`: 556 → 477 LOC (14% reduction, extends BaseHubView)
- `DataExchangeService.ts`: 1,802 → 579 LOC (68% reduction)
- `main.ts`: 978 → 482 LOC (51% reduction)
- `HubDashboard.ts`: 766 → 295 LOC (62% reduction)
- `CsvLanding.ts`: 701 → 236 LOC (66% reduction)
- `EventsTab.ts`: 1,040 → 329 LOC (68% reduction)
- `ConfigDocService.ts`: 934 → 435 LOC (53% reduction)
- `BaseHubView.ts`: 278 LOC (new — shared shell for all Hub views)
- 14 files over 500 LOC (down from 6 files over 1,000 LOC)
- 82 test files, 1,887 tests — all passing
- ~162 source files, ~32,000 LOC

### Target After Phase 11
- `EventConfigModal.ts`: 629 → ~150 LOC
- `DomainsTab.ts`: 563 → ~300 LOC
- `contentGenerator.ts`: 708 → ~300 LOC

---

## Component Documentation

Each UI component has a dedicated documentation file in `docs/components/` (53 files). These follow a standardized template with frontmatter (`type: Component`), dependency tables, state descriptions, event tables, and cross-references.

**By subsystem:**

| Subsystem | Location | Count | Examples |
|-----------|----------|-------|----------|
| Orchestrator Views | `src/ui/*.ts` | 7 | [[BaseHubView]], [[EventCatalogView]], [[DataExchangeHubView]], [[CsvActionView]], [[ExportView]] |
| Modals | `src/ui/*.ts` | 8 | [[EventConfigModal]], [[SubscriptionManagerModal]], [[NewSessionModal]], [[ConfirmModal]] |
| Standalone UI | `src/ui/*.ts` | 2 | [[IngestionStatusBar]], [[ElectronDialog]] |
| Catalog | `src/ui/catalog/` | 11 | [[CatalogDashboard]], [[EventsTab]], [[DomainsTab]], [[FlowsTab]] |
| Hub | `src/ui/hub/` | 11 | [[HubDashboard]], [[ImportsTab]], [[PipelinesTab]] |
| Pipelines | `src/ui/hub/` | 5 | [[PipelineDetail]], [[PipelineEditForm]], [[PipelineExecution]] |
| CSV | `src/ui/csv/` | 7 | [[CsvLanding]], [[CsvConfigPage]], [[CsvDataSnapshot]] |
| User Hub | `src/ui/userHub/` | 4 | [[UserHubDashboard]], [[UserHubInbox]], [[UserHubSessions]], [[UserHubPreferences]] |
| Export | `src/ui/export/` | 4 | [[ViewSelectPage]], [[ConfigurePage]], [[PreviewPage]] |

## Use Case Documentation

All use cases are documented in `docs/use-cases/` (33 files). Each file follows a standardized template with frontmatter (`type: UseCase`), steps, preconditions, outcomes, variations, and cross-references to view docs and testplan IDs.

| View | Count | Examples |
|------|-------|----------|
| Event Catalog | 7 | [[Browse and Discover Events]], [[Configure Event Subscriptions]], [[Model a Business Flow]] |
| Data Exchange Hub | 7 | [[Manage Import Configurations]], [[Build Data Dictionary]], [[Orchestrate Multi-Import Pipelines]] |
| CSV Action | 6 | [[Import CSV as Notes]], [[Preview CSV File]], [[Handle Incremental Imports]] |
| Export | 6 | [[Export Base View as CSV]], [[Save Export to Filesystem]], [[Handle Export Conflicts]] |
| Event Log | 6 | [[Monitor Live Activity]], [[Debug Event Flow]], [[Pause and Inspect Events]] |
| Component Showcase | 1 | [[Preview Design System]] |

## User Journey Flows

End-to-end user journeys crossing multiple views and services are documented in `docs/flows/` (10 files). Each file follows a standardized template with frontmatter (`type: Flow`), step-by-step walkthroughs with events, decision points, and cross-references to use cases.

| Flow | Domains | Key Events |
|------|---------|------------|
| [[First-Run Onboarding]] | Installer, User, Settings | `installer.started` → `installer.completed` |
| [[Browse and Configure Events]] | Subscription, Event Definition | `subscription.create` → `subscription.created` |
| [[Import CSV as Notes]] | Data Exchange | `dataExchange.import.execute` → `dataExchange.import.completed` |
| [[Export Vault Data]] | Data Exchange | `dataExchange.export.execute` → `dataExchange.export.completed` |
| [[Build Import Pipeline]] | Data Exchange | Pipeline execution events |
| [[Create Domain Documentation]] | Settings | `doc.created` → `metadata.changed` |
| [[Monitor and Debug Events]] | Subscription, Settings | `eventNotify.changed` |
| [[Configure File Ingestion]] | Ingestion, Event Definition | `ingestion.job.completed` → `eventDefinition.matched` |
| [[Discover Custom Events]] | Discovery, Subscription | `event.file.triggered` → `discovery.loaded` |
| [[Manage Data Dictionary]] | Data Exchange | `dataExchange.import.completed` |

---

## Refactor & Coherence Checklist (Scored)

Audit of the current frontend architecture against the 12-section coherence checklist. Scored 2026-02-15. Overall: **78%**.

### 1) Boundary Clarity — 75%

| Item | Status | Notes |
|------|--------|-------|
| Obsidian Views are thin containers | **Partial** | EventCatalogView, EventLogView: clean. CsvActionView, ExportView, DataExchangeHubView: direct service CRUD calls ([[TD-42 Direct service calls bypass EventBus]]) |
| View does only mount/unmount, DI, lifecycle | **Partial** | 3 Views also handle config save/load and scanning operations |
| UI testable without Obsidian | **Yes** | `obsidian-stub.ts` polyfills + `happy-dom` enable component testing. `getState()`/`setState()` pattern decouples state from Obsidian |

### 2) Eventbus-First Communication — 72%

| Item | Status | Notes |
|------|--------|-------|
| UI triggers only Commands (Intent) | **Partial** | EventCatalogView: 100% eventbus. CSV/Export/Hub Views: direct service calls for CRUD ([[TD-42 Direct service calls bypass EventBus]]) |
| Application publishes only Events (Facts) | **Yes** | All domain services emit fact events (`*.created`, `*.loaded`, `*.failed`) |
| correlation_id / causation_id | **No** | Only file operations use `RequestId`. Domain events lack traceability ([[TD-43 No correlation IDs in domain events]]) |
| Command/Event naming conventions | **Yes** | Consistent `domain.action` / `domain.fact` hierarchy across 155+ events |
| Payload properties stable | **Yes** | Consistently camelCase (TypeScript convention, not snake_case). Stable across versions |

### 3) Store Discipline — 90%

| Item | Status | Notes |
|------|--------|-------|
| Components read via Selectors | **Yes** | All components use `deps.getState()` — no direct orchestrator field access |
| Stores own the UI-State | **Yes** | 4 orchestrators own centralized state (CatalogState, HubState, CsvViewState, ExportState) |
| Stores are pure | **Yes** | Domain services have no Obsidian API, no IO, no DOM. Orchestrator state logic separated from rendering |
| Loading/error/empty states | **Yes** | All tabs implement empty-state rendering. CSS classes: `.ft-catalog-detail-empty`, `.ft-alert-error` |
| Draft handling clean | **Partial** | Forms reset on save. No explicit `draft_is_dirty` flag — editing state indicated by `editingSubscriptionId !== null` |

### 4) Layout Library Coherence — 92%

| Item | Status | Notes |
|------|--------|-------|
| One Layout per View from library | **Yes** | `BaseHubView` owns `buildSplitLayout()` shell for all Hubs. Wizard stepper shared by CSV + Export |
| Stable Slots | **Yes** | `SplitLayout` interface: `dashboardEl`, `splitEl`, `masterEl`, `searchHeaderEl`, `detailEl` |
| Consistent slot naming | **Yes** | `ft-catalog-master`, `ft-catalog-detail`, `ft-view-root`, `ft-view-dashboard`, `ft-view-split` |
| Responsive behavior | **Yes** | State-driven visibility via `ft-hidden` toggles. Obsidian CSS variables for theme auto-adaptation |
| Empty/Loading/Error per layout | **Partial** | Empty + error states defined. No centralized error boundary pattern ([[TD-46 No error boundaries in views]]) |

### 5) UI Composition Map Alignment — 95%

| Item | Status | Notes |
|------|--------|-------|
| Matches UI Composition Map | **Yes** | 6 views documented in `docs/04 - Sitemap.base` with use cases, navigation, source links |
| Navigation / Deep-links | **Yes** | Event-driven via `ui.*` commands. Within-view via `NavigationCallbacks` interface |
| Primary entry points | **Yes** | `ui.openEventCatalog`, `ui.openEventLog`, `ui.openDataExchangeHub` + ribbon icons |
| Contextual navigation | **Yes** | Catalog → EventConfigModal → SubscriptionForm. Log → Event doc. Hub → Export/CSV views |

### 6) Observability & Trust — 82%

| Item | Status | Notes |
|------|--------|-------|
| Event Log: what/why/triggered-by/source | **Yes** | Type, category badge, timestamp, description, enriched context lines, expandable JSON payload |
| Dedup/suppression visible | **No** | Ingestion ledger and "once" policy skip silently ([[TD-47 Dedup not visible to users]]) |
| Errors as user-safe messages | **Yes** | CSV import has dedicated error cards with retry. Hub uses `ConfirmModal` + Notice toasts |
| Progress + counters during burst | **Yes** | IngestionStatusBar shows real-time state. CSV import has progress bar + row counter |
| Pause in log | **Yes** | Toggle button switches icon + aria label. Wildcard listener short-circuits when paused |

### 7) Performance & Scale — 60%

| Item | Status | Notes |
|------|--------|-------|
| Large lists virtualized | **No** | All lists render full DOM. Fine at current scale (~136 events, <100 configs) ([[TD-44 No list virtualization]]) |
| Store updates batched | **Yes** | 16ms render debounce via `scheduleRender()` across all orchestrators. IngestionService uses configurable batch window |
| Preview/validation debounced | **Yes** | Previews loaded on-demand, capped at 25 rows. No keystroke-level live validation |
| No long sync in UI thread | **Partial** | CSV parsing is synchronous on main thread ([[TD-48 CSV parsing blocks UI thread]]). Hub scan operations run during render |

### 8) Data & Persistence Consistency — 85%

| Item | Status | Notes |
|------|--------|-------|
| Subscription changes atomic | **Yes** | CRUD via events: create ID → mutate state → storage.save() → emit fact |
| Draft→save correct (IDs/timestamps) | **Yes** | IDs generated at creation (`sub_UUID`, `def_UUID`). Timestamps set. Form resets on save |
| Post-restart state reproducible | **Partial** | Domain state persisted via `load()`. UI view state (tab, selection) NOT persisted ([[TD-45 View state not persisted]]) |
| Catch-up avoids duplicates | **Yes** | Deterministic `eventType::path` keys. Ledger checked before event emission |

### 9) Error Handling & Recovery — 70%

| Item | Status | Notes |
|------|--------|-------|
| Clear error render path per view | **Partial** | CSV import: dedicated error card. Other views: no error boundary ([[TD-46 No error boundaries in views]]) |
| Errors don't block entire UI | **Partial** | Render throws crash entire tab. No graceful degradation |
| Retry actions available | **Yes** | CSV import retry button. Ingestion exponential backoff. Hub inline re-execution |
| Partial write / locked file | **Yes** | EventBridge emits coded error responses. FileSystemClient checks existence before update |

### 10) Documentation & Contract Hygiene — 88%

| Item | Status | Notes |
|------|--------|-------|
| Event Catalog is SoT for semantics | **Yes** | `CATALOG_DATA` in `catalog.ts` + file-driven entries = unified view |
| UI links to documentation | **Yes** | 53 component docs, 33 use-case docs, 10 flow docs. Cross-references in all detail views |
| EventBus contract synced | **Yes** | `FlowtiEventMap` is typed. Per-domain `events.ts` files = code-level contracts |
| Store model spec | **Partial** | State interfaces (`CatalogState`, `HubState`, `CsvViewState`) typed but not formally documented outside code |

### 11) Testability — 75%

| Item | Status | Notes |
|------|--------|-------|
| Stores have unit tests | **Partial** | Domain services tested (9/11). UI orchestrator state logic tested via view tests. No dedicated "store" tests |
| Command handlers have tests | **Yes** | Service-level tests verify command → event chains (SubscriptionService, EventDefinitionService, etc.) |
| Log pause/resume tested | **No** | EventLogView behavior tests not yet created |
| Subscription editor validation tested | **Yes** | SubscriptionService CRUD tested. Form validation gates not tested at UI level |
| Core scenarios as regression | **Yes** | 10 flow integration tests covering all documented user journeys |

### 12) Refactor Safety — 50%

| Item | Status | Notes |
|------|--------|-------|
| No slot name changes without migration | **No formal process** | `buildSplitLayout()` slot names changed informally |
| No command/event name changes without contract update | **No formal process** | FlowtiEventMap is typed (compile-time safety) but no versioning |
| Payloads extended only additively | **Yes** | TypeScript interfaces enforce additive-only changes at compile time |
| No new direct service calls in UI | **No formal gate** | [[TD-42 Direct service calls bypass EventBus]] shows this has already happened |
| UI Composition Map updated on UI changes | **Partial** | Frontend Architecture.md maintained, but not enforced per PR |

### Tech Debt References

| Checklist Gap | TD Item |
|---------------|---------|
| Direct service calls bypass EventBus | [[TD-42 Direct service calls bypass EventBus]] |
| No correlation/causation IDs | [[TD-43 No correlation IDs in domain events]] |
| No list virtualization | [[TD-44 No list virtualization]] |
| View state not persisted | [[TD-45 View state not persisted]] |
| No error boundaries | [[TD-46 No error boundaries in views]] |
| Dedup not visible | [[TD-47 Dedup not visible to users]] |
| CSV parsing blocks UI | [[TD-48 CSV parsing blocks UI thread]] |

### Convention Decisions (Intentional Divergences)

| Checklist Item | Current State | Decision |
|----------------|--------------|----------|
| Payload properties snake_case | Consistently camelCase across 155+ events | **Keep camelCase** — TypeScript standard. Changing would break all consumers |
| Formal Store classes with selectors | Orchestrator-owned state with `getState()`/`setState()` | **Keep current pattern** — works well for Obsidian plugin scale. Formal stores add abstraction without clear benefit |
