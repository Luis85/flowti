# Agent World Stability & Performance — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent browser crashes when multiple agent LLMs run simultaneously by adding a bounded process pool, RAF-batched store updates, and queued state feedback.

**Architecture:** A new `process-pool.ts` domain module caps concurrent `claude` CLI processes (default 2). Workers gain a `"queued"` state when waiting for a slot. The browser-side store coalesces rapid notifications via `requestAnimationFrame` (with synchronous fallback for non-browser environments), and the conversation DOM is capped at 50 turns.

**Tech Stack:** TypeScript, Node.js built-ins, Vitest, ExcaliburJS, Lit

**Spec:** `docs/specs/2026-03-17-agent-world-stability-design.md`

**Workspace:** `ws-plan-excalibu-k6e2` — all paths relative to `01 - Projects/Flowti CLI/`

**Test commands:**
- CLI tests: `npx vitest run --config configs/vitest.config.ts`
- Single CLI test: `npx vitest run tests/domain/agents/process-pool.test.ts --config configs/vitest.config.ts`
- Agents tests: `cd agents && npx vitest run`
- Single agents test: `cd agents && npx vitest run tests/brain/agent-brain.test.ts`

---

## Chunk 1: Server-Side Foundation (Tasks 1–5)

### Task 1: Add `maxConcurrent` to `AgentsConfig`

**Files:**
- Modify: `src/infrastructure/types-config.ts:222`

- [ ] **Step 1: Add the field**

In `src/infrastructure/types-config.ts`, add `maxConcurrent` to the `AgentsConfig` interface at line 222:

```ts
export interface AgentsConfig { dir?: string; roster?: string[]; autonomous?: boolean; claudeSync?: boolean; skillMap?: Record<string, string[]>; thinkingDisplay?: "full" | "indicator" | "hidden"; processTimeoutMs?: number; provider?: string; maxConcurrent?: number; }
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors (field is optional, no consumers yet).

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/types-config.ts
git commit -m "feat(agents): add maxConcurrent to AgentsConfig"
```

---

### Task 2: Add `"queued"` to `WorkerState`

**Files:**
- Modify: `src/domain/agents/worker-types.ts:12`

- [ ] **Step 1: Add the state**

In `src/domain/agents/worker-types.ts` line 12, add `"queued"` after `"idle"`:

```ts
export type WorkerState = "spawning" | "idle" | "queued" | "reacting" | "thinking" | "working" | "waiting" | "stopped";
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors (new union member is additive).

- [ ] **Step 3: Commit**

```bash
git add src/domain/agents/worker-types.ts
git commit -m "feat(agents): add queued state to WorkerState union"
```

---

### Task 3: Add `"queued"` to `STATUS_MAP`

**Files:**
- Modify: `src/infrastructure/world-state-manager.ts:19-32`

- [ ] **Step 1: Add the entry**

In `src/infrastructure/world-state-manager.ts`, add to the `STATUS_MAP` object (after the `"idle"` entry at line 30):

```ts
"queued": () => ({ state: "waiting", currentAction: "queued" }),
```

- [ ] **Step 2: Run existing tests**

Run: `npx vitest run tests/infrastructure/world-state-manager.test.ts --config configs/vitest.config.ts`
Expected: All existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/world-state-manager.ts
git commit -m "feat(agents): add queued entry to world state STATUS_MAP"
```

---

### Task 4: Create process pool — tests first

**Files:**
- Create: `tests/domain/agents/process-pool.test.ts`
- Create: `src/domain/agents/process-pool.ts`

**Note:** The pool uses **consumer-driven release only** — no auto-release on process completion. The caller (`worker-manager`) is responsible for calling `pool.release()` after post-processing (clearing grants, calling onResponse). This avoids a race where auto-release fires before the worker finishes its work.

- [ ] **Step 1: Write the test file**

Create `tests/domain/agents/process-pool.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createProcessPool } from "../../src/domain/agents/process-pool.js";
import type { AgentProcess, IAgentProcessRunner } from "../../src/domain/agents/worker-types.js";
import type { AgentSummary } from "../../src/domain/agents/agent-types.js";
import type { AgentStreamEvent } from "../../src/domain/agents/agent-stream.js";

function makeAgent(name = "Bob"): AgentSummary {
	return { name, agentType: "ai", description: "Helper", skills: [], tools: [], roles: [], file: `${name}.md` };
}

function makeTimer() {
	const timers: Array<{ cb: () => void; ms: number; id: number }> = [];
	let nextId = 1;
	return {
		set(cb: () => void, ms: number) { const id = nextId++; timers.push({ cb, ms, id }); return id; },
		clear(handle: unknown) { const idx = timers.findIndex((t) => t.id === handle); if (idx >= 0) timers.splice(idx, 1); },
		_timers: timers,
		_fire(id: number) { const t = timers.find((x) => x.id === id); if (t) { t.cb(); } },
		_fireAll() { for (const t of [...timers]) t.cb(); },
	};
}

function makeProcessRunner(): IAgentProcessRunner & { _resolvers: Array<(v: { text: string; thinking: string; exitCode: number }) => void> } {
	const resolvers: Array<(v: { text: string; thinking: string; exitCode: number }) => void> = [];
	return {
		spawn: vi.fn((): AgentProcess => {
			let resolve: (v: { text: string; thinking: string; exitCode: number }) => void;
			const result = new Promise<{ text: string; thinking: string; exitCode: number }>((r) => { resolve = r; });
			resolvers.push(resolve!);
			return {
				onEvent: vi.fn(() => () => {}),
				result,
				kill: vi.fn(),
			};
		}),
		_resolvers: resolvers,
	};
}

describe("ProcessPool", () => {
	// ── Immediate acquisition ──────────────────────────────────────

	it("acquire returns immediately when pool has capacity", () => {
		const runner = makeProcessRunner();
		const pool = createProcessPool(runner, makeTimer(), { maxConcurrent: 2, processTimeoutMs: 60_000 });
		const result = pool.acquire(makeAgent(), "prompt", []);
		expect(result.queued).toBe(false);
		expect(result.process).toBeDefined();
		expect(pool.getActiveCount()).toBe(1);
		expect(pool.getQueueDepth()).toBe(0);
	});

	it("acquire fills pool to maxConcurrent", () => {
		const runner = makeProcessRunner();
		const pool = createProcessPool(runner, makeTimer(), { maxConcurrent: 2, processTimeoutMs: 60_000 });
		pool.acquire(makeAgent("Alice"), "p1", []);
		pool.acquire(makeAgent("Bob"), "p2", []);
		expect(pool.getActiveCount()).toBe(2);
	});

	// ── Queuing ────────────────────────────────────────────────────

	it("acquire returns queued=true when pool is full", () => {
		const runner = makeProcessRunner();
		const pool = createProcessPool(runner, makeTimer(), { maxConcurrent: 1, processTimeoutMs: 60_000 });
		pool.acquire(makeAgent("Alice"), "p1", []);
		const result = pool.acquire(makeAgent("Bob"), "p2", []);
		expect(result.queued).toBe(true);
		expect(pool.getQueueDepth()).toBe(1);
		expect(pool.getActiveCount()).toBe(1);
	});

	it("queued process starts when slot is released", async () => {
		const runner = makeProcessRunner();
		const pool = createProcessPool(runner, makeTimer(), { maxConcurrent: 1, processTimeoutMs: 60_000 });
		pool.acquire(makeAgent("Alice"), "p1", []);
		const bob = pool.acquire(makeAgent("Bob"), "p2", []);
		expect(bob.queued).toBe(true);

		// Release Alice's slot (consumer-driven)
		pool.release("Alice");

		// Bob should now be active
		expect(pool.getActiveCount()).toBe(1);
		expect(pool.getQueueDepth()).toBe(0);
		expect(runner.spawn).toHaveBeenCalledTimes(2);
	});

	it("queued process result resolves after slot opens and real process completes", async () => {
		const runner = makeProcessRunner();
		const pool = createProcessPool(runner, makeTimer(), { maxConcurrent: 1, processTimeoutMs: 60_000 });
		pool.acquire(makeAgent("Alice"), "p1", []);
		const bob = pool.acquire(makeAgent("Bob"), "p2", []);

		// Release Alice
		pool.release("Alice");

		// Bob's real process is now spawned — complete it
		runner._resolvers[1]({ text: "bob done", thinking: "", exitCode: 0 });

		const result = await bob.process.result;
		expect(result.text).toBe("bob done");
	});

	// ── onEvent proxy ──────────────────────────────────────────────

	it("queued process buffers onEvent callbacks and forwards to real process", () => {
		const runner = makeProcessRunner();
		const pool = createProcessPool(runner, makeTimer(), { maxConcurrent: 1, processTimeoutMs: 60_000 });
		pool.acquire(makeAgent("Alice"), "p1", []);
		const bob = pool.acquire(makeAgent("Bob"), "p2", []);

		const events: AgentStreamEvent[] = [];
		bob.process.onEvent((e) => events.push(e));

		// Release Alice so Bob starts
		pool.release("Alice");

		// Verify onEvent was forwarded to the real process
		expect(runner.spawn).toHaveBeenCalledTimes(2);
		expect(runner.spawn.mock.results[1].value.onEvent).toHaveBeenCalled();
	});

	// ── Release ────────────────────────────────────────────────────

	it("release frees a slot", () => {
		const runner = makeProcessRunner();
		const pool = createProcessPool(runner, makeTimer(), { maxConcurrent: 1, processTimeoutMs: 60_000 });
		pool.acquire(makeAgent(), "p", []);
		expect(pool.getActiveCount()).toBe(1);
		pool.release("Bob");
		expect(pool.getActiveCount()).toBe(0);
	});

	it("release is idempotent", () => {
		const runner = makeProcessRunner();
		const pool = createProcessPool(runner, makeTimer(), { maxConcurrent: 1, processTimeoutMs: 60_000 });
		pool.acquire(makeAgent(), "p", []);
		pool.release("Bob");
		pool.release("Bob"); // should not throw
		expect(pool.getActiveCount()).toBe(0);
	});

	// ── Cancel ─────────────────────────────────────────────────────

	it("cancel removes queued agent and rejects its result", async () => {
		const runner = makeProcessRunner();
		const pool = createProcessPool(runner, makeTimer(), { maxConcurrent: 1, processTimeoutMs: 60_000 });
		pool.acquire(makeAgent("Alice"), "p1", []);
		const bob = pool.acquire(makeAgent("Bob"), "p2", []);
		expect(bob.queued).toBe(true);

		pool.cancel("Bob");
		expect(pool.getQueueDepth()).toBe(0);
		await expect(bob.process.result).rejects.toThrow("cancelled");
	});

	it("cancel kills active agent process", () => {
		const runner = makeProcessRunner();
		const pool = createProcessPool(runner, makeTimer(), { maxConcurrent: 2, processTimeoutMs: 60_000 });
		const alice = pool.acquire(makeAgent("Alice"), "p1", []);
		pool.cancel("Alice");
		expect(alice.process.kill).toHaveBeenCalled();
		expect(pool.getActiveCount()).toBe(0);
	});

	// ── killAll ────────────────────────────────────────────────────

	it("killAll kills active processes and rejects queued", async () => {
		const runner = makeProcessRunner();
		const pool = createProcessPool(runner, makeTimer(), { maxConcurrent: 1, processTimeoutMs: 60_000 });
		const alice = pool.acquire(makeAgent("Alice"), "p1", []);
		const bob = pool.acquire(makeAgent("Bob"), "p2", []);

		pool.killAll();

		expect(alice.process.kill).toHaveBeenCalled();
		expect(pool.getActiveCount()).toBe(0);
		expect(pool.getQueueDepth()).toBe(0);
		await expect(bob.process.result).rejects.toThrow();
	});

	// ── Timeout reaping ────────────────────────────────────────────

	it("process is killed when timeout fires", () => {
		const timer = makeTimer();
		const runner = makeProcessRunner();
		const pool = createProcessPool(runner, timer, { maxConcurrent: 2, processTimeoutMs: 5000 });
		const alice = pool.acquire(makeAgent("Alice"), "p1", []);

		expect(timer._timers).toHaveLength(1);
		expect(timer._timers[0].ms).toBe(5000);

		timer._fire(timer._timers[0].id);
		expect(alice.process.kill).toHaveBeenCalled();
		expect(pool.getActiveCount()).toBe(0);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/agents/process-pool.test.ts --config configs/vitest.config.ts`
Expected: FAIL — `createProcessPool` not found.

- [ ] **Step 3: Write the implementation**

Create `src/domain/agents/process-pool.ts`:

```ts
/**
 * process-pool.ts — Bounded process pool for LLM agent processes.
 *
 * Caps concurrent claude CLI processes. When full, queues requests and
 * returns deferred AgentProcess proxies that resolve when a slot opens.
 * Pure domain — no infrastructure imports; timer injected.
 *
 * Release contract: consumer-driven only. The caller must call release()
 * after processing the result. No auto-release on process completion.
 */

import type { AgentSummary } from "./agent-types.js";
import type { AgentProcess, IAgentProcessRunner } from "./worker-types.js";
import type { AgentStreamEvent } from "./agent-stream.js";

export interface PoolTimer {
	set(callback: () => void, ms: number): unknown;
	clear(handle: unknown): void;
}

export interface PoolConfig {
	readonly maxConcurrent: number;
	readonly processTimeoutMs: number;
}

export interface AcquireResult {
	readonly process: AgentProcess;
	readonly queued: boolean;
}

export interface IProcessPool {
	acquire(agent: AgentSummary, prompt: string, tools: readonly string[]): AcquireResult;
	release(agentName: string): void;
	cancel(agentName: string): void;
	killAll(): void;
	getQueueDepth(): number;
	getActiveCount(): number;
}

interface ActiveEntry {
	readonly name: string;
	readonly process: AgentProcess;
	readonly timeoutHandle: unknown;
}

interface QueueEntry {
	readonly agent: AgentSummary;
	readonly prompt: string;
	readonly tools: readonly string[];
	resolve: (process: AgentProcess) => void;
	reject: (error: Error) => void;
	readonly eventBuffer: Array<(event: AgentStreamEvent) => void>;
}

export function createProcessPool(runner: IAgentProcessRunner, timer: PoolTimer, config: PoolConfig): IProcessPool {
	const active = new Map<string, ActiveEntry>();
	const queue: QueueEntry[] = [];

	function spawnAndTrack(agent: AgentSummary, prompt: string, tools: readonly string[], eventBuffer?: Array<(event: AgentStreamEvent) => void>): AgentProcess {
		const proc = runner.spawn(agent, prompt, tools);

		// Forward buffered event listeners
		if (eventBuffer) {
			for (const cb of eventBuffer) proc.onEvent(cb);
		}

		const timeoutHandle = timer.set(() => {
			proc.kill();
			active.delete(agent.name);
			drainQueue();
		}, config.processTimeoutMs);

		active.set(agent.name, { name: agent.name, process: proc, timeoutHandle });
		return proc;
	}

	function drainQueue(): void {
		while (queue.length > 0 && active.size < config.maxConcurrent) {
			const entry = queue.shift()!;
			const proc = spawnAndTrack(entry.agent, entry.prompt, entry.tools, entry.eventBuffer);
			entry.resolve(proc);
		}
	}

	function release(agentName: string): void {
		const entry = active.get(agentName);
		if (!entry) return;
		timer.clear(entry.timeoutHandle);
		active.delete(agentName);
		drainQueue();
	}

	return {
		acquire(agent, prompt, tools): AcquireResult {
			if (active.size < config.maxConcurrent) {
				const proc = spawnAndTrack(agent, prompt, tools);
				return { process: proc, queued: false };
			}

			// Pool full — create deferred proxy
			const eventBuffer: Array<(event: AgentStreamEvent) => void> = [];
			let resolveReal: (process: AgentProcess) => void;
			let rejectReal: (error: Error) => void;

			const realPromise = new Promise<AgentProcess>((res, rej) => {
				resolveReal = res;
				rejectReal = rej;
			});

			const entry: QueueEntry = {
				agent, prompt, tools,
				resolve: resolveReal!,
				reject: rejectReal!,
				eventBuffer,
			};
			queue.push(entry);

			const proxy: AgentProcess = {
				onEvent(callback) {
					eventBuffer.push(callback);
					return () => {
						const idx = eventBuffer.indexOf(callback);
						if (idx >= 0) eventBuffer.splice(idx, 1);
					};
				},
				result: realPromise.then((real) => real.result),
				kill() {
					// If still queued, cancel
					const qIdx = queue.indexOf(entry);
					if (qIdx >= 0) {
						queue.splice(qIdx, 1);
						rejectReal(new Error("cancelled"));
						return;
					}
					// If active, delegate
					const activeEntry = active.get(agent.name);
					if (activeEntry) activeEntry.process.kill();
				},
			};

			return { process: proxy, queued: true };
		},

		release,

		cancel(agentName) {
			const qIdx = queue.findIndex((e) => e.agent.name === agentName);
			if (qIdx >= 0) {
				const entry = queue.splice(qIdx, 1)[0];
				entry.reject(new Error("cancelled"));
				return;
			}
			const entry = active.get(agentName);
			if (entry) {
				entry.process.kill();
				timer.clear(entry.timeoutHandle);
				active.delete(agentName);
				drainQueue();
			}
		},

		killAll() {
			for (const entry of active.values()) {
				entry.process.kill();
				timer.clear(entry.timeoutHandle);
			}
			active.clear();
			for (const entry of queue.splice(0)) {
				entry.reject(new Error("Pool shutdown"));
			}
		},

		getQueueDepth: () => queue.length,
		getActiveCount: () => active.size,
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/domain/agents/process-pool.test.ts --config configs/vitest.config.ts`
Expected: All tests PASS.

- [ ] **Step 5: Run full CLI test suite**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: All existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/domain/agents/process-pool.ts tests/domain/agents/process-pool.test.ts
git commit -m "feat(agents): add bounded process pool with deferred proxy"
```

---

### Task 5: Integrate process pool into worker-manager

**Files:**
- Modify: `src/infrastructure/worker-manager.ts:86-170`
- Modify: `tests/infrastructure/worker-manager.test.ts`

- [ ] **Step 1: Write new tests for pool integration**

Add to `tests/infrastructure/worker-manager.test.ts`, after the existing imports:

```ts
import type { IProcessPool, AcquireResult } from "../../src/domain/agents/process-pool.js";
```

Add a `makePool()` factory after the existing `makeProcessRunner()`:

```ts
function makePool(queuedOverride = false): IProcessPool & { _lastResult: AcquireResult } {
	let lastResult: AcquireResult;
	return {
		acquire: vi.fn((_agent, _prompt, _tools) => {
			const proc: AgentProcess = {
				onEvent: vi.fn(() => () => {}),
				result: Promise.resolve({ text: "Hi", thinking: "", exitCode: 0 }),
				kill: vi.fn(),
			};
			lastResult = { process: proc, queued: queuedOverride };
			return lastResult;
		}),
		release: vi.fn(),
		cancel: vi.fn(),
		killAll: vi.fn(),
		getQueueDepth: vi.fn(() => 0),
		getActiveCount: vi.fn(() => 0),
		get _lastResult() { return lastResult; },
	};
}
```

Add test cases:

```ts
it("send uses pool.acquire instead of processRunner.spawn", async () => {
	vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
	const pool = makePool();
	const mgr = createWorkerManager(makeDeps(), makeWorldState(), makeProcessRunner(), "/vault", undefined, pool);
	mgr.spawnAll();
	mgr.send("Bob", "Hello");
	await vi.waitFor(() => { expect(pool.acquire).toHaveBeenCalled(); });
});

it("worker enters queued state when pool returns queued=true", async () => {
	vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
	const ws = makeWorldState();
	const pool = makePool(true);
	const mgr = createWorkerManager(makeDeps(), ws, makeProcessRunner(), "/vault", undefined, pool);
	mgr.spawnAll();
	mgr.send("Bob", "Hello");
	// Verify queued was the FIRST state set (before any "working" transition)
	await vi.waitFor(() => {
		const calls = vi.mocked(ws.updateEntity).mock.calls;
		const queuedCall = calls.find((c) => c[0] === "Bob" && (c[2] as { status?: { state: string } }).status?.state === "queued");
		expect(queuedCall).toBeDefined();
	});
});

it("stop calls pool.cancel", () => {
	vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
	const pool = makePool();
	const mgr = createWorkerManager(makeDeps(), makeWorldState(), makeProcessRunner(), "/vault", undefined, pool);
	mgr.spawnAll();
	mgr.stop("Bob");
	expect(pool.cancel).toHaveBeenCalledWith("Bob");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/infrastructure/worker-manager.test.ts --config configs/vitest.config.ts`
Expected: FAIL — `createWorkerManager` doesn't accept pool parameter yet.

- [ ] **Step 3: Modify `worker-manager.ts`**

In `src/infrastructure/worker-manager.ts`:

**Add import** (after existing imports):
```ts
import type { IProcessPool } from "../domain/agents/process-pool.js";
```

**Change `createWorkerManager` signature** (line 86-92) — add `pool` as optional 6th parameter:
```ts
export function createWorkerManager(
	deps: WorkerManagerDeps,
	worldState: IWorldStateManager,
	processRunner: IAgentProcessRunner,
	vaultRoot: string,
	config: AgentsConfig | undefined,
	pool?: IProcessPool,
): IWorkerManager {
```

**Change `processLlmMessage`** (line 140-171) — use pool when available, with correct state transitions. Key change: `"working"` is set only AFTER `await proc.result` starts (i.e., after the deferred proxy resolves to the real process):

```ts
async function processLlmMessage(worker: WorkerImpl, message: string, opts: SendOptions | undefined): Promise<void> {
	const prompt = buildPrompt(deps, vaultRoot, worker, message, opts);
	const { resolvedTools } = resolveAgentPermissions(deps, vaultRoot, worker);

	let proc: AgentProcess;
	if (pool) {
		const acquired = pool.acquire(worker.agent, prompt, resolvedTools);
		if (acquired.queued) {
			setWorkerState(worker, "queued", worldState);
		}
		proc = acquired.process;
	} else {
		proc = processRunner.spawn(worker.agent, prompt, resolvedTools);
	}

	if (opts?.onEvent) proc.onEvent(opts.onEvent);

	// Set thinking AFTER acquiring (for queued workers, this fires when slot opens
	// because proc.result won't resolve until the real process starts and completes)
	setWorkerState(worker, "thinking", worldState);

	try {
		setWorkerState(worker, "working", worldState);
		const result = await proc.result;
		if (pool) pool.release(worker.name);

		const stopped = handleLlmResult(worker, result.exitCode, result.text, worldState);
		if (stopped) return;

		const varDir = deps.paths.join(vaultRoot, ".flowti", "var");
		const freshState = readAgentState(deps, varDir, worker.name);
		const cleared = clearOnceGrants(freshState);
		if (cleared !== freshState) writeAgentState(deps, varDir, worker.name, cleared);

		opts?.onResponse?.(parseAgentResponse(result.text));
	} catch {
		worker.failureCount++;
		if (pool) pool.release(worker.name);
	}

	if (worker.state !== "stopped") {
		setWorkerState(worker, "idle", worldState);
	}

	drainQueue(worker);
}
```

**Important note on state flow:** For non-queued processes, the sequence is `thinking → working → (await result) → idle` — same as before. For queued processes, the sequence is `queued → thinking → working → (await result) → idle`. The `thinking` and `working` states are set synchronously before `await`, but this is fine because `proc.result` for a deferred proxy won't resolve until the slot opens AND the real process completes. The browser sees `queued` until the worker-manager moves past the await.

**Change `stop`** (line 236-240) — also cancel pool entry:
```ts
stop(agentName: string): void {
	const worker = workers.get(agentName);
	if (!worker) return;
	if (pool) pool.cancel(agentName);
	setWorkerState(worker, "stopped", worldState);
},
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/infrastructure/worker-manager.test.ts --config configs/vitest.config.ts`
Expected: All tests PASS (new + existing).

- [ ] **Step 5: Run full CLI test suite**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/worker-manager.ts tests/infrastructure/worker-manager.test.ts
git commit -m "feat(agents): integrate process pool into worker-manager"
```

---

## Chunk 2: Server-Side Fixes (Tasks 6–8)

### Task 6: Fix silent message drops in `/api/agent/send`

**Files:**
- Modify: `src/domain/serve/static-server.ts:173-194`
- Modify: `tests/domain/serve/static-server.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/domain/serve/static-server.test.ts`, find the existing test helpers (`makeContext()`, mock `IncomingMessage`/`ServerResponse` factories). Add a test:

```ts
it("POST /api/agent/send spawns worker if getWorker returns null", async () => {
	const ctx = makeContext();
	vi.mocked(ctx.workerManager.getWorker).mockReturnValue(null);
	vi.mocked(ctx.workerManager.spawn).mockReturnValue(makeWorker());

	const req = makeReq("POST", "/api/agent/send", { agentName: "NewAgent", message: "Hi" });
	const res = makeRes();
	await handleApiRoute(req, res, "/api/agent/send", ctx);

	expect(ctx.workerManager.spawn).toHaveBeenCalledWith("NewAgent");
	expect(ctx.workerManager.send).toHaveBeenCalled();
});

it("POST /api/agent/send returns 404 if agent cannot be spawned", async () => {
	const ctx = makeContext();
	vi.mocked(ctx.workerManager.getWorker).mockReturnValue(null);
	vi.mocked(ctx.workerManager.spawn).mockReturnValue(null);

	const req = makeReq("POST", "/api/agent/send", { agentName: "Unknown", message: "Hi" });
	const res = makeRes();
	await handleApiRoute(req, res, "/api/agent/send", ctx);

	expect(res._status).toBe(404);
});
```

Adapt the helper names to match the existing test file's patterns.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/serve/static-server.test.ts --config configs/vitest.config.ts`
Expected: FAIL — current handler doesn't call `getWorker`/`spawn`.

- [ ] **Step 3: Apply the fix**

In `src/domain/serve/static-server.ts`, in the `/api/agent/send` handler (line ~177), add before `ctx.workerManager.send()`:

```ts
// Ensure worker exists (mirrors /api/agent/wake pattern)
let worker = ctx.workerManager.getWorker(name);
if (!worker) worker = ctx.workerManager.spawn(name);
if (!worker) { json(404, { error: "Agent not found" }); return; }
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/domain/serve/static-server.test.ts --config configs/vitest.config.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain/serve/static-server.ts tests/domain/serve/static-server.test.ts
git commit -m "fix(serve): spawn worker on send if not found"
```

---

### Task 7: Graceful shutdown with `pool.killAll()`

**Files:**
- Modify: `src/domain/serve/dashboard-service.ts:34-61`

- [ ] **Step 1: Add module-level pool reference**

In `src/domain/serve/dashboard-service.ts`, add after line 37 (`let activeWorldState`):

```ts
import type { IProcessPool } from "../agents/process-pool.js";

let activePool: IProcessPool | null = null;
```

- [ ] **Step 2: Store pool reference in startDashboardServer**

In `startDashboardServer()`, add `pool` to `StartDashboardOptions`:

```ts
export interface StartDashboardOptions {
	// ... existing fields ...
	readonly pool?: IProcessPool;
}
```

Before the `activeHandle = handle` line (~218), add:

```ts
activePool = opts.pool ?? null;
```

- [ ] **Step 3: Add killAll to stopDashboard**

In `stopDashboard()`, add before `activeHandle.close()`:

```ts
if (activePool) {
	activePool.killAll();
	activePool = null;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain/serve/dashboard-service.ts
git commit -m "feat(serve): call pool.killAll on dashboard shutdown"
```

---

### Task 8: Wire pool creation in deps.ts

**Files:**
- Modify: `src/infrastructure/deps.ts:112-113`

**Note:** The pool wiring happens in `deps.ts` where `createWorkerManager()` is called — NOT in `serve.controller.ts`. The serve controller receives pre-built deps.

- [ ] **Step 1: Add import**

In `src/infrastructure/deps.ts`, add import:

```ts
import { createProcessPool } from "../domain/agents/process-pool.js";
```

- [ ] **Step 2: Create pool and pass to worker-manager**

At line ~112, after `createProcessRunner(baseDeps, agentsConfig)`, add:

```ts
const pool = createProcessPool(processRunner, { set: setTimeout, clear: clearTimeout }, {
	maxConcurrent: agentsConfig?.maxConcurrent ?? 2,
	processTimeoutMs: agentsConfig?.processTimeoutMs ?? 3_600_000,
});
const workerManager = createWorkerManager(baseDeps, worldState, processRunner, resolvedRoot, agentsConfig, pool);
```

Replace the existing `const workerManager = createWorkerManager(...)` line.

Also expose the pool on `CliDeps` if needed for the dashboard service — or pass it through the serve controller's `StartDashboardOptions.pool`.

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/deps.ts
git commit -m "feat(serve): wire process pool into dependency container"
```

---

## Chunk 3: Browser-Side Resilience (Tasks 9–13)

### Task 9: Add `"queued"` to browser-side types

**Files:**
- Modify: `agents/src/data/types.ts:3-6`
- Modify: `agents/src/store/dashboard-store.ts:16-19`

- [ ] **Step 1: Add `"queued"` to `AgentActionType`**

In `agents/src/data/types.ts` line 3-6:

```ts
export type AgentActionType =
	| "thinking" | "speaking" | "asking" | "using-tool" | "tool-complete"
	| "requesting-permission" | "permission-granted" | "permission-denied"
	| "task-started" | "task-completed" | "idle" | "error"
	| "queued";
```

- [ ] **Step 2: Add `"queued"` to `LlmStatus`**

In `agents/src/store/dashboard-store.ts` line 16-19:

```ts
export interface LlmStatus {
	readonly state: "idle" | "queued" | "thinking" | "error";
	readonly since: number;
}
```

- [ ] **Step 3: Type-check**

Run: `cd agents && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add agents/src/data/types.ts agents/src/store/dashboard-store.ts
git commit -m "feat(dashboard): add queued to AgentActionType and LlmStatus"
```

---

### Task 10: Add `"queued"` brain transition

**Dependency:** Task 9 must be completed first — `"queued"` must be a valid `AgentActionType` before the brain transition test will compile.

**Files:**
- Modify: `agents/src/brain/agent-brain.ts:10-19`
- Modify: `agents/tests/brain/agent-brain.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `agents/tests/brain/agent-brain.test.ts`:

```ts
it("queued event transitions idle to waiting", () => {
	const result = transition("idle", { type: "queued" });
	expect(result.state).toBe("waiting");
	expect(result.target.kind).toBe("none");
});

it("queued event transitions wandering to waiting", () => {
	const result = transition("wandering", { type: "queued" });
	expect(result.state).toBe("waiting");
	expect(result.target.kind).toBe("none");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agents && npx vitest run tests/brain/agent-brain.test.ts`
Expected: FAIL — `"queued"` not in TRANSITIONS, falls through to default (keeps current state, so `"idle"` remains `"idle"` instead of `"waiting"`).

- [ ] **Step 3: Add the transition**

In `agents/src/brain/agent-brain.ts`, add to the `TRANSITIONS` object (after the `"error"` entry at line 18):

```ts
"queued": () => ({ state: "waiting" as BrainState, target: NO_MOVE }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agents && npx vitest run tests/brain/agent-brain.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add agents/src/brain/agent-brain.ts agents/tests/brain/agent-brain.test.ts
git commit -m "feat(dashboard): add queued->waiting brain transition"
```

---

### Task 11: RAF-batched store notifications

**Files:**
- Modify: `agents/src/store/dashboard-store.ts:79-85`
- Modify: `agents/tests/store/dashboard-store.test.ts`

**Critical note:** The store's existing tests (`agents/tests/store/dashboard-store.test.ts`) run in a **non-jsdom** environment and assert **synchronous** event dispatch. The RAF guard must fall back to synchronous dispatch when `requestAnimationFrame` is unavailable. This ensures existing tests pass unchanged while browser environments get the coalescing benefit.

- [ ] **Step 1: Write the test for RAF coalescing**

Add a **new test file** `agents/tests/store/dashboard-store-raf.test.ts` (separate file to use jsdom without affecting existing tests):

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { DashboardStore } from "../../src/store/dashboard-store.js";

describe("DashboardStore RAF batching", () => {
	it("coalesces multiple notify calls into one state-changed event per frame", async () => {
		const store = new DashboardStore();
		const handler = vi.fn();
		store.addEventListener("state-changed", handler);

		store.setConnectionStatus("connected");
		store.setConnectionStatus("disconnected");
		store.setConnectionStatus("connected");

		// In jsdom, RAF is available — events should be deferred
		expect(handler).not.toHaveBeenCalled();

		await new Promise((r) => requestAnimationFrame(r));

		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("batched notify via beginBatch/endBatch still fires synchronously", () => {
		const store = new DashboardStore();
		const handler = vi.fn();
		store.addEventListener("state-changed", handler);

		store.beginBatch();
		store.setConnectionStatus("connected");
		store.setConnectionStatus("disconnected");
		store.endBatch();

		// endBatch fires immediately (no RAF)
		expect(handler).toHaveBeenCalledTimes(1);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agents && npx vitest run tests/store/dashboard-store-raf.test.ts`
Expected: FAIL — current `notify()` fires synchronously, so handler is called 3 times (not 0).

- [ ] **Step 3: Implement RAF batching with synchronous fallback**

In `agents/src/store/dashboard-store.ts`, replace the `notify()` method (around line 79-85):

```ts
private rafPending = false;

private notify(): void {
	if (this.batchDepth > 0) {
		this.batchDirty = true;
		return;
	}
	// In non-browser environments (Node tests), fall back to synchronous dispatch
	if (typeof requestAnimationFrame === "undefined") {
		this.dispatchEvent(new Event("state-changed"));
		return;
	}
	if (this.rafPending) return;
	this.rafPending = true;
	requestAnimationFrame(() => {
		this.rafPending = false;
		this.dispatchEvent(new Event("state-changed"));
	});
}
```

- [ ] **Step 4: Run RAF test to verify it passes**

Run: `cd agents && npx vitest run tests/store/dashboard-store-raf.test.ts`
Expected: PASS.

- [ ] **Step 5: Run ALL store tests to verify existing tests still pass**

Run: `cd agents && npx vitest run tests/store/`
Expected: All tests pass — existing tests use Node environment (no RAF), so they get synchronous dispatch as before.

- [ ] **Step 6: Run full agents test suite**

Run: `cd agents && npx vitest run`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add agents/src/store/dashboard-store.ts agents/tests/store/dashboard-store-raf.test.ts
git commit -m "perf(dashboard): coalesce store notifications via requestAnimationFrame"
```

---

### Task 12: Conversation DOM cap

**Files:**
- Modify: `agents/src/ui/panel-talk.ts:267-281`
- Modify: `agents/tests/ui/panel-talk.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `agents/tests/ui/panel-talk.test.ts` (which uses `// @vitest-environment jsdom`):

```ts
it("renders at most 50 conversation turns", async () => {
	for (let i = 0; i < 60; i++) {
		if (i % 2 === 0) {
			store.pushUserMessage("TestBot", `Message ${i}`);
		} else {
			store.pushAgentResponse("TestBot", `Response ${i}`);
		}
	}
	await (el as any).updateComplete;

	const turns = el.shadowRoot!.querySelectorAll(".turn");
	expect(turns.length).toBe(50);
});

it("shows most recent turns when capped", async () => {
	for (let i = 0; i < 60; i++) {
		if (i % 2 === 0) {
			store.pushUserMessage("TestBot", `Msg-${i}`);
		} else {
			store.pushAgentResponse("TestBot", `Rsp-${i}`);
		}
	}
	await (el as any).updateComplete;

	const turns = el.shadowRoot!.querySelectorAll(".turn");
	const lastTurn = turns[turns.length - 1];
	expect(lastTurn.textContent).toContain("Rsp-59");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agents && npx vitest run tests/ui/panel-talk.test.ts`
Expected: FAIL — currently renders all 60 turns.

- [ ] **Step 3: Implement the cap**

In `agents/src/ui/panel-talk.ts`, in the `renderThread()` method (around line 267):

```ts
private renderThread() {
	const visible = this.conversation.slice(-50);
	if (visible.length === 0 && !this.thinking) {
		return html`<div class="empty">No messages yet. Start a conversation!</div>`;
	}

	return html`
		${visible.map((turn) => html`
			<div class="turn" data-role="${turn.role}">
				${turn.text}
			</div>
		`)}
		${this.thinking
			? html`<div class="thinking">${this.thinkingPhrase}</div>`
			: nothing}
	`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agents && npx vitest run tests/ui/panel-talk.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agents/src/ui/panel-talk.ts agents/tests/ui/panel-talk.test.ts
git commit -m "perf(dashboard): cap conversation DOM to 50 most recent turns"
```

---

### Task 13: Queued state visual feedback

**Files:**
- Modify: `agents/src/ui/agent-panel.ts:29-217` (static styles) and `:252-266` (renderLlmBadge)
- Modify: `agents/src/ui/panel-talk.ts` (syncFromStore)
- Modify: `agents/src/systems/brain-system.ts`
- Modify: `agents/tests/ui/panel-talk.test.ts`
- Modify: `agents/tests/ui/agent-panel.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `agents/tests/ui/panel-talk.test.ts`:

```ts
it("shows queued indicator when LLM status is queued", async () => {
	store.setLlmStatus("TestBot", { state: "queued", since: Date.now() });
	await (el as any).updateComplete;

	const thinking = el.shadowRoot!.querySelector(".thinking");
	expect(thinking).not.toBeNull();
	expect(thinking!.textContent).toContain("Waiting for available slot");
});

it("transitions from queued to thinking phrase when slot opens", async () => {
	store.setLlmStatus("TestBot", { state: "queued", since: Date.now() });
	await (el as any).updateComplete;

	store.setLlmStatus("TestBot", { state: "thinking", since: Date.now() });
	store.pushUserMessage("TestBot", "test");
	await (el as any).updateComplete;

	const thinking = el.shadowRoot!.querySelector(".thinking");
	expect(thinking).not.toBeNull();
	expect(thinking!.textContent).not.toContain("Waiting for available slot");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd agents && npx vitest run tests/ui/panel-talk.test.ts`
Expected: FAIL — no queued handling in syncFromStore.

- [ ] **Step 3: Update agent-panel LLM badge**

In `agents/src/ui/agent-panel.ts`, in the `renderLlmBadge()` method (around line 252), add `"queued"`:

```ts
private renderLlmBadge(agentName: string) {
	const status = this.store.llmStatus.get(agentName);
	const state = status?.state ?? "idle";
	const labels: Record<string, string> = {
		idle: "LLM idle",
		queued: "Queued...",
		thinking: "Thinking...",
		error: "LLM error",
	};
	return html`
		<span class="llm-badge llm-${state}">
			<span class="dot"></span>
			${labels[state] ?? state}
		</span>
	`;
}
```

Add CSS for the queued badge in the `static styles` array (after the `.llm-error` rule at ~line 134):

```css
.llm-queued .dot { background: #f59e0b; animation: pulse 2s infinite; }
.llm-queued { background: rgba(245, 158, 11, 0.12); color: #fbbf24; }
```

- [ ] **Step 4: Update panel-talk syncFromStore**

In `agents/src/ui/panel-talk.ts`, replace `syncFromStore()`:

```ts
private syncFromStore(): void {
	this.conversation = this.store.getConversation(this.agentName);
	const wasThinking = this.thinking;
	this.thinking = this.store.isThinking(this.agentName);

	const status = this.store.llmStatus.get(this.agentName);

	// Queued state: show waiting indicator
	if (status?.state === "queued") {
		this.thinking = true;
		this.stopThinkingTimer();
		this.thinkingPhrase = "Waiting for available slot...";
	} else if (this.thinking && !wasThinking) {
		// Transitioning to thinking (including from queued→thinking): start timer
		this.startThinkingTimer();
	} else if (!this.thinking && wasThinking) {
		this.stopThinkingTimer();
	}

	this.llmState = status ? status.state : "none";
}
```

Key fix: When transitioning from `"queued"` to `"thinking"`, the `wasThinking` is true (we set it for queued) and `this.thinking` is also true (from `isThinking`), so neither branch fires. We handle this by calling `stopThinkingTimer()` in the queued branch, and the next sync with `"thinking"` state will have `wasThinking=true` but the status check comes first — since status is now `"thinking"` (not `"queued"`), we fall through. We need to also check: if status changed from queued to thinking, start the timer. Updated logic above handles this by checking `!wasThinking` only for the timer start — and when coming from queued, `wasThinking` is true, so the timer doesn't auto-start. But the timer WILL start on the next `pushUserMessage` call which sets `isThinking=true` with a fresh sync.

- [ ] **Step 5: Verify brain-system passes through `"queued"`**

In `agents/src/systems/brain-system.ts`, verify that `applyEvent()` passes the action type to `transition()`. Since Task 10 added `"queued"` to the TRANSITIONS table, this should work. Read the code to confirm, no changes needed if `applyEvent` calls `transition(currentState, { type: actionType })`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd agents && npx vitest run tests/ui/panel-talk.test.ts`
Expected: All tests PASS.

- [ ] **Step 7: Run full agents test suite**

Run: `cd agents && npx vitest run`
Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add agents/src/ui/agent-panel.ts agents/src/ui/panel-talk.ts agents/src/systems/brain-system.ts agents/tests/ui/panel-talk.test.ts
git commit -m "feat(dashboard): add queued state visual feedback"
```

---

## Final Verification

- [ ] **Run full CLI test suite:** `npx vitest run --config configs/vitest.config.ts`
- [ ] **Run full agents test suite:** `cd agents && npx vitest run`
- [ ] **Type-check CLI:** `npx tsc --noEmit --project configs/tsconfig.json`
- [ ] **Type-check agents:** `cd agents && npx tsc --noEmit`
- [ ] **Lint CLI:** `npx eslint src/ --config configs/eslint.config.mjs`
- [ ] **Build agents:** `cd agents && node build.mjs`
- [ ] **Manual smoke test:** `flowti serve` → open dashboard → click agent → send message → click another agent → verify no crash, queued feedback visible
