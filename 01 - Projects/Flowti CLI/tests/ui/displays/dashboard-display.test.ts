import { describe, it, expect, vi } from "vitest";
import { displayDashboard, type DashboardModel, type DashboardAgent } from "../../../src/ui/displays/dashboard-display.js";

function capture(): { lines: string[]; log: (msg?: string) => void } {
	const lines: string[] = [];
	return { lines, log: (msg?: string) => { lines.push(msg ?? ""); } };
}

function stripAnsi(s: string): string {
	return s.replace(/\x1b\[[0-9;]*m/g, "");
}

describe("displayDashboard", () => {
	it("renders header with project name", () => {
		const model: DashboardModel = { agents: [], projectName: "Flowti CLI" };
		const { lines, log } = capture();
		displayDashboard(model, log);
		const output = lines.map(stripAnsi).join("\n");
		expect(output).toContain("Agent Dashboard");
		expect(output).toContain("Flowti CLI");
	});

	it("renders header without project name", () => {
		const model: DashboardModel = { agents: [] };
		const { lines, log } = capture();
		displayDashboard(model, log);
		const output = lines.map(stripAnsi).join("\n");
		expect(output).toContain("Agent Dashboard");
		expect(output).not.toContain("undefined");
	});

	it("renders no-agents message when roster is empty", () => {
		const model: DashboardModel = { agents: [] };
		const { lines, log } = capture();
		displayDashboard(model, log);
		const output = lines.map(stripAnsi).join("\n");
		expect(output).toContain("No agents registered");
	});

	it("renders agent rows with name and status", () => {
		const agents: DashboardAgent[] = [
			{ name: "Atlas", persona: "Lead Architect", status: "idle" },
			{ name: "Dev", persona: "Alice", status: "busy", task: "Write tests" },
			{ name: "Bot", status: "waiting" },
			{ name: "Old", status: "offline" },
		];
		const model: DashboardModel = { agents };
		const { lines, log } = capture();
		displayDashboard(model, log);
		const output = lines.map(stripAnsi).join("\n");

		expect(output).toContain("Lead Architect");
		expect(output).toContain("Alice");
		expect(output).toContain("Bot");
		expect(output).toContain("Old");
		expect(output).toContain("Write tests");
	});

	it("renders summary counts", () => {
		const agents: DashboardAgent[] = [
			{ name: "A", status: "idle" },
			{ name: "B", status: "busy" },
			{ name: "C", status: "busy" },
			{ name: "D", status: "waiting" },
			{ name: "E", status: "offline" },
		];
		const model: DashboardModel = { agents };
		const { lines, log } = capture();
		displayDashboard(model, log);
		const output = lines.map(stripAnsi).join("\n");

		expect(output).toContain("1 idle");
		expect(output).toContain("2 working");
		expect(output).toContain("1 waiting");
		expect(output).toContain("1 offline");
	});

	it("truncates long task names", () => {
		const longTask = "A".repeat(60);
		const agents: DashboardAgent[] = [{ name: "Dev", status: "busy", task: longTask }];
		const model: DashboardModel = { agents };
		const { lines, log } = capture();
		displayDashboard(model, log);
		const output = lines.map(stripAnsi).join("\n");

		expect(output).not.toContain(longTask);
		expect(output).toContain("A".repeat(40));
	});
});
