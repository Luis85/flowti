# Storybook Lifecycle Flow — Design Spec

**Date:** 2026-03-19
**Status:** Draft

## Problem

The current Storybook integration has no coherent lifecycle. Install auto-starts Storybook, scaffold is a disconnected manual action, and there is no re-install flow. Users must manually sequence install → scaffold → start with no guidance.

## Goal

A guided lifecycle: install → prompt for scaffold → scaffold → start. One button to regenerate everything. Clear separation of concerns between install (infrastructure), scaffold (content), and serve (runtime).

## User Flows

### Flow 1: Fresh Install

```
User picks framework
  → Install runs (creates components/, bootstraps Storybook)
  → UI shows "Installed" (NOT running)
  → Modal appears: "Generate components from sitemap?"
    → If configs/sitemap.json exists:
        Primary action: "Generate from project sitemap"
    → If no sitemap but markdownSource configured:
        "Import from markdown first, then generate"
    → If neither:
        "No sitemap found." + dismiss
  → User confirms → scaffold runs
  → Scaffold succeeds → Storybook starts automatically
```

### Flow 2: Normal Operation (installed, idle)

Buttons: **Start**, Build, Open Folder, **Regenerate**

### Flow 3: Running

Buttons: **View**, Stop, Build

### Flow 4: Regenerate (re-install)

```
User clicks "Regenerate"
  → Confirmation modal:
    "This will delete your component library and regenerate
     everything from the sitemap. Continue?"
  → On confirm:
    → Delete components/
    → Install (same framework as before)
    → Scaffold from sitemap
    → Start Storybook
  → Streamed output shown throughout
```

## Architecture

### Event Flow

Current events stay. New events added:

| Event | Payload | Source | Handler |
|-------|---------|--------|---------|
| `storybook-install` | `{ framework }` | storybook-section | project-handlers |
| `storybook-regenerate` | — | storybook-section | project-handlers |
| `storybook-scaffold-confirm` | `{ adoptImport?: boolean }` | scaffold-modal | project-handlers |
| `storybook-scaffold-dismiss` | — | scaffold-modal | project-handlers |

### Component Changes

#### `flowti-storybook-section.ts`

- Remove auto-start after install — `storybook-install` event handler in project-handlers no longer chains start
- Add "Regenerate" button in installed-idle state (replaces current scaffold button)
- Remove standalone "Scaffold" button — scaffold is now part of install/regenerate flow

#### New: `flowti-scaffold-modal.ts`

Simple Lit dialog component. Properties:

```typescript
hasSitemap: boolean;       // configs/sitemap.json exists
hasMarkdownSource: boolean; // markdownSource configured in config
```

Three states:
1. `hasSitemap` → "Generate components from your project sitemap" + Generate / Cancel buttons
2. `!hasSitemap && hasMarkdownSource` → "Import markdown and generate components" + Import & Generate / Cancel
3. Neither → "No sitemap found. Add configs/sitemap.json or configure a markdown source." + Dismiss

Dispatches `storybook-scaffold-confirm` or `storybook-scaffold-dismiss`.

#### `flowti-project-detail.ts`

- Add `showScaffoldModal` boolean property
- Render `<flowti-scaffold-modal>` when true
- Wire modal events to project-handlers

### Handler Changes (`project-handlers.ts`)

#### Install handler (modified)

```
storybook-install:
  1. startBusy("Installing Storybook...")
  2. await projectService.installStorybook(project, framework, appendOutput)
  3. endBusy(result)
  4. If ok → show scaffold modal (set el.showScaffoldModal = true)
  // No auto-start
```

#### Scaffold confirm handler (new)

```
storybook-scaffold-confirm:
  1. Hide modal
  2. If detail.adoptImport → import markdown first, then scaffold
  3. Else → scaffold directly from configs/sitemap.json
  4. On scaffold success → auto-start Storybook
```

#### Scaffold dismiss handler (new)

```
storybook-scaffold-dismiss:
  1. Hide modal
  // User can start Storybook manually later
```

#### Regenerate handler (new)

```
storybook-regenerate:
  1. Show confirmation (via modal or inline confirm)
  2. On confirm:
     a. startBusy("Regenerating...")
     b. Delete components/ directory (new CLI command or service method)
     c. Install (reuse saved framework)
     d. Scaffold from sitemap
     e. Start Storybook
     f. endBusy(result)
```

### CLI Changes

#### New command: `storybook:clean`

Deletes the components directory for a project. Used by regenerate flow.

```typescript
"storybook:clean": adaptDescriptor({
  requires: "project",
  handler: (ctx) => {
    const config = ctx.project!.config.components ?? {};
    const sbDir = resolveStorybookDir(ctx.project!.path, config, { paths: ctx.deps.paths });
    if (ctx.deps.disk.existsSync(sbDir)) {
      ctx.deps.disk.rmSync(sbDir, { recursive: true, force: true });
    }
    return { cleaned: true, dir: sbDir };
  },
  renderer: (data, log) => log(`Cleaned ${data.dir}`),
})
```

#### `storybook:install` — no changes

Already returns without starting. The Plugin handler was chaining the start.

#### `storybook:scaffold` — no changes

Already handles sitemap detection, adopt-import, file writing.

### Service Interface Changes (`IProjectService`)

Add to interface:

```typescript
cleanStorybook(project: string): Promise<{ ok: boolean; error?: string }>;
```

Implementations:
- `VaultProjectService`: calls `node [cliBin] storybook:clean --project="..."`
- `HttpProjectService`: posts to `/api/storybook/clean`

### Sitemap Detection

The scaffold modal needs to know if a sitemap exists. Two options:

**Option A (chosen):** Derive from `ProjectDetail` — add `hasSitemap` field to `ProjectDetail` type. `VaultProjectService.getProject()` checks for `configs/sitemap.json`. No extra round-trip.

**Option B:** Separate API call. Unnecessary overhead.

Add to `ProjectDetail`:
```typescript
hasSitemap: boolean;
```

`VaultProjectService.getProject()` sets it:
```typescript
hasSitemap: existsSync(join(absProjectPath, "configs", "sitemap.json"))
  || existsSync(join(absProjectPath, "imported-sitemap.json"))
```

### State Diagram

```
┌─────────────┐
│ Not Installed│
│  [framework] │
└──────┬──────┘
       │ install
       ▼
┌─────────────┐     ┌──────────────┐
│  Installed   │────►│ Scaffold     │
│  (idle)      │modal│ Modal        │
└──────┬──────┘     └──────┬───────┘
       │                    │ confirm
       │ manual start       ▼
       │              ┌───────────┐
       │              │ Scaffolding│
       │              └─────┬─────┘
       │                    │ auto-start
       ▼                    ▼
┌─────────────┐     ┌─────────────┐
│  Running     │◄────│  Starting   │
│  [view/stop] │     └─────────────┘
└──────┬──────┘
       │ stop
       ▼
┌─────────────┐
│  Installed   │──── regenerate ──► confirm ──► clean ──► install ──► scaffold ──► start
│  (idle)      │
└─────────────┘
```

## Test Strategy

### Unit Tests

1. **Scaffold modal component** — renders correct state for hasSitemap/hasMarkdownSource combinations, dispatches correct events
2. **`storybook:clean` command** — deletes directory when exists, no-op when missing
3. **`cleanStorybook` service method** — calls CLI command correctly
4. **`hasSitemap` in ProjectDetail** — detection logic in VaultProjectService

### Integration Tests (project-handlers)

5. **Install → modal flow** — install success sets `showScaffoldModal = true`
6. **Scaffold confirm → start** — scaffold success triggers start
7. **Scaffold dismiss** — hides modal, no start
8. **Regenerate** — chains clean → install → scaffold → start

## Files to Create

| File | Purpose |
|------|---------|
| `Plugin/src/components/projects/flowti-scaffold-modal.ts` | Scaffold prompt modal |

## Files to Modify

| File | Change |
|------|--------|
| `CLI/src/controller/storybook.controller.ts` | Add `storybook:clean` command |
| `Plugin/src/components/projects/flowti-storybook-section.ts` | Add Regenerate button, remove standalone Scaffold |
| `Plugin/src/components/projects/flowti-project-detail.ts` | Wire scaffold modal, add `showScaffoldModal` property |
| `Plugin/src/infrastructure/handlers/project-handlers.ts` | Rework install handler (no auto-start), add scaffold-confirm/dismiss/regenerate handlers |
| `Plugin/src/domain/projects/types.ts` | Add `cleanStorybook` to `IProjectService`, add `hasSitemap` to `ProjectDetail` |
| `Plugin/src/infrastructure/projects/vault-project-service.ts` | Implement `cleanStorybook`, add `hasSitemap` detection |
| `Plugin/src/infrastructure/projects/http-project-service.ts` | Stub `cleanStorybook` |
| `Plugin/tests/infrastructure/handlers/project-handlers.test.ts` | Test new event flows |
| `CLI/tests/controller/storybook.controller.test.ts` | Test `storybook:clean` |

## Out of Scope

- Custom component templates (use built-in scaffold templates)
- Markdown import configuration during modal flow (already available in Config tab)
- Storybook build/deploy automation
- Multiple component libraries per project
