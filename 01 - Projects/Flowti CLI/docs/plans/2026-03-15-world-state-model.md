# World State Model Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a unified ECS-compatible world state with agent actions, permission tracking, and activity log — queryable via `flowti state` CLI command.

**Architecture:** New `WorldState` type with ECS entities + agent actions. `WorldStateManager` singleton holds in-memory state, accepts actions, debounces writes to `.flowti/var/world-state.json`. Stream events feed through an action mapper into the state manager. Migration reads existing `data-*.json` on first run.

**Tech Stack:** TypeScript, Node.js built-ins, Vitest

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-15-world-state-model-design.md`

---

## File Structure

### New files (8)

| File | Responsibility |
|------|---------------|
| `src/domain/agents/world-state-types.ts` | All world state type definitions |
| `src/infrastructure/world-state-manager.ts` | Singleton: in-memory state, emitAction, debounced persistence, migration |
| `src/domain/agents/action-mapper.ts` | `mapStreamEventToAction()` pure function |
| `src/controller/state.controller.ts` | `flowti state` command handler |
| `src/ui/displays/state-display.ts` | Terminal rendering of world state |
| `tests/domain/agents/action-mapper.test.ts` | Action mapper tests |
| `tests/infrastructure/world-state-manager.test.ts` | State manager tests |
| `tests/ui/displays/state-display.test.ts` | State display tests |

### Modified files (4)

| File | Change |
|------|--------|
| `src/infrastructure/agent-shell.ts` | Feed stream events through action mapper to state manager |
| `src/infrastructure/deps.ts` | Add `worldState` to CliDeps |
| `src/main.ts` | Initialize world state manager, register state command, flush on exit |
| `src/infrastructure/types.ts` | Add `IWorldStateManager` interface |

---

## Chunk 1: Types + Action Mapper

### Task 1: Create world-state-types.ts

**Files:**
- Create: `src/domain/agents/world-state-types.ts`

- [ ] **Step 1: Write all type definitions**

```typescript
/**
 * world-state-types.ts — ECS-compatible world state types.
 *
 * Defines the unified state model for the agent environment.
 * Entities use string IDs and typed component maps.
 * Agent actions are observable events consumed by any visualization.
 */

export type AgentActionType =
	| "thinking"
	| "speaking"
	| "asking"
	| "using-tool"
	| "tool-complete"
	| "requesting-permission"
	| "permission-granted"
	| "permission-denied"
	| "task-started"
	| "task-completed"
	| "idle"
	| "error";

export interface AgentAction {
	readonly id: string;
	readonly agentName: string;
	readonly timestamp: string;
	readonly type: AgentActionType;
	readonly data: Record<string, unknown>;
}

export type EntityType = "agent" | "project" | "iteration";

export interface Entity {
	readonly id: string;
	readonly type: EntityType;
	readonly components: Record<string, unknown>;
}

export interface PermissionEntry {
	readonly tool: string;
	readonly scope: "once" | "always";
	readonly grantedAt: string;
	readonly context?: string;
}

export interface ActivityEntry {
	readonly id: string;
	readonly agentName: string;
	readonly timestamp: string;
	readonly type: AgentActionType;
	readonly summary: string;
}

export interface WorldState {
	readonly version: 1;
	readonly updatedAt: string;
	readonly entities: Record<string, Entity>;
	readonly permissions: Record<string, readonly PermissionEntry[]>;
	readonly activityLog: readonly ActivityEntry[];
}

export interface IWorldStateManager {
	emitAction(action: AgentAction): void;
	updateEntity(id: string, type: EntityType, components: Record<string, unknown>): void;
	getState(): WorldState;
	getEntity(id: string): Entity | null;
	flush(): void;
}
```

- [ ] **Step 2: Verify type-check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/world-state-types.ts"
git commit -m "feat: add world state ECS types and agent action definitions"
```

### Task 2: Create action-mapper.ts

**Files:**
- Create: `src/domain/agents/action-mapper.ts`
- Create: `tests/domain/agents/action-mapper.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect } from "vitest";
import { mapStreamEventToAction } from "../../../src/domain/agents/action-mapper.js";
import type { AgentStreamEvent } from "../../../src/domain/agents/agent-stream.js";

const ts = "2026-03-15T12:00:00Z";
const clock = { now: () => new Date(), ms: () => 1234, iso: () => ts, safeIso: () => ts };

describe("mapStreamEventToAction", () => {
	it("maps thinking event", () => {
		const event: AgentStreamEvent = { kind: "thinking", text: "Let me consider..." };
		const action = mapStreamEventToAction("Bob", event, clock);
		expect(action).not.toBeNull();
		expect(action!.type).toBe("thinking");
		expect(action!.agentName).toBe("Bob");
	});

	it("maps text event to speaking", () => {
		const event: AgentStreamEvent = { kind: "text", text: "Hello!" };
		const action = mapStreamEventToAction("Bob", event, clock);
		expect(action!.type).toBe("speaking");
		expect(action!.data.text).toBe("Hello!");
	});

	it("maps tool-start to using-tool", () => {
		const event: AgentStreamEvent = { kind: "tool-start", id: "t1", name: "Edit" };
		const action = mapStreamEventToAction("Bob", event, clock);
		expect(action!.type).toBe("using-tool");
		expect(action!.data.tool).toBe("Edit");
	});

	it("maps tool-end to tool-complete", () => {
		const event: AgentStreamEvent = { kind: "tool-end", id: "t1" };
		const action = mapStreamEventToAction("Bob", event, clock);
		expect(action!.type).toBe("tool-complete");
	});

	it("maps error event", () => {
		const event: AgentStreamEvent = { kind: "error", message: "Something broke" };
		const action = mapStreamEventToAction("Bob", event, clock);
		expect(action!.type).toBe("error");
		expect(action!.data.message).toBe("Something broke");
	});

	it("returns null for done event", () => {
		const event: AgentStreamEvent = { kind: "done" };
		expect(mapStreamEventToAction("Bob", event, clock)).toBeNull();
	});

	it("returns null for usage event", () => {
		const event: AgentStreamEvent = { kind: "usage", inputTokens: 100, outputTokens: 50 };
		expect(mapStreamEventToAction("Bob", event, clock)).toBeNull();
	});

	it("includes unique id and timestamp", () => {
		const event: AgentStreamEvent = { kind: "text", text: "Hi" };
		const a1 = mapStreamEventToAction("Bob", event, clock);
		const a2 = mapStreamEventToAction("Bob", event, clock);
		expect(a1!.id).not.toBe(a2!.id);
		expect(a1!.timestamp).toBe(ts);
	});
});
```

- [ ] **Step 2: Implement action-mapper.ts**

```typescript
/**
 * action-mapper.ts — Maps stream events to world-state agent actions.
 *
 * Pure function. No I/O, no side effects.
 */

import type { AgentStreamEvent } from "./agent-stream.js";
import type { AgentAction } from "./world-state-types.js";
import type { IClock } from "../../infrastructure/types.js";

let actionCounter = 0;

export function mapStreamEventToAction(agentName: string, event: AgentStreamEvent, clock: IClock): AgentAction | null {
	const base = { id: `action-${clock.ms()}-${++actionCounter}`, agentName, timestamp: clock.iso() };
	switch (event.kind) {
		case "thinking": return { ...base, type: "thinking", data: { text: event.text } };
		case "text": return { ...base, type: "speaking", data: { text: event.text } };
		case "tool-start": return { ...base, type: "using-tool", data: { tool: event.name, id: event.id } };
		case "tool-end": return { ...base, type: "tool-complete", data: { id: event.id } };
		case "tool-input": return null;
		case "error": return { ...base, type: "error", data: { message: event.message } };
		case "done": return null;
		case "usage": return null;
		default: return null;
	}
}
```

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/action-mapper.test.ts --config configs/vitest.config.ts`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/action-mapper.ts" "01 - Projects/Flowti CLI/tests/domain/agents/action-mapper.test.ts"
git commit -m "feat: add action mapper for stream events to world state actions"
```

---

## Chunk 2: World State Manager

### Task 3: Add IWorldStateManager to types.ts and CliDeps

**Files:**
- Modify: `src/infrastructure/types.ts`
- Modify: `src/infrastructure/deps.ts`

- [ ] **Step 1: Add IWorldStateManager to types.ts**

Import and re-export from world-state-types:

```typescript
export type { IWorldStateManager, WorldState, Entity, AgentAction, AgentActionType, PermissionEntry, ActivityEntry, EntityType } from "../domain/agents/world-state-types.js";
```

Add after the `IAgentShell` interface section.

- [ ] **Step 2: Add worldState to CliDeps**

In `deps.ts`, add to the `CliDeps` interface:

```typescript
readonly worldState: IWorldStateManager;
```

Update the import to include `IWorldStateManager`:

```typescript
import type { IFileSystem, IShell, IPaths, IClock, IProcess, IInput, IAgentShell, IWorldStateManager } from "./types.js";
```

- [ ] **Step 3: Commit (type-check will fail — fixed in Task 4)**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/types.ts" "01 - Projects/Flowti CLI/src/infrastructure/deps.ts"
git commit -m "feat: add IWorldStateManager to CliDeps"
```

### Task 4: Implement world-state-manager.ts

**Files:**
- Create: `src/infrastructure/world-state-manager.ts`
- Create: `tests/infrastructure/world-state-manager.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../src/infrastructure/paths.js", () => ({ paths: {} }));
vi.mock("../../src/infrastructure/clock.js", () => ({ clock: {} }));
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));

import { createWorldStateManager } from "../../src/infrastructure/world-state-manager.js";
import type { AgentAction, IWorldStateManager } from "../../src/domain/agents/world-state-types.js";

function makeDeps() {
	return {
		disk: {
			readFileSync: vi.fn(() => "{}"),
			writeFileSync: vi.fn(),
			existsSync: vi.fn(() => false),
			mkdirSync: vi.fn(),
			readdirSync: vi.fn(() => []),
		},
		paths: {
			join: vi.fn((...args: string[]) => args.join("/")),
			resolve: vi.fn((...args: string[]) => args.join("/")),
		},
		clock: {
			now: vi.fn(() => new Date()),
			ms: vi.fn(() => 1000),
			iso: vi.fn(() => "2026-03-15T12:00:00Z"),
			safeIso: vi.fn(() => "2026-03-15"),
		},
	} as never;
}

describe("WorldStateManager", () => {
	let mgr: IWorldStateManager;
	let deps: ReturnType<typeof makeDeps>;

	beforeEach(() => {
		vi.useFakeTimers();
		deps = makeDeps();
		mgr = createWorldStateManager(deps, "/vault");
	});

	it("starts with empty state", () => {
		const state = mgr.getState();
		expect(state.version).toBe(1);
		expect(Object.keys(state.entities)).toHaveLength(0);
		expect(state.activityLog).toHaveLength(0);
	});

	it("updateEntity creates entity with components", () => {
		mgr.updateEntity("Bob", "agent", { identity: { name: "Bob" } });
		const entity = mgr.getEntity("Bob");
		expect(entity).not.toBeNull();
		expect(entity!.type).toBe("agent");
		expect(entity!.components.identity).toEqual({ name: "Bob" });
	});

	it("updateEntity merges components", () => {
		mgr.updateEntity("Bob", "agent", { identity: { name: "Bob" } });
		mgr.updateEntity("Bob", "agent", { status: { state: "busy" } });
		const entity = mgr.getEntity("Bob");
		expect(entity!.components.identity).toEqual({ name: "Bob" });
		expect(entity!.components.status).toEqual({ state: "busy" });
	});

	it("emitAction updates entity status component", () => {
		mgr.updateEntity("Bob", "agent", { identity: { name: "Bob" } });
		const action: AgentAction = { id: "a1", agentName: "Bob", timestamp: "t1", type: "using-tool", data: { tool: "Edit" } };
		mgr.emitAction(action);
		const entity = mgr.getEntity("Bob");
		expect(entity!.components.status).toEqual({ state: "busy", currentAction: "using-tool", toolName: "Edit" });
	});

	it("emitAction appends to activity log", () => {
		mgr.updateEntity("Bob", "agent", {});
		const action: AgentAction = { id: "a1", agentName: "Bob", timestamp: "t1", type: "speaking", data: { text: "Hello" } };
		mgr.emitAction(action);
		expect(mgr.getState().activityLog).toHaveLength(1);
		expect(mgr.getState().activityLog[0].type).toBe("speaking");
	});

	it("activity log caps at 100", () => {
		mgr.updateEntity("Bob", "agent", {});
		for (let i = 0; i < 110; i++) {
			mgr.emitAction({ id: `a${i}`, agentName: "Bob", timestamp: "t", type: "thinking", data: {} });
		}
		expect(mgr.getState().activityLog).toHaveLength(100);
	});

	it("debounces write to disk", () => {
		mgr.updateEntity("Bob", "agent", {});
		expect(deps.disk.writeFileSync).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1100);
		expect(deps.disk.writeFileSync).toHaveBeenCalled();
	});

	it("flush writes immediately", () => {
		mgr.updateEntity("Bob", "agent", {});
		mgr.flush();
		expect(deps.disk.writeFileSync).toHaveBeenCalled();
	});

	it("getEntity returns null for missing entity", () => {
		expect(mgr.getEntity("NonExistent")).toBeNull();
	});
});
```

- [ ] **Step 2: Implement world-state-manager.ts**

```typescript
/**
 * world-state-manager.ts — In-memory world state with debounced persistence.
 */

import type { CliDeps } from "./deps.js";
import type { WorldState, Entity, EntityType, AgentAction, ActivityEntry, IWorldStateManager } from "../domain/agents/world-state-types.js";

export type WorldStateDeps = Pick<CliDeps, "disk" | "paths" | "clock">;

const ACTIVITY_LOG_CAP = 100;
const DEBOUNCE_MS = 1_000;

function emptyState(timestamp: string): WorldState {
	return { version: 1, updatedAt: timestamp, entities: {}, permissions: {}, activityLog: [] };
}

function deriveStatusFromAction(action: AgentAction): Record<string, unknown> {
	switch (action.type) {
		case "thinking": return { state: "busy", currentAction: "thinking" };
		case "speaking": return { state: "busy", currentAction: "speaking" };
		case "asking": return { state: "waiting", currentAction: "asking", question: action.data.question };
		case "using-tool": return { state: "busy", currentAction: "using-tool", toolName: action.data.tool };
		case "tool-complete": return { state: "busy", currentAction: "working" };
		case "requesting-permission": return { state: "waiting", currentAction: "requesting-permission", tool: action.data.tool };
		case "permission-granted": return { state: "busy", currentAction: "working" };
		case "permission-denied": return { state: "waiting", currentAction: "permission-denied" };
		case "task-started": return { state: "busy", currentAction: "task-started", task: action.data.task };
		case "task-completed": return { state: "idle", currentAction: "idle" };
		case "idle": return { state: "idle", currentAction: "idle" };
		case "error": return { state: "error", currentAction: "error", message: action.data.message };
		default: return {};
	}
}

function toActivityEntry(action: AgentAction): ActivityEntry {
	const summaryParts: string[] = [action.type];
	if (action.data.tool) summaryParts.push(String(action.data.tool));
	if (action.data.task) summaryParts.push(String(action.data.task));
	if (action.data.text) summaryParts.push(String(action.data.text).slice(0, 60));
	return { id: action.id, agentName: action.agentName, timestamp: action.timestamp, type: action.type, summary: summaryParts.join(" ") };
}

export function createWorldStateManager(deps: WorldStateDeps, vaultRoot: string): IWorldStateManager {
	const filePath = deps.paths.join(vaultRoot, ".flowti", "var", "world-state.json");
	let state = loadOrCreate(deps, filePath);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let dirty = false;

	function scheduleWrite(): void {
		dirty = true;
		if (debounceTimer) return;
		debounceTimer = setTimeout(() => {
			debounceTimer = null;
			if (dirty) writeToDisk();
		}, DEBOUNCE_MS);
	}

	function writeToDisk(): void {
		dirty = false;
		state = { ...state, updatedAt: deps.clock.iso() };
		const dir = deps.paths.join(vaultRoot, ".flowti", "var");
		if (!deps.disk.existsSync(dir)) deps.disk.mkdirSync(dir, { recursive: true });
		deps.disk.writeFileSync(filePath, JSON.stringify(state, null, "\t"), "utf-8");
	}

	return {
		emitAction(action: AgentAction): void {
			const entity = state.entities[action.agentName];
			if (entity) {
				const status = deriveStatusFromAction(action);
				const updated = { ...entity, components: { ...entity.components, status } };
				state = { ...state, entities: { ...state.entities, [action.agentName]: updated } };
			}
			const entry = toActivityEntry(action);
			const log = [...state.activityLog, entry];
			if (log.length > ACTIVITY_LOG_CAP) log.splice(0, log.length - ACTIVITY_LOG_CAP);
			state = { ...state, activityLog: log };
			scheduleWrite();
		},

		updateEntity(id: string, type: EntityType, components: Record<string, unknown>): void {
			const existing = state.entities[id];
			const merged = existing ? { ...existing.components, ...components } : components;
			state = { ...state, entities: { ...state.entities, [id]: { id, type, components: merged } } };
			scheduleWrite();
		},

		getState(): WorldState { return state; },

		getEntity(id: string): Entity | null { return state.entities[id] ?? null; },

		flush(): void {
			if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
			writeToDisk();
		},
	};
}

function loadOrCreate(deps: WorldStateDeps, filePath: string): WorldState {
	if (deps.disk.existsSync(filePath)) {
		try {
			const raw = JSON.parse(deps.disk.readFileSync(filePath, "utf-8")) as WorldState;
			if (raw.version === 1) return raw;
		} catch { /* corrupt — recreate */ }
	}
	return emptyState(deps.clock.iso());
}
```

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/world-state-manager.test.ts --config configs/vitest.config.ts`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/world-state-manager.ts" "01 - Projects/Flowti CLI/tests/infrastructure/world-state-manager.test.ts"
git commit -m "feat: implement world state manager with debounced persistence"
```

---

## Chunk 3: Shell Integration + Bootstrap

### Task 5: Wire action mapper into agent shell

**Files:**
- Modify: `src/infrastructure/agent-shell.ts`

- [ ] **Step 1: Add imports**

Add to agent-shell.ts imports:

```typescript
import { mapStreamEventToAction } from "../domain/agents/action-mapper.js";
```

Add `worldState` to the `ShellBaseDeps` type:

```typescript
export type ShellBaseDeps = Pick<CliDeps, "disk" | "paths" | "clock" | "shell" | "log" | "worldState">;
```

Note: this is a type-only change to the Pick. The actual `worldState` comes from `CliDeps`.

Wait — `ShellBaseDeps` is used in `createAgentShell` and some inbox functions. Adding `worldState` to the Pick means callers must provide it. Check if this breaks `createDefaultDeps` where `baseDeps` is assembled. Actually, `createDefaultDeps` creates the shell BEFORE `worldState` exists (chicken-and-egg).

Better approach: accept `worldState` as an optional parameter to `createAgentShell`, or pass it separately after construction. Simplest: add a `setWorldState` method or just accept it as a separate param.

Actually simplest: have the shell accept `IWorldStateManager | undefined` and check before emitting:

```typescript
export function createAgentShell(deps: ShellBaseDeps, config: AgentsConfig | undefined, vaultRoot: string, worldState?: IWorldStateManager): IAgentShell {
```

Then in the `proc.onOutput` handler for both `talk()` and `dispatch()`, after emitting to subscribers:

```typescript
if (worldState) {
	const action = mapStreamEventToAction(agent.name, event, deps.clock);
	if (action) worldState.emitAction(action);
}
```

- [ ] **Step 2: Update both onOutput handlers**

In `talk()` `proc.onOutput` handler, after `if (!detached) emit(event);`, add:

```typescript
if (worldState) { const action = mapStreamEventToAction(agent.name, event, deps.clock); if (action) worldState.emitAction(action); }
```

In `dispatch()` `proc.onOutput` handler, after `emit(event);`, add the same line.

- [ ] **Step 3: Emit task-started and task-completed actions**

In `dispatch()`, after `setAgentStatus(agent.name, "busy");`, add:

```typescript
if (worldState) worldState.emitAction({ id: `task-${deps.clock.ms()}`, agentName: agent.name, timestamp: deps.clock.iso(), type: "task-started", data: { task } });
```

In the dispatch completion handler, when a task completes (non-question), add:

```typescript
if (worldState) worldState.emitAction({ id: `task-${deps.clock.ms()}`, agentName: agent.name, timestamp: deps.clock.iso(), type: "task-completed", data: { task } });
```

- [ ] **Step 4: Verify type-check + tests**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/agent-shell.test.ts --config configs/vitest.config.ts`

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/agent-shell.ts"
git commit -m "feat: wire action mapper into agent shell for world state updates"
```

### Task 6: Bootstrap world state in main.ts and deps.ts

**Files:**
- Modify: `src/infrastructure/deps.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Update createDefaultDeps**

Import `createWorldStateManager`:

```typescript
import { createWorldStateManager } from "./world-state-manager.js";
```

Update `createDefaultDeps`:

```typescript
export function createDefaultDeps(agentsConfig?: AgentsConfig, vaultRoot?: string): CliDeps {
	const bus = createCliBus();
	attachCliRenderer(bus);
	const resolvedRoot = vaultRoot ?? ".";
	const worldState = createWorldStateManager({ disk, paths, clock }, resolvedRoot);
	const baseDeps = { disk, shell, paths, clock, log };
	const agentShell = createAgentShell(baseDeps, agentsConfig, resolvedRoot, worldState);
	return { disk, shell, paths, clock, proc, input, bus, log, warn, agentShell, worldState };
}
```

- [ ] **Step 2: Add flush on CLI exit in main.ts**

Before `proc.exit(0)`, add:

```typescript
deps.worldState.flush();
```

Also add flush in the error handler:

```typescript
main().catch((err: unknown) => {
	// ... existing error handling
	try { deps?.worldState?.flush(); } catch { /* best-effort */ }
	proc.exit(1);
});
```

Wait — `deps` is scoped inside `main()`. Move the flush into the main function's finally-like pattern. Actually, add it before both exit points:

In `main()`, after `await router.run("start");`:
```typescript
deps.worldState.flush();
```

- [ ] **Step 3: Verify type-check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 4: Run full tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/deps.ts" "01 - Projects/Flowti CLI/src/main.ts"
git commit -m "feat: bootstrap world state manager in deps and flush on exit"
```

---

## Chunk 4: CLI State Command

### Task 7: Create state display + controller

**Files:**
- Create: `src/ui/displays/state-display.ts`
- Create: `tests/ui/displays/state-display.test.ts`
- Create: `src/controller/state.controller.ts`

- [ ] **Step 1: Write state-display.ts**

```typescript
import { RESET, DIM, GREEN, YELLOW, RED, CYAN, BOLD } from "../../infrastructure/ui.js";
import type { WorldState, Entity, ActivityEntry } from "../../infrastructure/types.js";

const ACTION_COLORS: Record<string, string> = {
	"using-tool": YELLOW, "thinking": DIM, "speaking": GREEN,
	"asking": CYAN, "requesting-permission": RED, "error": RED,
	"task-started": GREEN, "task-completed": GREEN, "idle": DIM,
};

function renderEntitySummary(entity: Entity, log: (msg?: string) => void): void {
	const status = entity.components.status as { state?: string; currentAction?: string; toolName?: string; task?: string } | undefined;
	const identity = entity.components.identity as { persona?: string; agentType?: string } | undefined;
	const state = status?.state ?? "unknown";
	const color = state === "busy" ? YELLOW : state === "idle" ? DIM : state === "waiting" ? CYAN : RED;
	const name = identity?.persona ? `${identity.persona} (${entity.id})` : entity.id;
	const detail = status?.toolName ? `using tool: ${status.toolName}` : status?.task ? `task: ${status.task}` : status?.currentAction ?? state;
	log(`  ${CYAN}${name}${RESET} ${DIM}[${identity?.agentType ?? entity.type}]${RESET} — ${color}${detail}${RESET}`);
}

export function renderWorldStateSummary(state: WorldState, log: (msg?: string) => void): void {
	const ago = Date.now() - new Date(state.updatedAt).getTime();
	const agoStr = ago < 60_000 ? `${Math.round(ago / 1000)}s ago` : `${Math.round(ago / 60_000)}m ago`;
	log(`\n  ${BOLD}World State${RESET} ${DIM}(updated ${agoStr})${RESET}\n`);

	const agents = Object.values(state.entities).filter((e) => e.type === "agent");
	const projects = Object.values(state.entities).filter((e) => e.type === "project");

	if (agents.length > 0) {
		log(`  ${BOLD}Agents${RESET} (${agents.length})`);
		for (const a of agents) renderEntitySummary(a, log);
		log("");
	}

	if (projects.length > 0) {
		log(`  ${BOLD}Projects${RESET} (${projects.length})`);
		for (const p of projects) {
			const iter = p.components.iteration as { name?: string; status?: string } | undefined;
			const roster = p.components.roster as { agents?: string[] } | undefined;
			log(`  ${CYAN}${p.id}${RESET} — ${iter?.name ?? "no iteration"} ${DIM}[${iter?.status ?? ""}]${RESET} — ${roster?.agents?.length ?? 0} agents`);
		}
		log("");
	}

	if (state.activityLog.length > 0) {
		log(`  ${BOLD}Recent Activity${RESET}`);
		const recent = state.activityLog.slice(-10);
		for (const entry of recent) {
			const time = entry.timestamp.slice(11, 19);
			const color = ACTION_COLORS[entry.type] ?? DIM;
			log(`  ${DIM}${time}${RESET}  ${CYAN}${entry.agentName}${RESET}  ${color}${entry.summary}${RESET}`);
		}
		log("");
	}
}

export function renderEntityDetail(entity: Entity, log: (msg?: string) => void): void {
	log(`\n  ${BOLD}${entity.id}${RESET} ${DIM}[${entity.type}]${RESET}\n`);
	for (const [key, value] of Object.entries(entity.components)) {
		log(`  ${BOLD}${key}${RESET}: ${DIM}${JSON.stringify(value)}${RESET}`);
	}
	log("");
}
```

- [ ] **Step 2: Write state-display tests**

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", DIM: "", GREEN: "", YELLOW: "", RED: "", CYAN: "", BOLD: "",
}));

import { renderWorldStateSummary } from "../../../src/ui/displays/state-display.js";
import type { WorldState } from "../../../src/domain/agents/world-state-types.js";

function emptyState(): WorldState {
	return { version: 1, updatedAt: new Date().toISOString(), entities: {}, permissions: {}, activityLog: [] };
}

describe("renderWorldStateSummary", () => {
	it("renders empty state without errors", () => {
		const log = vi.fn();
		renderWorldStateSummary(emptyState(), log);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("World State"));
	});

	it("renders agents section", () => {
		const log = vi.fn();
		const state = emptyState();
		(state as Record<string, unknown>).entities = { Bob: { id: "Bob", type: "agent", components: { identity: { agentType: "ai" }, status: { state: "idle" } } } };
		renderWorldStateSummary(state, log);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Bob"));
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Agents"));
	});

	it("renders activity log", () => {
		const log = vi.fn();
		const state = { ...emptyState(), activityLog: [{ id: "1", agentName: "Bob", timestamp: "2026-03-15T12:00:00Z", type: "speaking" as const, summary: "Hello" }] };
		renderWorldStateSummary(state, log);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Recent Activity"));
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Hello"));
	});
});
```

- [ ] **Step 3: Write state.controller.ts**

```typescript
import type { CommandHandler } from "../infrastructure/types.js";
import { renderWorldStateSummary, renderEntityDetail } from "../ui/displays/state-display.js";

export const commands: Record<string, CommandHandler> = {
	state: (flags, _rawArgs, _cmd, _project) => {
		const { createWorldStateManager } = require("../infrastructure/world-state-manager.js") as typeof import("../infrastructure/world-state-manager.js");
		const { disk } = require("../infrastructure/filesystem.js") as typeof import("../infrastructure/filesystem.js");
		const { paths } = require("../infrastructure/paths.js") as typeof import("../infrastructure/paths.js");
		const { clock } = require("../infrastructure/clock.js") as typeof import("../infrastructure/clock.js");
		const { log } = require("../infrastructure/logger.js") as typeof import("../infrastructure/logger.js");
		const { VAULT_ROOT } = require("../infrastructure/config.js") as typeof import("../infrastructure/config.js");

		const mgr = createWorldStateManager({ disk, paths, clock }, VAULT_ROOT);
		const state = mgr.getState();

		if (flags.json) {
			log(JSON.stringify(state, null, 2));
			return;
		}

		const agentName = typeof flags.agent === "string" ? flags.agent : null;
		if (agentName) {
			const entity = mgr.getEntity(agentName);
			if (entity) renderEntityDetail(entity, log);
			else log(`\n  Agent "${agentName}" not found in world state.\n`);
			return;
		}

		renderWorldStateSummary(state, log);
	},
};
```

Wait — this creates a NEW manager instance that reads from disk. That's correct for CLI non-interactive mode (no running process = read from file). For interactive mode, the world state is in-memory via deps. The controller should use deps when available, fall back to disk read otherwise.

Actually, looking at how other controllers work — they receive `(flags, rawArgs, command, project)` but NOT deps. The deps are in the request-response layer. For the `state` command, reading from disk is correct since it's a snapshot query.

- [ ] **Step 4: Register command in main.ts**

Add import:
```typescript
import { commands as stateCmds } from "./controller/state.controller.js";
```

Add registration:
```typescript
registry.registerDomain({ domain: "state", commands: stateCmds, projectFree: ["state"] });
```

- [ ] **Step 5: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/ui/displays/state-display.test.ts --config configs/vitest.config.ts`

- [ ] **Step 6: Full verification**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/domain/agents/world-state-types.ts src/domain/agents/action-mapper.ts src/infrastructure/world-state-manager.ts src/controller/state.controller.ts src/ui/displays/state-display.ts --config configs/eslint.config.mjs`
Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/controller/state.controller.ts" "01 - Projects/Flowti CLI/src/ui/displays/state-display.ts" "01 - Projects/Flowti CLI/tests/ui/displays/state-display.test.ts" "01 - Projects/Flowti CLI/src/main.ts"
git commit -m "feat: add flowti state CLI command with world state display"
```
