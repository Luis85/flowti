import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDispatcher } from "../../../src/domain/tasks/task-dispatcher.js";
import { makeTask } from "./task-test-utils.js";

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
		schedule: vi.fn().mockImplementation((fn: () => void, _ms: number) => { const id = setTimeout(fn, _ms); return () => clearTimeout(id); }),
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

			d.submit(makeTask({ priority: "normal", taskId: "t-normal", title: "Normal" }));
			d.submit(makeTask({ priority: "urgent", taskId: "t-urgent", title: "Urgent" }));
			d.submit(makeTask({ priority: "high", taskId: "t-high", title: "High" }));

			// Make agent idle, but after first assignment it becomes busy
			let assigned = false;
			deps.getWorkerState.mockImplementation(() => assigned ? "working" : "idle");
			deps.sendToWorker.mockImplementation(() => { assigned = true; });
			d.drain();

			expect(deps.sendToWorker).toHaveBeenCalledTimes(1);
			// Verify the urgent task was picked first
			expect(deps.sendToWorker).toHaveBeenCalledWith("agent-a", "Urgent", { task: "Urgent" });
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

			expect(deps.updateTaskStatus).toHaveBeenCalledWith("task-001", "failed");
			expect(deps.sendToWorker).toHaveBeenCalledTimes(2);
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

			deps.getWorkerState.mockReturnValue("idle");
			d.submit(makeTask({ taskId: "t2" }));

			expect(deps.sendToWorker).toHaveBeenCalledTimes(1);
		});

		it("clears cooldown and drains after timeout", () => {
			vi.useFakeTimers();
			const deps = makeDeps();
			const d = createDispatcher(deps, ["agent-a"]);
			d.submit(makeTask());
			d.complete("agent-a", "task-001", "done");

			deps.getWorkerState.mockReturnValue("idle");
			d.submit(makeTask({ taskId: "t2" }));
			expect(deps.sendToWorker).toHaveBeenCalledTimes(1);

			vi.advanceTimersByTime(15001);

			expect(deps.emit).toHaveBeenCalledWith("agent:available", expect.any(Object));
			expect(deps.sendToWorker).toHaveBeenCalledTimes(2);

			vi.useRealTimers();
		});
	});

	describe("listQueue", () => {
		it("returns tasks grouped by lane", () => {
			const deps = makeDeps();
			deps.getWorkerState.mockReturnValue("working");
			const d = createDispatcher(deps, ["agent-a"]);

			d.submit(makeTask({ priority: "urgent", taskId: "t1" }));
			d.submit(makeTask({ priority: "normal", taskId: "t2" }));

			const q = d.listQueue();
			expect(q.find((l) => l.lane === "urgent")!.tasks).toHaveLength(1);
			expect(q.find((l) => l.lane === "normal")!.tasks).toHaveLength(1);
			expect(q.find((l) => l.lane === "high")!.tasks).toHaveLength(0);
		});
	});

	describe("listHistory", () => {
		it("records completions", () => {
			const deps = makeDeps();
			const d = createDispatcher(deps, ["agent-a"]);
			d.submit(makeTask());
			d.complete("agent-a", "task-001", "done");

			const h = d.listHistory();
			expect(h).toHaveLength(1);
			expect(h[0].agentName).toBe("agent-a");
		});

		it("filters by agent name", () => {
			const deps = makeDeps();
			const d = createDispatcher(deps, ["agent-a", "agent-b"]);
			d.submit(makeTask({ taskId: "t1" }));
			d.complete("agent-a", "t1", "done");

			expect(d.listHistory("agent-a")).toHaveLength(1);
			expect(d.listHistory("agent-b")).toHaveLength(0);
		});
	});

	describe("edge cases", () => {
		it("submit with zero registered agents queues the task", () => {
			const deps = makeDeps();
			const d = createDispatcher(deps, []);

			d.submit(makeTask());

			expect(deps.sendToWorker).not.toHaveBeenCalled();
			expect(d.metrics().queueDepth.normal).toBe(1);
		});

		it("complete for agent with no active assignment is a no-op", () => {
			const deps = makeDeps();
			const d = createDispatcher(deps, ["agent-a"]);

			d.complete("agent-a", undefined, "done");

			expect(deps.updateTaskStatus).not.toHaveBeenCalled();
			expect(deps.awardReward).not.toHaveBeenCalled();
			expect(deps.writeAgentEvent).toHaveBeenCalledWith("agent-a", "done", "");
		});

		it("complete with undefined taskId resolves from assignments", () => {
			const deps = makeDeps();
			const d = createDispatcher(deps, ["agent-a"]);
			d.submit(makeTask({ taskId: "resolved-task" }));

			d.complete("agent-a", undefined, "done");

			expect(deps.updateTaskStatus).toHaveBeenCalledWith("resolved-task", "completed");
		});

		it("fail with undefined taskId resolves from assignments", () => {
			const deps = makeDeps();
			const d = createDispatcher(deps, ["agent-a"]);
			d.submit(makeTask({ taskId: "fail-task", retryCount: 1 }));

			d.fail("agent-a", undefined, "timeout");

			expect(deps.updateTaskStatus).toHaveBeenCalledWith("fail-task", "failed");
		});

		it("drain assigns multiple tasks to multiple agents in one pass", () => {
			const deps = makeDeps();
			const d = createDispatcher(deps, ["agent-a", "agent-b"]);
			deps.getWorkerState.mockReturnValue("working");

			d.submit(makeTask({ taskId: "t1", title: "Task 1" }));
			d.submit(makeTask({ taskId: "t2", title: "Task 2" }));

			// Both idle now
			deps.getWorkerState.mockReturnValue("idle");
			d.drain();

			// Both agents should get one task each
			expect(deps.sendToWorker).toHaveBeenCalledTimes(2);
			expect(d.metrics().activeAssignments).toBe(2);
			expect(d.metrics().queueDepth.normal).toBe(0);
		});

		it("drain does not double-assign the same agent", () => {
			const deps = makeDeps();
			const d = createDispatcher(deps, ["agent-a"]);
			deps.getWorkerState.mockReturnValue("working");

			d.submit(makeTask({ taskId: "t1" }));
			d.submit(makeTask({ taskId: "t2" }));

			deps.getWorkerState.mockReturnValue("idle");
			d.drain();

			// Only one task assigned — agent-a can only take one
			expect(deps.sendToWorker).toHaveBeenCalledTimes(1);
			expect(d.metrics().queueDepth.normal).toBe(1);
		});

		it("cascading failure: retry also fails exhausts retries", () => {
			const deps = makeDeps();
			const d = createDispatcher(deps, ["agent-a"]);
			d.submit(makeTask({ retryCount: 0 }));

			// First failure — retries (retryCount becomes 1)
			d.fail("agent-a", "task-001", "error 1");
			expect(deps.sendToWorker).toHaveBeenCalledTimes(2); // original + retry

			// Second failure — retries exhausted (retryCount is now 1 >= maxRetries 1)
			d.fail("agent-a", undefined, "error 2");
			expect(deps.emit).toHaveBeenCalledWith("task:failed", expect.objectContaining({ error: "error 2" }));
			expect(d.metrics().tasksFailed).toBe(1);
		});

		it("wait time and exec time are computed separately", () => {
			let now = 1000;
			const deps = makeDeps({ clock: { ms: () => now, iso: () => "", safeIso: () => "" } });
			const d = createDispatcher(deps, ["agent-a"]);

			// Task submitted at t=1000
			d.submit(makeTask({ submittedAt: 1000 }));
			// Simulate assignment happened at t=1000 (same tick)

			// Complete at t=5000
			now = 5000;
			d.complete("agent-a", "task-001", "done");

			const m = d.metrics();
			// waitMs = assignedAt(1000) - submittedAt(1000) = 0
			expect(m.avgWaitTimeMs).toBe(0);
			// execMs = now(5000) - assignedAt(1000) = 4000
			expect(m.avgExecutionTimeMs).toBe(4000);
		});
	});
});
