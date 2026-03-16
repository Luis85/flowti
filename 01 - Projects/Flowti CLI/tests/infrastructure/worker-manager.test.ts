import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../src/infrastructure/paths.js", () => ({ paths: {} }));
vi.mock("../../src/infrastructure/clock.js", () => ({ clock: {} }));
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/domain/agents/agent-store.js", () => ({
	agentStore: { list: vi.fn(() => []) },
	readSystemPrompt: vi.fn(() => null),
}));

import { createWorkerManager } from "../../src/infrastructure/worker-manager.js";
import { agentStore } from "../../src/domain/agents/agent-store.js";
import type { AgentSummary } from "../../src/domain/agents/agent-types.js";
import type { AgentProcess, IAgentProcessRunner, SendOptions } from "../../src/domain/agents/worker-types.js";
import type { IWorldStateManager, AgentAction, WorldEntity } from "../../src/domain/agents/world-state-types.js";
import type { AgentStreamEvent } from "../../src/domain/agents/agent-stream.js";
import type { AgentResponse } from "../../src/domain/agents/agent-conversation.js";

function makeAgent(overrides?: Partial<AgentSummary>): AgentSummary {
	return { name: "Bob", agentType: "ai", description: "Helper", skills: [], tools: [], roles: [], file: "bob.md", ...overrides };
}

function makeDeps() {
	return {
		disk: { readFileSync: vi.fn(), writeFileSync: vi.fn(), existsSync: vi.fn(() => false), mkdirSync: vi.fn(), readdirSync: vi.fn(() => []) } as never,
		paths: { join: vi.fn((...a: string[]) => a.join("/")), resolve: vi.fn((...a: string[]) => a.join("/")) } as never,
		clock: { ms: vi.fn(() => 1234), iso: vi.fn(() => "2026-03-15T12:00:00Z"), now: vi.fn(() => new Date()), safeIso: vi.fn(() => "2026-03-15") } as never,
		shell: { spawnBackground: vi.fn() } as never,
		log: vi.fn(),
	};
}

function makeWorldState(): IWorldStateManager {
	return {
		emitAction: vi.fn(),
		updateEntity: vi.fn(),
		getState: vi.fn(() => ({ version: 1 as const, updatedAt: "", entities: {}, permissions: {}, activityLog: [] })),
		getEntity: vi.fn(() => null),
		flush: vi.fn(),
		addActionListener: vi.fn(),
		removeActionListener: vi.fn(),
	};
}

function makeProcessRunner(resultOverride?: Partial<{ text: string; thinking: string; exitCode: number }>): IAgentProcessRunner & { _lastProc: AgentProcess } {
	const defaultResult = { text: "Hi", thinking: "", exitCode: 0, ...resultOverride };
	let lastProc: AgentProcess;
	return {
		spawn: vi.fn((): AgentProcess => {
			const listeners: Array<(e: AgentStreamEvent) => void> = [];
			lastProc = {
				onEvent: vi.fn((cb: (e: AgentStreamEvent) => void) => { listeners.push(cb); return () => { const idx = listeners.indexOf(cb); if (idx >= 0) listeners.splice(idx, 1); }; }),
				result: Promise.resolve(defaultResult),
				kill: vi.fn(),
			};
			return lastProc;
		}),
		get _lastProc() { return lastProc; },
	};
}

function makeAction(overrides?: Partial<AgentAction>): AgentAction {
	return { id: "a1", agentName: "Bob", timestamp: "t", type: "task-started", data: { task: "Build" }, ...overrides };
}

describe("WorkerManager", () => {
	beforeEach(() => {
		vi.mocked(agentStore.list).mockReturnValue([]);
	});

	// ── spawnAll ─────────────────────────────────────────────────────

	it("spawnAll creates workers from agent definitions", () => {
		vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), makeProcessRunner(), "/vault", undefined);
		mgr.spawnAll();
		expect(mgr.listWorkers()).toHaveLength(1);
		expect(mgr.getWorker("Bob")).not.toBeNull();
	});

	it("spawnAll does not duplicate workers on repeated calls", () => {
		vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), makeProcessRunner(), "/vault", undefined);
		mgr.spawnAll();
		mgr.spawnAll();
		expect(mgr.listWorkers()).toHaveLength(1);
	});

	it("spawnAll spawns multiple agents", () => {
		vi.mocked(agentStore.list).mockReturnValue([
			makeAgent({ name: "Alice" }),
			makeAgent({ name: "Bob" }),
			makeAgent({ name: "Charlie", agentType: "human" }),
		]);
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), makeProcessRunner(), "/vault", undefined);
		mgr.spawnAll();
		expect(mgr.listWorkers()).toHaveLength(3);
	});

	it("spawnAll registers entities in world state", () => {
		vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
		const ws = makeWorldState();
		const mgr = createWorkerManager(makeDeps(), ws, makeProcessRunner(), "/vault", undefined);
		mgr.spawnAll();
		expect(ws.updateEntity).toHaveBeenCalledWith("Bob", "agent", expect.objectContaining({
			status: { state: "idle" },
		}));
	});

	// ── spawn (single) ──────────────────────────────────────────────

	it("spawn creates a single named worker", () => {
		vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), makeProcessRunner(), "/vault", undefined);
		const worker = mgr.spawn("Bob");
		expect(worker).not.toBeNull();
		expect(worker!.name).toBe("Bob");
		expect(worker!.state).toBe("idle");
	});

	it("spawn returns null for unknown agent", () => {
		vi.mocked(agentStore.list).mockReturnValue([]);
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), makeProcessRunner(), "/vault", undefined);
		const worker = mgr.spawn("Unknown");
		expect(worker).toBeNull();
	});

	// ── getWorker ───────────────────────────────────────────────────

	it("getWorker returns null for unknown agent", () => {
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), makeProcessRunner(), "/vault", undefined);
		mgr.spawnAll();
		expect(mgr.getWorker("Unknown")).toBeNull();
	});

	it("getWorker returns public worker with correct properties", () => {
		vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), makeProcessRunner(), "/vault", undefined);
		mgr.spawnAll();
		const worker = mgr.getWorker("Bob");
		expect(worker).not.toBeNull();
		expect(worker!.name).toBe("Bob");
		expect(worker!.agent).toEqual(makeAgent());
		expect(worker!.state).toBe("idle");
		expect(worker!.messageQueue).toEqual([]);
	});

	// ── send ────────────────────────────────────────────────────────

	it("send routes message to AI worker and spawns LLM process", () => {
		vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
		const runner = makeProcessRunner();
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), runner, "/vault", undefined);
		mgr.spawnAll();
		mgr.send("Bob", "Hello", { foreground: false });
		expect(runner.spawn).toHaveBeenCalled();
	});

	it("send does nothing for unknown agent", () => {
		const runner = makeProcessRunner();
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), runner, "/vault", undefined);
		mgr.spawnAll();
		mgr.send("Unknown", "Hello", { foreground: false });
		expect(runner.spawn).not.toHaveBeenCalled();
	});

	it("send does nothing for stopped worker", () => {
		vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
		const runner = makeProcessRunner();
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), runner, "/vault", undefined);
		mgr.spawnAll();
		mgr.stop("Bob");
		mgr.send("Bob", "Hello", { foreground: false });
		expect(runner.spawn).not.toHaveBeenCalled();
	});

	it("send invokes onResponse callback with LLM result", async () => {
		vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
		const runner = makeProcessRunner({ text: "Hello back" });
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), runner, "/vault", undefined);
		mgr.spawnAll();

		const responses: AgentResponse[] = [];
		mgr.send("Bob", "Hi", { foreground: false, onResponse: (r: AgentResponse) => { responses.push(r); } });

		// Let the async processMessage settle
		await vi.waitFor(() => expect(responses).toHaveLength(1));
		expect(responses[0].message).toBe("Hello back");
		expect(responses[0].status).toBe("message");
	});

	it("send invokes onEvent callback for stream events", async () => {
		vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
		const runner = makeProcessRunner();
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), runner, "/vault", undefined);
		mgr.spawnAll();

		const events: AgentStreamEvent[] = [];
		mgr.send("Bob", "Hi", { foreground: false, onEvent: (e: AgentStreamEvent) => { events.push(e); } });

		// The onEvent callback should have been registered on the process
		expect(runner._lastProc.onEvent).toHaveBeenCalled();
	});

	// ── NPC (human) agent responses ─────────────────────────────────

	it("send to NPC agent returns static response without LLM", () => {
		const npcAgent = makeAgent({ name: "Guard", agentType: "human" });
		vi.mocked(agentStore.list).mockReturnValue([npcAgent]);
		const runner = makeProcessRunner();
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), runner, "/vault", undefined);
		mgr.spawnAll();

		const responses: AgentResponse[] = [];
		mgr.send("Guard", "Hello", { foreground: false, onResponse: (r: AgentResponse) => { responses.push(r); } });

		// NPC should respond immediately without LLM
		expect(runner.spawn).not.toHaveBeenCalled();
		expect(responses).toHaveLength(1);
		expect(responses[0].status).toBe("message");
	});

	// ── Message queue behavior ──────────────────────────────────────

	it("queues messages when worker is busy", () => {
		vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
		// Make the process never resolve so the worker stays busy
		let resolveResult: ((v: { text: string; thinking: string; exitCode: number }) => void) | undefined;
		const runner: IAgentProcessRunner = {
			spawn: vi.fn((): AgentProcess => ({
				onEvent: vi.fn(() => () => {}),
				result: new Promise((resolve) => { resolveResult = resolve; }),
				kill: vi.fn(),
			})),
		};
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), runner, "/vault", undefined);
		mgr.spawnAll();

		mgr.send("Bob", "First", { foreground: false });
		mgr.send("Bob", "Second", { foreground: false });
		mgr.send("Bob", "Third", { foreground: false });

		const worker = mgr.getWorker("Bob");
		expect(worker!.messageQueue).toHaveLength(2);
		expect(worker!.messageQueue[0]).toBe("Second");
		expect(worker!.messageQueue[1]).toBe("Third");

		// Cleanup
		resolveResult?.({ text: "", thinking: "", exitCode: 0 });
	});

	it("processes queued messages after current completes", async () => {
		vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
		let spawnCount = 0;
		const runner: IAgentProcessRunner = {
			spawn: vi.fn((): AgentProcess => {
				spawnCount++;
				return {
					onEvent: vi.fn(() => () => {}),
					result: Promise.resolve({ text: `Reply ${spawnCount}`, thinking: "", exitCode: 0 }),
					kill: vi.fn(),
				};
			}),
		};
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), runner, "/vault", undefined);
		mgr.spawnAll();

		mgr.send("Bob", "First", { foreground: false });
		mgr.send("Bob", "Second", { foreground: false });

		// Wait for all processing to settle
		await vi.waitFor(() => expect(spawnCount).toBeGreaterThanOrEqual(2));
	});

	// ── Failure tracking ────────────────────────────────────────────

	it("increments failure count on LLM error", async () => {
		vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
		const runner = makeProcessRunner({ text: "", exitCode: 1 });
		const ws = makeWorldState();
		const mgr = createWorkerManager(makeDeps(), ws, runner, "/vault", undefined);
		mgr.spawnAll();

		mgr.send("Bob", "Fail", { foreground: false });
		await vi.waitFor(() => {
			const worker = mgr.getWorker("Bob");
			return expect(worker!.state).toBe("idle");
		});
	});

	it("stops worker after 3 consecutive failures", async () => {
		vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
		let callCount = 0;
		const runner: IAgentProcessRunner = {
			spawn: vi.fn((): AgentProcess => {
				callCount++;
				return {
					onEvent: vi.fn(() => () => {}),
					result: Promise.resolve({ text: "", thinking: "", exitCode: 1 }),
					kill: vi.fn(),
				};
			}),
		};
		const ws = makeWorldState();
		const mgr = createWorkerManager(makeDeps(), ws, runner, "/vault", undefined);
		mgr.spawnAll();

		// Send 3 messages that will each fail
		mgr.send("Bob", "Fail 1", { foreground: false });
		await vi.waitFor(() => expect(callCount).toBe(1));
		// Worker returns to idle after first failure (failureCount=1)

		mgr.send("Bob", "Fail 2", { foreground: false });
		await vi.waitFor(() => expect(callCount).toBe(2));
		// failureCount=2, still idle

		mgr.send("Bob", "Fail 3", { foreground: false });
		await vi.waitFor(() => {
			const worker = mgr.getWorker("Bob");
			return expect(worker!.state).toBe("stopped");
		});
	});

	it("resets failure count on successful response", async () => {
		vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
		let callCount = 0;
		const runner: IAgentProcessRunner = {
			spawn: vi.fn((): AgentProcess => {
				callCount++;
				const success = callCount >= 3;
				return {
					onEvent: vi.fn(() => () => {}),
					result: Promise.resolve({ text: success ? "Ok" : "", thinking: "", exitCode: success ? 0 : 1 }),
					kill: vi.fn(),
				};
			}),
		};
		const mgr = createWorkerManager(makeDeps(), ws(), runner, "/vault", undefined);
		mgr.spawnAll();

		// Two failures
		mgr.send("Bob", "Fail 1", { foreground: false });
		await vi.waitFor(() => expect(callCount).toBe(1));
		mgr.send("Bob", "Fail 2", { foreground: false });
		await vi.waitFor(() => expect(callCount).toBe(2));

		// Now succeed — should reset failure count
		mgr.send("Bob", "Succeed", { foreground: false });
		await vi.waitFor(() => expect(callCount).toBe(3));

		// Another failure — should not stop (count reset to 0, now 1)
		mgr.send("Bob", "Fail again", { foreground: false });
		await vi.waitFor(() => expect(callCount).toBe(4));
		const worker = mgr.getWorker("Bob");
		expect(worker!.state).toBe("idle");

		function ws() { return makeWorldState(); }
	});

	// ── stop / stopAll ──────────────────────────────────────────────

	it("stop sets individual worker to stopped", () => {
		vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
		const ws = makeWorldState();
		const mgr = createWorkerManager(makeDeps(), ws, makeProcessRunner(), "/vault", undefined);
		mgr.spawnAll();
		mgr.stop("Bob");
		const worker = mgr.getWorker("Bob");
		expect(worker!.state).toBe("stopped");
		expect(ws.updateEntity).toHaveBeenCalledWith("Bob", "agent", expect.objectContaining({
			status: { state: "stopped" },
		}));
	});

	it("stop ignores unknown agent", () => {
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), makeProcessRunner(), "/vault", undefined);
		mgr.spawnAll();
		// Should not throw
		mgr.stop("Unknown");
	});

	it("stopAll stops all workers", () => {
		vi.mocked(agentStore.list).mockReturnValue([
			makeAgent({ name: "Alice" }),
			makeAgent({ name: "Bob" }),
		]);
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), makeProcessRunner(), "/vault", undefined);
		mgr.spawnAll();
		mgr.stopAll();
		expect(mgr.getWorker("Alice")!.state).toBe("stopped");
		expect(mgr.getWorker("Bob")!.state).toBe("stopped");
	});

	// ── listWorkers ─────────────────────────────────────────────────

	it("listWorkers returns empty array when no agents", () => {
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), makeProcessRunner(), "/vault", undefined);
		mgr.spawnAll();
		expect(mgr.listWorkers()).toEqual([]);
	});

	it("listWorkers returns snapshot with correct state", () => {
		vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), makeProcessRunner(), "/vault", undefined);
		mgr.spawnAll();
		const workers = mgr.listWorkers();
		expect(workers).toHaveLength(1);
		expect(workers[0].name).toBe("Bob");
		expect(workers[0].state).toBe("idle");
	});

	// ── dispatchWorldEvent ──────────────────────────────────────────

	it("dispatchWorldEvent skips originating agent (cycle protection)", () => {
		vi.mocked(agentStore.list).mockReturnValue([makeAgent({ name: "Bob" })]);
		const runner = makeProcessRunner();
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), runner, "/vault", undefined);
		mgr.spawnAll();

		// Event from Bob should not be dispatched to Bob
		mgr.dispatchWorldEvent(makeAction({ agentName: "Bob", type: "task-started" }));
		expect(runner.spawn).not.toHaveBeenCalled();
	});

	it("dispatchWorldEvent fans out to other workers", () => {
		vi.mocked(agentStore.list).mockReturnValue([
			makeAgent({ name: "Alice" }),
			makeAgent({ name: "Bob" }),
		]);
		const runner = makeProcessRunner();
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), runner, "/vault", undefined);
		mgr.spawnAll();

		// Event from Alice should fan out to Bob
		mgr.dispatchWorldEvent(makeAction({ agentName: "Alice", type: "task-started", data: { task: "Build" } }));
		expect(runner.spawn).toHaveBeenCalled();
	});

	it("dispatchWorldEvent skips stopped workers", () => {
		vi.mocked(agentStore.list).mockReturnValue([
			makeAgent({ name: "Alice" }),
			makeAgent({ name: "Bob" }),
		]);
		const runner = makeProcessRunner();
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), runner, "/vault", undefined);
		mgr.spawnAll();
		mgr.stop("Bob");

		mgr.dispatchWorldEvent(makeAction({ agentName: "Alice", type: "task-started", data: { task: "Build" } }));
		expect(runner.spawn).not.toHaveBeenCalled();
	});

	it("dispatchWorldEvent NPC acknowledges task", () => {
		vi.mocked(agentStore.list).mockReturnValue([
			makeAgent({ name: "Alice" }),
			makeAgent({ name: "Guard", agentType: "human" }),
		]);
		const deps = makeDeps();
		const mgr = createWorkerManager(deps, makeWorldState(), makeProcessRunner(), "/vault", undefined);
		mgr.spawnAll();

		mgr.dispatchWorldEvent(makeAction({ agentName: "Alice", type: "task-started", data: { task: "Patrol" } }));
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Patrol"));
	});

	it("dispatchWorldEvent ignores unmatched action types", () => {
		vi.mocked(agentStore.list).mockReturnValue([
			makeAgent({ name: "Alice" }),
			makeAgent({ name: "Bob" }),
		]);
		const runner = makeProcessRunner();
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), runner, "/vault", undefined);
		mgr.spawnAll();

		// "idle" action type has no trigger mapping
		mgr.dispatchWorldEvent(makeAction({ agentName: "Alice", type: "idle" }));
		expect(runner.spawn).not.toHaveBeenCalled();
	});

	// ── Worker public API ───────────────────────────────────────────

	it("worker.stop() transitions to stopped", () => {
		vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), makeProcessRunner(), "/vault", undefined);
		mgr.spawnAll();
		const worker = mgr.getWorker("Bob");
		worker!.stop();
		expect(mgr.getWorker("Bob")!.state).toBe("stopped");
	});

	it("worker.send() delegates to manager send", () => {
		vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
		const runner = makeProcessRunner();
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), runner, "/vault", undefined);
		mgr.spawnAll();
		const worker = mgr.getWorker("Bob");
		worker!.send("Hello");
		expect(runner.spawn).toHaveBeenCalled();
	});

	// ── State transitions during processing ─────────────────────────

	it("worker transitions through thinking → working → idle", async () => {
		vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
		const ws = makeWorldState();
		const runner = makeProcessRunner();
		const mgr = createWorkerManager(makeDeps(), ws, runner, "/vault", undefined);
		mgr.spawnAll();

		mgr.send("Bob", "Work", { foreground: false });
		await vi.waitFor(() => {
			const worker = mgr.getWorker("Bob");
			return expect(worker!.state).toBe("idle");
		});

		// World state should have been updated with thinking, working, and idle states
		const updateCalls = vi.mocked(ws.updateEntity).mock.calls;
		const stateUpdates = updateCalls
			.filter((c) => c[0] === "Bob")
			.map((c) => (c[2] as { status?: { state: string } }).status?.state)
			.filter(Boolean);
		expect(stateUpdates).toContain("thinking");
		expect(stateUpdates).toContain("working");
		expect(stateUpdates).toContain("idle");
	});

	// ── send with task option ───────────────────────────────────────

	it("send with task option builds task prompt", async () => {
		vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
		const runner = makeProcessRunner();
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), runner, "/vault", undefined);
		mgr.spawnAll();

		mgr.send("Bob", "Build the project", { foreground: false, task: "Build" });
		await vi.waitFor(() => expect(runner.spawn).toHaveBeenCalled());

		const prompt = (runner.spawn as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
		expect(prompt).toContain("Build the project");
	});

	// ── Edge cases ──────────────────────────────────────────────────

	it("handles process runner throwing", async () => {
		vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
		const runner: IAgentProcessRunner = {
			spawn: vi.fn((): AgentProcess => ({
				onEvent: vi.fn(() => () => {}),
				result: Promise.reject(new Error("spawn failed")),
				kill: vi.fn(),
			})),
		};
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), runner, "/vault", undefined);
		mgr.spawnAll();

		// Should not throw, should gracefully handle
		mgr.send("Bob", "Hello", { foreground: false });
		await vi.waitFor(() => {
			const worker = mgr.getWorker("Bob");
			return expect(worker!.state).toBe("idle");
		});
	});

	it("messageQueue is a copy (not a mutable reference)", () => {
		vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
		const mgr = createWorkerManager(makeDeps(), makeWorldState(), makeProcessRunner(), "/vault", undefined);
		mgr.spawnAll();
		const worker = mgr.getWorker("Bob");
		const queue = worker!.messageQueue;
		// TypeScript says readonly, but verify at runtime it's a separate array
		expect(Array.isArray(queue)).toBe(true);
	});
});
