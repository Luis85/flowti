# Agent Worker Architecture Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ephemeral agent processes with persistent reactive workers managed by a WorkerManager supervisor, with a unified `send()` interface and perception-decision-action pipeline.

**Architecture:** Agent workers are in-memory objects with event subscriptions. The WorkerManager fans out world state events, workers evaluate rules, and execute actions via LLM (process runner), decision tree, or static response. The agent shell is replaced by a lightweight process runner + worker manager.

**Tech Stack:** TypeScript, Node.js built-ins, Vitest

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-15-agent-worker-architecture-design.md`

---

## File Structure

### New files (7 source + 5 test)

| File | Responsibility |
|------|---------------|
| `src/domain/agents/worker-types.ts` | Worker, EventFilter, DecisionRule, SendOptions, ActionContext types |
| `src/infrastructure/agent-process-runner.ts` | `IAgentProcessRunner` — pure LLM process spawner (extracted from agent-shell) |
| `src/domain/agents/decision-engine.ts` | `evaluateDecision()` — rule matching, built-in rules |
| `src/domain/agents/action-handlers.ts` | Action execution backends: executeTask, respond, respondFromState, acknowledge |
| `src/infrastructure/worker-manager.ts` | `IWorkerManager` — spawn, stop, event fan-out, send routing, respawn |
| `tests/infrastructure/agent-process-runner.test.ts` | Process runner tests |
| `tests/domain/agents/decision-engine.test.ts` | Decision engine tests |
| `tests/domain/agents/action-handlers.test.ts` | Action handler tests |
| `tests/infrastructure/worker-manager.test.ts` | Worker manager tests |

### Modified files (7)

| File | Change |
|------|--------|
| `src/infrastructure/types.ts` | Add `IWorkerManager`, `IAgentProcessRunner` interfaces |
| `src/infrastructure/deps.ts` | Add `workerManager` + `processRunner` to CliDeps. Keep `agentShell` temporarily for backward compat. |
| `src/infrastructure/world-state-manager.ts` | Add event dispatch hook for worker manager |
| `src/main.ts` | Bootstrap worker manager, spawnAll on start, stopAll on exit |
| `src/ui/menus/agents-interact-menu.ts` | Use `workerManager.send()` instead of `agentShell.talk()` |
| `src/ui/menus/roster-task-menu.ts` | Use `workerManager.send()` instead of `agentShell.dispatch()` |
| `src/ui/handlers/extensibility-handlers.ts` | All agent actions through `workerManager.send()` |

---

## Chunk 1: Types + Process Runner

### Task 1: Create worker-types.ts

**Files:**
- Create: `src/domain/agents/worker-types.ts`

- [ ] **Step 1: Write all type definitions**

```typescript
/**
 * worker-types.ts — Types for the agent worker system.
 */

import type { AgentSummary } from "./agent-types.js";
import type { AgentStreamEvent } from "./agent-stream.js";
import type { AgentResponse } from "./agent-conversation.js";

export type WorkerState = "spawning" | "idle" | "reacting" | "thinking" | "working" | "waiting" | "stopped";

export interface EventFilter {
	readonly entityType?: import("./world-state-types.js").WorldEntityType;
	readonly entityId?: string;
	readonly componentChanged?: string;
	readonly actionType?: import("./world-state-types.js").AgentActionType;
}

export interface DecisionRule {
	readonly trigger: string;
	readonly condition?: string;
	readonly action: string;
	readonly priority: number;
}

export interface SendOptions {
	readonly foreground?: boolean;
	readonly task?: string;
	readonly briefPath?: string;
	readonly onEvent?: (event: AgentStreamEvent) => void;
	readonly onResponse?: (response: AgentResponse) => void;
}

export interface ActionContext {
	readonly trigger: string;
	readonly message?: string;
	readonly task?: string;
	readonly briefPath?: string;
	readonly event?: import("./world-state-types.js").AgentAction;
	readonly foreground: boolean;
}

export interface AgentProcess {
	onEvent(callback: (event: AgentStreamEvent) => void): () => void;
	readonly result: Promise<{ text: string; thinking: string; exitCode: number }>;
	kill(): void;
}

export interface IAgentProcessRunner {
	spawn(agent: AgentSummary, prompt: string): AgentProcess;
}

export interface AgentWorker {
	readonly name: string;
	readonly agent: AgentSummary;
	readonly state: WorkerState;
	readonly messageQueue: readonly string[];
	send(message: string, opts?: SendOptions): void;
	stop(): void;
}

export interface IWorkerManager {
	spawnAll(): void;
	spawn(agentName: string): AgentWorker | null;
	stop(agentName: string): void;
	stopAll(): void;
	getWorker(agentName: string): AgentWorker | null;
	listWorkers(): AgentWorker[];
	send(agentName: string, message: string, opts?: SendOptions): void;
	dispatchWorldEvent(event: import("./world-state-types.js").AgentAction): void;
}
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/worker-types.ts"
git commit -m "feat: add worker types — WorkerState, EventFilter, DecisionRule, IWorkerManager"
```

### Task 2: Extract agent-process-runner.ts from agent-shell.ts

**Files:**
- Create: `src/infrastructure/agent-process-runner.ts`
- Create: `tests/infrastructure/agent-process-runner.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../src/infrastructure/shell.js", () => ({ shell: {} }));
vi.mock("../../src/infrastructure/paths.js", () => ({ paths: {} }));
vi.mock("../../src/infrastructure/clock.js", () => ({ clock: {} }));
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));

import { createProcessRunner } from "../../src/infrastructure/agent-process-runner.js";
import type { AgentSummary } from "../../src/domain/agents/agent-types.js";

function makeDeps() {
	const outputCallbacks: Array<(line: string) => void> = [];
	const mockProc = {
		waitForExit: vi.fn(() => new Promise<number>((resolve) => { setTimeout(() => resolve(0), 10); })),
		onOutput: vi.fn((cb: (line: string) => void) => { outputCallbacks.push(cb); return () => {}; }),
		kill: vi.fn(),
		running: true,
		output: [],
	};
	return {
		disk: { writeFileSync: vi.fn(), unlinkSync: vi.fn(), existsSync: vi.fn(() => true), mkdirSync: vi.fn() } as never,
		paths: { join: vi.fn((...a: string[]) => a.join("/")), resolve: vi.fn((...a: string[]) => a.join("/")) } as never,
		clock: { ms: vi.fn(() => 1234), iso: vi.fn(() => "2026-03-15T12:00:00Z") } as never,
		shell: { spawnBackground: vi.fn(() => mockProc) } as never,
		log: vi.fn(),
		_mockProc: mockProc,
		_outputCallbacks: outputCallbacks,
	};
}

function makeAgent(overrides?: Partial<AgentSummary>): AgentSummary {
	return { name: "Bob", agentType: "ai", description: "", skills: [], tools: [], roles: [], file: "bob.md", ...overrides };
}

describe("createProcessRunner", () => {
	it("spawn creates a process and returns AgentProcess", () => {
		const deps = makeDeps();
		const runner = createProcessRunner(deps, undefined);
		const proc = runner.spawn(makeAgent(), "Hello");
		expect(proc).toHaveProperty("onEvent");
		expect(proc).toHaveProperty("result");
		expect(proc).toHaveProperty("kill");
	});

	it("writes prompt to temp file", () => {
		const deps = makeDeps();
		const runner = createProcessRunner(deps, undefined);
		runner.spawn(makeAgent(), "Hello world");
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
			expect.stringContaining(".flowti-prompt-"),
			"Hello world",
			"utf-8",
		);
	});

	it("spawns claude binary by default", () => {
		const deps = makeDeps();
		const runner = createProcessRunner(deps, undefined);
		runner.spawn(makeAgent(), "Hello");
		expect(deps.shell.spawnBackground).toHaveBeenCalledWith(
			expect.stringContaining("claude"),
		);
	});

	it("result resolves with text and exit code", async () => {
		const deps = makeDeps();
		const runner = createProcessRunner(deps, undefined);
		const proc = runner.spawn(makeAgent(), "Hello");
		// Simulate text output
		for (const cb of deps._outputCallbacks) {
			cb(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Hi there!" }] } }));
		}
		const result = await proc.result;
		expect(result.exitCode).toBe(0);
	});

	it("kill stops the process", () => {
		const deps = makeDeps();
		const runner = createProcessRunner(deps, undefined);
		const proc = runner.spawn(makeAgent(), "Hello");
		proc.kill();
		expect(deps._mockProc.kill).toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Implement agent-process-runner.ts**

Extract the core process spawning from agent-shell.ts into a clean, focused module:

```typescript
/**
 * agent-process-runner.ts — Pure LLM process spawner.
 *
 * Spawns Claude CLI processes, streams events, returns results.
 * No lifecycle management, no notifications, no state — just process I/O.
 */

import type { CliDeps } from "./deps.js";
import type { AgentsConfig } from "./types-config.js";
import type { AgentSummary } from "../domain/agents/agent-types.js";
import type { AgentStreamEvent } from "../domain/agents/agent-stream.js";
import type { AgentProcess, IAgentProcessRunner } from "../domain/agents/worker-types.js";
import { parseStreamLine, createStreamState, updateStreamState } from "../domain/agents/agent-stream.js";

export type ProcessRunnerDeps = Pick<CliDeps, "disk" | "paths" | "clock" | "shell" | "log">;

function resolveProvider(globalDefault?: string, agentProvider?: string): { binary: string; args: readonly string[] } {
	const provider = agentProvider ?? globalDefault ?? "anthropic";
	switch (provider) {
		case "anthropic": return { binary: "claude", args: ["-p", "--output-format", "stream-json", "--verbose"] };
		case "cursor": return { binary: "cursor", args: ["--print", "--json"] };
		default: return { binary: provider, args: ["-p"] };
	}
}

let idCounter = 0;

export function createProcessRunner(deps: ProcessRunnerDeps, config: AgentsConfig | undefined): IAgentProcessRunner {
	const globalProvider = config?.provider;
	const processTimeout = config?.processTimeoutMs ?? 3_600_000;

	return {
		spawn(agent: AgentSummary, prompt: string): AgentProcess {
			const provider = resolveProvider(globalProvider, agent.ai?.provider);
			const tempPath = deps.paths.join(deps.paths.resolve("."), `.flowti-prompt-${deps.clock.ms()}-${++idCounter}.tmp`);
			deps.disk.writeFileSync(tempPath, prompt, "utf-8");

			const args = [...provider.args];
			if (agent.ai?.allowedTools && agent.ai.allowedTools.length > 0) {
				args.push("--allowedTools", agent.ai.allowedTools.join(","));
			}
			const quotedPath = `"${tempPath}"`;
			const cmd = [provider.binary, ...args.map((a) => String(a).includes(" ") ? `"${String(a)}"` : String(a))].join(" ") + ` < ${quotedPath}`;

			const proc = deps.shell.spawnBackground(cmd);
			const exitPromise = proc.waitForExit(processTimeout);

			let streamState = createStreamState();
			const textBuffer: string[] = [];
			const thinkingBuffer: string[] = [];
			const subscribers = new Set<(event: AgentStreamEvent) => void>();

			proc.onOutput((line: string) => {
				streamState = updateStreamState(streamState, line);
				const event = parseStreamLine(line, streamState);
				if (!event) return;
				if (event.kind === "thinking") thinkingBuffer.push(event.text);
				if (event.kind === "text") textBuffer.push(event.text);
				for (const cb of subscribers) { try { cb(event); } catch { /* */ } }
			});

			return {
				onEvent(callback) { subscribers.add(callback); return () => subscribers.delete(callback); },
				result: exitPromise.then((exitCode) => {
					try { deps.disk.unlinkSync(tempPath); } catch { /* */ }
					return { text: textBuffer.join(""), thinking: thinkingBuffer.join(""), exitCode };
				}).catch((err) => {
					proc.kill();
					try { deps.disk.unlinkSync(tempPath); } catch { /* */ }
					return { text: "", thinking: "", exitCode: 1 };
				}),
				kill() { proc.kill(); try { deps.disk.unlinkSync(tempPath); } catch { /* */ } },
			};
		},
	};
}
```

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/agent-process-runner.test.ts --config configs/vitest.config.ts`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/agent-process-runner.ts" "01 - Projects/Flowti CLI/tests/infrastructure/agent-process-runner.test.ts"
git commit -m "feat: extract agent-process-runner from agent-shell"
```

---

## Chunk 2: Decision Engine + Action Handlers

### Task 3: Create decision-engine.ts

**Files:**
- Create: `src/domain/agents/decision-engine.ts`
- Create: `tests/domain/agents/decision-engine.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect } from "vitest";
import { evaluateDecision, LLM_RULES, NPC_RULES } from "../../../src/domain/agents/decision-engine.js";
import type { DecisionRule } from "../../../src/domain/agents/worker-types.js";

describe("evaluateDecision", () => {
	it("matches task-assigned trigger to execute-task", () => {
		const result = evaluateDecision("task-assigned", LLM_RULES);
		expect(result).toBe("execute-task");
	});

	it("matches message-received to respond", () => {
		const result = evaluateDecision("message-received", LLM_RULES);
		expect(result).toBe("respond");
	});

	it("returns null when no rule matches", () => {
		const result = evaluateDecision("unknown-trigger", LLM_RULES);
		expect(result).toBeNull();
	});

	it("picks highest priority when multiple rules match", () => {
		const rules: DecisionRule[] = [
			{ trigger: "test", action: "low", priority: 1 },
			{ trigger: "test", action: "high", priority: 10 },
		];
		expect(evaluateDecision("test", rules)).toBe("high");
	});

	it("NPC rules return respond-from-state for messages", () => {
		const result = evaluateDecision("message-received", NPC_RULES);
		expect(result).toBe("respond-from-state");
	});

	it("NPC rules return acknowledge for tasks", () => {
		const result = evaluateDecision("task-assigned", NPC_RULES);
		expect(result).toBe("acknowledge");
	});
});
```

- [ ] **Step 2: Implement decision-engine.ts**

```typescript
/**
 * decision-engine.ts — Rule-based decision engine for agent workers.
 *
 * Pure functions. Evaluates trigger against rules, returns action or null.
 */

import type { DecisionRule } from "./worker-types.js";

export const LLM_RULES: readonly DecisionRule[] = [
	{ trigger: "task-assigned", action: "execute-task", priority: 10 },
	{ trigger: "message-received", action: "respond", priority: 10 },
	{ trigger: "question-received", action: "respond", priority: 10 },
	{ trigger: "iteration-changed", action: "review", priority: 5 },
	{ trigger: "agent-mentioned", action: "review", priority: 3 },
];

export const NPC_RULES: readonly DecisionRule[] = [
	{ trigger: "message-received", action: "respond-from-state", priority: 10 },
	{ trigger: "task-assigned", action: "acknowledge", priority: 10 },
];

export function evaluateDecision(trigger: string, rules: readonly DecisionRule[]): string | null {
	const matches = rules.filter((r) => r.trigger === trigger);
	if (matches.length === 0) return null;
	const best = matches.reduce((a, b) => a.priority >= b.priority ? a : b);
	return best.action;
}

export function getRulesForAgent(hasLLM: boolean): readonly DecisionRule[] {
	return hasLLM ? LLM_RULES : NPC_RULES;
}
```

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/decision-engine.test.ts --config configs/vitest.config.ts`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/decision-engine.ts" "01 - Projects/Flowti CLI/tests/domain/agents/decision-engine.test.ts"
git commit -m "feat: add decision engine with LLM and NPC rule sets"
```

### Task 4: Create action-handlers.ts

**Files:**
- Create: `src/domain/agents/action-handlers.ts`
- Create: `tests/domain/agents/action-handlers.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({ RESET: "", DIM: "", GREEN: "", CYAN: "", BOLD: "" }));

import { respondFromState, buildTaskPrompt, buildResponsePrompt } from "../../../src/domain/agents/action-handlers.js";

describe("respondFromState", () => {
	it("returns agent status and task info", () => {
		const components = { status: { state: "idle" }, tasks: { items: [] }, identity: { persona: "Bobby" } };
		const result = respondFromState("Bob", components);
		expect(result).toContain("Bobby");
		expect(result).toContain("idle");
	});

	it("includes pending tasks", () => {
		const components = { status: { state: "busy" }, tasks: { items: [{ name: "Fix bug", status: "pending" }] } };
		const result = respondFromState("Bob", components);
		expect(result).toContain("Fix bug");
	});
});

describe("buildTaskPrompt", () => {
	it("includes task name in prompt", () => {
		const prompt = buildTaskPrompt("Bob", "Fix the login bug", null, undefined);
		expect(prompt).toContain("Fix the login bug");
	});

	it("includes system prompt when provided", () => {
		const prompt = buildTaskPrompt("Bob", "Fix bug", "You are a developer.", undefined);
		expect(prompt).toContain("You are a developer.");
	});
});

describe("buildResponsePrompt", () => {
	it("includes message in prompt", () => {
		const prompt = buildResponsePrompt("Bob", "What is TypeScript?", null, undefined, []);
		expect(prompt).toContain("What is TypeScript?");
	});

	it("includes conversation history", () => {
		const history = [{ role: "user" as const, content: "Hi" }, { role: "agent" as const, content: "Hello!" }];
		const prompt = buildResponsePrompt("Bob", "How are you?", null, undefined, history);
		expect(prompt).toContain("Hi");
		expect(prompt).toContain("Hello!");
	});
});
```

- [ ] **Step 2: Implement action-handlers.ts**

```typescript
/**
 * action-handlers.ts — Execution backends for agent worker actions.
 *
 * Pure functions that build prompts or generate static responses.
 * The worker calls these, then spawns LLM processes or returns directly.
 */

import { buildConversationPrompt } from "./agent-conversation.js";
import type { AgentCharacter, ConversationTurn } from "./agent-conversation.js";
import type { AgentSummary } from "./agent-types.js";

export function buildCharacter(agent: AgentSummary): AgentCharacter {
	return {
		description: agent.description, persona: agent.persona,
		mood: agent.mood, personality: agent.personality,
		attributes: agent.attributes, experience: agent.experience,
	};
}

export function buildTaskPrompt(agentName: string, task: string, systemPrompt: string | null, character: AgentCharacter | undefined): string {
	return buildConversationPrompt(agentName, systemPrompt, [], task, character);
}

export function buildResponsePrompt(agentName: string, message: string, systemPrompt: string | null, character: AgentCharacter | undefined, history: readonly ConversationTurn[]): string {
	return buildConversationPrompt(agentName, systemPrompt, history, message, character);
}

export function respondFromState(agentName: string, components: Record<string, unknown>): string {
	const status = components.status as { state?: string } | undefined;
	const tasks = components.tasks as { items?: Array<{ name: string; status: string }> } | undefined;
	const identity = components.identity as { persona?: string } | undefined;
	const name = identity?.persona ?? agentName;
	const lines: string[] = [];
	lines.push(`I'm ${name}. My current state is ${status?.state ?? "unknown"}.`);
	const pending = tasks?.items?.filter((t) => t.status !== "done") ?? [];
	if (pending.length > 0) {
		lines.push(`I have ${pending.length} task${pending.length > 1 ? "s" : ""}:`);
		for (const t of pending) lines.push(`- ${t.name} [${t.status}]`);
	} else {
		lines.push("I have no pending tasks.");
	}
	return lines.join("\n");
}

export function acknowledge(agentName: string, task: string): string {
	return `Task "${task}" acknowledged. I'll work on it.`;
}
```

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/action-handlers.test.ts --config configs/vitest.config.ts`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/action-handlers.ts" "01 - Projects/Flowti CLI/tests/domain/agents/action-handlers.test.ts"
git commit -m "feat: add action handlers — buildTaskPrompt, respondFromState, acknowledge"
```

---

## Chunk 3: Worker Manager

### Task 5: Add interfaces to types.ts and deps.ts

**Files:**
- Modify: `src/infrastructure/types.ts`
- Modify: `src/infrastructure/deps.ts`

- [ ] **Step 1: Add re-exports to types.ts**

After the existing world-state re-exports, add:

```typescript
export type { IWorkerManager, IAgentProcessRunner, AgentWorker, AgentProcess, WorkerState, SendOptions, EventFilter, DecisionRule, ActionContext } from "../domain/agents/worker-types.js";
```

- [ ] **Step 2: Add to CliDeps**

Add to deps.ts CliDeps interface:

```typescript
readonly workerManager: IWorkerManager;
readonly processRunner: IAgentProcessRunner;
```

Import the types:
```typescript
import type { IFileSystem, IShell, IPaths, IClock, IProcess, IInput, IAgentShell, IWorldStateManager, IWorkerManager, IAgentProcessRunner } from "./types.js";
```

Note: Keep `agentShell` temporarily — existing code still references it. It will be removed in a follow-up cleanup pass.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/types.ts" "01 - Projects/Flowti CLI/src/infrastructure/deps.ts"
git commit -m "feat: add IWorkerManager and IAgentProcessRunner to CliDeps"
```

### Task 6: Implement worker-manager.ts

**Files:**
- Create: `src/infrastructure/worker-manager.ts`
- Create: `tests/infrastructure/worker-manager.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../src/infrastructure/paths.js", () => ({ paths: {} }));
vi.mock("../../src/infrastructure/clock.js", () => ({ clock: {} }));
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/domain/agents/agent-store.js", () => ({
	listAgents: vi.fn(() => []),
	readSystemPrompt: vi.fn(() => null),
}));

import { createWorkerManager } from "../../src/infrastructure/worker-manager.js";
import { listAgents } from "../../src/domain/agents/agent-store.js";
import type { AgentSummary } from "../../src/domain/agents/agent-types.js";

const mockAgent: AgentSummary = { name: "Bob", agentType: "ai", description: "Helper", skills: [], tools: [], roles: [], file: "bob.md" };

function makeDeps() {
	return {
		disk: { readFileSync: vi.fn(), writeFileSync: vi.fn(), existsSync: vi.fn(() => false), mkdirSync: vi.fn(), readdirSync: vi.fn(() => []) } as never,
		paths: { join: vi.fn((...a: string[]) => a.join("/")), resolve: vi.fn((...a: string[]) => a.join("/")) } as never,
		clock: { ms: vi.fn(() => 1234), iso: vi.fn(() => "2026-03-15T12:00:00Z"), now: vi.fn(() => new Date()), safeIso: vi.fn(() => "2026-03-15") } as never,
		shell: { spawnBackground: vi.fn() } as never,
		log: vi.fn(),
	};
}

function makeWorldState() {
	return {
		emitAction: vi.fn(),
		updateEntity: vi.fn(),
		getState: vi.fn(() => ({ version: 1, updatedAt: "", entities: {}, permissions: {}, activityLog: [] })),
		getEntity: vi.fn(() => null),
		flush: vi.fn(),
	};
}

function makeProcessRunner() {
	return { spawn: vi.fn(() => ({ onEvent: vi.fn(() => () => {}), result: Promise.resolve({ text: "Hi", thinking: "", exitCode: 0 }), kill: vi.fn() })) };
}

describe("WorkerManager", () => {
	it("spawnAll creates workers from agent definitions", () => {
		vi.mocked(listAgents).mockReturnValue([mockAgent]);
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), makeProcessRunner(), "/vault", undefined);
		mgr.spawnAll();
		expect(mgr.listWorkers()).toHaveLength(1);
		expect(mgr.getWorker("Bob")).not.toBeNull();
	});

	it("send routes message to worker", () => {
		vi.mocked(listAgents).mockReturnValue([mockAgent]);
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), makeProcessRunner(), "/vault", undefined);
		mgr.spawnAll();
		mgr.send("Bob", "Hello", { foreground: false });
		// Worker should transition from idle
	});

	it("getWorker returns null for unknown agent", () => {
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), makeProcessRunner(), "/vault", undefined);
		mgr.spawnAll();
		expect(mgr.getWorker("Unknown")).toBeNull();
	});

	it("stopAll stops all workers", () => {
		vi.mocked(listAgents).mockReturnValue([mockAgent]);
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), makeProcessRunner(), "/vault", undefined);
		mgr.spawnAll();
		mgr.stopAll();
		const worker = mgr.getWorker("Bob");
		expect(worker?.state).toBe("stopped");
	});

	it("dispatchWorldEvent fans out to matching workers", () => {
		vi.mocked(listAgents).mockReturnValue([mockAgent]);
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), makeProcessRunner(), "/vault", undefined);
		mgr.spawnAll();
		mgr.dispatchWorldEvent({ id: "a1", agentName: "Bob", timestamp: "t", type: "task-started", data: { task: "Build" } });
		// Worker should react if subscribed
	});
});
```

- [ ] **Step 2: Implement worker-manager.ts**

This is the core module. It creates workers from agent definitions, manages their lifecycle, routes messages, and fans out world state events. Each worker runs the perception → decision → action pipeline.

Key implementation details:
- Workers are plain objects in a `Map<string, WorkerImpl>`
- `WorkerImpl` has state machine: idle → reacting → thinking → working → idle
- `send()` pushes to worker's message queue if busy, processes immediately if idle
- `dispatchWorldEvent()` iterates workers, checks subscriptions, triggers pipeline
- LLM actions call `processRunner.spawn()`, await result, parse response, emit actions
- Cycle protection: skip originating agent when fanning out their own actions
- Respawn: 3 consecutive failures → stopped state

The implementer should read `src/infrastructure/agent-shell.ts` for the existing patterns (stream event handling, inbox notes, state updates) and port the relevant parts into the worker's action execution.

The file should be under 350 lines. If it exceeds, extract the worker state machine into a separate `agent-worker-impl.ts`.

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/worker-manager.test.ts --config configs/vitest.config.ts`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/worker-manager.ts" "01 - Projects/Flowti CLI/tests/infrastructure/worker-manager.test.ts"
git commit -m "feat: implement worker manager with spawn, send, and event fan-out"
```

---

## Chunk 4: Bootstrap + World State Hook

### Task 7: Hook world state into worker manager

**Files:**
- Modify: `src/infrastructure/world-state-manager.ts`

- [ ] **Step 1: Add dispatch hook**

The world state manager needs to notify the worker manager when state changes. Add an `onAction` callback:

In `createWorldStateManager`, add a callback field:

```typescript
let actionCallback: ((action: AgentAction) => void) | null = null;
```

In `emitAction`, after updating state and scheduling write, call:

```typescript
if (actionCallback) actionCallback(action);
```

Add a method to set the callback:

```typescript
setActionCallback(callback: (action: AgentAction) => void): void {
	actionCallback = callback;
},
```

Add `setActionCallback` to the `IWorldStateManager` interface in `world-state-types.ts`.

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/world-state-manager.ts" "01 - Projects/Flowti CLI/src/domain/agents/world-state-types.ts"
git commit -m "feat: add action callback hook to world state manager"
```

### Task 8: Bootstrap worker manager in deps and main

**Files:**
- Modify: `src/infrastructure/deps.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Update createDefaultDeps**

Import `createProcessRunner` and `createWorkerManager`:

```typescript
import { createProcessRunner } from "./agent-process-runner.js";
import { createWorkerManager } from "./worker-manager.js";
```

Update `createDefaultDeps`:

```typescript
export function createDefaultDeps(agentsConfig?: AgentsConfig, vaultRoot?: string): CliDeps {
	const bus = createCliBus();
	attachCliRenderer(bus);
	const resolvedRoot = vaultRoot ?? ".";
	const worldState = createWorldStateManager({ disk, paths, clock }, resolvedRoot);
	const processRunner = createProcessRunner({ disk, paths, clock, shell, log }, agentsConfig);
	const workerManager = createWorkerManager({ disk, paths, clock, shell, log }, worldState, processRunner, resolvedRoot, agentsConfig);
	const baseDeps = { disk, shell, paths, clock, log };
	const agentShell = createAgentShell(baseDeps, agentsConfig, resolvedRoot, worldState);
	// Hook world state events to worker manager
	worldState.setActionCallback((action) => workerManager.dispatchWorldEvent(action));
	return { disk, shell, paths, clock, proc, input, bus, log, warn, agentShell, worldState, workerManager, processRunner };
}
```

- [ ] **Step 2: Update main.ts**

After `initializeDeps(deps)` and reconciliation, add:

```typescript
deps.workerManager.spawnAll();
```

Before `proc.exit(0)`, add:

```typescript
deps.workerManager.stopAll();
```

- [ ] **Step 3: Verify type-check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/deps.ts" "01 - Projects/Flowti CLI/src/main.ts"
git commit -m "feat: bootstrap worker manager in deps and main"
```

---

## Chunk 5: Wire UI to Worker Manager

### Task 9: Update menus to use workerManager.send()

**Files:**
- Modify: `src/ui/handlers/extensibility-handlers.ts`

- [ ] **Step 1: Update agents:talk handler**

Change from using `talkToAgentInteractive` to `workerManager.send()`:

Find the `agents:talk` handler. Replace the talkToAgentInteractive call with:

```typescript
const answer = await ctx.deps.input.ask(`  You`);
if (answer) {
	ctx.deps.workerManager.send(agent.name, answer, { foreground: true });
}
```

Note: The full talk loop (multi-turn conversation) still needs the existing `talkToAgentInteractive` for now. The worker `send()` handles single-turn. Keep the existing flow but add `workerManager.send()` as an alternative path for quick questions from the bottom bar.

Actually — don't change the existing talk flow yet. The worker architecture is the foundation; the UI migration is a gradual process. For this task, just ensure the worker manager is accessible via `ctx.deps.workerManager` and add a new handler for the bottom bar's `Ask Agent` action.

- [ ] **Step 2: Add mock to test files**

Add `workerManager` and `processRunner` to all mock deps in test files that construct `CliDeps`:
- `tests/ui/handlers/extensibility-handlers.test.ts`
- `tests/ui/handlers/register-handlers.test.ts`
- Any other test file that fails type-check

```typescript
workerManager: { spawnAll: vi.fn(), spawn: vi.fn(), stop: vi.fn(), stopAll: vi.fn(), getWorker: vi.fn(() => null), listWorkers: vi.fn(() => []), send: vi.fn(), dispatchWorldEvent: vi.fn() },
processRunner: { spawn: vi.fn() },
```

- [ ] **Step 3: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`

- [ ] **Step 4: Run lint**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/ --config configs/eslint.config.mjs`

- [ ] **Step 5: Build**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`

- [ ] **Step 6: Commit**

```bash
git add -u
git commit -m "feat: wire worker manager into UI handlers and fix test mocks"
```

### Task 10: Full verification

- [ ] **Step 1: Full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npm test`

- [ ] **Step 2: Build**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`

- [ ] **Step 3: Manual smoke test**

Run `.\flowti.cmd`:
- Workers should spawn on startup (check log for any errors)
- `flowti state` should show agent entities in world state
- Existing agent interactions (Talk, Assign Task) should still work via agentShell
- Worker manager is bootstrapped alongside agentShell (both work in parallel during migration)
