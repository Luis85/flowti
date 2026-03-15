# Plugin-CLI Integration — Design Spec

> Refactor the Flowti Obsidian Plugin to leverage the Flowti CLI as its computation backbone, becoming a CLI-managed project with shared architecture patterns.

## Vision

The Flowti CLI is the canonical implementation of the Flowti IBDE Framework. It provides all endpoints, data models, and business logic. The Flowti Obsidian Plugin is a rich user-experience layer on top — consuming CLI capabilities through a curated SDK and providing Obsidian-native UI backed by a strong, shared data model.

**Distribution targets:**
- Flowti CLI standalone
- Flowti CLI bundled with Flowti Obsidian Plugin

## Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Integration model | **Hybrid** | Direct SDK imports for data model/logic; subprocess for heavy ops (build, test, pipeline) |
| Declarative UI | **Obsidian-adapted sitemap** | plugin-sitemap.json declares Hubs, commands, ribbon, modals — same philosophy as CLI, different primitives |
| Domain ownership | **Domain-by-domain** | CLI-owned (25), Shared (6), Plugin-owned (19) — each placed where it naturally belongs |
| Infrastructure | **Keep ServiceContainer, align interfaces** | Plugin keeps lifecycle management; interfaces align with CLI's ISP dep pattern |
| Package sharing | **CLI as npm workspace** | Monorepo workspace, CLI exports `@flowti/cli` package |
| API surface | **Curated SDK** | CLI adds `sdk/` with stable, versioned re-exports — Plugin never touches CLI internals |
| Event system | **Plugin EventBus authoritative** | CLI is computation layer (returns results), Plugin is reactive layer (emits events) |
| Frontend framework | **Lit (Web Components)** | Platform-agnostic components testable in CLI storybook; standards-based, no runtime, Obsidian-compatible |

## 1. Architecture Overview

### Workspace Structure

```
c:\Projects\flowti\                     (git root + workspace root)
├── package.json                        "workspaces": ["01 - Projects/Flowti CLI", "Development/flowti"]
│
├── 01 - Projects/Flowti CLI/           @flowti/cli
│   ├── sdk/                            CURATED API SURFACE
│   │   ├── index.ts                    main entry
│   │   ├── types/                      shared data model
│   │   ├── domain/                     pure domain function re-exports
│   │   └── interfaces/                 DI contracts (IFileSystem, IShell, ISP subsets)
│   ├── src/                            CLI internals (NOT exported)
│   │   ├── domain/                     27 domains
│   │   ├── controller/                 23 controllers
│   │   ├── infrastructure/             DI, sitemap, I/O
│   │   └── ui/                         terminal renderers
│   ├── configs/                        sitemap.json, flowti.config.json, etc.
│   └── package.json                    "exports": { ".": "./sdk/index.ts" }
│
└── Development/flowti/                 @flowti/plugin
    ├── src/
    │   ├── domain/                     26 domains (services + events)
    │   ├── infrastructure/
    │   │   ├── adapters/               VaultFileSystem, VaultPaths, ObsidianShell (NEW)
    │   │   ├── events/                 EventBus, EventBridge (unchanged)
    │   │   └── services/               ServiceContainer (enhanced with build*Deps())
    │   └── ui/                         Hubs, views, modals
    ├── plugin-sitemap.json             declarative Obsidian UI (NEW)
    ├── flowti.config.json              CLI-managed project config (NEW)
    └── package.json                    depends on @flowti/cli workspace package
```

### Integration Channels

**Direct SDK Import (build-time):**
- Plugin imports types, domain functions, and interfaces from `@flowti/cli`
- Types: zero runtime cost, full type safety
- Domain functions: pure, receive deps — Plugin provides Obsidian-backed implementations
- Bundled into Plugin's main.js at build time

**Subprocess (runtime):**
- Plugin spawns `flowti <command> --format=json` for heavy operations
- Build, test, pipeline execution, report generation
- JSON output parsed, results emitted on Plugin EventBus

### Key Principles

1. **CLI = computation layer** — pure domain functions, data model, business logic
2. **Plugin = reactive layer** — EventBus, Obsidian integration, user experience
3. **SDK = stable contract** — curated exports, Plugin never touches CLI internals
4. **Plugin EventBus stays authoritative** — CLI returns results, Plugin emits events
5. **ServiceContainer stays** — lifecycle management, but interfaces align with CLI ISP pattern
6. **Domain-by-domain ownership** — CLI-owned, Plugin-owned, or shared

## 2. Domain Classification

### CLI-Owned (25 domains)

Business logic and data model live in CLI. Plugin consumes via SDK.

project, build, health, lifecycle, reports, resources, timelog, deliverables, raid, requirements, capa, templates, scaffold, make, review, info, devtools, plugins, ai-tools, knowledgebase, sitemap, agents, claude-sync, iterations, serve

`shared` is a cross-cutting utility module (markdown-store, help-loader) — not a domain per se, but its exports are available via the SDK.

These domains ARE the Flowti IBDE Framework.

### Shared (6 domains)

Data model defined in CLI SDK. Business logic split — CLI provides canonical logic, Plugin extends with Obsidian-specific behavior.

| Domain | CLI Provides | Plugin Provides |
|--------|-------------|-----------------|
| **capture** | Data model, capture logic, categorization | Obsidian modal UI, vault artifact creation |
| **events / event-definition** | Event contract types, schema validation | EventBus implementation, event catalog, 430+ typed events |
| **onboarding** | Onboarding flow model, step definitions | Obsidian wizard UI, guided tours |
| **e2e / journey** | Journey model, step validation, execution engine | Journey builder canvas UI, executor integration |
| **test-management / health** | Quality gates, health scoring, tech debt tracking | Test pyramid UI, compliance dashboard |
| **feature-lifecycle / lifecycle** | Lifecycle state machine, transitions, history | Obsidian status tracking, canvas visualization |

### Plugin-Owned (19 domains)

Logic and data model stay in Plugin. Adopt CLI architecture patterns (pure domain functions, ISP deps, DDD).

session, analytics, canvas, train, signal, nudge, inbox, hub, installer, discovery, subscription, event-filter, event-notify, data-exchange, user, settings, process, docs, ingestion

These are inherently Obsidian-native features that require the platform.

## 3. CLI SDK Surface

### Directory Structure

```
sdk/
├── index.ts                    main entry: import { ... } from '@flowti/cli'
│
├── types/                      shared data model
│   ├── project.ts              ProjectConfig, ProjectContext, PackageJson
│   ├── lifecycle.ts            LifecycleState, EntityType, Transition
│   ├── health.ts               HealthScore, QualityGate, TechDebtItem
│   ├── reports.ts              ReportGenerator, ReportResult, Threshold
│   ├── capture.ts              CaptureItem, CaptureKind, CaptureConfig
│   ├── events.ts               EventContract, EventSchema, EventMeta
│   ├── journey.ts              Journey, JourneyStep, JourneyResult
│   ├── onboarding.ts           OnboardingFlow, OnboardingStep
│   ├── resources.ts            Resource, Timelog, Deliverable, RAID
│   ├── agents.ts               AgentDef, AgentState, WorkerConfig
│   ├── config.ts               FlowtiConfig (full config schema)
│   └── index.ts                re-exports all types
│
├── domain/                     pure domain function re-exports
│   ├── project.ts              loadConfig, discoverProjects, resolveContext
│   ├── health.ts               calcHealth, evalGates, scoreTechDebt
│   ├── lifecycle.ts            transition, validateState, getHistory
│   ├── reports.ts              runGenerator, resolvePrereqs, mergeResults
│   ├── capture.ts              createCapture, resolveConfig, categorize
│   ├── events.ts               validateContract, diffSchemas
│   ├── journey.ts              parseJourney, validateSteps
│   ├── resources.ts            CRUD for resources, timelog, RAID, etc.
│   └── index.ts                re-exports all domain functions
│
└── interfaces/                 DI contracts
    ├── filesystem.ts           IFileSystem
    ├── shell.ts                IShell
    ├── paths.ts                IPaths
    ├── clock.ts                IClock
    ├── deps.ts                 ISP subsets: ReportDeps, HealthDeps, CaptureDeps, etc.
    └── index.ts                re-exports all interfaces
```

### Sync/Async Interface Bridge

The CLI's current `IFileSystem` is synchronous (`readFileSync`, `writeFileSync`, `existsSync`). Obsidian's `Vault.adapter` is asynchronous (`adapter.read()` returns `Promise<string>`).

**Resolution:** The SDK defines **async versions** of all I/O interfaces (`IAsyncFileSystem`, `IAsyncShell`). CLI domain functions that the Plugin consumes via SDK are re-exported as async-compatible wrappers. This is a one-way constraint: CLI domains can remain sync internally, but the SDK surface presents async interfaces that both sync (CLI) and async (Plugin) implementations can satisfy.

```typescript
// sdk/interfaces/filesystem.ts
export interface IAsyncFileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  listDir(path: string): Promise<string[]>;
}

// CLI provides a sync→async adapter for its own IFileSystem
export function syncToAsync(fs: IFileSystem): IAsyncFileSystem {
  return {
    readFile: (p) => Promise.resolve(fs.readFileSync(p, 'utf-8')),
    writeFile: (p, d) => Promise.resolve(fs.writeFileSync(p, d)),
    exists: (p) => Promise.resolve(fs.existsSync(p)),
    listDir: (p) => Promise.resolve(fs.readdirSync(p)),
  };
}
```

SDK domain functions accept `IAsyncFileSystem` (and corresponding async ISP subsets). The Plugin provides Obsidian-backed async implementations directly. The CLI uses `syncToAsync()` adapters when calling through the SDK surface. CLI's internal code continues using sync interfaces unchanged.

### SDK Rules

- Types are always safe to import — zero runtime cost, full type safety
- Domain functions are pure — they need deps injected, Plugin provides Obsidian-backed implementations
- Interfaces define the contract — Plugin implements IAsyncFileSystem, IAsyncShell, etc. backed by Obsidian APIs
- SDK never imports from `src/` — re-exports only, clean boundary
- No CLI infrastructure leaks — no Node.js fs, no process, no terminal I/O
- SDK I/O interfaces are async — both sync (CLI) and async (Plugin) implementations work

### Consumption Patterns

**Pattern 1 — Import types for data model:**
```typescript
import type { ProjectConfig, HealthScore, LifecycleState } from '@flowti/cli';
```

**Pattern 2 — Call domain functions via SDK:**
```typescript
import { calcHealth } from '@flowti/cli';
import type { HealthDeps } from '@flowti/cli';

const deps: HealthDeps = {
  disk:  this.container.get<IFileSystem>('filesystem'),
  paths: this.container.get<IPaths>('paths'),
  shell: this.container.get<IShell>('shell'),
  clock: { now: () => new Date() },
};

const score = calcHealth(projectContext, deps);
this.eventBus.emit('health.calculated', { score });
```

**Pattern 3 — Subprocess for heavy operations:**
```typescript
const result = await this.shell.exec(
  `flowti build --project="${name}" --format=json`
);
const buildResult = JSON.parse(result.stdout);
this.eventBus.emit('build.completed', { result: buildResult });
```

## 4. Plugin Sitemap

### Schema Design

The `plugin-sitemap.json` declares all Obsidian UI primitives:

| Obsidian Primitive | Sitemap Declaration | Runtime Wiring |
|-------------------|---------------------|----------------|
| `registerView()` | `views[]` — Hub views with tab definitions | Bootstrap reads views, calls registerView() |
| `addCommand()` | `commands[]` — palette entries with handler IDs | Bootstrap reads commands, calls addCommand() |
| `addRibbonIcon()` | `ribbon[]` — icons with action targets | Bootstrap reads ribbon, calls addRibbonIcon() |
| `Modal` subclass | `modals[]` — modal definitions with form fields | Modal registry renders from declaration |
| `addSettingTab()` | `settings[]` — grouped setting sections | Setting tab renders from declaration |

### Example

```json
{
  "version": 2,
  "views": {
    "analytics-hub": {
      "kind": "hub",
      "label": "Analytics",
      "icon": "bar-chart-2",
      "tabs": [
        { "id": "dashboard", "label": "Dashboard", "handler": "analytics:dashboard" },
        { "id": "insights", "label": "Quick Insights", "handler": "analytics:insights" },
        { "id": "queries", "label": "Queries", "handler": "analytics:queries" }
      ],
      "dataSources": [{ "id": "analytics:measurements" }],
      "conditions": { "hidden": "no-project-loaded" }
    },
    "session-workspace": {
      "kind": "hub",
      "label": "Session",
      "icon": "clock",
      "tabs": [
        { "id": "active", "label": "Active Session", "handler": "session:active" },
        { "id": "history", "label": "History", "handler": "session:history" },
        { "id": "templates", "label": "Templates", "handler": "session:templates" }
      ]
    }
  },
  "commands": [
    { "id": "capture", "name": "Capture idea", "handler": "capture:modal", "hotkey": "Ctrl+Shift+C" },
    { "id": "start-session", "name": "Start session", "handler": "session:start" },
    { "id": "run-health", "name": "Run health check", "handler": "health:run" }
  ],
  "ribbon": [
    { "icon": "lightbulb", "label": "Capture", "action": "capture:modal" },
    { "icon": "clock", "label": "Session", "action": "view:session-workspace" },
    { "icon": "bar-chart-2", "label": "Analytics", "action": "view:analytics-hub" }
  ],
  "modals": {
    "capture": {
      "kind": "form",
      "label": "Quick Capture",
      "fields": [
        { "id": "kind", "type": "select", "options": ["idea", "task", "bug", "feedback", "learning"] },
        { "id": "title", "type": "text", "placeholder": "What's on your mind?" },
        { "id": "body", "type": "textarea", "placeholder": "Details (optional)" },
        { "id": "tags", "type": "tags" }
      ],
      "submit": "capture:create"
    }
  }
}
```

### Runtime Behavior

1. Bootstrap loads `plugin-sitemap.json` and validates against schema
2. For each `views` entry → `plugin.registerView(id, () => new SitemapHubView(def))`
3. For each `commands` entry → `plugin.addCommand({ id, callback: handlers.get(handler) })`
4. For each `ribbon` entry → `plugin.addRibbonIcon(icon, label, handlers.get(action))`
5. Services register handlers by ID — same pattern as CLI's `register-handlers.ts`
6. Conditions evaluated at render time — hidden/disabled gating via condition handlers

### CLI Sitemap vs Plugin Sitemap

Same philosophy (structure in JSON, behavior in handlers), different primitives:
- **CLI:** Pages with menu actions, navigation stack, key assignment, terminal-oriented
- **Plugin:** Hub views with tabs, commands (palette), ribbon icons, modals, multiple views simultaneously

## 5. Component Architecture (Lit Web Components)

### Design Principle

UI components follow the same pattern as domain functions: **pure, platform-agnostic units** that receive data via properties and emit events — with thin platform wrappers for Obsidian integration.

```
Portable Component (Lit)  →  Obsidian View Wrapper  →  plugin-sitemap.json
       ↓                            ↓
   CLI Storybook               Obsidian Runtime
```

### Component Layers

**Layer 1: Portable Components (`src/components/`)**

Lit custom elements with no Obsidian dependency. Receive data via properties, emit custom DOM events. Renderable in any browser context — Obsidian, CLI storybook, standalone HTML.

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { HealthScore } from '@flowti/cli';

@customElement('flowti-health-card')
export class HealthCard extends LitElement {
  @property({ type: Object }) score?: HealthScore;

  static styles = css`
    :host { display: block; padding: 1rem; }
    .score { font-size: 2rem; font-weight: bold; }
  `;

  render() {
    if (!this.score) return html`<p>No data</p>`;
    return html`
      <div class="score">${this.score.overall}</div>
      <p>${this.score.gates.length} quality gates evaluated</p>
    `;
  }
}
```

**Layer 2: Obsidian View Wrappers (`src/ui/views/`)**

Thin shells that mount Lit components inside Obsidian ItemViews. Connect to ServiceContainer for data, pass properties down, relay DOM events to EventBus.

```typescript
class HealthHubView extends ItemView {
  async onOpen() {
    const el = this.contentEl;
    const card = document.createElement('flowti-health-card');

    // Data flows down via properties
    const score = await this.container.get<HealthService>('health').getScore();
    card.score = score;

    // Events flow up to Plugin EventBus
    card.addEventListener('gate-clicked', (e) => {
      this.eventBus.emit('health.gate.selected', e.detail);
    });

    el.appendChild(card);
  }
}
```

**Layer 3: CLI Storybook**

CLI storybook renders the same Lit components with mock data — no Obsidian required. Each component gets a story file declaring its variants and test data.

```typescript
// stories/health-card.story.ts
export const stories = {
  healthy: { score: { overall: 92, gates: [...] } },
  failing: { score: { overall: 41, gates: [...] } },
  empty:   { score: undefined },
};
export const component = 'flowti-health-card';
```

### Component Categories

| Category | Examples | Storybook Coverage |
|----------|---------|-------------------|
| **Data display** | health-card, report-summary, lifecycle-badge | Full — pure data rendering |
| **Forms** | capture-form, session-config, filter-editor | Full — input/output via properties/events |
| **Dashboards** | analytics-dashboard, test-pyramid, train-timeline | Full — composed from smaller components |
| **Obsidian-specific** | canvas-overlay, vault-file-picker | Not in storybook — thin, tested via Plugin tests |

### Styling Strategy

- Components use Lit's scoped `static styles` (Shadow DOM) — no CSS conflicts with Obsidian
- Shared design tokens (colors, spacing, typography) in a `tokens.css` that both storybook and Obsidian load
- Obsidian's CSS variables (e.g., `--text-normal`, `--background-primary`) mapped to Flowti tokens via an adapter stylesheet

### Sitemap Integration

The plugin-sitemap.json references components by tag name. The handler mounts the component and wires data:

```json
{
  "analytics-hub": {
    "tabs": [
      { "id": "dashboard", "label": "Dashboard", "component": "flowti-analytics-dashboard", "dataSource": "analytics:measurements" }
    ]
  }
}
```

When a tab has a `component` field, the sitemap runtime mounts it, binds `dataSource` results to its properties, and relays its events to the handler.

## 6. Infrastructure Alignment

### Obsidian Adapters (New)

Plugin implements CLI interfaces backed by Obsidian APIs:

```typescript
import type { IAsyncFileSystem, IAsyncShell, IPaths, IClock } from '@flowti/cli';

// Obsidian Vault → IAsyncFileSystem (natural async fit)
class VaultFileSystem implements IAsyncFileSystem {
  constructor(private vault: Vault) {}
  readFile(path)         { return this.vault.adapter.read(path); }
  writeFile(path, data)  { return this.vault.adapter.write(path, data); }
  exists(path)           { return this.vault.adapter.exists(path); }
  listDir(path)          { return this.vault.adapter.list(path); }
}

// Obsidian workspace paths → IPaths
class VaultPaths implements IPaths {
  constructor(private vault: Vault, private basePath: string) {}
  resolve(...segments)   { return join(this.basePath, ...segments); }
  relative(from, to)     { /* ... */ }
}
```

These live in `src/infrastructure/adapters/`.

### ServiceContainer Enhancement

ServiceContainer keeps lifecycle management but gains ISP dep builder methods:

```typescript
import type { HealthDeps, ReportDeps, CaptureDeps } from '@flowti/cli';

class ServiceContainer {
  // Existing: service registration + lifecycle
  register(id, factory, deps?) { /* ... */ }
  initializeAll()              { /* dependency-ordered init */ }
  shutdownAll()                { /* reverse-ordered shutdown */ }

  // NEW: build ISP dep subsets from registered infrastructure
  buildHealthDeps(): HealthDeps {
    return {
      disk:  this.get<IFileSystem>('filesystem'),
      paths: this.get<IPaths>('paths'),
      shell: this.get<IShell>('shell'),
      clock: this.get<IClock>('clock'),
      log:   this.get<ILog>('log').log,
    };
  }
}
```

### Plugin Service Pattern (CLI-backed)

Plugin services become thin reactive wrappers around CLI domain functions:

```typescript
import { calcHealth } from '@flowti/cli';
import type { HealthScore } from '@flowti/cli';

class HealthService {
  constructor(
    private container: ServiceContainer,
    private eventBus: IEventBus,
  ) {}

  async runHealthCheck(project: ProjectContext): Promise<HealthScore> {
    // 1. Build ISP deps from Obsidian-backed infrastructure
    const deps = this.container.buildHealthDeps();
    // 2. Call pure CLI domain function
    const score = calcHealth(project, deps);
    // 3. Plugin emits the event (CLI never touches EventBus)
    await this.eventBus.emit('health.check.completed', { score });
    return score;
  }
}
```

### What Stays, What Changes

| Component | Status | Change |
|-----------|--------|--------|
| ServiceContainer | STAYS | + adds `build*Deps()` methods for ISP subsets |
| EventBus | STAYS | No changes — remains Plugin's reactive backbone |
| EventBridge | STAYS | No changes — sole Obsidian API translator |
| TypedStorage | EVOLVES | Plugin-owned domains keep it. CLI-backed domains use VaultFileSystem |
| main.ts (1,900 LOC) | REPLACED | Becomes thin bootstrap that loads plugin-sitemap.json |
| Obsidian Adapters | NEW | VaultFileSystem, VaultPaths, ObsidianShell implement CLI interfaces |
| Lit Components | NEW | Portable Web Components for all UI — testable in CLI storybook |
| Raw DOM UI code | REPLACED | Migrated to Lit components with Obsidian view wrappers |

## 7. Migration Strategy

### 8 Phases

**P1: Workspace Foundation** (prerequisite for all)
- Root `package.json` with npm workspaces: `["01 - Projects/Flowti CLI", "Development/flowti"]`
- CLI `package.json`: set `"name": "@flowti/cli"`, add `"exports": { ".": "./sdk/index.ts" }`, keep `"private": true` (workspace-only, not published to npm)
- CLI `sdk/` directory with initial type exports
- Plugin `package.json` depends on `"@flowti/cli": "workspace:*"`
- Plugin gets `flowti.config.json` (becomes CLI-managed project)
- Add `lit` as Plugin runtime dependency
- Verify `npm install` + both builds work

**P2: Obsidian Adapters** (parallel with P3, P3b)
- VaultFileSystem implements IAsyncFileSystem
- VaultPaths implements IPaths
- ObsidianShell implements IAsyncShell
- ServiceContainer gains `build*Deps()` methods
- First CLI domain function callable from Plugin

**P3: Plugin Sitemap** (parallel with P2, P3b)
- plugin-sitemap.json schema + validator
- SitemapHubView — generic Hub from declaration
- Command/ribbon/modal registry from sitemap
- Handler registration pattern
- Sitemap supports `component` field for Lit component mounting
- Bootstrap replaces main.ts orchestrator

**P3b: Lit Component Foundation** (parallel with P2, P3)
- Lit build pipeline integrated into Plugin's esbuild config
- Shared design tokens (`tokens.css`) for consistent styling
- Obsidian CSS variable adapter stylesheet
- Base component class with common patterns (loading, error, empty states)
- First portable component (e.g., `flowti-health-card`) with storybook story
- CLI storybook runner: loads component + story data, renders in browser
- Component testing pattern: render in happy-dom, assert DOM output

**P4: Shared Domain Migration** (depends on P2)
- capture → CLI data model + Plugin modal
- events → CLI contract types + Plugin bus
- onboarding → CLI flow model + Plugin wizard
- journey/e2e → CLI model + Plugin builder
- test-management/health → CLI scoring + Plugin UI
- feature-lifecycle → CLI states + Plugin tracking

**P5: Plugin Domain Refactoring + Component Migration** (parallel with P4)
- 19 Plugin-owned domains adopt CLI patterns
- Pure domain functions extracted from services
- ISP dep subsets defined per domain
- Services become thin orchestrators
- Existing Hub views migrated to Lit components with Obsidian wrappers
- Each migrated component gets a storybook story
- No feature changes — architecture only

**P6: Subprocess Integration** (after P2 + P3)
- CLI binary discovery + health check from Plugin
- Build, test, pipeline ops via `flowti <cmd> --format=json`
- Report generation triggered from Plugin UI
- Progress/status streaming back to Plugin EventBus

**P7: Distribution & Polish** (after all phases)
- CLI standalone packaging (single binary)
- Plugin bundled with CLI as optional dependency
- Shared test harness for integration tests
- Full storybook coverage for all portable components
- Documentation: SDK reference, migration guide, architecture docs

### Execution Order

```
P1 → (P2 ∥ P3 ∥ P3b) → (P4 ∥ P5) → P6 → P7
```

Each phase gets its own spec → plan → implementation cycle.

### Testing Strategy

| Layer | What's Tested | How |
|-------|---------------|-----|
| CLI SDK | Domain functions, type contracts | CLI's existing 5,920 tests |
| Obsidian Adapters | VaultFileSystem, VaultPaths, ObsidianShell | Unit tests with mock Vault API |
| Lit Components | Rendering, properties, events, variants | Unit tests in happy-dom + CLI storybook visual tests |
| Plugin Services | Wrapper logic, event emission, error handling | Unit tests with mock SDK + mock EventBus |
| Plugin Sitemap | Schema validation, handler wiring, bootstrap | Unit tests: sitemap → correct registrations |
| Integration | Plugin calls CLI SDK → correct results + events | Integration tests with real CLI fns + mock Obsidian |

**Gate rule:** Every phase must maintain all existing tests passing — 7,697 Plugin tests + 5,920 CLI tests. TDD for all new code.

## Success Criteria

1. Plugin provides the same rich feature set it already provides
2. All features backed by CLI's strong data model (via SDK types)
3. Easy-to-use endpoints to all CLI features (SDK domain functions + subprocess commands)
4. Plugin is a proper CLI-managed project (flowti.config.json, build/test/health/reports)
5. Declarative UI via plugin-sitemap.json (no more 1,900-line main.ts)
6. All Plugin-owned domains follow CLI architecture patterns (pure functions, ISP deps, DDD)
7. CLI distributable standalone; Plugin distributable bundled with CLI
8. Zero test regression across all phases
9. Portable Lit components testable in CLI storybook without Obsidian
10. Full storybook coverage for all data display, form, and dashboard components
