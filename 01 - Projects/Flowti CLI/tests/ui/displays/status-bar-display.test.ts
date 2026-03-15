import { describe, it, expect, vi } from "vitest";
import { renderStatusBar } from "../../../src/ui/displays/status-bar-display.js";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", DIM: "", YELLOW: "", CYAN: "", BOLD: "",
}));

describe("renderStatusBar", () => {
	it("does not render when no questions", () => {
		const log = vi.fn();
		renderStatusBar([], log);
		expect(log).not.toHaveBeenCalled();
	});

	it("renders single agent question", () => {
		const log = vi.fn();
		renderStatusBar([{ agentName: "Bob", persona: "Bobby", question: "What framework?", task: "build" }], log);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Bobby"));
		expect(log).toHaveBeenCalledWith(expect.stringContaining("What framework?"));
		expect(log).toHaveBeenCalledWith(expect.stringContaining("!"));
	});

	it("renders count badge for multiple agents", () => {
		const log = vi.fn();
		const questions = [
			{ agentName: "Bob", persona: "Bobby", question: "Q1?", task: "t1" },
			{ agentName: "Dev", question: "Q2?", task: "t2" },
		];
		renderStatusBar(questions, log);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("2"));
	});

	it("truncates long question text", () => {
		const log = vi.fn();
		const longQ = "A".repeat(100);
		renderStatusBar([{ agentName: "Bob", question: longQ, task: "t" }], log);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("..."));
	});

	it("uses agentName when no persona", () => {
		const log = vi.fn();
		renderStatusBar([{ agentName: "Dev", question: "Q?", task: "t" }], log);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Dev"));
	});
});
