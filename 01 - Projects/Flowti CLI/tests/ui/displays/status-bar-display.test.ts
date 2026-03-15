import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", DIM: "", YELLOW: "", CYAN: "", BOLD: "",
}));

import { renderStatusBar } from "../../../src/ui/displays/status-bar-display.js";

describe("renderStatusBar", () => {
	it("does not render when no questions", () => {
		const log = vi.fn();
		renderStatusBar([], log);
		expect(log).not.toHaveBeenCalled();
	});

	it("renders single agent question with persona", () => {
		const log = vi.fn();
		renderStatusBar([{ agentName: "Bob", persona: "Bobby", question: "What framework?", agent: {} as never, briefPath: "", task: "" }], log);
		expect(log).toHaveBeenCalledTimes(1);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Bobby"));
		expect(log).toHaveBeenCalledWith(expect.stringContaining("What framework?"));
		expect(log).toHaveBeenCalledWith(expect.stringContaining("!"));
	});

	it("uses agentName when no persona", () => {
		const log = vi.fn();
		renderStatusBar([{ agentName: "Dev", question: "Q?", agent: {} as never, briefPath: "", task: "" }], log);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Dev"));
	});

	it("renders count badge for multiple agents", () => {
		const log = vi.fn();
		renderStatusBar([
			{ agentName: "Bob", persona: "Bobby", question: "Q1?", agent: {} as never, briefPath: "", task: "" },
			{ agentName: "Dev", question: "Q2?", agent: {} as never, briefPath: "", task: "" },
		], log);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("2 agents waiting"));
	});

	it("truncates long question text", () => {
		const log = vi.fn();
		renderStatusBar([{ agentName: "Bob", question: "A".repeat(100), agent: {} as never, briefPath: "", task: "" }], log);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("..."));
	});
});
