import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLog = vi.fn();
const mockPrintHeader = vi.fn();
const mockCountFiles = vi.fn(() => 42);
const mockGetSelectedProject = vi.fn((): string | undefined => "test-project");
const mockRunSilent = vi.fn((_cmd?: string): string | null => "main");

// Shared mock filesystem state
const files = new Map<string, string>();
const dirs = new Set<string>();
const mockExistsSync = vi.fn((p: string) => files.has(p) || dirs.has(p));
const mockReadFileSync = vi.fn((p: string, _enc?: string) => {
	if (files.has(p)) return files.get(p)!;
	throw new Error(`ENOENT: ${p}`);
});
const mockReaddirSync = vi.fn((_p?: string) => [] as string[]);

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: mockLog,
}));

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", YELLOW: "", RED: "", CYAN: "",
	printHeader: mockPrintHeader,
}));

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: (p: string) => mockExistsSync(p),
		readFileSync: (p: string, e?: string) => mockReadFileSync(p, e),
		readdirSync: (p?: string) => mockReaddirSync(p),
	},
}));

// Inline shell mock: delegates runSilent to mockRunSilent var for per-test control.
// Cannot use mockShellPreset() — see tests/mocks/mock-presets.ts for the standard factory.
vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: {
		run: vi.fn(() => 0),
		runSilent: mockRunSilent,
	},
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...parts: string[]) => parts.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
	},
}));

vi.mock("../../../src/infrastructure/config.js", () => ({
	ROOT: "/project",
	PROJECTS_DIR: "/projects",
}));

vi.mock("../../../src/infrastructure/state.js", () => ({
	getSelectedProject: () => mockGetSelectedProject(),
}));

vi.mock("../../../src/infrastructure/fs.js", () => ({
	countFiles: mockCountFiles,
}));

const defaultCtx = {
	path: "/projects/test-project",
	pkg: { name: "test-project", version: "1.0.0", scripts: { build: "tsc", test: "vitest" } },
	config: {
		name: "test-project",
		tools: { devtools: "npm run devtools" },
		publish: {
			build: "npm run build",
			test: "npm run test",
			outDir: "dist",
			artifacts: ["main.js"],
			endpoints: [{ name: "plugin", path: ".obsidian/plugins/test" }],
		},
		review: {
			journeysDir: "tests/e2e/journeys",
			testVault: "/test-vault",
			runner: "vitest",
			build: "npm run build",
			test: "npm run test:e2e",
		},
	},
	scripts: { build: "tsc", test: "vitest" },
};

vi.mock("../../../src/domain/project/project-config.js", () => ({
	initializeProject: () => defaultCtx,
}));

import { showInfo } from "../../../src/ui/displays/info-display.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { paths } from "../../../src/infrastructure/paths.js";
import { shell } from "../../../src/infrastructure/shell.js";
import { log } from "../../../src/infrastructure/logger.js";

const infoDeps = { disk, paths, shell, log } as never;

function output(): string {
	return mockLog.mock.calls.map((c: unknown[]) => String(c[0] ?? "")).join("\n");
}

beforeEach(() => {
	vi.clearAllMocks();
	files.clear();
	dirs.clear();
	mockGetSelectedProject.mockReturnValue("test-project");
	mockRunSilent.mockReturnValue("main");
	// package.json for printDependencies
	files.set("/projects/test-project/package.json", JSON.stringify({
		name: "test-project", version: "1.0.0",
		dependencies: { obsidian: "1.0" },
		devDependencies: { vitest: "1.0", typescript: "5.0" },
	}));
});

describe("showInfo", () => {
	it("prints project identity", () => {
		showInfo(infoDeps);
		expect(output()).toContain("test-project");
		expect(output()).toContain("1.0.0");
		expect(output()).toContain("/projects/test-project");
	});

	it("prints source file counts when directories exist", () => {
		dirs.add("/projects/test-project/src");
		dirs.add("/projects/test-project/tests");
		showInfo(infoDeps);
		expect(output()).toContain("Source files");
		expect(output()).toContain("Test files");
	});

	it("skips source section when no src or tests dirs", () => {
		showInfo(infoDeps);
		expect(output()).not.toContain("Source files");
	});

	it("prints dependencies from package.json", () => {
		showInfo(infoDeps);
		const out = output();
		expect(out).toContain("Dependencies");
		expect(out).toContain("Production");
		expect(out).toContain("Development");
	});

	it("prints dev tools", () => {
		showInfo(infoDeps);
		expect(output()).toContain("Dev Tools");
	});

	it("prints publish config with endpoints", () => {
		showInfo(infoDeps);
		const out = output();
		expect(out).toContain("Publish");
		expect(out).toContain("npm run build");
		expect(out).toContain("dist");
		expect(out).toContain("plugin");
	});

	it("prints review config", () => {
		showInfo(infoDeps);
		const out = output();
		expect(out).toContain("Review");
		expect(out).toContain("/test-vault");
	});

	it("prints git info", () => {
		showInfo(infoDeps);
		expect(output()).toContain("Git");
		expect(output()).toContain("Branch");
	});

	it("shows no-project message when none selected", () => {
		mockGetSelectedProject.mockReturnValue(undefined);
		showInfo(infoDeps);
		expect(output()).toContain("No project selected");
	});

	it("detects dirty git status", () => {
		mockRunSilent.mockImplementation((cmd?: string) => {
			if (cmd?.includes("status --porcelain")) return "M src/file.ts";
			if (cmd?.includes("rev-parse --abbrev-ref")) return "main";
			if (cmd?.includes("rev-parse --short")) return "abc123";
			return "";
		});
		showInfo(infoDeps);
		expect(output()).toContain("dirty");
	});

	it("detects clean git status", () => {
		mockRunSilent.mockImplementation((cmd?: string) => {
			if (cmd?.includes("status --porcelain")) return "";
			if (cmd?.includes("rev-parse --abbrev-ref")) return "main";
			if (cmd?.includes("rev-parse --short")) return "abc123";
			return "";
		});
		showInfo(infoDeps);
		expect(output()).toContain("clean");
	});
});
