import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockFs } from "../../mocks/mock-fs.js";

vi.mock("../../../src/infrastructure/config.js", () => ({
	cliConfig: { defaultAuthor: "Test Author" },
}));

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "",
}));

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {},
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../src/infrastructure/fs.js", () => ({
	writeFileAt: vi.fn(() => true),
}));

import * as fsMod from "../../../src/infrastructure/filesystem.js";
import { writeFileAt } from "../../../src/infrastructure/fs.js";
import {
	scaffoldPlugin, scaffoldApp, scaffoldCli, scaffoldEmpty,
	PROJECT_TEMPLATES, PROJECT_TEMPLATE_IDS,
} from "../../../src/domain/make/scaffolds.js";

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

describe("scaffoldPlugin", () => {
	beforeEach(() => {
		vi.mocked(writeFileAt).mockClear();
	});

	it("creates manifest, package, and main files", () => {
		scaffoldPlugin("/mock/projects/my-plugin", "My Plugin");

		const paths = vi.mocked(writeFileAt).mock.calls.map((c) => c[1] as string);
		expect(paths).toContain("manifest.json");
		expect(paths).toContain("package.json");
		expect(paths).toContain("src/main.ts");
		expect(paths.some((p) => p.includes("00-base.css"))).toBe(true);
	});

	it("creates gitkeep files for empty directories", () => {
		scaffoldPlugin("/mock/projects/my-plugin", "My Plugin");

		const paths = vi.mocked(writeFileAt).mock.calls.map((c) => c[1] as string);
		expect(paths.some((p) => p.includes("events/.gitkeep"))).toBe(true);
		expect(paths.some((p) => p.includes("domain/.gitkeep"))).toBe(true);
		expect(paths.some((p) => p.includes("tests/.gitkeep"))).toBe(true);
	});
});

describe("scaffoldApp", () => {
	beforeEach(() => {
		vi.mocked(writeFileAt).mockClear();
	});

	it("creates full DDD structure with EventBus", () => {
		scaffoldApp("/mock/projects/my-app", "My App");

		const paths = vi.mocked(writeFileAt).mock.calls.map((c) => c[1] as string);
		expect(paths).toContain("manifest.json");
		expect(paths.some((p) => p.includes("EventBus.ts"))).toBe(true);
		expect(paths.some((p) => p.includes("obsidian-stub.ts"))).toBe(true);
		expect(paths.some((p) => p.includes("EventBus.test.ts"))).toBe(true);
	});

	it("creates more files than plugin scaffold", () => {
		scaffoldPlugin("/mock/projects/p", "Plugin");
		const pluginCallCount = vi.mocked(writeFileAt).mock.calls.length;

		vi.mocked(writeFileAt).mockClear();
		scaffoldApp("/mock/projects/a", "App");
		const appCallCount = vi.mocked(writeFileAt).mock.calls.length;

		expect(appCallCount).toBeGreaterThan(pluginCallCount);
	});
});

describe("scaffoldCli", () => {
	beforeEach(() => {
		vi.mocked(writeFileAt).mockClear();
	});

	it("creates package, main, and test files", () => {
		scaffoldCli("/mock/projects/my-cli", "My CLI");

		const paths = vi.mocked(writeFileAt).mock.calls.map((c) => c[1] as string);
		expect(paths).toContain("package.json");
		expect(paths).toContain("src/main.ts");
		expect(paths).toContain("tests/main.test.ts");
	});

	it("creates exactly 6 files", () => {
		scaffoldCli("/mock/projects/my-cli", "My CLI");
		expect(vi.mocked(writeFileAt).mock.calls.length).toBe(6);
	});
});

describe("scaffoldEmpty", () => {
	it("creates the project directory", () => {
		const mockFs = createMockFs();
		Object.assign(fsMod, { disk: mockFs });

		scaffoldEmpty("/mock/projects/empty", "Empty");

		expect(mockFs.dirs.has("/mock/projects/empty")).toBe(true);
	});
});
