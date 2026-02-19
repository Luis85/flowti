/**
 * Execution Task CRUD Tests (ADR-031, FR-12, PBI-SW-012)
 *
 * Tests the execution plan domain layer:
 * - Task CRUD: addTask, toggleTask, removeTask, reorderTasks
 * - State guards: only prepared/running/paused states allowed
 * - Order re-indexing after remove
 * - Event assertions: session.task.added, .completed, .removed, .reordered
 * - getTaskProgress pure helper
 * - Template/rerun threading: tasks carried through createFromTemplate/rerunSession
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { SessionService } from "../../../src/domain/session/SessionService";
import type { ExecutionTask, SessionState, SessionType } from "../../../src/domain/session/types";
import { createMockStorage } from "../../mocks/storage";
import { getTaskProgress } from "../../../src/domain/session/helpers";

async function flush(): Promise<void> {
	await vi.advanceTimersByTimeAsync(0);
}

describe("Execution Tasks (FR-12)", () => {
	let eventBus: IEventBus;
	let service: SessionService;
	let storage: ReturnType<typeof createMockStorage<SessionState>>;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-19T12:00:00.000Z"));
		eventBus = new EventBus();
		storage = createMockStorage<SessionState>();
		service = new SessionService({ storage: storage.storage, eventBus });
	});

	afterEach(() => {
		service.dispose();
		vi.useRealTimers();
	});

	/** Helper: create a session and return its ID. */
	async function createSession(status: "prepared" | "running" | "paused" = "prepared"): Promise<string> {
		await service.load();
		await eventBus.emit("session.create", {
			type: "documentation" as SessionType,
			title: "Task Test",
			durationMinutes: 25,
		});
		await flush();
		const id = service.getSessions()[0].id;

		if (status === "running" || status === "paused") {
			await eventBus.emit("session.start", { sessionId: id });
			await flush();
		}
		if (status === "paused") {
			vi.advanceTimersByTime(3000);
			await eventBus.emit("session.pause", { sessionId: id });
			await flush();
		}
		return id;
	}

	// ── addTask ─────────────────────────────────────────────

	describe("addTask", () => {
		it("adds a task to a prepared session", async () => {
			const id = await createSession("prepared");

			const task = await service.addTask(id, "Write tests");
			expect(task).not.toBeNull();
			expect(task!.label).toBe("Write tests");
			expect(task!.completed).toBe(false);
			expect(task!.order).toBe(0);
			expect(task!.id).toMatch(/^task_/);

			const session = service.getSessionById(id)!;
			expect(session.executionTasks).toHaveLength(1);
		});

		it("adds a task to a running session", async () => {
			const id = await createSession("running");

			const task = await service.addTask(id, "Deploy changes");
			expect(task).not.toBeNull();
			expect(task!.label).toBe("Deploy changes");
		});

		it("adds a task to a paused session", async () => {
			const id = await createSession("paused");

			const task = await service.addTask(id, "Review PR");
			expect(task).not.toBeNull();
		});

		it("assigns auto-incrementing order", async () => {
			const id = await createSession("prepared");

			await service.addTask(id, "Task A");
			await service.addTask(id, "Task B");
			await service.addTask(id, "Task C");

			const session = service.getSessionById(id)!;
			expect(session.executionTasks.map((t) => t.order)).toEqual([0, 1, 2]);
		});

		it("emits session.task.added event", async () => {
			const id = await createSession("prepared");

			const handler = vi.fn();
			eventBus.on("session.task.added", handler);

			await service.addTask(id, "Test event");

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload.sessionId).toBe(id);
			expect(handler.mock.calls[0][0].payload.task.label).toBe("Test event");
		});

		it("persists state after adding task", async () => {
			const id = await createSession("prepared");

			await service.addTask(id, "Persisted");

			expect(storage.storage.save).toHaveBeenCalled();
		});
	});

	// ── toggleTask ──────────────────────────────────────────

	describe("toggleTask", () => {
		it("toggles a task from incomplete to complete", async () => {
			const id = await createSession("running");
			const task = await service.addTask(id, "Toggle me");

			await service.toggleTask(id, task!.id);

			const session = service.getSessionById(id)!;
			const updated = session.executionTasks[0];
			expect(updated.completed).toBe(true);
			expect(updated.completedAt).toBeDefined();
		});

		it("toggles a task from complete back to incomplete", async () => {
			const id = await createSession("running");
			const task = await service.addTask(id, "Toggle twice");

			await service.toggleTask(id, task!.id);
			await service.toggleTask(id, task!.id);

			const session = service.getSessionById(id)!;
			const updated = session.executionTasks[0];
			expect(updated.completed).toBe(false);
			expect(updated.completedAt).toBeUndefined();
		});

		it("emits session.task.completed event", async () => {
			const id = await createSession("running");
			const task = await service.addTask(id, "Event test");

			const handler = vi.fn();
			eventBus.on("session.task.completed", handler);

			await service.toggleTask(id, task!.id);

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload.taskId).toBe(task!.id);
		});

		it("ignores non-existent task ID", async () => {
			const id = await createSession("running");
			await service.addTask(id, "Existing");

			// Should not throw
			await service.toggleTask(id, "task_nonexistent");

			const session = service.getSessionById(id)!;
			expect(session.executionTasks[0].completed).toBe(false);
		});
	});

	// ── removeTask ──────────────────────────────────────────

	describe("removeTask", () => {
		it("removes a task and re-indexes order", async () => {
			const id = await createSession("prepared");
			await service.addTask(id, "A");
			const taskB = await service.addTask(id, "B");
			await service.addTask(id, "C");

			await service.removeTask(id, taskB!.id);

			const session = service.getSessionById(id)!;
			expect(session.executionTasks).toHaveLength(2);
			expect(session.executionTasks[0].label).toBe("A");
			expect(session.executionTasks[1].label).toBe("C");
			// Orders re-indexed
			expect(session.executionTasks[0].order).toBe(0);
			expect(session.executionTasks[1].order).toBe(1);
		});

		it("emits session.task.removed event", async () => {
			const id = await createSession("prepared");
			const task = await service.addTask(id, "Remove me");

			const handler = vi.fn();
			eventBus.on("session.task.removed", handler);

			await service.removeTask(id, task!.id);

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload.taskId).toBe(task!.id);
		});

		it("ignores non-existent task ID", async () => {
			const id = await createSession("prepared");
			await service.addTask(id, "Keep me");

			await service.removeTask(id, "task_nonexistent");

			expect(service.getSessionById(id)!.executionTasks).toHaveLength(1);
		});
	});

	// ── reorderTasks ────────────────────────────────────────

	describe("reorderTasks", () => {
		it("reorders tasks by new ID sequence", async () => {
			const id = await createSession("prepared");
			const a = await service.addTask(id, "A");
			const b = await service.addTask(id, "B");
			const c = await service.addTask(id, "C");

			await service.reorderTasks(id, [c!.id, a!.id, b!.id]);

			const session = service.getSessionById(id)!;
			expect(session.executionTasks.map((t) => t.label)).toEqual(["C", "A", "B"]);
			expect(session.executionTasks.map((t) => t.order)).toEqual([0, 1, 2]);
		});

		it("emits session.task.reordered event", async () => {
			const id = await createSession("prepared");
			const a = await service.addTask(id, "A");
			const b = await service.addTask(id, "B");

			const handler = vi.fn();
			eventBus.on("session.task.reordered", handler);

			await service.reorderTasks(id, [b!.id, a!.id]);

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload.taskIds).toEqual([b!.id, a!.id]);
		});

		it("rejects reorder with mismatched count", async () => {
			const id = await createSession("prepared");
			const a = await service.addTask(id, "A");
			await service.addTask(id, "B");

			const handler = vi.fn();
			eventBus.on("session.task.reordered", handler);

			// Only provide 1 of 2 IDs — should be rejected
			await service.reorderTasks(id, [a!.id]);

			expect(handler).not.toHaveBeenCalled();
			// Order unchanged
			const session = service.getSessionById(id)!;
			expect(session.executionTasks[0].label).toBe("A");
		});

		it("rejects reorder with invalid ID", async () => {
			const id = await createSession("prepared");
			const a = await service.addTask(id, "A");
			await service.addTask(id, "B");

			const handler = vi.fn();
			eventBus.on("session.task.reordered", handler);

			await service.reorderTasks(id, [a!.id, "task_bogus"]);

			expect(handler).not.toHaveBeenCalled();
		});
	});

	// ── State guards ────────────────────────────────────────

	describe("state guards", () => {
		it("rejects addTask on a completed session", async () => {
			const id = await createSession("running");
			await eventBus.emit("session.complete", { sessionId: id });
			await flush();

			const task = await service.addTask(id, "Should fail");
			expect(task).toBeNull();
		});

		it("rejects addTask on an archived session", async () => {
			const id = await createSession("running");
			await eventBus.emit("session.complete", { sessionId: id });
			await flush();
			await service.skipClosure(id);
			await eventBus.emit("session.archive", { sessionId: id });
			await flush();

			const task = await service.addTask(id, "Should fail");
			expect(task).toBeNull();
		});

		it("rejects toggleTask on a completed session", async () => {
			const id = await createSession("running");
			const task = await service.addTask(id, "Pre-complete");
			await eventBus.emit("session.complete", { sessionId: id });
			await flush();

			await service.toggleTask(id, task!.id);
			const session = service.getSessionById(id)!;
			expect(session.executionTasks[0].completed).toBe(false);
		});

		it("rejects removeTask on a completed session", async () => {
			const id = await createSession("running");
			const task = await service.addTask(id, "Keep me");
			await eventBus.emit("session.complete", { sessionId: id });
			await flush();

			await service.removeTask(id, task!.id);
			expect(service.getSessionById(id)!.executionTasks).toHaveLength(1);
		});

		it("rejects reorderTasks on a completed session", async () => {
			const id = await createSession("running");
			const a = await service.addTask(id, "A");
			const b = await service.addTask(id, "B");
			await eventBus.emit("session.complete", { sessionId: id });
			await flush();

			await service.reorderTasks(id, [b!.id, a!.id]);
			expect(service.getSessionById(id)!.executionTasks[0].label).toBe("A");
		});

		it("returns null for non-existent session", async () => {
			await service.load();
			const task = await service.addTask("nonexistent", "Nope");
			expect(task).toBeNull();
		});
	});

	// ── Event-driven wiring ─────────────────────────────────

	describe("event-driven wiring", () => {
		it("handles session.task.add command", async () => {
			const id = await createSession("prepared");

			await eventBus.emit("session.task.add", { sessionId: id, label: "Via event" });
			await flush();

			const session = service.getSessionById(id)!;
			expect(session.executionTasks).toHaveLength(1);
			expect(session.executionTasks[0].label).toBe("Via event");
			expect(session.executionTasks[0].id).toMatch(/^task_/);
		});

		it("handles session.task.toggle command", async () => {
			const id = await createSession("running");
			const task = await service.addTask(id, "Toggle via event");

			await eventBus.emit("session.task.toggle", { sessionId: id, taskId: task!.id });
			await flush();

			expect(service.getSessionById(id)!.executionTasks[0].completed).toBe(true);
		});

		it("handles session.task.remove command", async () => {
			const id = await createSession("running");
			const task = await service.addTask(id, "Remove via event");

			await eventBus.emit("session.task.remove", { sessionId: id, taskId: task!.id });
			await flush();

			expect(service.getSessionById(id)!.executionTasks).toHaveLength(0);
		});

		it("handles session.task.reorder command", async () => {
			const id = await createSession("running");
			const a = await service.addTask(id, "A");
			const b = await service.addTask(id, "B");

			await eventBus.emit("session.task.reorder", { sessionId: id, taskIds: [b!.id, a!.id] });
			await flush();

			const session = service.getSessionById(id)!;
			expect(session.executionTasks[0].label).toBe("B");
		});
	});

	// ── Template/Rerun threading ────────────────────────────

	describe("template and rerun threading", () => {
		it("rerunSession carries execution tasks to new session", async () => {
			const id = await createSession("running");
			await service.addTask(id, "Task Alpha");
			await service.addTask(id, "Task Beta");

			await eventBus.emit("session.complete", { sessionId: id });
			await flush();
			await service.skipClosure(id);

			const rerun = await service.rerunSession(id);
			expect(rerun).not.toBeNull();
			expect(rerun!.executionTasks).toHaveLength(2);
			expect(rerun!.executionTasks[0].label).toBe("Task Alpha");
			expect(rerun!.executionTasks[1].label).toBe("Task Beta");
			// Tasks should be fresh (not completed)
			expect(rerun!.executionTasks[0].completed).toBe(false);
			expect(rerun!.executionTasks[0].id).not.toBe(service.getSessionById(id)!.executionTasks[0].id);
		});

		it("createFromTemplate populates tasks from template", async () => {
			await service.load();

			await service.saveTemplate({
				name: "Sprint Planning",
				type: "backlog-structuring",
				durationMinutes: 45,
				goals: ["Define scope"],
				tasks: ["Review backlog", "Estimate stories", "Commit sprint"],
			});

			const tmpl = service.getSavedTemplates()[0];
			await service.createFromTemplate(tmpl.id);
			await flush();

			const session = service.getSessions()[0];
			expect(session.executionTasks).toHaveLength(3);
			expect(session.executionTasks.map((t) => t.label)).toEqual([
				"Review backlog",
				"Estimate stories",
				"Commit sprint",
			]);
			expect(session.executionTasks.map((t) => t.order)).toEqual([0, 1, 2]);
		});

		it("createFromTemplate with no tasks creates empty execution plan", async () => {
			await service.load();

			await service.saveTemplate({
				name: "Quick Review",
				type: "documentation",
				durationMinutes: 15,
			});

			const tmpl = service.getSavedTemplates()[0];
			await service.createFromTemplate(tmpl.id);
			await flush();

			expect(service.getSessions()[0].executionTasks).toEqual([]);
		});
	});
});

// ── getTaskProgress pure helper ─────────────────────────────

describe("getTaskProgress", () => {
	it("returns zeros for empty task list", () => {
		expect(getTaskProgress([])).toEqual({ completed: 0, total: 0, percent: 0 });
	});

	it("returns 0% for no completed tasks", () => {
		const tasks: ExecutionTask[] = [
			{ id: "t1", label: "A", completed: false, order: 0 },
			{ id: "t2", label: "B", completed: false, order: 1 },
		];
		expect(getTaskProgress(tasks)).toEqual({ completed: 0, total: 2, percent: 0 });
	});

	it("returns 100% for all completed tasks", () => {
		const tasks: ExecutionTask[] = [
			{ id: "t1", label: "A", completed: true, completedAt: "2026-02-19T12:00:00Z", order: 0 },
			{ id: "t2", label: "B", completed: true, completedAt: "2026-02-19T12:01:00Z", order: 1 },
		];
		expect(getTaskProgress(tasks)).toEqual({ completed: 2, total: 2, percent: 100 });
	});

	it("returns correct percentage for partial completion", () => {
		const tasks: ExecutionTask[] = [
			{ id: "t1", label: "A", completed: true, completedAt: "2026-02-19T12:00:00Z", order: 0 },
			{ id: "t2", label: "B", completed: false, order: 1 },
			{ id: "t3", label: "C", completed: false, order: 2 },
		];
		const result = getTaskProgress(tasks);
		expect(result.completed).toBe(1);
		expect(result.total).toBe(3);
		expect(result.percent).toBe(33); // Math.round(1/3 * 100) = 33
	});

	it("rounds percentage correctly", () => {
		const tasks: ExecutionTask[] = [
			{ id: "t1", label: "A", completed: true, order: 0 },
			{ id: "t2", label: "B", completed: true, order: 1 },
			{ id: "t3", label: "C", completed: false, order: 2 },
		];
		expect(getTaskProgress(tasks).percent).toBe(67); // Math.round(2/3 * 100) = 67
	});

	it("handles single task", () => {
		const tasks: ExecutionTask[] = [
			{ id: "t1", label: "Only", completed: true, order: 0 },
		];
		expect(getTaskProgress(tasks)).toEqual({ completed: 1, total: 1, percent: 100 });
	});
});
