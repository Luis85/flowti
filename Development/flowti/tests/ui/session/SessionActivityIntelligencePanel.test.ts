// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, vi } from "vitest";
import { SessionActivityIntelligencePanel } from "../../../src/ui/session/SessionActivityIntelligencePanel";
import type { SessionPanelDeps } from "../../../src/ui/session/types";
import type { Session } from "../../../src/domain/session/types";
import { EventBus } from "../../../src/infrastructure/events/EventBus";

function makeSession(overrides?: Partial<Session>): Session {
	return {
		id: "session-1",
		type: "event-storming",
		title: "Test Session",
		status: "running",
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

function makeDeps(session: Session): SessionPanelDeps {
	return {
		eventBus: new EventBus(),
		getSession: () => session,
		app: {} as never,
		openFile: vi.fn(),
		revealFolder: vi.fn(),
		updateActivityFilter: vi.fn(),
		getGlobalActivityFilter: () => [],
	};
}

describe("SessionActivityIntelligencePanel", () => {
	it("does not render when session has no activity data", () => {
		const session = makeSession();
		const deps = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionActivityIntelligencePanel(container, deps);
		panel.render();

		expect(container.querySelector(".ft-session-intelligence")).toBeNull();
	});

	it("renders stats section when session has activity", () => {
		const session = makeSession({
			activity: [
				{ path: "src/a.ts", action: "modified", timestamp: "2026-02-20T10:05:00.000Z" },
			],
			timeline: [
				{ action: "started", timestamp: "2026-02-20T10:00:00.000Z" },
			],
			startedAt: "2026-02-20T10:00:00.000Z",
		});
		const deps = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionActivityIntelligencePanel(container, deps);
		panel.render();

		const section = container.querySelector(".ft-session-intelligence");
		expect(section).toBeTruthy();
		expect(section!.textContent).toContain("Activity");
	});

	it("shows correct file count", () => {
		const session = makeSession({
			activity: [
				{ path: "src/a.ts", action: "modified", timestamp: "2026-02-20T10:05:00.000Z" },
				{ path: "src/b.ts", action: "created", timestamp: "2026-02-20T10:06:00.000Z" },
				{ path: "src/a.ts", action: "modified", timestamp: "2026-02-20T10:07:00.000Z" },
			],
		});
		const deps = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionActivityIntelligencePanel(container, deps);
		panel.render();

		const stats = container.querySelector(".ft-intelligence-stats");
		expect(stats!.textContent).toContain("Files");
		expect(stats!.textContent).toContain("2");
	});

	it("shows correct task count", () => {
		const session = makeSession({
			activity: [{ path: "src/a.ts", action: "modified", timestamp: "2026-02-20T10:05:00.000Z" }],
			executionTasks: [
				{ id: "t1", label: "Task 1", completed: true, order: 0 },
				{ id: "t2", label: "Task 2", completed: false, order: 1 },
				{ id: "t3", label: "Task 3", completed: true, order: 2 },
			],
		});
		const deps = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionActivityIntelligencePanel(container, deps);
		panel.render();

		const stats = container.querySelector(".ft-intelligence-stats");
		expect(stats!.textContent).toContain("Tasks");
		expect(stats!.textContent).toContain("2");
	});

	it("shows correct event count", () => {
		const session = makeSession({
			timeline: [
				{ action: "started", timestamp: "2026-02-20T10:00:00.000Z" },
				{ action: "paused", timestamp: "2026-02-20T10:15:00.000Z" },
				{ action: "resumed", timestamp: "2026-02-20T10:20:00.000Z" },
			],
			startedAt: "2026-02-20T10:00:00.000Z",
		});
		const deps = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionActivityIntelligencePanel(container, deps);
		panel.render();

		const stats = container.querySelector(".ft-intelligence-stats");
		expect(stats!.textContent).toContain("Events");
		expect(stats!.textContent).toContain("3");
	});

	it("refreshStats updates the displayed values", () => {
		const session = makeSession({
			activity: [
				{ path: "src/a.ts", action: "modified", timestamp: "2026-02-20T10:05:00.000Z" },
			],
		});
		const deps = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionActivityIntelligencePanel(container, deps);
		panel.render();

		// Add more activity
		session.activity.push(
			{ path: "src/b.ts", action: "created", timestamp: "2026-02-20T10:06:00.000Z" },
			{ path: "src/c.ts", action: "modified", timestamp: "2026-02-20T10:07:00.000Z" },
		);
		panel.refreshStats();

		const stats = container.querySelector(".ft-intelligence-stats");
		expect(stats!.textContent).toContain("3");
	});

	it("refreshStats is a no-op before render", () => {
		const session = makeSession();
		const deps = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionActivityIntelligencePanel(container, deps);
		// Should not throw
		panel.refreshStats();
		expect(container.querySelector(".ft-session-intelligence")).toBeNull();
	});
});
