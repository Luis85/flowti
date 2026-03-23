# Generic Process Manager — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a generic process registry in the CLI domain layer so the Plugin delegates all process management (storybook start/stop/build) to CLI commands instead of spawning processes directly.

**Architecture:** New `src/domain/processes/process-registry.ts` module with deps-injected CRUD + liveness. Infrastructure gains `IPidOps` interface and `renameSync` on `IFileSystem`. Storybook controller/service rewired to use registry. Plugin simplified to thin `runFlowtiCli` wrappers.

**Tech Stack:** Node.js built-ins only (zero runtime deps). Vitest for tests. TypeScript strict mode. ESM with `.js` extensions.

**Spec:** `docs/specs/2026-03-22-generic-process-manager-design.md`

---

## Chunk 1: Infrastructure Foundation

### Task 1: Add `renameSync` to `IFileSystem` interface and implementation

**Files:**
- Modify: `src/infrastructure/types.ts:15-27` (IFileSystem interface)
- Modify: `src/infrastructure/filesystem.ts:11-55` (NodeFileSystem class)
- Modify: `tests/helpers/command-test-utils.ts` (mock fs if it stubs IFileSystem)

- [ ] **Step 1: Add `renameSync` to `IFileSystem` interface**

In `src/infrastructure/types.ts`, add after line 26 (`statSync`):

```typescript
	renameSync(oldPath: string, newPath: string): void;
```

- [ ] **Step 2: Implement `renameSync` in `NodeFileSystem`**

In `src/infrastructure/filesystem.ts`, add after the `statSync` method (line 53):

```typescript
	renameSync(oldPath: string, newPath: string): void {
		fsNode.renameSync(oldPath, newPath);
	}
```

- [ ] **Step 3: Run type check to verify no breakage**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No new errors (existing node_modules errors are expected)

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/types.ts" "01 - Projects/Flowti CLI/src/infrastructure/filesystem.ts"
git commit -m "feat(infra): add renameSync to IFileSystem for atomic writes"
```

---

### Task 2: Add `IPidOps` interface and production implementation

**Files:**
- Modify: `src/infrastructure/types.ts:71-82` (after IProcess)
- Modify: `src/infrastructure/proc.ts` (extend with IPidOps implementation)
- Test: `tests/infrastructure/proc.test.ts` (new)

- [ ] **Step 1: Write the failing test for `isPidAlive`**

Create `tests/infrastructure/proc.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { pidOps } from "../../src/infrastructure/proc.js";

describe("pidOps", () => {
	describe("isPidAlive", () => {
		it("returns true for the current process PID", () => {
			expect(pidOps.isPidAlive(process.pid)).toBe(true);
		});

		it("returns false for an obviously dead PID", () => {
			expect(pidOps.isPidAlive(999999)).toBe(false);
		});
	});

	describe("killPid", () => {
		it("returns false for a non-existent PID", () => {
			expect(pidOps.killPid(999999)).toBe(false);
		});
	});

	describe("isPortListening", () => {
		it("returns false for an unbound port", async () => {
			expect(await pidOps.isPortListening(59999)).toBe(false);
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/proc.test.ts --config configs/vitest.config.ts`
Expected: FAIL — `pidOps` is not exported from proc.ts

- [ ] **Step 3: Add `IPidOps` interface to types.ts**

In `src/infrastructure/types.ts`, add after line 82 (after `IProcess` closing brace):

```typescript

// ── PID operations abstraction ───────────────────────────────────────

export interface IPidOps {
	/** Check if a process with the given PID is alive. */
	isPidAlive(pid: number): boolean;
	/** Check if a TCP port is currently listening. */
	isPortListening(port: number): Promise<boolean>;
	/** Kill a process by PID. Returns true if the process was found and killed. */
	killPid(pid: number): boolean;
}
```

- [ ] **Step 4: Implement `IPidOps` in proc.ts**

In `src/infrastructure/proc.ts`, add after line 28:

```typescript
import { execSync } from "node:child_process";
import net from "node:net";
import type { IPidOps } from "./types.js";

class NodePidOps implements IPidOps {
	isPidAlive(pid: number): boolean {
		try {
			process.kill(pid, 0);
			return true;
		} catch {
			return false;
		}
	}

	isPortListening(port: number): Promise<boolean> {
		return new Promise((resolve) => {
			const sock = net.createConnection({ port, host: "127.0.0.1" });
			sock.setTimeout(1000);
			sock.on("connect", () => { sock.destroy(); resolve(true); });
			sock.on("error", () => { resolve(false); });
			sock.on("timeout", () => { sock.destroy(); resolve(false); });
		});
	}

	killPid(pid: number): boolean {
		try {
			if (process.platform === "win32") {
				execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore", windowsHide: true });
			} else {
				process.kill(pid, "SIGTERM");
			}
			return true;
		} catch {
			return false;
		}
	}
}

export const pidOps: IPidOps = new NodePidOps();
```

Note: Update the existing import at line 1 of proc.ts to also import `IPidOps`:

```typescript
import type { IProcess, IPidOps } from "./types.js";
```

And add the `execSync` and `net` imports at the top of the file.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/proc.test.ts --config configs/vitest.config.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/types.ts" "01 - Projects/Flowti CLI/src/infrastructure/proc.ts" "01 - Projects/Flowti CLI/tests/infrastructure/proc.test.ts"
git commit -m "feat(infra): add IPidOps interface with isPidAlive, isPortListening, killPid"
```

---

### Task 3: Register `pidOps` on `CliDeps` and export `ProcessDeps`

**Files:**
- Modify: `src/infrastructure/deps.ts:9,40-55,57-99` (import, CliDeps interface, ISP subsets)

- [ ] **Step 1: Add `IPidOps` to imports in deps.ts**

In `src/infrastructure/deps.ts` line 9, add `IPidOps` to the type import:

```typescript
import type { IFileSystem, IShell, IPaths, IClock, IProcess, IInput, IWorldStateManager, IWorkerManager, IAgentProcessRunner, IPidOps } from "./types.js";
```

- [ ] **Step 2: Add `pidOps` import from proc.ts**

After line 17 (`import { proc } from "./proc.js";`), add:

```typescript
import { pidOps } from "./proc.js";
```

- [ ] **Step 3: Add `pidOps` to `CliDeps` interface**

After line 45 (`readonly proc: IProcess;`), add:

```typescript
	readonly pidOps: IPidOps;
```

- [ ] **Step 4: Export `ProcessDeps` ISP subset**

After the last ISP type (around line 99), add:

```typescript

/** Dependencies for process registry operations. */
export type ProcessDeps = Pick<CliDeps, "disk" | "paths" | "clock" | "pidOps">;
```

- [ ] **Step 5: Add `pidOps` to `createDefaultDeps` return**

Find the `createDefaultDeps` function return object and add `pidOps` alongside `proc`:

```typescript
pidOps,
```

- [ ] **Step 6: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No new source errors

- [ ] **Step 7: Run full tests to verify nothing broke**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: All existing tests pass

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/deps.ts"
git commit -m "feat(infra): register pidOps on CliDeps, export ProcessDeps ISP subset"
```

---

### Task 4: Add `pid` to `BackgroundProcess` and `detached` to `spawnBackground`

**Files:**
- Modify: `src/infrastructure/types.ts:31-46` (BackgroundProcess interface)
- Modify: `src/infrastructure/types.ts:63-64` (IShell.spawnBackground signature)
- Modify: `src/infrastructure/shell.ts:111-175` (spawnBackground implementation)

- [ ] **Step 1: Add `pid` to `BackgroundProcess` interface**

In `src/infrastructure/types.ts`, add after line 41 (`readonly running: boolean;`):

```typescript
	/** OS process ID. */
	readonly pid: number;
```

- [ ] **Step 2: Update `IShell.spawnBackground` signature**

In `src/infrastructure/types.ts` line 64, update:

```typescript
	spawnBackground(cmd: string, opts?: { cwd?: string; env?: Record<string, string>; stdin?: boolean; detached?: boolean }): BackgroundProcess;
```

- [ ] **Step 3: Implement `detached` in `NodeShell.spawnBackground`**

In `src/infrastructure/shell.ts` line 112, update the spawn call:

```typescript
	spawnBackground(cmd: string, opts: { cwd?: string; env?: Record<string, string>; stdin?: boolean; detached?: boolean } = {}): BackgroundProcess {
		const child = spawn(cmd, {
			cwd: opts.cwd ?? CLI_PROJECT,
			shell: true,
			windowsHide: true,
			detached: opts.detached ?? false,
			stdio: [opts.stdin ? "pipe" : "ignore", "pipe", "pipe"],
			env: opts.env ? { ...process.env, ...opts.env } : undefined,
		});
```

- [ ] **Step 4: Expose `pid` on the returned BackgroundProcess object**

In `src/infrastructure/shell.ts`, add `pid` to the returned object (around line 138):

```typescript
		return {
			get pid() { return child.pid ?? 0; },
			get running() { return running; },
```

- [ ] **Step 5: Add `unref` method to returned object for detached processes**

Add after the `kill()` method (around line 161):

```typescript
			unref() {
				try { child.unref(); } catch { /* already unref'd */ }
			},
```

Also update `BackgroundProcess` interface in `types.ts` — add:

```typescript
	/** Unreference the child process so the parent can exit while child runs. Only meaningful for detached processes. */
	unref(): void;
```

- [ ] **Step 6: Run type check and tests**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/types.ts" "01 - Projects/Flowti CLI/src/infrastructure/shell.ts"
git commit -m "feat(infra): add pid, detached, unref to BackgroundProcess/spawnBackground"
```

---

## Chunk 2: Process Registry Domain

### Task 5: Process registry — `registerProcess` and `getProcess`

**Files:**
- Create: `src/domain/processes/process-registry.ts`
- Test: `tests/domain/processes/process-registry.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/processes/process-registry.test.ts`:

```typescript
vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../../src/infrastructure/proc.js", () => ({ pidOps: {} }));

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerProcess, getProcess } from "../../../src/domain/processes/process-registry.js";
import type { ProcessDeps } from "../../../src/infrastructure/deps.js";
import type { ProcessEntry } from "../../../src/domain/processes/process-registry.js";

function createMockDeps(overrides: Partial<ProcessDeps> = {}): ProcessDeps {
	return {
		disk: {
			writeFileSync: vi.fn(),
			readFileSync: vi.fn(),
			existsSync: vi.fn().mockReturnValue(false),
			mkdirSync: vi.fn(),
			unlinkSync: vi.fn(),
			renameSync: vi.fn(),
			readdirSync: vi.fn().mockReturnValue([]),
			statSync: vi.fn(),
			copyFileSync: vi.fn(),
			rmSync: vi.fn(),
		} as unknown as ProcessDeps["disk"],
		paths: {
			join: (...parts: string[]) => parts.join("/"),
		} as unknown as ProcessDeps["paths"],
		clock: {
			iso: () => "2026-03-22T12:00:00.000Z",
		} as unknown as ProcessDeps["clock"],
		pidOps: {
			isPidAlive: vi.fn().mockReturnValue(true),
			isPortListening: vi.fn().mockResolvedValue(false),
			killPid: vi.fn().mockReturnValue(true),
		} as unknown as ProcessDeps["pidOps"],
		...overrides,
	};
}

const ENTRY: ProcessEntry = {
	type: "storybook",
	name: "MyProject",
	pid: 1234,
	port: 6006,
	url: "http://localhost:6006",
	startedAt: "2026-03-22T12:00:00.000Z",
};

describe("process-registry", () => {
	describe("registerProcess", () => {
		it("writes entry to JSON file via atomic rename", () => {
			const deps = createMockDeps();
			registerProcess(deps, ENTRY);

			expect(deps.disk.mkdirSync).toHaveBeenCalled();
			expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
				expect.stringContaining("storybook-MyProject.json.tmp"),
				expect.stringContaining('"pid":1234'),
				"utf-8",
			);
			expect(deps.disk.renameSync).toHaveBeenCalledWith(
				expect.stringContaining(".tmp"),
				expect.stringContaining("storybook-MyProject.json"),
			);
		});
	});

	describe("getProcess", () => {
		it("returns null when no entry file exists", () => {
			const deps = createMockDeps();
			expect(getProcess(deps, "storybook", "MyProject")).toBeNull();
		});

		it("returns entry when file exists and PID is alive", () => {
			const deps = createMockDeps();
			(deps.disk.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
			(deps.disk.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(ENTRY));

			const result = getProcess(deps, "storybook", "MyProject");
			expect(result).toEqual(ENTRY);
			expect(deps.pidOps.isPidAlive).toHaveBeenCalledWith(1234);
		});

		it("auto-cleans stale entry when PID is dead", () => {
			const deps = createMockDeps();
			(deps.disk.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
			(deps.disk.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(ENTRY));
			(deps.pidOps.isPidAlive as ReturnType<typeof vi.fn>).mockReturnValue(false);

			const result = getProcess(deps, "storybook", "MyProject");
			expect(result).toBeNull();
			expect(deps.disk.unlinkSync).toHaveBeenCalled();
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/processes/process-registry.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `process-registry.ts`**

Create `src/domain/processes/process-registry.ts`:

```typescript
/**
 * process-registry.ts — Generic process registry (domain layer).
 *
 * Persists ProcessEntry records as JSON in .flowti/var/processes/.
 * Liveness checks and kill delegate to deps.pidOps (infrastructure).
 */

import type { ProcessDeps } from "../../infrastructure/deps.js";

export interface StorybookMeta {
	readonly framework: string;
	readonly configDir: string;
}

export interface LlmMeta {
	readonly provider: string;
	readonly sessionId?: string;
}

export interface ProcessEntry {
	readonly type: string;
	readonly name: string;
	readonly pid: number;
	readonly port?: number;
	readonly url?: string;
	readonly startedAt: string;
	readonly meta?: StorybookMeta | LlmMeta;
}

const REGISTRY_DIR = ".flowti/var/processes";

function entryPath(deps: ProcessDeps, type: string, name: string): string {
	return deps.paths.join(REGISTRY_DIR, `${type}-${name}.json`);
}

function ensureDir(deps: ProcessDeps): void {
	deps.disk.mkdirSync(REGISTRY_DIR, { recursive: true });
}

export function registerProcess(deps: ProcessDeps, entry: ProcessEntry): void {
	ensureDir(deps);
	const target = entryPath(deps, entry.type, entry.name);
	const tmp = target + ".tmp";
	deps.disk.writeFileSync(tmp, JSON.stringify(entry), "utf-8");
	deps.disk.renameSync(tmp, target);
}

export function unregisterProcess(deps: ProcessDeps, type: string, name: string): void {
	const path = entryPath(deps, type, name);
	try { deps.disk.unlinkSync(path); } catch { /* already gone */ }
}

export function getProcess(deps: ProcessDeps, type: string, name: string): ProcessEntry | null {
	const path = entryPath(deps, type, name);
	if (!deps.disk.existsSync(path)) return null;
	try {
		const raw = deps.disk.readFileSync(path, "utf-8");
		const entry = JSON.parse(raw) as ProcessEntry;
		if (!deps.pidOps.isPidAlive(entry.pid)) {
			try { deps.disk.unlinkSync(path); } catch { /* ok */ }
			return null;
		}
		return entry;
	} catch {
		return null;
	}
}

export function listProcesses(deps: ProcessDeps, type?: string): ProcessEntry[] {
	ensureDir(deps);
	const files = deps.disk.readdirSync(REGISTRY_DIR).filter((f) => f.endsWith(".json") && !f.endsWith(".tmp"));
	const entries: ProcessEntry[] = [];
	for (const file of files) {
		try {
			const raw = deps.disk.readFileSync(deps.paths.join(REGISTRY_DIR, file), "utf-8");
			const entry = JSON.parse(raw) as ProcessEntry;
			if (type && entry.type !== type) continue;
			if (!deps.pidOps.isPidAlive(entry.pid)) {
				try { deps.disk.unlinkSync(deps.paths.join(REGISTRY_DIR, file)); } catch { /* ok */ }
				continue;
			}
			entries.push(entry);
		} catch { /* skip corrupt */ }
	}
	return entries;
}

export function killProcess(deps: ProcessDeps, type: string, name: string): boolean {
	const entry = getProcess(deps, type, name);
	if (!entry) return false;
	const killed = deps.pidOps.killPid(entry.pid);
	unregisterProcess(deps, type, name);
	return killed;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/processes/process-registry.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/processes/process-registry.ts" "01 - Projects/Flowti CLI/tests/domain/processes/process-registry.test.ts"
git commit -m "feat(domain): add process registry with register, get, list, kill, unregister"
```

---

### Task 6: Process registry — remaining tests (`listProcesses`, `killProcess`, `unregisterProcess`)

**Files:**
- Modify: `tests/domain/processes/process-registry.test.ts`

- [ ] **Step 1: Add tests for `unregisterProcess`, `listProcesses`, `killProcess`**

Append to the test file:

```typescript
import { unregisterProcess, listProcesses, killProcess } from "../../../src/domain/processes/process-registry.js";

describe("unregisterProcess", () => {
	it("deletes the entry file", () => {
		const deps = createMockDeps();
		unregisterProcess(deps, "storybook", "MyProject");
		expect(deps.disk.unlinkSync).toHaveBeenCalledWith(
			expect.stringContaining("storybook-MyProject.json"),
		);
	});

	it("does not throw if file does not exist", () => {
		const deps = createMockDeps();
		(deps.disk.unlinkSync as ReturnType<typeof vi.fn>).mockImplementation(() => { throw new Error("ENOENT"); });
		expect(() => unregisterProcess(deps, "storybook", "Missing")).not.toThrow();
	});
});

describe("listProcesses", () => {
	it("returns empty array when directory has no entries", () => {
		const deps = createMockDeps();
		expect(listProcesses(deps)).toEqual([]);
	});

	it("returns live entries and cleans stale ones", () => {
		const alive: ProcessEntry = { ...ENTRY, pid: 100 };
		const dead: ProcessEntry = { ...ENTRY, pid: 200, name: "Dead" };
		const deps = createMockDeps();
		(deps.disk.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(["storybook-MyProject.json", "storybook-Dead.json"]);
		(deps.disk.readFileSync as ReturnType<typeof vi.fn>)
			.mockReturnValueOnce(JSON.stringify(alive))
			.mockReturnValueOnce(JSON.stringify(dead));
		(deps.pidOps.isPidAlive as ReturnType<typeof vi.fn>)
			.mockImplementation((pid: number) => pid === 100);

		const result = listProcesses(deps);
		expect(result).toHaveLength(1);
		expect(result[0].pid).toBe(100);
		expect(deps.disk.unlinkSync).toHaveBeenCalled();
	});

	it("filters by type when specified", () => {
		const sb: ProcessEntry = { ...ENTRY, type: "storybook" };
		const llm: ProcessEntry = { ...ENTRY, type: "llm", name: "Atlas" };
		const deps = createMockDeps();
		(deps.disk.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(["storybook-MyProject.json", "llm-Atlas.json"]);
		(deps.disk.readFileSync as ReturnType<typeof vi.fn>)
			.mockReturnValueOnce(JSON.stringify(sb))
			.mockReturnValueOnce(JSON.stringify(llm));

		expect(listProcesses(deps, "storybook")).toHaveLength(1);
	});
});

describe("killProcess", () => {
	it("kills the process and unregisters it", () => {
		const deps = createMockDeps();
		(deps.disk.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
		(deps.disk.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(ENTRY));

		const killed = killProcess(deps, "storybook", "MyProject");
		expect(killed).toBe(true);
		expect(deps.pidOps.killPid).toHaveBeenCalledWith(1234);
		expect(deps.disk.unlinkSync).toHaveBeenCalled();
	});

	it("returns false when no entry exists", () => {
		const deps = createMockDeps();
		expect(killProcess(deps, "storybook", "Missing")).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/processes/process-registry.test.ts --config configs/vitest.config.ts`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/tests/domain/processes/process-registry.test.ts"
git commit -m "test(domain): complete process-registry test coverage"
```

---

## Chunk 3: CLI Storybook Commands Rewire

### Task 7: Rewire `storybook:start` to use process registry

**Files:**
- Modify: `src/domain/make/component/storybook-service.ts:125-180` (startStorybookDev)
- Modify: `src/domain/make/component/storybook-browser.ts:79-103` (activeProcess singleton)
- Modify: `src/controller/storybook.controller.ts:151-163` (storybook:start command)
- Modify: `tests/domain/make/component/storybook-service.test.ts`

- [ ] **Step 1: Update `startStorybookDev` to accept `ProcessDeps` and use registry**

In `src/domain/make/component/storybook-service.ts`, update the `startStorybookDev` function:

1. Add import at top:
```typescript
import { getProcess, registerProcess } from "../../processes/process-registry.js";
import type { ProcessDeps } from "../../../infrastructure/deps.js";
```

2. Update function signature to accept `processDeps`:
```typescript
export async function startStorybookDev(
	projectPath: string,
	config: ComponentsConfig,
	vaultRoot: string,
	deps: Omit<StorybookDeps, "input">,
	render: StorybookRenderer = nullStorybookRenderer,
	processDeps?: ProcessDeps,
): Promise<StorybookStartResult> {
```

3. Replace the `isStorybookRunning()` check with a registry check + port safety net:
```typescript
	if (processDeps) {
		const projectName = deps.paths.basename(projectPath);
		const existing = getProcess(processDeps, "storybook", projectName);
		if (existing) {
			render.alreadyRunning();
			return { started: false, url: existing.url ?? "", error: "already-running" };
		}
		// Safety net: catch unregistered instances occupying the port
		if (await processDeps.pidOps.isPortListening(6006)) {
			render.alreadyRunning();
			return { started: false, url: "http://localhost:6006", error: "port-in-use" };
		}
	} else if (isStorybookRunning()) {
		render.alreadyRunning();
		return { started: false, url: "", error: "already-running" };
	}
```

4. After `readyLine` is detected and URL extracted, register the process:
```typescript
	const url = extractLocalUrl(activeProcess.output);
	render.ready(url);

	if (processDeps) {
		const projectName = deps.paths.basename(projectPath);
		registerProcess(processDeps, {
			type: "storybook",
			name: projectName,
			pid: activeProcess.pid,
			port: 6006,
			url,
			startedAt: processDeps.clock.iso(),
		});
		activeProcess.unref();
	}
```

- [ ] **Step 2: Update `storybook:start` controller to pass ProcessDeps**

In `src/controller/storybook.controller.ts` line 153, update the handler:

```typescript
	"storybook:start": adaptDescriptor<Record<string, unknown>, StorybookStartResultModel>({
		requires: "project",
		handler: async (ctx) => {
			const { disk, paths, shell, log, clock, pidOps } = ctx.deps;
			const config = ctx.project!.config.components ?? {};
			return startStorybookDev(
				ctx.project!.path, config, VAULT_ROOT,
				{ disk, paths, shell },
				createStorybookRenderer(log),
				{ disk, paths, clock, pidOps },
			);
		},
		renderer: renderStorybookStartResult,
	}),
```

- [ ] **Step 3: Update existing tests to mock the new parameter**

In `tests/domain/make/component/storybook-service.test.ts`, find the `startStorybookDev` tests and ensure they still pass. The new `processDeps` parameter is optional so existing calls without it should work unchanged.

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/component/storybook-service.test.ts --config configs/vitest.config.ts`
Expected: All pass

- [ ] **Step 5: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/make/component/storybook-service.ts" "01 - Projects/Flowti CLI/src/controller/storybook.controller.ts"
git commit -m "feat(storybook): wire storybook:start to process registry with detached spawn"
```

---

### Task 8: Rewire `storybook:stop` to use process registry

**Files:**
- Modify: `src/controller/storybook.controller.ts:191-199` (storybook:stop command)
- Modify: `src/domain/make/component/storybook-browser.ts:87-95` (stopStorybook)

- [ ] **Step 1: Update `storybook:stop` controller**

In `src/controller/storybook.controller.ts`, replace the storybook:stop handler:

```typescript
	"storybook:stop": adaptDescriptor<Record<string, unknown>, StorybookStopResultModel>({
		requires: "project",
		handler: (ctx) => {
			const { disk, paths, clock, pidOps, log } = ctx.deps;
			const projectName = ctx.project!.name;
			const processDeps = { disk, paths, clock, pidOps };
			const entry = getProcess(processDeps, "storybook", projectName);
			if (entry) {
				killProcess(processDeps, "storybook", projectName);
				return { stopped: true, wasRunning: true };
			}
			// Fallback: check in-memory singleton (interactive mode)
			const wasRunning = isStorybookRunning();
			if (wasRunning) stopStorybook(createStorybookRenderer(log));
			return { stopped: wasRunning, wasRunning };
		},
		renderer: renderStorybookStopResult,
	}),
```

Add import at top of controller:

```typescript
import { getProcess, killProcess } from "../domain/processes/process-registry.js";
```

- [ ] **Step 2: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/controller/storybook.controller.test.ts --config configs/vitest.config.ts`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/controller/storybook.controller.ts"
git commit -m "feat(storybook): wire storybook:stop to process registry with fallback"
```

---

### Task 9: Add `process:list` command

**Files:**
- Create: `src/controller/process.controller.ts`
- Create: `src/ui/renderers/process-renderers.ts`
- Create: `tests/controller/process.controller.test.ts`
- Modify: `src/cli/register-builtin-domains.ts`

- [ ] **Step 1: Write the test**

Create `tests/controller/process.controller.test.ts`:

```typescript
vi.mock("../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../src/infrastructure/proc.js", () => ({ pidOps: {} }));

import { describe, it, expect, vi } from "vitest";
import { commands } from "../../src/controller/process.controller.js";

describe("process:list", () => {
	it("is a registered command", () => {
		expect(commands["process:list"]).toBeDefined();
	});
});
```

- [ ] **Step 2: Create renderer**

Create `src/ui/renderers/process-renderers.ts`:

```typescript
/**
 * Renderer for process:list command output.
 */

import type { ProcessEntry } from "../../domain/processes/process-registry.js";

type Log = (msg?: string) => void;

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

export interface ProcessListResultModel {
	readonly entries: ProcessEntry[];
}

export function renderProcessList(data: ProcessListResultModel, log: Log): void {
	if (data.entries.length === 0) {
		log(`\n  ${DIM}No running processes.${RESET}\n`);
		return;
	}
	log("");
	for (const e of data.entries) {
		const url = e.url ? ` ${DIM}${e.url}${RESET}` : "";
		log(`  ${e.type}/${e.name}  pid=${e.pid}${url}  since ${e.startedAt}`);
	}
	log("");
}
```

- [ ] **Step 3: Create controller**

Create `src/controller/process.controller.ts`:

```typescript
/**
 * process.controller.ts — Process registry commands.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types-config.js";
import { listProcesses } from "../domain/processes/process-registry.js";
import { renderProcessList } from "../ui/renderers/process-renderers.js";
import type { ProcessListResultModel } from "../ui/renderers/process-renderers.js";

export const commands: Record<string, CommandHandler> = {
	"process:list": adaptDescriptor<{ type?: string }, ProcessListResultModel>({
		flags: {
			type: { type: "string", required: false, hint: "--type=storybook" },
		},
		handler: (ctx) => {
			const { disk, paths, clock, pidOps } = ctx.deps;
			const entries = listProcesses({ disk, paths, clock, pidOps }, ctx.flags.type || undefined);
			return { entries };
		},
		renderer: renderProcessList,
	}),
};
```

- [ ] **Step 4: Register in `register-builtin-domains.ts`**

Add import and registration entry:

```typescript
import { commands as processCmds } from "../controller/process.controller.js";
```

And add a `registry.registerDomain()` call alongside the others (e.g. after the storybook domain registration around line 168):

```typescript
	registry.registerDomain({ domain: "processes", commands: processCmds, projectFree: ["process:list"] });
```

- [ ] **Step 5: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/controller/process.controller.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 6: Run full tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/controller/process.controller.ts" "01 - Projects/Flowti CLI/src/ui/renderers/process-renderers.ts" "01 - Projects/Flowti CLI/tests/controller/process.controller.test.ts" "01 - Projects/Flowti CLI/src/cli/register-builtin-domains.ts"
git commit -m "feat(cli): add process:list command for registry introspection"
```

---

## Chunk 4: Plugin Simplification

### Task 10: Replace plugin `startStorybook` with `runFlowtiCli`

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/infrastructure/projects/vault-project-service.ts:7,92-112`

- [ ] **Step 1: Remove `spawn` import**

In `vault-project-service.ts`, remove line 7:

```typescript
import { spawn } from "node:child_process";
```

- [ ] **Step 2: Replace `startStorybook` method body**

Replace the entire `startStorybook` method (lines 92-112) with:

```typescript
	async startStorybook(project: string, onOutput?: OutputCallback): Promise<{ ok: boolean; url?: string; pid?: number; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		const lines: string[] = [];
		const result = await runFlowtiCli(vaultBase, ["storybook:start", `--project=${project}`], (line) => {
			if (line !== "Done.") lines.push(line);
			onOutput?.(line);
		});
		if (!result.ok) return { ok: false, error: result.error };
		try {
			const parsed = JSON.parse(lines.join("")) as { started?: boolean; url?: string; pid?: number; error?: string };
			return { ok: parsed.started ?? true, url: parsed.url, pid: parsed.pid, error: parsed.error };
		} catch {
			return { ok: true };
		}
	}
```

- [ ] **Step 3: Replace `stopStorybook` method body**

Replace the entire `stopStorybook` method with:

```typescript
	async stopStorybook(project: string): Promise<{ ok: boolean; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		return runFlowtiCli(vaultBase, ["storybook:stop", `--project=${project}`]);
	}
```

- [ ] **Step 4: Replace `buildStorybook` method body**

Replace the entire `buildStorybook` method with:

```typescript
	async buildStorybook(project: string, onOutput?: OutputCallback): Promise<{ ok: boolean; outputDir?: string; error?: string }> {
		const vaultBase = getVaultBasePath(this.app);
		const cwd = join(vaultBase, PROJECTS_FOLDER, project);
		const result = await runFlowtiCli(vaultBase, ["storybook:build", `--project=${project}`], onOutput);
		return result.ok ? { ...result, outputDir: join(cwd, "storybook-static") } : result;
	}
```

- [ ] **Step 5: Remove `runningProcesses` Map**

Remove the `runningProcesses` field from the class (line 42):

```typescript
	private runningProcesses = new Map<string, { pid: number; url: string }>();
```

And remove any remaining references to `this.runningProcesses` (search the file).

- [ ] **Step 6: Clean up unused imports**

Remove these imports that are no longer used:
- `shellQuote` from `vault-project-cli.ts` (if no longer referenced)
- `findStorybookDir` from `vault-project-cli.ts` (if no longer referenced)
- `STORYBOOK_BUILD_TIMEOUT_MS`, `SHORT_SHELL_COMMAND_TIMEOUT_MS` (if no longer referenced elsewhere)

Check each one before removing — `stopStorybook` previously used `runAsync` and `SHORT_SHELL_COMMAND_TIMEOUT_MS`.

- [ ] **Step 7: Run plugin tests**

Run: `cd "01 - Projects/Flowti Plugin" && npm test`
Expected: All pass

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/projects/vault-project-service.ts"
git commit -m "refactor(plugin): replace direct process spawning with runFlowtiCli for storybook"
```

---

### Task 11: Simplify plugin storybook handler

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-storybook-handler.ts:84-147`

- [ ] **Step 1: Simplify the `storybook-start` event handler**

Replace the `storybook-start` listener (lines 84-147) with:

```typescript
		el.addEventListener("storybook-start", (() => {
			if (signal.aborted) return;
			this.startWork("Starting Storybook…");
			void projectService.startStorybook(this.deps.getCurrentProject(), this.appendLog.bind(this))
				.then((result) => {
					this.endWork(result);
				})
				.catch((err: unknown) => {
					const msg = err instanceof Error ? err.message : String(err);
					this.appendLog(`Error: ${msg}`);
					this.endWork({ ok: false, error: msg });
				});
		}) as EventListener, { signal });
```

- [ ] **Step 2: Run plugin tests**

Run: `cd "01 - Projects/Flowti Plugin" && npm test`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/handlers/project-storybook-handler.ts"
git commit -m "refactor(plugin): simplify storybook-start handler to single await"
```

---

**Note on `storybook-browser.ts`:** The module-level `activeProcess` singleton is intentionally retained as a fallback for interactive CLI mode (where the CLI process stays alive). The registry is the primary mechanism for non-interactive/plugin invocations. The existing `storybook-browser.test.ts` tests should continue to pass without modification since the singleton API is unchanged.

### Task 12: Final verification

- [ ] **Step 1: Run CLI full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: All pass

- [ ] **Step 2: Run Plugin full test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npm test`
Expected: All pass

- [ ] **Step 3: Build CLI**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`
Expected: Build succeeds

- [ ] **Step 4: Build Plugin**

Run: `cd "01 - Projects/Flowti Plugin" && npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: final verification — all tests and builds pass"
```
