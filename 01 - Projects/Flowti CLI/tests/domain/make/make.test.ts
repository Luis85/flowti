import { describe, it, expect, vi, beforeEach } from "vitest";

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
	readProjectConfig: vi.fn(() => ({ config: null, warnings: [] })),
}));

vi.mock("../../../src/infrastructure/fs.js", () => ({
	writeFileAt: vi.fn(() => true),
}));

vi.mock("../../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn(() => { throw new Error("proc.exit called"); }) },
}));

import { log } from "../../../src/infrastructure/logger.js";
import { runMenu } from "../../../src/infrastructure/menu.js";
import { readProjectConfig } from "../../../src/domain/project/project-config.js";
import {
	menu,
} from "../../../src/ui/menus/make-menu.js";

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
			expect.objectContaining({ key: "1", label: expect.stringContaining("Journey") }),
			expect.objectContaining({ key: "2", label: expect.stringContaining("Component") }),
		]));
	});
});
