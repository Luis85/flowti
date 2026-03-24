# Task Dispatcher Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a centralized push-based task scheduler that routes tasks to agents via capability filter, trust gate, and affinity scoring.

**Architecture:** Domain-pure `TaskDispatcher` receives tasks via `submit()`, manages a 3-lane priority queue, scores agents on `drain()`, and delegates execution to WorkerManager via injected deps. Scorer is extracted for testability. Four new CLI commands expose observability.

**Tech Stack:** TypeScript (ESM, strict), Vitest, zero runtime deps. All commands from `cd "01 - Projects/Flowti CLI"`.

**Spec:** `docs/specs/2026-03-24-task-dispatcher-design.md`

---

## Chunk 1: Types + Scorer

Pure domain types and the scoring algorithm. No infrastructure deps. Foundation for everything else.

### Task 1: Dispatcher Types

**Files:**
- Create: `src/domain/tasks/task-dispatcher-types.ts`

- [ ] **Step 1: Create types file**

```typescript
import type { TrustTier } from "../trust/trust-types.js";
import type { TaskTrustTier } from "./task-types.js";

export type TaskPriorityLane = "urgent" | "high" | "normal";
export type TaskSource = "standing-order" | "bt-action" | "director" | "self-proposed" | "delegated";

export interface TaskEntry {
	readonly taskId: string;
	readonly title: string;
	readonly priority: TaskPriorityLane;
	readonly requiredCapabilities: readonly string[];
	readonly requiredAgentTier: TrustTier;
	readonly taskTrustTier: TaskTrustTier;
	readonly reward: { readonly xp: number; readonly coin: number };
	readonly submittedAt: number;
	readonly source: TaskSource;
	readonly targetAgent?: string;
	readonly retryCount: number;
	readonly tags: readonly string[];
	readonly type: string;
}

export interface TaskHistoryEntry {
	readonly tags: readonly string[];
	readonly type: string;
	readonly assignee: string;
}

export interface AgentScore {
	readonly name: string;
	readonly capable: boolean;
	readonly trustMet: boolean;
	readonly affinityScore: number;
	readonly idle: boolean;
	readonly onCooldown: boolean;
}

export interface DispatcherQueues {
	readonly urgent: TaskEntry[];
	readonly high: TaskEntry[];
	readonly normal: TaskEntry[];
}

export interface DispatcherMetrics {
	readonly queueDepth: { readonly urgent: number; readonly high: number; readonly normal: number };
	readonly activeAssignments: number;
	readonly agentsOnCooldown: number;
	readonly agentsIdle: number;
	readonly tasksCompleted: number;
	readonly tasksFailed: number;
	readonly avgWaitTimeMs: number;
	readonly avgExecutionTimeMs: number;
	readonly agentStats: Record<string, {
		readonly completed: number;
		readonly failed: number;
		readonly avgExecutionTimeMs: number;
		readonly lastTaskAt: number;
	}>;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS — types compile, imports resolve

- [ ] **Step 3: Commit**

```bash
git add src/domain/tasks/task-dispatcher-types.ts
git commit -m "feat(tasks): add task dispatcher type definitions"
```

---

### Task 2: Task Scorer — Tests

**Files:**
- Create: `tests/domain/tasks/task-scorer.test.ts`
- Create: `src/domain/tasks/task-scorer.ts` (stub)

The scorer has two functions: `scoreAgents()` (filters + ranks) and `computeAffinity()` (history-based tiebreaker).

**Reference:** Existing `task-scoring.ts` does RPG attribute scoring — different concern, no overlap.

- [ ] **Step 1: Write all scorer tests**

```typescript
import { describe, it, expect } from "vitest";
import { scoreAgents, computeAffinity } from "../../../src/domain/tasks/task-scorer.js";
import type { TaskEntry, TaskHistoryEntry, AgentScore } from "../../../src/domain/tasks/task-dispatcher-types.js";
import type { TrustTier } from "../../../src/domain/trust/trust-types.js";
import type { WorkerState } from "../../../src/domain/agents/worker-types.js";

interface AgentInfo {
	readonly name: string;
	readonly capabilities: readonly string[];
	readonly trustTier: TrustTier;
	readonly workerState: WorkerState;
	readonly onCooldown: boolean;
	readonly history: readonly TaskHistoryEntry[];
}

function makeTask(overrides: Partial<TaskEntry> = {}): TaskEntry {
	return {
		taskId: "task-001",
		title: "Test task",
		priority: "normal",
		requiredCapabilities: [],
		requiredAgentTier: "supervised",
		taskTrustTier: "auto",
		reward: { xp: 10, coin: 5 },
		submittedAt: 1000,
		source: "director",
		retryCount: 0,
		tags: [],
		type: "one-off",
		...overrides,
	};
}

function makeAgent(overrides: Partial<AgentInfo> = {}): AgentInfo {
	return {
		name: "agent-a",
		capabilities: [],
		trustTier: "supervised",
		workerState: "idle",
		onCooldown: false,
		history: [],
		...overrides,
	};
}

describe("computeAffinity", () => {
	it("returns 0 for empty history", () => {
		expect(computeAffinity([], ["inbox"], "one-off")).toBe(0);
	});

	it("scores tag matches at weight 2", () => {
		const history: TaskHistoryEntry[] = [
			{ tags: ["inbox", "tagging"], type: "one-off", assignee: "a" },
			{ tags: ["inbox"], type: "standing-order", assignee: "a" },
		];
		// 2 tag matches for "inbox" × 2 = 4, 1 type match (standing-order) × 1 = 1, total = 5
		expect(computeAffinity(history, ["inbox"], "standing-order")).toBe(5);
	});

	it("scores type matches at weight 1", () => {
		const history: TaskHistoryEntry[] = [
			{ tags: [], type: "one-off", assignee: "a" },
			{ tags: [], type: "one-off", assignee: "a" },
		];
		expect(computeAffinity(history, [], "one-off")).toBe(2);
	});

	it("combines tag and type scores", () => {
		const history: TaskHistoryEntry[] = [
			{ tags: ["review"], type: "delegated", assignee: "a" },
		];
		// 1 tag match × 2 = 2, 1 type match × 1 = 1
		expect(computeAffinity(history, ["review"], "delegated")).toBe(3);
	});
});

describe("scoreAgents", () => {
	it("filters out agents missing required capabilities", () => {
		const agents = [makeAgent({ name: "a", capabilities: ["read"] })];
		const task = makeTask({ requiredCapabilities: ["read", "write"] });
		const result = scoreAgents(agents, task);
		expect(result).toBeNull();
	});

	it("passes agents with all required capabilities", () => {
		const agents = [makeAgent({ name: "a", capabilities: ["read", "write", "tag"] })];
		const task = makeTask({ requiredCapabilities: ["read", "write"] });
		const result = scoreAgents(agents, task);
		expect(result).not.toBeNull();
		expect(result!.name).toBe("a");
	});

	it("filters out agents below required trust tier", () => {
		const agents = [makeAgent({ name: "a", trustTier: "supervised" })];
		const task = makeTask({ requiredAgentTier: "trusted" });
		const result = scoreAgents(agents, task);
		expect(result).toBeNull();
	});

	it("accepts agents at or above required trust tier", () => {
		const agents = [makeAgent({ name: "a", trustTier: "autonomous" })];
		const task = makeTask({ requiredAgentTier: "trusted" });
		const result = scoreAgents(agents, task);
		expect(result!.name).toBe("a");
	});

	it("filters out agents on cooldown", () => {
		const agents = [makeAgent({ name: "a", onCooldown: true })];
		const result = scoreAgents(agents, makeTask());
		expect(result).toBeNull();
	});

	it("filters out busy agents", () => {
		const agents = [makeAgent({ name: "a", workerState: "working" })];
		const result = scoreAgents(agents, makeTask());
		expect(result).toBeNull();
	});

	it("picks agent with higher affinity score", () => {
		const agents = [
			makeAgent({
				name: "bob",
				history: [{ tags: ["inbox"], type: "one-off", assignee: "bob" }],
			}),
			makeAgent({
				name: "alice",
				history: [
					{ tags: ["inbox"], type: "one-off", assignee: "alice" },
					{ tags: ["inbox"], type: "one-off", assignee: "alice" },
				],
			}),
		];
		const task = makeTask({ tags: ["inbox"], type: "one-off" });
		const result = scoreAgents(agents, task);
		expect(result!.name).toBe("alice");
	});

	it("breaks ties alphabetically", () => {
		const agents = [
			makeAgent({ name: "bob" }),
			makeAgent({ name: "alice" }),
		];
		const result = scoreAgents(agents, makeTask());
		expect(result!.name).toBe("alice");
	});

	it("returns null when no agents qualify", () => {
		const result = scoreAgents([], makeTask());
		expect(result).toBeNull();
	});
});
```

- [ ] **Step 2: Create scorer stub to make imports resolve**

```typescript
// src/domain/tasks/task-scorer.ts
import type { TaskEntry, TaskHistoryEntry } from "./task-dispatcher-types.js";
import type { TrustTier } from "../trust/trust-types.js";
import type { WorkerState } from "../agents/worker-types.js";

export interface AgentInfo {
	readonly name: string;
	readonly capabilities: readonly string[];
	readonly trustTier: TrustTier;
	readonly workerState: WorkerState;
	readonly onCooldown: boolean;
	readonly history: readonly TaskHistoryEntry[];
}

export function computeAffinity(
	_history: readonly TaskHistoryEntry[],
	_tags: readonly string[],
	_type: string,
): number {
	return 0;
}

export function scoreAgents(
	_agents: readonly AgentInfo[],
	_task: TaskEntry,
): AgentInfo | null {
	return null;
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/domain/tasks/task-scorer.test.ts --config configs/vitest.config.ts`
Expected: FAIL — stub returns wrong values for most tests

---

### Task 3: Task Scorer — Implementation

**Files:**
- Modify: `src/domain/tasks/task-scorer.ts`

- [ ] **Step 1: Implement `computeAffinity`**

Replace the stub body with:

```typescript
export function computeAffinity(
	history: readonly TaskHistoryEntry[],
	tags: readonly string[],
	type: string,
): number {
	const tagSet = new Set(tags);
	let score = 0;
	for (const entry of history) {
		for (const t of entry.tags) {
			if (tagSet.has(t)) score += 2;
		}
		if (entry.type === type) score += 1;
	}
	return score;
}
```

- [ ] **Step 2: Implement `scoreAgents`**

The trust tier ordering for comparison:

```typescript
const TIER_ORDER: Record<TrustTier, number> = {
	supervised: 0,
	trusted: 1,
	autonomous: 2,
};

export function scoreAgents(
	agents: readonly AgentInfo[],
	task: TaskEntry,
): AgentInfo | null {
	const capSet = new Set(task.requiredCapabilities);
	const requiredTierLevel = TIER_ORDER[task.requiredAgentTier];

	const candidates: Array<{ agent: AgentInfo; affinity: number }> = [];

	for (const agent of agents) {
		// Step 1: capability filter
		if ([...capSet].some((c) => !agent.capabilities.includes(c))) continue;
		// Step 2: trust gate
		if (TIER_ORDER[agent.trustTier] < requiredTierLevel) continue;
		// Step 3: availability
		if (agent.workerState !== "idle" || agent.onCooldown) continue;

		// Step 4: affinity
		const affinity = computeAffinity(agent.history, [...task.tags], task.type);
		candidates.push({ agent, affinity });
	}

	if (candidates.length === 0) return null;

	// Sort: highest affinity first, then alphabetical name for determinism
	candidates.sort((a, b) =>
		b.affinity - a.affinity || a.agent.name.localeCompare(b.agent.name),
	);

	return candidates[0].agent;
}
```

- [ ] **Step 3: Run tests to verify all pass**

Run: `npx vitest run tests/domain/tasks/task-scorer.test.ts --config configs/vitest.config.ts`
Expected: PASS — all 9 tests

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/tasks/task-scorer.ts tests/domain/tasks/task-scorer.test.ts
git commit -m "feat(tasks): add task scorer with capability/trust/affinity scoring"
```

---

## Chunk 2: Task Dispatcher Core

The central `TaskDispatcher` class with submit, drain, assign, complete, fail, and metrics. Pure domain — all side effects via injected deps.

### Task 4: Dispatcher — Tests

**Files:**
- Create: `tests/domain/tasks/task-dispatcher.test.ts`
- Create: `src/domain/tasks/task-dispatcher.ts` (stub)

- [ ] **Step 1: Write dispatcher tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDispatcher } from "../../../src/domain/tasks/task-dispatcher.js";
import type { TaskEntry } from "../../../src/domain/tasks/task-dispatcher-types.js";

function makeTask(overrides: Partial<TaskEntry> = {}): TaskEntry {
	return {
		taskId: "task-001",
		title: "Test task",
		priority: "normal",
		requiredCapabilities: [],
		requiredAgentTier: "supervised",
		taskTrustTier: "auto",
		reward: { xp: 10, coin: 5 },
		submittedAt: 1000,
		source: "director",
		retryCount: 0,
		tags: [],
		type: "one-off",
		...overrides,
	};
}

function makeDeps(overrides: Record<string, unknown> = {}) {
	return {
		clock: { ms: () => 1000, now: () => 1000, iso: () => "2026-03-24T00:00:00Z", safeIso: () => "2026-03-24" },
		loadTrustProfile: vi.fn().mockReturnValue({ tier: "supervised", operations: {}, promotionLog: [] }),
		getAgentCapabilities: vi.fn().mockReturnValue([]),
		getTaskHistory: vi.fn().mockReturnValue([]),
		getWorkerState: vi.fn().mockReturnValue("idle"),
		updateTaskStatus: vi.fn(),
		awardReward: vi.fn(),
		emit: vi.fn(),
		writeAgentEvent: vi.fn(),
		sendToWorker: vi.fn(),
		cooldownMs: 15000,
		maxRetries: 1,
		...overrides,
	};
}

describe("createDispatcher", () => {
	describe("submit", () => {
		it("enqueues in correct priority lane", () => {
			const deps = makeDeps();
			const d = createDispatcher(deps, ["agent-a"]);
			// All agents busy so drain won't assign
			deps.getWorkerState.mockReturnValue("working");

			d.submit(makeTask({ priority: "urgent", taskId: "t1" }));
			d.submit(makeTask({ priority: "high", taskId: "t2" }));
			d.submit(makeTask({ priority: "normal", taskId: "t3" }));

			const m = d.metrics();
			expect(m.queueDepth).toEqual({ urgent: 1, high: 1, normal: 1 });
		});

		it("targeted task assigns directly to idle agent", () => {
			const deps = makeDeps();
			const d = createDispatcher(deps, ["agent-a"]);

			d.submit(makeTask({ targetAgent: "agent-a" }));

			expect(deps.updateTaskStatus).toHaveBeenCalledWith("task-001", "assigned");
			expect(deps.sendToWorker).toHaveBeenCalled();
		});

		it("targeted task queues when agent is busy", () => {
			const deps = makeDeps();
			deps.getWorkerState.mockReturnValue("working");
			const d = createDispatcher(deps, ["agent-a"]);

			d.submit(makeTask({ targetAgent: "agent-a" }));

			expect(deps.sendToWorker).not.toHaveBeenCalled();
			expect(d.metrics().queueDepth.normal).toBe(1);
		});

		it("rejects manual tasks from non-director sources", () => {
			const deps = makeDeps();
			const d = createDispatcher(deps, ["agent-a"]);

			expect(() =>
				d.submit(makeTask({ taskTrustTier: "manual", source: "bt-action" })),
			).toThrow(/manual/i);
		});

		it("allows manual tasks from director source", () => {
			const deps = makeDeps();
			const d = createDispatcher(deps, ["agent-a"]);

			d.submit(makeTask({ taskTrustTier: "manual", source: "director" }));

			expect(deps.updateTaskStatus).toHaveBeenCalledWith("task-001", "assigned");
		});
	});

	describe("drain", () => {
		it("pulls urgent before high before normal", () => {
			const deps = makeDeps();
			deps.getWorkerState.mockReturnValue("working");
			const d = createDispatcher(deps, ["agent-a"]);

			d.submit(makeTask({ priority: "normal", taskId: "t-normal" }));
			d.submit(makeTask({ priority: "urgent", taskId: "t-urgent" }));
			d.submit(makeTask({ priority: "high", taskId: "t-high" }));

			// Now make agent available and drain
			deps.getWorkerState.mockReturnValue("idle");
			d.drain();

			expect(deps.sendToWorker).toHaveBeenCalledTimes(1);
			expect(deps.writeAgentEvent).toHaveBeenCalledWith("agent-a", "task-started", expect.any(String));
		});

		it("leaves task in queue when no agent qualifies", () => {
			const deps = makeDeps();
			deps.getWorkerState.mockReturnValue("working");
			const d = createDispatcher(deps, ["agent-a"]);

			d.submit(makeTask({ taskId: "t1" }));
			d.drain();

			expect(deps.sendToWorker).not.toHaveBeenCalled();
			expect(d.metrics().queueDepth.normal).toBe(1);
		});
	});

	describe("complete", () => {
		it("awards reward for auto trust tier", () => {
			const deps = makeDeps();
			const d = createDispatcher(deps, ["agent-a"]);
			d.submit(makeTask({ taskTrustTier: "auto" }));

			d.complete("agent-a", "task-001", "done");

			expect(deps.awardReward).toHaveBeenCalledWith("agent-a", { xp: 10, coin: 5 });
			expect(deps.updateTaskStatus).toHaveBeenCalledWith("task-001", "completed");
		});

		it("defers reward for review trust tier", () => {
			const deps = makeDeps();
			const d = createDispatcher(deps, ["agent-a"]);
			d.submit(makeTask({ taskTrustTier: "review" }));

			d.complete("agent-a", "task-001", "done");

			expect(deps.awardReward).not.toHaveBeenCalled();
			expect(deps.updateTaskStatus).toHaveBeenCalledWith("task-001", "review");
		});

		it("starts cooldown and emits done event", () => {
			const deps = makeDeps();
			const d = createDispatcher(deps, ["agent-a"]);
			d.submit(makeTask());

			d.complete("agent-a", "task-001", "done");

			expect(deps.writeAgentEvent).toHaveBeenCalledWith("agent-a", "done", "");
			expect(deps.emit).toHaveBeenCalledWith("task:completed", expect.any(Object));
			expect(d.metrics().agentsOnCooldown).toBe(1);
		});

		it("removes assignment", () => {
			const deps = makeDeps();
			const d = createDispatcher(deps, ["agent-a"]);
			d.submit(makeTask());

			expect(d.metrics().activeAssignments).toBe(1);
			d.complete("agent-a", "task-001", "done");
			expect(d.metrics().activeAssignments).toBe(0);
		});
	});

	describe("fail", () => {
		it("re-submits when retries remaining", () => {
			const deps = makeDeps();
			const d = createDispatcher(deps, ["agent-a"]);
			d.submit(makeTask({ retryCount: 0 }));

			d.fail("agent-a", "task-001", "timeout");

			// Task re-submitted — agent is idle so it should be re-assigned
			expect(deps.updateTaskStatus).toHaveBeenCalledWith("task-001", "failed");
			expect(deps.sendToWorker).toHaveBeenCalledTimes(2); // initial + retry
		});

		it("does not re-submit when retries exhausted", () => {
			const deps = makeDeps();
			const d = createDispatcher(deps, ["agent-a"]);
			d.submit(makeTask({ retryCount: 1 }));

			d.fail("agent-a", "task-001", "timeout");

			expect(deps.emit).toHaveBeenCalledWith("task:failed", expect.any(Object));
			expect(deps.writeAgentEvent).toHaveBeenCalledWith("agent-a", "error", "timeout");
		});

		it("applies cooldown on failure", () => {
			const deps = makeDeps();
			const d = createDispatcher(deps, ["agent-a"]);
			d.submit(makeTask({ retryCount: 1 }));

			d.fail("agent-a", "task-001", "timeout");

			expect(d.metrics().agentsOnCooldown).toBe(1);
		});
	});

	describe("metrics", () => {
		it("tracks queue depth accurately", () => {
			const deps = makeDeps();
			deps.getWorkerState.mockReturnValue("working");
			const d = createDispatcher(deps, ["agent-a"]);

			d.submit(makeTask({ priority: "urgent" }));
			d.submit(makeTask({ priority: "urgent", taskId: "t2" }));
			d.submit(makeTask({ priority: "normal", taskId: "t3" }));

			const m = d.metrics();
			expect(m.queueDepth.urgent).toBe(2);
			expect(m.queueDepth.high).toBe(0);
			expect(m.queueDepth.normal).toBe(1);
		});

		it("tracks per-agent stats on completion", () => {
			const deps = makeDeps();
			const d = createDispatcher(deps, ["agent-a"]);
			d.submit(makeTask());
			d.complete("agent-a", "task-001", "done");

			const m = d.metrics();
			expect(m.agentStats["agent-a"].completed).toBe(1);
			expect(m.tasksCompleted).toBe(1);
		});
	});

	describe("cooldown", () => {
		it("prevents assignment during cooldown", () => {
			const deps = makeDeps();
			const d = createDispatcher(deps, ["agent-a"]);
			d.submit(makeTask());
			d.complete("agent-a", "task-001", "done");

			// Agent is on cooldown, new task should queue
			deps.getWorkerState.mockReturnValue("idle");
			d.submit(makeTask({ taskId: "t2" }));

			// sendToWorker called once (first task), not twice
			expect(deps.sendToWorker).toHaveBeenCalledTimes(1);
		});

		it("clears cooldown and drains after timeout", () => {
			vi.useFakeTimers();
			const deps = makeDeps();
			const d = createDispatcher(deps, ["agent-a"]);
			d.submit(makeTask());
			d.complete("agent-a", "task-001", "done");

			// Queue a second task while on cooldown
			deps.getWorkerState.mockReturnValue("idle");
			d.submit(makeTask({ taskId: "t2" }));
			expect(deps.sendToWorker).toHaveBeenCalledTimes(1);

			// Advance past cooldown
			vi.advanceTimersByTime(15001);

			expect(deps.emit).toHaveBeenCalledWith("agent:available", expect.any(Object));
			// drain should have been called, assigning t2
			expect(deps.sendToWorker).toHaveBeenCalledTimes(2);

			vi.useRealTimers();
		});
	});
});
```

- [ ] **Step 2: Create dispatcher stub**

```typescript
// src/domain/tasks/task-dispatcher.ts
import type { TaskEntry, DispatcherMetrics } from "./task-dispatcher-types.js";
import type { AgentTrustProfile } from "../trust/trust-types.js";
import type { WorkerState } from "../agents/worker-types.js";
import type { TaskHistoryEntry } from "./task-dispatcher-types.js";

export interface DispatcherDeps {
	readonly clock: { ms(): number; iso(): string; safeIso(): string };
	readonly loadTrustProfile: (agentName: string) => AgentTrustProfile | null;
	readonly getAgentCapabilities: (agentName: string) => readonly string[];
	readonly getTaskHistory: (agentName: string) => readonly TaskHistoryEntry[];
	readonly getWorkerState: (agentName: string) => WorkerState;
	readonly updateTaskStatus: (taskId: string, status: string) => void;
	readonly awardReward: (agentName: string, reward: { readonly xp: number; readonly coin: number }) => void;
	readonly emit: (event: string, data: unknown) => void;
	readonly writeAgentEvent: (agentName: string, type: string, text: string) => void;
	readonly sendToWorker: (agentName: string, message: string, opts?: { readonly task?: string }) => void;
	readonly cooldownMs: number;
	readonly maxRetries: number;
}

export interface TaskDispatcher {
	submit(task: TaskEntry): void;
	drain(): void;
	complete(agentName: string, taskId: string, result: string): void;
	fail(agentName: string, taskId: string, error: string): void;
	metrics(): DispatcherMetrics;
	listQueue(): { readonly lane: string; readonly tasks: readonly TaskEntry[] }[];
	listHistory(agentName?: string): readonly { readonly agentName: string; readonly taskId: string; readonly completedAt: number }[];
}

export function createDispatcher(_deps: DispatcherDeps, _agentNames: readonly string[]): TaskDispatcher {
	return {
		submit() { /* stub */ },
		drain() { /* stub */ },
		complete() { /* stub */ },
		fail() { /* stub */ },
		metrics() {
			return {
				queueDepth: { urgent: 0, high: 0, normal: 0 },
				activeAssignments: 0, agentsOnCooldown: 0, agentsIdle: 0,
				tasksCompleted: 0, tasksFailed: 0,
				avgWaitTimeMs: 0, avgExecutionTimeMs: 0,
				agentStats: {},
			};
		},
		listQueue() { return []; },
		listHistory() { return []; },
	};
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/domain/tasks/task-dispatcher.test.ts --config configs/vitest.config.ts`
Expected: FAIL — stub returns wrong values

---

### Task 5: Dispatcher — Implementation

**Files:**
- Modify: `src/domain/tasks/task-dispatcher.ts`

- [ ] **Step 1: Implement full dispatcher**

Replace the stub `createDispatcher` body with the complete implementation. Key internal state:

```typescript
import { scoreAgents, type AgentInfo } from "./task-scorer.js";
import type { TaskEntry, DispatcherMetrics, TaskPriorityLane } from "./task-dispatcher-types.js";

// ... (DispatcherDeps and TaskDispatcher interfaces stay as-is)

export function createDispatcher(deps: DispatcherDeps, agentNames: readonly string[]): TaskDispatcher {
	const queues: Record<TaskPriorityLane, TaskEntry[]> = { urgent: [], high: [], normal: [] };
	const cooldowns = new Map<string, number>();
	const assignments = new Map<string, TaskEntry>();
	const completionTimes: number[] = [];
	const waitTimes: number[] = [];
	let tasksCompleted = 0;
	let tasksFailed = 0;
	const agentStats: Record<string, { completed: number; failed: number; totalExecMs: number; lastTaskAt: number }> = {};

	function isOnCooldown(name: string): boolean {
		const expires = cooldowns.get(name);
		if (expires === undefined) return false;
		if (deps.clock.ms() >= expires) {
			cooldowns.delete(name);
			return false;
		}
		return true;
	}

	function buildAgentInfos(): AgentInfo[] {
		return agentNames.map((name) => {
			const profile = deps.loadTrustProfile(name);
			return {
				name,
				capabilities: [...deps.getAgentCapabilities(name)],
				trustTier: profile?.tier ?? "supervised",
				workerState: deps.getWorkerState(name),
				onCooldown: isOnCooldown(name),
				history: deps.getTaskHistory(name),
			};
		});
	}

	function assign(agentName: string, task: TaskEntry): void {
		assignments.set(agentName, task);
		deps.updateTaskStatus(task.taskId, "assigned");
		deps.emit("task:assigned", { agent: agentName, task });
		deps.writeAgentEvent(agentName, "task-started", task.title);
		deps.sendToWorker(agentName, task.title, { task: task.title });
	}

	function startCooldown(agentName: string): void {
		cooldowns.set(agentName, deps.clock.ms() + deps.cooldownMs);
		setTimeout(() => {
			cooldowns.delete(agentName);
			deps.emit("agent:available", { agent: agentName });
			drain();
		}, deps.cooldownMs);
	}

	function drain(): void {
		const lanes: TaskPriorityLane[] = ["urgent", "high", "normal"];
		for (const lane of lanes) {
			while (queues[lane].length > 0) {
				const task = queues[lane][0];
				const agents = buildAgentInfos();
				const winner = task.targetAgent
					? agents.find((a) => a.name === task.targetAgent && a.workerState === "idle" && !a.onCooldown) ?? null
					: scoreAgents(agents, task);

				if (!winner) break; // no agent for this lane's front task — try next lane
				queues[lane].shift();
				assign(winner.name, task);
			}
		}
	}

	function submit(task: TaskEntry): void {
		if (task.taskTrustTier === "manual" && task.source !== "director") {
			throw new Error("Manual tasks require Director source");
		}

		if (task.targetAgent) {
			const agents = buildAgentInfos();
			const target = agents.find((a) => a.name === task.targetAgent);
			if (target && target.workerState === "idle" && !target.onCooldown) {
				assign(target.name, task);
				return;
			}
		}

		queues[task.priority].push(task);
		drain();
	}

	function complete(agentName: string, taskId: string, result: string): void {
		const task = assignments.get(agentName);
		assignments.delete(agentName);

		if (task) {
			const execMs = deps.clock.ms() - task.submittedAt;
			waitTimes.push(execMs);
			completionTimes.push(execMs);

			if (task.taskTrustTier === "auto") {
				deps.updateTaskStatus(taskId, "completed");
				deps.awardReward(agentName, task.reward);
			} else {
				deps.updateTaskStatus(taskId, "review");
			}

			tasksCompleted++;
			if (!agentStats[agentName]) {
				agentStats[agentName] = { completed: 0, failed: 0, totalExecMs: 0, lastTaskAt: 0 };
			}
			agentStats[agentName].completed++;
			agentStats[agentName].totalExecMs += execMs;
			agentStats[agentName].lastTaskAt = deps.clock.ms();
		}

		deps.emit("task:completed", { agent: agentName, taskId, result });
		deps.writeAgentEvent(agentName, "done", "");
		startCooldown(agentName);
	}

	function fail(agentName: string, taskId: string, error: string): void {
		const task = assignments.get(agentName);
		assignments.delete(agentName);

		deps.updateTaskStatus(taskId, "failed");

		if (task && task.retryCount < deps.maxRetries) {
			submit({ ...task, retryCount: task.retryCount + 1 });
		} else {
			deps.emit("task:failed", { agent: agentName, taskId, error });
			deps.writeAgentEvent(agentName, "error", error);
			tasksFailed++;
			if (!agentStats[agentName]) {
				agentStats[agentName] = { completed: 0, failed: 0, totalExecMs: 0, lastTaskAt: 0 };
			}
			agentStats[agentName].failed++;
		}

		startCooldown(agentName);
	}

	function metrics(): DispatcherMetrics {
		const idleCount = agentNames.filter((n) =>
			deps.getWorkerState(n) === "idle" && !isOnCooldown(n) && !assignments.has(n),
		).length;

		const avgWait = waitTimes.length > 0 ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0;
		const avgExec = completionTimes.length > 0 ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length : 0;

		const statsOut: DispatcherMetrics["agentStats"] = {};
		for (const [name, s] of Object.entries(agentStats)) {
			statsOut[name] = {
				completed: s.completed,
				failed: s.failed,
				avgExecutionTimeMs: s.completed > 0 ? s.totalExecMs / s.completed : 0,
				lastTaskAt: s.lastTaskAt,
			};
		}

		return {
			queueDepth: {
				urgent: queues.urgent.length,
				high: queues.high.length,
				normal: queues.normal.length,
			},
			activeAssignments: assignments.size,
			agentsOnCooldown: cooldowns.size,
			agentsIdle: idleCount,
			tasksCompleted,
			tasksFailed,
			avgWaitTimeMs: avgWait,
			avgExecutionTimeMs: avgExec,
			agentStats: statsOut,
		};
	}

	const recentHistory: Array<{ agentName: string; taskId: string; completedAt: number }> = [];

	function listQueue() {
		return (["urgent", "high", "normal"] as const).map((lane) => ({
			lane,
			tasks: [...queues[lane]],
		}));
	}

	function listHistory(agentName?: string) {
		if (agentName) return recentHistory.filter((h) => h.agentName === agentName);
		return [...recentHistory];
	}

	// Patch complete to also record history:
	const _complete = complete;
	function completeWithHistory(agentName: string, taskId: string, result: string): void {
		recentHistory.push({ agentName, taskId, completedAt: deps.clock.ms() });
		if (recentHistory.length > 100) recentHistory.shift(); // rolling window
		_complete(agentName, taskId, result);
	}

	return { submit, drain, complete: completeWithHistory, fail, metrics, listQueue, listHistory };
}
```

- [ ] **Step 2: Run tests to verify all pass**

Run: `npx vitest run tests/domain/tasks/task-dispatcher.test.ts --config configs/vitest.config.ts`
Expected: PASS — all 16 tests

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 4: Lint**

Run: `npx eslint src/domain/tasks/task-dispatcher.ts src/domain/tasks/task-scorer.ts src/domain/tasks/task-dispatcher-types.ts --config configs/eslint.config.mjs`
Expected: PASS — no violations

- [ ] **Step 5: Commit**

```bash
git add src/domain/tasks/task-dispatcher.ts tests/domain/tasks/task-dispatcher.test.ts
git commit -m "feat(tasks): implement task dispatcher with priority queue and scoring"
```

---

## Chunk 3: CLI Commands

Four new commands for observability. Uses the existing `adaptDescriptor` pattern in `task.controller.ts`.

### Task 6: Dispatch Controller Commands

**Files:**
- Modify: `src/controller/task.controller.ts`
- Reference: `src/domain/tasks/task-dispatcher.ts` (createDispatcher, TaskDispatcher)
- Reference: `src/domain/tasks/task-dispatcher-types.ts` (DispatcherMetrics)

**Note:** The dispatcher instance lives in infrastructure (created during wiring). The controller accesses it via `CliDeps`. For now, the commands read metrics from a dispatcher passed through deps. The actual wiring (adding `dispatcher` to `CliDeps`) happens in Chunk 4.

- [ ] **Step 1: Create display functions**

Create `src/ui/displays/dispatch-display.ts`:

```typescript
import type { DispatcherMetrics } from "../domain/tasks/task-dispatcher-types.js";

export function renderDispatchStatus(data: DispatcherMetrics, log: (msg?: string) => void): void {
	log("Dispatch Status");
	log(`  Queue: urgent=${data.queueDepth.urgent} high=${data.queueDepth.high} normal=${data.queueDepth.normal}`);
	log(`  Active: ${data.activeAssignments}  Cooldown: ${data.agentsOnCooldown}  Idle: ${data.agentsIdle}`);
}

export function renderDispatchMetrics(data: DispatcherMetrics, log: (msg?: string) => void): void {
	log("Dispatch Metrics");
	log(`  Completed: ${data.tasksCompleted}  Failed: ${data.tasksFailed}`);
	log(`  Avg wait: ${Math.round(data.avgWaitTimeMs)}ms  Avg exec: ${Math.round(data.avgExecutionTimeMs)}ms`);
	if (Object.keys(data.agentStats).length > 0) {
		log("  Per-agent:");
		for (const [name, s] of Object.entries(data.agentStats)) {
			log(`    ${name}: ${s.completed} done, ${s.failed} failed, avg ${Math.round(s.avgExecutionTimeMs)}ms`);
		}
	}
}

export function renderDispatchQueue(
	data: { readonly lane: string; readonly tasks: readonly { readonly taskId: string; readonly title: string; readonly source: string }[] }[],
	log: (msg?: string) => void,
): void {
	log("Dispatch Queue");
	for (const { lane, tasks } of data) {
		if (tasks.length === 0) continue;
		log(`  [${lane}] (${tasks.length})`);
		for (const t of tasks) {
			log(`    ${t.taskId}: ${t.title} (${t.source})`);
		}
	}
	const total = data.reduce((sum, l) => sum + l.tasks.length, 0);
	if (total === 0) log("  (empty)");
}

export function renderDispatchHistory(
	data: readonly { readonly agentName: string; readonly taskId: string; readonly completedAt: number }[],
	log: (msg?: string) => void,
): void {
	log("Recent Completions");
	if (data.length === 0) { log("  (none)"); return; }
	for (const h of data) {
		log(`  ${h.agentName}: ${h.taskId} at ${new Date(h.completedAt).toISOString()}`);
	}
}
```

- [ ] **Step 2: Add dispatch commands to controller**

Add to the `commands` object in `task.controller.ts`. These commands need access to the dispatcher. Since `CliDeps` doesn't have `dispatcher` yet (wired in Chunk 4), use a getter pattern:

```typescript
// At top of task.controller.ts, add imports:
import type { TaskDispatcher } from "../domain/tasks/task-dispatcher.js";
import { renderDispatchStatus, renderDispatchMetrics, renderDispatchQueue, renderDispatchHistory } from "../ui/displays/dispatch-display.js";

// Add to the commands Record:
"dispatch:status": adaptDescriptor({
	handler: (ctx) => {
		const dispatcher = (ctx.deps as CliDeps & { dispatcher?: TaskDispatcher }).dispatcher;
		if (!dispatcher) return { error: "Dispatcher not initialized" };
		return dispatcher.metrics();
	},
	renderer: (data, log) => {
		if ("error" in data) { log(data.error); return; }
		renderDispatchStatus(data, log);
	},
}),

"dispatch:metrics": adaptDescriptor({
	handler: (ctx) => {
		const dispatcher = (ctx.deps as CliDeps & { dispatcher?: TaskDispatcher }).dispatcher;
		if (!dispatcher) return { error: "Dispatcher not initialized" };
		return dispatcher.metrics();
	},
	renderer: (data, log) => {
		if ("error" in data) { log(data.error); return; }
		renderDispatchMetrics(data, log);
	},
}),

"dispatch:queue": adaptDescriptor({
	handler: (ctx) => {
		const dispatcher = (ctx.deps as CliDeps & { dispatcher?: TaskDispatcher }).dispatcher;
		if (!dispatcher) return { error: "Dispatcher not initialized" };
		return dispatcher.listQueue();
	},
	renderer: (data, log) => {
		if ("error" in data) { log(data.error); return; }
		renderDispatchQueue(data, log);
	},
}),

"dispatch:history": adaptDescriptor({
	flags: { agent: { type: "string", required: false, hint: "--agent=<name>" } },
	handler: (ctx) => {
		const dispatcher = (ctx.deps as CliDeps & { dispatcher?: TaskDispatcher }).dispatcher;
		if (!dispatcher) return { error: "Dispatcher not initialized" };
		return dispatcher.listHistory(ctx.flags.agent);
	},
	renderer: (data, log) => {
		if ("error" in data) { log(data.error); return; }
		renderDispatchHistory(data, log);
	},
}),
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/controller/task.controller.ts src/ui/displays/dispatch-display.ts
git commit -m "feat(tasks): add dispatch:status, dispatch:metrics, dispatch:queue, dispatch:history CLI commands"
```

---

## Chunk 4: Infrastructure Wiring

Wire the dispatcher into the existing infrastructure: add to `CliDeps`, connect WorkerManager callbacks, update `AgentProcessLoopDeps` for BT action routing.

### Task 7: Add Dispatcher to CliDeps

**Files:**
- Modify: `src/infrastructure/deps.ts`

- [ ] **Step 1: Add dispatcher to CliDeps interface**

Add `TaskDispatcher` import and optional field:

```typescript
import type { TaskDispatcher } from "../domain/tasks/task-dispatcher.js";

// In CliDeps interface, add:
readonly dispatcher?: TaskDispatcher;
```

Optional (`?`) because the dispatcher is only created when agents are configured. Existing code that doesn't use the dispatcher is unaffected.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/deps.ts
git commit -m "feat(infra): add optional dispatcher to CliDeps"
```

---

### Task 8: Add Dispatcher to AgentProcessLoopDeps

**Files:**
- Modify: `src/domain/agents/agent-process-loop.ts`

- [ ] **Step 1: Add dispatcher dep**

Add to `AgentProcessLoopDeps`:

```typescript
import type { TaskDispatcher } from "../tasks/task-dispatcher.js";

// In AgentProcessLoopDeps interface, add:
readonly dispatcher?: TaskDispatcher;
```

Optional — process loops created without a dispatcher fall back to the existing `workerManager.send()` path.

- [ ] **Step 2: Update bt-action handler to route through dispatcher**

Find the `handleBtAction` function (or the `bt-action` case in the dispatch switch). Replace the direct `workerManager.send()` call with dispatcher routing:

```typescript
// In the bt-action handler:
if (deps.dispatcher) {
	const goalText = data.goal ?? data.task ?? "";
	deps.dispatcher.submit({
		taskId: `bt-${deps.clock.ms()}`,
		title: goalText,
		priority: "normal",
		requiredCapabilities: [],
		requiredAgentTier: "supervised",
		taskTrustTier: "auto",
		reward: { xp: 10, coin: 5 },
		submittedAt: deps.clock.ms(),
		source: "bt-action",
		targetAgent: deps.agentName,
		retryCount: 0,
		tags: [],
		type: data.goalType ?? "bt-goal",
	});
} else {
	// Fallback: direct workerManager.send (backward compat)
	const fullMessage = context ? `${context}\n\n${goalText}` : goalText;
	deps.workerManager.send(deps.agentName, fullMessage, { task: goalText });
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 4: Run existing agent-process-loop tests**

Run: `npx vitest run tests/domain/agents/agent-process-loop.test.ts --config configs/vitest.config.ts`
Expected: PASS — existing tests still pass (dispatcher is optional, defaults to undefined)

- [ ] **Step 5: Commit**

```bash
git add src/domain/agents/agent-process-loop.ts
git commit -m "feat(agents): route bt-action through task dispatcher when available"
```

---

### Task 9: Wire Standing Order Index to Dispatcher

**Files:**
- Modify: `src/domain/tasks/standing-order-index.ts`

**Note:** The existing `matchEvent()` function returns matched standing orders for a file-system event. The wiring site (where file-watch events are processed) needs to convert matches into `dispatcher.submit()` calls. Since standing-order matching happens at the infrastructure level (file watchers), the actual wiring is a thin adapter — not a change to the domain function itself.

- [ ] **Step 1: Add a `submitMatchedOrders` helper**

Add to `standing-order-index.ts`:

```typescript
import type { TaskEntry } from "./task-dispatcher-types.js";

/** Convert matched standing orders into TaskEntry objects for the dispatcher. */
export function buildEntriesFromMatches(
	matches: readonly IndexedOrder[],
	clock: { ms(): number },
): TaskEntry[] {
	return matches.map((order, i) => ({
		taskId: `so-${clock.ms()}-${i}`,
		title: order.title,
		priority: order.priority ?? "normal",
		requiredCapabilities: order.requiredCapabilities ?? [],
		requiredAgentTier: order.requiredAgentTier ?? "supervised",
		taskTrustTier: order.taskTrustTier ?? "auto",
		reward: order.reward ?? { xp: 10, coin: 5 },
		submittedAt: clock.ms(),
		source: "standing-order" as const,
		targetAgent: order.assignee,
		retryCount: 0,
		tags: order.tags ?? [],
		type: "standing-order",
	}));
}
```

This is a pure mapping function — the caller iterates the result and calls `dispatcher.submit()` for each entry. The infrastructure layer (wherever file watchers trigger `matchEvent`) is responsible for calling this function and submitting.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/domain/tasks/standing-order-index.ts
git commit -m "feat(tasks): add buildEntriesFromMatches for standing order → dispatcher bridge"
```

---

### Task 10: Full Test Suite Verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: PASS — all existing + new tests pass

- [ ] **Step 2: Type-check full project**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 3: Lint full project**

Run: `npx eslint src/ --config configs/eslint.config.mjs`
Expected: PASS

- [ ] **Step 4: Build**

Run: `node configs/esbuild.config.mjs`
Expected: PASS — builds to `.flowti/bin/main.js`

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore(tasks): verify full test suite passes with task dispatcher"
```
