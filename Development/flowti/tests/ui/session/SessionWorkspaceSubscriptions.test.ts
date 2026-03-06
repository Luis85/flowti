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
		featureName: null,
		...overrides,
	};
}

function makeContext(session: Session | null = makeSession()): SubscriptionViewContext & { mocks: Record<string, ReturnType<typeof vi.fn>> } {
	const mocks = {
		setSession: vi.fn(),
		refreshSession: vi.fn(() => session ?? makeSession()),
		render: vi.fn(),
		scheduleRender: vi.fn(),
		schedulePanelRefresh: vi.fn(),
		renderActions: vi.fn(),
		captureWorkspaceState: vi.fn(),
		restoreWorkspaceState: vi.fn(),
	};
	return {
		getSession: () => session,
		setSession: mocks.setSession,
		refreshSession: mocks.refreshSession,
		render: mocks.render,
		scheduleRender: mocks.scheduleRender,
		schedulePanelRefresh: mocks.schedulePanelRefresh,
		renderActions: mocks.renderActions,
		captureWorkspaceState: mocks.captureWorkspaceState,
		restoreWorkspaceState: mocks.restoreWorkspaceState,
		getTimerPanel: () => ({ updateDisplay: vi.fn() }) as never,
		getEnergyPanel: () => ({ refreshEnergy: vi.fn() }) as never,
		getGoalsPanel: () => ({ refreshGoals: vi.fn() }) as never,
		getNotesPanel: () => ({ updateNotes: vi.fn() }) as never,
		getActivityPanel: () => ({ refreshList: vi.fn() }) as never,
		getExecutionPanel: () => ({ refreshTasks: vi.fn() }) as never,
		getDecisionPanel: () => ({ refreshList: vi.fn() }) as never,
		getReflectionPanel: () => ({ refreshList: vi.fn() }) as never,
		getOutputPanel: () => ({ refreshList: vi.fn() }) as never,
		getOverloadAlert: () => ({ refreshAlert: vi.fn() }) as never,
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
		expect(ctx.mocks.scheduleRender).not.toHaveBeenCalled();
	});

	// ── Immediate renders (no debounce) ──────────────────────

	it("session.timer.completed triggers immediate render", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.timer.completed", { sessionId: "session-1" });

		expect(ctx.mocks.setSession).toHaveBeenCalled();
		expect(ctx.mocks.render).toHaveBeenCalled();
	});

	it("session.deleted sets session to null and renders immediately", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.deleted", { sessionId: "session-1" });

		expect(ctx.mocks.setSession).toHaveBeenCalledWith(null);
		expect(ctx.mocks.render).toHaveBeenCalled();
	});

	// ── Debounced full re-renders ────────────────────────────

	it("session lifecycle events trigger scheduleRender for own session", async () => {
		const session = makeSession({ id: "s1" });
		const eventBus = new EventBus();
		const ctx = makeContext(session);
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.started", { session });

		expect(ctx.mocks.setSession).toHaveBeenCalledWith(session);
		expect(ctx.mocks.scheduleRender).toHaveBeenCalled();
		expect(ctx.mocks.render).not.toHaveBeenCalled();
	});

	it("session lifecycle events trigger schedulePanelRefresh('actions') for other sessions", async () => {
		const session = makeSession({ id: "s1" });
		const otherSession = makeSession({ id: "other" });
		const eventBus = new EventBus();
		const ctx = makeContext(session);
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.started", { session: otherSession });

		expect(ctx.mocks.scheduleRender).not.toHaveBeenCalled();
		expect(ctx.mocks.schedulePanelRefresh).toHaveBeenCalledWith("actions");
	});

	it("session.closure.started triggers scheduleRender", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.closure.started", { sessionId: "session-1" });

		expect(ctx.mocks.scheduleRender).toHaveBeenCalled();
	});

	it("session.closure.completed triggers scheduleRender", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.closure.completed", {
			sessionId: "session-1",
			response: { outcomeAchieved: "yes", whatWorked: "focus", whatDidnt: "", nextAction: "", answers: {} },
		});

		expect(ctx.mocks.scheduleRender).toHaveBeenCalled();
	});

	it("session.duration.updated triggers scheduleRender", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.duration.updated", {
			sessionId: "session-1",
			durationMinutes: 50,
		});

		expect(ctx.mocks.scheduleRender).toHaveBeenCalled();
	});

	it("context binding events trigger scheduleRender", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.context.bound", {
			sessionId: "session-1",
			binding: { id: "b1", type: "domain", label: "test", path: "a.md", boundAt: new Date().toISOString() },
		});

		expect(ctx.mocks.scheduleRender).toHaveBeenCalled();
	});

	it("session.paths.updated triggers scheduleRender", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.paths.updated", {
			sessionIds: ["session-1"],
		});

		expect(ctx.mocks.scheduleRender).toHaveBeenCalled();
	});

	// ── Debounced panel refreshes ────────────────────────────

	it("session.energy.changed schedules energy panel refresh", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.energy.changed", {
			sessionId: "session-1",
			before: null,
			after: 3,
		});

		expect(ctx.mocks.refreshSession).toHaveBeenCalled();
		expect(ctx.mocks.setSession).toHaveBeenCalled();
		expect(ctx.mocks.schedulePanelRefresh).toHaveBeenCalledWith("energy");
	});

	it("session.energy.changed is ignored for different sessions", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.energy.changed", {
			sessionId: "other-session",
			before: null,
			after: 3,
		});

		expect(ctx.mocks.schedulePanelRefresh).not.toHaveBeenCalled();
		expect(ctx.mocks.refreshSession).not.toHaveBeenCalled();
	});

	it("goal events schedule goals panel refresh", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.goal.added", {
			sessionId: "session-1",
			goal: { id: "g1", text: "test", completed: false, completedAt: null },
		});

		expect(ctx.mocks.schedulePanelRefresh).toHaveBeenCalledWith("goals");
	});

	it("task events schedule tasks panel refresh", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.task.added", {
			sessionId: "session-1",
			task: { id: "t1", label: "Test", completed: false, order: 0 },
		});

		expect(ctx.mocks.refreshSession).toHaveBeenCalled();
		expect(ctx.mocks.setSession).toHaveBeenCalled();
		expect(ctx.mocks.schedulePanelRefresh).toHaveBeenCalledWith("tasks");
	});

	it("session.task.completed schedules tasks panel refresh", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.task.completed", {
			sessionId: "session-1",
			taskId: "t1",
		});

		expect(ctx.mocks.schedulePanelRefresh).toHaveBeenCalledWith("tasks");
	});

	it("session.task.removed schedules tasks panel refresh", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.task.removed", {
			sessionId: "session-1",
			taskId: "t1",
		});

		expect(ctx.mocks.schedulePanelRefresh).toHaveBeenCalledWith("tasks");
	});

	it("session.task.reordered schedules tasks panel refresh", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.task.reordered", {
			sessionId: "session-1",
			taskIds: ["t2", "t1"],
		});

		expect(ctx.mocks.schedulePanelRefresh).toHaveBeenCalledWith("tasks");
	});

	it("task events are ignored for different sessions", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.task.added", {
			sessionId: "other-session",
			task: { id: "t1", label: "Test", completed: false, order: 0 },
		});

		expect(ctx.mocks.schedulePanelRefresh).not.toHaveBeenCalled();
		expect(ctx.mocks.refreshSession).not.toHaveBeenCalled();
	});

	it("decision events schedule decisions panel refresh", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.decision.recorded", {
			sessionId: "session-1",
			decision: { id: "d1", title: "Test", description: undefined, context: undefined, recordedAt: new Date().toISOString() },
		});

		expect(ctx.mocks.schedulePanelRefresh).toHaveBeenCalledWith("decisions");
	});

	it("session.reflection.added schedules reflections panel refresh", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.reflection.added", {
			sessionId: "session-1",
			entry: { id: "ref-1", type: "observation", content: "Test", timestamp: new Date().toISOString() },
		});

		expect(ctx.mocks.setSession).toHaveBeenCalled();
		expect(ctx.mocks.schedulePanelRefresh).toHaveBeenCalledWith("reflections");
	});

	it("session.reflection.removed schedules reflections panel refresh", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.reflection.removed", {
			sessionId: "session-1",
			entryId: "ref-1",
		});

		expect(ctx.mocks.setSession).toHaveBeenCalled();
		expect(ctx.mocks.schedulePanelRefresh).toHaveBeenCalledWith("reflections");
	});

	it("session.reflection.added is ignored for different session", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.reflection.added", {
			sessionId: "other-session",
			entry: { id: "ref-1", type: "observation", content: "Test", timestamp: new Date().toISOString() },
		});

		expect(ctx.mocks.schedulePanelRefresh).not.toHaveBeenCalled();
	});

	it("session.notes.updated schedules notes panel refresh", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.notes.updated", {
			sessionId: "session-1",
			notes: "updated text",
		});

		expect(ctx.mocks.schedulePanelRefresh).toHaveBeenCalledWith("notes");
	});

	it("session.artifact.added schedules activity panel refresh", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.artifact.added", {
			sessionId: "session-1",
			artifact: { path: "file.md", action: "created", timestamp: new Date().toISOString() },
		});

		expect(ctx.mocks.schedulePanelRefresh).toHaveBeenCalledWith("activity");
	});

	it("session.activity.tracked schedules activity panel refresh", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.activity.tracked", {
			sessionId: "session-1",
			activity: { path: "file.md", action: "modified", timestamp: new Date().toISOString() },
		});

		expect(ctx.mocks.schedulePanelRefresh).toHaveBeenCalledWith("activity");
	});

	it("session.output.generated schedules output panel refresh", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.output.generated", {
			sessionId: "session-1",
			artifact: { type: "review-summary", path: "out.md", generatedAt: new Date().toISOString() },
		});

		expect(ctx.mocks.schedulePanelRefresh).toHaveBeenCalledWith("output");
	});

	it("session.overload.detected schedules overload panel refresh", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.overload.detected", {
			sessionId: "session-1",
			reasons: ["Too many tasks (6/5)"],
		});

		expect(ctx.mocks.schedulePanelRefresh).toHaveBeenCalledWith("overload");
	});

	it("session.overload.detected is ignored for different session", async () => {
		const eventBus = new EventBus();
		const ctx = makeContext();
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.overload.detected", {
			sessionId: "other-session",
			reasons: ["Too many tasks (6/5)"],
		});

		expect(ctx.mocks.schedulePanelRefresh).not.toHaveBeenCalled();
	});

	// ── Reverse sync batching ────────────────────────────────

	it("session.notes.reverseSynced batches goals, tasks, and notes panel refreshes", async () => {
		const eventBus = new EventBus();
		const session = makeSession({ notes: "updated notes" });
		const ctx = makeContext(session);
		setupEventSubscriptions(ctx, eventBus);

		await eventBus.emit("session.notes.reverseSynced", {
			sessionId: "session-1",
			path: "test.md",
			changes: ['goal "Write tests" checked'],
		});

		expect(ctx.mocks.refreshSession).toHaveBeenCalled();
		expect(ctx.mocks.setSession).toHaveBeenCalled();
		expect(ctx.mocks.schedulePanelRefresh).toHaveBeenCalledWith("goals");
		expect(ctx.mocks.schedulePanelRefresh).toHaveBeenCalledWith("tasks");
		expect(ctx.mocks.schedulePanelRefresh).toHaveBeenCalledWith("notes");
		expect(ctx.mocks.schedulePanelRefresh).toHaveBeenCalledTimes(3);
	});

	// ── Workspace state ──────────────────────────────────────

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

	// ── Ignores for non-matching sessions ────────────────────

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
});
