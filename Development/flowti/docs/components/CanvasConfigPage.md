---
type: Component
domain: Flowti
stage: done
description: "Configuration form with split layout for general settings, color/shape mappings, and type exclusion"
source: "[[Development/flowti/src/ui/canvas/CanvasConfigPage.ts|CanvasConfigPage.ts]]"
parent: "[[CanvasActionView]]"
tags:
  - canvas
  - component
---

# CanvasConfigPage

## Description

CanvasConfigPage renders the configuration form for canvas import settings. It uses a split layout: the left panel contains general settings (target folder, conflict strategy, hierarchy mode, artifact toggles) and the right panel contains color/shape mapping tables with inline editing and a type exclusion grid.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `container` | `HTMLElement` | Parent DOM element to render into |
| `deps` | `CanvasComponentDeps` | Shared dependency bag providing state, callbacks, and Obsidian API |
| `deps.getState()` | callback | Read current config values for form population |
| `deps.setState()` | callback | Update config values on form changes |
| `deps.setPage()` | callback | Navigate to preview page on "Next" click |
| `deps.saveConfig()` | callback | Save current config to CanvasService |
| `deps.openFolderPicker()` | callback | Open FolderPickerModal for target folder selection |
| `CANVAS_COLOR_LABELS` | constant | Human-readable labels for color codes ("1" → "red") |
| `DEFAULT_COLOR_MAP` | constant | Default color-to-type mapping for reset |
| `DEFAULT_SHAPE_MAP` | constant | Default shape-to-type mapping for reset |
| `TYPE_ORDER` | constant | Ordered type list for exclusion grid |
| `Setting` | Obsidian API | Form controls (text, dropdown, toggle) |
| `setIcon` | Obsidian API | Render icons in section headers |

## State

**Reads:** `canvasPath`, `configName`, `targetFolder`, `subfolderName`, `conflictStrategy`, `hierarchyMode`, `createCanvas`, `createBase`, `colorMap`, `shapeMap`, `excludedTypes` from `getState()`.

**Writes:**
- All config fields on form interaction (via `setState()`)
- `excludedTypes` array on checkbox toggle

## Renders

### Left Panel — General Configuration
- **Unsaved changes reminder** (visibility toggled by orchestrator)
- **Canvas file display**: Read-only path
- **Config name**: Text input
- **Target folder**: Text input with "Browse" button (opens FolderPickerModal)
- **Import folder name**: Text input with default derived from canvas file basename
- **Conflict strategy**: Dropdown (Skip / Update / Overwrite)
- **Hierarchy mode**: Dropdown (Flat / Product / Group)
- **Post-import artifacts**: Toggle switches for "Create rebuilt canvas" and "Create .base index"

### Right Panel — Mappings & Exclusion
- **Color mapping table**: Color label → Type dropdown per row, with "Reset to Default" button
- **Shape mapping table**: Shape name → Type dropdown per row, with "Reset to Default" button
- **Type exclusion grid**: Checkbox per type (derived from active color + shape maps), with "All" / "None" toggle buttons

### Action Bar
- **Back**: Return to landing page
- **Save**: Save config (enabled when name is non-empty)
- **Preview**: Navigate to preview page (parses canvas and shows impact)

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | -- | CanvasConfigPage uses deps callbacks for all mutations |

## Related

- Parent: [[CanvasActionView]]
- Siblings: [[CanvasLanding]], [[CanvasPreviewPage]], [[CanvasResultPage]]
