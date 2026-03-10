import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "",
	printHeader: vi.fn(),
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../src/infrastructure/menu.js", () => ({
	runMenu: vi.fn(),
}));

vi.mock("../../../src/ui/help.js", () => ({
	showHelp: vi.fn(),
}));

vi.mock("../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(() => ({ config: null, warnings: [] })),
}));

vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn() },
}));

vi.mock("../../../src/infrastructure/config.js", () => ({
	cliConfig: {},
}));

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readdirSync: vi.fn(() => []) },
}));

vi.mock("../../../src/infrastructure/fs.js", () => ({
	writeFileAt: vi.fn(() => true),
}));

import { log } from "../../../src/infrastructure/logger.js";
import { runMenu } from "../../../src/infrastructure/menu.js";
import { readProjectConfig } from "../../../src/domain/project/project-config.js";
import { getAvailableTemplates } from "../../../src/domain/make/MakeService.js";
import { menu } from "../../../src/ui/menus/make-menu.js";

describe("getAvailableTemplates", () => {
	it("returns all templates when no project config", () => {
		vi.mocked(readProjectConfig).mockReturnValue({ config: null, warnings: [] });
		const templates = getAvailableTemplates("/mock/project");
		expect(templates).toEqual(["journey", "component"]);
	});

	it("returns configured templates when config exists", () => {
		vi.mocked(readProjectConfig).mockReturnValue({ config: { name: "test", make: { templates: ["journey"] } }, warnings: [] });

		const templates = getAvailableTemplates("/mock/project");
		expect(templates).toEqual(["journey"]);
	});

	it("returns empty array when config specifies no templates", () => {
		vi.mocked(readProjectConfig).mockReturnValue({ config: { name: "test", make: { templates: [] } }, warnings: [] });

		const templates = getAvailableTemplates("/mock/project");
		expect(templates).toEqual([]);
	});
});

describe("menu", () => {
	beforeEach(() => {
		vi.mocked(log).mockReset();
		vi.mocked(runMenu).mockReset();
		vi.mocked(readProjectConfig).mockReset();
	});

	it("returns main when no templates configured", async () => {
		vi.mocked(readProjectConfig).mockReturnValue({ config: { name: "test", make: { templates: [] } }, warnings: [] });

		const result = await menu("/mock/project");

		expect(result).toBe("main");
		expect(vi.mocked(log)).toHaveBeenCalledWith(expect.stringContaining("No Make templates configured"));
	});

	it("calls runMenu with available templates", async () => {
		vi.mocked(readProjectConfig).mockReturnValue({ config: null, warnings: [] });
		vi.mocked(runMenu).mockResolvedValue("main");

		await menu("/mock/project");

		expect(vi.mocked(runMenu)).toHaveBeenCalledWith("Make", expect.arrayContaining([
			expect.objectContaining({ key: "1", label: "New E2E Journey" }),
			expect.objectContaining({ key: "2", label: "Add Component" }),
		]));
	});

	it("includes back and quit items", async () => {
		vi.mocked(readProjectConfig).mockReturnValue({ config: null, warnings: [] });
		vi.mocked(runMenu).mockResolvedValue("main");

		await menu("/mock/project");

		const items = vi.mocked(runMenu).mock.calls[0][1] as Array<{ key?: string }>;
		const keys = items.filter((i) => "key" in i).map((i) => i.key);
		expect(keys).toContain("b");
		expect(keys).toContain("q");
		expect(keys).toContain("?");
	});

	it("respects configured template subset", async () => {
		vi.mocked(readProjectConfig).mockReturnValue({ config: { name: "test", make: { templates: ["journey"] } }, warnings: [] });
		vi.mocked(runMenu).mockResolvedValue("main");

		await menu("/mock/project");

		const items = vi.mocked(runMenu).mock.calls[0][1] as Array<{ key?: string; label?: string }>;
		const labels = items.filter((i) => "label" in i).map((i) => i.label);
		expect(labels).toContain("New E2E Journey");
		expect(labels).not.toContain("Add Component");
	});
});
