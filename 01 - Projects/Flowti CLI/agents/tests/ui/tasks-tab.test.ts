// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderTasksTab } from "../../src/ui/tasks-tab.js";
import type { DashboardAgent } from "../../src/data/types.js";

interface AgentWithTasks extends DashboardAgent {
	readonly tasks: readonly { name: string; status: "pending" | "in-progress" | "completed" }[];
}

function makeAgent(overrides: Partial<AgentWithTasks> = {}): AgentWithTasks {
	return {
		name: "TestBot",
		agentType: "human",
		status: "busy",
		tasks: [
			{ name: "Fix bug #42", status: "in-progress" },
			{ name: "Write docs", status: "pending" },
			{ name: "Deploy v2", status: "completed" },
		],
		suggestedTasks: [
			{ name: "Code review", phases: ["in-progress"] },
			{ name: "Sprint planning", phases: ["planned"] },
			{ name: "General cleanup", phases: [] },
		],
		...overrides,
	};
}

function makeOptions() {
	return {
		assignTask: vi.fn().mockResolvedValue({ ok: true }),
		baseUrl: "http://localhost:3000",
		currentPhase: "in-progress" as string | undefined,
		isAiAgent: false,
	};
}

describe("renderTasksTab", () => {
	it("renders task list with status badges", () => {
		const container = document.createElement("div");
		renderTasksTab(container, makeAgent(), makeOptions());

		const items = container.querySelectorAll(".agent-panel-task-item");
		expect(items.length).toBe(3);

		const badges = container.querySelectorAll(".agent-panel-task-badge");
		expect(badges.length).toBe(3);

		const statuses = Array.from(badges).map((b) => b.getAttribute("data-status"));
		expect(statuses).toEqual(["in-progress", "pending", "completed"]);
	});

	it("renders task names", () => {
		const container = document.createElement("div");
		renderTasksTab(container, makeAgent(), makeOptions());

		const items = container.querySelectorAll(".agent-panel-task-item");
		expect(items[0].textContent).toContain("Fix bug #42");
		expect(items[1].textContent).toContain("Write docs");
		expect(items[2].textContent).toContain("Deploy v2");
	});

	it("shows empty message when no tasks", () => {
		const container = document.createElement("div");
		const agent = makeAgent({ tasks: [] });
		renderTasksTab(container, agent, makeOptions());

		const empty = container.querySelector(".agent-panel-empty");
		expect(empty?.textContent).toBe("No tasks assigned.");
	});

	it("assign button fires callback with task name", () => {
		const container = document.createElement("div");
		const options = makeOptions();
		renderTasksTab(container, makeAgent(), options);

		const assignBtns = container.querySelectorAll<HTMLButtonElement>(".agent-panel-assign-btn");
		expect(assignBtns.length).toBeGreaterThan(0);

		assignBtns[0].click();
		expect(options.assignTask).toHaveBeenCalledWith(
			"http://localhost:3000",
			"TestBot",
			assignBtns[0].getAttribute("data-task"),
		);
	});

	it("filters tasks by current phase — hides non-matching phases", () => {
		const container = document.createElement("div");
		const options = makeOptions();
		options.currentPhase = "in-progress";
		renderTasksTab(container, makeAgent(), options);

		const assignBtns = container.querySelectorAll<HTMLButtonElement>(".agent-panel-assign-btn");
		const taskNames = Array.from(assignBtns).map((b) => b.getAttribute("data-task"));

		// "Code review" has phases: ["in-progress"] — shown
		expect(taskNames).toContain("Code review");
		// "Sprint planning" has phases: ["planned"] — hidden when phase is "in-progress"
		expect(taskNames).not.toContain("Sprint planning");
	});

	it("tasks with empty phases array are always shown", () => {
		const container = document.createElement("div");
		const options = makeOptions();
		options.currentPhase = "in-progress";
		renderTasksTab(container, makeAgent(), options);

		const assignBtns = container.querySelectorAll<HTMLButtonElement>(".agent-panel-assign-btn");
		const taskNames = Array.from(assignBtns).map((b) => b.getAttribute("data-task"));

		// "General cleanup" has phases: [] — always shown
		expect(taskNames).toContain("General cleanup");
	});

	it("shows all suggested tasks when no current phase", () => {
		const container = document.createElement("div");
		const options = makeOptions();
		options.currentPhase = undefined;
		renderTasksTab(container, makeAgent(), options);

		const assignBtns = container.querySelectorAll<HTMLButtonElement>(".agent-panel-assign-btn");
		const taskNames = Array.from(assignBtns).map((b) => b.getAttribute("data-task"));

		expect(taskNames).toContain("Code review");
		expect(taskNames).toContain("Sprint planning");
		expect(taskNames).toContain("General cleanup");
	});

	it("shows confirmation dialog for AI agents before assigning", () => {
		const container = document.createElement("div");
		// Wrap container in a panel for .closest() to work
		const panel = document.createElement("div");
		panel.className = "agent-panel";
		panel.appendChild(container);
		document.body.appendChild(panel);

		const options = makeOptions();
		options.isAiAgent = true;
		renderTasksTab(container, makeAgent(), options);

		const assignBtns = container.querySelectorAll<HTMLButtonElement>(".agent-panel-assign-btn");
		assignBtns[0].click();

		// Should not call assignTask yet — confirmation dialog should appear
		expect(options.assignTask).not.toHaveBeenCalled();

		const confirmOverlay = panel.querySelector(".agent-panel-confirm-overlay");
		expect(confirmOverlay).not.toBeNull();

		// Click confirm
		const confirmBtn = confirmOverlay!.querySelector<HTMLButtonElement>(".agent-panel-assign-btn");
		confirmBtn!.click();

		expect(options.assignTask).toHaveBeenCalledOnce();

		document.body.removeChild(panel);
	});
});
