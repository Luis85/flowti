# PA2: Plugin Sitemap — Design Spec

**Date:** 2026-03-15
**Status:** Draft
**Scope:** Flowti Plugin — declarative sitemap system for views, commands, ribbon, modals

## Problem Statement

The Flowti Plugin's UI registration is entirely imperative. `main.ts` (1,900 LOC) hardcodes:

- **6 hub views** registered via `registerViews()` with inline factory functions
- **69 commands** registered via `createCommandDefinitions()` with inline handlers
- **14 ribbon icons** registered via `addRibbonIcon()` with inline callbacks
- **Train preconditions** scattered in `bindCommands()` as a lookup table
- **View dependencies** threaded through factory closures

This creates several problems:

1. **Adding a new view/command/ribbon requires touching main.ts** — a 1,900-line file that's the single biggest maintenance burden
2. **No schema validation** — typos in IDs, missing handlers, or broken wiring are runtime errors discovered only by manual testing
3. **No declarative overview** — understanding what the Plugin exposes requires reading scattered TypeScript across main.ts, registry.ts, and 3 bootstrap files
4. **Condition logic is ad-hoc** — train preconditions use a custom lookup table, not a generic system
5. **View-component wiring is imperative** — each Hub manually constructs its tab content; no declarative data binding

The CLI solved this with `sitemap.json` (v2 PageObject, 28 pages). PA2 brings the same philosophy to the Plugin: **structure in JSON, behavior in handlers**.

## Goals

1. Declare all Plugin UI surface (views, commands, ribbon, modals) in `plugin-sitemap.json`
2. Validate the sitemap at boot — catch wiring errors before runtime
3. Replace imperative view/command/ribbon registration with a declarative bootstrap
4. Provide a generic `SitemapHubView` that renders Hub views from tab declarations
5. Support condition evaluation for view visibility and command availability
6. Support `component` field for Lit component mounting (PA1 foundation)
7. Maintain full backward compatibility — existing 7,697 tests pass
8. Keep all existing UI behavior identical — no user-visible changes

## Non-Goals

- Replacing existing domain services (Plugin-owned domains stay as-is)
- Migrating existing Hub views to SitemapHubView (that's PA3)
- Implementing Lit components inside tabs (PA3)
- CLI SDK integration (Track B)
- Changing EventBus patterns or ServiceContainer

## Design

### 1. Schema Design

`plugin-sitemap.json` declares the complete Plugin UI surface:

```typescript
interface PluginSitemap {
  version: 2;
  views: Record<string, ViewDef>;
  commands: CommandDef[];
  ribbon: RibbonDef[];
  modals?: Record<string, ModalDef>;
}

interface ViewDef {
  kind: "hub" | "panel" | "leaf";
  label: string;
  icon: string;
  type: string;                        // Obsidian view type ID (e.g., "flowti-analytics-hub")
  tabs?: TabDef[];
  dataSources?: DataSourceRef[];
  conditions?: ConditionSet;
  legacy?: boolean;                    // true = skip SitemapHubView, use existing class
}

interface TabDef {
  id: string;
  label: string;
  icon: string;
  handler?: string;                    // handler ID for imperative rendering
  component?: string;                  // Lit component tag name (PA1)
  dataSource?: string;                 // data source ID bound to component props
  searchPlaceholder?: string;
}

interface CommandDef {
  id: string;                          // Obsidian command ID (e.g., "flowti:capture")
  name: string;                        // command palette display name
  description?: string;
  domain?: string;                     // e.g., "hub", "capture", "train"
  category?: string;                   // "view", "action", "capture"
  handler: string;                     // handler ID
  hotkey?: string;                     // e.g., "Ctrl+Shift+C"
  icon?: string;
  conditions?: ConditionSet;
}

interface RibbonDef {
  icon: string;
  label: string;
  action: string;                      // handler ID or "view:<viewId>"
  conditions?: ConditionSet;
}

interface ModalDef {
  kind: "form" | "confirm" | "display";
  label: string;
  fields?: FieldDef[];                 // for kind: "form"
  submit?: string;                     // handler ID for form submission
  conditions?: ConditionSet;
}

interface FieldDef {
  id: string;
  type: "text" | "textarea" | "select" | "tags" | "toggle" | "number";
  label?: string;
  placeholder?: string;
  options?: string[];                  // for type: "select"
  required?: boolean;
  default?: string;
}

interface DataSourceRef {
  id: string;                          // data source handler ID
  slot?: string;                       // property name on target component
  params?: Record<string, string>;
}

interface ConditionSet {
  hidden?: string;                     // condition expression — when true, item is hidden
  disabled?: string;                   // condition expression — when true, item is disabled
}
```

#### Condition Expressions

Conditions reference handler IDs or use boolean expressions:

```
"hidden": "no-active-train"                        → calls condition handler "no-active-train"
"disabled": "no-project-loaded"                    → calls condition handler "no-project-loaded"
"hidden": "no-active-train && !session-active"     → compound expression (&&, ||, !)
```

Resolution order:
1. Try as handler ID → call registered condition handler, use boolean result
2. If not a registered handler → parse as boolean expression over other handler IDs
3. Unknown handler ID + unparseable expression → treat as false (item visible/enabled)

#### Legacy Migration Support

Views with `"legacy": true` are registered using their existing class (current factory pattern). PA2 bootstrap reads the view type and icon from the sitemap but delegates construction to the existing `createViewDefinitions()` factory. This allows incremental migration:

```json
{
  "analytics-hub": {
    "kind": "hub",
    "label": "Analytics",
    "icon": "bar-chart-2",
    "type": "flowti-analytics-hub",
    "legacy": true
  }
}
```

All 6 existing Hub views start as `legacy: true`. PA3 migrates them one by one to SitemapHubView with Lit components.

### 2. Handler Registry

`PluginHandlerRegistry` is the single registration point for all sitemap-referenced behavior. It mirrors the CLI's `register-handlers.ts` pattern but with Plugin-specific handler types.

```typescript
interface PluginHandlerRegistry {
  // Tab content rendering (imperative path)
  registerTabHandler(id: string, handler: TabHandler): void;
  getTabHandler(id: string): TabHandler | undefined;

  // Action handlers (commands, ribbon, form submit)
  registerAction(id: string, handler: ActionHandler): void;
  getAction(id: string): ActionHandler | undefined;

  // Condition handlers (visibility/availability)
  registerCondition(id: string, handler: ConditionHandler): void;
  getCondition(id: string): ConditionHandler | undefined;

  // Data source handlers (provide data for views/components)
  registerDataSource(id: string, handler: DataSourceHandler): void;
  getDataSource(id: string): DataSourceHandler | undefined;

  // Introspection
  hasHandler(id: string): boolean;
  getRegisteredIds(): string[];
  clear(): void;
}

type TabHandler = (container: HTMLElement, ctx: TabContext) => void | Promise<void>;
type ActionHandler = (ctx: ActionContext) => void | Promise<void>;
type ConditionHandler = (ctx: ConditionContext) => boolean;
type DataSourceHandler = (ctx: DataSourceContext) => unknown | Promise<unknown>;

interface TabContext {
  tabId: string;
  viewId: string;
  eventBus: IEventBus;
  searchText?: string;
}

interface ActionContext {
  eventBus: IEventBus;
  app: App;
  logger: ILogger;
  params?: Record<string, string>;
}

interface ConditionContext {
  app: App;
  eventBus: IEventBus;
}

interface DataSourceContext {
  eventBus: IEventBus;
  params?: Record<string, string>;
}
```

#### Handler Registration Pattern

Services register their handlers during the registration phase (Phase 3), before bootstrap binds them to Obsidian:

```typescript
// src/infrastructure/handlers/register-plugin-handlers.ts
export function registerPluginHandlers(
  registry: PluginHandlerRegistry,
  deps: HandlerDependencies,
): void {
  // Analytics handlers
  registry.registerTabHandler("analytics:dashboard", (el, ctx) => {
    renderAnalyticsDashboard(el, deps.analyticsService, ctx.eventBus);
  });
  registry.registerTabHandler("analytics:queries", (el, ctx) => {
    renderAnalyticsQueries(el, deps.analyticsService, ctx.eventBus);
  });
  registry.registerAction("analytics:run-query", async (ctx) => {
    await deps.analyticsService.runSelectedQuery();
  });

  // Condition handlers
  registry.registerCondition("no-active-train", (ctx) => {
    return !deps.trainService.getActiveTrain();
  });
  registry.registerCondition("no-project-loaded", () => {
    return !deps.projectService?.hasActiveProject();
  });

  // Data sources
  registry.registerDataSource("analytics:measurements", () => {
    return deps.analyticsService.getMeasurements();
  });
}
```

#### File Location

`src/infrastructure/handlers/plugin-handler-registry.ts` (~80 lines)
`src/infrastructure/handlers/register-plugin-handlers.ts` (~200 lines)

### 3. Condition Evaluator

Evaluates condition expressions from the sitemap. Supports handler ID resolution and boolean expression parsing.

```typescript
interface IConditionEvaluator {
  evaluate(expression: string, ctx: ConditionContext): boolean;
}
```

#### Expression Grammar

```
expression  := term (("&&" | "||") term)*
term        := "!" term | "(" expression ")" | handlerRef
handlerRef  := identifier                    // looked up in registry
```

#### Resolution Rules

1. **Single handler ID** — `"no-active-train"` → call `registry.getCondition("no-active-train")`, return result
2. **Negation** — `"!session-active"` → call handler, negate result
3. **Compound** — `"no-active-train && !session-active"` → evaluate both, apply operator
4. **Parentheses** — `"(a || b) && c"` → grouping
5. **Unknown handler** — log warning, return `false` (item stays visible/enabled — safe default)

#### File Location

`src/infrastructure/handlers/condition-evaluator.ts` (~100 lines)

### 4. SitemapHubView

A generic Hub view that renders from a `ViewDef`. Extends `BaseHubView`, replaces per-domain Hub classes for new views (existing views stay as `legacy: true` until PA3 migration).

```typescript
class SitemapHubView extends BaseHubView<string> {
  private viewDef: ViewDef;
  private handlerRegistry: PluginHandlerRegistry;

  constructor(
    leaf: WorkspaceLeaf,
    eventBus: IEventBus,
    viewDef: ViewDef,
    handlerRegistry: PluginHandlerRegistry,
  ) {
    super(leaf, eventBus);
    this.viewDef = viewDef;
    this.handlerRegistry = handlerRegistry;
  }

  getViewType(): string { return this.viewDef.type; }
  getDisplayText(): string { return this.viewDef.label; }
  getIcon(): string { return this.viewDef.icon; }

  getTabDefinitions(): TabDef[] {
    return (this.viewDef.tabs ?? []).map(tab => ({
      id: tab.id,
      label: tab.label,
      icon: tab.icon,
      searchPlaceholder: tab.searchPlaceholder ?? `Search ${tab.label.toLowerCase()}...`,
    }));
  }

  onDashboardRender(): void {
    // Render dashboard tab — could delegate to a handler or show overview
    this.dashboardEl.empty();
    this.dashboardEl.createEl("h2", { text: this.viewDef.label });
  }

  async onTabRender(tabId: string): Promise<void> {
    const tabDef = this.viewDef.tabs?.find(t => t.id === tabId);
    if (!tabDef) return;

    const container = this.splitEl;
    container.empty();

    // Path 1: Handler-based rendering (imperative)
    if (tabDef.handler) {
      const handler = this.handlerRegistry.getTabHandler(tabDef.handler);
      if (handler) {
        await handler(container, {
          tabId,
          viewId: this.viewDef.type,
          eventBus: this.eventBus,
          searchText: this.filterText,
        });
      }
      return;
    }

    // Path 2: Component-based rendering (Lit — PA1 foundation)
    if (tabDef.component) {
      const el = document.createElement(tabDef.component);

      // Bind data source to component properties
      if (tabDef.dataSource) {
        const dsHandler = this.handlerRegistry.getDataSource(tabDef.dataSource);
        if (dsHandler) {
          const data = await dsHandler({ eventBus: this.eventBus });
          if (data && typeof data === "object") {
            for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
              (el as Record<string, unknown>)[key] = value;
            }
          }
        }
      }

      container.appendChild(el);
    }
  }
}
```

#### File Location

`src/ui/views/sitemap-hub-view.ts` (~120 lines)

### 5. SitemapBootstrap

Reads `plugin-sitemap.json`, validates it, and wires all declarations to Obsidian APIs. Replaces the imperative registration scattered across main.ts and bootstrap files.

```typescript
interface SitemapBootstrapDeps {
  plugin: Plugin;                       // Obsidian plugin instance
  eventBus: IEventBus;
  handlerRegistry: PluginHandlerRegistry;
  conditionEvaluator: IConditionEvaluator;
  legacyViewFactories: Map<string, ViewFactory>;  // existing view factories for legacy: true
}

class SitemapBootstrap {
  private sitemap: PluginSitemap;
  private deps: SitemapBootstrapDeps;
  private registeredViewTypes: string[] = [];
  private commandIds: string[] = [];

  constructor(sitemap: PluginSitemap, deps: SitemapBootstrapDeps) {
    this.sitemap = sitemap;
    this.deps = deps;
  }

  registerAll(): void {
    this.registerViews();
    this.registerCommands();
    this.registerRibbon();
  }

  private registerViews(): void {
    for (const [viewId, viewDef] of Object.entries(this.sitemap.views)) {
      if (viewDef.legacy) {
        // Use existing factory from createViewDefinitions()
        const factory = this.deps.legacyViewFactories.get(viewDef.type);
        if (factory) {
          this.deps.plugin.registerView(viewDef.type, (leaf) => factory(leaf));
          this.registeredViewTypes.push(viewDef.type);
        }
        continue;
      }

      // New views: create SitemapHubView from declaration
      this.deps.plugin.registerView(viewDef.type, (leaf) =>
        new SitemapHubView(leaf, this.deps.eventBus, viewDef, this.deps.handlerRegistry)
      );
      this.registeredViewTypes.push(viewDef.type);
    }
  }

  private registerCommands(): void {
    for (const cmdDef of this.sitemap.commands) {
      const handler = this.deps.handlerRegistry.getAction(cmdDef.handler);
      if (!handler) continue;

      const ctx: ActionContext = {
        eventBus: this.deps.eventBus,
        app: this.deps.plugin.app,
        logger: /* from deps */,
      };

      if (cmdDef.conditions) {
        // Command with visibility conditions → checkCallback
        this.deps.plugin.addCommand({
          id: cmdDef.id,
          name: cmdDef.name,
          icon: cmdDef.icon,
          checkCallback: (checking) => {
            const condCtx = { app: this.deps.plugin.app, eventBus: this.deps.eventBus };
            if (cmdDef.conditions!.hidden) {
              const isHidden = this.deps.conditionEvaluator.evaluate(
                cmdDef.conditions!.hidden, condCtx
              );
              if (isHidden) return false;
            }
            if (cmdDef.conditions!.disabled) {
              const isDisabled = this.deps.conditionEvaluator.evaluate(
                cmdDef.conditions!.disabled, condCtx
              );
              if (isDisabled) return false;
            }
            if (!checking) void handler(ctx);
            return true;
          },
        });
      } else {
        // Unconditional command → callback
        this.deps.plugin.addCommand({
          id: cmdDef.id,
          name: cmdDef.name,
          icon: cmdDef.icon,
          callback: () => void handler(ctx),
        });
      }

      this.commandIds.push(cmdDef.id);
    }
  }

  private registerRibbon(): void {
    for (const ribbonDef of this.sitemap.ribbon) {
      const condCtx = { app: this.deps.plugin.app, eventBus: this.deps.eventBus };

      this.deps.plugin.addRibbonIcon(ribbonDef.icon, ribbonDef.label, () => {
        // Check conditions at click time
        if (ribbonDef.conditions?.hidden) {
          if (this.deps.conditionEvaluator.evaluate(ribbonDef.conditions.hidden, condCtx)) return;
        }

        // Resolve action
        if (ribbonDef.action.startsWith("view:")) {
          const viewType = ribbonDef.action.slice(5);
          this.deps.plugin.app.workspace.getLeaf(true).setViewState({ type: viewType });
          return;
        }

        const handler = this.deps.handlerRegistry.getAction(ribbonDef.action);
        if (handler) {
          void handler({
            eventBus: this.deps.eventBus,
            app: this.deps.plugin.app,
            logger: /* from deps */,
          });
        }
      });
    }
  }

  unregisterAll(): void {
    // Obsidian handles command/ribbon cleanup on plugin unload.
    // View types need explicit unregister if the plugin supports hot-reload.
    this.registeredViewTypes = [];
    this.commandIds = [];
  }
}
```

#### Integration with main.ts

The bootstrap replaces imperative registration while preserving the existing phase structure:

```typescript
// Phase 3: Registration
const sitemap = loadAndValidateSitemap("plugin-sitemap.json");
registerPluginHandlers(handlerRegistry, deps);

// Phase 5: Bind to Obsidian
const bootstrap = new SitemapBootstrap(sitemap, {
  plugin: this,
  eventBus: this.eventBus,
  handlerRegistry,
  conditionEvaluator,
  legacyViewFactories: buildLegacyFactoryMap(viewDeps),
});
bootstrap.registerAll();
```

#### File Location

`src/infrastructure/sitemap/sitemap-bootstrap.ts` (~180 lines)
`src/infrastructure/sitemap/sitemap-validator.ts` (~60 lines)

### 6. Schema Validator

Validates `plugin-sitemap.json` at boot before any registration occurs. Pure function — no side effects.

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  path: string;          // JSON path (e.g., "views.analytics-hub.tabs[0].handler")
  message: string;
  severity: "error" | "warning";
}

function validatePluginSitemap(sitemap: unknown): ValidationResult;
```

#### Validation Rules

| Rule | Severity | Check |
|------|----------|-------|
| Version must be 2 | error | `sitemap.version === 2` |
| View IDs unique | error | No duplicate keys in `views` |
| View type required | error | Every view has non-empty `type` |
| View kind valid | error | kind ∈ {"hub", "panel", "leaf"} |
| Tab IDs unique within view | error | No duplicate tab IDs per view |
| Tab has handler or component | warning | At least one of `handler` or `component` |
| Command IDs unique | error | No duplicate IDs across commands |
| Command handler required | error | Every command has non-empty `handler` |
| Ribbon action required | error | Every ribbon has non-empty `action` |
| Modal kind valid | error | kind ∈ {"form", "confirm", "display"} |
| Form fields have IDs | error | Every field in a form modal has `id` |
| Field type valid | error | type ∈ {"text", "textarea", "select", "tags", "toggle", "number"} |
| Select fields have options | warning | type: "select" should have `options[]` |
| No dangling handler refs | warning | All handler/action IDs referenced should exist (checked post-registration) |

#### File Location

`src/domain/sitemap/plugin-sitemap-validator.ts` (~60 lines)

Note: The validator is a pure domain function (no I/O), placed in `src/domain/sitemap/`. The infrastructure layer loads the JSON and calls the validator.

### 7. Example plugin-sitemap.json

This is the initial sitemap declaring all existing Plugin UI surface. All views start as `legacy: true`:

```json
{
  "version": 2,
  "views": {
    "user-hub": {
      "kind": "hub",
      "label": "User Hub",
      "icon": "home",
      "type": "flowti-user-hub",
      "legacy": true
    },
    "analytics-hub": {
      "kind": "hub",
      "label": "Analytics",
      "icon": "bar-chart-2",
      "type": "flowti-analytics-hub",
      "legacy": true,
      "tabs": [
        { "id": "dashboard", "label": "Dashboard", "icon": "layout-dashboard", "handler": "analytics:dashboard" },
        { "id": "insights", "label": "Quick Insights", "icon": "zap", "handler": "analytics:insights" },
        { "id": "queries", "label": "Queries", "icon": "search", "handler": "analytics:queries" }
      ]
    },
    "train-hub": {
      "kind": "hub",
      "label": "Train",
      "icon": "waypoints",
      "type": "flowti-train-hub",
      "legacy": true
    },
    "data-exchange-hub": {
      "kind": "hub",
      "label": "Data Exchange",
      "icon": "arrow-left-right",
      "type": "flowti-data-exchange-hub",
      "legacy": true
    },
    "test-management-hub": {
      "kind": "hub",
      "label": "Test Management",
      "icon": "shield-check",
      "type": "flowti-test-management-hub",
      "legacy": true
    },
    "event-catalog": {
      "kind": "leaf",
      "label": "Event Catalog",
      "icon": "list",
      "type": "flowti-event-catalog",
      "legacy": true
    }
  },
  "commands": [
    { "id": "flowti:open-user-hub", "name": "Open user hub", "domain": "hub", "category": "view", "icon": "home", "handler": "hub:open-user" },
    { "id": "flowti:open-analytics-hub", "name": "Open analytics hub", "domain": "hub", "category": "view", "icon": "bar-chart-2", "handler": "hub:open-analytics" },
    { "id": "flowti:capture-idea", "name": "Capture idea", "domain": "capture", "category": "capture", "icon": "lightbulb", "handler": "capture:idea" },
    { "id": "flowti:capture-task", "name": "Capture task", "domain": "capture", "category": "capture", "icon": "check-square", "handler": "capture:task" },
    { "id": "flowti:resume-train", "name": "Resume train", "domain": "train", "category": "action", "icon": "play", "handler": "train:resume", "conditions": { "hidden": "no-active-train" } },
    { "id": "flowti:complete-train", "name": "Complete train", "domain": "train", "category": "action", "icon": "check", "handler": "train:complete", "conditions": { "hidden": "no-active-train" } }
  ],
  "ribbon": [
    { "icon": "home", "label": "User Hub", "action": "view:flowti-user-hub" },
    { "icon": "bar-chart-2", "label": "Analytics", "action": "view:flowti-analytics-hub" },
    { "icon": "list", "label": "Event Catalog", "action": "view:flowti-event-catalog" },
    { "icon": "lightbulb", "label": "Capture idea", "action": "capture:idea" },
    { "icon": "check-square", "label": "Capture task", "action": "capture:task" },
    { "icon": "waypoints", "label": "Train", "action": "train:open-or-start" }
  ]
}
```

The above is a representative subset. The full sitemap will declare all 69 commands and 14 ribbon icons.

## Testing Strategy

### Test Layers

**1. Schema Validator** (`tests/domain/sitemap/plugin-sitemap-validator.test.ts`)
- Pure function tests — no mocks needed
- Valid sitemap passes, invalid rejects with specific error messages
- Edge cases: duplicate IDs, missing required fields, unknown kinds, malformed conditions
- ~20-25 test cases

**2. Handler Registry** (`tests/infrastructure/handlers/plugin-handler-registry.test.ts`)
- Register/get/clear for each handler type (tab, action, condition, data source)
- `hasHandler()` checks across all registries
- Duplicate registration behavior (last wins or throws — TDD will decide)
- Missing handler returns undefined
- ~15-20 test cases

**3. Condition Evaluator** (`tests/infrastructure/handlers/condition-evaluator.test.ts`)
- Handler ID resolution — registered handler called, result returned
- Expression parsing — `&&`, `||`, `!`, parentheses, nested
- Dual mode — handler IDs tried first, fallback to expression
- Unknown handler ID + unparseable expression → error/false
- Context provider integration — flat context built from registered providers
- ~20-25 test cases

**4. SitemapHubView** (`tests/ui/views/sitemap-hub-view.test.ts`)
- Constructs from ViewDef — correct hub ID, label, icon, tab definitions
- Tab rendering — handler path calls registry, component path creates element
- Data source binding — resolved and set as component properties
- Empty/missing handler graceful fallback
- Mocked BaseHubView parent (no Obsidian DOM needed)
- ~15-20 test cases

**5. SitemapBootstrap** (`tests/infrastructure/sitemap/sitemap-bootstrap.test.ts`)
- Views: `registerView` called per non-legacy entry, legacy entries use factory map
- Commands: `addCommand` called per entry, `checkCallback` used when conditions present
- Ribbon: `addRibbonIcon` called per entry with correct handler resolution
- Teardown: `unregisterAll` cleans up all registered items
- Mock Plugin API (`registerView`, `addCommand`, `addRibbonIcon`)
- ~15-20 test cases

**6. Handler Registration** (`tests/infrastructure/handlers/register-plugin-handlers.test.ts`)
- All handler IDs from plugin-sitemap.json have matching registrations
- Cross-reference test: parse sitemap, call `registerPluginHandlers`, assert every referenced ID is satisfied
- ~5-10 test cases

**7. Integration** (`tests/infrastructure/sitemap/sitemap-integration.test.ts`)
- Load actual `plugin-sitemap.json` → validate → create registry → register handlers → bootstrap → assert all registrations correct
- End-to-end wiring without Obsidian runtime
- ~5 test cases

### Test Count Estimate

~100-120 new tests across 7 files. All existing 7,697+ Plugin tests must continue passing.

### What's NOT Tested in PA2

- Modal runtime (deferred to PA3)
- Lit component rendering within tabs (PA3 migration)
- Actual Obsidian API behavior (mocked at boundary)

## Migration Strategy

### Phase 1: Infrastructure (no behavior change)

1. Create `PluginHandlerRegistry` with tests (TDD)
2. Create `ConditionEvaluator` with tests (TDD)
3. Create `validatePluginSitemap()` with tests (TDD)

### Phase 2: Sitemap + Bootstrap

4. Create `plugin-sitemap.json` declaring all existing views/commands/ribbon as `legacy: true`
5. Create `SitemapHubView` with tests (TDD)
6. Create `SitemapBootstrap` with tests (TDD)

### Phase 3: Integration

7. Create `registerPluginHandlers()` — move handler logic from inline callbacks to named handlers
8. Wire bootstrap into `main.ts` Phase 5 — replace imperative `bindViews()`, `bindCommands()`, ribbon registration
9. Integration tests — full boot cycle with real sitemap + mock Obsidian

### Phase 4: Verification

10. Full `npm test` — all 7,697+ existing tests pass
11. Manual smoke test — all views, commands, ribbon icons work identically
12. Handler coverage audit — every sitemap handler ID has a registered handler

### Key Constraints

- All 6 existing Hub views start as `legacy: true` — no behavior change
- Train preconditions move to condition expressions in sitemap
- Ribbon icon behavior (e.g., train open-or-start) preserved via action handlers
- UiCommandService remains — handlers emit events, UiCommandService opens views
- No changes to EventBus, ServiceContainer, or domain services
- Tests pass after each phase

### Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Missing handler during boot | Validator warns, bootstrap skips gracefully, logs error |
| Condition evaluator edge case | Comprehensive expression parser tests; unknown → false (safe default) |
| Legacy view factory mismatch | Cross-reference test: sitemap type IDs vs createViewDefinitions() output |
| main.ts regression | Integration test loads real sitemap, asserts all registrations |
| Hot-reload breaks | `safeRegisterView` pattern preserved — bootstrap tolerates re-registration |

## File Inventory

### New Files

| File | Layer | Lines (est.) |
|------|-------|-------------|
| `plugin-sitemap.json` | Config | ~300 |
| `src/domain/sitemap/plugin-sitemap-validator.ts` | Domain | ~60 |
| `src/infrastructure/handlers/plugin-handler-registry.ts` | Infrastructure | ~80 |
| `src/infrastructure/handlers/condition-evaluator.ts` | Infrastructure | ~100 |
| `src/infrastructure/handlers/register-plugin-handlers.ts` | Infrastructure | ~200 |
| `src/infrastructure/sitemap/sitemap-bootstrap.ts` | Infrastructure | ~180 |
| `src/ui/views/sitemap-hub-view.ts` | UI | ~120 |
| `tests/domain/sitemap/plugin-sitemap-validator.test.ts` | Tests | ~150 |
| `tests/infrastructure/handlers/plugin-handler-registry.test.ts` | Tests | ~120 |
| `tests/infrastructure/handlers/condition-evaluator.test.ts` | Tests | ~150 |
| `tests/infrastructure/handlers/register-plugin-handlers.test.ts` | Tests | ~60 |
| `tests/infrastructure/sitemap/sitemap-bootstrap.test.ts` | Tests | ~120 |
| `tests/infrastructure/sitemap/sitemap-integration.test.ts` | Tests | ~50 |
| `tests/ui/views/sitemap-hub-view.test.ts` | Tests | ~120 |

### Modified Files

| File | Change |
|------|--------|
| `src/main.ts` | Replace imperative binding with SitemapBootstrap |

### Estimated Impact

| Category | Count |
|----------|-------|
| New source files | 7 |
| New test files | 7 |
| New config files | 1 |
| Modified files | 1 |
| New lines | ~1,510 source + ~770 tests = ~2,280 |
| Removed lines | ~200 (imperative binding in main.ts) |
| Net | ~+2,080 |
| New tests | ~100-120 |

## Definition of Done

- `plugin-sitemap.json` declares all views, commands, and ribbon icons
- `validatePluginSitemap()` catches schema errors at boot
- `PluginHandlerRegistry` provides typed registration for all handler types
- `ConditionEvaluator` supports handler IDs, `&&`, `||`, `!`, parentheses
- `SitemapHubView` renders tabs from ViewDef (handler path and component path)
- `SitemapBootstrap` replaces imperative view/command/ribbon binding
- All existing views use `legacy: true` — zero behavior change
- Train preconditions expressed as condition expressions
- 100-120 new tests across 7 test files
- All 7,697+ existing Plugin tests pass
- `npm test` passes (tsc + eslint + vitest)
- No changes to EventBus, ServiceContainer, or domain services
