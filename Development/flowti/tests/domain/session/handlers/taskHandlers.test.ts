/**
 * Tests for goal and execution task handlers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SessionHandlerContext } from "../../../../src/domain/session/handlers/types";
import type { Session, SessionState } from "../../../../src/domain/session/types";
import { MAX_EXECUTION_TASKS } from "../../../../src/domain/session/types";
import {
	handleGoalAdd,
	handleGoalToggle,
	handleGoalRemove,
	handleGoalReorder,
	addTask,
	toggleTask,
	removeTask,
	reorderTasks,
} from "../../../../src/domain/session/handlers/taskHandlers";

function makeSession(overrides: Partial<Session> = {}): Session {
	return {
		id: "session-1",
		type: "event-storming",
		title: "Test Session",
		status: "prepared",
		durationMinutes: 25,
		createdAt: "2026-02-16T10:00:00.000Z",
		startedAt: null,
		pausedAt: null,
		elapsedBeforePauseMs: 0,
		completedAt: null,
		artifacts: [],
		notes: "",
		focusFile: null,
		timeline: [],
		goals: [],
		links: [],
		notesFile: null,
		canvasFile: null,
		activity: [],
		activityFilter: [],
		contextBindings: [],
		decisions: [],
		workspaceState: null,
		outputArtifacts: [],
		intent: null,
		energy: null,
		executionTasks: [],
		reflections: [],
		closureResponse: null,
		featureName: null,
		...overrides,
	};
}

function createMockContext(sessions: Session[] = []): SessionHandlerContext & { emitted: [string, unknown][] } {
	const state: SessionState = { sessions, activeSessionId: null };
	const emitted: [string, unknown][] = [];
	return {
		eventBus: { emit: (type: string, payload: unknown) => { emitted.push([type, payload]); } } as any,
		fileSystem: {
			createFile: vi.fn().mockResolvedValue(undefined),
			readFile: vi.fn().mockResolvedValue(""),
			updateFile: vi.fn().mockResolvedValue(undefined),
			fileExists: vi.fn().mockResolvedValue(true),
		} as any,
		globalActivityFilter: [],
		customSessionTypes: {},
		noteSyncTimers: new Map(),
		lastSyncedContent: new Map(),
		reverseSyncTimers: new Map(),
		lastOverloadReasons: new Map(),
		findSession: (id: string) => state.sessions.find((s) => s.id === id),
		getState: () => state,
		saveState: vi.fn().mockResolvedValue(undefined),
		scheduleSyncNotesFile: vi.fn(),
		checkCognitiveOverload: vi.fn(),
		startTimer: vi.fn(),
		stopTimer: vi.fn(),
		emitted,
	};
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-02-16T10:00:00.000Z"));
});

afterEach(() => {
	vi.useRealTimers();
});

// ── handleGoalAdd ────────────────────────────────────────

describe("handleGoalAdd", () => {
	it("adds a goal to a session", async () => {
		const session = makeSession();
		const ctx = createMockContext([session]);

		await handleGoalAdd(ctx, "session-1", "Write unit tests");

		expect(session.goals).toHaveLength(1);
		expect(session.goals[0].text).toBe("Write unit tests");
		expect(session.goals[0].completed).toBe(false);
		expect(ctx.emitted.some(([e]) => e === "session.goal.added")).toBe(true);
		expect(ctx.scheduleSyncNotesFile).toHaveBeenCalledWith("session-1");
	});
});

// ── handleGoalToggle ─────────────────────────────────────

describe("handleGoalToggle", () => {
	it("toggles a goal to completed with completedAt timestamp", async () => {
		const session = makeSession({
			goals: [{ id: "goal-1", text: "Test", completed: false, completedAt: null }],
		});
		const ctx = createMockContext([session]);

		await handleGoalToggle(ctx, "session-1", "goal-1");

		expect(session.goals[0].completed).toBe(true);
		expect(session.goals[0].completedAt).toBe("2026-02-16T10:00:00.000Z");
		expect(ctx.emitted.some(([e]) => e === "session.goal.toggled")).toBe(true);
	});

	it("toggles a completed goal back to incomplete", async () => {
		const session = makeSession({
			goals: [{ id: "goal-1", text: "Test", completed: true, completedAt: "2026-02-16T09:00:00.000Z" }],
		});
		const ctx = createMockContext([session]);

		await handleGoalToggle(ctx, "session-1", "goal-1");

		expect(session.goals[0].completed).toBe(false);
		expect(session.goals[0].completedAt).toBeNull();
	});
});

// ── handleGoalRemove ─────────────────────────────────────

describe("handleGoalRemove", () => {
	it("removes a goal by ID", async () => {
		const session = makeSession({
			goals: [{ id: "goal-1", text: "Test", completed: false, completedAt: null }],
		});
		const ctx = createMockContext([session]);

		await handleGoalRemove(ctx, "session-1", "goal-1");

		expect(session.goals).toHaveLength(0);
		expect(ctx.emitted.some(([e]) => e === "session.goal.removed")).toBe(true);
	});

	it("ignores non-existent goal ID", async () => {
		const session = makeSession();
		const ctx = createMockContext([session]);

		await handleGoalRemove(ctx, "session-1", "non-existent");

		expect(ctx.emitted).toHaveLength(0);
	});
});

// ── handleGoalReorder ────────────────────────────────────

describe("handleGoalReorder", () => {
	it("reorders goals according to provided IDs", async () => {
		const session = makeSession({
			goals: [
				{ id: "g-1", text: "First", completed: false, completedAt: null },
				{ id: "g-2", text: "Second", completed: false, completedAt: null },
			],
		});
		const ctx = createMockContext([session]);

		await handleGoalReorder(ctx, "session-1", ["g-2", "g-1"]);

		expect(session.goals[0].id).toBe("g-2");
		expect(session.goals[1].id).toBe("g-1");
		expect(ctx.emitted.some(([e]) => e === "session.goal.reordered")).toBe(true);
	});

	it("rejects reorder when length does not match", async () => {
		const session = makeSession({
			goals: [
				{ id: "g-1", text: "First", completed: false, completedAt: null },
				{ id: "g-2", text: "Second", completed: false, completedAt: null },
			],
		});
		const ctx = createMockContext([session]);

		await handleGoalReorder(ctx, "session-1", ["g-1"]);

		// Goals should remain in original order
		expect(session.goals[0].id).toBe("g-1");
		expect(ctx.emitted).toHaveLength(0);
	});
});

// ── addTask ──────────────────────────────────────────────

describe("addTask", () => {
	it("adds a task on a prepared session", async () => {
		const session = makeSession({ status: "prepared" });
		const ctx = createMockContext([session]);

		const task = await addTask(ctx, "session-1", "Implement feature");

		expect(task).not.toBeNull();
		expect(task!.label).toBe("Implement feature");
		expect(task!.completed).toBe(false);
		expect(task!.order).toBe(0);
		expect(session.executionTasks).toHaveLength(1);
		expect(ctx.emitted.some(([e]) => e === "session.task.added")).toBe(true);
		expect(ctx.checkCognitiveOverload).toHaveBeenCalledWith("session-1");
	});

	it("rejects task on a disallowed state (completed)", async () => {
		const session = makeSession({ status: "completed" });
		const ctx = createMockContext([session]);

		const task = await addTask(ctx, "session-1", "New task");

		expect(task).toBeNull();
		expect(session.executionTasks).toHaveLength(0);
	});

	it("emits capacity reached when at max tasks", async () => {
		const tasks = Array.from({ length: MAX_EXECUTION_TASKS }, (_, i) => ({
			id: `task-${i}`, label: `Task ${i}`, completed: false, order: i,
		}));
		const session = makeSession({ status: "running", executionTasks: tasks });
		const ctx = createMockContext([session]);

		const result = await addTask(ctx, "session-1", "One more");

		expect(result).toBeNull();
		expect(ctx.emitted.some(([e]) => e === "session.task.capReached")).toBe(true);
	});
});

// ── toggleTask ───────────────────────────────────────────

describe("toggleTask", () => {
	it("toggles an incomplete task to completed", async () => {
		const session = makeSession({
			status: "running",
			executionTasks: [{ id: "task-1", label: "Test", completed: false, order: 0 }],
		});
		const ctx = createMockContext([session]);

		await toggleTask(ctx, "session-1", "task-1");

		expect(session.executionTasks[0].completed).toBe(true);
		expect(session.executionTasks[0].completedAt).toBe("2026-02-16T10:00:00.000Z");
		expect(ctx.emitted.some(([e]) => e === "session.task.completed")).toBe(true);
	});

	it("toggles a completed task back to incomplete", async () => {
		const session = makeSession({
			status: "running",
			executionTasks: [{ id: "task-1", label: "Test", completed: true, completedAt: "2026-02-16T09:00:00.000Z", order: 0 }],
		});
		const ctx = createMockContext([session]);

		await toggleTask(ctx, "session-1", "task-1");

		expect(session.executionTasks[0].completed).toBe(false);
		expect(session.executionTasks[0].completedAt).toBeUndefined();
	});
});

// ── removeTask ───────────────────────────────────────────

describe("removeTask", () => {
	it("removes a task and reindexes remaining tasks", async () => {
		const session = makeSession({
			status: "running",
			executionTasks: [
				{ id: "task-1", label: "First", completed: false, order: 0 },
				{ id: "task-2", label: "Second", completed: false, order: 1 },
				{ id: "task-3", label: "Third", completed: false, order: 2 },
			],
		});
		const ctx = createMockContext([session]);

		await removeTask(ctx, "session-1", "task-2");

		expect(session.executionTasks).toHaveLength(2);
		expect(session.executionTasks[0].id).toBe("task-1");
		expect(session.executionTasks[0].order).toBe(0);
		expect(session.executionTasks[1].id).toBe("task-3");
		expect(session.executionTasks[1].order).toBe(1);
		expect(ctx.emitted.some(([e]) => e === "session.task.removed")).toBe(true);
		expect(ctx.checkCognitiveOverload).toHaveBeenCalledWith("session-1");
	});
});

// ── reorderTasks ─────────────────────────────────────────

describe("reorderTasks", () => {
	it("reorders tasks and updates order indices", async () => {
		const session = makeSession({
			status: "prepared",
			executionTasks: [
				{ id: "task-1", label: "First", completed: false, order: 0 },
				{ id: "task-2", label: "Second", completed: false, order: 1 },
			],
		});
		const ctx = createMockContext([session]);

		await reorderTasks(ctx, "session-1", ["task-2", "task-1"]);

		expect(session.executionTasks[0].id).toBe("task-2");
		expect(session.executionTasks[0].order).toBe(0);
		expect(session.executionTasks[1].id).toBe("task-1");
		expect(session.executionTasks[1].order).toBe(1);
		expect(ctx.emitted.some(([e]) => e === "session.task.reordered")).toBe(true);
	});

	it("rejects reorder when length does not match", async () => {
		const session = makeSession({
			status: "prepared",
			executionTasks: [
				{ id: "task-1", label: "First", completed: false, order: 0 },
				{ id: "task-2", label: "Second", completed: false, order: 1 },
			],
		});
		const ctx = createMockContext([session]);

		await reorderTasks(ctx, "session-1", ["task-1"]);

		expect(session.executionTasks[0].id).toBe("task-1");
		expect(session.executionTasks[1].id).toBe("task-2");
		expect(ctx.emitted).toHaveLength(0);
	});
});
