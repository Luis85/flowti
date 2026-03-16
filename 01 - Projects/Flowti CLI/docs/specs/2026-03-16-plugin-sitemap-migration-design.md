# Plugin Sitemap Migration — Design Spec

> **Date:** 2026-03-16
> **Status:** Approved
> **Scope:** Full migration of all Flowti Plugin views from legacy BaseHubView to sitemap-driven SitemapHubView + Lit components

## Goal

Replace all 14 remaining legacy views in the Flowti Plugin with sitemap-driven declarative views backed by Lit web components. The TestManagement hub migration (already complete) serves as the reference pattern. This migration eliminates the legacy BaseHubView subclass proliferation, centralizes view/command/ribbon registration through SitemapBootstrap, introduces scoped CSS via Lit, and positions the Plugin for eventual CLI integration.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | Full migration — all 14 legacy views | Clean break from BaseHubView; no partial legacy maintenance |
| Sequence | Hubs first, leaf/panels after | Hubs exercise the full tab + handler + Lit pipeline |
| Behavioral changes | Refactor + cleanup + enhance | Remove dead weight, leverage refreshEvents + conditions |
| Bootstrap strategy | Full takeover of main.ts | Single registration path; legacy passthrough via `"legacy": true` flag |
| CSS approach | Dedicated pass per chunk | Each chunk leaves zero inline styles in new code |
| Condition registration | All upfront, validated per-migration | Conditions work immediately; correctness verified as hubs migrate |
| Deprecated views | Drop component-showcase + event-log | No longer needed |
| Leaf/panel approach | Case-by-case per view | No blanket rule; each assessed during implementation |

## Architecture

### Registration Flow (Post-Migration)

```
plugin-sitemap.json
        │
        ▼
  SitemapBootstrap.registerAll()
        │
        ├── registerViews()
        │     ├── legacy: true  → legacyViewFactories.get(type)  [temporary, shrinks per chunk]
        │     └── tabs defined  → new SitemapHubView(leaf, eventBus, viewDef, handlerRegistry)
        │     └── component     → new SitemapLeafView(leaf, viewDef, handlerRegistry)
        │
        ├── registerCommands()
        │     ├── with conditions → checkCallback via ConditionEvaluator
        │     └── without        → direct callback via ActionHandler
        │
        └── registerRibbon()
              └── action → handler lookup or view:type open
```

### Component Architecture

```
┌─────────────────────────────────────────────┐
│ SitemapHubView (generic, sitemap-driven)     │
│  ├── reads ViewDef (tabs, refreshEvents)     │
│  ├── subscribes to refreshEvents             │
│  └── delegates tab rendering to handlers     │
│       │                                      │
│       ▼                                      │
│  PluginHandlerRegistry                       │
│  ├── TabHandler  → creates Lit component     │
│  │                  sets props from service   │
│  │                  wires CustomEvents        │
│  ├── ActionHandler → emits EventBus events   │
│  ├── ConditionHandler → boolean from service  │
│  └── DataSourceHandler → data for components  │
│       │                                      │
│       ▼                                      │
│  Lit Components (pure renderers)             │
│  ├── extend FlowtiElement                    │
│  ├── receive data via reactive properties    │
│  ├── emit CustomEvents for user actions      │
│  └── use scoped CSS (design tokens)          │
└─────────────────────────────────────────────┘
```

### Key Principle

**Handlers are the glue.** They own service interaction and state preparation. Lit components are stateless renderers that receive data as properties and emit CustomEvents for user actions. Components never import services or touch the Obsidian API.

## Chunk Structure

8 sequential chunks. Each chunk leaves the full test suite green (7,744+ tests passing, zero source TS errors).

### Chunk 0: Foundation — SitemapBootstrap Takeover

**Goal:** Replace all manual registration in main.ts with SitemapBootstrap. Register all conditions and action handlers. Drop deprecated views.

**Changes:**

1. **main.ts overhaul** — replace all manual `registerView()`, `addCommand()`, `addRibbonIcon()` calls with `SitemapBootstrap.registerAll()`. Legacy view factories collected into `legacyViewFactories` Map. Estimated ~200-300 LOC reduction.

2. **Condition handlers** — new file `src/infrastructure/handlers/condition-handlers.ts`:
   - `no-active-train` → TrainService running/paused check
   - `train-not-paused` → TrainService pause state
   - `train-not-running` → TrainService running state
   - `no-active-session` → SessionService active session check
   - `session-not-paused` → SessionService pause state
   - `is-installed` → InstallerService completion flag

3. **Action handlers** — new file `src/infrastructure/handlers/action-handlers.ts`:
   - ~37 command action handlers (`hub:open-*`, `view:open-*`, `capture:*`, `train:*`, `session:*`, `data-exchange:*`, `journey:*`, `canvas:*`, `installer:*`)
   - Thin wrappers emitting the same events as current manual callbacks

4. **Drop deprecated views** — remove component-showcase and event-log from:
   - `plugin-sitemap.json` (views, commands, ribbon entries)
   - Source files (`ComponentShowcaseView.ts`, `EventLogView.ts`)

5. **Startup validation** — SitemapBootstrap logs handler coverage gaps at startup

**Tests:**
- SitemapBootstrap integration: all 13 views registered, all commands bound, all ribbon items
- Each condition handler: correct boolean for given service state
- Each action handler: correct event emitted
- Negative: component-showcase and event-log view types not registered

### Chunk 1: TrainHub Migration

**Goal:** Migrate TrainHub from legacy BaseHubView to SitemapHubView + Lit.

**New files:**
- `src/components/train/flowti-train-dashboard.ts` — overview card (active train status, paused callout, stat grid)
- `src/components/train/flowti-train-active.ts` — active/paused train list with detail panel, type filter, sort dropdown
- `src/components/train/flowti-train-history.ts` — completed trains list with detail panel
- `src/infrastructure/handlers/train-handlers.ts` — `registerTrainHandlers(registry, deps)`
- `tests/components/train/*.test.ts` — component unit tests
- `tests/infrastructure/handlers/train-handlers.test.ts` — handler registration tests

**Sitemap update:**
```json
"train-hub": {
    "kind": "hub",
    "label": "Train Hub",
    "icon": "train-front",
    "type": "flowti-train-hub",
    "tabs": [
        { "id": "active", "label": "Active", "icon": "play", "handler": "train:active", "searchPlaceholder": "Search trains..." },
        { "id": "history", "label": "History", "icon": "archive", "handler": "train:history", "searchPlaceholder": "Search history..." }
    ],
    "refreshEvents": [
        "train.started", "train.paused", "train.resumed",
        "train.completed", "train.deleted", "train.renamed",
        "train.thought.added"
    ]
}
```

**Special behavior:**
- Top-bar dropdowns (type filter, sort) become reactive properties inside Lit components
- Multi-card callouts (running, paused, start-a-ride) rendered by `flowti-train-active.ts`
- All inline styles → Lit scoped CSS

**Deleted:** `src/ui/train/TrainHubView.ts`

### Chunk 2: EventCatalog Migration

**Goal:** Migrate EventCatalog from legacy BaseHubView to SitemapHubView + Lit.

**New files:**
- `src/components/catalog/flowti-catalog-events.ts` — hierarchical category tree, dot legend, settings panel, expand/collapse
- `src/components/catalog/flowti-catalog-domains.ts` — domain entity scanner, master/detail
- `src/components/catalog/flowti-catalog-services.ts` — service entity scanner, master/detail
- `src/components/catalog/flowti-catalog-flows.ts` — flow entity scanner, master/detail + cross-references
- `src/components/catalog/flowti-catalog-systems.ts` — system entity scanner, master/detail
- `src/components/catalog/flowti-catalog-actors.ts` — actor entity scanner, master/detail
- `src/infrastructure/handlers/catalog-handlers.ts` — `registerCatalogHandlers(registry, deps)`
- Tests for all components + handlers

**Special behavior:**
- Category tree rendering with collapse state preserved via component internal state
- Dot legend (hidden/configured/followed) — reactive property with click toggles
- Settings panel visibility tied to Events tab only
- Entity scanners share a common `flowti-entity-scanner.ts` base component (DRY across 5 tabs)
- Tab count badges via handler setting component props with scan results

**Deleted:** `src/ui/catalog/EventCatalogView.ts` + associated tab files

### Chunk 3: DataExchangeHub Migration

**Goal:** Migrate DataExchangeHub (most tabs: 8) from legacy to SitemapHubView + Lit.

**New files:**
- `src/components/data-exchange/flowti-dx-dashboard.ts` — overview with active operation status
- `src/components/data-exchange/flowti-dx-imports.ts` — import config CRUD, source picker, validation
- `src/components/data-exchange/flowti-dx-exports.ts` — export config CRUD, format selection, column picker
- `src/components/data-exchange/flowti-dx-pipelines.ts` — pipeline config, preview, execution
- `src/components/data-exchange/flowti-dx-types.ts` — TypeDoc metadata catalog, validation
- `src/components/data-exchange/flowti-dx-properties.ts` — data dictionary browser
- `src/components/data-exchange/flowti-dx-signals.ts` — signal subscription list
- `src/components/data-exchange/flowti-dx-reports.ts` — CsvDoc metadata catalog
- `src/components/data-exchange/flowti-dx-canvas.ts` — canvas import config
- `src/infrastructure/handlers/data-exchange-handlers.ts` — `registerDataExchangeHandlers(registry, deps)`
- Tests for all components + handlers

**Special behavior:**
- Active operations tracking — handler deps include an operation tracker; components receive operation state as props and render progress bars; 5s auto-cleanup via handler timer
- Live listener cleanup — handlers set up operation progress listeners; cleanup on next tab render (container emptied)
- Scanning pipelines (CSV, Base, TypeDoc, ReportDoc, Property) — run in handlers, results passed as props
- Modal workflows (file picker, folder picker) — handler opens modal, resolves promise, updates component props
- Cross-tab state (editingImportId, etc.) — managed in handler deps, reset on tab change

**Deleted:** `src/ui/hub/DataExchangeHubView.ts` + associated tab files (~2,000 LOC)

### Chunk 4: UserHub Migration

**Goal:** Migrate UserHub (5 tabs + dashboard, most services: 8) from legacy to SitemapHubView + Lit.

**New files:**
- `src/components/user/flowti-user-dashboard.ts` — welcome callout, cross-hub cards, inbox preview, active session card
- `src/components/user/flowti-user-sessions.ts` — session master/detail, timer display, action buttons
- `src/components/user/flowti-user-inbox.ts` — inbox master/detail, read/unread state, actions
- `src/components/user/flowti-user-commands.ts` — searchable command catalog
- `src/components/user/flowti-user-preferences.ts` — 4 preference sub-panels (sources, session, train, nudge)
- `src/components/user/flowti-user-health.ts` — health scanner dashboard (reuses entity scanner pattern from Chunk 2)
- `src/infrastructure/handlers/user-handlers.ts` — `registerUserHandlers(registry, deps)`
- Tests for all components + handlers

**Special behavior:**
- Health scanners reuse the entity scanner Lit component from Chunk 2
- Session timer tick — handler subscribes to `session.timer.tick`, updates component prop directly (no full re-render)
- Template export/import — handler manages blob download / file picker, not the component
- Selection preservation — handler tracks selected inbox/session ID, passes as prop

**Deleted:** `src/ui/userHub/UserHubView.ts` + sub-components (~591+ LOC)

### Chunk 5: AnalyticsHub Migration

**Goal:** Migrate AnalyticsHub (3 tabs, highest complexity) from legacy to SitemapHubView + Lit.

**New files:**
- `src/components/analytics/flowti-analytics-dashboard.ts` — dashboard grid with tile rendering
- `src/components/analytics/flowti-analytics-queries.ts` — query builder (source panel, columns, filters, sort, results preview)
- `src/components/analytics/flowti-analytics-measurements.ts` — measurement CRUD master/detail
- `src/components/analytics/flowti-analytics-tile.ts` — individual tile renderer (chart/table/stat card variants)
- `src/infrastructure/handlers/analytics-handlers.ts` — `registerAnalyticsHandlers(registry, deps)`
- Tests for all components + handlers

**Special behavior:**
- TileResultCache — lives in handler deps, passed to dashboard component. Cache invalidation on refreshEvents.
- Query builder — single large Lit component managing sub-panels internally. Handler passes source lists + saved queries as props.
- Breadcrumbs + navigation — dashboard drill-down history managed as component internal state
- File watcher — handler subscribes to CSV change events, invalidates tiles, triggers component re-render
- Top bar actions (New Query, New Dashboard) — become action handlers in sitemap commands, open modals from handler layer

**Deleted:** `src/ui/analytics/AnalyticsHubView.ts` + tab files (~2,170 LOC)

### Chunk 6: Leaf/Panel Views

**Goal:** Migrate remaining 7 leaf/panel views. Each assessed case-by-case.

**New generic infrastructure:**
- `SitemapLeafView` — lightweight generic view that mounts a Lit component or delegates to a handler. Parallel to SitemapHubView but for non-tabbed views.

**Sitemap schema extension:**
```json
{
    "kind": "leaf",
    "type": "flowti-journey-file",
    "component": "flowti-journey-file-view",
    "handler": "journey:file-view",
    "refreshEvents": ["journey.updated"]
}
```

**Views to migrate** (approach determined per-view during implementation):
- `session-workspace` (625 LOC, 10+ panels) — likely view shell + Lit panels
- `train-main` (843 LOC, graph nav, breadcrumbs) — likely view shell + Lit panels
- `train-timeline` (~300 LOC) — likely full Lit component
- `csv-action` (782 LOC, mapping builder) — likely view shell + Lit panels
- `canvas-import` (540 LOC) — assessed at implementation time
- `export` (689 LOC, job orchestrator) — assessed at implementation time
- `journey-builder` — assessed at implementation time
- `journey-file` (156 LOC) — likely full Lit component

**CSS pass:** Same as hubs — scoped CSS in new Lit components, utility classes for view shells.

### Chunk 7: Cleanup

**Goal:** Remove all migration scaffolding and finalize.

**Changes:**
- Delete `BaseHubView` if fully unused (all subclasses removed)
- Remove `legacyViewFactories` Map from SitemapBootstrapDeps (no more legacy views)
- Remove `"legacy"` field support from SitemapBootstrap (dead code)
- Final CSS audit — grep for `style=` in `src/components/`, expect zero hits
- Update TD-129 with new inline style count
- Update architecture docs (Frontend Architecture.md, Backend Architecture.md)

**Tests:**
- Verify no references to deleted legacy classes
- Verify `style=` count in components is zero
- Full flow test suite green

## CSS Strategy

### Design Tokens

Extend existing FlowtiElement token set:

```css
/* Spacing */
--ft-space-xs: 4px;  --ft-space-sm: 8px;  --ft-space-md: 16px;
--ft-space-lg: 24px; --ft-space-xl: 32px;

/* Colors (inherit Obsidian theme) */
--ft-color-success; --ft-color-warning; --ft-color-error;
--ft-color-muted; --ft-color-info;

/* Typography */
--ft-font-sm; --ft-font-mono;

/* Layout */
--ft-radius; --ft-border; --ft-shadow; --ft-grid-gap;
```

### Shared Styles

`src/components/shared-styles.ts` — importable by any Lit component:
- Master/detail split layout
- Status badge variants (success, warning, error, muted, info)
- Stat card grid
- Empty state pattern (icon + message + optional action)
- Search/filter bar

### Per-Component Scoped CSS

Each Lit component uses `static styles = css\`...\`` with:
- Design token references for consistency
- Shared style imports for common patterns
- Component-specific styles for unique layout
- Dynamic styles via Lit's `styleMap()` directive (computed widths, grid positions)

## Testing Strategy

### Three Layers Per Migration

1. **Lit Component Unit Tests** (`tests/components/<domain>/`):
   - Render with props, assert DOM output
   - Verify CustomEvent dispatch on user actions
   - Test loading/error/empty states from FlowtiElement
   - Test search filtering where applicable
   - No service mocks — components are pure renderers

2. **Handler Registration Tests** (`tests/infrastructure/handlers/<domain>-handlers.test.ts`):
   - Verify all tab handlers are registered
   - Verify handler creates correct Lit element with expected props
   - Verify CustomEvent listeners wire to service calls
   - Mock services, assert element creation + prop binding

3. **Flow Tests** (`tests/flows/`):
   - Existing flow tests continue passing (EventBus contract preserved)
   - Flow tests asserting on view internals updated for Lit component output
   - New flow assertions for SitemapBootstrap registration

### Quality Gates

- **No-go:** Any chunk dropping below 7,700 passing tests or introducing source TS errors gets rolled back
- **Coverage target:** 80% statements / 80% lines (existing). New components target >90%.
- **CSS audit:** Zero `style=` attributes in `src/components/` after each chunk

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SitemapBootstrap breaks existing commands | All Obsidian commands stop working | Chunk 0 startup validation logs coverage gaps. Full flow tests before Chunk 1. |
| BaseHubView lifecycle mismatch | SitemapHubView misses lifecycle quirks from legacy hubs | Each migration catalogs old lifecycle hooks and maps to Lit lifecycle |
| Event listener cleanup leaks | Wildcard listener buildup from missed unsubscribe | SitemapHubView handles refreshEvents. Tab-level listeners cleaned on container empty. |
| Inline styles deeper than expected | Dynamic computed styles can't become static CSS | Lit `styleMap()` directive. Budget extra time in Analytics (tile grid) and DataExchange (progress bars). |
| Obsidian API in view classes | Lit components can't access `this.app` | All Obsidian API calls stay in handler layer. Components receive resolved data as props. |
| Shadow DOM vs Obsidian theming | Lit Shadow DOM blocks Obsidian CSS variables | FlowtiElement base class inherits Obsidian CSS custom properties. Verify per component. |

## Out of Scope

- Plugin ↔ CLI integration (separate phase per feedback_plugin_isolation.md)
- New domain features or business logic changes
- Obsidian mobile compatibility
- Plugin marketplace submission
