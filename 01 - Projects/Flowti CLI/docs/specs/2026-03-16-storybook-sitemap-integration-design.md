# Storybook Sitemap Integration — Design Spec

**Date:** 2026-03-16
**Status:** Draft
**Scope:** Flowti CLI — Component System + Storybook

## Overview

Integrate Flowti CLI's sitemap-driven UI with vanilla Storybook (`@storybook/html-vite`) so that every sitemap page is viewable as a terminal-styled story. The entire sitemap becomes importable as a component library, with each page rendered inside a simulated terminal view.

## Goals

1. Import all sitemap pages as component definitions via the existing library pipeline
2. Render each page as a static terminal mock (dark background, monospace, action list with keys and group separators)
3. Provide a reusable terminal-view layout component (kind `"layout"`) with its own story
4. Reuse existing infrastructure: story templates, library import, dirty detection, Storybook lifecycle
5. Switch the Flowti CLI project framework from `"angular"` to `"html"` for vanilla Storybook

## Non-Goals

- Live CLI execution inside Storybook (the terminal view is a static mock)
- Angular or React rendering — HTML/Vite only for CLI-type projects
- Changes to the Ink TUI system
- New Storybook addons or plugins

## Architecture

### User Journey

1. Start Flowti CLI -> Open project -> Navigate to **Components** page
2. The `sitemap-ops` data source shows "Import from Sitemap (N pages)" as a dynamic menu entry
3. User selects it -> `sitemapToComponents()` reads `sitemap.json`, produces instance JSONs
4. JSONs are written as a library under `components/sitemap/`
5. Existing `importAllLibraryDefinitions()` scaffolds all files (`.ts`, `.stories.ts`, `.md`, `.test.ts`)
6. User runs **Start Storybook** -> Storybook opens showing the full CLI app

### What's New vs What's Reused

| Piece | Status |
|-------|--------|
| `sitemapToComponents()` mapper | **New** — pure domain function |
| `terminalPageComponentTemplate()` | **New** — custom `ComponentTemplateFn` for terminal-styled page rendering |
| `terminalViewComponentTemplate()` | **New** — custom `ComponentTemplateFn` for the layout wrapper |
| Terminal-view layout definition JSON | **New** — blueprint for the layout |
| `sitemap-ops` data source handler | **New** — wires the import action |
| `comp:sitemap-import` action handler | **New** — orchestrates the import |
| Story generation | **Reused** — `componentStoryTemplate()` HTML path |
| Library import pipeline | **Reused** — `importLibraryDefinition()` |
| Dirty detection / regen | **Reused** — `detectDirtyComponents()` |
| Storybook install/start/stop/build | **Reused** — existing storybook domain |
| Component handlers | **Reused** — existing `component-handlers.ts` |

## Detailed Design

### 1. Sitemap-to-ComponentDefinition Mapper

**Location:** `src/domain/make/component/sitemap-to-components.ts`

**Signature:**

```typescript
import type { PageObject } from "../../sitemap/unified-page.js";

export function sitemapToComponents(
    pages: Record<string, PageObject>,
    projectKind: string,
): SitemapInstanceJson[];
```

**Input:** Parsed sitemap JSON `pages` object (typed as `Record<string, PageObject>`) + project kind (e.g. `"cli"`)

**Output:** Array of `SitemapInstanceJson` objects — one per sitemap page plus the terminal-view layout. These are lightweight manifests matching the format consumed by `importLibraryDefinition()`.

**`SitemapInstanceJson` shape:**

```typescript
export interface SitemapInstanceJson {
    type: string;           // Blueprint ID: "terminal-page" or "terminal-view"
    name: string;           // Component name (from page key)
    description: string;    // From page.description, fallback to page.label
    domain?: string;        // From page.domain
    label?: string;         // From page.label (for template use)
    icon?: string;          // From page.icon (for template use)
    actions?: SitemapAction[]; // Serialized sitemap actions (for template use)
    parent?: string;        // From page.parent (metadata)
}
```

**All sitemap-imported pages use `type: "terminal-page"` regardless of their source `PageKind`.** The kind conversion table (below) is used only to populate the blueprint's `kind` field for Storybook categorization — it does not affect which blueprint is selected. This ensures every imported page gets terminal-styled rendering.

**Instance JSON format:** The library import pipeline reads a specific JSON shape:
- `type` — resolved by `resolveBlueprint()` against bundled definitions (must match a `ComponentKind`)
- `name` — component display name
- `description`, `domain`, etc. — passed through `buildVarsFromRecord()`

The mapper does NOT produce full `ComponentDefinition` objects. It produces the instance JSON that the library import pipeline expects.

**Kind Mapping:**

Sitemap `PageKind` values do not all exist in `ComponentKind`. The mapper applies an explicit conversion:

| PageKind | Storybook Category | Rationale |
|----------|-------------------|-----------|
| `"page"` | `"page"` | Direct match |
| `"layout"` | `"layout"` | Direct match |
| `"component"` | `"component"` | Direct match |
| `"ui-component"` | `"ui-component"` | Direct match |
| `"system"` | `"system"` | Direct match |
| `"container"` | `"container"` | Direct match |
| `"c4-component"` | `"c4-component"` | Direct match |
| `"person"` | `"person"` | Direct match |
| `"list"` | `"page"` | List views are page-level — categorized as Pages in Storybook |
| `"form"` | `"page"` | Forms are page-level views |
| `"dialog"` | `"component"` | Dialogs are modal components |

This table is for Storybook sidebar categorization only (via `kindToFolder()`). It does NOT affect the `type` field — all sitemap pages use `type: "terminal-page"` and the layout uses `type: "terminal-view"`.

**Mapping Rules:**

| Sitemap Field | Instance JSON Field | Notes |
|---|---|---|
| page key (e.g. `"start"`) | `name` | Used as component name |
| (fixed) | `type` | Always `"terminal-page"` (or `"terminal-view"` for layout) |
| `page.kind` (after conversion) | `storybookCategory` | For Storybook sidebar grouping via `kindToFolder()` |
| `page.description` | `description` | Falls back to `label` if missing |
| `page.domain` | `domain` | Preserved |
| `page.icon` | Stored in instance JSON for template use | |
| `page.label` | Stored in instance JSON for template use | |
| `page.actions[]` | Stored in instance JSON for template use | Serialized for the custom template to consume |
| `page.parent` | Stored in instance JSON as metadata | |

**Terminal-View Layout Instance:**

Generated as a separate instance JSON:
- `type: "terminal-view"`, `name: "terminal-view"`
- Additional fields for the custom template: `title` (string), `width` (number, default 80)

**Library Structure on Disk (after writing JSONs):**

```
components/sitemap/
+-- terminal-view.json
+-- start.json
+-- project-detail.json
+-- components.json
+-- ...  (one per sitemap page)
```

**After library import scaffolds files (via `relocateDefinitionJson`):**

```
components/sitemap/terminal-view/
+-- terminal-view.json
+-- terminal-view.ts
+-- terminal-view.stories.ts
+-- terminal-view.md
+-- terminal-view.test.ts
components/sitemap/start/
+-- start.json
+-- start.ts
+-- start.stories.ts
+-- start.md
+-- start.test.ts
```

### 2. Custom Component Templates

The generic `componentComponentTemplate()` produces bare `<div>` factories with data attributes. For sitemap-imported pages, we need terminal-styled rendering. This requires **two new `ComponentTemplateFn` functions** registered in the template registry.

#### Template Registration

In `component-registry.ts`, register the new templates:

```typescript
registry.set("terminal-view-component", terminalViewComponentTemplate);
registry.set("terminal-page-component", terminalPageComponentTemplate);
```

#### New Blueprint Definitions

Two new bundled definition JSONs that reference the custom templates:

**`definitions/terminal-view.json`** — Layout blueprint:
```json
{
    "id": "terminal-view",
    "kind": "layout",
    "files": [
        { "path": "components/{{kebab}}/{{kebab}}.md", "templateId": "component-doc" },
        { "path": "components/{{kebab}}/{{kebab}}.test.ts", "templateId": "component-test" },
        { "path": "components/{{kebab}}/{{kebab}}.json", "templateId": "component-definition" },
        { "path": "components/{{kebab}}/{{kebab}}.ts", "templateId": "terminal-view-component" },
        { "path": "components/{{kebab}}/{{kebab}}.stories.ts", "templateId": "component-story" },
        { "path": "components/{{kebab}}/{{kebab}}.css", "templateId": "terminal-view-css" }
    ],
    ...
}
```

**`definitions/terminal-page.json`** — Page blueprint (used instead of generic `page` for sitemap imports):
```json
{
    "id": "terminal-page",
    "kind": "page",
    "files": [
        { "path": "components/{{kebab}}/{{kebab}}.md", "templateId": "component-doc" },
        { "path": "components/{{kebab}}/{{kebab}}.test.ts", "templateId": "component-test" },
        { "path": "components/{{kebab}}/{{kebab}}.json", "templateId": "component-definition" },
        { "path": "components/{{kebab}}/{{kebab}}.ts", "templateId": "terminal-page-component" },
        { "path": "components/{{kebab}}/{{kebab}}.stories.ts", "templateId": "component-story" }
    ],
    ...
}
```

The mapper writes `type: "terminal-page"` (or `type: "terminal-view"` for the layout) in the instance JSON.

**Blueprint Resolution Change:** Currently `resolveBlueprint()` matches on `d.kind`, which would not find `terminal-page` or `terminal-view` since those are `id` values, not `kind` values. The function must be updated to match on `d.id` first, falling back to `d.kind`:

```typescript
export function resolveBlueprint(instanceType: string): ComponentDefinition | null {
    const defs = loadComponentDefinitions();
    return defs.find((d) => d.id === instanceType)
        ?? defs.find((d) => d.kind === instanceType)
        ?? null;
}
```

This is a one-line change that is backward-compatible — existing consumers pass `kind` values like `"page"` or `"component"`, which still match via the fallback. New consumers can pass `id` values like `"terminal-page"` for specific blueprint selection.

The new definitions are added to `BUNDLED_DEFINITIONS` in `component-registry.ts` alongside the existing 8 definitions.

#### Terminal View Layout Template (`terminal-view-component`)

**Location:** `src/domain/make/component/templates/terminal-view-component.ts`

The factory `createTerminalView(props)` returns an HTMLElement styled as a terminal window:

```
+-- [title] -----------------------------------+
|                                               |
|  [slot: content]                              |
|                                               |
+-----------------------------------------------+
```

- CSS classes: `.terminal-view`, `.terminal-view--title-bar`, `.terminal-view--content`
- Title bar: dot-trio (red/yellow/green) + `props.title`
- Content: child div for page injection
- Styling: monospace font, dark background (#1e1e2e), light text (#cdd6f4)
- Width controlled by `props.width` (default 80ch)

#### Terminal Page Template (`terminal-page-component`)

**Location:** `src/domain/make/component/templates/terminal-page-component.ts`

Each page factory builds CLI-style content:

1. **Page header** — label + description
2. **Action list** — grouped by `group`, with horizontal rule separators between groups
3. Each action: `[key] Label` with dimmed key styling
4. Hidden actions: muted/disabled style
5. Disabled actions: strikethrough

The template reads the sitemap action data from the instance JSON (stored during mapping) and generates a factory that imports and wraps with terminal-view:

```typescript
import { createTerminalView } from "../terminal-view/terminal-view.js";

export function createStart(props: StartProps = {}): HTMLElement {
    const terminal = createTerminalView({ title: "Start Menu" });
    const content = terminal.querySelector(".terminal-view--content")!;
    // ... render actions into content (generated from sitemap data)
    return terminal;
}
```

#### CSS Delivery

A `terminal-view-css` template generates `terminal-view.css` in the terminal-view component folder. Imported in Storybook's `preview.ts` via a global import or the story `parameters`.

### 3. Story Template

**No changes to `componentStoryTemplate()` required.** The existing HTML path handles everything:

- `render: (args) => createFoo(args)` — works for both page factories and the terminal-view layout
- `argTypes` from `properties[]` — action labels become text controls
- `variants[]` from action groups — one story per group
- `states[]` -> `EmptyState` story (page with no actions)
- Action loggers from `actions[]` — Storybook logs clicks

The `kindToFolder()` function maps `"layout"` -> `"Layouts"` and `"page"` -> `"Pages"`, which is correct since the mapper normalizes `"list"` -> `"page"` before generating definitions.

### 4. Wiring

#### `sitemap-ops` Data Source

Already declared in `sitemap.json` on the components page (slot `"sitemap-ops"`). This slot is currently unregistered — it silently returns an empty array. Register handler in `component-handlers.ts`:

```typescript
registry.registerDataSource("sitemap-ops", (ctx) => {
    // Read sitemap.json, count pages dynamically
    // Return menu entry: "Import from Sitemap (N pages)"
});
```

#### Import Action

New action target `comp:sitemap-import` in `component-handlers.ts`:

1. Read `sitemap.json` from project config path
2. Call `sitemapToComponents(sitemap.pages, projectKind)` — returns instance JSONs
3. Write each instance JSON as `.json` under `components/sitemap/`
4. Call `importAllLibraryDefinitions(projectRoot, "sitemap", deps, storybookFramework)` to scaffold files
5. Report: N pages imported, N files written

#### Sitemap Action

New action on the components page in `sitemap.json`:

```json
{
    "name": "onImportSitemap",
    "label": "Import from Sitemap",
    "type": "handler",
    "target": "comp:sitemap-import",
    "key": "m",
    "group": "create"
}
```

#### Config Change

`configs/flowti.config.json`: change `components.framework` from `"angular"` to `"html"`.

**Migration note:** Verify no existing Angular components exist in the project before switching. If they do, either migrate them to HTML or make the framework setting per-component rather than global.

### 5. Regeneration

Regeneration is a **two-step flow**:

**Step 1 — Re-import:** When the sitemap changes, the user re-runs "Import from Sitemap" (`comp:sitemap-import`). The mapper re-generates instance JSONs, overwriting existing ones under `components/sitemap/`. This is idempotent.

**Step 2 — Regenerate:** The user runs "Regenerate Dirty" (`comp:regen-dirty`). Dirty detection (`detectDirtyComponents()`) compares `.json` mtime against generated files and regenerates stale ones via `regenerateComponent()`.

The two steps are intentionally separate: the user decides when to pull in sitemap changes. The "Regenerate Dirty" action only processes components whose definitions have already been updated.

**Future enhancement:** A convenience action "Sync from Sitemap" could combine both steps, but this is out of scope for the initial implementation.

## Testing Strategy

### `sitemapToComponents()` — Unit Tests

**Location:** `tests/domain/make/component/sitemap-to-components.test.ts`

Pure function, no mocks needed. Verify:
- Each sitemap page maps to a valid instance JSON with correct `type` field
- Kind conversion table works (`"list"` -> `"page"`, `"form"` -> `"page"`, `"dialog"` -> `"component"`)
- Terminal-view layout instance is included
- Sitemap actions are serialized into instance JSON for template consumption
- Edge cases: pages with no actions, pages with no description (fallback to label), empty sitemap, all PageKind variants

### Custom Templates — Unit Tests

**Location:** `tests/domain/make/component/templates/terminal-view-component.test.ts` and `terminal-page-component.test.ts`

Verify:
- Terminal-view factory generates correct HTML structure (title bar, content slot, CSS classes)
- Terminal-page factory generates action list with keys, group separators, correct imports
- Properties render as controls
- Edge cases: pages with single group, pages with hidden/disabled actions

### `sitemap-ops` Data Source — Unit Test

Verify returns correct menu entry with dynamic page count from mocked sitemap.

### `comp:sitemap-import` Action — Integration Test

Mock `disk` and `paths`. Verify:
- Instance JSON files written to `components/sitemap/`
- Library import called correctly
- Result count matches sitemap page count
- Idempotent on re-run (overwrites existing JSONs)

### Existing Test Helpers

All existing helpers apply: `createMockFs()`, `createMockPaths()`, `createProjectContext()`.

## File Inventory

### New Files

| File | Purpose |
|------|---------|
| `src/domain/make/component/sitemap-to-components.ts` | Mapper: sitemap pages -> instance JSON array |
| `src/domain/make/component/templates/terminal-view-component.ts` | Custom template: terminal layout HTML factory |
| `src/domain/make/component/templates/terminal-page-component.ts` | Custom template: terminal-styled page HTML factory |
| `src/domain/make/component/templates/terminal-view-css.ts` | Custom template: terminal CSS |
| `src/domain/make/component/definitions/terminal-view.json` | Blueprint definition for terminal-view layout |
| `src/domain/make/component/definitions/terminal-page.json` | Blueprint definition for terminal-styled pages |
| `tests/domain/make/component/sitemap-to-components.test.ts` | Unit tests for mapper |
| `tests/domain/make/component/templates/terminal-view-component.test.ts` | Unit tests for layout template |
| `tests/domain/make/component/templates/terminal-page-component.test.ts` | Unit tests for page template |

### Modified Files

| File | Change |
|------|--------|
| `src/domain/make/component/component-registry.ts` | Register 2 new templates + 2 new bundled definitions |
| `src/domain/make/component/component-commands.ts` | Update `resolveBlueprint()` to match `d.id` first, fallback to `d.kind` |
| `src/ui/handlers/component-handlers.ts` | Register `sitemap-ops` data source + `comp:sitemap-import` action |
| `configs/sitemap.json` | Add `onImportSitemap` action to components page |
| `configs/flowti.config.json` | Change `components.framework` to `"html"` |

### Generated Files (by existing pipeline, after import)

```
components/sitemap/terminal-view/  (6 files — includes .css)
components/sitemap/{page-name}/    (5 files x N pages, where N = sitemap page count)
```

## Dependencies

- No new npm packages
- No new infrastructure modules
- All domain code is pure (no I/O imports)
- New templates follow existing `ComponentTemplateFn` signature
- New definitions follow existing bundled definition JSON schema
- Story template reused without changes
