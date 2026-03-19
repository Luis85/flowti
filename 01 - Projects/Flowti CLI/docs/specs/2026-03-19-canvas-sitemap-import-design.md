# Canvas-to-Sitemap Import — Design Spec

**Date:** 2026-03-19
**Status:** Draft

## Goal

Generate and maintain a project's `configs/sitemap.json` from an Obsidian `sitemap.canvas` file. The canvas is the visual design surface; the sitemap is the runtime contract. Changes to the canvas trigger a merge prompt.

## Sample Canvas Template

A `sitemap.canvas` ships with new projects showing a typical app structure:

- **Navigation** group (container): Home (green/page), Dashboard (green/page), Settings (orange/form)
- **Content** group (container): Items List (yellow/list), Item Detail (green/page), Edit Item (orange/form)
- **System** group (container): Login (red/dialog), Error (red/dialog), Not Found (purple/system)
- **Components** (no color, default): Header, Sidebar, Footer
- **Layout** node (blue): Main Layout
- Edges: Home → Dashboard, Dashboard → Items List, Items List → Item Detail, Item Detail → Edit Item, Header → Home (navigate)

## Color/Shape → Page Kind Mapping

| Element | Page Kind |
|---------|-----------|
| Default (no color, no shape) | `component` |
| Group | `container` |
| Color 1 (red) | `dialog` |
| Color 2 (orange) | `form` |
| Color 3 (yellow) | `list` |
| Color 4 (green) | `page` |
| Color 5 (blue) | `layout` |
| Color 6 (purple) | `system` |
| Diamond shape | `ui-component` |
| Circle shape | `person` |
| Document shape | `c4-component` |

## Canvas → Sitemap Pipeline

### Input
`$project/sitemap.canvas` — standard Obsidian canvas JSON (`{ nodes: [], edges: [] }`)

### Processing

1. **Parse nodes** — extract id, text/label, type (text/group), color, shape, position
2. **Determine parent** — nodes whose bounding box is inside a group node get that group as parent
3. **Map to PageObject** — using color/shape table above. Node text → `label`, kebab-cased text → page ID
4. **Build navigation actions** — edges become `{ type: "navigate", target: targetPageId }` actions on the source page
5. **Write sitemap** — `{ version: 2, pages: { ... } }` to `configs/sitemap.json`
6. **Store import metadata** — write `configs/.sitemap-canvas-meta.json` with `{ canvasHash: string, importedAt: string }`

### Output
`configs/sitemap.json` (v2 UnifiedSitemap)

## Merge Strategy (Additive)

When `configs/sitemap.json` already exists:

| Canvas state | Sitemap action |
|-------------|----------------|
| New node (not in sitemap) | Add as new page |
| Node still exists | Update `label`, `parent`, `kind` from canvas. Preserve existing `actions`, `dataSources`, `fields`, etc. |
| Node removed from canvas | Keep page in sitemap (never delete — may have hand-added config) |
| Edge added | Add navigate action if not already present |
| Edge removed | Keep existing navigate action (manual cleanup) |

Canvas-sourced fields (`label`, `kind`, `parent`, `description`) are overwritten on merge. User-added fields (`actions`, `dataSources`, `fields`, `onBeforeRender`, `route`) are preserved.

## Change Detection

On project load (`getProject()`):
1. Check if `sitemap.canvas` exists
2. If `configs/.sitemap-canvas-meta.json` exists, compare stored hash with current canvas content hash
3. If hashes differ → set `canvasChanged: true` on `ProjectDetail`
4. Plugin UI shows a notice: "Canvas changed — merge into sitemap?"

## CLI Command

### `storybook:canvas-import`

```
flowti storybook:canvas-import --project="MyProject"
```

Flags:
- `--project` (required) — project name
- `--canvas` (optional) — canvas path override (default: `$project/sitemap.canvas`)
- `--output` (optional) — output path override (default: `$project/configs/sitemap.json`)
- `--merge` (optional, boolean) — merge into existing sitemap instead of overwriting

Handler:
1. Read canvas JSON
2. Parse nodes/edges → page objects
3. If `--merge` and sitemap exists → additive merge
4. Else → fresh write
5. Write `.sitemap-canvas-meta.json` with canvas hash

## Plugin Integration

### Service Interface

Add to `IProjectService`:
```typescript
importCanvasSitemap(project: string, onOutput?: OutputCallback, opts?: { merge?: boolean }): Promise<{ ok: boolean; error?: string }>;
```

### ProjectDetail Extension

Add to `ProjectDetail`:
```typescript
readonly hasCanvas: boolean;       // sitemap.canvas exists
readonly canvasChanged: boolean;   // canvas hash differs from last import
```

### Scaffold Modal Update

The scaffold modal gains a canvas-aware state:

1. `hasCanvas && !hasSitemap` → "Import canvas and generate components" (primary)
2. `hasCanvas && hasSitemap && canvasChanged` → "Canvas changed — merge and regenerate?"
3. `hasSitemap` (no canvas changes) → existing "Generate from project sitemap" flow

### Change Notification

When `canvasChanged` is true and the user is on the project detail view, show a status banner: "sitemap.canvas has changed" with a "Merge" button. Clicking it runs canvas-import with `--merge`, then offers to re-scaffold.

## Sample Canvas Template

New file: `01 - Projects/Flowti CLI/configs/templates/sitemap.canvas`

Contains ~15 nodes:
- 3 groups (Navigation, Content, System)
- 6 page nodes (Home, Dashboard, Settings, Items List, Item Detail, Edit Item)
- 2 dialog nodes (Login, Error)
- 1 system node (Not Found)
- 3 component nodes (Header, Sidebar, Footer)
- 1 layout node (Main Layout)
- ~8 edges showing navigation flow

This template is copied to `$project/sitemap.canvas` on project creation.

## Domain Function (Pure)

```typescript
// canvas-sitemap-import.ts
export function parseCanvasToSitemap(
  canvasJson: string,
  existingSitemap?: UnifiedSitemap,
): { sitemap: UnifiedSitemap; added: number; updated: number }
```

- Pure function, no I/O
- Takes raw canvas JSON string + optional existing sitemap for merge
- Returns new sitemap + stats
- Tested with unit tests (canvas JSON fixtures)

## Files to Create

| File | Purpose |
|------|---------|
| `CLI/src/domain/make/canvas-sitemap-import.ts` | Pure domain: parse canvas → sitemap pages |
| `CLI/src/domain/make/canvas-sitemap-types.ts` | Types for canvas-to-sitemap mapping |
| `CLI/configs/templates/sitemap.canvas` | Sample canvas template for new projects |
| `CLI/tests/domain/make/canvas-sitemap-import.test.ts` | Unit tests with canvas fixtures |

## Files to Modify

| File | Change |
|------|--------|
| `CLI/src/controller/storybook.controller.ts` | Add `storybook:canvas-import` command |
| `CLI/tests/controller/storybook.controller.test.ts` | Test canvas-import command |
| `Plugin/src/domain/projects/types.ts` | Add `hasCanvas`, `canvasChanged` to ProjectDetail |
| `Plugin/src/infrastructure/projects/vault-project-service.ts` | Detect canvas, compute hash, implement `importCanvasSitemap` |
| `Plugin/src/infrastructure/handlers/project-handlers.ts` | Wire canvas-import event, change detection banner |
| `Plugin/src/components/projects/flowti-scaffold-modal.ts` | Canvas-aware states |
| `Plugin/src/components/projects/flowti-project-detail.ts` | Canvas change banner, pass new props |

## Out of Scope

- Bidirectional sync (sitemap → canvas). Canvas is source of truth for structure.
- Canvas visual preview in the sidepanel
- Automatic import on canvas save (user must confirm)
- Custom color/shape mappings per project (use the fixed table)
