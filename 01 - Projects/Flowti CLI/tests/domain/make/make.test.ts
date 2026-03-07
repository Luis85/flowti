import { describe, it, expect, vi } from "vitest";
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

vi.mock("../../../src/infrastructure/readline.js", () => ({
	createRL: vi.fn(),
	ask: vi.fn(),
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

import * as fsMod from "../../../src/infrastructure/filesystem.js";
import {
	PROJECT_TEMPLATES, PROJECT_TEMPLATE_IDS,
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
	it("creates package.json and main files", () => {
		const mockFs = createMockFs();
		Object.assign(fsMod, { disk: mockFs });

		PROJECT_TEMPLATES.cli.scaffold("/mock/projects/my-cli", "My CLI");

		// writeFileAt creates files under the project path
		const files = [...mockFs.files.keys()];
		const hasPackageJson = files.some((f) => f.includes("package.json"));
		const hasMain = files.some((f) => f.includes("src/main.ts"));
		const hasTest = files.some((f) => f.includes("tests/main.test.ts"));

		expect(hasPackageJson).toBe(true);
		expect(hasMain).toBe(true);
		expect(hasTest).toBe(true);
	});

	it("creates valid JSON in package.json", () => {
		const mockFs = createMockFs();
		Object.assign(fsMod, { disk: mockFs });

		PROJECT_TEMPLATES.cli.scaffold("/mock/projects/my-cli", "My CLI");

		const pkgFile = [...mockFs.files.entries()].find(([k]) => k.includes("package.json"));
		expect(pkgFile).toBeDefined();
		const pkg = JSON.parse(pkgFile![1]);
		expect(pkg.name).toBe("my-cli");
		expect(pkg.type).toBe("module");
	});
});

describe("scaffoldPlugin", () => {
	it("creates manifest.json and main.ts", () => {
		const mockFs = createMockFs();
		Object.assign(fsMod, { disk: mockFs });

		PROJECT_TEMPLATES.plugin.scaffold("/mock/projects/my-plugin", "My Plugin");

		const files = [...mockFs.files.keys()];
		const hasManifest = files.some((f) => f.includes("manifest.json"));
		const hasMain = files.some((f) => f.includes("src/main.ts"));
		const hasCss = files.some((f) => f.includes("css/00-base.css"));

		expect(hasManifest).toBe(true);
		expect(hasMain).toBe(true);
		expect(hasCss).toBe(true);
	});

	it("sets correct plugin ID from name", () => {
		const mockFs = createMockFs();
		Object.assign(fsMod, { disk: mockFs });

		PROJECT_TEMPLATES.plugin.scaffold("/mock/projects/test", "My Cool Plugin");

		const manifestFile = [...mockFs.files.entries()].find(([k]) => k.includes("manifest.json"));
		const manifest = JSON.parse(manifestFile![1]);
		expect(manifest.id).toBe("my-cool-plugin");
	});
});

describe("scaffoldApp", () => {
	it("creates full DDD structure", () => {
		const mockFs = createMockFs();
		Object.assign(fsMod, { disk: mockFs });

		PROJECT_TEMPLATES.app.scaffold("/mock/projects/my-app", "My App");

		const files = [...mockFs.files.keys()];
		const hasManifest = files.some((f) => f.includes("manifest.json"));
		const hasEventBus = files.some((f) => f.includes("EventBus.ts"));
		const hasStub = files.some((f) => f.includes("obsidian-stub.ts"));
		const hasTest = files.some((f) => f.includes("EventBus.test.ts"));

		expect(hasManifest).toBe(true);
		expect(hasEventBus).toBe(true);
		expect(hasStub).toBe(true);
		expect(hasTest).toBe(true);
	});

	it("creates more files than plugin scaffold", () => {
		const pluginFs = createMockFs();
		Object.assign(fsMod, { disk: pluginFs });
		PROJECT_TEMPLATES.plugin.scaffold("/mock/projects/p", "Plugin");

		const appFs = createMockFs();
		Object.assign(fsMod, { disk: appFs });
		PROJECT_TEMPLATES.app.scaffold("/mock/projects/a", "App");

		expect(appFs.files.size).toBeGreaterThan(pluginFs.files.size);
	});
});
