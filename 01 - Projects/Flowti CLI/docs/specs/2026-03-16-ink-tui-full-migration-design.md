# Ink TUI Full Migration — Design Spec

**Date:** 2026-03-16
**Status:** Approved
**Scope:** Migrate all 32 Flowti CLI interactive pages from ANSI/readline to Ink, then delete the legacy UI
**Depends on:** Phase 0 shell foundation (complete), Agent Chat V2 (parallel branch, integrated post-merge)
**Parent spec:** `2026-03-16-ink-tui-migration-design.md` (original concept spec)

## Sitemap Page Inventory

The 32 pages from `configs/sitemap.json`, mapped to migration phases:

| Page ID | Label | Phase | Pattern |
|---------|-------|-------|---------|
| `start` | Start Menu | 2 | DashboardPage |
| `ai-tools` | Agents and AI Tools | 2 | ListPage + MasterDetail |
| `agent-detail` | Agent Profile | 2 | DashboardPage + Sections |
| `project-detail` | Project Dashboard | 2 | DashboardPage |
| `iterations` | Iterations | 2 | ListPage + MasterDetail |
| `iteration-detail` | Iteration Detail | 2 | Sub-view of iterations |
| `resources` | Resources | 3 | ListPage (CRUD) |
| `timelog` | Timelog | 3 | ListPage (CRUD) |
| `deliverables` | Deliverables | 3 | ListPage (CRUD) |
| `raid` | RAID Log | 3 | ListPage (CRUD) |
| `requirements` | Requirements | 3 | ListPage (CRUD) |
| `capa` | Capacities | 3 | ListPage (CRUD) |
| `lifecycle` | Lifecycle | 3 | ListPage (CRUD) |
| `management` | Project Management | 3 | Hub (navigation-only) |
| `reports` | Reports | 4 | ListPage |
| `event-catalog` | Event Catalog | 4 | ListPage + filter |
| `plugins` | Plugins | 4 | ListPage |
| `knowledgebase` | Knowledgebase | 4 | ListPage (read-only) |
| `make` | Make | 4 | FormPage |
| `scaffold` | Scaffold (via make) | 4 | FormPage |
| `publish` | Publish | 4 | FormPage |
| `capture` | Capture (via start) | 4 | FormPage |
| `build` | Build (via project) | 4 | StreamingPage |
| `review` | Code Review | 4 | DashboardPage |
| `devtools` | Dev Tools | 4 | DashboardPage |
| `docs` | Documentation | 4 | ListPage (read-only) |
| `workspaces` | Workspaces | 4 | ListPage |
| `components` | Components | 4 | ListPage + MasterDetail |
| `component-detail` | Component Detail | 4 | Sub-view of components |
| `onboarding` | Onboarding | 4 | Custom (step wizard) |
| `onboarding-tour` | Onboarding Tour | 4 | Sub-view of onboarding |
| `onboarding-checklist` | Onboarding Checklist | 4 | Sub-view of onboarding |
| `agents-chat` | Agent Chat | Post Chat V2 | Custom (wraps chat components) |
| `agent-edit` | Edit Agent | — | Mode within agent-detail |
| `iteration-planning` | Iteration Planning | — | Mode within iteration-detail |

Note: `agent-edit` and `iteration-planning` are modes within their parent pages, not standalone page components. `agents-chat` is deferred to post Chat V2 merge. Total standalone page components: 32 (including sub-views).

## Architecture

### Data Flow

```
ContentArea (orchestrator)
  → calls loader(deps, project, params) per pageId
  → loader calls domain function → returns typed data model
  → passes data as props to page component
  → page renders with Ink primitives

Mutations:
  → page calls onAction(actionId, params)
  → ContentArea calls executeAction(actionId, ctx)
  → thin bridge calls existing handler logic
  → on success: refresh loader data
  → on failure: set actionError state → render dismissible error banner
```

Pages are pure presentation — they receive typed data as props and render with Ink components. No domain or infrastructure imports inside page components.

### LoaderDeps Type

Loaders receive a typed dependency subset, following the existing ISP pattern:

```typescript
// src/tui/loaders/loader-types.ts
import type { CliDeps } from "../../infrastructure/deps.js";

export type LoaderDeps = Pick<CliDeps, "disk" | "paths" | "clock" | "shell" | "log">;

export interface LoaderContext {
    readonly deps: LoaderDeps;
    readonly vaultRoot: string;
    readonly projectPath: string | undefined;
    readonly agentsConfig: AgentsConfig | undefined;
    readonly params: Readonly<Record<string, string>>;
}
```

All loaders take `LoaderContext` and return a typed data object. `vaultRoot` and config values come through the context, never via module-level imports.

### Action Bridge Error Contract

`executeAction` returns a result or throws. `ContentArea` catches errors and surfaces them:

```typescript
// ContentArea orchestration (simplified)
const [actionError, setActionError] = useState<string | null>(null);

const handleAction = async (actionId: string, params?: Record<string, string>) => {
    setActionError(null);
    try {
        await executeAction(actionId, { deps, project, params });
        refresh();
    } catch (err) {
        setActionError(err instanceof Error ? err.message : String(err));
    }
};

if (actionError) return <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} />;
```

Pages never handle action errors — they call `onAction` and the shell handles the rest.

### Action Bridge Routing (Post Phase 5)

During Phases 1-4, `executeAction` routes through a lightweight dispatch map extracted from the existing handler files:

```typescript
// src/tui/hooks/action-map.ts
const actionMap: Record<string, (ctx: ActionContext) => Promise<void>> = {};
export function registerAction(id: string, fn: (ctx: ActionContext) => Promise<void>): void { ... }
export function executeAction(id: string, ctx: ActionContext): Promise<void> { ... }
```

In Phase 5, `handler-registry.ts` is deleted. The action functions that were registered there are moved into `action-map.ts` as standalone functions. The bridge becomes the permanent lightweight replacement — no registry class needed.

### Focus Ownership & Keyboard Routing

Three focus zones, managed by `useFocusZone`:

| Zone | Owner | Keys |
|------|-------|------|
| `activity-bar` | ActivityBar | ↑↓ = switch section, Enter = select |
| `content` | ScrollableList / Form / Custom | ↑↓ = navigate items, Enter = select, / = search |
| `actions` | ActionBar | ←→ = navigate actions, Enter = execute |

**Routing rules:**
- `Tab` cycles zones: activity-bar → content → actions → activity-bar
- `Escape` always pops navigation stack (handled in `App` only — `useKeyboard` is refactored in Phase 1 to remove its duplicate Escape handler)
- Arrow keys are consumed by the active zone only — `useFocusZone.active` gates which component receives input
- `useKeyboard` (Phase 0) is refactored in Phase 1 to only handle keys when `focusZone === "activity-bar"`

### Terminal Resize

`ScrollableList` uses Ink's `useStdout()` to read `stdout.rows` dynamically rather than accepting a static `height` prop. The visible window recalculates on resize. `StatGrid` reads `stdout.columns` to determine column count. No explicit resize subscription needed — Ink re-renders automatically on terminal resize, and these hooks provide current dimensions on each render.

### Layer Map

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Primitives | `src/tui/primitives/` | Reusable Ink components (ScrollableList, MasterDetail, StatCard, etc.) |
| Pages | `src/tui/pages/` | One component per sitemap page, props-based rendering |
| Loaders | `src/tui/loaders/` | Pure functions: `(LoaderContext) → typed data` |
| Hooks | `src/tui/hooks/` | `useLoader`, `useActionBridge`, `useFocusZone`, `useStreamingProcess` |
| Shell | `src/tui/shell/` | Layout components (Phase 0, complete) |
| Navigation | `src/tui/navigation/` | State machine + section map (Phase 0, complete) |

### Key Decisions

1. **Props-based pages** — Pages receive data as props from `ContentArea`. No domain calls inside components. Testable with mock data.
2. **Thin action bridge** — Pages call `onAction(actionId, params)` for mutations. `ContentArea` routes through `executeAction`, handles errors, and refreshes data.
3. **Chat stays placeholder** — `agents-chat` remains `PlaceholderPage` until Chat V2 branch merges, then gets wrapped as a page.
4. **Default flip at Phase 2** — After high-traffic pages work, `--tui` becomes default. `--legacy` flag added for old router. StatusBar displays "Legacy mode: flowti --legacy" hint while placeholder pages remain. Both flags removed in Phase 5.
5. **Controllers unchanged** — `CliResponse<T>` data models and `CommandDescriptor` stay. Non-interactive CLI is unaffected throughout.

## Phase 1: Core Primitives

**Goal:** Build the reusable component library that all 32 pages compose from.

### Page Patterns (3)

**ListPage** — Scrollable list with optional detail panel. Used by 12+ pages.
- Props: `items[]`, `selected`, `renderItem`, `renderDetail?`, `actions[]`, `onSelect`
- Layout: ScrollableList (left) + optional Detail panel (right, via MasterDetail)
- Footer: ActionBar with contextual keys

**DashboardPage** — Grid of stats + content sections. Used by 5+ pages.
- Props: `stats[]`, `sections[]`, `actions[]`
- Layout: StatGrid (top) + Section[] (scrollable below)

**FormPage** — Structured input form. Used by 5+ pages.
- Props: `fields[]`, `onSubmit`, `onCancel`, `title`
- Layout: Vertical field list with Tab navigation, validation

### Primitives (10 components)

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `ScrollableList` | Arrow-key navigable, virtualized, dynamic height via `useStdout` | `items`, `selected`, `renderItem`, `onSelect` |
| `MasterDetail` | Split panel layout | `masterWidth`, `master`, `detail` |
| `StatCard` | Single KPI box | `label`, `value`, `trend?`, `color?` |
| `StatGrid` | Responsive grid of StatCards, columns via `useStdout` | `stats[]` |
| `Section` | Titled content block | `title`, `children`, `collapsible?` |
| `Badge` | Colored inline label | `text`, `color` |
| `SearchInput` | Inline filter (activated by `/`) | `value`, `onChange`, `placeholder` |
| `ActionBar` | Bottom contextual actions | `actions[]` (key + label + handler) |
| `FormField` | Text, select, toggle, number | `type`, `label`, `value`, `onChange`, `options?` |
| `KeyHints` | Key legend row | `hints[]` (key + label) |

### Hooks (4)

| Hook | Signature | Purpose |
|------|-----------|---------|
| `useLoader<T>` | `(loaderFn, ctx: LoaderContext) → { data, loading, error, refresh }` | Calls loader on mount, manages states, exposes `refresh()` |
| `useActionBridge` | `(deps) → { executeAction(id, ctx) → Promise<void> }` | Routes to action-map functions; throws on failure |
| `useFocusZone` | `(zones: string[]) → { active, next, prev, setActive }` | Tab cycling with active zone gating keyboard input |
| `useStreamingProcess` | `(command, deps) → { lines, running, exitCode, start, stop }` | Spawns shell process, streams stdout/stderr lines into React state |

### Loader Pattern

```typescript
// src/tui/loaders/agents-loader.ts
import type { LoaderContext } from "./loader-types.js";
import { agentStore } from "../../domain/agents/agent-store.js";

export interface AgentPageData {
    readonly agents: AgentSummary[];
    readonly selected?: string;
}

export function loadAgents(ctx: LoaderContext): AgentPageData {
    const agents = agentStore.list(ctx.deps, ctx.vaultRoot, ctx.agentsConfig ? { dir: ctx.agentsConfig.dir } : undefined);
    return { agents, selected: ctx.params.agentName };
}
```

### ContentArea Orchestration

`ContentArea` uses `useLoader` to call the page's registered loader, then passes data as props:

```typescript
// Simplified flow
const [actionError, setActionError] = useState<string | null>(null);
const { data, loading, error, refresh } = useLoader(loader, ctx);
const { executeAction } = useActionBridge(deps);

const handleAction = async (id: string, params?: Record<string, string>) => {
    setActionError(null);
    try { await executeAction(id, { deps, project, params }); refresh(); }
    catch (err) { setActionError(err instanceof Error ? err.message : String(err)); }
};

if (loading) return <Spinner />;
if (error) return <ErrorView error={error} />;
if (actionError) return <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} />;
return <Page {...data} onAction={handleAction} />;
```

### Refactor: useKeyboard (Phase 0 → Phase 1)

The Phase 0 `useKeyboard` hook handles up/down/escape globally. In Phase 1, it is refactored to only activate when `useFocusZone.active === "activity-bar"`. The duplicate Escape handler is removed (Escape is handled only in `App.useInput`).

### Testing Strategy

- Primitives: 5-8 tests each (render, interaction, edge cases) via `ink-testing-library`
- Page patterns: 3-5 tests each (renders with mock data, empty state, actions)
- Loaders: 2-3 tests each (pure functions, mock deps)
- Hooks: 3-5 tests each (via wrapper harness pattern from Phase 0)

### Deliverable

Component library with test harness. All primitives, page patterns, hooks, and loader infrastructure functional and tested. No pages migrated yet — that's Phase 2.

## Phase 2: High-Traffic Pages

**Goal:** Migrate the 6 most-used pages. After this, `--tui` becomes the default.

### Pages

**`start` (Home Dashboard)** — DashboardPage
- Stats: project count, agent count, active iteration, health score
- Sections: Quick Actions, Active Agents (busy/waiting with tasks), Recent Activity
- Loader: project list + agent states from `.flowti/var/` + active iteration

**`ai-tools` (Agent List + Detail)** — ListPage with MasterDetail
- List: name, type badge (ai/human), domain badge, status dot
- Detail: skills, tools, roles, behaviors, persona, mood, attributes, AI config
- Actions: n=New, d=Delete, e=Edit, r=Run, c=Chat, Enter=Open detail
- Loader: `agentStore.list()` via `LoaderContext` + `readAgentState()` for live status
- Page file: `ai-tools-page.tsx`

**`agent-detail` (Single Agent Deep View)** — DashboardPage + Sections
- Stats: experience, skill count, tool count, status
- Sections: Skills (name + level), Tools, Roles, Behaviors, AI Config (permissions, model), Active Session
- Actions: e=Edit, r=Run, c=Chat, p=Permissions, Esc=Back
- Edit mode: inline form for agent fields (replaces `agent-edit` page)

**`project-detail` (Project Dashboard)** — DashboardPage
- Stats: source files, test count, coverage %, health score, build status
- Sections: Build Commands, Test Presets, Configuration, Dependencies
- Loader: `projectInfo()` domain function + health snapshot

**`health` (Health Dashboard)** — DashboardPage
- Stats: overall score (letter grade), test pass rate, coverage %, lint errors, security issues
- Sections: Test Results, Coverage breakdown, Lint summary, Trend (last 5), Tech Debt by severity
- Loader: `computeHealth()` + `loadDebtEstimate()` + `loadHistory()`

**`iterations` (Iteration List + Detail)** — ListPage with MasterDetail
- List: number, name, status badge, date range, completion %
- Detail: goal, scope items (checkbox list), agents, capacity, resources
- Actions: n=New, Enter=Open detail, a=Advance status
- Loader: reads iteration plan files, parses frontmatter + scope checkboxes
- `iteration-detail` is a sub-view: entering an iteration pushes a DashboardPage for that single iteration

### Section Map Update

Phase 0's `section-map.ts` references page IDs `agents-run` and `roster-task` which do not exist in `sitemap.json`. In Phase 2, update the section map to match the actual sitemap exactly:

```typescript
{ id: "agents", pages: ["ai-tools", "agent-detail", "agents-chat"] },
```

Remove `agents-run` and `roster-task` from the agents section. Add any missing pages to their correct sections.

### Default Flip

After all 6 pages pass tests:
- `main.ts`: `--tui` becomes default entry point
- `--legacy` flag added to launch old `SitemapRouter`
- StatusBar shows hint: "Some pages are being migrated. Use --legacy for the classic UI."
- Non-interactive CLI unchanged

### Page Registration

Pages register in `page-registry.ts` on import. `tui-entry.ts` imports all page modules to trigger registration.

```typescript
// pages/ai-tools-page.tsx
registerPage("ai-tools", AiToolsPage);
```

## Phase 3: Management Pages

**Goal:** Migrate 8 pages. Seven CRUD pages plus the management hub.

| Page | Items | Detail | Special |
|------|-------|--------|---------|
| `resources` | Resource entries | Name, type, allocation, notes | — |
| `timelog` | Time entries | Date, hours, description, agent | Sum total in stats |
| `deliverables` | Deliverable items | Name, status, due date, owner | Status badges |
| `raid` | RAID log entries | Type badge (R/A/I/D), severity, owner, mitigation | Type filter |
| `requirements` | Requirement items | ID, title, status, priority, acceptance criteria | Priority sort |
| `capa` | CAPA items | Type (corrective/preventive), severity, status, hours | Severity coloring |
| `lifecycle` | Lifecycle entities | Name, current state, type | Transition action |
| `management` | Hub page | N/A — navigation grid to sub-pages | DashboardPage with nav cards |

### Shared CRUD Loader

All 7 CRUD pages use a generic `createCrudLoader` that takes the store instance:

```typescript
function createCrudLoader<TSummary, TDef>(
    store: StoreApi<TSummary, TDef>,
    options?: { dir?: string },
): (ctx: LoaderContext) => CrudPageData<TSummary> {
    return (ctx) => ({
        items: store.list(ctx.deps, ctx.projectPath ?? ctx.vaultRoot, options),
        selected: ctx.params.name,
    });
}
```

Actions (create, edit, delete, transition) go through the action bridge.

## Phase 4: Tooling Pages

**Goal:** Migrate remaining 16 pages. Mixed patterns.

### Streaming Pages (use `useStreamingProcess`)
- `build` — Spawns build command, streams stdout line by line, shows exit code + duration on completion
- `test` — Spawns test command, streams output, parses final summary (pass/fail/skip/coverage)
- `devtools` — Spawns lint command, streams results, shows summary

These pages use `useStreamingProcess` instead of `useLoader`. The hook spawns an `IShell` process and pushes stdout/stderr lines into React state incrementally:

```typescript
const { lines, running, exitCode, start } = useStreamingProcess(buildCommand, deps);
// lines: string[] — grows as output arrives
// running: boolean — true while process is alive
// exitCode: number | null — set on completion
```

### List Pattern
- `reports` — Report list + run action
- `event-catalog` — Event types with domain grouping + filter
- `plugins` — Plugin list + validate/create
- `knowledgebase` — KB articles (read-only, opens in editor)
- `docs` — Documentation files (read-only)
- `workspaces` — Workspace list + inspect/dispose
- `components` — Component list + detail (`component-detail` is a sub-view)

### Form Pattern
- `scaffold` — Project scaffolding wizard (template select + name + options)
- `make` — Code generation (template + target + params)
- `publish` — Distribution targets (endpoint select + confirm)
- `capture` — Quick capture (type select + content)
- `review` — Code review form (DashboardPage with review results)

### Special Pages
- `help` — Renders help-content.ts as Ink text blocks with section navigation (custom page)
- `onboarding` — Step-by-step wizard with progress. `onboarding-tour` and `onboarding-checklist` are sub-views rendered as steps within the wizard (not standalone page components)

## Phase 5: Cleanup & Legacy Removal

**Goal:** Delete all legacy UI code. Ink is the only interactive mode.

### Files to Delete (~67 files)

**Menus (30 files):** All `src/ui/menus/*.ts` — agents, iterations, CRUD, component, scaffold, lifecycle, etc.

**Displays (25 files):** All `src/ui/displays/*.ts` — rendering logic now in Ink page components.

**Renderers (7 files):** All `src/ui/renderers/*.ts` — common-renderers, cli-event-renderer, make-renderers, storybook-renderers, etc.

**Infrastructure (4 files):**
- `src/infrastructure/sitemap-router.ts` — replaced by `useNavigation` + `ContentArea`
- `src/infrastructure/sitemap-watcher.ts` — no hot-reload needed
- `src/ui/help.ts` + `src/ui/help-content.ts` — replaced by help page

Note: `src/infrastructure/handler-registry.ts` is deleted. Its action functions have been migrated to `src/tui/hooks/action-map.ts` during Phases 2-4 as pages were built.

### Chat Component Rename

When `chat-page.tsx` is implemented (post Chat V2 merge), the duplicate component names must be resolved:
- `src/infrastructure/chat/components/header-bar.tsx` → rename export to `ChatHeaderBar`
- `src/infrastructure/chat/components/activity-bar.tsx` → rename export to `ChatActivityBar`
- Update `ink-chat-renderer.ts` imports accordingly

These components are internal to the chat renderer and do not conflict at the type level, but the rename prevents import confusion.

### Files to Modify

**`src/main.ts`:** Remove `--tui`/`--legacy` flags, remove `createRouter()`, boot Ink directly.

**`src/ui/handlers/*.ts`:** Delete files entirely. All mutation functions have been moved to `src/tui/hooks/action-map.ts`.

**Controller renderers:** Keep — used by non-interactive mode (`flowti info --format=json`).

### Cleanup Verification

1. `npm test` — all pass (update/remove tests referencing deleted files)
2. `npx tsc --noEmit` — no type errors
3. `node configs/esbuild.config.mjs` — clean build
4. `npx eslint src/` — clean

### Expected Impact

- ~67 files deleted
- ~13 handler files deleted (logic moved to action-map)
- `main.ts` simplified
- Net reduction: ~4,000-5,000 lines of legacy UI code

## File Structure (target state)

```
src/tui/
├── app.tsx                              # Root Ink component (Phase 0 ✓)
├── tui-entry.ts                         # Ink boot (Phase 0 ✓)
├── types.ts                             # Shared types (Phase 0 ✓)
├── shell/
│   ├── activity-bar.tsx                 # Left icon column (Phase 0 ✓)
│   ├── header-bar.tsx                   # Top breadcrumb bar (Phase 0 ✓)
│   ├── status-bar.tsx                   # Bottom key hints (Phase 0 ✓)
│   └── content-area.tsx                 # Page switcher + loader orchestration (Phase 0 shell ✓, loader in Phase 1)
├── navigation/
│   ├── use-navigation.ts               # Navigation state hook (Phase 0 ✓)
│   ├── use-keyboard.ts                 # Activity-bar keyboard handler (Phase 0 ✓, refactored Phase 1)
│   └── section-map.ts                  # Sitemap → section grouping (Phase 0 ✓, updated Phase 2)
├── primitives/                          # Phase 1
│   ├── scrollable-list.tsx
│   ├── master-detail.tsx
│   ├── stat-card.tsx
│   ├── stat-grid.tsx
│   ├── section.tsx
│   ├── badge.tsx
│   ├── search-input.tsx
│   ├── action-bar.tsx
│   ├── form-field.tsx
│   └── key-hints.tsx
├── pages/                               # Phases 1-4
│   ├── page-registry.ts                 # (Phase 0 ✓)
│   ├── placeholder-page.tsx             # (Phase 0 ✓)
│   ├── list-page.tsx                    # Phase 1
│   ├── dashboard-page.tsx               # Phase 1
│   ├── form-page.tsx                    # Phase 1
│   ├── start-page.tsx                   # Phase 2
│   ├── ai-tools-page.tsx               # Phase 2
│   ├── agent-detail-page.tsx            # Phase 2
│   ├── project-detail-page.tsx          # Phase 2
│   ├── health-page.tsx                  # Phase 2
│   ├── iterations-page.tsx              # Phase 2
│   ├── resources-page.tsx               # Phase 3
│   ├── timelog-page.tsx                 # Phase 3
│   ├── deliverables-page.tsx            # Phase 3
│   ├── raid-page.tsx                    # Phase 3
│   ├── requirements-page.tsx            # Phase 3
│   ├── capa-page.tsx                    # Phase 3
│   ├── lifecycle-page.tsx               # Phase 3
│   ├── management-page.tsx              # Phase 3
│   ├── build-page.tsx                   # Phase 4
│   ├── test-page.tsx                    # Phase 4
│   ├── devtools-page.tsx                # Phase 4
│   ├── reports-page.tsx                 # Phase 4
│   ├── scaffold-page.tsx                # Phase 4
│   ├── make-page.tsx                    # Phase 4
│   ├── publish-page.tsx                 # Phase 4
│   ├── capture-page.tsx                 # Phase 4
│   ├── review-page.tsx                  # Phase 4
│   ├── plugins-page.tsx                 # Phase 4
│   ├── event-catalog-page.tsx           # Phase 4
│   ├── knowledgebase-page.tsx           # Phase 4
│   ├── docs-page.tsx                    # Phase 4
│   ├── workspaces-page.tsx              # Phase 4
│   ├── components-page.tsx              # Phase 4
│   ├── help-page.tsx                    # Phase 4
│   ├── onboarding-page.tsx              # Phase 4
│   └── chat-page.tsx                    # Post Chat V2 merge
├── loaders/                             # Phases 1-4
│   ├── loader-types.ts                  # LoaderDeps, LoaderContext types
│   ├── crud-loader.ts                   # Generic CRUD loader factory
│   ├── start-loader.ts
│   ├── ai-tools-loader.ts
│   ├── agent-detail-loader.ts
│   ├── health-loader.ts
│   ├── iterations-loader.ts
│   ├── project-detail-loader.ts
│   └── ... (one per page or shared)
└── hooks/                               # Phase 1
    ├── use-loader.ts
    ├── use-action-bridge.ts
    ├── use-focus-zone.ts
    ├── use-streaming-process.ts
    └── action-map.ts                    # Lightweight action dispatch (replaces handler-registry)
```

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Merge conflicts with Chat V2 branch | Medium | Chat stays placeholder — no shared files |
| Phase 2 default flip exposes placeholders | Medium | `--legacy` fallback + StatusBar hint for remaining placeholders |
| Large list performance (1000+ items) | Medium | ScrollableList uses virtualization (render visible window only) |
| Streaming process pages (build/test) | Medium | Dedicated `useStreamingProcess` hook with incremental line state |
| Focus zone conflicts between components | Medium | `useFocusZone` gates all keyboard input by active zone |
| Handler bridge becomes permanent tech debt | Low | Phase 5 migrates all actions to `action-map.ts`; handler files deleted |
| Test count drops during display deletion | Low | New Ink tests replace old display tests 1:1 |
| Terminal resize with virtualized lists | Low | `ScrollableList` and `StatGrid` use `useStdout()` for dynamic dimensions |
