# Project Hub Sidepanel — Design Spec

**Date:** 2026-03-18
**Status:** Draft
**Project:** Flowti Plugin + Flowti CLI

## Problem

The Flowti Plugin has no way to manage projects from within Obsidian. Project information lives in `01 - Projects/` folders, each with a `flowti.config.json` and optionally a project note (`{folder-name}.md`). Storybook management (install, scaffold, start, build) exists in the CLI but has no GUI. Users must leave the vault and use the terminal for all project and storybook operations.

## Goals

1. **Project Hub sidepanel** — list, search, and browse all projects from `01 - Projects/`
2. **Project detail view** — extensible detail page per project, starting with Storybook management
3. **Storybook lifecycle** — install (4 framework presets), scaffold from sitemap, start (opens in Obsidian webviewer), build, stop
4. **Project note awareness** — detect presence of `{folder-name}.md`, prompt to create if missing
5. **Plugin = UI, CLI = logic** — all operations delegate to CLI server via HTTP, Plugin is purely a frontend

## Non-Goals

- Direct Storybook logic in the Plugin (all delegated to CLI)
- Editing `flowti.config.json` from the UI
- Real-time file watching for project changes (manual refresh)
- Building health, reports, or test sections in this iteration (designed for, not built)

## Architecture

### Hybrid: Sitemap List + Lit Detail

**Layer 1 — Project list:** A sitemap-driven view (`SitemapLeafView`) with a data source that fetches projects from the CLI server (`GET /api/projects`). Each entry shows project name, project note status, and storybook status. Clicking navigates to the detail view.

**Layer 2 — Project detail:** A dedicated `ItemView` mounting a `<flowti-project-detail>` Lit component tree. Receives the project name as view state. Has sections that grow over time — storybook is the first. Talks to CLI server via HTTP for all actions.

### Data Flow

```
Plugin sitemap list → click project → opens detail ItemView with project name
Detail ItemView → mounts <flowti-project-detail> Lit component
Lit component → HTTP to CLI server (/api/projects/:name, /api/storybook/*)
CLI server → delegates to existing domain functions (project.ts, storybook-service.ts)
Storybook start → returns URL → Plugin opens Obsidian webviewer command
```

### Registration

- Command: `"Open project hub"` — opens or reveals the project list
- Ribbon icon: folder icon
- View types: `flowti-project-hub` (list) + `flowti-project-detail` (detail)
- Bootstrap: `src/bootstrap/project-setup.ts` registers views and commands

## Project List View

### Sitemap Entry

Registered in Plugin's `sitemap.json` as a leaf view:
- View ID: `project-hub`
- Kind: `leaf`
- Data source: `project-list` — fetches from CLI server

### List Entry

Each project shows:
- **Name** — folder name
- **Status indicator** — has project note (check) or missing (warning badge)
- **Storybook badge** — not installed / installed (framework name) / running (green dot)
- Click → opens project detail view with project name in state

### Search

Text filter at the top, filters project names client-side.

### Empty State

"No projects found in 01 - Projects/" if the folder is empty or CLI server is not connected.

## Project Detail View

### Layout

Vertical stack in a dedicated `ItemView`, similar to agent sidepanel.

### Header Section

- Project name (large)
- Project type from `flowti.config.json` (e.g., "typescript-cli", "obsidian-plugin")
- Project note status:
  - Found → link to open it
  - Missing → "No project note — Create one" button
- Back button → returns to project list

### Storybook Section

**State: Not installed**
- "Storybook not configured" message
- Framework picker: 4 buttons — html-vite, react, vue, angular
- Clicking a framework calls `POST /api/storybook/install` with `{ project, framework }`
- Each preset includes testing, docs, a11y addons (handled by CLI)

**State: Installed, not running**
- Framework badge (e.g., "react-vite")
- Action buttons:
  - **Start** → `POST /api/storybook/start` → gets URL → opens Obsidian webviewer
  - **Scaffold from sitemap** → `POST /api/storybook/scaffold`
  - **Build** → `POST /api/storybook/build`
  - **Open folder** → opens storybook directory in system file explorer

**State: Running**
- Green dot + URL + PID (same pattern as agent server bar)
- Action buttons:
  - **View** → opens Obsidian webviewer with the URL
  - **Stop** → `POST /api/storybook/stop`
  - **Build** → `POST /api/storybook/build`

### Future Sections (not built now)

Designed as collapsible cards, each a separate Lit component:
- Health — project health score
- Reports — generated report links
- Build — build status and commands
- Tests — test results summary

## CLI Server Endpoints

All new routes added to `static-server.ts`, following the existing `/api/agent/*` pattern.

### `GET /api/projects`

Scans `01 - Projects/` directory. For each folder:
- Reads `flowti.config.json` if present
- Checks for project note (`{folder-name}.md` in the project folder)
- Checks storybook installation status and running state

Returns:
```typescript
{
  projects: Array<{
    name: string;
    type: string;              // from config, or "unknown"
    hasNote: boolean;
    storybook: {
      installed: boolean;
      framework: string | null;  // e.g., "react-vite"
      running: boolean;
      url: string | null;        // e.g., "http://localhost:6006"
    };
  }>
}
```

### `GET /api/projects/:name`

Returns full project detail: config, storybook status, paths.
404 if project folder doesn't exist.

```typescript
{
  name: string;
  type: string;
  hasNote: boolean;
  notePath: string | null;
  projectPath: string;
  storybook: {
    installed: boolean;
    framework: string | null;
    running: boolean;
    url: string | null;
    pid: number | null;
  };
}
```

### `POST /api/storybook/install`

Body: `{ project: string, framework: "html-vite" | "react" | "vue" | "angular" }`

Delegates to existing `storybook-service.ts` install logic. Runs `npm install` with framework-specific deps.

Returns: `{ ok: true }` or `{ ok: false, error: string }`

### `POST /api/storybook/scaffold`

Body: `{ project: string }`

Reads project's `sitemap.json`, runs `scaffoldStorybookFromSitemap()`, writes generated files.

Returns: `{ ok: true, filesCreated: number }` or `{ ok: false, error: string }`

### `POST /api/storybook/start`

Body: `{ project: string }`

Spawns `npx storybook dev -p 6006` in project directory (detached). Polls until healthy. Writes PID to `.flowti/var/storybook-{project-slug}.pid`.

Returns: `{ ok: true, url: string, pid: number }` or `{ ok: false, error: string }`

### `POST /api/storybook/stop`

Body: `{ project: string }`

Reads PID file, kills process, cleans up PID file.

Returns: `{ ok: true }` or `{ ok: false, error: string }`

### `POST /api/storybook/build`

Body: `{ project: string }`

Runs `npx storybook build` in project directory.

Returns: `{ ok: true, outputDir: string }` or `{ ok: false, error: string }`

## Plugin Component Tree

### Files

All Lit components in `src/components/projects/`:

| Component | Purpose |
|-----------|---------|
| `flowti-project-detail.ts` | Root detail — header + capability sections |
| `flowti-storybook-section.ts` | Storybook card — install/start/stop/build/scaffold |

### Infrastructure

| File | Purpose |
|------|---------|
| `src/infrastructure/handlers/project-handlers.ts` | Mounts detail component, bridges events to CLI HTTP |
| `src/ui/projects/project-detail-view.ts` | ItemView shell for detail |
| `src/ui/projects/types.ts` | View type constant |
| `src/bootstrap/project-setup.ts` | Registers views + commands |

### Custom Events (from components)

| Event | Detail | When |
|-------|--------|------|
| `storybook-install` | `{ framework: string }` | User picks a framework |
| `storybook-start` | `{}` | User clicks Start |
| `storybook-stop` | `{}` | User clicks Stop |
| `storybook-build` | `{}` | User clicks Build |
| `storybook-scaffold` | `{}` | User clicks Scaffold |
| `open-project-note` | `{ path: string }` | User clicks project note link |
| `create-project-note` | `{ name: string }` | User clicks "Create note" |
| `back-to-list` | `{}` | User clicks back button |

### Domain Types

```typescript
// src/domain/projects/types.ts

interface ProjectSummary {
  readonly name: string;
  readonly type: string;
  readonly hasNote: boolean;
  readonly storybook: StorybookStatus;
}

interface ProjectDetail extends ProjectSummary {
  readonly notePath: string | null;
  readonly projectPath: string;
}

interface StorybookStatus {
  readonly installed: boolean;
  readonly framework: string | null;
  readonly running: boolean;
  readonly url: string | null;
  readonly pid: number | null;
}
```

## Key Decisions

1. **Hybrid approach** — sitemap for the list (leverages existing infrastructure), Lit for detail (rich interactivity)
2. **Plugin = UI only** — all logic in CLI server, Plugin makes HTTP calls
3. **Project identity** — folder name in `01 - Projects/`, project note is `{folder-name}.md`
4. **Storybook PID tracking** — same pattern as server registry (`.flowti/var/storybook-{slug}.pid`)
5. **Framework presets** — 4 options: html-vite, react, vue, angular (CLI supports lit and cli-app too, but keeping the UI focused)
6. **Extensible detail view** — each capability is a separate Lit component section, designed for future additions
