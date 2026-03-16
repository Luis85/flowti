import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { TaskView } from "../../../src/tui/chat/task-view.js";
import type { TaskItem } from "../../../src/tui/chat/task-view.js";

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("TaskView", () => {
	it("renders empty state", () => {
		const { unmount, ...instance } = render(
			React.createElement(TaskView, { tasks: [] }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("No tasks");
		unmount();
	});

	it("renders tasks with status indicators", () => {
		const tasks: TaskItem[] = [
			{ id: "1", label: "Install deps", status: "done" },
			{ id: "2", label: "Run tests", status: "running" },
			{ id: "3", label: "Deploy", status: "pending" },
			{ id: "4", label: "Cleanup", status: "failed" },
		];
		const { unmount, ...instance } = render(
			React.createElement(TaskView, { tasks }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("\u2713");
		expect(frame).toContain("\u25B6");
		expect(frame).toContain("\u231B");
		expect(frame).toContain("\u2717");
		unmount();
	});

	it("shows task labels", () => {
		const tasks: TaskItem[] = [
			{ id: "1", label: "Install deps", status: "done" },
			{ id: "2", label: "Run tests", status: "running" },
		];
		const { unmount, ...instance } = render(
			React.createElement(TaskView, { tasks }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Install deps");
		expect(frame).toContain("Run tests");
		unmount();
	});
});
