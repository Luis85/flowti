# Sitemap-Driven TUI Renderer — Design Spec

**Date:** 2026-03-17
**Status:** Draft
**Scope:** Replace hardcoded TUI pages with a universal sitemap-driven renderer that reads `configs/sitemap.json` and wires actions, forms, data sources, and conditions to Ink components.

---

## 1. Problem

The TUI has 35 Ink page components and 32 loaders, but they are read-only dashboards. The 150+ actions declared in `sitemap.json` (create, edit, delete, build, test, manage iterations, etc.) are trapped in the legacy terminal-based `SitemapRouter` and `HandlerRegistry`. Users can look but can't do anything.

The legacy handler system (`HandlerRegistry`, `SitemapRouter`, `form-runner.ts`) owns the terminal directly — calling `input.ask()`, `runMenu()`, printing ANSI. This is incompatible with Ink's React rendering model. A clean break is needed.

## 2. Design Decisions

| Decision | Choice |
|----------|--------|
| Rendering model | Single universal `SitemapPage` component, custom overrides for complex pages (chat, tour) |
| Handler migration | Full — all ~150 handlers migrated to `TuiActionHandler`, legacy retired |
| Handler I/O | Handlers are pure domain calls returning typed results, never own terminal |
| Data loading | Existing TUI loaders stay primary; sitemap data sources for supplemental dynamic content |
| Conditions | Reuse existing expression evaluator + condition handlers with TuiContext adapter |
| Legacy fallback | None — no "not yet available" states, no terminal fallback |

## 3. Architecture

### 3.1 Rendering Pipeline

```
sitemap.json (declaration)
    ↓
SitemapPage (universal renderer)
    ↓
Action Dispatcher (navigate / effect / form / signal / command)
    ↓
Domain functions (via loaders + TuiActionHandlers)
```

### 3.2 ContentArea Resolution

ContentArea currently uses a hardcoded page registry. The new flow:

1. Check `customPages` map for a registered override component
2. If no override → render `<SitemapPage pageId={activePageId} />`

Custom overrides receive their page's sitemap actions and render their own content zone, but still get the standard sitemap-driven ActionBar.

### 3.3 Page Layout

```
┌─────────────────────────────────┐
│  Header (page.label + breadcrumb)│
├─────────────────────────────────┤
│                                 │
│  Content Zone                   │
│  (loader data rendered by kind) │
│                                 │
├─────────────────────────────────┤
│  ⠋ Running build...             │  ← effect status strip (when active)
├─────────────────────────────────┤
│  ActionBar (page.actions[])     │
└─────────────────────────────────┘
```

## 4. Action Dispatch System

The sitemap declares five action types. Each dispatches differently in the TUI:

### 4.1 `navigate`

Calls `navigate(action.target, action.params)` on the existing TUI navigation system. Zero async, zero handler code.

### 4.2 `signal`

Maps to TUI primitives:

| Signal | TUI action |
|--------|------------|
| `"back"` | `goBack()` |
| `"quit"` | Exit app |
| `"refresh"` | Re-run loader, re-render |
| `"start"` | `navigate("start")` |

### 4.3 `form`

Pushes a form page onto the navigation stack. The form page:

1. Reads `fields[]` and `validation[]` from the target page's sitemap definition
2. Renders FormPage with field components (text, select, toggle, etc.)
3. Tab navigation between fields, Enter to submit
4. Evaluates `hidden`/`disabled` conditions on fields reactively
5. On submit: calls the registered form handler (domain function) with collected data
6. On success: navigates back or to a result page

### 4.4 `handler`

Two sub-patterns:

**Effect handlers** — fire-and-forget domain calls (build, test, delete, generate reports):
- Dispatcher calls `TuiActionHandler` async
- Shows status strip with spinner during execution
- On completion: flash success/error message, refresh page

**Navigation handlers** — actions needing user input (open project picker, create iteration):
- Handler returns `{ kind: "navigate", target, params }`
- Dispatcher calls `navigate()` to the target page (list for picking, form for creating)

### 4.5 `command`

Runs a non-interactive CLI command via shell:
- Captures stdout/stderr
- Displays output in a scrollable text view that replaces the content zone temporarily
- Escape dismisses, returns to normal content

## 5. TuiActionHandler

Replaces the legacy `ActionHandler` signature:

```typescript
type TuiActionHandler = (ctx: TuiActionContext) => Promise<TuiActionResult>

interface TuiActionContext {
  deps: CliDeps
  project?: ProjectContext
  tools?: Record<string, boolean>
  params?: Record<string, string>
}

type TuiActionResult =
  | { kind: "ok"; message?: string }
  | { kind: "navigate"; target: string; params?: Record<string, string> }
  | { kind: "error"; message: string }
```

**Key constraint:** `TuiActionHandler` has no terminal I/O — no `input.ask()`, no `log()`, no `runMenu()`. It calls domain functions and returns a typed result. All rendering is Ink's responsibility.

### 5.1 TuiHandlerRegistry

```typescript
class TuiHandlerRegistry {
  registerHandler(id: string, handler: TuiActionHandler): void
  registerFormHandler(id: string, handler: TuiFormHandler): void
  registerCondition(id: string, handler: TuiConditionHandler): void
  registerDataSource(id: string, handler: TuiDataSourceHandler): void

  getHandler(id: string): TuiActionHandler
  getFormHandler(id: string): TuiFormHandler
  getCondition(id: string): TuiConditionHandler
  getDataSource(id: string): TuiDataSourceHandler

  hasHandler(id: string): boolean
  hasFormHandler(id: string): boolean
  hasCondition(id: string): boolean
  hasDataSource(id: string): boolean
}
```

## 6. Handler Migration

All ~150 legacy handlers migrate to `TuiActionHandler`. Three categories:

### 6.1 Effect Handlers (~40%)

Actions that perform work without user input: build, test, publish, generate reports, delete items.

Legacy:
```typescript
registry.registerAction("build:interactive", async (ctx) => {
  await ctx.deps.shell.run(buildCmd);
  ctx.deps.log("Done");
  return "refresh";
});
```

Becomes:
```typescript
tuiRegistry.registerHandler("build:run", async (ctx) => {
  await runBuild(ctx.deps, ctx.project!);
  return { kind: "ok", message: "Build complete" };
});
```

### 6.2 Form Handlers (~40%)

Actions that need user input: create iteration, edit agent, capture idea, add requirement. These become `navigate` actions pointing to a form page. The sitemap declares `fields[]` for the form. The form submits to a `TuiFormHandler`.

Legacy:
```typescript
registry.registerAction("iteration:create", async (ctx) => {
  const name = await ctx.deps.input.ask("Name:");
  const goal = await ctx.deps.input.ask("Goal:");
  createIteration(ctx.deps, { name, goal });
  return "refresh";
});
```

Becomes:
- Sitemap action: `{ type: "form", target: "iteration-create" }`
- Sitemap form page: `{ kind: "form", fields: [{ name: "name", ... }, { name: "goal", ... }] }`
- Form handler: `tuiRegistry.registerFormHandler("iteration:create", async (ctx, data) => { ... })`

### 6.3 Navigation Handlers (~20%)

Actions that navigate to another page: open project, view detail, browse list. These are already `navigate` type actions in the sitemap — they need zero handler code.

### 6.4 Retired Systems

After migration, the following become dead code:

- `HandlerRegistry` (runtime use — type definitions kept)
- `SitemapRouter`
- `form-runner.ts`
- `run-menu.ts`
- `src/ui/handlers/*-handlers.ts` (domain logic extracted into TUI handlers)

## 7. Page Rendering by Kind

`SitemapPage` reads `page.kind` and selects a content renderer:

### 7.1 `"page"` → Dashboard Layout

- Loader returns typed data (stats, sections, lists)
- Renders StatGrid for metrics, Section components for grouped content
- Pages: start, project-detail, health, lifecycle, help

### 7.2 `"list"` → List Layout

- Loader returns array of items
- Renders ScrollableList with optional MasterDetail panel
- Selecting an item dispatches the list's primary action (usually navigate to detail)
- Data sources inject additional dynamic items
- Pages: iterations, projects-list, scaffold, make, requirements, deliverables, raid, resources, timelog, ai-tools, plugins, event-catalog, reports

### 7.3 `"form"` → Form Layout

- Reads `fields[]` and `validation[]` from sitemap definition
- Renders FormPage with field components (text, select, toggle)
- Tab navigation, Enter submit, Escape cancel
- Submit calls registered `TuiFormHandler`
- Pages: all create/edit flows

### 7.4 `"dialog"` → Overlay Layout

- Modal-style overlay on current page
- Renders message + action buttons (confirm/cancel)
- Pages: delete confirmations, command output display

### 7.5 Unmapped Kinds

`"component"`, `"system"`, `"container"`, `"c4-component"`, `"person"`, `"ui-component"` — architecture visualization metadata, not interactive pages. SitemapPage ignores them.

### 7.6 Custom Overrides

Registered in a `customPages` map:

| Page ID | Component | Reason |
|---------|-----------|--------|
| `agents-chat` | `AgentsChatPage` | Unique chat interaction model |
| `onboarding-tour` | `OnboardingTourPage` | Step-based tour with mixed input types |

Custom pages receive sitemap actions via the `useSitemapActions` hook and render their own content zone.

## 8. Reactive Condition Evaluation

### 8.1 `useSitemapActions` Hook

```typescript
function useSitemapActions(pageId: string): ActionDef[]
```

On each render:
1. Read `page.actions[]` from sitemap
2. Build flat context from TuiContext (`project`, `tools.*`, `config.*`)
3. Evaluate `hidden` condition per action → filter out hidden actions
4. Evaluate `disabled` condition per action → mark disabled
5. Run key-assigner on visible actions → assign shortcut keys
6. Return `ActionDef[]` for ActionBar

### 8.2 Context Adapter

Bridges `TuiContextValue` to the flat `Record<string, boolean>` expected by the expression evaluator:

| TuiContext field | Flat key | Example |
|-----------------|----------|---------|
| `project` (exists) | `"project"` | `true` |
| `config.tools.esbuild` | `"tools.esbuild"` | `true` |
| `config.tools.typescript` | `"tools.typescript"` | `true` |
| `config.management` (exists) | `"config.management"` | `true` |

### 8.3 Registered Condition Handlers

Called with a lightweight context built from TuiContext. Same function signatures as today (`(ctx) => boolean`), different context source.

### 8.4 Form Field Conditions

`useSitemapFields(pageId)` applies the same condition evaluation to `fields[]`, filtering hidden fields and marking disabled fields on each render.

### 8.5 Refresh Triggers

Conditions re-evaluate naturally on React re-render. State changes (project selected, config loaded) flow through TuiContext → re-render → condition re-evaluation. No explicit subscription needed.

## 9. Effect Execution & Feedback

### 9.1 Effect State Machine

```
idle → running → success | error → idle (after timeout)
```

### 9.2 `useActionEffect` Hook

```typescript
function useActionEffect(): {
  run: (handlerId: string, ctx: TuiActionContext) => Promise<void>
  state: "idle" | "running" | "success" | "error"
  message: string
}
```

- While `running`: status strip shows spinner + action label, other actions disabled
- On `success`: flash message (1.5s), back to idle, page refreshes loader data
- On `error`: error message persists until user presses any key
- One effect at a time per page

### 9.3 Status Strip

Renders between content zone and ActionBar. Single line, only visible when state is not `idle`.

### 9.4 Command Output

For `command` type actions: scrollable text view replaces the content zone temporarily. Escape dismisses and returns to normal content.

### 9.5 Background Effects

If user presses Escape during a running effect, the effect continues in background. Status strip shows "running in background..." and actions re-enable.

## 10. File Structure

### 10.1 New Files

```
src/tui/
  sitemap/
    sitemap-page.tsx            — universal page renderer (kind → layout)
    sitemap-action-bar.tsx      — ActionBar driven by useSitemapActions
    effect-strip.tsx            — status strip for running effects
    command-output.tsx          — scrollable output overlay
  hooks/
    use-sitemap-actions.ts      — reactive action filtering + key assignment
    use-sitemap-fields.ts       — reactive form field filtering
    use-action-dispatch.ts      — dispatches by action type
    use-action-effect.ts        — effect state machine
    use-condition-context.ts    — builds flat context from TuiContext
  registry/
    tui-handler-registry.ts     — TuiActionHandler registration + lookup
    register-tui-handlers.ts    — entry point, delegates to sub-files
    effect-handlers.ts          — build, test, publish, reports, delete handlers
    form-handlers.ts            — form submit handlers (create, edit)
    navigation-handlers.ts      — handlers that return navigation targets
    condition-handlers.ts       — condition handlers (migrated from legacy)
    data-source-handlers.ts     — dynamic data source handlers
```

### 10.2 Modified Files

```
src/tui/shell/content-area.tsx    — replace page registry with sitemap lookup + custom override map
src/tui/primitives/action-bar.tsx — add disabled state + active effect indicator
src/tui/primitives/form-page.tsx  — accept sitemap field definitions directly
src/tui/context.tsx               — expose sitemap + TuiHandlerRegistry via context
src/tui/tui-entry.ts             — load sitemap, create TuiHandlerRegistry, register all handlers
```

### 10.3 Deleted Files (after migration)

```
src/tui/pages/*.tsx                     — most replaced by SitemapPage (keep chat, tour)
src/infrastructure/sitemap-router.ts    — legacy terminal router
src/infrastructure/form-runner.ts       — legacy terminal forms
src/ui/handlers/register-handlers.ts    — legacy handler registration
src/ui/handlers/*-handlers.ts           — legacy handlers
```

### 10.4 Kept As-Is

```
src/tui/loaders/*.ts                      — still provide typed data to SitemapPage
src/infrastructure/key-assigner.ts        — reused directly
src/infrastructure/sitemap-conditions.ts  — reused directly
src/domain/sitemap/unified-page.ts        — sitemap types
configs/sitemap.json                      — the contract, unchanged
```

## 11. Testing Strategy

- **Hook unit tests** — `useSitemapActions`, `useActionEffect`, `useConditionContext` tested with mock sitemap data and mock TuiContext
- **SitemapPage rendering tests** — verify correct layout chosen per `page.kind`, correct actions in ActionBar, conditions applied
- **Handler tests** — each `TuiActionHandler` tested in isolation with mock deps, verify return types
- **Integration tests** — key press → action dispatch → handler call → result rendering for each action type
- **Condition tests** — existing tests for expression evaluator and condition handlers continue to pass
- **Migration coverage** — every legacy handler ID has a corresponding `TuiActionHandler` registration
