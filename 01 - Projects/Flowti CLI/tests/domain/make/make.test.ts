import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockFs } from "../../mocks/mock-fs.js";

vi.mock("../../../src/infrastructure/config.js", () => ({
	ROOT: "/mock/root",
	VAULT_ROOT: "/mock/vault",
	config: {},
	manifest: { author: "Test Author" },
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
	PROJECT_TEMPLATES, PROJECT_TEMPLATE_IDS,
	commands, menu,
	type ProjectTemplateId,
} from "../../../src/domain/make/make.js";

describe("PROJECT_TEMPLATE_IDS", () => {
	it("contains all four template types", () => {
		expect(PROJECT_TEMPLATE_IDS).toEqual(["app", "plugin", "cli", "empty"]);
	});

	it("each ID maps to a PROJECT_TEMPLATES entry", () => {
		for (const id of PROJECT_TEMPLATE_IDS) {
			expect(PROJECT_TEMPLATES[id]).toBeDefined();
			expect(PROJECT_TEMPLATES[id].label).toBeTruthy();
			expect(typeof PROJECT_TEMPLATES[id].scaffold).toBe("function");
		}
	});
});

describe("scaffoldEmpty", () => {
	it("creates the project directory", () => {
		const mockFs = createMockFs();
		Object.assign(fsMod, { disk: mockFs });

		PROJECT_TEMPLATES.empty.scaffold("/mock/projects/my-app", "My App");

		expect(mockFs.dirs.has("/mock/projects/my-app")).toBe(true);
	});
});

describe("scaffoldCli", () => {
	beforeEach(() => {
		vi.mocked(writeFileAt).mockClear();
	});

	it("creates package.json and main files", () => {
		const mockFs = createMockFs();
		Object.assign(fsMod, { disk: mockFs });

		PROJECT_TEMPLATES.cli.scaffold("/mock/projects/my-cli", "My CLI");

		const paths = vi.mocked(writeFileAt).mock.calls.map((c) => c[1] as string);
		expect(paths).toContain("package.json");
		expect(paths).toContain("src/main.ts");
		expect(paths).toContain("tests/main.test.ts");
	});

	it("creates valid JSON in package.json", () => {
		const mockFs = createMockFs();
		Object.assign(fsMod, { disk: mockFs });

		PROJECT_TEMPLATES.cli.scaffold("/mock/projects/my-cli", "My CLI");

		const pkgCall = vi.mocked(writeFileAt).mock.calls.find(([, rel]) => rel === "package.json");
		expect(pkgCall).toBeDefined();
		const pkg = JSON.parse(pkgCall![2] as string);
		expect(pkg.name).toBe("my-cli");
		expect(pkg.type).toBe("module");
	});
});

describe("scaffoldPlugin", () => {
	beforeEach(() => {
		vi.mocked(writeFileAt).mockClear();
	});

	it("creates manifest.json and main.ts", () => {
		const mockFs = createMockFs();
		Object.assign(fsMod, { disk: mockFs });

		PROJECT_TEMPLATES.plugin.scaffold("/mock/projects/my-plugin", "My Plugin");

		const paths = vi.mocked(writeFileAt).mock.calls.map((c) => c[1] as string);
		expect(paths).toContain("manifest.json");
		expect(paths).toContain("src/main.ts");
		expect(paths.some((p) => p.includes("00-base.css"))).toBe(true);
	});

	it("sets correct plugin ID from name", () => {
		const mockFs = createMockFs();
		Object.assign(fsMod, { disk: mockFs });

		PROJECT_TEMPLATES.plugin.scaffold("/mock/projects/test", "My Cool Plugin");

		const manifestCall = vi.mocked(writeFileAt).mock.calls.find(([, rel]) => rel === "manifest.json");
		expect(manifestCall).toBeDefined();
		const manifest = JSON.parse(manifestCall![2] as string);
		expect(manifest.id).toBe("my-cool-plugin");
	});
});

describe("scaffoldApp", () => {
	beforeEach(() => {
		vi.mocked(writeFileAt).mockClear();
	});

	it("creates full DDD structure", () => {
		const mockFs = createMockFs();
		Object.assign(fsMod, { disk: mockFs });

		PROJECT_TEMPLATES.app.scaffold("/mock/projects/my-app", "My App");

		const paths = vi.mocked(writeFileAt).mock.calls.map((c) => c[1] as string);
		expect(paths).toContain("manifest.json");
		expect(paths.some((p) => p.includes("EventBus.ts"))).toBe(true);
		expect(paths.some((p) => p.includes("obsidian-stub.ts"))).toBe(true);
		expect(paths.some((p) => p.includes("EventBus.test.ts"))).toBe(true);
	});

	it("creates more files than plugin scaffold", () => {
		const pluginFs = createMockFs();
		Object.assign(fsMod, { disk: pluginFs });
		PROJECT_TEMPLATES.plugin.scaffold("/mock/projects/p", "Plugin");
		const pluginCallCount = vi.mocked(writeFileAt).mock.calls.length;

		vi.mocked(writeFileAt).mockClear();
		const appFs = createMockFs();
		Object.assign(fsMod, { disk: appFs });
		PROJECT_TEMPLATES.app.scaffold("/mock/projects/a", "App");
		const appCallCount = vi.mocked(writeFileAt).mock.calls.length;

		expect(appCallCount).toBeGreaterThan(pluginCallCount);
	});
});

// ── Non-interactive commands ────────────────────────────────────────

describe("make:hub command", () => {
	beforeEach(() => {
		vi.mocked(writeFileAt).mockReset().mockReturnValue(true);
		vi.mocked(log).mockReset();
		vi.mocked(proc.exit).mockReset().mockImplementation(() => { throw new Error("proc.exit called"); });
		const mockFs = createMockFs();
		Object.assign(fsMod, { disk: mockFs });
	});

	it("logs error and exits when --name is missing", () => {
		expect(() => commands["make:hub"]({})).toThrow("proc.exit called");

		expect(vi.mocked(log)).toHaveBeenCalledWith(expect.stringContaining("--name is required"));
		expect(vi.mocked(proc.exit)).toHaveBeenCalledWith(1);
	});

	it("creates hub files with default options", () => {
		commands["make:hub"]({ name: "Inventory" });

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
		commands["make:hub"]({ name: "Stock", icon: "package", tabs: "list,detail,settings" });

		const paths = vi.mocked(writeFileAt).mock.calls.map((c) => c[1] as string);
		expect(paths.some((p) => p.includes("StockHubView.ts"))).toBe(true);
		expect(vi.mocked(writeFileAt).mock.calls.length).toBeGreaterThanOrEqual(9);
	});
});

describe("make:app command", () => {
	beforeEach(() => {
		vi.mocked(writeFileAt).mockReset().mockReturnValue(true);
		vi.mocked(log).mockReset();
		vi.mocked(proc.exit).mockReset().mockImplementation(() => { throw new Error("proc.exit called"); });
	});

	it("logs error and exits when --name is missing", () => {
		const mockFs = createMockFs();
		Object.assign(fsMod, { disk: mockFs });

		expect(() => commands["make:app"]({})).toThrow("proc.exit called");

		expect(vi.mocked(log)).toHaveBeenCalledWith(expect.stringContaining("--name is required"));
		expect(vi.mocked(proc.exit)).toHaveBeenCalledWith(1);
	});

	it("exits when folder already exists", () => {
		const mockFs = createMockFs();
		mockFs.existsSync = () => true;
		Object.assign(fsMod, { disk: mockFs });

		expect(() => commands["make:app"]({ name: "My App" })).toThrow("proc.exit called");

		expect(vi.mocked(log)).toHaveBeenCalledWith(expect.stringContaining("Folder already exists"));
		expect(vi.mocked(proc.exit)).toHaveBeenCalledWith(1);
	});

	it("creates app files", () => {
		const mockFs = createMockFs();
		Object.assign(fsMod, { disk: mockFs });

		commands["make:app"]({ name: "My App" });

		expect(vi.mocked(writeFileAt).mock.calls.length).toBe(17);

		const paths = vi.mocked(writeFileAt).mock.calls.map((c) => c[1] as string);
		expect(paths).toContain("manifest.json");
		expect(paths).toContain("package.json");
		expect(paths).toContain("tsconfig.json");
		expect(paths).toContain("esbuild.config.mjs");
		expect(paths).toContain("vitest.config.ts");
		expect(paths).toContain(".gitignore");
		expect(paths).toContain("src/main.ts");
		expect(paths).toContain("src/infrastructure/events/EventBus.ts");
		expect(paths).toContain("tests/infrastructure/EventBus.test.ts");
	});
});

describe("make:cli command", () => {
	beforeEach(() => {
		vi.mocked(writeFileAt).mockReset().mockReturnValue(true);
		vi.mocked(log).mockReset();
		vi.mocked(proc.exit).mockReset().mockImplementation(() => { throw new Error("proc.exit called"); });
	});

	it("logs error and exits when --name is missing", () => {
		const mockFs = createMockFs();
		Object.assign(fsMod, { disk: mockFs });

		expect(() => commands["make:cli"]({})).toThrow("proc.exit called");

		expect(vi.mocked(log)).toHaveBeenCalledWith(expect.stringContaining("--name is required"));
		expect(vi.mocked(proc.exit)).toHaveBeenCalledWith(1);
	});

	it("creates CLI files", () => {
		const mockFs = createMockFs();
		Object.assign(fsMod, { disk: mockFs });

		commands["make:cli"]({ name: "My CLI" });

		expect(vi.mocked(writeFileAt).mock.calls.length).toBe(6);

		const paths = vi.mocked(writeFileAt).mock.calls.map((c) => c[1] as string);
		expect(paths).toContain("package.json");
		expect(paths).toContain("tsconfig.json");
		expect(paths).toContain("vitest.config.ts");
		expect(paths).toContain(".gitignore");
		expect(paths).toContain("src/main.ts");
		expect(paths).toContain("tests/main.test.ts");
	});
});

describe("make:plugin command", () => {
	beforeEach(() => {
		vi.mocked(writeFileAt).mockReset().mockReturnValue(true);
		vi.mocked(log).mockReset();
		vi.mocked(proc.exit).mockReset().mockImplementation(() => { throw new Error("proc.exit called"); });
	});

	it("logs error and exits when --name is missing", () => {
		const mockFs = createMockFs();
		Object.assign(fsMod, { disk: mockFs });

		expect(() => commands["make:plugin"]({})).toThrow("proc.exit called");

		expect(vi.mocked(log)).toHaveBeenCalledWith(expect.stringContaining("--name is required"));
		expect(vi.mocked(proc.exit)).toHaveBeenCalledWith(1);
	});

	it("creates plugin files", () => {
		const mockFs = createMockFs();
		Object.assign(fsMod, { disk: mockFs });

		commands["make:plugin"]({ name: "My Plugin" });

		expect(vi.mocked(writeFileAt).mock.calls.length).toBe(11);

		const paths = vi.mocked(writeFileAt).mock.calls.map((c) => c[1] as string);
		expect(paths).toContain("manifest.json");
		expect(paths).toContain("package.json");
		expect(paths).toContain("tsconfig.json");
		expect(paths).toContain("esbuild.config.mjs");
		expect(paths).toContain(".gitignore");
		expect(paths).toContain("src/main.ts");
		expect(paths.some((p) => p.includes("00-base.css"))).toBe(true);
		expect(paths.some((p) => p.includes("events/.gitkeep"))).toBe(true);
		expect(paths.some((p) => p.includes("tests/.gitkeep"))).toBe(true);
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
			expect.objectContaining({ key: "2", label: expect.stringContaining("Plugin") }),
			expect.objectContaining({ key: "3", label: expect.stringContaining("Application") }),
			expect.objectContaining({ key: "4", label: expect.stringContaining("CLI") }),
		]));
	});
});
