import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

import { HELP, showHelp, commands } from "../../../src/ui/help.js";
import { log } from "../../../src/infrastructure/logger.js";

const mockLog = log as ReturnType<typeof vi.fn>;

beforeEach(() => mockLog.mockClear());

describe("HELP sections", () => {
	it("has exactly 10 sections", () => {
		const keys = Object.keys(HELP);
		expect(keys).toHaveLength(10);
		expect(keys).toEqual(
			expect.arrayContaining([
				"main", "make", "build", "review", "publish",
				"reports", "devtools", "capture", "knowledgebase", "info",
			]),
		);
	});

	it("each section is a non-empty string", () => {
		for (const [key, value] of Object.entries(HELP)) {
			expect(typeof value, `${key} should be a string`).toBe("string");
			expect(value.trim().length, `${key} should be non-empty`).toBeGreaterThan(0);
		}
	});
});

describe("showHelp", () => {
	it("shows main help when called with no argument", () => {
		showHelp();
		expect(mockLog).toHaveBeenCalledWith(HELP.main);
	});

	it("shows build help when called with 'build'", () => {
		showHelp("build");
		expect(mockLog).toHaveBeenCalledWith(HELP.build);
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
		expect(mockLog).toHaveBeenCalledWith(HELP.build);
	});
});

describe("commands.help", () => {
	it("uses flag key as section", () => {
		commands.help({ build: true }, []);
		expect(mockLog).toHaveBeenCalledWith(HELP.build);
	});

	it("uses rawArgs[1] as section", () => {
		commands.help({}, ["help", "publish"]);
		expect(mockLog).toHaveBeenCalledWith(HELP.publish);
	});

	it("defaults to main when no flags or args", () => {
		commands.help({}, []);
		expect(mockLog).toHaveBeenCalledWith(HELP.main);
	});
});
