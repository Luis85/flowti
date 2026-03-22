import { describe, it, expect, vi } from "vitest";
import { createProcessPool } from "../../../src/domain/agents/process-pool.js";
import type { AgentProcess, IAgentProcessRunner } from "../../../src/domain/agents/worker-types.js";
import type { AgentSummary } from "../../../src/domain/agents/agent-types.js";
import type { AgentStreamEvent } from "../../../src/domain/agents/agent-stream.js";

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
		expect(vi.mocked(runner.spawn).mock.results[1].value.onEvent).toHaveBeenCalled();
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
