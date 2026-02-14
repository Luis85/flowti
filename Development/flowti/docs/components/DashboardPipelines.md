---
type: Component
domain: Flowti
stage: done
description: "Dashboard section rendering import pipelines as a table with favourite, preview, and run actions"
source: "[[Development/flowti/src/ui/hub/DashboardPipelines.ts|DashboardPipelines.ts]]"
parent: "[[DataExchangeHubView]]"
tags:
  - hub
  - component
---

# DashboardPipelines

## Description

DashboardPipelines is an extracted function component that renders the "Import Pipelines" table section on the Hub Dashboard. It displays all saved multi-import pipelines in a table with columns for name (with favourite star toggle), target folder, sources count (with linked export step badges), and action buttons (edit, preview, run). Pipelines merge multiple CSV reports into enriched notes by matching on a shared key column. Entries are sorted with favourites first. It includes a "New Pipeline" button and an empty state CTA.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| HubComponentDeps | interface | Provides app, state accessors, navigation, scheduleRender |
| setIcon | obsidian | Renders Lucide icons (star, layers, pencil, eye, play, etc.) |

## State

**Reads via `deps.getState()`:**
- `pipelineConfigs` — the full list of SavedMultiImportPipeline objects

**Writes via `deps.setState()`:**
- `selectedPipelineId` — set when clicking pipeline name or edit action, navigates to pipelines tab

## Renders

- **Section header** — "Import Pipelines" with layers icon and count
- **Description text** — "Merge multiple CSV reports into enriched notes by matching on a shared key column."
- **Pipelines table** — columns: Name (star toggle + clickable name), Target (folder path), Sources (source count badge + export step badges with names), Actions (edit/pencil, preview/eye, run/play)
- **Favourite sorting** — favourited pipelines appear first
- **Star toggle** — calls `dataExchangeService.togglePipelineFavourite()` on click
- **Export step badges** — for each `exportConfigId` on the pipeline, resolves the export config name and shows a badge with file-output icon
- **"New Pipeline" link** — calls `deps.navigation.createNewPipeline()` to open InputModal
- **Empty state** — card with icon, heading, description, and "New Pipeline" CTA button

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none directly) | — | Preview delegated via `deps.navigation.runPipelinePreview()`, execution via `deps.navigation.executePipeline()` |

## Related

- Parent: [[HubDashboard]]
- Siblings: [[DashboardImports]], [[DashboardExports]]
- Children: (none)
