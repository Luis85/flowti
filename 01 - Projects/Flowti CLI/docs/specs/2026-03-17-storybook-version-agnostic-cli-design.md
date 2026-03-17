# Storybook Version-Agnostic Scaffold + CLI Commands — Design Spec

**Date:** 2026-03-17
**Status:** Approved
**Iteration:** Agent World #5

## Problem

1. The Storybook scaffold pins `^8.6.0` in `components/package.json` and `^10.0.0` in the installer's `writePackageJson()`. Both anchor to a specific major version instead of resolving to the current latest.
2. Storybook can only be started, stopped, built, and installed from the interactive sitemap menu. There are no non-interactive CLI commands for terminal/CI use.

## Goals

- Make the scaffold version-agnostic so new installations always get the latest Storybook.
- Add four non-interactive CLI commands: `storybook:install`, `storybook:start`, `storybook:stop`, `storybook:build`.

## Non-Goals

- Migrating existing installed Storybook versions (users run `npx storybook@latest upgrade` themselves).
- Adding Storybook to the help content or man pages (follow-up work).

## Design

### 1. Version-Agnostic Scaffold

**Files changed:**

| File | Change |
|------|--------|
| `src/domain/make/component/storybook-installer.ts` | `writePackageJson()`: replace `"^10.0.0"` with `"latest"` for the framework package. Update `getFrameworkPackages()` JSDoc to remove "Storybook 10" reference. |
| `components/package.json` | Update `"^8.6.0"` to `"latest"` for `storybook`, `@storybook/html-vite`, `@storybook/addon-essentials`. |

The `npx storybook@latest init` command in `installStorybook()` is already version-agnostic and stays as-is. After `npm install`, the lock file pins the actual resolved version for reproducibility.

### 2. Non-Interactive Service Function

**File:** `src/domain/make/component/storybook-service.ts`

Add `startStorybookDev()` — a non-interactive variant of `runStorybookDev()` that:
- Spawns the Storybook dev server in the background
- Streams progress to the renderer while waiting for the ready signal
- Opens the browser on ready
- Returns a result model instead of blocking with `waitForEnter()`
- Does NOT call `enterStorybookView()` (no interactive stop-on-enter)
- All early-exit paths that call `deps.input.waitForEnter()` in `runStorybookDev` (not-installed, already-running, timeout, failed-to-start) are replaced with `return { started: false, url: "", error: "..." }`

```typescript
export interface StorybookStartResult {
	started: boolean;
	url: string;
	error?: string;
}

export async function startStorybookDev(
	projectPath: string,
	config: ComponentsConfig,
	vaultRoot: string,
	deps: Omit<StorybookDeps, "input">,
	render?: StorybookRenderer,
): Promise<StorybookStartResult>
```

Uses `Omit<StorybookDeps, "input">` since non-interactive mode has no user input.

Re-export from the service module for backward compatibility.

### 3. Storybook Controller

**New file:** `src/controller/storybook.controller.ts`

Four commands using `adaptDescriptor`:

#### `storybook:install`

```typescript
adaptDescriptor({
	requires: "project",
	flags: {
		framework: {
			type: "string",
			required: false,
			hint: "--framework=html|angular|react|vue",
			choices: ["html", "angular", "react", "vue"],
		},
	},
	handler: (ctx) => { /* setFramework + installStorybook */ },
	renderer: renderStorybookInstallResult,
})
```

- Reads `--framework` flag (defaults to config value or `"html"`, validated by `choices`)
- Derives `projectName` via `ctx.deps.paths.basename(ctx.project!.path)`
- Calls `setFramework()` then `installStorybook(projectPath, projectName, config, deps, render)`
- Returns `{ installed: boolean; framework: string; sbDir: string }`

#### `storybook:start`

```typescript
adaptDescriptor({
	requires: "project",
	handler: async (ctx) => { /* startStorybookDev */ },
	renderer: renderStorybookStartResult,
})
```

- Calls `startStorybookDev()` (the non-interactive variant)
- Returns `StorybookStartResult`

#### `storybook:stop`

```typescript
adaptDescriptor({
	requires: "project",
	handler: (ctx) => { /* isStorybookRunning + stopStorybook */ },
	renderer: renderStorybookStopResult,
})
```

- Checks `isStorybookRunning()` before calling `stopStorybook()`
- Returns `{ stopped: boolean; wasRunning: boolean }` so the renderer can distinguish "stopped it" from "wasn't running"

#### `storybook:build`

```typescript
adaptDescriptor({
	requires: "project",
	handler: (ctx) => { /* runStorybookBuild */ },
	renderer: renderStorybookBuildResult,
})
```

- Returns `{ built: boolean }`

### 4. Renderer Functions

**File:** `src/ui/renderers/storybook-renderers.ts`

Add four renderer functions for the CLI command output:

- `renderStorybookInstallResult(data, log)` — reports install success/failure with framework and directory
- `renderStorybookStartResult(data, log)` — reports URL on success, error on failure
- `renderStorybookStopResult(data, log)` — uses `wasRunning` to distinguish "stopped" from "wasn't running"
- `renderStorybookBuildResult(data, log)` — reports build success/failure

The controller passes a `StorybookRenderer` to domain functions for progress output by calling `createStorybookRenderer(ctx.deps.log)` from `src/ui/renderers/storybook-renderer-impl.ts` (read-only dependency, no changes needed to that file).

### 5. Registration

**File:** `src/main.ts`

```typescript
import { commands as storybookCmds } from "./controller/storybook.controller.js";
registry.registerDomain({ domain: "storybook", commands: storybookCmds });
```

## Testing

### New Tests

**`tests/controller/storybook.controller.test.ts`:**
- First controller test file in the project (no existing `tests/controller/` tests to reference)
- Mocks `../../src/domain/make/component/storybook-service.js` and `../../src/domain/make/component/storybook-settings.js` via `vi.mock()` at the top to prevent real I/O
- Tests all four command handlers via `createProjectContext()`
- Verifies correct domain calls and return models
- Tests flag parsing for `--framework` (including `choices` validation)
- Edge cases: already installed, already running, not installed, not running

**`tests/domain/make/component/storybook-service.test.ts` (additions):**
- Tests for `startStorybookDev()`: success path, not-installed guard, already-running guard, timeout, failed-to-start

### Unchanged Tests

- Existing installer tests assert on `npx storybook@latest init`, not scaffold package.json contents — no changes needed
- Existing renderer tests are additive only

## File Inventory

| File | Action |
|------|--------|
| `src/domain/make/component/storybook-installer.ts` | Edit (version string + JSDoc) |
| `src/domain/make/component/storybook-service.ts` | Edit (add `startStorybookDev` + re-export) |
| `src/controller/storybook.controller.ts` | Create |
| `src/ui/renderers/storybook-renderers.ts` | Edit (add 4 renderer functions) |
| `src/main.ts` | Edit (import + register storybook domain) |
| `components/package.json` | Edit (version pins) |
| `tests/controller/storybook.controller.test.ts` | Create |
| `tests/domain/make/component/storybook-service.test.ts` | Edit (add startStorybookDev tests) |
