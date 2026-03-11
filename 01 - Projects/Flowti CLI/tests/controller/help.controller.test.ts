/**
 * help.controller.test.ts — Tests for the help controller.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn(), argv: () => [], cwd: () => "/", env: () => ({}) },
}));
vi.mock("../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
}));
vi.mock("../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: () => false, readFileSync: () => "{}", readdirSync: () => [] },
}));
vi.mock("../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...a: string[]) => a.join("/"),
		resolve: (...a: string[]) => a.join("/"),
		dirname: (p: string) => p,
		basename: (p: string) => p.split("/").pop() ?? p,
	},
}));

import { commands } from "../../src/controller/help.controller.js";
import { log } from "../../src/infrastructure/logger.js";

const mockLog = log as ReturnType<typeof vi.fn>;

describe("help.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders help content for a known section", () => {
		commands.help({ build: true }, ["help", "build"], "help");

		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("BUILD");
	});

	it("renders help for rawArgs[1] when no flags", () => {
		commands.help({}, ["help", "reports"], "help");

		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("REPORTS");
	});

	it('renders main help when no flags and no args', () => {
		commands.help({}, [], "help");

		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("FLOWTI CLI");
	});

	it("prefers flag key over rawArgs", () => {
		commands.help({ build: true }, ["help", "scaffold"], "help");

		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("BUILD");
	});

	it("shows error for unknown section", () => {
		commands.help({ nonexistent: true }, ["help"], "help");

		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("No help available");
	});

	it("outputs JSON in json format", () => {
		commands.help({ format: "json" }, [], "help");

		const jsonOutput = mockLog.mock.calls.flat().join("");
		const parsed = JSON.parse(jsonOutput);
		expect(parsed).toHaveProperty("section", "format");
		expect(parsed).toHaveProperty("availableSections");
	});
});
