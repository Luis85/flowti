# Excalibur RPG Environment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the static ExcaliburJS agent dashboard into a live RPG world with goal-oriented movement, interactive HTML panels, and full agent control via SSE + HTTP API.

**Architecture:** Hybrid client — CLI owns data (world state, tasks, permissions), game owns presentation (positions, movement, animations). Three communication channels: SSE for real-time actions, 30s poll for state reconciliation, HTTP POST for commands. Pure `AgentBrain` state machine drives goal-oriented movement influenced by GURPS attributes.

**Tech Stack:** ExcaliburJS v0.32.0 (game engine), Node.js built-in `http` (API/SSE server), vitest (game tests), esbuild (game bundler), HTML/CSS (interaction panels)

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-16-excalibur-rpg-environment-design.md`

---

## Chunk 1: CLI Foundation — Multi-Listener + Data Model

CLI-side changes that enable the game to connect: multi-listener on WorldStateManager, STATUS_MAP fix, DashboardAgent expansion with RPG fields, deps.ts migration.

### Task 1: Replace setActionCallback with addActionListener

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/agents/world-state-types.ts`
- Modify: `01 - Projects/Flowti CLI/src/infrastructure/world-state-manager.ts`
- Modify: `01 - Projects/Flowti CLI/tests/infrastructure/world-state-manager.test.ts`

- [ ] **Step 1: Update IWorldStateManager interface**

In `world-state-types.ts`, replace `setActionCallback` with:

```typescript
addActionListener(callback: (action: AgentAction) => void): void;
removeActionListener(callback: (action: AgentAction) => void): void;
```

Remove the old `setActionCallback` method from the interface.

- [ ] **Step 2: Update world-state-manager.ts implementation**

Replace the single `actionCallback` variable with an array:

```typescript
const actionListeners: Array<(action: AgentAction) => void> = [];
```

Implement `addActionListener` (push to array) and `removeActionListener` (filter out). In `emitAction`, iterate all listeners instead of calling one callback. Remove the old `setActionCallback` function.

- [ ] **Step 3: Fix STATUS_MAP — permission-denied**

In `world-state-manager.ts`, change the `permission-denied` entry in `STATUS_MAP` from:

```typescript
"permission-denied": () => ({ state: "waiting", currentAction: "permission-denied" }),
```

to:

```typescript
"permission-denied": () => ({ state: "idle", currentAction: "permission-denied" }),
```

- [ ] **Step 4: Update existing tests**

In `tests/infrastructure/world-state-manager.test.ts`, find any tests using `setActionCallback` and update to use `addActionListener`. Add a test that multiple listeners are called:

```typescript
it("calls all registered action listeners", () => {
	const calls1: AgentAction[] = [];
	const calls2: AgentAction[] = [];
	manager.addActionListener((a) => calls1.push(a));
	manager.addActionListener((a) => calls2.push(a));
	manager.emitAction(action);
	expect(calls1).toHaveLength(1);
	expect(calls2).toHaveLength(1);
});

it("removeActionListener stops calls to removed listener", () => {
	const calls: AgentAction[] = [];
	const listener = (a: AgentAction) => calls.push(a);
	manager.addActionListener(listener);
	manager.removeActionListener(listener);
	manager.emitAction(action);
	expect(calls).toHaveLength(0);
});
```

Add a test for the STATUS_MAP fix:

```typescript
it("permission-denied maps to idle state", () => {
	manager.emitAction({ ...action, type: "permission-denied" });
	const entity = manager.getEntity(action.agentName);
	expect(entity?.components.status).toMatchObject({ state: "idle" });
});
```

- [ ] **Step 5: Run tests**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/world-state-manager.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 6: Update deps.ts**

In `src/infrastructure/deps.ts`, change line ~114 from:

```typescript
worldState.setActionCallback((action) => workerManager.dispatchWorldEvent(action));
```

to:

```typescript
worldState.addActionListener((action) => workerManager.dispatchWorldEvent(action));
```

- [ ] **Step 7: Run full test suite to verify no regressions**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts
```

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/world-state-types.ts" "01 - Projects/Flowti CLI/src/infrastructure/world-state-manager.ts" "01 - Projects/Flowti CLI/src/infrastructure/deps.ts" "01 - Projects/Flowti CLI/tests/infrastructure/world-state-manager.test.ts"
git commit -m "feat: replace setActionCallback with multi-listener addActionListener"
```

### Task 2: Expand DashboardAgent with RPG fields

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/agents/agent-export.ts`
- Modify: `01 - Projects/Flowti CLI/tests/domain/agents/agent-export.test.ts`

- [ ] **Step 1: Add RPG fields to DashboardAgent interface**

In `agent-export.ts`, add to the `DashboardAgent` interface after the `phase` field:

```typescript
readonly persona?: string;
readonly mood?: string;
readonly personality?: readonly string[];
readonly attributes?: AgentAttributes;
readonly experience?: number;
readonly skills?: readonly AgentSkill[];
readonly relationships?: readonly AgentRelationship[];
readonly suggestedTasks?: readonly SuggestedTask[];
readonly goals?: readonly AgentGoal[];
readonly behaviors?: readonly string[];
```

Add the necessary imports from `agent-types.ts`: `AgentAttributes`, `AgentSkill`, `AgentRelationship`, `SuggestedTask`, `AgentGoal`.

- [ ] **Step 2: Update and export buildDashboardAgent**

`buildDashboardAgent` is currently a private function. Add `export` to it so tests can verify the mapping directly. Then add the RPG field mappings from the `agent` parameter (which is `AgentSummary` and already carries all these fields):

```typescript
export function buildDashboardAgent(
	agent: AgentSummary,
	derived: { status: AgentStatus; project?: string; iteration?: string; phase?: string },
): DashboardAgent {
	return {
		name: agent.name,
		agentType: agent.agentType,
		domain: agent.domain,
		status: derived.status,
		project: derived.project,
		iteration: derived.iteration,
		phase: derived.phase,
		persona: agent.persona,
		mood: agent.mood,
		personality: agent.personality,
		attributes: agent.attributes,
		experience: agent.experience,
		skills: agent.skills.length > 0 ? agent.skills : undefined,
		relationships: agent.relationships,
		suggestedTasks: agent.suggestedTasks,
		goals: agent.goals,
		behaviors: agent.behaviors,
	};
}
```

- [ ] **Step 3: Add test for RPG field mapping**

In `tests/domain/agents/agent-export.test.ts`, add or update a test:

```typescript
it("buildDashboardAgent includes RPG fields", () => {
	const agent = createMockAgent({
		persona: "Bobby",
		mood: "cheerful",
		personality: ["helpful", "curious"],
		attributes: { str: 8, int: 14, wis: 12, cha: 16, dex: 10, con: 10 },
		experience: 150,
	});
	const result = buildDashboardAgent(agent, { status: "busy", project: "CLI" });
	expect(result.persona).toBe("Bobby");
	expect(result.mood).toBe("cheerful");
	expect(result.attributes?.int).toBe(14);
	expect(result.experience).toBe(150);
});
```

- [ ] **Step 4: Run tests**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/agent-export.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/agent-export.ts" "01 - Projects/Flowti CLI/tests/domain/agents/agent-export.test.ts"
git commit -m "feat: expand DashboardAgent with RPG fields for game consumption"
```

---

## Chunk 2: CLI Server API — Routing Layer + SSE + Endpoints

Add the routing layer to the static server, SSE endpoint, and HTTP API endpoints for game-to-CLI communication.

### Task 3: Add routing layer and SSE to static-server.ts

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/serve/static-server.ts`
- Modify: `01 - Projects/Flowti CLI/tests/domain/serve/static-server.test.ts`

- [ ] **Step 1: Define ServerContext type**

Add at the top of `static-server.ts`:

```typescript
import type { ServerResponse } from "node:http";
import type { IWorldStateManager } from "../agents/world-state-types.js";
import type { IWorkerManager } from "../agents/worker-types.js";

export interface ServerContext {
	readonly worldState: IWorldStateManager;
	readonly workerManager: IWorkerManager;
	readonly deps: { readonly disk: IFileSystem; readonly paths: IPaths; readonly clock: { now(): Date; iso(): string } };
	readonly sseClients: Set<ServerResponse>;
	readonly vaultRoot: string;
}
```

- [ ] **Step 2: Add JSON body parser helper**

```typescript
export function parseJsonBody(req: import("node:http").IncomingMessage): Promise<Record<string, unknown>> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		req.on("data", (chunk: Buffer) => chunks.push(chunk));
		req.on("end", () => {
			try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8"))); }
			catch { reject(new Error("Invalid JSON")); }
		});
		req.on("error", reject);
	});
}
```

- [ ] **Step 3: Add SSE connection handler**

```typescript
export function handleSseConnection(res: import("node:http").ServerResponse, ctx: ServerContext): void {
	res.writeHead(200, {
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache",
		"Connection": "keep-alive",
	});
	res.write("event: connected\ndata: {}\n\n");
	ctx.sseClients.add(res);
	res.on("close", () => ctx.sseClients.delete(res));
}
```

- [ ] **Step 4: Add API route handler**

```typescript
export async function handleApiRoute(
	req: import("node:http").IncomingMessage,
	res: import("node:http").ServerResponse,
	urlPath: string,
	ctx: ServerContext,
): Promise<void> {
	const json = (status: number, data: unknown) => {
		res.writeHead(status, { "Content-Type": "application/json" });
		res.end(JSON.stringify(data));
	};

	if (urlPath === "/events" && req.method === "GET") {
		handleSseConnection(res, ctx);
		return;
	}

	if (urlPath === "/api/world-state" && req.method === "GET") {
		const wsPath = ctx.deps.paths.join(ctx.vaultRoot, ".flowti", "var", "world-state.json");
		if (!ctx.deps.disk.existsSync(wsPath)) { json(404, { error: "No world state" }); return; }
		const content = ctx.deps.disk.readFileSync(wsPath, "utf-8");
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(content);
		return;
	}

	const agentMatch = urlPath.match(/^\/api\/agent\/([^/]+)$/);
	if (agentMatch && req.method === "GET") {
		const entity = ctx.worldState.getEntity(decodeURIComponent(agentMatch[1]));
		json(entity ? 200 : 404, entity ?? { error: "Agent not found" });
		return;
	}

	if (urlPath === "/api/agent/send" && req.method === "POST") {
		const body = await parseJsonBody(req);
		const name = String(body.agentName ?? "");
		const message = String(body.message ?? "");
		if (!name || !message) { json(400, { error: "agentName and message required" }); return; }

		// Load conversation history (mirrors agents-interact-menu.ts pattern)
		const convDir = ctx.deps.paths.join(ctx.vaultRoot, ".flowti", "var", "conversations");
		const { loadConversation, appendTurn, saveConversation } = await import("../agents/agent-conversation-store.js");
		const conv = loadConversation(ctx.deps, convDir, name);
		// Send with conversation context
		const onResponse = (response: string) => {
			// Persist turns
			const withUser = appendTurn(conv, { role: "user", content: message, ts: ctx.deps.clock.iso() });
			const withAgent = appendTurn(withUser, { role: "agent", content: response, ts: ctx.deps.clock.iso() });
			saveConversation(ctx.deps, convDir, name, withAgent);
			// Emit speaking action for SSE (needed for NPC agents whose responses bypass world state)
			ctx.worldState.emitAction({
				id: `speak-${Date.now()}`, agentName: name, timestamp: ctx.deps.clock.iso(),
				type: "speaking", data: { text: response },
			});
		};
		ctx.workerManager.send(name, message, { foreground: false, onResponse });
		json(200, { ok: true });
		return;
	}

	if (urlPath === "/api/agent/task" && req.method === "POST") {
		const body = await parseJsonBody(req);
		const name = String(body.agentName ?? "");
		const task = String(body.task ?? "");
		if (!name || !task) { json(400, { error: "agentName and task required" }); return; }

		const { readAgentState, addTask, writeAgentState } = await import("../agents/agent-state.js");
		const varDir = ctx.deps.paths.join(ctx.vaultRoot, ".flowti", "var");
		const state = readAgentState(ctx.deps, varDir, name);
		const taskId = `task-${Date.now()}`;
		const newState = addTask(state, { name: task, status: "pending", assignedAt: ctx.deps.clock.iso() });
		writeAgentState(ctx.deps, varDir, name, newState);
		ctx.worldState.emitAction({
			id: taskId, agentName: name, timestamp: ctx.deps.clock.iso(),
			type: "task-started", data: { task },
		});
		json(200, { ok: true, taskId });
		return;
	}

	if (urlPath === "/api/agent/permission" && req.method === "POST") {
		const body = await parseJsonBody(req);
		const name = String(body.agentName ?? "");
		const tool = String(body.tool ?? "");
		const decision = String(body.decision ?? "");
		if (!name || !tool || !decision) { json(400, { error: "agentName, tool, and decision required" }); return; }

		// Idempotent: check if already resolved
		const entity = ctx.worldState.getEntity(name);
		const status = entity?.components.status as { currentAction?: string } | undefined;
		if (status?.currentAction !== "requesting-permission") {
			json(200, { ok: true, alreadyResolved: true });
			return;
		}
		const actionType = decision === "allow" ? "permission-granted" : "permission-denied";
		ctx.worldState.emitAction({
			id: `perm-${Date.now()}`, agentName: name, timestamp: ctx.deps.clock.iso(),
			type: actionType, data: { tool },
		});
		json(200, { ok: true });
		return;
	}

	json(404, { error: "Not found" });
}
```

- [ ] **Step 5: Update startServer to accept optional ServerContext**

Change the `startServer` signature to accept an optional `ServerContext`. In the `createServer` callback, check if the URL starts with `/events` or `/api/` — if so and context exists, dispatch to `handleApiRoute`. Otherwise fall through to `handleRequest`.

```typescript
export async function startServer(
	options: ServerOptions,
	deps: ServeDeps,
	context?: ServerContext,
): Promise<ServerHandle> {
	const http = await import("node:http");
	const server = http.createServer(async (req, res) => {
		const rawPath = (req.url ?? "/").split("?")[0];
		if (context && (rawPath.startsWith("/api/") || rawPath === "/events")) {
			try { await handleApiRoute(req, res, rawPath, context); }
			catch { res.writeHead(500); res.end("Internal error"); }
			return;
		}
		const result = handleRequest(req.url ?? "/", options.dir, deps);
		res.writeHead(result.statusCode, { "Content-Type": result.contentType });
		res.end(result.body);
	});
	return new Promise((resolve) => {
		server.listen(options.port, () => {
			resolve({ url: `http://localhost:${options.port}`, close: () => server.close() });
		});
	});
}
```

- [ ] **Step 6: Add tests for parseJsonBody and handleApiRoute**

Test `parseJsonBody` with valid JSON, invalid JSON, and empty body. Test `handleApiRoute` returns 404 for unknown routes. Test the `/api/world-state` route returns file contents when it exists.

- [ ] **Step 7: Run tests**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/serve/static-server.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/serve/static-server.ts" "01 - Projects/Flowti CLI/tests/domain/serve/static-server.test.ts"
git commit -m "feat: add routing layer, SSE endpoint, and API routes to static server"
```

### Task 4: Wire SSE in dashboard-service.ts

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/serve/dashboard-service.ts`
- Modify: `01 - Projects/Flowti CLI/tests/domain/serve/dashboard-service.test.ts`

- [ ] **Step 1: Create ServerContext and pass to startServer**

In `startDashboardServer()`, after `regenerateDashboardData`, construct a `ServerContext` and pass it to `startServer`. Import `IWorldStateManager` and `IWorkerManager`. The SSE client set is created here and the action listener is registered:

```typescript
import type { ServerResponse } from "node:http";

const sseClients = new Set<ServerResponse>();
const sseActionListener = (action: AgentAction) => {
	const data = JSON.stringify(action);
	for (const client of sseClients) {
		client.write(`event: agent-action\ndata: ${data}\n\n`);
	}
};
```

Also hook into `updateEntity` to emit `entity-update` SSE events. Override the world state manager's `updateEntity` by wrapping it with an SSE broadcast:

```typescript
const originalUpdateEntity = worldState.updateEntity.bind(worldState);
const wrappedUpdateEntity = (id: string, type: WorldEntityType, components: Record<string, unknown>) => {
	originalUpdateEntity(id, type, components);
	const data = JSON.stringify({ id, type, components });
	for (const client of sseClients) {
		client.write(`event: entity-update\ndata: ${data}\n\n`);
	}
};
```

Register `sseActionListener` via `worldState.addActionListener(sseActionListener)` before starting the server. Store references so `stopDashboard` can call `removeActionListener` and restore the original `updateEntity`.

- [ ] **Step 2: Update StartDashboardOptions**

Add `worldState` and `workerManager` to `StartDashboardOptions`:

```typescript
readonly worldState: IWorldStateManager;
readonly workerManager: IWorkerManager;
```

- [ ] **Step 3: Update stopDashboard to remove listener**

In `stopDashboard`, call `worldState.removeActionListener(sseListener)` before closing the server.

- [ ] **Step 4: Update tests**

Add a test that the SSE listener is registered on start and removed on stop.

- [ ] **Step 5: Run tests**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/serve/dashboard-service.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 6: Run full test suite**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts
```

- [ ] **Step 7: Type check**

```bash
cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json
```

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/serve/dashboard-service.ts" "01 - Projects/Flowti CLI/tests/domain/serve/dashboard-service.test.ts"
git commit -m "feat: wire SSE action listener in dashboard service"
```

---

## Chunk 3: Game Project Setup + Data Layer

Set up test infrastructure for the game project and build the pure data layer (types, api-client, event-stream, state-store, config).

### Task 5: Game project test infrastructure

**Files:**
- Modify: `01 - Projects/Flowti CLI/agents/package.json`
- Create: `01 - Projects/Flowti CLI/agents/vitest.config.ts`
- Modify: `01 - Projects/Flowti CLI/agents/tsconfig.json`

- [ ] **Step 1: Add vitest to game devDependencies**

```bash
cd "01 - Projects/Flowti CLI/agents" && npm install --save-dev vitest jsdom
```

- [ ] **Step 2: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["tests/**/*.test.ts"],
		environment: "node",
	},
});
```

- [ ] **Step 3: Add test script to package.json**

Add `"test": "vitest run"` to the scripts section.

- [ ] **Step 4: Update tsconfig.json to include tests**

Change `"include"` to `["src/**/*.ts", "tests/**/*.ts"]`.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/package.json" "01 - Projects/Flowti CLI/agents/package-lock.json" "01 - Projects/Flowti CLI/agents/vitest.config.ts" "01 - Projects/Flowti CLI/agents/tsconfig.json"
git commit -m "chore: add vitest test infrastructure to game project"
```

### Task 6: Game types and config

**Files:**
- Create: `01 - Projects/Flowti CLI/agents/src/data/types.ts`
- Create: `01 - Projects/Flowti CLI/agents/src/config/domain-map.ts`
- Create: `01 - Projects/Flowti CLI/agents/src/config/settings.ts`
- Create: `01 - Projects/Flowti CLI/agents/tests/config/domain-map.test.ts`

- [ ] **Step 1: Create data/types.ts**

Mirror the CLI types needed by the game. Do NOT import from CLI — duplicate the interfaces to keep the game project standalone:

```typescript
/** Game-side mirror of CLI WorldState types. */

export type AgentActionType =
	| "thinking" | "speaking" | "asking" | "using-tool" | "tool-complete"
	| "requesting-permission" | "permission-granted" | "permission-denied"
	| "task-started" | "task-completed" | "idle" | "error";

export interface AgentAction {
	readonly id: string;
	readonly agentName: string;
	readonly timestamp: string;
	readonly type: AgentActionType;
	readonly data: Record<string, unknown>;
}

export interface WorldEntity {
	readonly id: string;
	readonly type: "agent" | "project" | "iteration";
	readonly components: Record<string, unknown>;
}

export interface WorldState {
	readonly version: 1;
	readonly updatedAt: string;
	readonly entities: Record<string, WorldEntity>;
	readonly permissions: Record<string, readonly PermissionEntry[]>;
	readonly activityLog: readonly ActivityEntry[];
}

export interface PermissionEntry {
	readonly tool: string;
	readonly scope: "once" | "always";
	readonly grantedAt: string;
}

export interface ActivityEntry {
	readonly id: string;
	readonly agentName: string;
	readonly timestamp: string;
	readonly type: AgentActionType;
	readonly summary: string;
}

export interface AgentAttributes {
	readonly str?: number;
	readonly int?: number;
	readonly wis?: number;
	readonly cha?: number;
	readonly dex?: number;
	readonly con?: number;
}

export interface DashboardAgent {
	readonly name: string;
	readonly agentType: string;
	readonly domain?: string;
	readonly status: "busy" | "idle" | "unassigned";
	readonly persona?: string;
	readonly mood?: string;
	readonly personality?: readonly string[];
	readonly attributes?: AgentAttributes;
	readonly experience?: number;
	readonly skills?: readonly { name: string; level: string }[];
	readonly relationships?: readonly { target: string; type: string }[];
	readonly suggestedTasks?: readonly { name: string; phases: string[] }[];
}

export interface DashboardData {
	readonly agents: readonly DashboardAgent[];
	readonly projects: readonly { name: string; agents: string[] }[];
}

export type Setting = "office" | "village" | "station" | "hub";
```

- [ ] **Step 2: Create config/domain-map.ts**

```typescript
import type { Setting } from "../data/types.js";

const DEFAULT_MAP: Record<string, Setting> = {
	engineering: "office", qa: "office", devops: "office",
	development: "office", testing: "office",
	design: "village", ux: "village", product: "village",
	management: "station", delivery: "station", coordination: "station",
	general: "hub",
};

export function resolveSettingForDomain(domain: string | undefined, custom?: Record<string, Setting>): Setting {
	if (!domain) return "hub";
	const merged = custom ? { ...DEFAULT_MAP, ...custom } : DEFAULT_MAP;
	return merged[domain.toLowerCase()] ?? "hub";
}
```

- [ ] **Step 3: Create config/settings.ts**

```typescript
import type { Setting } from "../data/types.js";

export interface SceneTheme {
	readonly background: string;
	readonly workstationColor: string;
	readonly floorColor: string;
	readonly label: string;
}

export const SCENE_THEMES: Record<Setting, SceneTheme> = {
	hub: { background: "#0a0a0f", workstationColor: "#1e293b", floorColor: "#111827", label: "Hub" },
	office: { background: "#0f172a", workstationColor: "#1e3a5f", floorColor: "#0c1524", label: "Office" },
	village: { background: "#1a1510", workstationColor: "#3d2e1a", floorColor: "#15120d", label: "Village" },
	station: { background: "#0a0f1a", workstationColor: "#0e3d4a", floorColor: "#080d14", label: "Station" },
};

export const WORKSTATION_COLS = 4;
export const WORKSTATION_SPACING = { x: 140, y: 120 };
export const WORKSTATION_START = { x: 100, y: 100 };
```

- [ ] **Step 4: Write domain-map tests**

```typescript
import { describe, it, expect } from "vitest";
import { resolveSettingForDomain } from "../../src/config/domain-map.js";

describe("resolveSettingForDomain", () => {
	it("maps engineering to office", () => {
		expect(resolveSettingForDomain("engineering")).toBe("office");
	});
	it("maps design to village", () => {
		expect(resolveSettingForDomain("design")).toBe("village");
	});
	it("maps management to station", () => {
		expect(resolveSettingForDomain("management")).toBe("station");
	});
	it("returns hub for undefined domain", () => {
		expect(resolveSettingForDomain(undefined)).toBe("hub");
	});
	it("returns hub for unknown domain", () => {
		expect(resolveSettingForDomain("marketing")).toBe("hub");
	});
	it("custom mapping overrides default", () => {
		expect(resolveSettingForDomain("marketing", { marketing: "village" })).toBe("village");
	});
	it("is case-insensitive", () => {
		expect(resolveSettingForDomain("Engineering")).toBe("office");
	});
});
```

- [ ] **Step 5: Run tests**

```bash
cd "01 - Projects/Flowti CLI/agents" && npx vitest run tests/config/domain-map.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/data/types.ts" "01 - Projects/Flowti CLI/agents/src/config/domain-map.ts" "01 - Projects/Flowti CLI/agents/src/config/settings.ts" "01 - Projects/Flowti CLI/agents/tests/config/domain-map.test.ts"
git commit -m "feat: add game types, domain-map config, and scene themes"
```

### Task 7: State store with diff detection

**Files:**
- Create: `01 - Projects/Flowti CLI/agents/src/data/state-store.ts`
- Create: `01 - Projects/Flowti CLI/agents/tests/data/state-store.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from "vitest";
import { createStateStore } from "../../src/data/state-store.js";
import type { WorldState, WorldEntity } from "../../src/data/types.js";

const entity = (id: string, components: Record<string, unknown> = {}): WorldEntity => ({
	id, type: "agent", components,
});

const state = (entities: Record<string, WorldEntity> = {}): WorldState => ({
	version: 1, updatedAt: "", entities, permissions: {}, activityLog: [],
});

describe("StateStore", () => {
	it("detects new entity", () => {
		const store = createStateStore();
		store.setState(state({}));
		const diff = store.applyState(state({ Bob: entity("Bob") }));
		expect(diff.added).toEqual(["Bob"]);
		expect(diff.removed).toEqual([]);
	});
	it("detects removed entity", () => {
		const store = createStateStore();
		store.setState(state({ Bob: entity("Bob") }));
		const diff = store.applyState(state({}));
		expect(diff.removed).toEqual(["Bob"]);
	});
	it("detects changed component", () => {
		const store = createStateStore();
		store.setState(state({ Bob: entity("Bob", { status: { state: "idle" } }) }));
		const diff = store.applyState(state({ Bob: entity("Bob", { status: { state: "busy" } }) }));
		expect(diff.changed).toEqual(["Bob"]);
	});
	it("identical state returns empty diff", () => {
		const store = createStateStore();
		const s = state({ Bob: entity("Bob") });
		store.setState(s);
		const diff = store.applyState(s);
		expect(diff.added).toEqual([]);
		expect(diff.removed).toEqual([]);
		expect(diff.changed).toEqual([]);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "01 - Projects/Flowti CLI/agents" && npx vitest run tests/data/state-store.test.ts
```

- [ ] **Step 3: Implement state-store.ts**

```typescript
import type { WorldState } from "./types.js";

export interface StateDiff {
	readonly added: string[];
	readonly removed: string[];
	readonly changed: string[];
}

export interface StateStore {
	getState(): WorldState | null;
	setState(state: WorldState): void;
	applyState(next: WorldState): StateDiff;
	getEntity(id: string): WorldState["entities"][string] | undefined;
}

export function createStateStore(): StateStore {
	let current: WorldState | null = null;

	return {
		getState: () => current,
		setState: (s) => { current = s; },
		getEntity: (id) => current?.entities[id],
		applyState(next) {
			const prev = current;
			current = next;
			if (!prev) return { added: Object.keys(next.entities), removed: [], changed: [] };
			const prevIds = new Set(Object.keys(prev.entities));
			const nextIds = new Set(Object.keys(next.entities));
			const added = [...nextIds].filter((id) => !prevIds.has(id));
			const removed = [...prevIds].filter((id) => !nextIds.has(id));
			const changed = [...nextIds].filter((id) =>
				prevIds.has(id) && JSON.stringify(prev.entities[id]) !== JSON.stringify(next.entities[id]),
			);
			return { added, removed, changed };
		},
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "01 - Projects/Flowti CLI/agents" && npx vitest run tests/data/state-store.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/data/state-store.ts" "01 - Projects/Flowti CLI/agents/tests/data/state-store.test.ts"
git commit -m "feat: add state store with diff detection for world state polling"
```

### Task 8: API client

**Files:**
- Create: `01 - Projects/Flowti CLI/agents/src/data/api-client.ts`
- Create: `01 - Projects/Flowti CLI/agents/tests/data/api-client.test.ts`

- [ ] **Step 1: Write failing tests**

Test that `sendMessage` formats the request correctly, `assignTask` includes the task and agentName, `grantPermission` sends the decision, `fetchWorldState` returns parsed JSON, and network errors are handled gracefully (return `{ ok: false, error }`).

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "01 - Projects/Flowti CLI/agents" && npx vitest run tests/data/api-client.test.ts
```

- [ ] **Step 3: Implement api-client.ts**

Each function wraps `fetch()` with proper URL, method, headers, and body. `fetchWorldState()` returns `WorldState | null`. Command functions (`sendMessage`, `assignTask`, `grantPermission`) return `{ ok: boolean; error?: string }`. `fetchAgent(name)` returns the entity or null. All functions catch network errors and return graceful fallbacks.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "01 - Projects/Flowti CLI/agents" && npx vitest run tests/data/api-client.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/data/api-client.ts" "01 - Projects/Flowti CLI/agents/tests/data/api-client.test.ts"
git commit -m "feat: add API client for game-to-CLI communication"
```

### Task 9: Event stream (SSE wrapper)

**Files:**
- Create: `01 - Projects/Flowti CLI/agents/src/data/event-stream.ts`
- Create: `01 - Projects/Flowti CLI/agents/tests/data/event-stream.test.ts`

- [ ] **Step 1: Write failing tests**

Test that `parseSSEMessage` extracts event type and data from an SSE message string. Test that `parseAgentAction` parses a valid JSON string into an `AgentAction`. Test that invalid JSON returns null. Test connection state tracking (connected/disconnected/reconnecting).

- [ ] **Step 2: Implement event-stream.ts**

Export `parseSSEMessage(raw: string): { event: string; data: string } | null` — pure parser. Export `parseAgentAction(json: string): AgentAction | null` — safe JSON parse. Export `createEventStream(url: string, onAction, onEntityUpdate, onStatusChange)` — wraps `EventSource`, handles reconnection with exponential backoff (1s, 2s, 4s, 8s, 16s, 30s cap), tracks connection status.

- [ ] **Step 3: Run tests**

```bash
cd "01 - Projects/Flowti CLI/agents" && npx vitest run tests/data/event-stream.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/data/event-stream.ts" "01 - Projects/Flowti CLI/agents/tests/data/event-stream.test.ts"
git commit -m "feat: add SSE event stream wrapper with reconnection"
```

---

## Chunk 4: Agent Brain — Pure State Machine

The brain is the core game logic. Pure functions, no ExcaliburJS dependency, fully unit testable.

### Task 10: Brain types

**Files:**
- Create: `01 - Projects/Flowti CLI/agents/src/brain/brain-types.ts`

- [ ] **Step 1: Define brain types**

```typescript
import type { AgentAttributes, AgentActionType } from "../data/types.js";

export type BrainState = "idle" | "wandering" | "walking-to" | "working" | "talking" | "waiting";

export interface BrainEvent {
	readonly type: AgentActionType;
	readonly data?: Record<string, unknown>;
}

export interface MovementTarget {
	readonly kind: "wander" | "workstation" | "agent" | "doorway" | "none";
	readonly x?: number;
	readonly y?: number;
	readonly targetId?: string;
}

export interface BrainResult {
	readonly state: BrainState;
	readonly target: MovementTarget;
}

export interface BrainConfig {
	readonly attributes: AgentAttributes;
	readonly personality?: readonly string[];
	readonly mood?: string;
}

/** Attribute-derived parameters for movement and behavior. */
export interface BrainParams {
	readonly speedMultiplier: number;     // DEX: 0.5 to 1.5
	readonly socialRadius: number;        // CHA: distance toward other agents
	readonly focusDuration: number;       // INT: ms at workstation before wandering
	readonly idleResistance: number;      // CON: ms before idle transition
	readonly quoteFrequency: number;      // WIS: ms between idle quotes
}
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/brain/brain-types.ts"
git commit -m "feat: add brain type definitions for agent state machine"
```

### Task 11: Agent brain state machine

**Files:**
- Create: `01 - Projects/Flowti CLI/agents/src/brain/agent-brain.ts`
- Create: `01 - Projects/Flowti CLI/agents/tests/brain/agent-brain.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from "vitest";
import { transition, computeParams } from "../../src/brain/agent-brain.js";
import type { BrainState, BrainEvent } from "../../src/brain/brain-types.js";

describe("transition", () => {
	it("idle + task-started → walking-to workstation", () => {
		const result = transition("idle", { type: "task-started" });
		expect(result.state).toBe("walking-to");
		expect(result.target.kind).toBe("workstation");
	});
	it("working + task-completed → idle", () => {
		const result = transition("working", { type: "task-completed" });
		expect(result.state).toBe("idle");
	});
	it("any + speaking → talking", () => {
		const result = transition("working", { type: "speaking" });
		expect(result.state).toBe("talking");
	});
	it("any + thinking → working", () => {
		const result = transition("idle", { type: "thinking" });
		expect(result.state).toBe("working");
	});
	it("any + asking → waiting", () => {
		const result = transition("working", { type: "asking" });
		expect(result.state).toBe("waiting");
	});
	it("waiting + permission-granted → working", () => {
		const result = transition("waiting", { type: "permission-granted" });
		expect(result.state).toBe("working");
	});
	it("waiting + permission-denied → idle", () => {
		const result = transition("waiting", { type: "permission-denied" });
		expect(result.state).toBe("idle");
	});
	it("unknown event stays in current state", () => {
		const result = transition("working", { type: "tool-complete" as any });
		expect(result.state).toBe("working");
	});
	it("idle + idle → idle (no-op)", () => {
		const result = transition("idle", { type: "idle" });
		expect(result.state).toBe("idle");
	});
});

describe("computeParams", () => {
	it("high DEX gives faster speed", () => {
		const params = computeParams({ str: 10, int: 10, wis: 10, cha: 10, dex: 20, con: 10 });
		expect(params.speedMultiplier).toBeGreaterThan(1.0);
	});
	it("low DEX gives slower speed", () => {
		const params = computeParams({ str: 10, int: 10, wis: 10, cha: 10, dex: 1, con: 10 });
		expect(params.speedMultiplier).toBeLessThan(1.0);
	});
	it("default attributes (dex=10) give mid-range speed", () => {
		const params = computeParams({});
		expect(params.speedMultiplier).toBeGreaterThan(0.9);
		expect(params.speedMultiplier).toBeLessThan(1.1);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "01 - Projects/Flowti CLI/agents" && npx vitest run tests/brain/agent-brain.test.ts
```

- [ ] **Step 3: Implement agent-brain.ts**

```typescript
import type { BrainState, BrainEvent, BrainResult, BrainParams, MovementTarget } from "./brain-types.js";
import type { AgentAttributes } from "../data/types.js";

const NO_MOVE: MovementTarget = { kind: "none" };
const TO_WORKSTATION: MovementTarget = { kind: "workstation" };

type TransitionFn = (event: BrainEvent) => BrainResult | null;

const TRANSITIONS: Record<string, TransitionFn> = {
	"task-started": () => ({ state: "walking-to", target: TO_WORKSTATION }),
	"task-completed": () => ({ state: "idle", target: NO_MOVE }),
	"speaking": () => ({ state: "talking", target: { kind: "agent" } }),
	"thinking": () => ({ state: "working", target: TO_WORKSTATION }),
	"asking": () => ({ state: "waiting", target: NO_MOVE }),
	"using-tool": () => ({ state: "working", target: TO_WORKSTATION }),
	"idle": () => ({ state: "idle", target: NO_MOVE }),
	"error": () => ({ state: "idle", target: NO_MOVE }),
};

const WAITING_OVERRIDES: Record<string, TransitionFn> = {
	"permission-granted": () => ({ state: "working", target: TO_WORKSTATION }),
	"permission-denied": () => ({ state: "idle", target: NO_MOVE }),
};

export function transition(current: BrainState, event: BrainEvent): BrainResult {
	if (current === "waiting") {
		const override = WAITING_OVERRIDES[event.type];
		if (override) return override(event)!;
	}
	const fn = TRANSITIONS[event.type];
	return fn?.(event) ?? { state: current, target: NO_MOVE };
}

const DEFAULT_ATTR = 10;
const MIN_SPEED = 0.5;
const MAX_SPEED = 1.5;

export function computeParams(attrs: AgentAttributes): BrainParams {
	const dex = attrs.dex ?? DEFAULT_ATTR;
	const cha = attrs.cha ?? DEFAULT_ATTR;
	const int = attrs.int ?? DEFAULT_ATTR;
	const con = attrs.con ?? DEFAULT_ATTR;
	const wis = attrs.wis ?? DEFAULT_ATTR;
	return {
		speedMultiplier: MIN_SPEED + ((dex - 1) / 19) * (MAX_SPEED - MIN_SPEED),
		socialRadius: 50 + (cha / 20) * 150,
		focusDuration: 5000 + (int / 20) * 25000,
		idleResistance: 3000 + (con / 20) * 17000,
		quoteFrequency: 30000 - (wis / 20) * 15000,
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "01 - Projects/Flowti CLI/agents" && npx vitest run tests/brain/agent-brain.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/brain/agent-brain.ts" "01 - Projects/Flowti CLI/agents/tests/brain/agent-brain.test.ts"
git commit -m "feat: implement pure agent brain state machine with attribute params"
```

### Task 12: Movement resolution

**Files:**
- Create: `01 - Projects/Flowti CLI/agents/src/brain/movement.ts`
- Create: `01 - Projects/Flowti CLI/agents/tests/brain/movement.test.ts`

- [ ] **Step 1: Write failing tests**

Test that `randomWanderPoint` returns coordinates within room bounds. Test that `nearestUnoccupied` picks the closest free workstation. Test that it returns null when all occupied. Test that `resolveAgentTarget` finds a target from the relationship graph.

- [ ] **Step 2: Implement movement.ts**

Pure functions: `randomWanderPoint(bounds, rng)`, `nearestUnoccupied(position, workstations)`, `resolveAgentTarget(relationships, agents)`. No ExcaliburJS imports.

- [ ] **Step 3: Run tests**

```bash
cd "01 - Projects/Flowti CLI/agents" && npx vitest run tests/brain/movement.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/brain/movement.ts" "01 - Projects/Flowti CLI/agents/tests/brain/movement.test.ts"
git commit -m "feat: add movement resolution for wander, workstation, and agent targets"
```

---

## Chunk 5: Game Actors

ExcaliburJS actors for the visual elements. These depend on ExcaliburJS and are verified manually — no automated tests.

### Task 13: Agent actor (rewrite)

**Files:**
- Move + Rewrite: `01 - Projects/Flowti CLI/agents/src/agent-actor.ts` → `01 - Projects/Flowti CLI/agents/src/actors/agent-actor.ts`

- [ ] **Step 1: Create actors directory and move file**

```bash
mkdir -p "01 - Projects/Flowti CLI/agents/src/actors"
mv "01 - Projects/Flowti CLI/agents/src/agent-actor.ts" "01 - Projects/Flowti CLI/agents/src/actors/agent-actor.ts"
```

- [ ] **Step 2: Rewrite agent-actor.ts**

Replace the circle-and-icon rendering with a humanoid silhouette. The actor receives a `DashboardAgent` and a `BrainState` reference. Drawing: head circle with mood face expression, body rectangle, limbs. Status color mapping: busy=green, idle=blue, unassigned=gray, waiting=amber. Persona name label below. AI/H badge above. Horizontal flip based on movement direction. The brain state drives which animation frame to show (working=typing loop, talking=face toward target, waiting=pulsing glow).

Key properties: `agentData: DashboardAgent`, `brainState: BrainState`, `facingLeft: boolean`. Methods: `updateFromBrain(state, target)`, `updateVisualStatus(status)`.

Click handler: `this.on("pointerdown", callback)` — fires a callback with the agent name for the panel system.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/actors/agent-actor.ts"
git commit -m "feat: rewrite agent actor with humanoid silhouette and brain integration"
```

### Task 14: Workstation, doorway, and bubble actors

**Files:**
- Create: `01 - Projects/Flowti CLI/agents/src/actors/workstation-actor.ts`
- Create: `01 - Projects/Flowti CLI/agents/src/actors/doorway-actor.ts`
- Create: `01 - Projects/Flowti CLI/agents/src/actors/bubble-actor.ts`

- [ ] **Step 1: Implement workstation-actor.ts**

Canvas-drawn desk/workbench/console based on setting type. Properties: `occupied: boolean`, `occupantName: string | null`, `toolName: string | null`. Visual: rectangle with surface, optional tool name label above when occupied. Methods: `occupy(agentName)`, `vacate()`, `showTool(name)`, `clearTool()`.

- [ ] **Step 2: Implement doorway-actor.ts**

Visual: arch shape with label (setting name). Click handler navigates to the target scene. Properties: `targetScene: string`, `label: string`. Glowing border effect to indicate it's interactive.

- [ ] **Step 3: Implement bubble-actor.ts**

Canvas-drawn speech/thought/question bubble. Types: `speech` (white, tail pointing down), `thought` (dim, small circles trail), `question` (amber, "?" inside). Properties: `text: string`, `kind: "speech" | "thought" | "question"`, `duration: number` (ms, default 5000). Auto-dismiss after duration. FIFO queue managed by bubble-system (max 3 per agent).

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/actors/workstation-actor.ts" "01 - Projects/Flowti CLI/agents/src/actors/doorway-actor.ts" "01 - Projects/Flowti CLI/agents/src/actors/bubble-actor.ts"
git commit -m "feat: add workstation, doorway, and bubble actors"
```

---

## Chunk 6: Scenes + Systems + Main

Build the four scenes (hub + 3 rooms), the three systems (brain, bubble, sync), and rewrite main.ts.

### Task 15: Hub scene

**Files:**
- Create: `01 - Projects/Flowti CLI/agents/src/scenes/hub-scene.ts`

- [ ] **Step 1: Implement hub-scene.ts**

Extends `ex.Scene`. On initialize: create three doorway actors (one per setting, positioned at edges), create an activity ticker label at the bottom, create an iteration badge. On data load: spawn agent actors for all agents (small scale, grouped loosely by domain). Methods: `updateAgents(agents, worldState)`, `updateTicker(activityLog)`. The hub shows ALL agents regardless of domain — it's the overview.

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/scenes/hub-scene.ts"
git commit -m "feat: add hub scene with doorways and activity ticker"
```

### Task 16: Room scenes (office, village, station)

**Files:**
- Create: `01 - Projects/Flowti CLI/agents/src/scenes/office-scene.ts`
- Create: `01 - Projects/Flowti CLI/agents/src/scenes/village-scene.ts`
- Create: `01 - Projects/Flowti CLI/agents/src/scenes/station-scene.ts`

- [ ] **Step 1: Create a base room pattern**

All three scenes share the same structure: background fill from theme, grid of workstations (4 columns), back-to-hub doorway, room title label. Each scene applies its `SceneTheme` from `settings.ts`. On initialize: create workstation actors, place a "Back" doorway. Methods: `spawnAgent(agent)`, `removeAgent(name)`, `getWorkstations()`.

- [ ] **Step 2: Implement office-scene.ts, village-scene.ts, station-scene.ts**

Each imports its theme from `SCENE_THEMES`, creates workstations with the appropriate type (desk/workbench/console), and applies the color scheme. The structure is identical — only the theme constants differ.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/scenes/office-scene.ts" "01 - Projects/Flowti CLI/agents/src/scenes/village-scene.ts" "01 - Projects/Flowti CLI/agents/src/scenes/station-scene.ts"
git commit -m "feat: add office, village, and station room scenes"
```

### Task 17: Systems (brain, bubble, sync)

**Files:**
- Create: `01 - Projects/Flowti CLI/agents/src/systems/brain-system.ts`
- Create: `01 - Projects/Flowti CLI/agents/src/systems/bubble-system.ts`
- Create: `01 - Projects/Flowti CLI/agents/src/systems/sync-system.ts`

- [ ] **Step 1: Implement brain-system.ts**

Called from scene `onPreUpdate`. Maintains a `Map<string, { state: BrainState; params: BrainParams; target: MovementTarget }>` per agent. Each frame: if agent is `wandering`/`walking-to`, move toward target at speed * `params.speedMultiplier`. If reached target, transition (wandering→idle, walking-to→working/talking). If idle long enough (`params.idleResistance`), start wandering. If at workstation long enough (`params.focusDuration`), start wandering.

- [ ] **Step 2: Implement bubble-system.ts**

Manages bubble actors per agent. `showBubble(agentName, kind, text, duration)` creates a `BubbleActor` attached above the agent. FIFO queue: max 3 per agent, oldest removed when 4th arrives. Auto-dismiss after duration (default 5000ms). Idle quotes: if agent brain is `idle`, periodically show a quote from personality traits (interval from `params.quoteFrequency`).

- [ ] **Step 3: Implement sync-system.ts**

Orchestrates the data layer. On creation: connect `EventStream` to `/events`, start 30s poll of `/api/world-state`. SSE events → `transition()` on the agent's brain → update actor visual. Poll results → `stateStore.applyState()` → spawn/despawn/update agents. Manages the "LIVE"/"POLLING" indicator. Also loads `agent-dashboard.json` once on boot for the initial agent roster.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/systems/brain-system.ts" "01 - Projects/Flowti CLI/agents/src/systems/bubble-system.ts" "01 - Projects/Flowti CLI/agents/src/systems/sync-system.ts"
git commit -m "feat: add brain, bubble, and sync systems"
```

### Task 18: Rewrite main.ts + delete old files

**Files:**
- Modify: `01 - Projects/Flowti CLI/agents/src/main.ts`
- Delete: `01 - Projects/Flowti CLI/agents/src/agent-scene.ts`
- Delete: `01 - Projects/Flowti CLI/agents/src/data-loader.ts`

- [ ] **Step 1: Rewrite main.ts**

Create engine with `DisplayMode.FitScreen`. Register four scenes: `hub` (default), `office`, `village`, `station`. Create the sync system, brain system, and bubble system. Load initial dashboard data, then start the engine. Wire scene navigation: doorway clicks call `engine.goToScene(targetScene)`.

- [ ] **Step 2: Delete old files**

```bash
rm "01 - Projects/Flowti CLI/agents/src/agent-scene.ts" "01 - Projects/Flowti CLI/agents/src/data-loader.ts"
```

- [ ] **Step 3: Build the game**

```bash
cd "01 - Projects/Flowti CLI/agents" && node build.mjs
```

Expected: Build succeeds, outputs `dashboard.js` to `.flowti/agents/`.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/main.ts"
git rm "01 - Projects/Flowti CLI/agents/src/agent-scene.ts" "01 - Projects/Flowti CLI/agents/src/data-loader.ts"
git commit -m "feat: rewrite main.ts with hub-and-rooms, delete old scene and data-loader"
```

---

## Chunk 7: UI Panels

HTML overlay panels for agent interaction. Pure DOM — no ExcaliburJS dependency. Testable with jsdom.

### Task 19: Panel manager

**Files:**
- Create: `01 - Projects/Flowti CLI/agents/src/ui/panel-manager.ts`
- Create: `01 - Projects/Flowti CLI/agents/src/ui/panel-styles.css`

- [ ] **Step 1: Implement panel-manager.ts**

Manages one panel at a time. Creates a `<div>` overlay positioned absolutely over the canvas. Methods: `open(agentName, screenX, screenY)` — creates the panel DOM, positions it, calls `agent-panel.ts` to render content. `close()` — removes the DOM element. `isOpen()` — returns boolean. `getAgentName()` — returns current agent or null. On scene switch: auto-close.

- [ ] **Step 2: Create panel-styles.css**

Dark theme CSS matching the game aesthetic. Panel background `#1e293b`, border `#334155`, text `#e2e8f0`. Tab buttons, input field, scrollable content area. Injected into the page via a `<style>` element on first panel open.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/ui/panel-manager.ts" "01 - Projects/Flowti CLI/agents/src/ui/panel-styles.css"
git commit -m "feat: add HTML overlay panel manager with dark theme styles"
```

### Task 20: Agent panel with tabs

**Files:**
- Create: `01 - Projects/Flowti CLI/agents/src/ui/agent-panel.ts`
- Create: `01 - Projects/Flowti CLI/agents/src/ui/talk-tab.ts`
- Create: `01 - Projects/Flowti CLI/agents/src/ui/tasks-tab.ts`
- Create: `01 - Projects/Flowti CLI/agents/src/ui/permissions-tab.ts`
- Create: `01 - Projects/Flowti CLI/agents/tests/ui/agent-panel.test.ts`
- Create: `01 - Projects/Flowti CLI/agents/tests/ui/talk-tab.test.ts`

- [ ] **Step 1: Implement agent-panel.ts**

Creates the panel DOM structure: header (name, type, close button), info section (attributes grid, mood, XP, status), tab bar (Info, Talk, Tasks, Permissions, History), content area. Tab switching swaps the content. Receives agent data from world state entity + dashboard agent.

- [ ] **Step 2: Implement talk-tab.ts**

Renders conversation thread (scrollable list of turns). Input field at bottom with send button. On send: calls `apiClient.sendMessage()`, immediately appends "You: ..." to thread (optimistic update). Receives SSE `speaking` events to append agent responses.

- [ ] **Step 3: Implement tasks-tab.ts**

Renders task list with status badges. "Assign Task" section shows `suggestedTasks` filtered by current iteration phase. Assign button calls `apiClient.assignTask()`. For AI agents, shows confirmation dialog first.

- [ ] **Step 4: Implement permissions-tab.ts**

Renders pending permission requests with Allow/Deny buttons. Grant history below. Allow calls `apiClient.grantPermission(name, tool, "allow")`. Deny calls with `"deny"`.

- [ ] **Step 5: Implement history-tab.ts**

Renders the recent activity log filtered to this agent. Reads `activityLog` from the world state, filters by `agentName`, and renders as a timestamped list. No API calls — data is local from the state store.

- [ ] **Step 6: Write panel tests (jsdom)**

Update `agents/vitest.config.ts` to use `environment: "jsdom"` for `tests/ui/**`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["tests/**/*.test.ts"],
		environmentMatchGlobs: [["tests/ui/**", "jsdom"]],
	},
});
```

Create `agents/tests/ui/agent-panel.test.ts`: test that panel creates a DOM element with all 5 tabs (Info, Talk, Tasks, Permissions, History), tab switching changes visible content, close button calls the close callback.

- [ ] **Step 7: Write talk-tab tests (jsdom)**

Create `agents/tests/ui/talk-tab.test.ts`: test that `renderTalkTab` creates input field and send button. Test that calling send appends a user turn. Test that `appendAgentResponse` adds the agent's response.

- [ ] **Step 8: Write tasks-tab tests (jsdom)**

Create `agents/tests/ui/tasks-tab.test.ts`: test that task list renders with status badges. Test that assign button fires callback with task name. Test phase filtering — tasks with `phases: ["in-progress"]` are hidden when current phase is `"planned"`. Test that tasks with empty `phases` array are always shown. Test AI confirmation dialog appears for AI agents.

- [ ] **Step 9: Write permissions-tab tests (jsdom)**

Create `agents/tests/ui/permissions-tab.test.ts`: test that pending permissions render with Allow/Deny buttons. Test Allow button fires callback with `decision: "allow"`. Test Deny fires with `decision: "deny"`. Test grant history renders with tool name, scope, and timestamp.

- [ ] **Step 10: Run tests**

```bash
cd "01 - Projects/Flowti CLI/agents" && npx vitest run tests/ui/
```

- [ ] **Step 11: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/ui/" "01 - Projects/Flowti CLI/agents/tests/ui/" "01 - Projects/Flowti CLI/agents/vitest.config.ts"
git commit -m "feat: add agent panel with talk, tasks, permissions, and history tabs"
```

---

## Chunk 8: Integration + Verification

Wire everything together, build, and verify manually.

### Task 21: Wire panels to actors and sync system

**Files:**
- Modify: `01 - Projects/Flowti CLI/agents/src/main.ts`
- Modify: `01 - Projects/Flowti CLI/agents/src/systems/sync-system.ts`

- [ ] **Step 1: Connect click-to-interact**

In `main.ts`, create a `PanelManager` instance. Pass an `onAgentClick` callback to each scene that calls `panelManager.open(agentName, screenX, screenY)`. The panel manager uses the sync system's state store to get agent data.

- [ ] **Step 2: Connect SSE to panels**

In `sync-system.ts`, when a `speaking` action arrives for the agent whose panel is open, call `talkTab.appendAgentResponse(text)`. When `requesting-permission` arrives, auto-open the panel to the Permissions tab if the user is in the same room.

- [ ] **Step 3: Build and test manually**

```bash
cd "01 - Projects/Flowti CLI/agents" && node build.mjs
```

Then start the server from the CLI: `flowti serve`. Open the browser, navigate rooms, click agents, verify panels open with correct data.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/main.ts" "01 - Projects/Flowti CLI/agents/src/systems/sync-system.ts"
git commit -m "feat: wire panel interaction to actors and sync system"
```

### Task 22: Run all game tests

- [ ] **Step 1: Run all game tests**

```bash
cd "01 - Projects/Flowti CLI/agents" && npx vitest run
```

Expected: All tests pass (brain, data, config, UI).

- [ ] **Step 2: Run all CLI tests**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts
```

Expected: All tests pass. No regressions from CLI-side changes.

- [ ] **Step 3: Type check CLI**

```bash
cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json
```

- [ ] **Step 4: Build game**

```bash
cd "01 - Projects/Flowti CLI/agents" && node build.mjs
```

- [ ] **Step 5: Commit final state**

```bash
git add -A
git commit -m "feat: Excalibur RPG environment — iteration 5 Phase B complete"
```
