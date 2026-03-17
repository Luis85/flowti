---
type: Component
domain: Flowti
stage: done
description: "Dashboard section rendering configured export configs as a table with favourite, preview, and execute actions"
source: "[[Development/flowti/src/ui/hub/DashboardExports.ts|DashboardExports.ts]]"
parent: "[[DataExchangeHubView]]"
tags:
  - hub
  - component
---

# DashboardExports

## Description

DashboardExports is an extracted function component that renders the "Configured Exports" table section on the Hub Dashboard. It displays all saved export configurations in a table with columns for name (with favourite star toggle and format badge), source (base file or folder link with type badge), output file (with external badge if applicable), and action buttons (edit, preview, execute). Entries are sorted with favourites first. It includes a "New Export from Base" button and an empty state CTA prompting users to select a .base file.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| HubComponentDeps | interface | Provides app, state accessors, navigation, scheduleRender |
| FilePickerModal | class | File picker for selecting .base files for new exports |
| TFile | obsidian | Type-checks vault files for opening base files |
| setIcon | obsidian | Renders Lucide icons (star, pencil, eye, play, etc.) |

## State

**Reads via `deps.getState()`:**
- `exportConfigs` — the full list of saved export configs

**Writes via `deps.setState()`:**
- `selectedExportId` — set when clicking config name or edit action, navigates to exports tab

## Renders

- **Section header** — "Configured Exports" with file-output icon and count
- **Export configs table** — columns: Name (star toggle + clickable name + format badge), Source (base/folder name link + type badge), Output (filename link + external badge), Actions (edit/pencil, preview/eye, execute/play)
- **Favourite sorting** — favourited configs appear first
- **Star toggle** — calls `dataExchangeService.toggleExportFavourite()` on click
- **Source links** — base files open via `getLeaf().openFile()`, folders open via `openLinkText()`
- **Output links** — vault outputs are clickable; external outputs are not
- **"New Export from Base" button** — opens FilePickerModal to select a .base file, then navigates to new export view
- **Empty state** — card with icon, heading, description, and "Select Base File" CTA button

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none directly) | — | Execution delegated via `deps.navigation.executeExportConfig()` |

## Related

- Parent: [[HubDashboard]]
- Siblings: [[DashboardImports]], [[DashboardPipelines]]
- Children: (none)
