# Storybook Version-Agnostic Scaffold + CLI Commands — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Storybook scaffold version-agnostic and add four non-interactive CLI commands (`storybook:install`, `storybook:start`, `storybook:stop`, `storybook:build`).

**Architecture:** Two independent changes — (1) replace hardcoded version pins with `"latest"` in scaffold code and existing `components/package.json`, (2) add a new controller + service function + renderers for non-interactive CLI access. Both follow the existing `adaptDescriptor` controller pattern with dependency-injected domain functions.

**Tech Stack:** TypeScript, Vitest, Node.js built-ins only (zero runtime deps).

**Spec:** `docs/specs/2026-03-17-storybook-version-agnostic-cli-design.md`

---

## Chunk 1: Version-Agnostic Scaffold

### Task 1: Update version pins in storybook-installer.ts

**Files:**
- Modify: `src/domain/make/component/storybook-installer.ts:38,91`

- [ ] **Step 1: Update `getFrameworkPackages()` JSDoc**

In `src/domain/make/component/storybook-installer.ts`, replace the JSDoc comment:

```typescript
// OLD (line 38):
 * Returns framework-specific package info for Storybook 10.

// NEW:
 * Returns framework-specific package info for Storybook.
```

- [ ] **Step 2: Update `writePackageJson()` version pin**

In the same file, replace the hardcoded version:

```typescript
// OLD (line 91):
			[fw.framework]: "^10.0.0",

// NEW:
			[fw.framework]: "latest",
```

- [ ] **Step 3: Run existing tests to verify no regressions**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/component/storybook-service.test.ts --config configs/vitest.config.ts`
Expected: All 28 tests PASS (the tests don't assert on version strings in `writePackageJson`)

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/make/component/storybook-installer.ts"
git commit -m "chore: make storybook scaffold version-agnostic in installer"
```

### Task 2: Update existing components/package.json

**Files:**
- Modify: `components/package.json`

- [ ] **Step 1: Replace pinned versions with "latest"**

Update `01 - Projects/Flowti CLI/components/package.json`:

```json
{
  "name": "flowti-cli-components",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  },
  "devDependencies": {
    "storybook": "latest",
    "@storybook/html-vite": "latest",
    "@storybook/addon-essentials": "latest"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti CLI/components/package.json"
git commit -m "chore: update storybook deps to latest (version-agnostic)"
```

---

## Chunk 2: Non-Interactive Service Function

### Task 3: Add `startStorybookDev()` to storybook-service.ts

**Files:**
- Modify: `src/domain/make/component/storybook-service.ts`
- Test: `tests/domain/make/component/storybook-service.test.ts`

- [ ] **Step 1: Write failing tests for `startStorybookDev()`**

Add the following tests to the bottom of `tests/domain/make/component/storybook-service.test.ts`, before the closing of the file:

```typescript
describe("startStorybookDev", () => {
	it("returns started result with URL on success", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess({
			output: ["Local: http://localhost:6006/"],
		});
		mockShell.spawnBackground.mockReturnValue(mockProcess);

		const result = await startStorybookDev("/project", {}, "/vault", { disk, paths, shell });

		expect(result.started).toBe(true);
		expect(result.url).toBe("http://localhost:6006");
		expect(result.error).toBeUndefined();
	});

	it("returns error when not installed", async () => {
		const render = createMockRenderer();
		const result = await startStorybookDev("/project", {}, "/vault", { disk, paths, shell }, render);

		expect(result.started).toBe(false);
		expect(result.error).toBe("not-installed");
		expect(render.notInstalled).toHaveBeenCalled();
	});

	it("returns error when already running", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		// Start a process to make isStorybookRunning() return true
		const firstProcess = createMockBackgroundProcess({
			output: ["Local: http://localhost:6006/"],
		});
		mockShell.spawnBackground.mockReturnValue(firstProcess);
		await startStorybookDev("/project", {}, "/vault", { disk, paths, shell });

		const render = createMockRenderer();
		const result = await startStorybookDev("/project", {}, "/vault", { disk, paths, shell }, render);

		expect(result.started).toBe(false);
		expect(result.error).toBe("already-running");
		expect(render.alreadyRunning).toHaveBeenCalled();
	});

	it("returns error on timeout", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess({
			running: true,
			waitForOutput: vi.fn().mockResolvedValue(null),
		});
		mockShell.spawnBackground.mockReturnValue(mockProcess);
		const render = createMockRenderer();

		const result = await startStorybookDev("/project", {}, "/vault", { disk, paths, shell }, render);

		expect(result.started).toBe(false);
		expect(result.error).toBe("timeout");
		expect(render.timeout).toHaveBeenCalled();
	});

	it("returns error when process exits before ready", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess({
			running: false,
			output: ["npm ERR! Missing script: storybook"],
			waitForOutput: vi.fn().mockResolvedValue(null),
		});
		mockShell.spawnBackground.mockReturnValue(mockProcess);
		const render = createMockRenderer();

		const result = await startStorybookDev("/project", {}, "/vault", { disk, paths, shell }, render);

		expect(result.started).toBe(false);
		expect(result.error).toBe("failed-to-start");
		expect(render.failedToStart).toHaveBeenCalled();
	});

	it("does not block on user input (no waitForEnter)", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess({
			output: ["Local: http://localhost:6006/"],
		});
		mockShell.spawnBackground.mockReturnValue(mockProcess);

		await startStorybookDev("/project", {}, "/vault", { disk, paths, shell });

		// Process should still be running (not killed by enterStorybookView)
		expect(mockProcess.kill).not.toHaveBeenCalled();
	});
});
```

Also add `startStorybookDev` to the import at the top of the file (line 80-91):

```typescript
import {
	resolveStorybookDir,
	isStorybookInstalled,
	installStorybook,
	runStorybookDev,
	runStorybookBuild,
	isStorybookRunning,
	stopStorybook,
	isInsideVault,
	extractLocalUrl,
	getFrameworkPackages,
	startStorybookDev,
} from "../../../../src/domain/make/component/storybook-service.js";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/component/storybook-service.test.ts --config configs/vitest.config.ts`
Expected: FAIL — `startStorybookDev` is not exported

- [ ] **Step 3: Implement `startStorybookDev()` in storybook-service.ts**

Add the interface and function to `src/domain/make/component/storybook-service.ts`. Add the interface after the re-exports block (after line 28), and add the function after the `runStorybookDev` function (after line 104):

First, add the interface after the `storybook-browser.js` re-exports block:

```typescript
// ── Non-interactive result type ──────────────────────────────────────

export interface StorybookStartResult {
	started: boolean;
	url: string;
	error?: string;
}
```

Then add the function after `runStorybookDev` (after line 104):

```typescript
export async function startStorybookDev(
	projectPath: string,
	config: ComponentsConfig,
	vaultRoot: string,
	deps: Omit<StorybookDeps, "input">,
	render: StorybookRenderer = nullStorybookRenderer,
): Promise<StorybookStartResult> {
	const sbDir = resolveStorybookDir(projectPath, config, deps);
	if (!isStorybookInstalled(projectPath, config, deps)) {
		render.notInstalled();
		return { started: false, url: "", error: "not-installed" };
	}

	if (isStorybookRunning()) {
		render.alreadyRunning();
		return { started: false, url: "", error: "already-running" };
	}

	render.starting();

	const activeProcess = deps.shell.spawnBackground(
		"npm run storybook",
		{ cwd: sbDir, env: { CI: "true", NG_CLI_ANALYTICS: "false" } },
	);
	setActiveProcess(activeProcess);

	const unsubscribe = activeProcess.onOutput((line) => render.progress(line));
	const readyLine = await activeProcess.waitForOutput(READY_PATTERN, READY_TIMEOUT_MS);
	unsubscribe();

	if (!readyLine) {
		if (!activeProcess.running) {
			render.failedToStart();
			const lines = activeProcess.output;
			if (lines.length > 0) render.failOutput(lines.slice(-20));
			setActiveProcess(null);
			return { started: false, url: "", error: "failed-to-start" };
		}
		render.timeout();
		return { started: false, url: "", error: "timeout" };
	}

	const url = extractLocalUrl(activeProcess.output);
	render.ready(url);
	openStorybookUrl(projectPath, url, vaultRoot, render, deps);
	return { started: true, url };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/component/storybook-service.test.ts --config configs/vitest.config.ts`
Expected: All tests PASS (existing + 6 new)

- [ ] **Step 5: Type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/make/component/storybook-service.ts" \
       "01 - Projects/Flowti CLI/tests/domain/make/component/storybook-service.test.ts"
git commit -m "feat: add startStorybookDev() for non-interactive storybook start"
```

---

## Chunk 3: Controller + Renderers + Registration

### Task 4: Add CLI renderer functions

**Files:**
- Modify: `src/ui/renderers/storybook-renderers.ts`

- [ ] **Step 1: Add four CLI renderer functions**

Append to the end of `src/ui/renderers/storybook-renderers.ts`:

```typescript
// ── CLI command renderers ────────────────────────────────────────────

export interface StorybookInstallResultModel {
	installed: boolean;
	framework: string;
	sbDir: string;
}

export function renderStorybookInstallResult(data: StorybookInstallResultModel, log: Log): void {
	if (data.installed) {
		log(`\n  ${GREEN}✓${RESET} Storybook installed (${data.framework}) at ${DIM}${data.sbDir}${RESET}\n`);
	} else {
		log(`\n  ${RED}✗${RESET} Storybook installation failed.\n`);
	}
}

export interface StorybookStartResultModel {
	started: boolean;
	url: string;
	error?: string;
}

export function renderStorybookStartResult(data: StorybookStartResultModel, log: Log): void {
	if (data.started) {
		log(`\n  ${GREEN}✓${RESET} Storybook running at ${DIM}${data.url}${RESET}\n`);
	} else {
		log(`\n  ${RED}✗${RESET} Storybook failed to start: ${data.error ?? "unknown"}\n`);
	}
}

export interface StorybookStopResultModel {
	stopped: boolean;
	wasRunning: boolean;
}

export function renderStorybookStopResult(data: StorybookStopResultModel, log: Log): void {
	if (data.wasRunning) {
		log(`\n  ${GREEN}✓${RESET} Storybook stopped.\n`);
	} else {
		log(`\n  ${DIM}Storybook was not running.${RESET}\n`);
	}
}

export interface StorybookBuildResultModel {
	built: boolean;
}

export function renderStorybookBuildResult(data: StorybookBuildResultModel, log: Log): void {
	if (data.built) {
		log(`\n  ${GREEN}✓${RESET} Storybook build complete.\n`);
	} else {
		log(`\n  ${RED}✗${RESET} Storybook build failed.\n`);
	}
}
```

- [ ] **Step 2: Run existing renderer tests to verify no regressions**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/ui/renderers/storybook-renderers.test.ts --config configs/vitest.config.ts`
Expected: All existing tests PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/ui/renderers/storybook-renderers.ts"
git commit -m "feat: add CLI renderer functions for storybook commands"
```

### Task 5: Create storybook controller

**Files:**
- Create: `src/controller/storybook.controller.ts`

- [ ] **Step 1: Create the controller file**

Create `src/controller/storybook.controller.ts`:

```typescript
/**
 * storybook.controller.ts — Non-interactive CLI commands for Storybook.
 *
 * Provides storybook:install, storybook:start, storybook:stop, storybook:build.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler, ComponentFramework } from "../infrastructure/types.js";
import { VAULT_ROOT } from "../infrastructure/config.js";

import {
	installStorybook,
	isStorybookInstalled,
	isStorybookRunning,
	stopStorybook,
	startStorybookDev,
	runStorybookBuild,
	resolveStorybookDir,
} from "../domain/make/component/storybook-service.js";
import { getFramework, setFramework } from "../domain/make/component/storybook-settings.js";
import { createStorybookRenderer } from "../ui/renderers/storybook-renderer-impl.js";

import {
	renderStorybookInstallResult,
	renderStorybookStartResult,
	renderStorybookStopResult,
	renderStorybookBuildResult,
	type StorybookInstallResultModel,
	type StorybookStartResultModel,
	type StorybookStopResultModel,
	type StorybookBuildResultModel,
} from "../ui/renderers/storybook-renderers.js";

export const commands: Record<string, CommandHandler> = {
	"storybook:install": adaptDescriptor<{ framework: string }, StorybookInstallResultModel>({
		requires: "project",
		flags: {
			framework: {
				type: "string",
				required: false,
				hint: "--framework=html|angular|react|vue",
				choices: ["html", "angular", "react", "vue"],
			},
		},
		handler: (ctx) => {
			const { disk, paths, shell, input, log } = ctx.deps;
			const config = ctx.project!.config.components ?? {};
			const framework = (ctx.flags.framework || getFramework(ctx.project!.path, { disk, paths }) || "html") as ComponentFramework;
			const projectName = paths.basename(ctx.project!.path);
			const sbDir = resolveStorybookDir(ctx.project!.path, config, { paths });

			setFramework(ctx.project!.path, framework, { disk, paths });
			const installed = installStorybook(
				ctx.project!.path, projectName,
				{ ...config, framework },
				{ disk, paths, shell, input },
				createStorybookRenderer(log),
			);
			return { installed, framework, sbDir };
		},
		renderer: renderStorybookInstallResult,
	}),

	"storybook:start": adaptDescriptor<Record<string, unknown>, StorybookStartResultModel>({
		requires: "project",
		handler: async (ctx) => {
			const { disk, paths, shell, log } = ctx.deps;
			const config = ctx.project!.config.components ?? {};
			return startStorybookDev(
				ctx.project!.path, config, VAULT_ROOT,
				{ disk, paths, shell },
				createStorybookRenderer(log),
			);
		},
		renderer: renderStorybookStartResult,
	}),

	"storybook:stop": adaptDescriptor<Record<string, unknown>, StorybookStopResultModel>({
		requires: "project",
		handler: (ctx) => {
			const wasRunning = isStorybookRunning();
			if (wasRunning) stopStorybook(createStorybookRenderer(ctx.deps.log));
			return { stopped: wasRunning, wasRunning };
		},
		renderer: renderStorybookStopResult,
	}),

	"storybook:build": adaptDescriptor<Record<string, unknown>, StorybookBuildResultModel>({
		requires: "project",
		handler: (ctx) => {
			const { disk, paths, shell, log } = ctx.deps;
			const config = ctx.project!.config.components ?? {};
			if (!isStorybookInstalled(ctx.project!.path, config, { disk, paths })) {
				return { built: false };
			}
			runStorybookBuild(ctx.project!.path, config, { disk, paths, shell }, createStorybookRenderer(log));
			return { built: true };
		},
		renderer: renderStorybookBuildResult,
	}),
};
```

- [ ] **Step 2: Type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/controller/storybook.controller.ts"
git commit -m "feat: add storybook controller with install/start/stop/build commands"
```

### Task 6: Register controller in main.ts

**Files:**
- Modify: `src/main.ts:62,125`

- [ ] **Step 1: Add import**

Add after the last controller import (line 64, after the `vaultTestCmds` import):

```typescript
import { commands as storybookCmds } from "./controller/storybook.controller.js";
```

- [ ] **Step 2: Register the domain**

Add after the `vault-test` registration (line 125, after `registry.registerDomain({ domain: "vault-test", ... })`):

```typescript
registry.registerDomain({ domain: "storybook", commands: storybookCmds });
```

- [ ] **Step 3: Build and verify command is registered**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs && cd ../.. && ./flowti.cmd help 2>&1 | grep -i storybook`
Expected: No build errors. (The `help` output may not yet list storybook commands since help content is separate.)

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/main.ts"
git commit -m "feat: register storybook commands in CLI command registry"
```

### Task 7: Write controller tests

**Files:**
- Create: `tests/controller/storybook.controller.test.ts`

- [ ] **Step 1: Create the controller test file**

Create `tests/controller/storybook.controller.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
}));

vi.mock("../../src/domain/make/component/storybook-service.js", () => ({
	installStorybook: vi.fn(() => true),
	isStorybookInstalled: vi.fn(() => true),
	isStorybookRunning: vi.fn(() => false),
	stopStorybook: vi.fn(),
	startStorybookDev: vi.fn(async () => ({ started: true, url: "http://localhost:6006" })),
	runStorybookBuild: vi.fn(),
	resolveStorybookDir: vi.fn(() => "/project/components"),
}));

vi.mock("../../src/domain/make/component/storybook-settings.js", () => ({
	getFramework: vi.fn(() => "html"),
	setFramework: vi.fn(),
}));

vi.mock("../../src/ui/renderers/storybook-renderer-impl.js", () => ({
	createStorybookRenderer: vi.fn(() => ({})),
}));

import { commands } from "../../src/controller/storybook.controller.js";
import { createProjectContext } from "../helpers/command-test-utils.js";
import {
	installStorybook,
	isStorybookRunning,
	stopStorybook,
	startStorybookDev,
	isStorybookInstalled,
} from "../../src/domain/make/component/storybook-service.js";
import { setFramework } from "../../src/domain/make/component/storybook-settings.js";

const mockInstall = vi.mocked(installStorybook);
const mockIsRunning = vi.mocked(isStorybookRunning);
const mockStop = vi.mocked(stopStorybook);
const mockStart = vi.mocked(startStorybookDev);
const mockIsInstalled = vi.mocked(isStorybookInstalled);
const mockSetFramework = vi.mocked(setFramework);

beforeEach(() => {
	vi.clearAllMocks();
	mockInstall.mockReturnValue(true);
	mockIsRunning.mockReturnValue(false);
	mockIsInstalled.mockReturnValue(true);
	mockStart.mockResolvedValue({ started: true, url: "http://localhost:6006" });
});

// Extract handler from adaptDescriptor-wrapped command
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getHandler(name: string): (ctx: any) => any {
	const cmd = commands[name] as unknown as { __descriptor: { handler: (ctx: any) => any } };
	return cmd.__descriptor.handler;
}

describe("storybook:install", () => {
	it("calls setFramework and installStorybook with default framework", () => {
		const ctx = createProjectContext({ command: "storybook:install", flags: { framework: "" } });
		const handler = getHandler("storybook:install");
		const result = handler(ctx) as { installed: boolean; framework: string; sbDir: string };

		expect(mockSetFramework).toHaveBeenCalled();
		expect(mockInstall).toHaveBeenCalled();
		expect(result.installed).toBe(true);
		expect(result.framework).toBe("html");
	});

	it("uses --framework flag when provided", () => {
		const ctx = createProjectContext({ command: "storybook:install", flags: { framework: "angular" } });
		const handler = getHandler("storybook:install");
		const result = handler(ctx) as { installed: boolean; framework: string };

		expect(result.framework).toBe("angular");
		expect(mockSetFramework).toHaveBeenCalledWith(
			expect.any(String), "angular", expect.anything(),
		);
	});

	it("returns installed: false when installation fails", () => {
		mockInstall.mockReturnValue(false);
		const ctx = createProjectContext({ command: "storybook:install", flags: { framework: "" } });
		const handler = getHandler("storybook:install");
		const result = handler(ctx) as { installed: boolean };

		expect(result.installed).toBe(false);
	});

	it("returns installed: true when already installed", () => {
		mockInstall.mockReturnValue(true);
		const ctx = createProjectContext({ command: "storybook:install", flags: { framework: "" } });
		const handler = getHandler("storybook:install");
		const result = handler(ctx) as { installed: boolean };

		expect(result.installed).toBe(true);
		expect(mockInstall).toHaveBeenCalled();
	});
});

describe("storybook:start", () => {
	it("calls startStorybookDev and returns result", async () => {
		const ctx = createProjectContext({ command: "storybook:start" });
		const handler = getHandler("storybook:start");
		const result = await (handler(ctx) as Promise<{ started: boolean; url: string }>);

		expect(mockStart).toHaveBeenCalled();
		expect(result.started).toBe(true);
		expect(result.url).toBe("http://localhost:6006");
	});

	it("propagates error from startStorybookDev", async () => {
		mockStart.mockResolvedValue({ started: false, url: "", error: "not-installed" });
		const ctx = createProjectContext({ command: "storybook:start" });
		const handler = getHandler("storybook:start");
		const result = await (handler(ctx) as Promise<{ started: boolean; error?: string }>);

		expect(result.started).toBe(false);
		expect(result.error).toBe("not-installed");
	});
});

describe("storybook:stop", () => {
	it("stops storybook when running", () => {
		mockIsRunning.mockReturnValue(true);
		const ctx = createProjectContext({ command: "storybook:stop" });
		const handler = getHandler("storybook:stop");
		const result = handler(ctx) as { stopped: boolean; wasRunning: boolean };

		expect(mockStop).toHaveBeenCalled();
		expect(result.wasRunning).toBe(true);
		expect(result.stopped).toBe(true);
	});

	it("reports not running when storybook is not active", () => {
		mockIsRunning.mockReturnValue(false);
		const ctx = createProjectContext({ command: "storybook:stop" });
		const handler = getHandler("storybook:stop");
		const result = handler(ctx) as { stopped: boolean; wasRunning: boolean };

		expect(mockStop).not.toHaveBeenCalled();
		expect(result.wasRunning).toBe(false);
		expect(result.stopped).toBe(false);
	});
});

describe("storybook:build", () => {
	it("returns built: true when storybook is installed", () => {
		const ctx = createProjectContext({ command: "storybook:build" });
		const handler = getHandler("storybook:build");
		const result = handler(ctx) as { built: boolean };

		expect(result.built).toBe(true);
	});

	it("returns built: false when storybook is not installed", () => {
		mockIsInstalled.mockReturnValue(false);
		const ctx = createProjectContext({ command: "storybook:build" });
		const handler = getHandler("storybook:build");
		const result = handler(ctx) as { built: boolean };

		expect(result.built).toBe(false);
	});
});
```

- [ ] **Step 2: Run the tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/controller/storybook.controller.test.ts --config configs/vitest.config.ts`
Expected: All 10 tests PASS

- [ ] **Step 3: Run the full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: All tests PASS, no regressions

- [ ] **Step 4: Run lint**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/controller/storybook.controller.ts --config configs/eslint.config.mjs`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/tests/controller/storybook.controller.test.ts"
git commit -m "test: add controller tests for storybook CLI commands"
```

### Task 8: Final verification

- [ ] **Step 1: Full check (lint + tsc + tests)**

Run: `cd "01 - Projects/Flowti CLI" && npm test`
Expected: All checks pass

- [ ] **Step 2: Build**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`
Expected: Build succeeds

- [ ] **Step 3: Smoke test the commands**

Run from git root:
```bash
./flowti.cmd storybook:build --project="Flowti CLI"
```
Expected: Either builds storybook or reports "not installed" (depending on whether Storybook packages are installed in `components/`)
