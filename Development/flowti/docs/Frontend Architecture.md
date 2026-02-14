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
| `EventCatalogView` | `flowti-event-catalog` | ~850 | master-detail | 8-tab catalog: Dashboard, Domains, Services, Events, Flows, Systems, Actors, Products |
| `DataExchangeHubView` | `flowti-data-exchange-hub` | ~520 | master-detail | 7-page hub: Dashboard, Imports, Exports, Reports, Properties, Pipelines, Types |
| `EventLogView` | `flowti-event-log` | ~600 | log list | Activity feed with category/type filters and subscribed/all modes |
| `ExportView` | `flowti-export` | ~1,440 | wizard stepper | 4-page export wizard: View Select, Configure, Preview, Result |
| `CsvActionView` | `flowti-csv` | ~2,290 | landing + wizard | CSV file handler: column preview landing page + 4-page inline import wizard |
| `ComponentShowcaseView` | `flowti-component-showcase` | ~300 | showcase | Development view for previewing all CSS components |

### Modals

| Modal | LOC | Purpose |
|-------|-----|---------|
| `EventConfigModal` | ~760 | Per-event config hub (3 pages: overview, subscription form, definition form) |
| `PipelineSourceModal` | ~470 | Add/edit CSV sources within import pipelines |
| `InstallerWizardModal` | ~400 | First-run setup wizard (4 pages: Welcome, Review, Progress, Complete) |
| `SubscriptionManagerModal` | ~310 | Manage all event subscriptions (list + form pages) |
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
- **Utility classes**: Flexbox (`ft-flex`, `ft-gap-*`), spacing (`ft-p-*`, `ft-m-*`), typography (`ft-text-sm`, `ft-text-muted`, `ft-heading-*`)
- **View header override**: Catalog and Hub views hide Obsidian's default view header via `.workspace-leaf-content[data-type="flowti-*"] .view-header { display: none; }`

---

## Tech Debt Assessment

### TD-1: `ExportView` is a monolith (~1,440 LOC)

**Problem**: Single file containing 4 wizard pages, column scanning, preview rendering, conflict resolution, and native save dialog logic. No component decomposition.

**Impact**: Hard to modify individual pages. Duplicates patterns already extracted in the hub's `ExportsTab`.

**Target**: Decompose into page components following the hub pattern, or consolidate with `ExportsTab` if the standalone wizard is no longer needed.

### TD-2: `CsvActionView` is a monolith (~2,290 LOC)

**Problem**: Largest single view file. Contains a landing page, a full 4-page import wizard, column preview logic, and inline config management. The import wizard duplicates much of `ImportsTab`.

**Impact**: Changes to import flow must be synchronized across two implementations.

**Target**: Extract landing page and wizard pages into components under `src/ui/csv/`. Share import wizard logic with `ImportsTab` where possible.

### TD-3: No shared layout system

**Problem**: Each view manually creates its own DOM structure (top bar, master panel, detail panel, footer). The master-detail layout is reimplemented in every tab.

**Impact**: Layout inconsistencies between views. Changes to spacing or responsive behavior require edits across many files.

**Target**: Create a lightweight `Layout` utility that generates standard slot structures (`header`, `master`, `detail`, `footer`) from a configuration object. Views and tabs call `Layout.masterDetail(containerEl)` instead of manual DOM construction.

### TD-4: Inline styles in component code

**Problem**: Components frequently set styles directly on elements (e.g., `el.style.flex = "1"`, `el.style.opacity = "0.5"`, `el.style.flexShrink = "0"`). This scatters presentation logic across TypeScript files.

**Impact**: Harder to maintain consistent styling. Cannot be overridden by themes or user CSS snippets.

**Target**: Move repeated inline styles to CSS classes in `styles.css`. Reserve `el.style` for truly dynamic values (e.g., computed widths).

### TD-5: `EventConfigModal` complexity (~760 LOC)

**Problem**: Three-page modal with subscription form, event definition form, and overview page. Manages its own state and EventBus subscriptions independently from the catalog orchestrator.

**Impact**: State can drift between the modal and the catalog view. Form validation and save logic is tightly coupled to modal lifecycle.

**Target**: Extract each page into its own component class, following the same pattern used for catalog tabs. Share form components with `SubscriptionManagerModal`.

### TD-6: Duplicated cross-view navigation logic

**Problem**: The "find existing leaf or create new one" pattern is copy-pasted in multiple views (`EventCatalogView`, `DataExchangeHubView`, `SubscriptionManagerModal`).

**Impact**: Inconsistent leaf placement (some use `getLeaf(true)`, others `getRightLeaf(false)`).

**Target**: Extract a shared `openOrRevealView(workspace, viewType, onReady)` utility function.

### TD-7: No component-level testing for UI

**Problem**: The 679 tests cover domain services, EventBus behavior, and utility functions. No tests exercise view rendering or component output.

**Impact**: UI regressions are caught only by manual testing.

**Target**: Add lightweight unit tests for tab components by injecting mock deps and asserting DOM output (using the existing `obsidian-stub` polyfills for `HTMLElement.createDiv`, `createSpan`, etc.).

### TD-8: Scanner duplication between Catalog and Hub

**Problem**: Catalog tabs use `entityScanner.ts` for file-driven entity scanning. Hub tabs (`TypesTab`, `ReportsTab`) implement their own scanning logic in the orchestrator (`scanTypeDocs()`, `scanCsvDocs()`).

**Impact**: Two different scanning patterns for the same fundamental operation (read folder → parse frontmatter → build entries).

**Target**: Generalize `entityScanner.ts` or create a shared `folderScanner` utility that both catalog and hub tabs can use.

---

## Refactoring Priorities

The items above are ordered by impact and difficulty:

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| 1 | TD-3: Shared layout system | Medium | High — enables consistent structure everywhere |
| 2 | TD-6: Shared navigation utility | Low | Medium — removes duplication, fixes consistency |
| 3 | TD-4: Inline styles → CSS classes | Low | Medium — incremental, can be done per-file |
| 4 | TD-2: CsvActionView decomposition | High | High — largest monolith, import logic duplication |
| 5 | TD-1: ExportView decomposition | Medium | Medium — follows established hub pattern |
| 6 | TD-8: Scanner generalization | Low | Low-Medium — small deduplication win |
| 7 | TD-5: EventConfigModal decomposition | Medium | Medium — complexity management |
| 8 | TD-7: Component-level tests | High | High — long-term quality, but large investment |

Each refactoring phase should leave the codebase buildable and test-passing, following the same incremental approach used for the Event Catalog and Data Exchange Hub decompositions.
