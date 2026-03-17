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
- **3 JS bundles** with pathToFileURL hacks instead of a single ESM output

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
| P1 | Single-file ESM build |
| P2 | CRUD factory pattern for consistent store-backed domains |

## 3. Architecture: Content Renderer Registry

`SitemapPage` delegates content rendering to a **content renderer registry** — a map of `pageId` to renderer function. Default renderers handle 80% of pages; domain-specific renderers handle the rest.

### 3.1 Registry

```typescript
type ContentRenderer = (
  data: unknown,
  page: PageObject,
  params: Record<string, string>,
  nav: NavigationContextValue,
  registry: TuiHandlerRegistry,
  actionCtx: TuiActionContext,
) => React.JSX.Element;

const contentRenderers: Record<string, ContentRenderer> = {
  "iteration-detail": renderIterationDetail,
  "iterations": renderIterationsList,
  "projects-list": renderProjectsList,
  "project-detail": renderProjectDetail,
  "management": renderManagementHub,
  "agents-chat": renderAgentsChat,
};
```

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

### 5.3 CRUD Form Factory

```typescript
function createCrudFormHandlers(
  domain: string,
  store: StoreApi<unknown, unknown>,
  variants: CrudFormVariant[],
): void
```

Each variant defines: action name prefix (e.g., `"raid:add-risk"`), form title, field definitions, and a mapping from form data to store definition. The factory registers both the handler (returns `kind: "form"`) and the form handler (calls `store.create()`).

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

## 9. Single-File ESM Build

### 9.1 Current State (3 bundles)

```
esbuild.config.mjs
├── main.js   (CJS)  — core CLI, excludes ink/react
├── tui.mjs   (ESM)  — Ink TUI shell
└── chat.mjs  (ESM)  — Ink chat renderer

main.ts loads tui.mjs via pathToFileURL hack.
```

### 9.2 Target State (1 bundle)

```
esbuild.config.mjs
└── main.mjs  (ESM)  — everything in one file

main.ts:
  if (interactive) {
    const { runTui } = await import("./tui/tui-entry.js");
    await runTui();
  }
```

### 9.3 Changes

- `esbuild.config.mjs` → single build target, `format: "esm"`, `createRequire` banner for any remaining CJS patterns
- `main.ts` → remove `pathToFileURL` hack, direct `import()`
- `bootstrap.mjs` → reference `main.mjs` instead of `main.js`
- Lazy loading preserved: non-interactive commands (`flowti build`, `flowti health`) never import ink/react

### 9.4 Externals

ink and react remain external (loaded from `node_modules`). All other imports are bundled.

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

### 10.4 Build Tests

- Single `.mjs` file exists, no `.js` or second `.mjs`
- Non-interactive: `node main.mjs help` works without loading ink
- Interactive: TUI launches and renders

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

### AD-1: Content renderer functions, not page components

**Decision:** Custom renderers are functions `(data, page, ...) => JSX`, not full React components with their own hooks.

**Rationale:** Page components (the old 28 files) duplicated layout, action handling, and loader wiring. Renderer functions only own the content zone — SitemapPage handles everything else. Less code, consistent behavior, no registration ceremony.

**Exception:** Renderers that need hooks (agents-chat, iteration-detail with scope toggle) are thin wrapper components that call hooks internally but still conform to the renderer signature.

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

**Decision:** Chat is a content renderer registered in `content-renderers.ts`, using existing hooks (`use-chat-session`, `use-streaming-process`).

**Rationale:** Chat was the Ink PoC — it validated the entire TUI approach. Keeping it as a custom override page that bypasses sitemap-driven rendering contradicts the architecture. Making it a content renderer means it gets sitemap actions, EffectStrip, consistent layout, and focus zone integration for free.

### AD-6: Single ESM bundle with lazy TUI import

**Decision:** Merge 3 bundles into 1 ESM file. TUI and chat loaded via dynamic `import()`.

**Rationale:** The 3-bundle split was a CJS/ESM workaround. With ESM throughout, the hack (`pathToFileURL`) is unnecessary. Non-interactive commands skip the TUI import entirely, so there's no performance penalty.

## 13. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Content renderer registry grows large | Maintainability | Factory patterns keep custom renderers small; most pages use defaults |
| Inline form state conflicts with page navigation | Form data lost on accidental Escape | FormPage already has Escape claim via EscapeContext; double-press required |
| Heuristic list detection false positives | Page with `items[]` that isn't a list | Only applies to pages without a custom renderer; the heuristic checks `CrudPageData` shape specifically |
| Chat hooks need refactoring for renderer pattern | Scope creep | Hooks are already decoupled from the page component; renderer just consumes them |
| ESM migration breaks edge cases | CLI won't start | Separate chunk — can ship content parity first, build migration second |
| 34 new handlers + 10 new loaders = large PR | Review burden | Implementation plan chunks by domain; each chunk is independently testable and committable |
