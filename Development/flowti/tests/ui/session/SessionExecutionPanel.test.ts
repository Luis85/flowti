// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, vi } from "vitest";
import { SessionExecutionPanel } from "../../../src/ui/session/SessionExecutionPanel";
import type { SessionPanelDeps } from "../../../src/ui/session/types";
import type { Session, ExecutionTask } from "../../../src/domain/session/types";
import { EventBus } from "../../../src/infrastructure/events/EventBus";

function makeTask(overrides?: Partial<ExecutionTask>): ExecutionTask {
	return {
		id: "task-1",
		label: "Write tests",
		completed: false,
		order: 0,
		...overrides,
	};
}

function makeSession(overrides?: Partial<Session>): Session {
	return {
		id: "session-1",
		type: "event-storming",
		title: "Test Session",
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
			getGlobalActivityFilter: () => [],
		},
		eventBus,
	};
}

describe("SessionExecutionPanel", () => {
	it("renders section with header and count", () => {
		const tasks = [makeTask()];
		const session = makeSession({ executionTasks: tasks });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionExecutionPanel(container, deps);
		panel.render();

		const section = container.querySelector(".ft-session-workspace-tasks");
		expect(section).toBeTruthy();
		expect(section!.textContent).toContain("Execution Plan");
		expect(section!.textContent).toContain("(0/1)");
	});

	it("renders task rows with checkboxes", () => {
		const tasks = [
			makeTask({ id: "t1", label: "Task A", order: 0 }),
			makeTask({ id: "t2", label: "Task B", order: 1 }),
		];
		const session = makeSession({ executionTasks: tasks });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionExecutionPanel(container, deps);
		panel.render();

		const rows = container.querySelectorAll(".ft-task-row");
		expect(rows.length).toBe(2);
		expect(rows[0].textContent).toContain("Task A");
		expect(rows[1].textContent).toContain("Task B");

		const checkboxes = container.querySelectorAll("input[type='checkbox']");
		expect(checkboxes.length).toBe(2);
	});

	it("renders completed task with strikethrough", () => {
		const tasks = [makeTask({ completed: true, completedAt: new Date().toISOString() })];
		const session = makeSession({ executionTasks: tasks });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionExecutionPanel(container, deps);
		panel.render();

		const checkbox = container.querySelector("input[type='checkbox']") as HTMLInputElement;
		expect(checkbox.checked).toBe(true);

		const span = container.querySelector(".ft-task-row span");
		expect(span).toBeTruthy();
		expect((span as HTMLElement).style.cssText).toContain("line-through");
	});

	it("renders progress bar when tasks exist", () => {
		const tasks = [
			makeTask({ id: "t1", completed: true, completedAt: "2026-01-01", order: 0 }),
			makeTask({ id: "t2", completed: false, order: 1 }),
		];
		const session = makeSession({ executionTasks: tasks });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionExecutionPanel(container, deps);
		panel.render();

		const progressFill = container.querySelector(".ft-task-progress-fill") as HTMLElement;
		expect(progressFill).toBeTruthy();
		expect(progressFill.style.width).toBe("50%");
		expect(container.textContent).toContain("1/2 (50%)");
	});

	it("does not render progress bar when no tasks", () => {
		const session = makeSession({ executionTasks: [] });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionExecutionPanel(container, deps);
		panel.render();

		expect(container.querySelector(".ft-task-progress")).toBeNull();
	});

	it("renders add input for active sessions", () => {
		const session = makeSession({ status: "active" });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionExecutionPanel(container, deps);
		panel.render();

		const input = container.querySelector("input[type='text']") as HTMLInputElement;
		expect(input).toBeTruthy();
		expect(input.placeholder).toBe("Add task...");
	});

	it("does not render add input for completed sessions", () => {
		const session = makeSession({ status: "completed" });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionExecutionPanel(container, deps);
		panel.render();

		const input = container.querySelector("input[type='text']");
		expect(input).toBeNull();
	});

	it("does not render add input for archived sessions", () => {
		const session = makeSession({ status: "archived" });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionExecutionPanel(container, deps);
		panel.render();

		const input = container.querySelector("input[type='text']");
		expect(input).toBeNull();
	});

	it("emits session.task.add on Enter in input", () => {
		const session = makeSession({ status: "running" });
		const { deps, eventBus } = makeDeps(session);
		const container = document.createElement("div");
		const emitSpy = vi.spyOn(eventBus, "emit");

		const panel = new SessionExecutionPanel(container, deps);
		panel.render();

		const input = container.querySelector("input[type='text']") as HTMLInputElement;
		input.value = "New task";
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

		expect(emitSpy).toHaveBeenCalledWith("session.task.add", {
			sessionId: "session-1",
			label: "New task",
		});
	});

	it("does not emit when input is empty", () => {
		const session = makeSession({ status: "running" });
		const { deps, eventBus } = makeDeps(session);
		const container = document.createElement("div");
		const emitSpy = vi.spyOn(eventBus, "emit");

		const panel = new SessionExecutionPanel(container, deps);
		panel.render();

		const input = container.querySelector("input[type='text']") as HTMLInputElement;
		input.value = "  ";
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

		expect(emitSpy).not.toHaveBeenCalled();
	});

	it("clears input after successful add", () => {
		const session = makeSession({ status: "running" });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionExecutionPanel(container, deps);
		panel.render();

		const input = container.querySelector("input[type='text']") as HTMLInputElement;
		input.value = "New task";
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

		expect(input.value).toBe("");
	});

	it("emits session.task.toggle on checkbox change", () => {
		const tasks = [makeTask({ id: "task-42" })];
		const session = makeSession({ executionTasks: tasks });
		const { deps, eventBus } = makeDeps(session);
		const container = document.createElement("div");
		const emitSpy = vi.spyOn(eventBus, "emit");

		const panel = new SessionExecutionPanel(container, deps);
		panel.render();

		const checkbox = container.querySelector("input[type='checkbox']") as HTMLInputElement;
		checkbox.dispatchEvent(new Event("change"));

		expect(emitSpy).toHaveBeenCalledWith("session.task.toggle", {
			sessionId: "session-1",
			taskId: "task-42",
		});
	});

	it("emits session.task.remove on remove button click", () => {
		const tasks = [makeTask({ id: "task-42" })];
		const session = makeSession({ executionTasks: tasks });
		const { deps, eventBus } = makeDeps(session);
		const container = document.createElement("div");
		const emitSpy = vi.spyOn(eventBus, "emit");

		const panel = new SessionExecutionPanel(container, deps);
		panel.render();

		const removeBtn = container.querySelector(".ft-task-remove") as HTMLButtonElement;
		expect(removeBtn).toBeTruthy();
		removeBtn.click();

		expect(emitSpy).toHaveBeenCalledWith("session.task.remove", {
			sessionId: "session-1",
			taskId: "task-42",
		});
	});

	it("does not render remove button for completed sessions", () => {
		const tasks = [makeTask()];
		const session = makeSession({ status: "completed", executionTasks: tasks });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionExecutionPanel(container, deps);
		panel.render();

		expect(container.querySelector(".ft-task-remove")).toBeNull();
	});

	it("does not render reorder buttons for archived sessions", () => {
		const tasks = [makeTask({ order: 0 }), makeTask({ id: "t2", order: 1 })];
		const session = makeSession({ status: "archived", executionTasks: tasks });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionExecutionPanel(container, deps);
		panel.render();

		expect(container.querySelector(".ft-task-reorder")).toBeNull();
	});

	it("emits session.task.reorder on move-down click", () => {
		const tasks = [
			makeTask({ id: "t1", label: "First", order: 0 }),
			makeTask({ id: "t2", label: "Second", order: 1 }),
		];
		const session = makeSession({ executionTasks: tasks });
		const { deps, eventBus } = makeDeps(session);
		const container = document.createElement("div");
		const emitSpy = vi.spyOn(eventBus, "emit");

		const panel = new SessionExecutionPanel(container, deps);
		panel.render();

		// First row's down button
		const downBtns = container.querySelectorAll(".ft-task-move-down");
		expect(downBtns.length).toBe(2);
		(downBtns[0] as HTMLButtonElement).click();

		expect(emitSpy).toHaveBeenCalledWith("session.task.reorder", {
			sessionId: "session-1",
			taskIds: ["t2", "t1"],
		});
	});

	it("emits session.task.reorder on move-up click", () => {
		const tasks = [
			makeTask({ id: "t1", label: "First", order: 0 }),
			makeTask({ id: "t2", label: "Second", order: 1 }),
		];
		const session = makeSession({ executionTasks: tasks });
		const { deps, eventBus } = makeDeps(session);
		const container = document.createElement("div");
		const emitSpy = vi.spyOn(eventBus, "emit");

		const panel = new SessionExecutionPanel(container, deps);
		panel.render();

		// Second row's up button
		const upBtns = container.querySelectorAll(".ft-task-move-up");
		expect(upBtns.length).toBe(2);
		(upBtns[1] as HTMLButtonElement).click();

		expect(emitSpy).toHaveBeenCalledWith("session.task.reorder", {
			sessionId: "session-1",
			taskIds: ["t2", "t1"],
		});
	});

	it("disables first row up button and last row down button", () => {
		const tasks = [
			makeTask({ id: "t1", order: 0 }),
			makeTask({ id: "t2", order: 1 }),
		];
		const session = makeSession({ executionTasks: tasks });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionExecutionPanel(container, deps);
		panel.render();

		const upBtns = container.querySelectorAll(".ft-task-move-up") as NodeListOf<HTMLButtonElement>;
		const downBtns = container.querySelectorAll(".ft-task-move-down") as NodeListOf<HTMLButtonElement>;

		expect(upBtns[0].disabled).toBe(true);
		expect(downBtns[1].disabled).toBe(true);
		expect(upBtns[1].disabled).toBe(false);
		expect(downBtns[0].disabled).toBe(false);
	});

	it("refreshTasks updates the displayed list and progress", () => {
		const tasks = [makeTask({ id: "t1", completed: false, order: 0 })];
		const session = makeSession({ executionTasks: tasks });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionExecutionPanel(container, deps);
		panel.render();

		expect(container.querySelectorAll(".ft-task-row").length).toBe(1);
		expect(container.textContent).toContain("(0/1)");

		// Simulate completing the task
		session.executionTasks[0].completed = true;
		panel.refreshTasks();

		expect(container.textContent).toContain("(1/1)");
	});

	it("renders tasks sorted by order", () => {
		const tasks = [
			makeTask({ id: "t2", label: "Second", order: 1 }),
			makeTask({ id: "t1", label: "First", order: 0 }),
		];
		const session = makeSession({ executionTasks: tasks });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionExecutionPanel(container, deps);
		panel.render();

		const rows = container.querySelectorAll(".ft-task-row");
		expect(rows[0].textContent).toContain("First");
		expect(rows[1].textContent).toContain("Second");
	});

	it("renders empty list when no tasks", () => {
		const session = makeSession({ executionTasks: [] });
		const { deps } = makeDeps(session);
		const container = document.createElement("div");

		const panel = new SessionExecutionPanel(container, deps);
		panel.render();

		expect(container.querySelectorAll(".ft-task-row").length).toBe(0);
		expect(container.textContent).toContain("(0/0)");
	});
});
