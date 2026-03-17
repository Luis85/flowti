# TUI Functional Parity — Design Spec

**Date:** 2026-03-17
**Status:** Draft
**Supersedes:** `2026-03-16-tui-ux-overhaul-design.md` (Phase 2 only — Phase 1 delivered), `2026-03-16-tui-layout-polish-design.md` (delivered)
**Builds on:** `2026-03-17-sitemap-tui-renderer-design.md` (delivered)
**Scope:** Restore full interactive functionality to the sitemap-driven TUI — interactive lists, form input, iteration management, CRUD operations, agents chat as native feature, and single-file ESM build.

---

## 1. Problem

The sitemap-TUI renderer migration (2026-03-17) replaced 28 hardcoded page files with a single universal `SitemapPage` component. The architecture is clean, but the user-facing UX regressed:

- **List pages** render as flat read-only text (lost: selection, arrow keys, detail panels)
- **Form pages** render as read-only labels (lost: input, validation, submit)
- **34 of 143 action targets** have no handler implementation
- **10 pages** show "No loader" (blank)
- **22 iteration management handlers** are missing (create, edit scope, advance, assign agents)
- **Agents chat** is a custom override that bypasses the sitemap system

The TUI shell (focus zones, section memory, Tab/Escape, scroll stability, flexbox layout) works — that was delivered by the UX overhaul and layout polish specs. The primitives (`ListPage`, `FormPage`, `ScrollableList`, `MasterDetail`, `FormField`) exist and work. They just aren't used by the generic renderer.

## 2. Design Goals

| Priority | Goal |
|----------|------|
| P0 | Interactive lists with selection, arrow keys, and detail panels |
| P0 | Form input with text, select, toggle fields and submit/cancel |
| P0 | All 143 sitemap action targets have working handlers |
| P0 | All sitemap pages render meaningful content (no blank pages) |
| P0 | Full iteration lifecycle management in TUI |
| P1 | Agents chat as a native sitemap-driven page |
| P1 | Single-file ESM build (already delivered — verify after chat migration) |
| P2 | CRUD factory pattern for consistent store-backed domains |

## 3. Architecture: Content Renderer Registry

`SitemapPage` delegates content rendering to a **content renderer registry** — a map of `pageId` to renderer component. Default renderers handle 80% of pages; domain-specific renderers handle the rest.

### 3.1 Registry

Content renderers are React function components (not plain functions), because renderers that manage selection state, call hooks, or handle keyboard input need the full React lifecycle. The type is `React.FC<ContentRendererProps>`:

```typescript
interface ContentRendererProps {
  readonly data: unknown;
  readonly page: PageObject;
  readonly params: Record<string, string>;
  readonly nav: NavigationContextValue;
  readonly registry: TuiHandlerRegistry;
  readonly actionCtx: TuiActionContext;
  readonly onExtraParams?: (extra: Record<string, string>) => void;
  readonly enabled?: boolean;
}

type ContentRenderer = React.FC<ContentRendererProps>;

const contentRenderers: Record<string, ContentRenderer> = {
  "iteration-detail": IterationDetailRenderer,
  "iterations": IterationsListRenderer,
  "projects-list": ProjectsListRenderer,
  "project-detail": ProjectDetailRenderer,
  "management": ManagementHubRenderer,
  "agents-chat": AgentsChatRenderer,
};
```

The `onExtraParams` callback allows content renderers to communicate dynamic state (e.g., current list selection index) back to `SitemapPage` for inclusion in handler dispatch context. See Section 3.4.

### 3.2 ContentZone Resolution Order

```
1. contentRenderers[pageId] exists?  → call custom renderer
2. page.kind === "form"?             → DefaultFormRenderer (FormPage)
3. page.kind === "list"?             → DefaultListRenderer (ListPage + MasterDetail)
4. data has items[] array?           → DefaultListRenderer (CRUD pages are kind:"page" but have list data)
5. fallback                          → renderDashboardContent (current generic auto-layout)
```

Step 4 is critical: the 6 CRUD domain pages (resources, raid, capa, deliverables, requirements, timelog) are declared as `kind: "page"` in the sitemap, but their loaders return `CrudPageData<TSummary>` with an `items[]` array. The heuristic detects this and renders them as interactive lists.

### 3.3 File Structure

```
src/tui/sitemap/
  content-renderers.ts       — registry + all custom renderers
  default-list-renderer.tsx   — ListPage wrapper with per-page config
  default-form-renderer.tsx   — FormPage wrapper driven by TuiActionResult
  list-configs.ts             — renderItem/renderDetail/onSelect per pageId
  crud-form-factory.ts        — generates form+submit handlers from StoreApi
```

### 3.4 Dynamic Params: Content Renderer → Handler Dispatch

Content renderers that track selection state (iteration-detail scope list, CRUD lists) need to communicate the current selection to handler dispatch. The mechanism:

1. `SitemapPage` holds `extraParams` in `useState<Record<string, string>>({})`.
2. `SitemapPage` passes `onExtraParams` callback to the content renderer.
3. The content renderer calls `onExtraParams({ scopeIndex: "3" })` when selection changes.
4. `SitemapPage` merges `extraParams` into `actionCtx.params` when building the handler context.
5. Handlers read `ctx.params.scopeIndex` (or `ctx.params.selectedItem`, etc.) at dispatch time.

This avoids ref hacks and keeps the data flow unidirectional: renderer → state → handler context.

## 4. Default List Renderer

Replaces the generic `renderListContent` (flat text) with the existing `ListPage` primitive.

### 4.1 Rendering

```
DefaultListRenderer
  ├── ListPage (from src/tui/pages/list-page.tsx)
  │   ├── ScrollableList (arrow keys, selection highlight, virtualization)
  │   ├── MasterDetail (40/60 split if renderDetail provided)
  │   └── onSelect → navigate to detail page OR dispatch handler
  └── Per-page config from list-configs.ts
```

### 4.2 Per-Page List Config

```typescript
interface ListConfig<T> {
  getItems: (data: unknown) => readonly T[];
  renderItem: (item: T, index: number, selected: boolean) => React.ReactNode;
  renderDetail?: (item: T) => React.ReactNode;
  onSelect?: (item: T, nav: NavigationContextValue) => void;
}
```

### 4.3 Configs by Page

**Iterations:**
- `renderItem` → `#5 Agent World [in-progress] (12/28)`
- `renderDetail` → goal, dates, scope progress bar, agent list
- `onSelect` → `navigate("iteration-detail", { number: "5" })`

**Projects list:**
- `renderItem` → `Flowti CLI (/path)`
- `renderDetail` → project config summary
- `onSelect` → `navigate("project-detail", { name: "Flowti CLI" })`

**CRUD domains (6 stores):**
Generic factory `createCrudListConfig(store)` generates config from `StoreApi.__descriptor`:
- `renderItem` → `name (status)` using the store's summary type
- `renderDetail` → all summary fields in a vertical layout
- `onSelect` → no-op (detail panel shows everything)

Domains: resources, requirements, deliverables, raid, capa, timelog.

## 5. Default Form Renderer

Forms are triggered by handler actions, not by sitemap page kind (the sitemap has 0 form pages).

### 5.1 Flow

```
User presses action key (e.g., "2" for Add Risk)
    ↓
dispatchAction calls handler
    ↓
Handler returns { kind: "form", title, fields, submitHandler }
    ↓
SitemapPage swaps ContentZone to FormPage
    ├── FormField components (text, select, toggle)
    ├── Tab navigation, arrow keys for select cycling
    ├── Enter → submit → calls TuiFormHandler → result
    ├── Escape → cancel → restore ContentZone
    └── Success → EffectStrip flash + refresh page data
```

### 5.2 New TuiActionResult Variant

```typescript
type TuiActionResult =
  | { kind: "ok"; message?: string }
  | { kind: "navigate"; target: string; params?: Record<string, string> }
  | { kind: "error"; message: string }
  | { kind: "form"; title: string; fields: FormFieldDef[]; submitHandler: string }
```

### 5.3 Form State Management in SitemapPage

The `kind: "form"` result must propagate from the handler dispatch chain back to `SitemapPage` to swap the content zone. The mechanism:

1. `SitemapPage` holds `formState: FormDef | null` in `useState`, where `FormDef = { title: string; fields: FormFieldDef[]; submitHandler: string }`.
2. `dispatchAction` is modified to return `Promise<TuiActionResult>` instead of `Promise<void>`.
3. `useActionEffect.run()` accepts an optional `onFormRequested?: (form: FormDef) => void` callback. When the handler returns `kind: "form"`, `run()` calls `onFormRequested(result)` instead of flashing a success message.
4. `SitemapPage`'s `handleAction` callback passes `onFormRequested: (form) => setFormState(form)` to `effect.run()`.
5. When `formState !== null`, `ContentZone` renders `FormPage` instead of the normal content. On submit, `SitemapPage` calls `registry.getFormHandler(formState.submitHandler)` with collected form data. On success, it clears `formState` and refreshes the page loader. On cancel (Escape), it clears `formState`.

This keeps the form state in the React tree (not in the handler dispatch chain), avoids breaking the existing `useActionEffect` success/error flow, and integrates cleanly with `FormPage`'s existing Escape claim via `EscapeContext`.

### 5.4 CRUD Form Factory

```typescript
interface CrudFormVariant {
  readonly actionId: string;       // e.g., "raid:add-risk"
  readonly submitId: string;       // e.g., "raid:create-risk"
  readonly title: string;          // e.g., "Add Risk"
  readonly fields: FormFieldDef[]; // form field definitions
  readonly buildDef: (data: Record<string, string | boolean>) => unknown; // maps form data → store definition
}

function createCrudFormHandlers(
  registry: TuiHandlerRegistry,
  store: StoreApi<unknown, unknown>,
  variants: readonly CrudFormVariant[],
): void
```

Each variant defines: the action handler ID (returns `kind: "form"`), the form submit handler ID (calls `store.create()`), the form title, field definitions, and a `buildDef` function that maps form data to a typed store definition.

The factory registers both: the handler (returns `kind: "form"` with the variant's fields) and the form handler (calls `store.create(deps, projectPath, buildDef(data))`).

**Important:** The factory replaces the stub navigate handlers currently in `crud-effect-handlers.ts`. Those stubs must be removed before the factory registers the same IDs — `TuiHandlerRegistry.registerHandler` throws on duplicate registration.

**Domains covered:**
- Resources: add-human, add-material, add-role, add-budget
- Requirements: add-functional, add-nonfunctional, add-constraint, add-usecase, add-userstory
- Deliverables: add
- RAID: add-risk, add-assumption, add-issue, add-dependency, add-decision
- CAPA: add-corrective, add-preventive
- Timelog: add

**Update-status handlers:** Each CRUD domain has an `update-status` action. These use a single-field select form with the store's status enum options.

## 6. Iteration Management

22 handlers across 3 groups.

### 6.1 Form-Based (Group A)

| Handler | Form Fields | Store Call |
|---------|------------|------------|
| `iteration:create` | name, goal, startDate, endDate | `createIteration()` |
| `iteration:edit-name` | name | `updateIteration()` field |
| `iteration:edit-goal` | goal | `updateIteration()` field |
| `iteration:edit-description` | description | `updateIteration()` field |
| `iteration:edit-dates` | startDate, endDate | `updateIteration()` fields |
| `iteration:edit-scope` | scope text | `updateScopeItem()` |
| `iteration:add-scope` | text | `addScopeItem()` |
| `iteration:add-agent` | agent (select from roster) | `addAgent()` |
| `iteration:add-resource` | name, role, allocation | `addResource()` |
| `iteration:add-estimation` | hours, description | `addEstimation()` |

### 6.2 Effect Handlers (Group B)

| Handler | Action |
|---------|--------|
| `iteration:advance` | `advanceIteration()` → returns ok/error |
| `iteration:remove-scope` | `removeScopeItem()` using selected index from params |
| `iteration:execute-full` | Runs full iteration pipeline |
| `iteration:roster-task` | Assigns task from roster |

### 6.3 Navigation Handlers (Group C)

| Handler | Target |
|---------|--------|
| `iteration:list` | Refresh current page |
| `iteration:browse` | `navigate("iteration-detail", { number })` |
| `iteration:plan-ahead` | `navigate("iteration-planning")` |

### 6.4 Custom Content Renderer: `iteration-detail`

```
StatGrid: name, status, startDate → endDate, progress (scopeDone/scopeTotal)

Section "Goal":
  Goal text

Section "Scope Items":
  ScrollableList with [x]/[ ] checkboxes
    ├── Enter → toggle done (calls toggleScopeItem)
    └── Selection tracked for remove-scope action in params

Section "Agents":
  List of assigned agents (name | domain)
```

### 6.5 Custom Content Renderer: `iterations` List

```
MasterDetail layout:
  Master (40%):
    ScrollableList of iterations
      renderItem: "#5 Agent World [in-progress] 12/28"
  Detail (60%):
    Selected iteration's goal, dates, scope summary, agent list
  onSelect: navigate("iteration-detail", { number })
```

### 6.6 Missing Loader: `iteration-planning`

Reuses `loadIterations` data — shows the current in-progress iteration context plus a form for creating the next iteration.

## 7. Remaining Gaps

### 7.1 Missing Loaders

| Page | Solution |
|------|----------|
| `management` | No loader needed — action-only navigation hub |
| `iteration-planning` | Reuse `loadIterations` |
| `agents-dashboard` | New loader: list agents with status from agent files |
| `agent-edit` | Reuse `loadAgentDetail` — form overlay handles editing |
| `components` | New loader: list components from config |
| `component-detail` | New loader: read component by params.name |
| `docs` | New loader: list markdown files in docs/ |
| `onboarding-checklist` | Reuse `loadOnboarding` |
| `workspaces` | New loader: list git worktrees via shell |

### 7.2 Missing Handlers by Domain

| Domain | Count | Strategy |
|--------|-------|----------|
| Iteration | 22 | Section 6 design (form + effect + navigation) |
| AI tools | 4 | CRUD factory (list, create, validate, reference) |
| Components | 8 | CRUD factory + form handlers for prop/field/relation editing |
| Plugins | 4 | CRUD factory (list, create, validate, reference) |

### 7.3 Custom Content Renderers

| Page | Reason |
|------|--------|
| `iteration-detail` | Toggleable scope items, agent assignment |
| `iterations` | ListPage + MasterDetail with scope progress |
| `projects-list` | ListPage + MasterDetail with project stats |
| `project-detail` | StatGrid + domain-specific sections |
| `management` | Action-only hub (no data content, just sitemap actions) |
| `agents-chat` | Chat interface (Section 8) |

## 8. Agents Chat as Native Sitemap Feature

The agent chat was the PoC that validated Ink for the TUI. It must be a first-class sitemap-driven page, not a custom override.

### 8.1 Sitemap Change

`agents-chat` page kind changes from `component` to `page` in `sitemap.json`. Actions declared in sitemap: back, select agent, clear history, export chat.

### 8.2 Content Renderer

```
agents-chat content renderer:
├── Agent selector (if no agent selected)
│   └── ScrollableList of agents → select to start chat
├── Chat view (when agent selected)
│   ├── Message history (ScrollableList, auto-scroll to bottom)
│   │   ├── Agent messages: colored by agent persona
│   │   └── User messages: plain
│   ├── Streaming indicator (when agent is responding)
│   │   └── Animated dots + partial response text
│   └── Input line (text input, focused, Enter to send)
└── Hooks:
    ├── use-chat-session.ts — session management, message history
    └── use-streaming-process.ts — agent process streaming
```

### 8.3 What Gets Deleted

- `src/tui/pages/agents-chat-page.tsx` — replaced by content renderer
- The custom page registration import in `tui-entry.ts`
- `chat.mjs` separate bundle — absorbed by single-file build (Section 9)

### 8.4 What Gets Kept

- `use-chat-session.ts` — domain logic, hooks into chat content renderer
- `use-streaming-process.ts` — streaming infrastructure, consumed by renderer
- `ink-chat-renderer.ts` — the rendering primitives (message display, input, streaming indicator) — refactored into the content renderer

## 9. Single-File ESM Build — Already Delivered

The single-file ESM build was delivered as part of the sitemap-TUI renderer migration. `esbuild.config.mjs` already produces a single `main.mjs` (ESM), marks ink/react as external, includes the `createRequire` banner, and cleans up stale 3-bundle artifacts (`main.js`, `tui.mjs`, `chat.mjs`).

**Remaining work:** When `agents-chat-page.tsx` is deleted and replaced by a content renderer (Section 8), the separate `chat.mjs` entry point becomes dead code. The esbuild config already handles this — the chat code is absorbed into the single bundle via normal imports. No build config changes needed.

**Verification:** After the agents-chat migration, confirm that `node .flowti/bin/main.mjs help` works without loading ink, and that the TUI launches correctly with chat integrated.

## 10. Testing Strategy

### 10.1 Content Renderer Tests

- Default list renderer: items render in ScrollableList, selection works, detail panel shows, onSelect fires
- Default form renderer: fields render, Tab navigation, Enter submit, Escape cancel, handler called
- Each custom content renderer: verify data shape renders correctly

### 10.2 Handler Tests

- CRUD factory: verify generated handlers return correct form definitions and form handlers call store methods
- Iteration handlers: create, advance, toggle scope, add agent — each tested with mock deps
- Form flow: handler returns `kind: "form"` → SitemapPage shows FormPage → submit calls form handler → success refreshes

### 10.3 Integration Tests

- Key press → action dispatch → handler → form display → submit → store mutation → page refresh
- List selection → navigate to detail page → back returns to list with selection preserved

### 10.4 Build Verification (post-chat migration)

- `node .flowti/bin/main.mjs help` works without loading ink
- TUI launches and renders with chat integrated
- No stale `chat.mjs` referenced anywhere

## 11. Dependency on Existing Primitives

All rendering uses existing, tested primitives from the layout polish spec:

| Primitive | Location | Used By |
|-----------|----------|---------|
| `ScrollableList` | `src/tui/primitives/scrollable-list.tsx` | Default list renderer, iteration-detail scope, chat messages |
| `MasterDetail` | `src/tui/primitives/master-detail.tsx` | Default list renderer (detail panel) |
| `ListPage` | `src/tui/pages/list-page.tsx` | Default list renderer wrapper |
| `FormPage` | `src/tui/pages/form-page.tsx` | Default form renderer wrapper |
| `FormField` | `src/tui/primitives/form-field.tsx` | FormPage fields (text, select, toggle) |
| `StatGrid` | `src/tui/primitives/stat-grid.tsx` | Dashboard renderers, iteration-detail header |
| `ActionBar` | `src/tui/primitives/action-bar.tsx` | SitemapPage (unchanged) |

## 12. Architecture Decisions

### AD-1: Content renderer components, not page components

**Decision:** Custom renderers are `React.FC<ContentRendererProps>` — React function components that receive standardized props and return JSX for the content zone only. They are NOT full page components (no layout duplication, no action handling, no loader wiring).

**Rationale:** Page components (the old 28 files) duplicated layout, action handling, and loader wiring. Renderer components only own the content zone — SitemapPage handles everything else. Less code, consistent behavior. Using `React.FC` (not plain functions) is required because renderers that manage selection state, call hooks (`useState`, `useInput`, `useChatSession`), or handle keyboard input need the full React lifecycle. In React's rules, a function that calls hooks IS a component — making this explicit in the type avoids confusion.

### AD-2: Heuristic list detection for CRUD pages

**Decision:** If a `kind: "page"` loader returns data with an `items[]` array, render it as a list.

**Rationale:** The 6 CRUD domain pages are declared as `kind: "page"` in the sitemap (not `kind: "list"`), but their loaders return `CrudPageData<TSummary>` with `items[]`. Changing the sitemap kind would break action definitions. The heuristic bridges the gap without sitemap changes.

### AD-3: Inline forms, not form pages

**Decision:** Forms appear inline in the content zone (replacing the current content temporarily), not as separate navigated pages.

**Rationale:** The sitemap has 0 form pages. Creating form pages would mean adding ~20 new sitemap entries, each with field definitions that duplicate store descriptors. Instead, handlers return form definitions and SitemapPage renders them inline. The form data lives in the handler registry, not the sitemap.

### AD-4: CRUD factory generates handlers from store descriptors

**Decision:** A factory function reads `StoreApi.__descriptor` (fields, name, typeTag) to generate form definitions and submit handlers automatically.

**Rationale:** 6 CRUD domains x ~4 add actions = ~24 handlers. Writing each by hand produces ~720 lines of near-identical code. The factory produces all 24 from ~60 lines of config.

### AD-5: Agents chat as content renderer

**Decision:** Chat is a content renderer component registered in `content-renderers.ts`, using existing hooks (`use-chat-session`, `use-streaming-process`).

**Rationale:** Chat was the Ink PoC — it validated the entire TUI approach. Keeping it as a custom override page that bypasses sitemap-driven rendering contradicts the architecture. Making it a content renderer means it gets sitemap actions, EffectStrip, consistent layout, and focus zone integration for free.

**Component location:** The chat display components (`MessageArea`, `InputArea`, `StreamingIndicator`) currently live in `src/infrastructure/chat/components/`. These move to `src/tui/chat/` — they are presentation-only components that belong in the TUI layer, not infrastructure. The content renderer in `content-renderers.ts` imports from `src/tui/chat/`. The hooks (`use-chat-session.ts`, `use-streaming-process.ts`) stay in `src/tui/hooks/` where they already are.

### AD-6: Single ESM bundle (already delivered)

**Decision:** The 3-bundle → 1-bundle migration was completed as part of the sitemap-TUI renderer work. No further build changes needed.

**Remaining action:** When `agents-chat-page.tsx` is deleted (Section 8.3), verify that the chat code is absorbed into the single bundle via normal imports. No build config changes expected.

## 13. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Content renderer registry grows large | Maintainability | Factory patterns keep custom renderers small; most pages use defaults |
| Inline form state conflicts with page navigation | Form data lost on accidental Escape | FormPage already has Escape claim via EscapeContext; double-press required |
| Heuristic list detection false positives | Page with `items[]` that isn't a list | Only applies to pages without a custom renderer; the heuristic checks `CrudPageData` shape specifically |
| Chat hooks need refactoring for renderer pattern | Scope creep | Hooks are already decoupled from the page component; renderer just consumes them |
| Chat component move breaks imports | Build fails | Move components first, update imports, run tsc before proceeding |
| 34 new handlers + 10 new loaders = large PR | Review burden | Implementation plan chunks by domain; each chunk is independently testable and committable |
