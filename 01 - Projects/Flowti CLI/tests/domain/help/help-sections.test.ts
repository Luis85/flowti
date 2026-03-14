import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
}));
vi.mock("../../../src/ui/help-content.js", () => ({
	getHelp: vi.fn((section: string, _deps: unknown) => {
		const content: Record<string, string> = {
			main: "FLOWTI CLI help", build: "BUILD help", make: "MAKE help",
			review: "REVIEW help", publish: "PUBLISH help", reports: "REPORTS help",
			devtools: "DEVTOOLS help", capture: "CAPTURE help",
			knowledgebase: "KNOWLEDGEBASE help", info: "INFO help",
		};
		return content[section] ?? null;
	}),
	getHelpSections: vi.fn((_deps: unknown) => [
		"main", "make", "build", "review", "publish",
		"reports", "devtools", "capture", "knowledgebase", "info",
	]),
}));

import { showHelp } from "../../../src/ui/help.js";
import { getHelp, getHelpSections } from "../../../src/ui/help-content.js";

const mockLog = vi.fn();
const mockDeps = { disk: {} as never, paths: {} as never, log: mockLog };

beforeEach(() => mockLog.mockClear());

describe("help sections", () => {
	it("has exactly 10 sections", () => {
		const sections = getHelpSections(mockDeps);
		expect(sections).toHaveLength(10);
		expect(sections).toEqual(
			expect.arrayContaining([
				"main", "make", "build", "review", "publish",
				"reports", "devtools", "capture", "knowledgebase", "info",
			]),
		);
	});

	it("each section returns non-empty content", () => {
		for (const section of getHelpSections(mockDeps)) {
			const content = getHelp(section, mockDeps);
			expect(typeof content, `${section} should be a string`).toBe("string");
			expect(content!.trim().length, `${section} should be non-empty`).toBeGreaterThan(0);
		}
	});
});

describe("showHelp", () => {
	it("shows main help when called with no argument", () => {
		showHelp(undefined, mockDeps);
		expect(mockLog).toHaveBeenCalledWith(getHelp("main", mockDeps));
	});

	it("shows build help when called with 'build'", () => {
		showHelp("build", mockDeps);
		expect(mockLog).toHaveBeenCalledWith(getHelp("build", mockDeps));
		expect(mockLog.mock.calls.flat().join(" ")).toContain("BUILD");
	});

	it("shows error message with available sections for unknown section", () => {
		showHelp("unknown", mockDeps);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("No help available");
		expect(output).toContain("unknown");
		expect(output).toContain("main");
		expect(output).toContain("build");
	});

	it("is case-insensitive", () => {
		showHelp("BUILD", mockDeps);
		expect(mockLog).toHaveBeenCalledWith(getHelp("build", mockDeps));
	});
});
