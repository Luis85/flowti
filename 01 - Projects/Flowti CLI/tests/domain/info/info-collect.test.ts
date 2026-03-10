import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCountFiles = vi.fn(() => 0);
const mockRunSilent = vi.fn(() => null as string | null);

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", YELLOW: "", RED: "", CYAN: "",
	printHeader: vi.fn(),
}));

const fileStore = new Map<string, string>();
const dirStore = new Set<string>();

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: (p: string) => fileStore.has(p) || dirStore.has(p),
		readFileSync: (p: string) => {
			if (fileStore.has(p)) return fileStore.get(p)!;
			throw new Error(`ENOENT: ${p}`);
		},
		readdirSync: () => [],
	},
}));

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: {
		run: vi.fn(() => 0),
		runSilent: (...args: unknown[]) => mockRunSilent(...(args as [string])),
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
}));

vi.mock("../../../src/infrastructure/state.js", () => ({
	getSelectedProject: vi.fn(() => "test-project"),
}));

vi.mock("../../../src/infrastructure/fs.js", () => ({
	countFiles: (...args: unknown[]) => mockCountFiles(...(args as [string, string])),
}));

vi.mock("../../../src/infrastructure/output.js", () => ({
	resolveFormat: vi.fn(() => "text"),
	printOutput: vi.fn(),
}));

vi.mock("../../../src/domain/project/project-config.js", () => ({
	initializeProject: vi.fn(),
}));

import { collectProjectInfo } from "../../../src/domain/info/info.js";
import type { ProjectContext } from "../../../src/infrastructure/types.js";

function makeCtx(overrides: Partial<ProjectContext> = {}): ProjectContext {
	return {
		path: "/projects/test-project",
		pkg: { name: "test-project", version: "2.0.0", scripts: { build: "tsc", test: "vitest" } },
		config: {
			name: "test-project",
			tools: { devtools: "npm run check" },
		},
		scripts: { build: "tsc", test: "vitest" },
		...overrides,
	} as ProjectContext;
}

beforeEach(() => {
	vi.clearAllMocks();
	fileStore.clear();
	dirStore.clear();
	mockCountFiles.mockReturnValue(0);
	mockRunSilent.mockReturnValue(null);
	// collectDependencyInfo reads package.json when ctx.pkg is defined
	fileStore.set("/projects/test-project/package.json", JSON.stringify({
		dependencies: { obsidian: "1.0" },
		devDependencies: { vitest: "1.0", typescript: "5.0" },
	}));
});

describe("collectProjectInfo", () => {
	it("returns basic project identity", () => {
		const info = collectProjectInfo(makeCtx());
		expect(info.name).toBe("test-project");
		expect(info.version).toBe("2.0.0");
		expect(info.path).toBe("/projects/test-project");
	});

	it("returns tools from FLOWTI_TOOLS", () => {
		const info = collectProjectInfo(makeCtx());
		expect(info.tools).toBeInstanceOf(Array);
		expect(info.tools.length).toBeGreaterThan(0);
		const devTool = info.tools.find((t) => t.id === "devtools");
		expect(devTool?.command).toBe("npm run check");
	});

	it("returns null command for unmapped tools", () => {
		const info = collectProjectInfo(makeCtx({
			config: { name: "test-project", tools: {} } as any,
		}));
		const unmapped = info.tools.find((t) => t.command === null);
		expect(unmapped).toBeDefined();
	});

	it("returns undefined version when pkg is undefined", () => {
		const info = collectProjectInfo(makeCtx({ pkg: undefined }));
		expect(info.version).toBeUndefined();
	});

	it("returns source info when src and tests dirs exist", () => {
		dirStore.add("/projects/test-project/src");
		dirStore.add("/projects/test-project/tests");
		mockCountFiles.mockReturnValue(25);
		const info = collectProjectInfo(makeCtx());
		expect(info.source).toBeDefined();
		expect(info.source!.sourceFiles).toBe(25);
	});

	it("returns undefined source when no src or tests dirs", () => {
		const info = collectProjectInfo(makeCtx());
		expect(info.source).toBeUndefined();
	});

	it("returns dependencies from package.json", () => {
		fileStore.set("/projects/test-project/package.json", JSON.stringify({
			dependencies: { obsidian: "1.0" },
			devDependencies: { vitest: "1.0", typescript: "5.0" },
		}));
		const info = collectProjectInfo(makeCtx());
		expect(info.dependencies).toBeDefined();
		expect(info.dependencies!.production).toBe(1);
		expect(info.dependencies!.development).toBe(2);
		expect(info.dependencies!.scripts).toBe(2);
	});

	it("returns undefined dependencies when no pkg", () => {
		const info = collectProjectInfo(makeCtx({ pkg: undefined }));
		expect(info.dependencies).toBeUndefined();
	});

	it("returns git info when git is available", () => {
		mockRunSilent.mockImplementation((cmd: string) => {
			if (cmd.includes("rev-parse --abbrev-ref")) return "main";
			if (cmd.includes("rev-parse --short")) return "abc1234";
			if (cmd.includes("status --porcelain")) return "";
			return null;
		});
		const info = collectProjectInfo(makeCtx());
		expect(info.git).toBeDefined();
		expect(info.git!.branch).toBe("main");
		expect(info.git!.commit).toBe("abc1234");
		expect(info.git!.status).toBe("clean");
	});

	it("returns dirty git status", () => {
		mockRunSilent.mockImplementation((cmd: string) => {
			if (cmd.includes("rev-parse --abbrev-ref")) return "feature-x";
			if (cmd.includes("rev-parse --short")) return "def5678";
			if (cmd.includes("status --porcelain")) return "M src/file.ts";
			return null;
		});
		const info = collectProjectInfo(makeCtx());
		expect(info.git!.status).toBe("dirty");
	});

	it("returns undefined git when git not available", () => {
		mockRunSilent.mockReturnValue(null);
		const info = collectProjectInfo(makeCtx());
		expect(info.git).toBeUndefined();
	});
});
