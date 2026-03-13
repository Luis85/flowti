import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
}));
vi.mock("../../../src/ui/help-content.js", () => ({
	getHelp: vi.fn((section: string) => {
		const content: Record<string, string> = {
			main: "FLOWTI CLI help", build: "BUILD help", make: "MAKE help",
			review: "REVIEW help", publish: "PUBLISH help", reports: "REPORTS help",
			devtools: "DEVTOOLS help", capture: "CAPTURE help",
			knowledgebase: "KNOWLEDGEBASE help", info: "INFO help",
		};
		return content[section] ?? null;
	}),
	getHelpSections: vi.fn(() => [
		"main", "make", "build", "review", "publish",
		"reports", "devtools", "capture", "knowledgebase", "info",
	]),
}));

import { showHelp } from "../../../src/ui/help.js";
import { getHelp, getHelpSections } from "../../../src/ui/help-content.js";
import { log } from "../../../src/infrastructure/logger.js";

const mockLog = log as ReturnType<typeof vi.fn>;

beforeEach(() => mockLog.mockClear());

describe("getHelp", () => {
	it("returns content for the main section", () => {
		expect(getHelp("main")).toBeDefined();
		expect(getHelp("main")).toContain("FLOWTI CLI");
	});

	it("returns content for all expected sections", () => {
		const expected = ["main", "make", "build", "review", "publish", "reports", "devtools", "capture", "info"];
		for (const key of expected) {
			expect(getHelp(key)).toBeDefined();
		}
	});
});

describe("showHelp", () => {
	it("logs main help when no section is given", () => {
		showHelp();
		expect(mockLog).toHaveBeenCalledWith(getHelp("main"));
	});

	it("logs main help when section is 'main'", () => {
		showHelp("main");
		expect(mockLog).toHaveBeenCalledWith(getHelp("main"));
	});

	it("logs help for a known section", () => {
		showHelp("build");
		expect(mockLog).toHaveBeenCalledWith(getHelp("build"));
	});

	it("is case-insensitive", () => {
		showHelp("BUILD");
		expect(mockLog).toHaveBeenCalledWith(getHelp("build"));
	});

	it("shows error for unknown section", () => {
		showHelp("nonexistent");
		expect(mockLog).toHaveBeenCalledWith(expect.stringContaining("No help available"));
	});

	it("lists available sections for unknown section", () => {
		showHelp("nonexistent");
		const calls = mockLog.mock.calls.flat().join(" ");
		expect(calls).toContain("main");
		expect(calls).toContain("build");
	});
});

describe("commands.help", () => {
	it("shows main help when no flags or args", async () => {
		const { commands } = await import("../../../src/ui/help.js");
		mockLog.mockClear();
		commands.help({}, []);
		expect(mockLog).toHaveBeenCalledWith(getHelp("main"));
	});

	it("shows section help from flags", async () => {
		const { commands } = await import("../../../src/ui/help.js");
		mockLog.mockClear();
		commands.help({ build: true }, []);
		expect(mockLog).toHaveBeenCalledWith(getHelp("build"));
	});

	it("shows section help from rawArgs", async () => {
		const { commands } = await import("../../../src/ui/help.js");
		mockLog.mockClear();
		commands.help({}, ["help", "make"]);
		expect(mockLog).toHaveBeenCalledWith(getHelp("make"));
	});
});
