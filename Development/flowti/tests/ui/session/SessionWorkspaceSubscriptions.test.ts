// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import { setupEventSubscriptions } from "../../../src/ui/session/SessionWorkspaceSubscriptions";
import type { SubscriptionViewContext } from "../../../src/ui/session/SessionWorkspaceSubscriptions";
import type { Session } from "../../../src/domain/session/types";

function makeSession(overrides?: Partial<Session>): Session {
	return {
		id: "session-1",
		type: "event-storming",
		title: "Test",
		status: "active",
		durationMinutes: 25,
		createdAt: new Date().toISOString(),
		startedAt: new Date().toISOString(),
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
		...overrides,
	};
}

function makeContext(session: Session | null = makeSession()): SubscriptionViewContext & { mocks: Record<string, ReturnType<typeof vi.fn>> } {
	const mocks = {
		setSession: vi.fn(),
		refreshSession: vi.fn(() => session ?? makeSession()),
		render: vi.fn(),
		renderActions: vi.fn(),
		captureWorkspaceState: vi.fn(),
		restoreWorkspaceState: vi.fn(),
	};
	return {
		getSession: () => session,
		setSession: mocks.setSession,
		refreshSession: mocks.refreshSession,
		render: mocks.render,
		renderActions: mocks.renderActions,
		captureWorkspaceState: mocks.captureWorkspaceState,
		restoreWorkspaceState: mocks.restoreWorkspaceState,
		getTimerPanel: () => ({ updateDisplay: vi.fn() }) as never,
		getGoalsPanel: () => ({ refreshGoals: vi.fn() }) as never,
		getNotesPanel: () => ({ updateNotes: vi.fn() }) as never,
		getActivityPanel: () => ({ refreshList: vi.fn() }) as never,
		getExecutionPanel: () => ({ refreshTasks: vi.fn() }) as never,
		getDecisionPanel: () => ({ refreshList: vi.fn() }) as never,
		getOutputPanel: () => ({ refreshList: vi.fn() }) as never,
		mocks,
	};
}

describe("setupEventSubscriptions", () => {
	it("returns an array of unsubscribe functions", () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		const unsubs = setupEventSubscriptions(ctx, eventBus);

		expect(Array.isArray(unsubs)).toBe(true);
		expect(unsubs.length).toBeGreaterThan(0);
		for (const fn of unsubs) {
			expect(typeof fn).toBe("function");
		}
	});

	it("all unsubscribe functions detach listeners", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		const unsubs = setupEventSubscriptions(ctx, eventBus);

		// Unsubscribe all
		for (const fn of unsubs) fn();

		// Emit a session event — should not trigger callbacks
		await eventBus.emit("session.timer.tick", {
			sessionId: "session-1",
			remainingMs: 1000,
			elapsedMs: 0,
		});

		expect(ctx.mocks.render).not.toHaveBeenCalled();
	});

	it("session.timer.completed triggers refresh + render", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.timer.completed", { sessionId: "session-1" });

		expect(ctx.mocks.setSession).toHaveBeenCalled();
		expect(ctx.mocks.render).toHaveBeenCalled();
	});

	it("session lifecycle events trigger render for own session", async () => {
		const session = makeSession({ id: "s1" });
		const eventBus = new EventBus();
		const ctx = makeContext(session);
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.started", { session });

		expect(ctx.mocks.setSession).toHaveBeenCalledWith(session);
		expect(ctx.mocks.render).toHaveBeenCalled();
	});

	it("session lifecycle events trigger renderActions for other sessions", async () => {
		const session = makeSession({ id: "s1" });
		const otherSession = makeSession({ id: "other" });
		const eventBus = new EventBus();
		const ctx = makeContext(session);
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.started", { session: otherSession });

		expect(ctx.mocks.render).not.toHaveBeenCalled();
		expect(ctx.mocks.renderActions).toHaveBeenCalled();
	});

	it("session.deleted sets session to null and renders", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.deleted", { sessionId: "session-1" });

		expect(ctx.mocks.setSession).toHaveBeenCalledWith(null);
		expect(ctx.mocks.render).toHaveBeenCalled();
	});

	it("session.state.save triggers captureWorkspaceState", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.state.save", { sessionId: "session-1" });

		expect(ctx.mocks.captureWorkspaceState).toHaveBeenCalledWith("session-1");
	});

	it("session.state.restore triggers restoreWorkspaceState", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		const state = { openFiles: ["a.md"], activeFile: "a.md", scrollPositions: {} };
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.state.restore", { sessionId: "session-1", state });

		expect(ctx.mocks.restoreWorkspaceState).toHaveBeenCalledWith("session-1", state);
	});

	it("session.task.added triggers refreshSession + refreshTasks on execution panel", async () => {
		const eventBus = new EventBus();
		const refreshTasks = vi.fn();
		const ctx = makeContext();
		// Override execution panel to capture the call
		(ctx as { getExecutionPanel: () => unknown }).getExecutionPanel = () => ({ refreshTasks });
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.task.added", {
			sessionId: "session-1",
			task: { id: "t1", label: "Test", completed: false, order: 0 },
		});

		expect(ctx.mocks.refreshSession).toHaveBeenCalled();
		expect(ctx.mocks.setSession).toHaveBeenCalled();
		expect(refreshTasks).toHaveBeenCalled();
	});

	it("session.task.completed triggers refreshTasks on execution panel", async () => {
		const eventBus = new EventBus();
		const refreshTasks = vi.fn();
		const ctx = makeContext();
		(ctx as { getExecutionPanel: () => unknown }).getExecutionPanel = () => ({ refreshTasks });
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.task.completed", {
			sessionId: "session-1",
			taskId: "t1",
		});

		expect(refreshTasks).toHaveBeenCalled();
	});

	it("session.task.removed triggers refreshTasks on execution panel", async () => {
		const eventBus = new EventBus();
		const refreshTasks = vi.fn();
		const ctx = makeContext();
		(ctx as { getExecutionPanel: () => unknown }).getExecutionPanel = () => ({ refreshTasks });
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.task.removed", {
			sessionId: "session-1",
			taskId: "t1",
		});

		expect(refreshTasks).toHaveBeenCalled();
	});

	it("session.task.reordered triggers refreshTasks on execution panel", async () => {
		const eventBus = new EventBus();
		const refreshTasks = vi.fn();
		const ctx = makeContext();
		(ctx as { getExecutionPanel: () => unknown }).getExecutionPanel = () => ({ refreshTasks });
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.task.reordered", {
			sessionId: "session-1",
			taskIds: ["t2", "t1"],
		});

		expect(refreshTasks).toHaveBeenCalled();
	});

	it("task events are ignored for different sessions", async () => {
		const eventBus = new EventBus();
		const refreshTasks = vi.fn();
		const ctx = makeContext();
		(ctx as { getExecutionPanel: () => unknown }).getExecutionPanel = () => ({ refreshTasks });
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.task.added", {
			sessionId: "other-session",
			task: { id: "t1", label: "Test", completed: false, order: 0 },
		});

		expect(refreshTasks).not.toHaveBeenCalled();
		expect(ctx.mocks.refreshSession).not.toHaveBeenCalled();
	});

	it("ignores events for different sessions", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.goal.added", {
			sessionId: "other-session",
			goal: { id: "g1", text: "test", completed: false, completedAt: null },
		});

		expect(ctx.mocks.refreshSession).not.toHaveBeenCalled();
	});

	it("session.notes.reverseSynced refreshes goals, tasks, and notes panels", async () => {
		const eventBus = new EventBus();
		const refreshGoals = vi.fn();
		const refreshTasks = vi.fn();
		const updateNotes = vi.fn();
		const session = makeSession({ notes: "updated notes" });
		const ctx = makeContext(session);
		(ctx as { getGoalsPanel: () => unknown }).getGoalsPanel = () => ({ refreshGoals });
		(ctx as { getExecutionPanel: () => unknown }).getExecutionPanel = () => ({ refreshTasks });
		(ctx as { getNotesPanel: () => unknown }).getNotesPanel = () => ({ updateNotes });
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.notes.reverseSynced", {
			sessionId: "session-1",
			path: "test.md",
			changes: ['goal "Write tests" checked'],
		});

		expect(ctx.mocks.refreshSession).toHaveBeenCalled();
		expect(ctx.mocks.setSession).toHaveBeenCalled();
		expect(refreshGoals).toHaveBeenCalled();
		expect(refreshTasks).toHaveBeenCalled();
		expect(updateNotes).toHaveBeenCalled();
	});
});
