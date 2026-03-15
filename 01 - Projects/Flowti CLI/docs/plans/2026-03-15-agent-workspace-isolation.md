# Agent Workspace Isolation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable AI agents to work in isolated git worktree/clone workspaces with feature-branch workflows, without interfering with the main vault or each other.

**Architecture:** On-demand `AgentWorkspace` entities with lifecycle states, provisioned by `WorkspaceProvisioner` (worktree default, clone fallback), orchestrated through a unified `IAgentShell` dispatch interface. State splits at provision time (identity from vault, runtime local), collects back on completion.

**Tech Stack:** Node.js built-ins only (zero runtime deps). Git CLI for worktree/clone. Existing DI patterns (`CliDeps` subsets), EventBus, stream-json process spawning.

**Spec:** `docs/specs/2026-03-15-agent-workspace-isolation-design.md`

---

## File Structure

### New Files

| File | Layer | Responsibility |
|------|-------|---------------|
| `src/domain/agents/agent-workspace.ts` | Domain | `AgentWorkspace` entity, `WorkspaceState`, state transition functions, ID generation, branch name generation |
| `src/domain/agents/agent-shell.ts` | Domain | `IAgentShell` interface, `DispatchRequest`, `DispatchResult`, `CollectResult`, `PruneOptions`, `PruneSummary`, `AgentProcessResult` |
| `src/domain/agents/workspace-events.ts` | Domain | `WorkspaceEventMap` type for EventBus integration |
| `src/infrastructure/workspace-registry.ts` | Infra | In-memory + flush-on-mutate JSON persistence for workspace tracking |
| `src/infrastructure/workspace-provisioner.ts` | Infra | Git worktree/clone operations, branch collision detection, path quoting |
| `src/infrastructure/state-splitter.ts` | Infra | Copy identity files, snapshot runtime state into workspace |
| `src/infrastructure/state-collector.ts` | Infra | Merge runtime state back, append conversations, scan git commits |
| `src/infrastructure/agent-shell.ts` | Infra | `AgentShell` implementation composing all workspace services |
| `src/controller/workspace.controller.ts` | Controller | 6 CLI commands under `workspace:` namespace |
| `src/ui/renderers/workspace-renderers.ts` | UI | Display functions for workspace list, inspect, prune summary |
| `src/ui/handlers/workspace-handlers.ts` | UI | Sitemap action/view handlers for Workspaces page |
| `tests/domain/agents/agent-workspace.test.ts` | Test | State transitions, ID generation, branch naming |
| `tests/domain/agents/workspace-events.test.ts` | Test | Event map type validation |
| `tests/infrastructure/workspace-registry.test.ts` | Test | CRUD, flush, load, orphan detection |
| `tests/infrastructure/workspace-provisioner.test.ts` | Test | Worktree/clone logic, fallback, path quoting |
| `tests/infrastructure/state-splitter.test.ts` | Test | File copy matrix verification |
| `tests/infrastructure/state-collector.test.ts` | Test | Merge strategy, conversation append, git scan |
| `tests/infrastructure/agent-shell.test.ts` | Test | Dispatch flow, collect semantics, prune logic |
| `tests/controller/workspace.controller.test.ts` | Test | CLI command routing, flag parsing |

### Modified Files

| File | Change |
|------|--------|
| `src/domain/agents/worker-types.ts` | Add `SpawnOptions` with optional `cwd` to `IAgentProcessRunner.spawn()` |
| `src/infrastructure/agent-process-runner.ts` | Thread `cwd` through to `shell.spawnBackground()` |
| `src/infrastructure/types-config.ts` | Add `WorkspacesConfig` interface, `workspaces?` field to `FlowtiCliConfig` |
| `src/infrastructure/cli-events.ts` | Extend `CliEventMap` with `WorkspaceEventMap` |
| `src/infrastructure/deps.ts` | Add `WorkspaceDeps` ISP subset, add `agentShell?: IAgentShell` to `CliDeps`, wire in `createDefaultDeps()` |
| `configs/sitemap.json` | Add `workspaces` page under agents |
| `src/ui/handlers/register-handlers.ts` | Register workspace handlers |
| `src/main.ts` | Register workspace controller commands |

---

## Chunk 1: Domain Foundation

### Task 1: AgentWorkspace Entity & State Machine

**Files:**
- Create: `src/domain/agents/agent-workspace.ts`
- Test: `tests/domain/agents/agent-workspace.test.ts`

- [ ] **Step 1: Write failing tests for workspace state types and transitions**

```typescript
// tests/domain/agents/agent-workspace.test.ts
import { describe, it, expect } from "vitest";
import {
	createWorkspace,
	transitionState,
	generateWorkspaceId,
	generateBranchName,
	COLLECT_SKIPPED_SENTINEL,
	type AgentWorkspace,
	type WorkspaceState,
} from "../../../src/domain/agents/agent-workspace.js";

describe("generateWorkspaceId", () => {
	it("produces ws-{slug}-{suffix}-{hex} format", () => {
		const id = generateWorkspaceId("bob", "feat/auth");
		expect(id).toMatch(/^ws-bob-auth-[0-9a-f]{4}$/);
	});

	it("sanitizes branch slashes to last segment", () => {
		const id = generateWorkspaceId("alice", "agent/alice/fix-tests");
		expect(id).toMatch(/^ws-alice-fix-tests-[0-9a-f]{4}$/);
	});

	it("truncates long branch suffixes", () => {
		const id = generateWorkspaceId("bob", "feat/very-long-branch-name-that-exceeds-limit");
		const parts = id.split("-");
		const suffix = parts.slice(2, -1).join("-");
		expect(suffix.length).toBeLessThanOrEqual(20);
	});
});

describe("generateBranchName", () => {
	it("creates agent/{slug}/{task-slug} format", () => {
		const branch = generateBranchName("bob", "Add auth middleware", "agent/");
		expect(branch).toBe("agent/bob/add-auth");
	});

	it("uses custom prefix", () => {
		const branch = generateBranchName("alice", "Fix tests", "feature/");
		expect(branch).toBe("feature/alice/fix-test");
	});

	it("truncates task slug to 8 chars", () => {
		const branch = generateBranchName("bob", "Implement the full authentication system", "agent/");
		const taskSlug = branch.split("/")[2];
		expect(taskSlug.length).toBeLessThanOrEqual(8);
	});
});

describe("createWorkspace", () => {
	it("initializes with provision state", () => {
		const ws = createWorkspace({
			agentSlug: "bob",
			branch: "agent/bob/auth",
			baseBranch: "master",
			method: "worktree",
			path: "/tmp/ws-bob-auth-a3f2",
			retain: false,
			createdAt: "2026-03-15T10:00:00Z",
		});
		expect(ws.state).toBe("provision");
		expect(ws.collectResult).toBeNull();
		expect(ws.pid).toBeUndefined();
	});
});

describe("transitionState", () => {
	const base: AgentWorkspace = {
		id: "ws-bob-auth-a3f2",
		agentSlug: "bob",
		branch: "agent/bob/auth",
		baseBranch: "master",
		method: "worktree",
		state: "provision",
		path: "/tmp/ws-bob-auth-a3f2",
		retain: false,
		createdAt: "2026-03-15T10:00:00Z",
		collectResult: null,
	};

	it("transitions provision → ready", () => {
		const next = transitionState(base, "ready");
		expect(next.state).toBe("ready");
	});

	it("transitions ready → active with pid", () => {
		const ready = { ...base, state: "ready" as const };
		const next = transitionState(ready, "active", { pid: 1234, processName: "claude.exe" });
		expect(next.state).toBe("active");
		expect(next.pid).toBe(1234);
		expect(next.processName).toBe("claude.exe");
	});

	it("transitions active → collecting", () => {
		const active = { ...base, state: "active" as const, pid: 1234 };
		const next = transitionState(active, "collecting");
		expect(next.state).toBe("collecting");
	});

	it("transitions collecting → disposed", () => {
		const collecting = { ...base, state: "collecting" as const };
		const next = transitionState(collecting, "disposed", { completedAt: "2026-03-15T11:00:00Z" });
		expect(next.state).toBe("disposed");
		expect(next.completedAt).toBe("2026-03-15T11:00:00Z");
	});

	it("transitions collecting → retained", () => {
		const collecting = { ...base, state: "collecting" as const, retain: true };
		const next = transitionState(collecting, "retained", { completedAt: "2026-03-15T11:00:00Z" });
		expect(next.state).toBe("retained");
	});

	it("throws on invalid transition provision → active", () => {
		expect(() => transitionState(base, "active")).toThrow("Invalid transition");
	});

	it("throws on invalid transition disposed → ready", () => {
		const disposed = { ...base, state: "disposed" as const };
		expect(() => transitionState(disposed, "ready")).toThrow("Invalid transition");
	});
});

describe("COLLECT_SKIPPED_SENTINEL", () => {
	it("has empty arrays and collectSkipped error", () => {
		expect(COLLECT_SKIPPED_SENTINEL.commits).toEqual([]);
		expect(COLLECT_SKIPPED_SENTINEL.errors).toContain("collectSkipped");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/agent-workspace.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement agent-workspace.ts**

```typescript
// src/domain/agents/agent-workspace.ts
import type { CollectResult } from "./agent-shell.js";

export type WorkspaceState = "provision" | "ready" | "active" | "collecting" | "disposed" | "retained";

export interface AgentWorkspace {
	readonly id: string;
	readonly agentSlug: string;
	readonly branch: string;
	readonly baseBranch: string;
	readonly method: "worktree" | "clone";
	readonly state: WorkspaceState;
	readonly path: string;
	readonly pid?: number;
	readonly processName?: string;
	readonly retain: boolean;
	readonly createdAt: string;
	readonly completedAt?: string;
	readonly collectResult: CollectResult | null;
}

const VALID_TRANSITIONS: Record<WorkspaceState, readonly WorkspaceState[]> = {
	provision: ["ready"],
	ready: ["active"],
	active: ["collecting"],
	collecting: ["disposed", "retained"],
	disposed: [],
	retained: ["disposed"],
};

export interface CreateWorkspaceInput {
	readonly agentSlug: string;
	readonly branch: string;
	readonly baseBranch: string;
	readonly method: "worktree" | "clone";
	readonly path: string;
	readonly retain: boolean;
	readonly createdAt: string;
}

interface TransitionMeta {
	readonly pid?: number;
	readonly processName?: string;
	readonly completedAt?: string;
	readonly collectResult?: CollectResult;
}

export function generateWorkspaceId(agentSlug: string, branch: string): string {
	const suffix = branch.split("/").pop() ?? branch;
	const truncated = suffix.slice(0, 20);
	const hex = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0");
	return `ws-${agentSlug}-${truncated}-${hex}`;
}

export function generateBranchName(agentSlug: string, task: string, prefix: string): string {
	const slug = task.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 8).replace(/-$/, "");
	return `${prefix}${agentSlug}/${slug}`;
}

export function createWorkspace(input: CreateWorkspaceInput): AgentWorkspace {
	return {
		id: generateWorkspaceId(input.agentSlug, input.branch),
		agentSlug: input.agentSlug,
		branch: input.branch,
		baseBranch: input.baseBranch,
		method: input.method,
		state: "provision",
		path: input.path,
		retain: input.retain,
		createdAt: input.createdAt,
		collectResult: null,
	};
}

export function transitionState(ws: AgentWorkspace, to: WorkspaceState, meta?: TransitionMeta): AgentWorkspace {
	const allowed = VALID_TRANSITIONS[ws.state];
	if (!allowed.includes(to)) {
		throw new Error(`Invalid transition: ${ws.state} → ${to}`);
	}
	return {
		...ws,
		state: to,
		pid: meta?.pid ?? ws.pid,
		processName: meta?.processName ?? ws.processName,
		completedAt: meta?.completedAt ?? ws.completedAt,
		collectResult: meta?.collectResult ?? ws.collectResult,
	};
}

export const COLLECT_SKIPPED_SENTINEL: CollectResult = {
	commits: [],
	filesChanged: 0,
	conversationTurns: 0,
	runtimeState: {},
	errors: ["collectSkipped"],
};
```

Note: This file imports `CollectResult` from `agent-shell.ts` which doesn't exist yet. Create a stub first (Task 2 creates it), or define `CollectResult` here and re-export from `agent-shell.ts`. Recommendation: define both types files in Task 1+2 together since they cross-reference.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/agent-workspace.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/agent-workspace.ts" "01 - Projects/Flowti CLI/tests/domain/agents/agent-workspace.test.ts"
git commit -m "feat(workspace): add AgentWorkspace entity and state machine"
```

---

### Task 2: IAgentShell Interface & Workspace Event Types

**Files:**
- Create: `src/domain/agents/agent-shell.ts`
- Create: `src/domain/agents/workspace-events.ts`
- Test: `tests/domain/agents/workspace-events.test.ts`

- [ ] **Step 1: Write agent-shell.ts (pure types, no implementation)**

```typescript
// src/domain/agents/agent-shell.ts
import type { AgentWorkspace } from "./agent-workspace.js";
import type { AgentProcess } from "./worker-types.js";

export interface DispatchRequest {
	readonly agent: string;
	readonly task: string;
	readonly branch?: string;
	readonly baseBranch?: string;
	readonly retain?: boolean;
	readonly allowedTools?: readonly string[];
	readonly timeout?: number;
	readonly provider?: "anthropic" | "cursor";
}

export interface AgentProcessResult {
	readonly text: string;
	readonly thinking: string;
	readonly exitCode: number;
}

export interface DispatchResult {
	readonly workspace: AgentWorkspace;
	readonly process: AgentProcess;
	readonly branch: string;
	readonly output: Promise<AgentProcessResult>;
}

export interface CollectResult {
	readonly commits: readonly string[];
	readonly filesChanged: number;
	readonly conversationTurns: number;
	readonly runtimeState: Record<string, unknown>;
	readonly errors: readonly string[];
}

export interface PruneOptions {
	readonly olderThan?: number;
	readonly state?: "retained" | "disposed";
	readonly dryRun?: boolean;
}

export interface PruneSummary {
	readonly removed: number;
	readonly freed: string;
	readonly skipped: number;
	readonly errors: readonly string[];
}

export interface IAgentShell {
	dispatch(request: DispatchRequest): Promise<DispatchResult>;
	list(): AgentWorkspace[];
	collect(workspaceId: string): Promise<CollectResult>;
	dispose(workspaceId: string): Promise<void>;
	prune(options?: PruneOptions): Promise<PruneSummary>;
}
```

- [ ] **Step 2: Write workspace-events.ts**

```typescript
// src/domain/agents/workspace-events.ts
import type { AgentWorkspace } from "./agent-workspace.js";
import type { CollectResult, PruneSummary } from "./agent-shell.js";

export interface WorkspaceEventMap {
	"workspace:provisioned": { readonly workspace: AgentWorkspace; readonly method: "worktree" | "clone" };
	"workspace:ready": { readonly workspace: AgentWorkspace };
	"workspace:active": { readonly workspace: AgentWorkspace; readonly pid: number };
	"workspace:collecting": { readonly workspace: AgentWorkspace; readonly collectResult: CollectResult };
	"workspace:disposed": { readonly workspace: AgentWorkspace };
	"workspace:retained": { readonly workspace: AgentWorkspace };
	"workspace:orphaned": { readonly workspace: AgentWorkspace };
	"workspace:error": { readonly workspace: AgentWorkspace; readonly error: string };
}
```

- [ ] **Step 3: Write type-level test for workspace events**

```typescript
// tests/domain/agents/workspace-events.test.ts
import { describe, it, expect } from "vitest";
import type { WorkspaceEventMap } from "../../../src/domain/agents/workspace-events.js";

describe("WorkspaceEventMap", () => {
	it("defines all 8 workspace events", () => {
		const keys: (keyof WorkspaceEventMap)[] = [
			"workspace:provisioned",
			"workspace:ready",
			"workspace:active",
			"workspace:collecting",
			"workspace:disposed",
			"workspace:retained",
			"workspace:orphaned",
			"workspace:error",
		];
		expect(keys).toHaveLength(8);
	});

	it("provisioned payload includes method", () => {
		const payload: WorkspaceEventMap["workspace:provisioned"] = {
			workspace: {} as any,
			method: "worktree",
		};
		expect(payload.method).toBe("worktree");
	});

	it("error payload includes error string", () => {
		const payload: WorkspaceEventMap["workspace:error"] = {
			workspace: {} as any,
			error: "disk full",
		};
		expect(payload.error).toBe("disk full");
	});
});
```

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/workspace-events.test.ts tests/domain/agents/agent-workspace.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/agent-shell.ts" "01 - Projects/Flowti CLI/src/domain/agents/workspace-events.ts" "01 - Projects/Flowti CLI/tests/domain/agents/workspace-events.test.ts"
git commit -m "feat(workspace): add IAgentShell interface and workspace event types"
```

---

## Chunk 2: Configuration & Process Runner Update

### Task 3: WorkspacesConfig Type

**Files:**
- Modify: `src/infrastructure/types-config.ts`
- Test: existing type checks via `npx tsc --noEmit`

- [ ] **Step 1: Add WorkspacesConfig to types-config.ts**

Add after the existing `AgentsConfig` interface:

```typescript
export interface WorkspacesConfig {
	readonly baseDir: string;
	readonly defaultRetain: boolean;
	readonly retentionMaxAge: number;
	readonly maxConcurrent: number;
	readonly branchPrefix: string;
}
```

Add to `FlowtiCliConfig`:

```typescript
workspaces?: WorkspacesConfig;
```

- [ ] **Step 2: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS — no type errors

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/types-config.ts"
git commit -m "feat(workspace): add WorkspacesConfig to FlowtiCliConfig"
```

---

### Task 4: Add cwd to IAgentProcessRunner.spawn()

**Files:**
- Modify: `src/domain/agents/worker-types.ts`
- Modify: `src/infrastructure/agent-process-runner.ts`
- Modify: existing test if needed

- [ ] **Step 1: Add SpawnOptions to worker-types.ts**

Add before the `IAgentProcessRunner` interface:

```typescript
export interface SpawnOptions {
	readonly cwd?: string;
}
```

Update the `spawn` signature in `IAgentProcessRunner`:

```typescript
spawn(agent: AgentSummary, prompt: string, resolvedTools?: readonly string[], opts?: SpawnOptions): AgentProcess;
```

- [ ] **Step 2: Thread cwd through agent-process-runner.ts**

In `createProcessRunner`, update the spawn function to accept and pass `opts`:

Change the spawn signature:
```typescript
spawn(agent: AgentSummary, prompt: string, resolvedTools?: readonly string[], opts?: SpawnOptions): AgentProcess {
```

Change the `spawnBackground` call:
```typescript
const proc = deps.shell.spawnBackground(cmd, opts?.cwd ? { cwd: opts.cwd } : undefined);
```

**Important:** Do NOT change the temp file path — keep writing to `deps.paths.resolve(".")` (the CLI project dir). Writing temp files inside the workspace would create untracked git artifacts that could interfere with `StateCollector.scanGitCommits()`. Only the `spawnBackground` call gets the `cwd` override.

- [ ] **Step 3: Run existing agent tests to verify no breakage**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/ tests/infrastructure/agent-process-runner.test.ts --config configs/vitest.config.ts`
Expected: PASS — existing callers pass no `opts`, so behavior is unchanged

- [ ] **Step 4: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/worker-types.ts" "01 - Projects/Flowti CLI/src/infrastructure/agent-process-runner.ts"
git commit -m "feat(workspace): add cwd option to IAgentProcessRunner.spawn()"
```

---

### Task 5: Extend CliEventMap with WorkspaceEventMap

**Files:**
- Modify: `src/infrastructure/cli-events.ts`

- [ ] **Step 1: Import and intersect WorkspaceEventMap**

Add import:
```typescript
import type { WorkspaceEventMap } from "../domain/agents/workspace-events.js";
```

Extend the interface:
```typescript
export interface CliEventMap extends ReportEventMap, E2EEventMap, WorkspaceEventMap {
```

- [ ] **Step 2: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/cli-events.ts"
git commit -m "feat(workspace): extend CliEventMap with workspace events"
```

---

## Chunk 3: WorkspaceRegistry

### Task 6: WorkspaceRegistry Implementation

**Files:**
- Create: `src/infrastructure/workspace-registry.ts`
- Test: `tests/infrastructure/workspace-registry.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/infrastructure/workspace-registry.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../src/infrastructure/ui.js", () => ({ RESET: "", DIM: "", GREEN: "", CYAN: "", BOLD: "", RED: "", YELLOW: "" }));

import { createWorkspaceRegistry, type IWorkspaceRegistry } from "../../src/infrastructure/workspace-registry.js";
import type { AgentWorkspace } from "../../src/domain/agents/agent-workspace.js";
import type { IFileSystem } from "../../src/infrastructure/types.js";

function mockDisk(data: Record<string, string> = {}): IFileSystem {
	const files = new Map(Object.entries(data));
	return {
		existsSync: (p: string) => files.has(p),
		readFileSync: (p: string) => { const c = files.get(p); if (!c) throw new Error("ENOENT"); return c; },
		writeFileSync: (p: string, c: string) => { files.set(p, c); },
		mkdirSync: () => {},
	} as unknown as IFileSystem;
}

const ws1: AgentWorkspace = {
	id: "ws-bob-auth-a3f2",
	agentSlug: "bob",
	branch: "agent/bob/auth",
	baseBranch: "master",
	method: "worktree",
	state: "active",
	path: "/tmp/ws-bob-auth-a3f2",
	pid: 1234,
	processName: "claude.exe",
	retain: false,
	createdAt: "2026-03-15T10:00:00Z",
	collectResult: null,
};

describe("WorkspaceRegistry", () => {
	let registry: IWorkspaceRegistry;
	let disk: IFileSystem;

	beforeEach(() => {
		disk = mockDisk();
		registry = createWorkspaceRegistry({ disk } as any, "/vault/.flowti/var/workspace-registry.json");
	});

	it("starts empty when no file exists", () => {
		expect(registry.list()).toEqual([]);
	});

	it("loads existing data from disk", () => {
		const existingDisk = mockDisk({
			"/vault/.flowti/var/workspace-registry.json": JSON.stringify({ workspaces: [ws1] }),
		});
		const reg = createWorkspaceRegistry({ disk: existingDisk } as any, "/vault/.flowti/var/workspace-registry.json");
		expect(reg.list()).toHaveLength(1);
		expect(reg.list()[0].id).toBe("ws-bob-auth-a3f2");
	});

	it("registers and retrieves a workspace", () => {
		registry.register(ws1);
		expect(registry.get("ws-bob-auth-a3f2")).toEqual(ws1);
	});

	it("updates a workspace", () => {
		registry.register(ws1);
		const updated = { ...ws1, state: "collecting" as const };
		registry.update(updated);
		expect(registry.get("ws-bob-auth-a3f2")?.state).toBe("collecting");
	});

	it("removes a workspace", () => {
		registry.register(ws1);
		registry.remove("ws-bob-auth-a3f2");
		expect(registry.get("ws-bob-auth-a3f2")).toBeNull();
	});

	it("lists active workspaces", () => {
		registry.register(ws1);
		const disposed = { ...ws1, id: "ws-alice-test-b7c1", state: "disposed" as const };
		registry.register(disposed);
		const active = registry.listByState("active");
		expect(active).toHaveLength(1);
		expect(active[0].id).toBe("ws-bob-auth-a3f2");
	});

	it("counts active workspaces", () => {
		registry.register(ws1);
		expect(registry.activeCount()).toBe(1);
	});

	it("flushes to disk on register", () => {
		registry.register(ws1);
		const written = (disk as any).readFileSync("/vault/.flowti/var/workspace-registry.json");
		const parsed = JSON.parse(written);
		expect(parsed.workspaces).toHaveLength(1);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/workspace-registry.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement workspace-registry.ts**

```typescript
// src/infrastructure/workspace-registry.ts
import type { AgentWorkspace, WorkspaceState } from "../domain/agents/agent-workspace.js";

export type RegistryDeps = { readonly disk: { existsSync(p: string): boolean; readFileSync(p: string, enc?: string): string; writeFileSync(p: string, data: string, enc?: string): void; mkdirSync(p: string, opts?: { recursive: boolean }): void } };

interface RegistryData {
	readonly workspaces: readonly AgentWorkspace[];
}

export interface IWorkspaceRegistry {
	list(): AgentWorkspace[];
	listByState(state: WorkspaceState): AgentWorkspace[];
	get(id: string): AgentWorkspace | null;
	register(ws: AgentWorkspace): void;
	update(ws: AgentWorkspace): void;
	remove(id: string): void;
	activeCount(): number;
}

export function createWorkspaceRegistry(deps: RegistryDeps, registryPath: string): IWorkspaceRegistry {
	const workspaces = new Map<string, AgentWorkspace>();

	// Load from disk on construction
	if (deps.disk.existsSync(registryPath)) {
		try {
			const raw = deps.disk.readFileSync(registryPath, "utf-8");
			const data: RegistryData = JSON.parse(raw);
			for (const ws of data.workspaces) {
				workspaces.set(ws.id, ws);
			}
		} catch { /* corrupt file — start empty */ }
	}

	function flush(): void {
		const data: RegistryData = { workspaces: [...workspaces.values()] };
		deps.disk.writeFileSync(registryPath, JSON.stringify(data, null, "\t"), "utf-8");
	}

	return {
		list: () => [...workspaces.values()],
		listByState: (state) => [...workspaces.values()].filter((ws) => ws.state === state),
		get: (id) => workspaces.get(id) ?? null,
		register(ws) { workspaces.set(ws.id, ws); flush(); },
		update(ws) { workspaces.set(ws.id, ws); flush(); },
		remove(id) { workspaces.delete(id); flush(); },
		activeCount: () => [...workspaces.values()].filter((ws) => ws.state === "active" || ws.state === "provision" || ws.state === "ready").length,
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/workspace-registry.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/workspace-registry.ts" "01 - Projects/Flowti CLI/tests/infrastructure/workspace-registry.test.ts"
git commit -m "feat(workspace): add WorkspaceRegistry with in-memory cache and flush-on-mutate"
```

---

## Chunk 4: WorkspaceProvisioner

### Task 7: WorkspaceProvisioner Implementation

**Files:**
- Create: `src/infrastructure/workspace-provisioner.ts`
- Test: `tests/infrastructure/workspace-provisioner.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/infrastructure/workspace-provisioner.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../src/infrastructure/ui.js", () => ({ RESET: "", DIM: "", GREEN: "", CYAN: "", BOLD: "", RED: "", YELLOW: "" }));

import { createWorkspaceProvisioner, type IWorkspaceProvisioner } from "../../src/infrastructure/workspace-provisioner.js";
import type { IShell, IFileSystem, IPaths } from "../../src/infrastructure/types.js";

function createMockShell(responses: Record<string, { stdout: string; exitCode: number }> = {}): IShell {
	return {
		runCaptureDetailed: vi.fn((cmd: string) => {
			for (const [pattern, result] of Object.entries(responses)) {
				if (cmd.includes(pattern)) return { stdout: result.stdout, stderr: "", exitCode: result.exitCode };
			}
			return { stdout: "", stderr: "", exitCode: 0 };
		}),
	} as unknown as IShell;
}

function createMockDisk(): IFileSystem {
	return {
		existsSync: vi.fn(() => false),
		mkdirSync: vi.fn(),
		writeFileSync: vi.fn(),
		readFileSync: vi.fn(() => ""),
		copyFileSync: vi.fn(),
	} as unknown as IFileSystem;
}

function createMockPaths(): IPaths {
	return {
		join: (...parts: string[]) => parts.join("/"),
		resolve: (p: string) => p,
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		basename: (p: string) => p.split("/").pop() ?? "",
	} as unknown as IPaths;
}

describe("WorkspaceProvisioner", () => {
	let provisioner: IWorkspaceProvisioner;
	let shell: IShell;
	let disk: IFileSystem;
	let paths: IPaths;

	beforeEach(() => {
		shell = createMockShell({
			"git worktree list": { stdout: "C:/Projects/flowti  abc1234 [master]\n", exitCode: 0 },
			"git worktree add": { stdout: "", exitCode: 0 },
			"git rev-parse": { stdout: "abc1234def5678\n", exitCode: 0 },
		});
		disk = createMockDisk();
		paths = createMockPaths();
		provisioner = createWorkspaceProvisioner({ shell, disk, paths } as any, "/vault");
	});

	it("provisions via worktree when branch is not checked out", () => {
		const result = provisioner.provision("bob", "agent/bob/auth", "master", "/agents/ws-bob");
		expect(result.method).toBe("worktree");
		expect(shell.runCaptureDetailed).toHaveBeenCalledWith(
			expect.stringContaining("git worktree add"),
		);
	});

	it("falls back to clone when worktree add fails", () => {
		shell = createMockShell({
			"git worktree list": { stdout: "C:/Projects/flowti  abc1234 [master]\n", exitCode: 0 },
			"git worktree add": { stdout: "", exitCode: 128 },
			"git clone": { stdout: "", exitCode: 0 },
			"git rev-parse": { stdout: "abc1234\n", exitCode: 0 },
			"git checkout": { stdout: "", exitCode: 0 },
		});
		provisioner = createWorkspaceProvisioner({ shell, disk, paths } as any, "/vault");
		const result = provisioner.provision("bob", "agent/bob/auth", "master", "/agents/ws-bob");
		expect(result.method).toBe("clone");
	});

	it("falls back to clone when branch already checked out", () => {
		shell = createMockShell({
			"git worktree list": {
				stdout: "C:/Projects/flowti  abc1234 [master]\nC:/other  def5678 [agent/bob/auth]\n",
				exitCode: 0,
			},
			"git clone": { stdout: "", exitCode: 0 },
			"git rev-parse": { stdout: "abc1234\n", exitCode: 0 },
			"git checkout": { stdout: "", exitCode: 0 },
		});
		provisioner = createWorkspaceProvisioner({ shell, disk, paths } as any, "/vault");
		const result = provisioner.provision("bob", "agent/bob/auth", "master", "/agents/ws-bob");
		expect(result.method).toBe("clone");
	});

	it("creates baseDir if it does not exist", () => {
		provisioner.provision("bob", "agent/bob/auth", "master", "/agents/ws-bob");
		expect(disk.mkdirSync).toHaveBeenCalled();
	});

	it("quotes paths with spaces", () => {
		provisioner.provision("bob", "agent/bob/auth", "master", "/my agents/ws-bob");
		const call = (shell.runCaptureDetailed as any).mock.calls.find(
			(c: string[]) => c[0].includes("worktree add"),
		);
		if (call) expect(call[0]).toContain('"');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/workspace-provisioner.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement workspace-provisioner.ts**

```typescript
// src/infrastructure/workspace-provisioner.ts
import type { CliDeps } from "./deps.js";

export type ProvisionerDeps = Pick<CliDeps, "shell" | "disk" | "paths">;

export interface ProvisionResult {
	readonly path: string;
	readonly method: "worktree" | "clone";
	readonly branch: string;
}

export interface IWorkspaceProvisioner {
	provision(agentSlug: string, branch: string, baseBranch: string, workspacePath: string): ProvisionResult;
	dispose(workspacePath: string, method: "worktree" | "clone"): void;
}

function quote(p: string): string {
	return `"${p}"`;
}

export function createWorkspaceProvisioner(deps: ProvisionerDeps, vaultRoot: string): IWorkspaceProvisioner {
	function isBranchCheckedOut(branch: string): boolean {
		const { stdout } = deps.shell.runCaptureDetailed("git worktree list", { cwd: vaultRoot });
		return stdout.split("\n").some((line) => line.includes(`[${branch}]`));
	}

	function provisionWorktree(branch: string, baseBranch: string, wsPath: string): boolean {
		deps.disk.mkdirSync(deps.paths.dirname(wsPath), { recursive: true });
		const cmd = `git worktree add ${quote(wsPath)} -b ${branch} ${baseBranch}`;
		const { exitCode } = deps.shell.runCaptureDetailed(cmd, { cwd: vaultRoot });
		return exitCode === 0;
	}

	function provisionClone(branch: string, baseBranch: string, wsPath: string): void {
		deps.disk.mkdirSync(deps.paths.dirname(wsPath), { recursive: true });
		const { stdout: sha } = deps.shell.runCaptureDetailed(`git rev-parse ${baseBranch}`, { cwd: vaultRoot });
		const cloneCmd = `git clone ${quote(vaultRoot)} ${quote(wsPath)}`;
		const cloneResult = deps.shell.runCaptureDetailed(cloneCmd);
		if (cloneResult.exitCode !== 0) {
			throw new Error(`Clone failed: ${cloneResult.stderr}`);
		}
		const checkoutCmd = `git checkout -b ${branch} ${sha.trim()}`;
		deps.shell.runCaptureDetailed(checkoutCmd, { cwd: wsPath });
	}

	return {
		provision(agentSlug, branch, baseBranch, workspacePath) {
			if (!isBranchCheckedOut(branch)) {
				if (provisionWorktree(branch, baseBranch, workspacePath)) {
					return { path: workspacePath, method: "worktree", branch };
				}
			}
			// Fallback to clone
			provisionClone(branch, baseBranch, workspacePath);
			return { path: workspacePath, method: "clone", branch };
		},

		dispose(workspacePath, method) {
			if (method === "worktree") {
				deps.shell.runCaptureDetailed(`git worktree remove ${quote(workspacePath)} --force`, { cwd: vaultRoot });
			} else {
				// For clones, just remove the directory
				deps.shell.runCaptureDetailed(`rm -rf ${quote(workspacePath)}`);
			}
		},
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/workspace-provisioner.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/workspace-provisioner.ts" "01 - Projects/Flowti CLI/tests/infrastructure/workspace-provisioner.test.ts"
git commit -m "feat(workspace): add WorkspaceProvisioner with worktree/clone fallback"
```

---

## Chunk 5: StateSplitter & StateCollector

### Task 8: StateSplitter Implementation

**Files:**
- Create: `src/infrastructure/state-splitter.ts`
- Test: `tests/infrastructure/state-splitter.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/infrastructure/state-splitter.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../src/infrastructure/ui.js", () => ({ RESET: "", DIM: "" }));

import { createStateSplitter, type IStateSplitter } from "../../src/infrastructure/state-splitter.js";

function createMockDeps() {
	const files = new Map<string, string>();
	const dirs = new Set<string>();
	return {
		disk: {
			existsSync: (p: string) => files.has(p) || dirs.has(p),
			readFileSync: (p: string) => files.get(p) ?? "",
			writeFileSync: (p: string, c: string) => files.set(p, c),
			copyFileSync: (from: string, to: string) => files.set(to, files.get(from) ?? ""),
			mkdirSync: (p: string) => dirs.add(p),
			readdirSync: () => [],
		} as any,
		paths: {
			join: (...parts: string[]) => parts.join("/"),
			resolve: (p: string) => p,
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		} as any,
		shell: {
			runCaptureDetailed: vi.fn(() => ({ stdout: "", stderr: "", exitCode: 0 })),
		} as any,
		files,
	};
}

describe("StateSplitter", () => {
	let splitter: IStateSplitter;
	let files: Map<string, string>;

	beforeEach(() => {
		const deps = createMockDeps();
		files = deps.files;

		// Set up vault files
		files.set("/vault/CLAUDE.md", "# Claude instructions");
		files.set("/vault/.flowti/config.json", '{"version":"1","agents":{"dir":"03 - Resources/Agents"}}');
		files.set("/vault/.flowti/var/data-bob.json", '{"name":"bob","status":"idle","tasks":[]}');
		files.set("/vault/.flowti/var/world-state.json", '{"version":1,"entities":{}}');

		splitter = createStateSplitter(deps, "/vault");
	});

	it("copies CLAUDE.md to workspace root", () => {
		splitter.inject("bob", "/workspace");
		expect(files.get("/workspace/CLAUDE.md")).toBe("# Claude instructions");
	});

	it("snapshots agent runtime state", () => {
		splitter.inject("bob", "/workspace");
		expect(files.has("/workspace/.flowti/var/data-bob.json")).toBe(true);
	});

	it("snapshots world state", () => {
		splitter.inject("bob", "/workspace");
		expect(files.has("/workspace/.flowti/var/world-state.json")).toBe(true);
	});

	it("creates empty conversation stub", () => {
		splitter.inject("bob", "/workspace");
		const conv = files.get("/workspace/.flowti/var/conversations/bob.json");
		expect(conv).toBeDefined();
		expect(JSON.parse(conv!)).toEqual({ threads: [] });
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/state-splitter.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement state-splitter.ts**

```typescript
// src/infrastructure/state-splitter.ts
import type { CliDeps } from "./deps.js";

export type SplitterDeps = Pick<CliDeps, "disk" | "paths" | "shell">;

export interface IStateSplitter {
	inject(agentSlug: string, workspacePath: string): void;
}

export function createStateSplitter(deps: SplitterDeps, vaultRoot: string): IStateSplitter {
	function copyIfExists(src: string, dest: string): void {
		if (deps.disk.existsSync(src)) {
			deps.disk.mkdirSync(deps.paths.dirname(dest), { recursive: true });
			deps.disk.copyFileSync(src, dest);
		}
	}

	function copyDirRecursive(src: string, dest: string): void {
		if (!deps.disk.existsSync(src)) return;
		// Use shell cp for recursive copy (works cross-platform via git bash on Windows)
		deps.shell.runCaptureDetailed(`cp -r "${src}" "${dest}"`);
	}

	return {
		inject(agentSlug, workspacePath) {
			// 1. CLAUDE.md
			copyIfExists(
				deps.paths.join(vaultRoot, "CLAUDE.md"),
				deps.paths.join(workspacePath, "CLAUDE.md"),
			);

			// 2. .claude/ directory (rules, skills)
			copyDirRecursive(
				deps.paths.join(vaultRoot, ".claude"),
				deps.paths.join(workspacePath, ".claude"),
			);

			// 3. .flowti/config.json (copy, not symlink)
			copyIfExists(
				deps.paths.join(vaultRoot, ".flowti", "config.json"),
				deps.paths.join(workspacePath, ".flowti", "config.json"),
			);

			// 4. Agent runtime state snapshot
			const varDir = deps.paths.join(workspacePath, ".flowti", "var");
			deps.disk.mkdirSync(varDir, { recursive: true });

			copyIfExists(
				deps.paths.join(vaultRoot, ".flowti", "var", `data-${agentSlug}.json`),
				deps.paths.join(varDir, `data-${agentSlug}.json`),
			);

			// 5. World state snapshot
			copyIfExists(
				deps.paths.join(vaultRoot, ".flowti", "var", "world-state.json"),
				deps.paths.join(varDir, "world-state.json"),
			);

			// 6. Empty conversation stub
			const convDir = deps.paths.join(varDir, "conversations");
			deps.disk.mkdirSync(convDir, { recursive: true });
			deps.disk.writeFileSync(
				deps.paths.join(convDir, `${agentSlug}.json`),
				JSON.stringify({ threads: [] }, null, "\t"),
				"utf-8",
			);
		},
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/state-splitter.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/state-splitter.ts" "01 - Projects/Flowti CLI/tests/infrastructure/state-splitter.test.ts"
git commit -m "feat(workspace): add StateSplitter for identity injection and state snapshots"
```

---

### Task 9: StateCollector Implementation

**Files:**
- Create: `src/infrastructure/state-collector.ts`
- Test: `tests/infrastructure/state-collector.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/infrastructure/state-collector.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../src/infrastructure/ui.js", () => ({ RESET: "", DIM: "" }));

import { createStateCollector, type IStateCollector } from "../../src/infrastructure/state-collector.js";
import type { AgentWorkspace } from "../../src/domain/agents/agent-workspace.js";

function createMockDeps(filesData: Record<string, string> = {}) {
	const files = new Map(Object.entries(filesData));
	return {
		disk: {
			existsSync: (p: string) => files.has(p),
			readFileSync: (p: string) => files.get(p) ?? "",
			writeFileSync: (p: string, c: string) => files.set(p, c),
			mkdirSync: () => {},
		} as any,
		paths: {
			join: (...parts: string[]) => parts.join("/"),
		} as any,
		shell: {
			runCaptureDetailed: vi.fn(() => ({ stdout: "", stderr: "", exitCode: 0 })),
		} as any,
		files,
	};
}

const baseWs: AgentWorkspace = {
	id: "ws-bob-auth-a3f2",
	agentSlug: "bob",
	branch: "agent/bob/auth",
	baseBranch: "master",
	method: "worktree",
	state: "collecting",
	path: "/workspace",
	retain: false,
	createdAt: "2026-03-15T10:00:00Z",
	collectResult: null,
};

describe("StateCollector", () => {
	it("merges workspace runtime state into central state", async () => {
		const deps = createMockDeps({
			"/workspace/.flowti/var/data-bob.json": '{"name":"bob","status":"active","tasks":[{"name":"auth"}]}',
			"/vault/.flowti/var/data-bob.json": '{"name":"bob","status":"idle","tasks":[]}',
		});
		const collector = createStateCollector(deps, "/vault");
		const result = await collector.collect(baseWs);
		const central = JSON.parse(deps.files.get("/vault/.flowti/var/data-bob.json")!);
		expect(central.status).toBe("active"); // workspace version wins
	});

	it("scans git log for new commits", async () => {
		const deps = createMockDeps({
			"/workspace/.flowti/var/data-bob.json": '{"name":"bob","status":"idle"}',
			"/vault/.flowti/var/data-bob.json": '{"name":"bob","status":"idle"}',
		});
		(deps.shell.runCaptureDetailed as any).mockImplementation((cmd: string) => {
			if (cmd.includes("git log")) {
				return { stdout: "abc1234\ndef5678\n", stderr: "", exitCode: 0 };
			}
			if (cmd.includes("git diff --stat")) {
				return { stdout: " 3 files changed\n", stderr: "", exitCode: 0 };
			}
			return { stdout: "", stderr: "", exitCode: 0 };
		});
		const collector = createStateCollector(deps, "/vault");
		const result = await collector.collect(baseWs);
		expect(result.commits).toEqual(["abc1234", "def5678"]);
	});

	it("returns zero commits when git scan fails", async () => {
		const deps = createMockDeps({
			"/workspace/.flowti/var/data-bob.json": '{"name":"bob","status":"idle"}',
			"/vault/.flowti/var/data-bob.json": '{"name":"bob","status":"idle"}',
		});
		(deps.shell.runCaptureDetailed as any).mockReturnValue({ stdout: "", stderr: "error", exitCode: 1 });
		const collector = createStateCollector(deps, "/vault");
		const result = await collector.collect(baseWs);
		expect(result.commits).toEqual([]);
		expect(result.errors).toContain("git scan failed");
	});

	it("appends conversation threads", async () => {
		const deps = createMockDeps({
			"/workspace/.flowti/var/data-bob.json": '{"name":"bob","status":"idle"}',
			"/vault/.flowti/var/data-bob.json": '{"name":"bob","status":"idle"}',
			"/workspace/.flowti/var/conversations/bob.json": '{"threads":[{"role":"user","content":"hello"}]}',
			"/vault/.flowti/var/conversations/bob.json": '{"threads":[]}',
		});
		const collector = createStateCollector(deps, "/vault");
		const result = await collector.collect(baseWs);
		const central = JSON.parse(deps.files.get("/vault/.flowti/var/conversations/bob.json")!);
		expect(central.threads).toHaveLength(1);
		expect(result.conversationTurns).toBe(1);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/state-collector.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement state-collector.ts**

```typescript
// src/infrastructure/state-collector.ts
import type { CliDeps } from "./deps.js";
import type { AgentWorkspace } from "../domain/agents/agent-workspace.js";
import type { CollectResult } from "../domain/agents/agent-shell.js";

export type CollectorDeps = Pick<CliDeps, "disk" | "paths" | "shell">;

export interface IStateCollector {
	collect(workspace: AgentWorkspace): Promise<CollectResult>;
}

export function createStateCollector(deps: CollectorDeps, vaultRoot: string): IStateCollector {
	function mergeRuntimeState(agentSlug: string, workspacePath: string): Record<string, unknown> {
		const wsPath = deps.paths.join(workspacePath, ".flowti", "var", `data-${agentSlug}.json`);
		const centralPath = deps.paths.join(vaultRoot, ".flowti", "var", `data-${agentSlug}.json`);

		if (!deps.disk.existsSync(wsPath)) return {};

		const wsState = JSON.parse(deps.disk.readFileSync(wsPath, "utf-8"));
		const centralState = deps.disk.existsSync(centralPath)
			? JSON.parse(deps.disk.readFileSync(centralPath, "utf-8"))
			: {};

		// Field-level last-writer-wins: workspace overrides central
		const merged = { ...centralState, ...wsState };
		deps.disk.writeFileSync(centralPath, JSON.stringify(merged, null, "\t"), "utf-8");
		return wsState;
	}

	function appendConversations(agentSlug: string, workspacePath: string): number {
		const wsConvPath = deps.paths.join(workspacePath, ".flowti", "var", "conversations", `${agentSlug}.json`);
		const centralConvPath = deps.paths.join(vaultRoot, ".flowti", "var", "conversations", `${agentSlug}.json`);

		if (!deps.disk.existsSync(wsConvPath)) return 0;

		const wsConv = JSON.parse(deps.disk.readFileSync(wsConvPath, "utf-8"));
		const centralConv = deps.disk.existsSync(centralConvPath)
			? JSON.parse(deps.disk.readFileSync(centralConvPath, "utf-8"))
			: { threads: [] };

		const newThreads = wsConv.threads ?? [];
		centralConv.threads = [...(centralConv.threads ?? []), ...newThreads];
		deps.disk.writeFileSync(centralConvPath, JSON.stringify(centralConv, null, "\t"), "utf-8");
		return newThreads.length;
	}

	function scanGitCommits(workspace: AgentWorkspace): { commits: string[]; filesChanged: number; error?: string } {
		const cwd = workspace.method === "worktree" ? workspace.path : workspace.path;
		const logCmd = `git log ${workspace.baseBranch}..${workspace.branch} --format=%H`;
		const logResult = deps.shell.runCaptureDetailed(logCmd, { cwd });

		if (logResult.exitCode !== 0) {
			return { commits: [], filesChanged: 0, error: "git scan failed" };
		}

		const commits = logResult.stdout.trim().split("\n").filter(Boolean);

		const diffCmd = `git diff --stat ${workspace.baseBranch}..${workspace.branch}`;
		const diffResult = deps.shell.runCaptureDetailed(diffCmd, { cwd });
		const filesChanged = (diffResult.stdout.match(/\d+ files? changed/) ?? ["0"])[0]
			.replace(/\D+/g, "") || "0";

		return { commits, filesChanged: parseInt(filesChanged, 10) };
	}

	return {
		async collect(workspace) {
			const runtimeState = mergeRuntimeState(workspace.agentSlug, workspace.path);
			const conversationTurns = appendConversations(workspace.agentSlug, workspace.path);
			const gitResult = scanGitCommits(workspace);

			const errors: string[] = [];
			if (gitResult.error) errors.push(gitResult.error);

			return {
				commits: gitResult.commits,
				filesChanged: gitResult.filesChanged,
				conversationTurns,
				runtimeState,
				errors,
			};
		},
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/state-collector.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/state-collector.ts" "01 - Projects/Flowti CLI/tests/infrastructure/state-collector.test.ts"
git commit -m "feat(workspace): add StateCollector with merge, conversation append, and git scan"
```

---

## Chunk 6: AgentShell

### Task 10: AgentShell Implementation

**Files:**
- Create: `src/infrastructure/agent-shell.ts`
- Test: `tests/infrastructure/agent-shell.test.ts`
- Modify: `src/infrastructure/deps.ts` (add `WorkspaceDeps`)

- [ ] **Step 1: Add WorkspaceDeps and agentShell to deps.ts**

Add `IAgentShell` to `CliDeps`:

```typescript
import type { IAgentShell } from "../domain/agents/agent-shell.js";

// Add to CliDeps interface:
readonly agentShell?: IAgentShell;
```

Add ISP subset after existing dep subsets:

```typescript
export type WorkspaceDeps = Pick<CliDeps, "disk" | "paths" | "shell" | "clock" | "bus" | "log">;
```

In `createDefaultDeps()`, conditionally construct `AgentShell` when workspace config is present:

```typescript
import { createAgentShell } from "./agent-shell.js";
import { createWorkspaceRegistry } from "./workspace-registry.js";
import { createWorkspaceProvisioner } from "./workspace-provisioner.js";
import { createStateSplitter } from "./state-splitter.js";
import { createStateCollector } from "./state-collector.js";

// Inside createDefaultDeps(), after processRunner and workerManager are created:
const workspacesConfig = vaultConfig?.workspaces;
const agentShell = workspacesConfig ? createAgentShell({
	registry: createWorkspaceRegistry({ disk }, paths.join(resolvedRoot, ".flowti", "var", "workspace-registry.json")),
	provisioner: createWorkspaceProvisioner(baseDeps, resolvedRoot),
	splitter: createStateSplitter(baseDeps, resolvedRoot),
	collector: createStateCollector(baseDeps, resolvedRoot),
	processRunner,
	agentFinder: (slug) => findAgent({ disk, paths }, resolvedRoot, slug, agentsConfig),
	config: workspacesConfig,
	clock,
	bus,
}) : undefined;
// Add agentShell to the returned CliDeps object
```

- [ ] **Step 2: Write failing tests for AgentShell**

```typescript
// tests/infrastructure/agent-shell.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../src/infrastructure/ui.js", () => ({ RESET: "", DIM: "", GREEN: "", CYAN: "", BOLD: "", RED: "", YELLOW: "" }));

import { createAgentShell } from "../../src/infrastructure/agent-shell.js";
import type { IWorkspaceRegistry } from "../../src/infrastructure/workspace-registry.js";
import type { IWorkspaceProvisioner } from "../../src/infrastructure/workspace-provisioner.js";
import type { IStateSplitter } from "../../src/infrastructure/state-splitter.js";
import type { IStateCollector } from "../../src/infrastructure/state-collector.js";
import type { IAgentProcessRunner, AgentProcess } from "../../src/domain/agents/worker-types.js";
import type { AgentSummary } from "../../src/domain/agents/agent-types.js";
import type { WorkspacesConfig } from "../../src/infrastructure/types-config.js";

function createMockRegistry(): IWorkspaceRegistry {
	const store = new Map();
	return {
		list: () => [...store.values()],
		listByState: (s: string) => [...store.values()].filter((ws: any) => ws.state === s),
		get: (id: string) => store.get(id) ?? null,
		register: (ws: any) => store.set(ws.id, ws),
		update: (ws: any) => store.set(ws.id, ws),
		remove: (id: string) => store.delete(id),
		activeCount: () => [...store.values()].filter((ws: any) => ["active", "provision", "ready"].includes(ws.state)).length,
	};
}

function createMockProvisioner(): IWorkspaceProvisioner {
	return {
		provision: vi.fn(() => ({ path: "/agents/ws-bob-auth-a3f2", method: "worktree" as const, branch: "agent/bob/auth" })),
		dispose: vi.fn(),
	};
}

function createMockSplitter(): IStateSplitter {
	return { inject: vi.fn() };
}

function createMockCollector(): IStateCollector {
	return {
		collect: vi.fn(async () => ({
			commits: ["abc1234"],
			filesChanged: 3,
			conversationTurns: 2,
			runtimeState: { status: "idle" },
			errors: [],
		})),
	};
}

function createMockProcessRunner(): IAgentProcessRunner {
	return {
		spawn: vi.fn((): AgentProcess => ({
			onEvent: () => () => {},
			result: Promise.resolve({ text: "done", thinking: "", exitCode: 0 }),
			kill: () => {},
		})),
	};
}

function createMockAgentFinder(): (slug: string) => AgentSummary | null {
	return (slug: string) => ({
		name: slug,
		agentType: "ai" as const,
		description: "test agent",
		skills: [],
		tools: [],
		roles: [],
		file: `${slug}.md`,
	});
}

const config: WorkspacesConfig = {
	baseDir: "/agents",
	defaultRetain: false,
	retentionMaxAge: 604800000,
	maxConcurrent: 5,
	branchPrefix: "agent/",
};

describe("AgentShell", () => {
	it("dispatches an agent to an isolated workspace", async () => {
		const registry = createMockRegistry();
		const provisioner = createMockProvisioner();
		const splitter = createMockSplitter();
		const collector = createMockCollector();
		const processRunner = createMockProcessRunner();
		const agentFinder = createMockAgentFinder();

		const shell = createAgentShell({
			registry, provisioner, splitter, collector, processRunner,
			agentFinder, config,
			clock: { iso: () => "2026-03-15T10:00:00Z", ms: () => 1, now: () => new Date(), safeIso: () => "2026-03-15" },
			bus: { emit: vi.fn(), on: () => () => {}, once: () => () => {}, clear: () => {} } as any,
		});

		const result = await shell.dispatch({ agent: "bob", task: "Add auth" });
		expect(result.workspace.agentSlug).toBe("bob");
		expect(result.workspace.state).toBe("active");
		expect(result.branch).toBe("agent/bob/auth");
		expect(provisioner.provision).toHaveBeenCalled();
		expect(splitter.inject).toHaveBeenCalledWith("bob", "/agents/ws-bob-auth-a3f2");
	});

	it("rejects when maxConcurrent reached", async () => {
		const registry = createMockRegistry();
		// Fill up the registry
		for (let i = 0; i < 5; i++) {
			registry.register({ id: `ws-${i}`, state: "active", agentSlug: "x" } as any);
		}

		const shell = createAgentShell({
			registry,
			provisioner: createMockProvisioner(),
			splitter: createMockSplitter(),
			collector: createMockCollector(),
			processRunner: createMockProcessRunner(),
			agentFinder: createMockAgentFinder(),
			config,
			clock: { iso: () => "2026-03-15T10:00:00Z", ms: () => 1, now: () => new Date(), safeIso: () => "2026-03-15" },
			bus: { emit: vi.fn(), on: () => () => {}, once: () => () => {}, clear: () => {} } as any,
		});

		await expect(shell.dispatch({ agent: "bob", task: "test" })).rejects.toThrow("5/5 workspaces active");
	});

	it("lists workspaces", () => {
		const registry = createMockRegistry();
		registry.register({ id: "ws-1", state: "active", agentSlug: "bob" } as any);
		const shell = createAgentShell({
			registry,
			provisioner: createMockProvisioner(),
			splitter: createMockSplitter(),
			collector: createMockCollector(),
			processRunner: createMockProcessRunner(),
			agentFinder: createMockAgentFinder(),
			config,
			clock: { iso: () => "", ms: () => 0, now: () => new Date(), safeIso: () => "" },
			bus: { emit: vi.fn(), on: () => () => {}, once: () => () => {}, clear: () => {} } as any,
		});

		expect(shell.list()).toHaveLength(1);
	});
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/agent-shell.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement agent-shell.ts**

```typescript
// src/infrastructure/agent-shell.ts
import type { IAgentShell, DispatchRequest, DispatchResult, CollectResult, PruneOptions, PruneSummary } from "../domain/agents/agent-shell.js";
import type { AgentProcess, IAgentProcessRunner } from "../domain/agents/worker-types.js";
import type { AgentSummary } from "../domain/agents/agent-types.js";
import type { IWorkspaceRegistry } from "./workspace-registry.js";
import type { IWorkspaceProvisioner } from "./workspace-provisioner.js";
import type { IStateSplitter } from "./state-splitter.js";
import type { IStateCollector } from "./state-collector.js";
import type { ICliBus } from "./event-bus.js";
import type { IClock } from "./types.js";
import type { WorkspacesConfig } from "./types-config.js";
import { createWorkspace, generateBranchName, transitionState, COLLECT_SKIPPED_SENTINEL } from "../domain/agents/agent-workspace.js";

interface AgentShellDeps {
	readonly registry: IWorkspaceRegistry;
	readonly provisioner: IWorkspaceProvisioner;
	readonly splitter: IStateSplitter;
	readonly collector: IStateCollector;
	readonly processRunner: IAgentProcessRunner;
	readonly agentFinder: (slug: string) => AgentSummary | null;
	readonly config: WorkspacesConfig;
	readonly clock: IClock;
	readonly bus: ICliBus;
}

const DEFAULT_CONFIG: WorkspacesConfig = {
	baseDir: "../flowti-agents",
	defaultRetain: false,
	retentionMaxAge: 604_800_000,
	maxConcurrent: 5,
	branchPrefix: "agent/",
};

export function createAgentShell(deps: AgentShellDeps): IAgentShell {
	const config = { ...DEFAULT_CONFIG, ...deps.config };

	return {
		async dispatch(request: DispatchRequest): Promise<DispatchResult> {
			// 1. Check concurrency limit
			const active = deps.registry.activeCount();
			if (active >= config.maxConcurrent) {
				throw new Error(`${active}/${config.maxConcurrent} workspaces active — dispose or increase limit`);
			}

			// 2. Resolve agent
			const agent = deps.agentFinder(request.agent);
			if (!agent && request.agent !== "adhoc") {
				throw new Error(`Agent "${request.agent}" not found`);
			}

			// 3. Generate branch
			const branch = request.branch ?? generateBranchName(
				request.agent,
				request.task,
				config.branchPrefix,
			);
			const baseBranch = request.baseBranch ?? "master";

			// 4. Provision workspace
			const provisionResult = deps.provisioner.provision(
				request.agent,
				branch,
				baseBranch,
				`${config.baseDir}/ws-${request.agent}-${deps.clock.ms()}`,
			);

			// 5. Create workspace entity
			let workspace = createWorkspace({
				agentSlug: request.agent,
				branch,
				baseBranch,
				method: provisionResult.method,
				path: provisionResult.path,
				retain: request.retain ?? config.defaultRetain,
				createdAt: deps.clock.iso(),
			});

			deps.registry.register(workspace);
			deps.bus.emit("workspace:provisioned", { workspace, method: provisionResult.method });

			// 6. Inject state
			deps.splitter.inject(request.agent, workspace.path);
			workspace = transitionState(workspace, "ready");
			deps.registry.update(workspace);
			deps.bus.emit("workspace:ready", { workspace });

			// 7. Spawn process
			const agentForSpawn = agent ?? {
				name: "adhoc", agentType: "ai" as const, description: "Ad-hoc session",
				skills: [], tools: [], roles: [], file: "",
			};

			const tools = request.allowedTools ? [...request.allowedTools] : undefined;
			const process: AgentProcess = deps.processRunner.spawn(
				agentForSpawn,
				request.task,
				tools,
				{ cwd: workspace.path },
			);

			workspace = transitionState(workspace, "active", { pid: 0, processName: "claude" });
			deps.registry.update(workspace);
			deps.bus.emit("workspace:active", { workspace, pid: 0 });

			// 8. Wire up completion handler
			const output = process.result.then(async (result) => {
				workspace = transitionState(workspace, "collecting");
				deps.registry.update(workspace);

				const collectResult = await deps.collector.collect(workspace);
				deps.bus.emit("workspace:collecting", { workspace, collectResult });

				const finalState = workspace.retain ? "retained" : "disposed";
				workspace = transitionState(workspace, finalState, {
					completedAt: deps.clock.iso(),
					collectResult,
				});
				deps.registry.update(workspace);

				if (finalState === "disposed") {
					deps.provisioner.dispose(workspace.path, workspace.method);
					deps.bus.emit("workspace:disposed", { workspace });
				} else {
					deps.bus.emit("workspace:retained", { workspace });
				}

				return result;
			});

			return { workspace, process, branch, output };
		},

		list() {
			return deps.registry.list();
		},

		async collect(workspaceId: string): Promise<CollectResult> {
			const ws = deps.registry.get(workspaceId);
			if (!ws) throw new Error(`Workspace "${workspaceId}" not found`);

			if (ws.state === "disposed" || ws.state === "retained") {
				return ws.collectResult ?? COLLECT_SKIPPED_SENTINEL;
			}

			if (ws.state !== "collecting") {
				throw new Error(`Cannot collect workspace in "${ws.state}" state`);
			}

			return deps.collector.collect(ws);
		},

		async dispose(workspaceId: string): Promise<void> {
			const ws = deps.registry.get(workspaceId);
			if (!ws) throw new Error(`Workspace "${workspaceId}" not found`);

			// Transition to disposed if not already terminal
			if (ws.state !== "disposed") {
				const disposed = { ...ws, state: "disposed" as const, completedAt: deps.clock.iso() };
				deps.registry.update(disposed);
				deps.bus.emit("workspace:disposed", { workspace: disposed });
			}

			deps.provisioner.dispose(ws.path, ws.method);
			deps.registry.remove(workspaceId);
		},

		async prune(options?: PruneOptions): Promise<PruneSummary> {
			const now = deps.clock.ms();
			const threshold = options?.olderThan ?? config.retentionMaxAge;
			// Prune both terminal states by default; filter to one if explicitly specified
			const candidates = options?.state
				? deps.registry.listByState(options.state)
				: [...deps.registry.listByState("retained"), ...deps.registry.listByState("disposed")];
			const errors: string[] = [];
			let removed = 0;
			let skipped = 0;

			for (const ws of candidates) {
				const age = now - new Date(ws.createdAt).getTime();
				if (age < threshold) { skipped++; continue; }

				if (options?.dryRun) { removed++; continue; }

				try {
					deps.provisioner.dispose(ws.path, ws.method);
					deps.registry.remove(ws.id);
					removed++;
				} catch (e) {
					errors.push(`${ws.id}: ${e instanceof Error ? e.message : String(e)}`);
					skipped++;
				}
			}

			return { removed, freed: "0B", skipped, errors };
		},
	};
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/agent-shell.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 6: Run full type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/agent-shell.ts" "01 - Projects/Flowti CLI/tests/infrastructure/agent-shell.test.ts" "01 - Projects/Flowti CLI/src/infrastructure/deps.ts"
git commit -m "feat(workspace): add AgentShell composing provisioner, splitter, collector, registry"
```

---

## Chunk 7: Controller & Renderers

### Task 11: Workspace Renderers

**Files:**
- Create: `src/ui/renderers/workspace-renderers.ts`

- [ ] **Step 1: Implement workspace renderers**

```typescript
// src/ui/renderers/workspace-renderers.ts
import type { AgentWorkspace } from "../../domain/agents/agent-workspace.js";
import type { CollectResult, PruneSummary } from "../../domain/agents/agent-shell.js";
import { BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW } from "../../infrastructure/ui.js";

const STATE_COLORS: Record<string, string> = {
	provision: YELLOW,
	ready: CYAN,
	active: GREEN,
	collecting: YELLOW,
	disposed: DIM,
	retained: CYAN,
};

export interface WorkspaceListModel {
	readonly workspaces: readonly AgentWorkspace[];
}

export function renderWorkspaceList(model: WorkspaceListModel, log: (msg?: string) => void): void {
	if (model.workspaces.length === 0) {
		log(`\n  ${DIM}No workspaces found.${RESET}\n`);
		return;
	}
	log(`\n  ${BOLD}Workspaces${RESET} (${model.workspaces.length})\n`);
	for (const ws of model.workspaces) {
		const color = STATE_COLORS[ws.state] ?? DIM;
		const age = timeSince(ws.createdAt);
		log(`  ${color}${ws.state.padEnd(11)}${RESET} ${ws.id}  ${DIM}${ws.agentSlug}${RESET}  ${ws.branch}  ${DIM}${ws.method} ${age}${RESET}`);
	}
	log("");
}

export interface WorkspaceInspectModel {
	readonly workspace: AgentWorkspace;
	readonly collectResult: CollectResult | null;
}

export function renderWorkspaceInspect(model: WorkspaceInspectModel, log: (msg?: string) => void): void {
	const ws = model.workspace;
	log(`\n  ${BOLD}${ws.id}${RESET}\n`);
	log(`  Agent:    ${ws.agentSlug}`);
	log(`  Branch:   ${ws.branch} (from ${ws.baseBranch})`);
	log(`  Method:   ${ws.method}`);
	log(`  State:    ${STATE_COLORS[ws.state] ?? ""}${ws.state}${RESET}`);
	log(`  Path:     ${DIM}${ws.path}${RESET}`);
	log(`  Created:  ${ws.createdAt}`);
	if (ws.completedAt) log(`  Completed: ${ws.completedAt}`);
	if (model.collectResult) {
		log(`  Commits:  ${model.collectResult.commits.length}`);
		log(`  Files:    ${model.collectResult.filesChanged} changed`);
		log(`  Turns:    ${model.collectResult.conversationTurns}`);
		if (model.collectResult.errors.length > 0) {
			log(`  ${RED}Errors:  ${model.collectResult.errors.join(", ")}${RESET}`);
		}
	}
	log("");
}

export function renderPruneSummary(model: PruneSummary, log: (msg?: string) => void): void {
	log(`\n  ${GREEN}Pruned:${RESET} ${model.removed} workspaces removed`);
	if (model.skipped > 0) log(`  ${DIM}Skipped: ${model.skipped}${RESET}`);
	if (model.errors.length > 0) {
		for (const err of model.errors) log(`  ${RED}Error: ${err}${RESET}`);
	}
	log("");
}

function timeSince(iso: string): string {
	const ms = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(ms / 60000);
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	return `${Math.floor(hrs / 24)}d ago`;
}
```

- [ ] **Step 2: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/ui/renderers/workspace-renderers.ts"
git commit -m "feat(workspace): add workspace renderers for list, inspect, prune"
```

---

### Task 12: Workspace Controller

**Files:**
- Create: `src/controller/workspace.controller.ts`
- Test: `tests/controller/workspace.controller.test.ts`
- Modify: `src/main.ts` (register commands)

- [ ] **Step 1: Write failing tests**

```typescript
// tests/controller/workspace.controller.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../src/infrastructure/ui.js", () => ({ RESET: "", DIM: "", GREEN: "", CYAN: "", BOLD: "", RED: "", YELLOW: "" }));

import { commands } from "../../src/controller/workspace.controller.js";

describe("workspace controller", () => {
	it("exports workspace:list command", () => {
		expect(commands["workspace:list"]).toBeDefined();
	});

	it("exports workspace:provision command", () => {
		expect(commands["workspace:provision"]).toBeDefined();
	});

	it("exports workspace:collect command", () => {
		expect(commands["workspace:collect"]).toBeDefined();
	});

	it("exports workspace:dispose command", () => {
		expect(commands["workspace:dispose"]).toBeDefined();
	});

	it("exports workspace:prune command", () => {
		expect(commands["workspace:prune"]).toBeDefined();
	});

	it("exports workspace:inspect command", () => {
		expect(commands["workspace:inspect"]).toBeDefined();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/controller/workspace.controller.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement workspace.controller.ts**

```typescript
// src/controller/workspace.controller.ts
import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import { renderWorkspaceList, renderWorkspaceInspect, renderPruneSummary } from "../ui/renderers/workspace-renderers.js";
import type { IAgentShell } from "../domain/agents/agent-shell.js";

function getShell(req: { deps: { agentShell?: IAgentShell } }): IAgentShell {
	const shell = (req.deps as any).agentShell;
	if (!shell) throw new Error("AgentShell not available — workspace commands require agents config");
	return shell;
}

const actions: Record<string, ControllerAction> = {
	"workspace:list": (req) => {
		const shell = getShell(req);
		const workspaces = shell.list();
		return dataResponse({ workspaces }, (d) => renderWorkspaceList(d, req.deps.log));
	},

	"workspace:inspect": async (req) => {
		const shell = getShell(req);
		const id = req.rawArgs[0] ?? (typeof req.flags.id === "string" ? req.flags.id : "");
		if (!id) return dataResponse({ error: "Usage: flowti workspace:inspect <id>" }, (d) => req.deps.log(`  ${d.error}`));

		const workspaces = shell.list();
		const ws = workspaces.find((w) => w.id === id);
		if (!ws) return dataResponse({ error: `Workspace "${id}" not found` }, (d) => req.deps.log(`  ${d.error}`));

		return dataResponse(
			{ workspace: ws, collectResult: ws.collectResult },
			(d) => renderWorkspaceInspect(d, req.deps.log),
		);
	},

	"workspace:provision": async (req) => {
		const shell = getShell(req);
		const agent = typeof req.flags.agent === "string" ? req.flags.agent : "adhoc";
		const branch = typeof req.flags.branch === "string" ? req.flags.branch : undefined;
		const base = typeof req.flags.base === "string" ? req.flags.base : undefined;

		const result = await shell.dispatch({
			agent,
			task: "Manual provision",
			branch,
			baseBranch: base,
		});

		return dataResponse(
			{ workspace: result.workspace },
			(d) => req.deps.log(`  Provisioned: ${d.workspace.id} at ${d.workspace.path}`),
		);
	},

	"workspace:collect": async (req) => {
		const shell = getShell(req);
		const id = req.rawArgs[0] ?? "";
		const result = await shell.collect(id);
		return dataResponse(result, (d) => req.deps.log(`  Collected: ${d.commits.length} commits, ${d.filesChanged} files changed`));
	},

	"workspace:dispose": async (req) => {
		const shell = getShell(req);
		const id = req.rawArgs[0] ?? "";
		await shell.dispose(id);
		return dataResponse({ id }, (d) => req.deps.log(`  Disposed: ${d.id}`));
	},

	"workspace:prune": async (req) => {
		const shell = getShell(req);
		const olderThan = typeof req.flags["older-than"] === "string"
			? parseDuration(req.flags["older-than"])
			: undefined;
		const dryRun = req.flags["dry-run"] === true;

		const result = await shell.prune({ olderThan, dryRun });
		return dataResponse(result, (d) => renderPruneSummary(d, req.deps.log));
	},
};

function parseDuration(s: string): number {
	const match = s.match(/^(\d+)(ms|s|m|h|d)$/);
	if (!match) return 604_800_000; // default 7d
	const [, num, unit] = match;
	const multipliers: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
	return parseInt(num, 10) * (multipliers[unit] ?? 1);
}

export const commands: Record<string, ReturnType<typeof adapt>> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
```

- [ ] **Step 4: Register commands in main.ts**

Find where other controllers are imported/registered in `src/main.ts` and add:

```typescript
import { commands as workspaceCommands } from "./controller/workspace.controller.js";
```

And merge `workspaceCommands` into the command registry alongside the existing controllers.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/controller/workspace.controller.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 6: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: PASS — no regressions

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/controller/workspace.controller.ts" "01 - Projects/Flowti CLI/tests/controller/workspace.controller.test.ts" "01 - Projects/Flowti CLI/src/main.ts"
git commit -m "feat(workspace): add workspace controller with 6 CLI commands"
```

---

## Chunk 8: Sitemap & Handler Registration

### Task 13: Sitemap Page & Workspace Handlers

**Files:**
- Modify: `configs/sitemap.json` (add workspaces page)
- Create: `src/ui/handlers/workspace-handlers.ts`
- Modify: `src/ui/handlers/register-handlers.ts`

- [ ] **Step 1: Add workspaces page to sitemap.json**

Add a new page entry `"workspaces"` to the `pages` object in `configs/sitemap.json`:

```json
"workspaces": {
  "kind": "page",
  "label": "Workspaces",
  "icon": "git-branch",
  "domain": "agents",
  "status": "active",
  "description": "Manage isolated agent workspaces — provision, inspect, collect, prune.",
  "parent": "ai-tools",
  "dataSources": [
    { "id": "workspace:active-list" }
  ],
  "actions": [
    {
      "name": "onListWorkspaces",
      "label": "List All Workspaces",
      "type": "handler",
      "target": "workspace:list",
      "key": "1",
      "group": "view"
    },
    {
      "name": "onInspectWorkspace",
      "label": "Inspect Workspace",
      "type": "handler",
      "target": "workspace:inspect",
      "key": "2",
      "group": "view"
    },
    {
      "name": "onCollectWorkspace",
      "label": "Collect Workspace State",
      "type": "handler",
      "target": "workspace:collect",
      "key": "3",
      "group": "manage"
    },
    {
      "name": "onDisposeWorkspace",
      "label": "Dispose Workspace",
      "type": "handler",
      "target": "workspace:dispose",
      "key": "4",
      "group": "manage"
    },
    {
      "name": "onPruneWorkspaces",
      "label": "Prune Old Workspaces",
      "type": "handler",
      "target": "workspace:prune",
      "key": "5",
      "group": "manage"
    },
    {
      "name": "onBack",
      "label": "Back",
      "type": "navigate",
      "target": "ai-tools",
      "key": "b",
      "group": "nav"
    }
  ]
}
```

Also add a navigation action to the `ai-tools` page to reach the workspaces page:

```json
{
  "name": "onNavigateWorkspaces",
  "label": "Workspaces",
  "type": "navigate",
  "target": "workspaces",
  "key": "w",
  "group": "tools"
}
```

- [ ] **Step 2: Create workspace-handlers.ts**

```typescript
// src/ui/handlers/workspace-handlers.ts
import type { HandlerRegistry } from "../../infrastructure/sitemap-types.js";
import { renderWorkspaceList } from "../renderers/workspace-renderers.js";

export function registerWorkspaceHandlers(registry: HandlerRegistry): void {
	registry.registerDataSource("workspace:active-list", (ctx) => {
		const shell = (ctx.deps as any).agentShell;
		if (!shell) return [];
		const workspaces = shell.list();
		const active = workspaces.filter((ws: any) => ws.state === "active" || ws.state === "ready");
		if (active.length === 0) return [];
		return active.map((ws: any) => ({
			key: "",
			label: `${ws.agentSlug}: ${ws.branch} (${ws.state})`,
			action: undefined,
			disabled: true,
		}));
	});

	registry.registerAction("workspace:list", async (ctx) => {
		const shell = (ctx.deps as any).agentShell;
		if (!shell) { ctx.deps.log("  AgentShell not available"); return undefined; }
		const workspaces = shell.list();
		renderWorkspaceList({ workspaces }, ctx.deps.log);
		await ctx.deps.input.waitForEnter();
		return undefined;
	});

	registry.registerAction("workspace:inspect", async (ctx) => {
		const shell = (ctx.deps as any).agentShell;
		if (!shell) { ctx.deps.log("  AgentShell not available"); return undefined; }
		const workspaces = shell.list();
		if (workspaces.length === 0) { ctx.deps.log("  No workspaces to inspect"); return undefined; }
		// Show list and ask for selection
		renderWorkspaceList({ workspaces }, ctx.deps.log);
		const id = await ctx.deps.input.ask("Workspace ID: ");
		const ws = workspaces.find((w: any) => w.id === id);
		if (!ws) { ctx.deps.log(`  Not found: ${id}`); return undefined; }
		const { renderWorkspaceInspect } = await import("../renderers/workspace-renderers.js");
		renderWorkspaceInspect({ workspace: ws, collectResult: ws.collectResult }, ctx.deps.log);
		await ctx.deps.input.waitForEnter();
		return undefined;
	});

	registry.registerAction("workspace:collect", async (ctx) => {
		const shell = (ctx.deps as any).agentShell;
		if (!shell) return undefined;
		const id = await ctx.deps.input.ask("Workspace ID to collect: ");
		const result = await shell.collect(id);
		ctx.deps.log(`  Collected: ${result.commits.length} commits, ${result.filesChanged} files changed`);
		await ctx.deps.input.waitForEnter();
		return undefined;
	});

	registry.registerAction("workspace:dispose", async (ctx) => {
		const shell = (ctx.deps as any).agentShell;
		if (!shell) return undefined;
		const id = await ctx.deps.input.ask("Workspace ID to dispose: ");
		await shell.dispose(id);
		ctx.deps.log(`  Disposed: ${id}`);
		await ctx.deps.input.waitForEnter();
		return undefined;
	});

	registry.registerAction("workspace:prune", async (ctx) => {
		const shell = (ctx.deps as any).agentShell;
		if (!shell) return undefined;
		const result = await shell.prune();
		const { renderPruneSummary } = await import("../renderers/workspace-renderers.js");
		renderPruneSummary(result, ctx.deps.log);
		await ctx.deps.input.waitForEnter();
		return undefined;
	});
}
```

- [ ] **Step 3: Register in register-handlers.ts**

Import and call the registration function:

```typescript
import { registerWorkspaceHandlers } from "./workspace-handlers.js";
```

Add call inside `registerAllHandlers`:

```typescript
registerWorkspaceHandlers(registry);
```

- [ ] **Step 4: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 5: Run sitemap validation**

Run: `cd "01 - Projects/Flowti CLI" && node .flowti/bin/main.js sitemap:validate` (if available)
Expected: PASS — sitemap valid with new page

- [ ] **Step 6: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: PASS — no regressions

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/configs/sitemap.json" "01 - Projects/Flowti CLI/src/ui/handlers/workspace-handlers.ts" "01 - Projects/Flowti CLI/src/ui/handlers/register-handlers.ts"
git commit -m "feat(workspace): add Workspaces sitemap page and interactive handlers"
```

---

### Task 14: Final Integration & Verification

**Files:**
- All files from previous tasks
- No new files

- [ ] **Step 1: Run full lint**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/ --config configs/eslint.config.mjs`
Expected: PASS — no violations (domain files have no infra imports)

- [ ] **Step 2: Run full type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 3: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: PASS — all existing + new tests pass

- [ ] **Step 4: Run build**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`
Expected: PASS — builds to `.flowti/bin/main.js`

- [ ] **Step 5: Commit any final fixes**

```bash
git add -A "01 - Projects/Flowti CLI/"
git commit -m "feat(workspace): final integration and verification pass"
```

---

## Implementation Summary

| Chunk | Tasks | New Files | Modified Files | Est. Tests |
|-------|-------|-----------|----------------|------------|
| 1. Domain Foundation | 1-2 | 3 src + 2 test | — | ~20 |
| 2. Config & ProcessRunner | 3-5 | — | 3 | ~5 |
| 3. WorkspaceRegistry | 6 | 1 src + 1 test | — | ~8 |
| 4. WorkspaceProvisioner | 7 | 1 src + 1 test | — | ~6 |
| 5. State Split/Collect | 8-9 | 2 src + 2 test | — | ~8 |
| 6. AgentShell | 10 | 1 src + 1 test | 1 | ~5 |
| 7. Controller & Renderers | 11-12 | 2 src + 1 test | 1 | ~8 |
| 8. Sitemap & Handlers | 13-14 | 1 src | 3 | — |
| **Total** | **14 tasks** | **11 src + 8 test** | **8** | **~60** |

Each task produces a working commit. Tasks 1-2 must be completed first (domain foundation). After that, chunks 3-5 can be parallelized (registry, provisioner, and state management are independent). Chunk 6 depends on 3-5. Chunks 7-8 depend on 6.

```
[1-2] Domain Foundation
  ├── [3-5] Config + ProcessRunner (sequential)
  ├── [6] WorkspaceRegistry
  ├── [7] WorkspaceProvisioner
  └── [8-9] StateSplitter + StateCollector
        └── [10] AgentShell (depends on 6,7,8-9)
              ├── [11-12] Controller + Renderers
              └── [13-14] Sitemap + Handlers + Verification
```
