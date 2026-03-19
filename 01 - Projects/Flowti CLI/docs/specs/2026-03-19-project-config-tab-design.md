# Project Config Tab with Markdown Importer Settings

**Date:** 2026-03-19
**Status:** Approved

## Overview

Add a tab system to the project detail sidepanel view. Two tabs: **Overview** (existing content) and **Config** (new). The Config tab exposes markdown sitemap importer configuration that persists to the project's `flowti.config.json`.

## Tab System

- `flowti-project-detail` gets a tab bar rendered above the content area
- Two tabs: Overview | Config
- Default active tab: Overview
- Tab state is component-local (no persistence)
- Only the project detail view (when a project is selected) shows tabs — the project list view does not

## Config Tab: Markdown Sitemap Import

Three configurable fields:

### Source Folder
- Read-only text display showing the selected path (relative to vault root)
- "Browse" button opens `FolderPickerModal`
- Empty state: placeholder "No folder selected"

### Strategy
- Three radio-style buttons: `Category` | `Flat` | `Hierarchical`
- Default: `category`
- Mutually exclusive selection

### Required Fields
- Row of chip/tag elements
- **Locked chips** (grayed out, always enabled, not toggleable): `name`, `category`
- **Toggleable chips** (user can click to enable/disable): `description`, `status`, `props`, `slots`, `variants`
- Visual distinction: locked chips have muted/disabled styling, toggleable chips have active/interactive styling

### Save
- "Save" button at the bottom of the config tab
- Writes `components.markdownSource` section to the project's `flowti.config.json`

## Data Flow

### Loading Config
1. `project-handlers.ts` loads project via `projectService.getProject()`
2. Project detail already receives `config: ProjectConfig`
3. Extend `ProjectConfig` in plugin domain to include `markdownSource` field (typed strategy union)
4. Config tab reads values from the project config on render

### Saving Config
1. Config tab dispatches `"config-save"` custom event with payload: `{ path, strategy, requiredFields }`
2. `project-handlers.ts` catches the event
3. Calls `projectService.saveMarkdownSourceConfig(project, config)`
4. `VaultProjectService` shells out to CLI: `node .flowti/bin storybook:import --save-config --project="<name>" --source="<path>" --strategy="<strategy>" --fields="<comma-separated>"`
5. CLI writes `components.markdownSource` to the project's `flowti.config.json`

Note: Reuses the existing `storybook:import` command with a `--save-config` flag rather than introducing a new command. The import controller already reads `markdownSource` from config — this adds the write path.

### Import Integration
Once config is saved, the `storybook-import` handler in `project-handlers.ts` checks for a configured `markdownSource.path`. If present, it skips the folder picker and uses the saved path directly. If absent, it falls back to the folder picker as before.

## Files Changed

### Plugin (`01 - Projects/Flowti Plugin/`)
| File | Change |
|------|--------|
| `src/components/projects/flowti-project-detail.ts` | Add tab bar + tab state, move current content to Overview renderer, add Config tab renderer |
| `src/components/projects/flowti-config-tab.ts` | **New** — Config tab component: source folder display + browse, strategy selector, required fields chips, save button |
| `src/domain/projects/types.ts` | Extend `ProjectConfig` with `markdownSource?: { path: string; strategy: "category" \| "flat" \| "hierarchical"; requiredFields: string[] }`. Add `saveMarkdownSourceConfig` to `IProjectService` interface |
| `src/infrastructure/handlers/project-handlers.ts` | Wire `config-save` event to service call. Update `storybook-import` handler to skip folder picker when config path exists |
| `src/infrastructure/projects/vault-project-service.ts` | Add `saveMarkdownSourceConfig()` method |
| `src/infrastructure/projects/http-project-service.ts` | Add `saveMarkdownSourceConfig()` stub to satisfy `IProjectService` interface |
| `tests/infrastructure/handlers/project-handlers.test.ts` | Add tests for config-save event wiring |
| `tests/infrastructure/projects/http-project-service.test.ts` | Add test for new method stub |

### CLI (`01 - Projects/Flowti CLI/`)
| File | Change |
|------|--------|
| `src/controller/storybook.controller.ts` | Add `--save-config` flag to existing `storybook:import` command — when set, writes `markdownSource` to config instead of running import |

## Architecture Notes

- Config is the contract: saves to `flowti.config.json` so CLI commands also pick up the values
- The config tab component is a standalone Lit element (`flowti-config-tab`) composed into the project detail view
- Required fields split: `name` and `category` are always required by the importer's validation logic — these are locked in the UI
- Tab state does not persist across view reopens — Overview is always the default
- Strategy type uses the CLI's union (`"category" | "flat" | "hierarchical"`) rather than a loose `string` to ensure type safety across the boundary
- Both `VaultProjectService` and `HttpProjectService` must implement `saveMarkdownSourceConfig` to satisfy `IProjectService` — the HTTP variant is a stub for now
