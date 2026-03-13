import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
}));
vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
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

import { showHelp, commands } from "../../../src/ui/help.js";
import { getHelp, getHelpSections } from "../../../src/ui/help-content.js";
import { log } from "../../../src/infrastructure/logger.js";

const mockLog = log as ReturnType<typeof vi.fn>;

beforeEach(() => mockLog.mockClear());

describe("help sections", () => {
	it("has exactly 10 sections", () => {
		const sections = getHelpSections();
		expect(sections).toHaveLength(10);
		expect(sections).toEqual(
			expect.arrayContaining([
				"main", "make", "build", "review", "publish",
				"reports", "devtools", "capture", "knowledgebase", "info",
			]),
		);
	});

	it("each section returns non-empty content", () => {
		for (const section of getHelpSections()) {
			const content = getHelp(section);
			expect(typeof content, `${section} should be a string`).toBe("string");
			expect(content!.trim().length, `${section} should be non-empty`).toBeGreaterThan(0);
		}
	});
});

describe("showHelp", () => {
	it("shows main help when called with no argument", () => {
		showHelp();
		expect(mockLog).toHaveBeenCalledWith(getHelp("main"));
	});

	it("shows build help when called with 'build'", () => {
		showHelp("build");
		expect(mockLog).toHaveBeenCalledWith(getHelp("build"));
		expect(mockLog.mock.calls.flat().join(" ")).toContain("BUILD");
	});

	it("shows error message with available sections for unknown section", () => {
		showHelp("unknown");
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("No help available");
		expect(output).toContain("unknown");
		expect(output).toContain("main");
		expect(output).toContain("build");
	});

	it("is case-insensitive", () => {
		showHelp("BUILD");
		expect(mockLog).toHaveBeenCalledWith(getHelp("build"));
	});
});

describe("commands.help", () => {
	it("uses flag key as section", () => {
		commands.help({ build: true }, []);
		expect(mockLog).toHaveBeenCalledWith(getHelp("build"));
	});

	it("uses rawArgs[1] as section", () => {
		commands.help({}, ["help", "publish"]);
		expect(mockLog).toHaveBeenCalledWith(getHelp("publish"));
	});

	it("defaults to main when no flags or args", () => {
		commands.help({}, []);
		expect(mockLog).toHaveBeenCalledWith(getHelp("main"));
	});
});
