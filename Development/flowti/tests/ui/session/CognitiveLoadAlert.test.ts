// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, vi } from "vitest";
import { CognitiveLoadAlert } from "../../../src/ui/session/CognitiveLoadAlert";
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
		...overrides,
	};
}

function makeDeps(session: Session): { deps: SessionPanelDeps; eventBus: EventBus } {
	const eventBus = new EventBus();
	return {
		deps: {
			eventBus,
			getSession: () => session,
			app: {} as never,
			openFile: vi.fn(),
			revealFolder: vi.fn(),
			updateActivityFilter: vi.fn(),
		},
		eventBus,
	};
}

describe("CognitiveLoadAlert", () => {
	it("renders nothing when no overload", () => {
		const session = makeSession();
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const alert = new CognitiveLoadAlert(container, deps);
		alert.render();

		expect(container.querySelector(".ft-overload-alert")).toBeNull();
	});

	it("renders warning when task count exceeds threshold", () => {
		const tasks = Array.from({ length: 6 }, (_, i) => ({
			id: `t${i}`, label: `Task ${i}`, completed: false, order: i,
		}));
		const session = makeSession({ executionTasks: tasks });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const alert = new CognitiveLoadAlert(container, deps);
		alert.render();

		const alertEl = container.querySelector(".ft-overload-alert");
		expect(alertEl).toBeTruthy();
		expect(alertEl!.textContent).toContain("Too many tasks");
	});

	it("renders warning when binding count exceeds threshold", () => {
		const bindings = Array.from({ length: 9 }, (_, i) => ({
			id: `ctx${i}`, type: "file" as const, label: `file${i}.md`, path: `/file${i}.md`, boundAt: new Date().toISOString(),
		}));
		const session = makeSession({ contextBindings: bindings });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const alert = new CognitiveLoadAlert(container, deps);
		alert.render();

		const alertEl = container.querySelector(".ft-overload-alert");
		expect(alertEl).toBeTruthy();
		expect(alertEl!.textContent).toContain("Too many context bindings");
	});

	it("renders compound warning for low energy + high tasks", () => {
		const tasks = Array.from({ length: 4 }, (_, i) => ({
			id: `t${i}`, label: `Task ${i}`, completed: false, order: i,
		}));
		const session = makeSession({ energy: 1, executionTasks: tasks });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const alert = new CognitiveLoadAlert(container, deps);
		alert.render();

		const alertEl = container.querySelector(".ft-overload-alert");
		expect(alertEl).toBeTruthy();
		expect(alertEl!.textContent).toContain("Low energy");
	});

	it("includes suggestion text", () => {
		const tasks = Array.from({ length: 6 }, (_, i) => ({
			id: `t${i}`, label: `Task ${i}`, completed: false, order: i,
		}));
		const session = makeSession({ executionTasks: tasks });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const alert = new CognitiveLoadAlert(container, deps);
		alert.render();

		expect(container.textContent).toContain("Consider reducing scope");
	});

	it("dismiss button hides the alert", () => {
		const tasks = Array.from({ length: 6 }, (_, i) => ({
			id: `t${i}`, label: `Task ${i}`, completed: false, order: i,
		}));
		const session = makeSession({ executionTasks: tasks });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const alert = new CognitiveLoadAlert(container, deps);
		alert.render();

		expect(container.querySelector(".ft-overload-alert")).toBeTruthy();

		const dismissBtn = container.querySelector(".ft-overload-dismiss") as HTMLButtonElement;
		expect(dismissBtn).toBeTruthy();
		dismissBtn.click();

		expect(container.querySelector(".ft-overload-alert")).toBeNull();
	});

	it("stays dismissed after refreshAlert", () => {
		const tasks = Array.from({ length: 6 }, (_, i) => ({
			id: `t${i}`, label: `Task ${i}`, completed: false, order: i,
		}));
		const session = makeSession({ executionTasks: tasks });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const alert = new CognitiveLoadAlert(container, deps);
		alert.render();

		const dismissBtn = container.querySelector(".ft-overload-dismiss") as HTMLButtonElement;
		dismissBtn.click();

		alert.refreshAlert();
		expect(container.querySelector(".ft-overload-alert")).toBeNull();
	});

	it("resetDismissed allows alert to show again", () => {
		const tasks = Array.from({ length: 6 }, (_, i) => ({
			id: `t${i}`, label: `Task ${i}`, completed: false, order: i,
		}));
		const session = makeSession({ executionTasks: tasks });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const alert = new CognitiveLoadAlert(container, deps);
		alert.render();

		const dismissBtn = container.querySelector(".ft-overload-dismiss") as HTMLButtonElement;
		dismissBtn.click();
		expect(container.querySelector(".ft-overload-alert")).toBeNull();

		alert.resetDismissed();
		alert.refreshAlert();
		expect(container.querySelector(".ft-overload-alert")).toBeTruthy();
	});

	it("does not render for completed sessions", () => {
		const tasks = Array.from({ length: 6 }, (_, i) => ({
			id: `t${i}`, label: `Task ${i}`, completed: false, order: i,
		}));
		const session = makeSession({ status: "completed", executionTasks: tasks });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const alert = new CognitiveLoadAlert(container, deps);
		alert.render();

		expect(container.querySelector(".ft-overload-alert")).toBeNull();
	});

	it("does not render for archived sessions", () => {
		const tasks = Array.from({ length: 6 }, (_, i) => ({
			id: `t${i}`, label: `Task ${i}`, completed: false, order: i,
		}));
		const session = makeSession({ status: "archived", executionTasks: tasks });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const alert = new CognitiveLoadAlert(container, deps);
		alert.render();

		expect(container.querySelector(".ft-overload-alert")).toBeNull();
	});

	it("renders for paused sessions", () => {
		const tasks = Array.from({ length: 6 }, (_, i) => ({
			id: `t${i}`, label: `Task ${i}`, completed: false, order: i,
		}));
		const session = makeSession({ status: "paused", executionTasks: tasks });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const alert = new CognitiveLoadAlert(container, deps);
		alert.render();

		expect(container.querySelector(".ft-overload-alert")).toBeTruthy();
	});

	it("renders multiple reasons as list items", () => {
		const tasks = Array.from({ length: 6 }, (_, i) => ({
			id: `t${i}`, label: `Task ${i}`, completed: false, order: i,
		}));
		const bindings = Array.from({ length: 9 }, (_, i) => ({
			id: `ctx${i}`, type: "file" as const, label: `file${i}.md`, path: `/file${i}.md`, boundAt: new Date().toISOString(),
		}));
		const session = makeSession({ executionTasks: tasks, contextBindings: bindings });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const alert = new CognitiveLoadAlert(container, deps);
		alert.render();

		const listItems = container.querySelectorAll(".ft-overload-alert li");
		expect(listItems.length).toBeGreaterThanOrEqual(2);
	});
});
