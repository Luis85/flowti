/**
 * help.controller.test.ts — Tests for the help controller.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn(), warn: vi.fn() }));
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
vi.mock("../../src/infrastructure/shell.js", async () => {
	const { mockShellPreset } = await import("../mocks/mock-presets.js");
	return mockShellPreset();
});
vi.mock("../../src/infrastructure/clock.js", () => ({
	clock: { now: () => new Date(), iso: () => "", ms: () => 0, safeIso: () => "" },
}));
vi.mock("../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(async () => ""), askYesNo: vi.fn(async () => false), waitForEnter: vi.fn(async () => {}) },
}));
vi.mock("../../src/ui/renderers/cli-event-renderer.js", () => ({ attachCliRenderer: vi.fn(() => () => {}) }));
vi.mock("../../src/infrastructure/request-response.js", async () => {
	const actual = await vi.importActual<typeof import("../../src/infrastructure/request-response.js")>("../../src/infrastructure/request-response.js");
	return actual;
});
vi.mock("../../src/ui/help-content.js", () => ({
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

	it("prefers rawArgs section over falling back to main", () => {
		commands.help({}, ["help", "build"], "help");

		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("BUILD");
	});

	it("shows error for unknown section", () => {
		commands.help({}, ["help", "nonexistent"], "help");

		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("No help available");
	});

	it("outputs JSON in json format", () => {
		commands.help({ format: "json" }, ["help", "build"], "help");

		const jsonOutput = mockLog.mock.calls.flat().join("");
		const parsed = JSON.parse(jsonOutput);
		expect(parsed).toHaveProperty("section", "build");
		expect(parsed).toHaveProperty("availableSections");
	});
});
