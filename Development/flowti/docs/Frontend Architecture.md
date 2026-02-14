# Frontend Architecture

This document describes the current frontend architecture of the Flowti IBDE Obsidian plugin, its design principles, view inventory, and a tech debt assessment with refactoring targets.

---

## Design Principles

1. **EventBus-first** — All inter-layer communication flows through a typed EventBus. Views emit commands, services emit facts. Direct service calls from UI are limited to read-only queries and operation triggers.

2. **Event Catalog as self-documentation** — The application documents itself by registering its events, services, domains, commands, and flows in the Event Catalog. Users document their own domain by using the application.

3. **Domain Hubs** — The application is organized around domains. Each hub provides focused interfaces that support the user's jobs to be done.

4. **Orchestrator + Component pattern** — Complex views are split into a thin Obsidian `ItemView` orchestrator (lifecycle, state, scanning, navigation) and plain TypeScript component classes (rendering). Components receive dependencies via injection, not inheritance.

5. **File-driven entities** — Domains, services, flows, systems, actors, and products are defined as Markdown files with typed frontmatter. The catalog merges file-driven entries with code-registered metadata to produce a unified view.

6. **Obsidian-native styling** — All UI uses Obsidian's CSS variables for theming (dark/light mode). Custom classes use the `ft-` prefix to avoid collisions.

---

## Layer Overview

```
src/
├── infrastructure/     # EventBus, EventBridge, Logger, FileSystem, Commands, Views, Errors
├── domain/             # 10 bounded contexts, each with types.ts, events.ts, and *Service.ts
│   ├── dataExchange/   # CSV import/export, pipelines, type docs
│   ├── discovery/      # Vault scanning for user-defined events
│   ├── eventDefinition/# Custom event mapping rules
│   ├── eventFilter/    # Hidden event types
│   ├── eventNotify/    # Notification preferences
│   ├── ingestion/      # File monitoring, job queue, catch-up
│   ├── installer/      # First-run wizard steps
│   ├── settings/       # Plugin configuration persistence
│   ├── subscription/   # Event watchers with filters
│   ├── user/           # User identity
│   └── docs/           # Path resolution + content generation (pure functions)
├── ui/                 # All presentation code
│   ├── catalog/        # Event Catalog tab components (10 files)
│   ├── hub/            # Data Exchange Hub tab components (9 files)
│   └── *.ts            # Views, modals, shared utilities
├── utils/              # Shared helpers (glob, persistence, types)
└── main.ts             # Plugin orchestrator, service wiring, view registration
```

### Communication Flow

```
User Action → View Component → EventBus (command) → Domain Service → EventBus (event) → View Component (re-render)
```

Views read state via `deps.getState()` and write via `deps.setState(partial)`. The orchestrator debounces re-renders with `scheduleRender()` (16ms).

---

## View Inventory

### Obsidian ItemView Subclasses

| View | Type Constant | LOC | Layout | Purpose |
|------|--------------|-----|--------|---------|
| `EventCatalogView` | `flowti-event-catalog` | ~825 | master-detail | 8-tab catalog: Dashboard, Domains, Services, Events, Flows, Systems, Actors, Products |
| `DataExchangeHubView` | `flowti-data-exchange-hub` | ~485 | master-detail | 7-page hub: Dashboard, Imports, Exports, Reports, Properties, Pipelines, Types |
| `EventLogView` | `flowti-event-log` | ~600 | log list | Activity feed with category/type filters and subscribed/all modes |
| `ExportView` | `flowti-export` | ~1,355 | wizard stepper | 4-page export wizard: View Select, Configure, Preview, Result |
| `CsvActionView` | `flowti-csv` | ~2,190 | landing + wizard | CSV file handler: column preview landing page + 4-page inline import wizard |
| `ComponentShowcaseView` | `flowti-component-showcase` | ~300 | showcase | Development view for previewing all CSS components |

### Modals

| Modal | LOC | Purpose |
|-------|-----|---------|
| `EventConfigModal` | ~630 | Per-event config hub (3 pages: overview, subscription form, definition form) |
| `PipelineSourceModal` | ~470 | Add/edit CSV sources within import pipelines |
| `InstallerWizardModal` | ~400 | First-run setup wizard (4 pages: Welcome, Review, Progress, Complete) |
| `SubscriptionManagerModal` | ~190 | Manage all event subscriptions (list + form pages) |
| `ConfirmModal` | ~40 | Simple confirmation dialog |
| `InputModal` | ~60 | Single text input dialog |
| `CreateEventModal` | ~70 | Event creation with name + category |
| `ConfigChooserModal` | ~30 | Fuzzy-searchable config picker (`FuzzySuggestModal`) |
| `FilePickerModal` | ~40 | Fuzzy-searchable file picker with extension filter |
| `FolderPickerModal` | ~70 | Fuzzy-searchable folder picker with create-on-type |

### Component Architecture (Decomposed Views)

Both major views follow the **orchestrator + component** pattern:

**Event Catalog** (`src/ui/catalog/`):
- `CatalogDashboard` — Stats grid, quick actions, recent activity
- `DomainsTab`, `ServicesTab` — Hybrid file + catalog entity scanning
- `EventsTab` — Category tree, event list, per-event detail with config counts
- `FlowsTab`, `SystemsTab`, `ActorsTab`, `ProductsTab` — File-driven entity management

**Data Exchange Hub** (`src/ui/hub/`):
- `HubDashboard` — Pipeline summary, config tables, unconfigured CSV list
- `ImportsTab`, `ExportsTab` — Saved config management with inline execution
- `PipelinesTab` — Multi-source import pipeline builder
- `TypesTab` — Note type documentation with CRUD lifecycle events
- `PropertiesTab` — Data dictionary with cross-config usage tracking
- `ReportsTab` — CSV file documentation browser

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

**`catalog/helpers.ts`** (~545 LOC):
- `buildSplitLayout()` — creates the dashboard + master/detail DOM structure used by both orchestrators
- `createEntityDoc()` — generic entity document creation (used by all 6 catalog tabs)
- `openOrCreateEventDoc()` — finds existing event doc or creates from template
- `renderSubscriptionForm()` / `renderSubscriptionRow()` — subscription UI shared between `EventConfigModal` and `SubscriptionManagerModal`
- Category ordering, entity scanning, cross-reference helpers

**`hub/helpers.ts`** (~253 LOC):
- `renderStepBar()` — generic wizard stepper bar shared between `CsvActionView` and `ExportView`
- `renderConfigDropdown()` — config save/load dropdown shared between `CsvActionView` and `ExportView`
- `openEventInCatalog()` — cross-view navigation to Event Catalog
- `renderDashboardSectionHeader()`, `renderEmptyDetail()`, `renderConfigDropdown()` — common hub UI patterns

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

7 domain services persist state via shared helpers in `src/utils/persistence.ts`:

```typescript
loadStateFromStorage<T>(storage, key): Promise<T | undefined>
saveStateToStorage<T>(storage, key, state): Promise<void>
```

Each service uses a unique storage key (`"subscriptions"`, `"eventDefinition"`, `"installer"`, etc.) within a shared `IStorageProvider`. The `load()` method must be called in `onLayoutReady()` to prevent the dual-state bug where default state overwrites persisted data.

---

## Navigation

### Within-View Navigation

Orchestrators expose navigation callbacks via the `deps.navigation` object:

- **Event Catalog**: `navigateToTab(tab)`, `navigateToDomain(name)`, `navigateToEvent(type)`, etc.
- **Data Exchange Hub**: `navigateTo(page)`, `showImportConfig(id)`, `openCsvImport(path)`, etc.

Tab switching is implemented by toggling DOM visibility and re-rendering the active tab.

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
```

---

## EventBus

### Scale

The `FlowtiEventMap` type union contains **~98 events** across 10 domains:

| Domain | Events | Examples |
|--------|--------|---------|
| Plugin Lifecycle | 5 | `plugin.loading`, `plugin.ready`, `plugin.unloaded` |
| File Operations | 11 | `file.create.request`, `file.created`, `file.modified` |
| Frontmatter | 6 | `frontmatter.get.request`, `frontmatter.update.response` |
| Workspace | 3 | `workspace.leaf-changed`, `workspace.file-opened` |
| Data Exchange | 15 | `dataExchange.import.execute`, `dataExchange.export.completed` |
| Ingestion | 11 | `ingestion.job.enqueued`, `ingestion.job.completed` |
| Event Definition | 8 | `eventDefinition.create`, `eventDefinition.loaded` |
| Subscription | 8 | `subscription.create`, `subscription.loaded` |
| Settings | 7 | `settings.loaded`, `settings.changed` |
| Discovery | 5 | `discovery.loaded`, `discovery.updated` |
| User / Installer | 8 | `user.created`, `installer.step.completed` |
| Logging / Errors | 4 | `log.entry`, `error.occurred` |

### Conventions

- **Naming**: `domain.action` for commands, `domain.fact` for events
- **System tags**: Infrastructure events tagged `["system"]`, filterable in catalog
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

## Tech Debt Assessment

### Resolved

The following items were addressed in the Feb 2026 frontend refactoring:

| Item | Resolution |
|------|-----------|
| **TD-3**: No shared layout system | `buildSplitLayout()` in `catalog/helpers.ts` creates the dashboard + master/detail DOM structure. CSS classes `ft-view-root`, `ft-view-dashboard`, `ft-view-split` replace inline styles. Both orchestrators now use the shared builder. |
| **TD-4**: Inline styles in component code | ~170 inline `style.*` assignments replaced with CSS utility classes (`ft-icon-muted`, `ft-flex-shrink-0`, `ft-cursor-pointer`, `ft-flex-1`, etc.). Remaining ~300 inline styles are lower-frequency patterns (border, padding, display, margin) with more variation. |
| **TD-5**: Subscription form duplication | `renderSubscriptionForm()` and `renderSubscriptionRow()` extracted to `catalog/helpers.ts`. Both `EventConfigModal` (~630 LOC, down from ~760) and `SubscriptionManagerModal` (~190 LOC, down from ~310) use the shared functions. |
| **TD-6**: Duplicated navigation logic | `openOrCreateEventDoc()`, `openEventInCatalog()`, and `createEntityDoc()` consolidated into shared helpers. All 6 catalog tabs use the generic `createEntityDoc()` instead of per-tab copies. |

### Partially Resolved

| Item | What was done | What remains |
|------|--------------|-------------|
| **TD-1**: `ExportView` monolith (~1,355 LOC) | Stepper bar and config dropdown extracted to shared `renderStepBar()` and `renderConfigDropdown()` in `hub/helpers.ts`. | Page components (view select, configure, preview, result) still inline. Property grid and preview table extraction is a follow-up. |
| **TD-2**: `CsvActionView` monolith (~2,190 LOC) | Same stepper and config dropdown extraction. | Landing page, wizard pages, column preview, and data snapshot table still inline. Full decomposition into `src/ui/csv/` components is a dedicated follow-up. |

### Remaining

### TD-7: No component-level testing for UI

**Problem**: The 679 tests cover domain services, EventBus behavior, and utility functions. No tests exercise view rendering or component output.

**Impact**: UI regressions are caught only by manual testing.

**Target**: Add lightweight unit tests for tab components by injecting mock deps and asserting DOM output (using the existing `obsidian-stub` polyfills for `HTMLElement.createDiv`, `createSpan`, etc.).

### TD-8: Scanner duplication between Catalog and Hub

**Problem**: Catalog tabs use `entityScanner.ts` for file-driven entity scanning. Hub tabs (`TypesTab`, `ReportsTab`) implement their own scanning logic in the orchestrator (`scanTypeDocs()`, `scanCsvDocs()`).

**Impact**: Two different scanning patterns for the same fundamental operation (read folder → parse frontmatter → build entries).

**Target**: Generalize `entityScanner.ts` or create a shared `folderScanner` utility that both catalog and hub tabs can use. Note: Hub tabs are storage-driven (not file-driven), so `entityScanner` doesn't directly apply. Low ROI.

---

## Refactoring Priorities

Remaining items ordered by impact and difficulty:

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| 1 | TD-2: CsvActionView full decomposition | High | High — largest monolith, import logic duplication |
| 2 | TD-1: ExportView full decomposition | Medium | Medium — follows established hub pattern |
| 3 | TD-4: Remaining ~300 inline styles | Low | Low — lower-frequency patterns with more variation, incremental |
| 4 | TD-7: Component-level tests | High | High — long-term quality, but large investment |
| 5 | TD-8: Scanner generalization | Low | Low — small deduplication win, hub tabs are storage-driven |

Each refactoring phase should leave the codebase buildable and test-passing, following the same incremental approach used for the Event Catalog and Data Exchange Hub decompositions.
