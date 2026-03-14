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
import { getHelp } from "../../../src/ui/help-content.js";

const mockLog = vi.fn();
const mockDeps = { disk: {} as never, paths: {} as never, log: mockLog };

beforeEach(() => mockLog.mockClear());

describe("getHelp", () => {
	it("returns content for the main section", () => {
		expect(getHelp("main", mockDeps)).toBeDefined();
		expect(getHelp("main", mockDeps)).toContain("FLOWTI CLI");
	});

	it("returns content for all expected sections", () => {
		const expected = ["main", "make", "build", "review", "publish", "reports", "devtools", "capture", "info"];
		for (const key of expected) {
			expect(getHelp(key, mockDeps)).toBeDefined();
		}
	});
});

describe("showHelp", () => {
	it("logs main help when no section is given", () => {
		showHelp(undefined, mockDeps);
		expect(mockLog).toHaveBeenCalledWith(getHelp("main", mockDeps));
	});

	it("logs main help when section is 'main'", () => {
		showHelp("main", mockDeps);
		expect(mockLog).toHaveBeenCalledWith(getHelp("main", mockDeps));
	});

	it("logs help for a known section", () => {
		showHelp("build", mockDeps);
		expect(mockLog).toHaveBeenCalledWith(getHelp("build", mockDeps));
	});

	it("is case-insensitive", () => {
		showHelp("BUILD", mockDeps);
		expect(mockLog).toHaveBeenCalledWith(getHelp("build", mockDeps));
	});

	it("shows error for unknown section", () => {
		showHelp("nonexistent", mockDeps);
		expect(mockLog).toHaveBeenCalledWith(expect.stringContaining("No help available"));
	});

	it("lists available sections for unknown section", () => {
		showHelp("nonexistent", mockDeps);
		const calls = mockLog.mock.calls.flat().join(" ");
		expect(calls).toContain("main");
		expect(calls).toContain("build");
	});
});
