import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockFs } from "../../mocks/mock-fs.js";

vi.mock("../../../src/infrastructure/config.js", () => ({
	PROJECTS_DIR: "/mock/vault/01 - Projects",
	cliConfig: { defaultAuthor: "Test Author" },
}));

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
	printHeader: vi.fn(),
}));

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {},
}));

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: {},
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn() },
}));

vi.mock("../../../src/infrastructure/menu.js", () => ({
	runMenu: vi.fn(),
}));

vi.mock("../../../src/domain/help/help.js", () => ({
	showHelp: vi.fn(),
}));

vi.mock("../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(() => null),
}));

vi.mock("../../../src/infrastructure/fs.js", () => ({
	writeFileAt: vi.fn(() => true),
}));

vi.mock("../../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn(() => { throw new Error("proc.exit called"); }) },
}));

import * as fsMod from "../../../src/infrastructure/filesystem.js";
import { writeFileAt } from "../../../src/infrastructure/fs.js";
import { log } from "../../../src/infrastructure/logger.js";
import { proc } from "../../../src/infrastructure/proc.js";
import { runMenu } from "../../../src/infrastructure/menu.js";
import { readProjectConfig } from "../../../src/domain/project/project-config.js";
import {
	commands, menu,
} from "../../../src/domain/make/make.js";

// ── Non-interactive commands ────────────────────────────────────────

describe("make:hub command", () => {
	const mockProject = {
		path: "/mock/project",
		pkg: { name: "test", version: "1.0.0" },
		config: { name: "test" },
		scripts: {},
	};

	beforeEach(() => {
		vi.mocked(writeFileAt).mockReset().mockReturnValue(true);
		vi.mocked(log).mockReset();
		vi.mocked(proc.exit).mockReset().mockImplementation(() => { throw new Error("proc.exit called"); });
		const mockFs = createMockFs();
		Object.assign(fsMod, { disk: mockFs });
	});

	it("logs error and exits when --name is missing", () => {
		expect(() => commands["make:hub"]({}, [], "make:hub", mockProject)).toThrow("proc.exit called");

		expect(vi.mocked(log)).toHaveBeenCalledWith(expect.stringContaining("--name is required"));
		expect(vi.mocked(proc.exit)).toHaveBeenCalledWith(1);
	});

	it("exits when no project is provided", () => {
		expect(() => commands["make:hub"]({ name: "Inventory" })).toThrow("proc.exit called");

		expect(vi.mocked(log)).toHaveBeenCalledWith(expect.stringContaining("No project selected"));
	});

	it("creates hub files with default options", () => {
		commands["make:hub"]({ name: "Inventory" }, [], "make:hub", mockProject);

		// 9 files: view, types, events, service, provider, test, css, prd, journey
		expect(vi.mocked(writeFileAt).mock.calls.length).toBeGreaterThanOrEqual(9);

		const paths = vi.mocked(writeFileAt).mock.calls.map((c) => c[1] as string);
		expect(paths.some((p) => p.includes("InventoryHubView.ts"))).toBe(true);
		expect(paths.some((p) => p.includes("types.ts"))).toBe(true);
		expect(paths.some((p) => p.includes("events.ts"))).toBe(true);
		expect(paths.some((p) => p.includes("InventoryService.ts"))).toBe(true);
		expect(paths.some((p) => p.includes("InventoryHubProvider.ts"))).toBe(true);
		expect(paths.some((p) => p.includes("InventoryHubView.test.ts"))).toBe(true);
		expect(paths.some((p) => p.includes(".css"))).toBe(true);
		expect(paths.some((p) => p.includes("Inventory Hub.md"))).toBe(true);
		expect(paths.some((p) => p.includes("inventory.journey.json"))).toBe(true);
	});

	it("uses custom icon and tabs from flags", () => {
		commands["make:hub"]({ name: "Stock", icon: "package", tabs: "list,detail,settings" }, [], "make:hub", mockProject);

		const paths = vi.mocked(writeFileAt).mock.calls.map((c) => c[1] as string);
		expect(paths.some((p) => p.includes("StockHubView.ts"))).toBe(true);
		expect(vi.mocked(writeFileAt).mock.calls.length).toBeGreaterThanOrEqual(9);
	});
});

describe("menu", () => {
	beforeEach(() => {
		vi.mocked(log).mockReset();
		vi.mocked(runMenu).mockReset();
		vi.mocked(readProjectConfig).mockReset();
	});

	it("returns main when no templates configured", async () => {
		vi.mocked(readProjectConfig).mockReturnValue({ make: { templates: [] } } as ReturnType<typeof readProjectConfig>);

		const result = await menu("/mock/project");

		expect(result).toBe("main");
		expect(vi.mocked(log)).toHaveBeenCalledWith(expect.stringContaining("No Make templates configured"));
	});

	it("calls runMenu with available templates", async () => {
		vi.mocked(readProjectConfig).mockReturnValue(null);
		vi.mocked(runMenu).mockResolvedValue("main");

		await menu("/mock/project");

		expect(vi.mocked(runMenu)).toHaveBeenCalledWith("Make", expect.arrayContaining([
			expect.objectContaining({ key: "1", label: "New Hub" }),
			expect.objectContaining({ key: "2", label: expect.stringContaining("Journey") }),
		]));
	});
});
