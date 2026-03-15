# PA3: Component Migration — Design Spec

**Date:** 2026-03-15
**Status:** Draft
**Scope:** Flowti Plugin — migrate TestManagement hub from legacy vanilla DOM to Lit components via SitemapHubView

## Problem Statement

PA1 established the Lit component foundation (FlowtiElement base class, design tokens, storybook). PA2 created the declarative sitemap system (plugin-sitemap.json, SitemapHubView, handler registry, condition evaluator, bootstrap). All 16 views are currently `legacy: true` — still using imperative vanilla DOM rendering.

PA3 migrates the first hub (TestManagement) from legacy to Lit, proving the full pipeline: sitemap declaration → SitemapHubView → tab handlers → Lit components → data flow via properties → user actions via CustomEvents.

## Goals

1. Migrate TestManagement hub from legacy `TestManagementHubView` to `SitemapHubView`
2. Convert 5 domain tabs + dashboard to Lit components with scoped `static styles`
3. Keep 3 catalog tabs (Features, Processes, Products) as handler wrappers around existing classes
4. Add `refreshEvents` support to SitemapHubView for event-driven re-rendering
5. Establish the reusable migration pattern for all remaining hubs
6. Delete legacy view + tab classes after switchover
7. All existing 7,794+ tests pass, 120-140 new tests added

## Non-Goals

- Migrating other hubs (UserHub, AnalyticsHub, TrainHub, DataExchangeHub) — separate PAs
- Migrating catalog tab infrastructure to Lit (shared across hubs — separate effort)
- Refactoring TestManagementService or domain pure functions
- CLI SDK integration (Track B)
- Changing any visible behavior or data model

## Design

### 1. Architecture

**Migration pattern:**

```
Before (legacy):
  TestManagementHubView (extends BaseHubView)
    → creates JourneysTab, PyramidTab, etc. classes directly
    → tabs query TestManagementService internally
    → render via Obsidian DOM API (createEl, createDiv)

After (Lit):
  SitemapHubView (from PA2, driven by plugin-sitemap.json)
    → tab handlers create Lit components, fetch data, set properties
    → components render via Lit html templates with scoped static styles
    → user actions emit CustomEvents → handlers call service/eventBus
```

**Data flow (Lit best practices):**
1. Tab handler fetches data from `TestManagementService`
2. Creates Lit component, sets data as `@property()` fields
3. Component renders purely from properties — no service knowledge
4. User clicks button → component dispatches `CustomEvent` (bubbles, composed)
5. Handler catches event → calls service method or emits on EventBus
6. Domain events (e.g., `test-mgmt.journey.registered`) → SitemapHubView calls `scheduleRender()` → handler re-runs with fresh data

**Event-driven refresh:** Optional `refreshEvents` string array on `ViewDef`. SitemapHubView subscribes on open via `addUnsubscribe` (BaseHubView auto-cleanup), calls `scheduleRender()` on each event. Note: the legacy view delays `doc.created` by 500ms to let vault indexing complete — SitemapHubView's 16ms debounce is sufficient since catalog tab wrappers query the vault at render time, not subscription time.

**Settings propagation:** The legacy view extracts `docsRootPath` and `entityPaths` from `settings.loaded`/`settings.changed` payloads. In the new design, the handler registration receives a settings accessor function (e.g., `getSettings: () => FlowtiSettings`). Each handler invocation reads current settings — no stale state.

**Catalog tabs (Features, Processes, Products):** Stay as handler-path wrappers around existing vanilla DOM catalog classes. Not migrated to Lit in this PA. The handler registration receives pre-built `CatalogComponentDeps` (constructed by the caller in main.ts, same as today's `buildCatalogDeps()`), which includes `app`, `eventBus`, `getState`, navigation callbacks, `scheduleRender`, `getEntityFolder`, and `createEntity`.

**Onboarding callout:** The legacy view renders an onboarding callout via `renderOnboardingCallout()` in `onHubOpen()`. In the new design, the dashboard component receives an `onboardingVisible` boolean property. The handler checks `OnboardingService` and sets it.

**Cross-hub navigation:** BaseHubView handles `hub.navigate` events and calls `onNavigateToEntity(tabId, entityId)`. SitemapHubView gains an optional `onNavigateToEntity` callback registered via a new method. The handler registration wires this to navigate to the Journeys tab and select by name.

**Tab state resets:** The legacy `onTabChanged()` resets all tab selection states. With Lit, each handler re-creates the component on each `onTabRender` call — the component starts fresh with default `@state()` values. No explicit reset needed.

**Top bar filters:** The legacy Journeys tab renders filter dropdowns in the hub's top bar. In the Lit migration, filters move inside the `<flowti-tm-journeys>` component as internal UI (rendered above the master list). This simplifies the architecture — the component owns all its UI.

**Dashboard rendering:** BaseHubView treats the dashboard as the default view when no tab is selected. SitemapHubView's `onDashboardRender()` creates a `<flowti-tm-dashboard>` element. The dashboard is NOT listed as a tab in the sitemap — it's the implicit home screen.

**Files deleted after migration:** `TestManagementHubView.ts`, `TestManagementDashboard.ts`, `JourneysTab.ts`, `PyramidTab.ts`, `CoverageTab.ts`, `ComplianceTab.ts`, `FeatureQualityTab.ts`. CSS moves into components; `19-test-management.css` reduced to catalog-tab-only styles or deleted entirely.

### 2. Component Inventory

6 Lit components under `src/components/test-management/`:

| Component | Tag | Properties (data down) | Events (up) |
|-----------|-----|----------------------|-------------|
| `flowti-tm-dashboard` | `<flowti-tm-dashboard>` | `journeys`, `pyramid`, `recentRuns`, `onboardingVisible` | `navigate-to-tab` (tabId) |
| `flowti-tm-journeys` | `<flowti-tm-journeys>` | `journeys`, `searchText` | `run-journey`, `request-review`, `open-builder` |
| `flowti-tm-pyramid` | `<flowti-tm-pyramid>` | `pyramid`, `journeys`, `hasBaseline` | `set-baseline` |
| `flowti-tm-coverage` | `<flowti-tm-coverage>` | `coverageEntries` | (view-only) |
| `flowti-tm-compliance` | `<flowti-tm-compliance>` | `scores`, `characteristicsByStandard`, `journeys` | `add-tag`, `remove-tag` |
| `flowti-tm-feature-quality` | `<flowti-tm-feature-quality>` | `features`, `journeys` | (view-only) |

Property notes:
- `searchText` on Journeys comes from `TabContext.searchText` (BaseHubView's search input)
- `coverageEntries` is pre-computed by the handler (`service.getCoverage(service.getPrds())`) — no raw PRDs needed
- `characteristicsByStandard` is pre-grouped by the handler using the pure `getCharacteristicsByStandard()` function — component stays pure
- `features` on FeatureQuality comes from `featureQualityCalculator`; `journeys` provides linked journey details for the detail panel

All extend `FlowtiElement` (PA1 base class) for loading/error/empty states and design tokens.

Internal state via `@state()`:
- Selected item (selected journey, selected layer, selected PRD, etc.)
- Filter state (Journeys: type filter, status filter, search text)
- Expanded rows (Compliance: which characteristic is expanded)

Each component manages its own master/detail layout internally — one monolithic component per tab. Sub-components extracted later if patterns emerge.

### 3. Sitemap & Handler Wiring

**plugin-sitemap.json** update for test-management-hub:

```json
{
  "test-management-hub": {
    "kind": "hub",
    "label": "Test Management",
    "icon": "shield-check",
    "type": "flowti-test-management-hub",
    "tabs": [
      { "id": "journeys", "label": "Journeys", "icon": "route", "handler": "test-mgmt:journeys" },
      { "id": "pyramid", "label": "Pyramid", "icon": "triangle", "handler": "test-mgmt:pyramid" },
      { "id": "coverage", "label": "Coverage", "icon": "check-circle", "handler": "test-mgmt:coverage" },
      { "id": "compliance", "label": "Compliance", "icon": "shield", "handler": "test-mgmt:compliance" },
      { "id": "feature-quality", "label": "Feature Quality", "icon": "star", "handler": "test-mgmt:feature-quality" },
      { "id": "features", "label": "Features", "icon": "sparkles", "handler": "test-mgmt:features" },
      { "id": "processes", "label": "Processes", "icon": "waypoints", "handler": "test-mgmt:processes" },
      { "id": "products", "label": "Products", "icon": "package", "handler": "test-mgmt:products" }
    ],
    "refreshEvents": [
      "test-mgmt.journey.registered",
      "test-mgmt.journey.deregistered",
      "test-mgmt.journey.run-completed",
      "test-mgmt.journey.status-changed",
      "settings.loaded",
      "settings.changed",
      "doc.created",
      "doc.deleted"
    ]
  }
}
```

Key change: `legacy: true` removed. SitemapHubView renders this hub.

**ViewDef type extension:**

```typescript
// Added to existing ViewDef in plugin-sitemap-types.ts
refreshEvents?: string[];
```

**SitemapHubView enhancement:**

```typescript
onHubOpen(): void {
  if (this.viewDef.refreshEvents) {
    for (const event of this.viewDef.refreshEvents) {
      this.addUnsubscribe(
        this.eventBus.on(event as EventType, () => this.scheduleRender())
      );
    }
  }
}
```

**Handler registration** — new file `src/infrastructure/handlers/test-management-handlers.ts`:

```typescript
export interface TestManagementHandlerDeps {
  service: TestManagementService;
  onboardingService: OnboardingService;
  getSettings: () => FlowtiSettings;
  catalogDeps?: CatalogComponentDeps;  // pre-built by caller (main.ts)
  eventBus: IEventBus;
}

export function registerTestManagementHandlers(
  registry: PluginHandlerRegistry,
  deps: TestManagementHandlerDeps,
): void {
  // 5 domain tabs — create Lit component, set properties, wire events
  registry.registerTabHandler("test-mgmt:journeys", (container, ctx) => {
    container.innerHTML = "";
    const el = document.createElement("flowti-tm-journeys");
    (el as FlowtiTmJourneys).journeys = deps.service.getJourneys();
    (el as FlowtiTmJourneys).searchText = ctx.searchText ?? "";
    el.addEventListener("run-journey", (e: CustomEvent) => {
      // call service or emit eventBus event
    });
    el.addEventListener("open-builder", (e: CustomEvent) => {
      // dual emit: ui.openJourneyBuilder + journey-builder.import-requested
      void deps.eventBus.emit("ui.openJourneyBuilder", { name: e.detail.name });
      void deps.eventBus.emit("journey-builder.import-requested", { journeyName: e.detail.name });
    });
    container.appendChild(el);
  });

  // same pattern for pyramid, coverage, compliance, feature-quality
  // each handler reads fresh data from service on every invocation (no stale state)

  // 3 catalog tabs — handler wrappers around existing vanilla DOM classes
  // catalogDeps includes app, eventBus, getState, navigation callbacks, etc.
  // Products tab: scans flows/systems/actors before rendering (same as legacy)
  registry.registerTabHandler("test-mgmt:features", (container, ctx) => {
    if (!deps.catalogDeps) return;
    // delegate to existing FeaturesTab with catalog deps
  });
}
```

### 4. Testing Strategy

**Layer 1: Component tests** (`tests/components/test-management/*.test.ts`) — 6 files

Each component tested in happy-dom using PA1 test utilities:
- Renders with data → correct DOM structure
- Renders empty/loading states
- Selected item updates detail panel
- Filter state changes update master list
- CustomEvents fire with correct detail on user actions
- Progress bars, trend indicators render correctly

~15-20 tests per component, ~100 total.

**Layer 2: Handler tests** (`tests/infrastructure/handlers/test-management-handlers.test.ts`) — 1 file

- Each handler creates correct element tag
- Properties set from service data
- Event listeners wired correctly
- Catalog tab wrappers delegate to existing classes
- ~15-20 tests

**Layer 3: SitemapHubView refreshEvents** — extend existing test file

- ViewDef with refreshEvents subscribes on open
- Events trigger scheduleRender
- Unsubscribes on close
- ~3-5 new tests

**Layer 4: Integration** — extend existing sitemap integration test

- Updated sitemap validates (test-management-hub no longer legacy, has tabs + refreshEvents)
- ~1-2 new tests

**Test count estimate:** ~120-140 new tests across 8 files.

**What's NOT tested:**
- Obsidian icon rendering (mocked at boundary)
- CSS visual appearance (storybook covers that)
- Catalog tab internals (existing tests cover those)

### 5. Migration Sequence

**Phase 1: Infrastructure updates (no behavior change)**
1. Add `refreshEvents` to `ViewDef` type
2. Implement refreshEvents in `SitemapHubView.onHubOpen()`
3. Update validator to accept refreshEvents
4. Tests for all of the above

**Phase 2: Lit components (TDD, no wiring yet)**
5. `flowti-tm-dashboard` — KPI cards + mini pyramid + lists
6. `flowti-tm-pyramid` — 3 layer cards + drill-down
7. `flowti-tm-feature-quality` — feature list + detail
8. `flowti-tm-coverage` — PRD list + detail + domain bars
9. `flowti-tm-compliance` — standard cards + expandable rows + tag management
10. `flowti-tm-journeys` — filters, run history, traceability, actions (most complex)

Each component built and tested in isolation.

**Phase 3: Handler wiring**
11. Create `test-management-handlers.ts` — register 8 tab handlers (5 Lit + 3 catalog wrappers)
12. Handler tests

**Phase 4: Switchover**
13. Update `plugin-sitemap.json` — remove `legacy: true`, add `tabs` and `refreshEvents`
14. Delete legacy files: `TestManagementHubView.ts`, `TestManagementDashboard.ts`, `JourneysTab.ts`, `PyramidTab.ts`, `CoverageTab.ts`, `ComplianceTab.ts`, `FeatureQualityTab.ts`
15. Clean up `19-test-management.css`
16. Update view factory registration

**Phase 5: Verification**
17. Full `npm test` — all tests pass
18. Integration test validates updated sitemap

**Constraints:**
- Tests pass after each phase
- Phase 2 components testable in isolation before wiring
- Phase 4 is the single switchover commit

## File Inventory

### New Files

| File | Layer | Lines (est.) |
|------|-------|-------------|
| `src/components/test-management/flowti-tm-dashboard.ts` | UI | ~200 |
| `src/components/test-management/flowti-tm-journeys.ts` | UI | ~400 |
| `src/components/test-management/flowti-tm-pyramid.ts` | UI | ~250 |
| `src/components/test-management/flowti-tm-coverage.ts` | UI | ~250 |
| `src/components/test-management/flowti-tm-compliance.ts` | UI | ~450 |
| `src/components/test-management/flowti-tm-feature-quality.ts` | UI | ~200 |
| `src/infrastructure/handlers/test-management-handlers.ts` | Infrastructure | ~200 |
| `tests/components/test-management/flowti-tm-dashboard.test.ts` | Tests | ~120 |
| `tests/components/test-management/flowti-tm-journeys.test.ts` | Tests | ~150 |
| `tests/components/test-management/flowti-tm-pyramid.test.ts` | Tests | ~120 |
| `tests/components/test-management/flowti-tm-coverage.test.ts` | Tests | ~120 |
| `tests/components/test-management/flowti-tm-compliance.test.ts` | Tests | ~140 |
| `tests/components/test-management/flowti-tm-feature-quality.test.ts` | Tests | ~100 |
| `tests/infrastructure/handlers/test-management-handlers.test.ts` | Tests | ~120 |

### Modified Files

| File | Change |
|------|--------|
| `src/domain/sitemap/plugin-sitemap-types.ts` | Add `refreshEvents` to ViewDef |
| `src/ui/views/sitemap-hub-view.ts` | Implement refreshEvents in onHubOpen, add onNavigateToEntity callback |
| `src/domain/sitemap/plugin-sitemap-validator.ts` | Accept refreshEvents field |
| `plugin-sitemap.json` | Update test-management-hub declaration |
| `src/main.ts` | Update view factory registration — stop creating legacy TestManagementHubView |
| `src/infrastructure/views/registry.ts` | Remove TestManagementHubView from createViewDefinitions (if registered there) |
| `tests/ui/views/sitemap-hub-view.test.ts` | Add refreshEvents tests |
| `tests/infrastructure/sitemap/sitemap-integration.test.ts` | Validate updated sitemap |
| `tests/infrastructure/sitemap/sitemap-integration.test.ts` | Validate updated sitemap |

### Deleted Files

| File | Reason |
|------|--------|
| `src/ui/testManagement/TestManagementHubView.ts` | Replaced by SitemapHubView |
| `src/ui/testManagement/TestManagementDashboard.ts` | Replaced by flowti-tm-dashboard |
| `src/ui/testManagement/JourneysTab.ts` | Replaced by flowti-tm-journeys |
| `src/ui/testManagement/PyramidTab.ts` | Replaced by flowti-tm-pyramid |
| `src/ui/testManagement/CoverageTab.ts` | Replaced by flowti-tm-coverage |
| `src/ui/testManagement/ComplianceTab.ts` | Replaced by flowti-tm-compliance |
| `src/ui/testManagement/FeatureQualityTab.ts` | Replaced by flowti-tm-feature-quality |
| `css/19-test-management.css` | Styles moved to Lit static styles |

### Estimated Impact

| Category | Count |
|----------|-------|
| New source files | 7 |
| New test files | 7 |
| Modified files | 6 |
| Deleted files | 8 |
| New lines | ~1,850 source + ~870 tests = ~2,720 |
| Deleted lines | ~2,300 (legacy view + tabs + CSS) |
| Net | ~+420 |
| New tests | ~120-140 |

## Definition of Done

- TestManagement hub renders via SitemapHubView (not legacy class)
- 6 Lit components with scoped static styles
- All components receive data via `@property()`, emit actions via `CustomEvent`
- 3 catalog tabs work as handler wrappers
- `refreshEvents` drives event-driven re-rendering
- Legacy view class + 6 tab classes + dashboard class deleted
- `19-test-management.css` removed or reduced
- 120-140 new tests across 8 files
- All 7,794+ existing tests pass
- `npm test` passes (tsc + eslint + vitest)
- Component manifest updated for new Lit components
