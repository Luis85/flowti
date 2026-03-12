import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockFs } from "../../mocks/mock-fs.js";
import { createMockShell } from "../../mocks/mock-shell.js";

vi.mock("../../../src/infrastructure/config.js", () => ({
	PROJECTS_DIR: "/mock/projects",
}));

vi.mock("../../../src/infrastructure/state.js", () => ({
	getSelectedProject: vi.fn(() => null),
	setSelectedProject: vi.fn(),
}));

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {},
}));

vi.mock("../../../src/infrastructure/paths.js", async () => {
	const path = await import("node:path");
	return {
		paths: {
			join: (...args: string[]) => path.default.join(...args).replace(/\\/g, "/"),
			resolve: (...args: string[]) => path.default.join(...args).replace(/\\/g, "/"),
			dirname: (p: string) => path.default.dirname(p).replace(/\\/g, "/"),
			basename: path.default.basename,
		},
	};
});

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: {},
}));

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
	warn: vi.fn(),
}));

vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(), askYesNo: vi.fn(async () => false), waitForEnter: vi.fn(async () => {}) },
}));

vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { now: () => new Date(), iso: () => "", ms: () => 0, safeIso: () => "" },
}));

vi.mock("../../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn(), cwd: () => "/", argv: () => [], env: () => ({}) },
}));

vi.mock("../../../src/ui/cli-event-renderer.js", () => ({
	attachCliRenderer: vi.fn(() => () => {}),
}));

vi.mock("../../../src/infrastructure/request-response.js", async () => {
	const actual = await vi.importActual<typeof import("../../../src/infrastructure/request-response.js")>("../../../src/infrastructure/request-response.js");
	return actual;
});

vi.mock("../../../src/infrastructure/menu.js", () => ({
	runMenu: vi.fn(),
}));

vi.mock("../../../src/domain/scaffold/scaffold.js", () => ({
	scaffold: vi.fn(() => ({ created: 5, outputPath: "/mock/output" })),
	listDefinitions: vi.fn(() => [
		{ id: "flowti-project", label: "Flowti Project", description: "Full Flowti project." },
	]),
}));

vi.mock("../../../src/ui/menus/plugins-menu.js", () => ({
	pluginsMenu: vi.fn(() => "main"),
}));

vi.mock("../../../src/ui/menus/ai-tools-menu.js", () => ({
	aiToolsMenu: vi.fn(() => "main"),
}));

import * as fsMod from "../../../src/infrastructure/filesystem.js";
import * as shellMod from "../../../src/infrastructure/shell.js";
import { log } from "../../../src/infrastructure/logger.js";
import { input } from "../../../src/infrastructure/input.js";
import { runMenu } from "../../../src/infrastructure/menu.js";
import { getSelectedProject, setSelectedProject } from "../../../src/infrastructure/state.js";
import { scaffold as scaffoldProject } from "../../../src/domain/scaffold/scaffold.js";
import { listProjects, getProjectPath, startMenu } from "../../../src/ui/menus/project-menu.js";
import { paths as mockPaths } from "../../../src/infrastructure/paths.js";
import { commands } from "../../../src/controller/project.controller.js";

function setDisk(mockFs: ReturnType<typeof createMockFs>): void {
	Object.assign(fsMod, { disk: mockFs });
}

function setShell(sh: ReturnType<typeof createMockShell>): void {
	Object.assign(shellMod, { shell: sh });
}

beforeEach(() => vi.clearAllMocks());

// ── listProjects ────────────────────────────────────────────────────

describe("listProjects", () => {
	it("returns sorted directory names from PROJECTS_DIR", () => {
		const mockFs = createMockFs({
			"/mock/projects/beta/package.json": "{}",
			"/mock/projects/alpha/package.json": "{}",
		});
		setDisk(mockFs);

		const result = listProjects({ disk: fsMod.disk });
		expect(result).toEqual(["alpha", "beta"]);
	});

	it("returns empty array when PROJECTS_DIR does not exist", () => {
		const mockFs = createMockFs();
		// Override readdirSync to throw
		mockFs.readdirSync = () => { throw new Error("ENOENT"); };
		setDisk(mockFs);

		expect(listProjects({ disk: fsMod.disk })).toEqual([]);
	});

	it("filters out files (only directories)", () => {
		const mockFs = createMockFs({
			"/mock/projects/readme.md": "content",
		});
		// readme.md is a file, not a directory — should be excluded
		setDisk(mockFs);

		const result = listProjects({ disk: fsMod.disk });
		// readme.md won't appear as a directory entry
		expect(result.includes("readme.md")).toBe(false);
	});
});

// ── getProjectPath ──────────────────────────────────────────────────

describe("getProjectPath", () => {
	it("joins PROJECTS_DIR with project name", () => {
		const result = getProjectPath("my-app", { paths: mockPaths });
		expect(result.replace(/\\/g, "/")).toContain("mock/projects/my-app");
	});
});

// ── startMenu ───────────────────────────────────────────────────────

describe("startMenu", () => {
	it("calls runMenu with Start Menu title and correct items when projects exist", async () => {
		const mockFs = createMockFs({
			"/mock/projects/my-project/package.json": "{}",
		});
		setDisk(mockFs);
		vi.mocked(getSelectedProject).mockReturnValue("my-project");
		vi.mocked(runMenu).mockResolvedValue("quit");

		await startMenu();

		expect(runMenu).toHaveBeenCalledWith(
			"Start Menu",
			expect.arrayContaining([
				expect.objectContaining({ key: "1", label: "Open Project" }),
				expect.objectContaining({ key: "2", label: "Create Project" }),
				expect.objectContaining({ key: "q", label: "Quit" }),
			]),
			expect.objectContaining({ beforeMenu: expect.any(Function) }),
		);
	});

	it("shows Create Your First Project when no projects exist", async () => {
		const mockFs = createMockFs();
		mockFs.readdirSync = () => { throw new Error("ENOENT"); };
		setDisk(mockFs);
		vi.mocked(getSelectedProject).mockReturnValue(null);
		vi.mocked(runMenu).mockResolvedValue("quit");

		await startMenu();

		expect(runMenu).toHaveBeenCalledWith(
			"Start Menu",
			expect.arrayContaining([
				expect.objectContaining({ key: "1", label: "Create Your First Project" }),
				expect.objectContaining({ key: "q", label: "Quit" }),
			]),
			expect.objectContaining({ beforeMenu: expect.any(Function) }),
		);
		// Should NOT contain Open Project
		const items = vi.mocked(runMenu).mock.calls[0][1] as Array<{ label?: string }>;
		expect(items.some((i) => i.label === "Open Project")).toBe(false);
	});

	it("returns 'selected' when quitting with a selected project", async () => {
		vi.mocked(getSelectedProject).mockReturnValue("my-project");
		vi.mocked(runMenu).mockResolvedValue("quit");

		const result = await startMenu();
		expect(result).toBe("selected");
	});

	it("returns 'quit' when quitting with no selected project", async () => {
		vi.mocked(getSelectedProject)
			.mockReturnValueOnce(null) // for beforeMenu
			.mockReturnValueOnce(null); // for post-loop check
		vi.mocked(runMenu).mockResolvedValue("quit");

		const result = await startMenu();
		expect(result).toBe("quit");
	});

	it("beforeMenu renders current project when one is selected", async () => {
		vi.mocked(getSelectedProject).mockReturnValue("test-proj");
		let capturedBeforeMenu: (() => void) | undefined;
		vi.mocked(runMenu).mockImplementation(async (_title, _items, opts) => {
			capturedBeforeMenu = opts?.beforeMenu;
			return "quit";
		});

		await startMenu();
		capturedBeforeMenu?.();

		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		expect(logCalls.some((c) => typeof c === "string" && c.includes("test-proj"))).toBe(true);
	});

	it("Quit action returns 'quit'", async () => {
		vi.mocked(getSelectedProject).mockReturnValue(null);
		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			const arr = items as Array<{ key?: string; action?: () => unknown }>;
			const result = arr.find((i) => i.key === "q")?.action?.();
			expect(result).toBe("quit");
			return "quit";
		});

		await startMenu();
	});
});

// ── Open Project submenu ─────────────────────────────────────────────

describe("startMenu – Open Project", () => {
	it("beforeMenu logs 'No projects yet' when no projects exist", async () => {
		const mockFs = createMockFs();
		mockFs.readdirSync = () => { throw new Error("ENOENT"); };
		setDisk(mockFs);
		vi.mocked(getSelectedProject).mockReturnValue(null);

		let capturedBeforeMenu: (() => void) | undefined;
		vi.mocked(runMenu).mockImplementation(async (_title, _items, opts) => {
			capturedBeforeMenu = opts?.beforeMenu;
			return "quit";
		});

		await startMenu();
		capturedBeforeMenu?.();

		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		expect(logCalls.some((c) => typeof c === "string" && c.includes("No projects yet"))).toBe(true);
	});

	it("lists projects and selects one", async () => {
		const mockFs = createMockFs({
			"/mock/projects/alpha/package.json": "{}",
			"/mock/projects/beta/package.json": "{}",
		});
		setDisk(mockFs);
		vi.mocked(getSelectedProject).mockReturnValue(null);

		let callCount = 0;
		vi.mocked(runMenu).mockImplementation(async (title, items) => {
			callCount++;
			if (callCount === 1) {
				// Start Menu — invoke Load Project
				const arr = items as Array<{ key?: string; action?: () => unknown }>;
				await (arr.find((i) => i.key === "1")?.action?.() as Promise<unknown>);
				return "quit";
			}
			if (callCount === 2) {
				// Load Project menu — select first project
				const arr = items as Array<{ key?: string; action?: () => unknown }>;
				const result = arr.find((i) => i.key === "1")?.action?.();
				expect(result).toBe("quit");
				return "quit";
			}
			return "main";
		});

		await startMenu();

		expect(setSelectedProject).toHaveBeenCalledWith("alpha");
	});

	it("marks currently selected project", async () => {
		const mockFs = createMockFs({
			"/mock/projects/alpha/package.json": "{}",
			"/mock/projects/beta/package.json": "{}",
		});
		setDisk(mockFs);
		vi.mocked(getSelectedProject).mockReturnValue("beta");

		let loadMenuItems: Array<{ key?: string; label?: string }> = [];
		let callCount = 0;
		vi.mocked(runMenu).mockImplementation(async (title, items) => {
			callCount++;
			if (callCount === 1) {
				const arr = items as Array<{ key?: string; action?: () => unknown }>;
				await (arr.find((i) => i.key === "1")?.action?.() as Promise<unknown>);
				return "quit";
			}
			if (callCount === 2) {
				loadMenuItems = items as Array<{ key?: string; label?: string }>;
				return "main"; // go back
			}
			return "main";
		});

		await startMenu();

		// The "beta" item should have a marker in its label
		const betaItem = loadMenuItems.find((i) => i.label?.includes("beta"));
		expect(betaItem).toBeDefined();
	});
});

// ── Create Project submenu ──────────────────────────────────────────

describe("startMenu – Create Project", () => {
	it("cancels when name is empty", async () => {
		const mockFs = createMockFs();
		mockFs.readdirSync = () => { throw new Error("ENOENT"); };
		setDisk(mockFs);
		vi.mocked(input.ask).mockResolvedValue("");
		vi.mocked(getSelectedProject).mockReturnValue(null);

		let callCount = 0;
		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			callCount++;
			if (callCount === 1) {
				const arr = items as Array<{ key?: string; action?: () => unknown }>;
				await (arr.find((i) => i.key === "1")?.action?.() as Promise<unknown>);
				return "quit";
			}
			return "main";
		});

		await startMenu();

		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		expect(logCalls.some((c) => typeof c === "string" && c.includes("Cancelled"))).toBe(true);
	});

	it("rejects duplicate project name", async () => {
		const mockFs = createMockFs({
			"/mock/projects/existing/package.json": "{}",
		});
		setDisk(mockFs);
		vi.mocked(input.ask).mockResolvedValue("existing");
		vi.mocked(getSelectedProject).mockReturnValue(null);

		let callCount = 0;
		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			callCount++;
			if (callCount === 1) {
				const arr = items as Array<{ key?: string; action?: () => unknown }>;
				await (arr.find((i) => i.key === "2")?.action?.() as Promise<unknown>);
				return "quit";
			}
			return "main";
		});

		await startMenu();

		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		expect(logCalls.some((c) => typeof c === "string" && c.includes("already exists"))).toBe(true);
	});

	it("scaffolds from definition selection", async () => {
		const mockFs = createMockFs();
		setDisk(mockFs);
		vi.mocked(input.ask).mockResolvedValue("new-project");
		vi.mocked(getSelectedProject).mockReturnValue(null);

		let callCount = 0;
		vi.mocked(runMenu).mockImplementation(async (title, items) => {
			callCount++;
			if (callCount === 1) {
				// Start Menu — Create Your First Project (key 1 when no projects)
				const arr = items as Array<{ key?: string; action?: () => unknown }>;
				await (arr.find((i) => i.key === "1")?.action?.() as Promise<unknown>);
				return "quit";
			}
			if (callCount === 2) {
				// Template selection — pick first scaffold definition
				const arr = items as Array<{ key?: string; action?: () => unknown }>;
				const result = arr.find((i) => i.key === "1")?.action?.();
				expect(result).toBe("quit");
				return "quit";
			}
			return "main";
		});

		await startMenu();

		expect(scaffoldProject).toHaveBeenCalledWith(
			expect.objectContaining({ disk: expect.anything(), paths: expect.anything() }),
			expect.objectContaining({
				definitionId: "flowti-project",
				name: "new-project",
			}),
		);
		expect(setSelectedProject).toHaveBeenCalledWith("new-project");
	});

	it("adds git submodule from remote URL", async () => {
		const mockFs = createMockFs();
		setDisk(mockFs);
		vi.mocked(input.ask)
			.mockResolvedValueOnce("gh-project") // project name
			.mockResolvedValueOnce("https://github.com/test/repo"); // remote url
		vi.mocked(getSelectedProject).mockReturnValue(null);
		const sh = createMockShell();
		setShell(sh);

		let callCount = 0;
		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			callCount++;
			if (callCount === 1) {
				const arr = items as Array<{ key?: string; action?: () => unknown }>;
				await (arr.find((i) => i.key === "1")?.action?.() as Promise<unknown>);
				return "quit";
			}
			if (callCount === 2) {
				// Template selection — pick git submodule (key "g")
				const arr = items as Array<{ key?: string; action?: () => unknown }>;
				const result = await (arr.find((i) => i.key === "g")?.action?.() as Promise<unknown>);
				expect(result).toBe("quit");
				return "quit";
			}
			return "main";
		});

		await startMenu();

		expect(sh.calls).toHaveLength(1);
		expect(sh.calls[0].cmd).toContain("git submodule add");
	});

	it("handles failed git submodule add", async () => {
		const mockFs = createMockFs();
		setDisk(mockFs);
		vi.mocked(input.ask)
			.mockResolvedValueOnce("fail-project")
			.mockResolvedValueOnce("https://github.com/bad/repo");
		vi.mocked(getSelectedProject).mockReturnValue(null);
		const sh = createMockShell();
		sh.run = (cmd: string, opts?: Record<string, unknown>) => {
			(sh.calls as Array<{ method: string; cmd: string; opts?: Record<string, unknown> }>).push({ method: "run", cmd, opts });
			return cmd.includes("git submodule add") ? 1 : 0;
		};
		setShell(sh);

		let callCount = 0;
		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			callCount++;
			if (callCount === 1) {
				const arr = items as Array<{ key?: string; action?: () => unknown }>;
				await (arr.find((i) => i.key === "1")?.action?.() as Promise<unknown>);
				return "quit";
			}
			if (callCount === 2) {
				const arr = items as Array<{ key?: string; action?: () => unknown }>;
				await (arr.find((i) => i.key === "g")?.action?.() as Promise<unknown>);
				return "main";
			}
			return "main";
		});

		await startMenu();

		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		expect(logCalls.some((c) => typeof c === "string" && c.includes("Submodule add failed"))).toBe(true);
	});

	it("cancels git submodule add when URL is empty", async () => {
		const mockFs = createMockFs();
		setDisk(mockFs);
		vi.mocked(input.ask)
			.mockResolvedValueOnce("empty-url-project")
			.mockResolvedValueOnce(""); // empty URL
		vi.mocked(getSelectedProject).mockReturnValue(null);

		let callCount = 0;
		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			callCount++;
			if (callCount === 1) {
				const arr = items as Array<{ key?: string; action?: () => unknown }>;
				await (arr.find((i) => i.key === "1")?.action?.() as Promise<unknown>);
				return "quit";
			}
			if (callCount === 2) {
				const arr = items as Array<{ key?: string; action?: () => unknown }>;
				await (arr.find((i) => i.key === "g")?.action?.() as Promise<unknown>);
				return "main";
			}
			return "main";
		});

		await startMenu();

		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		expect(logCalls.some((c) => typeof c === "string" && c.includes("Cancelled"))).toBe(true);
	});
});

// ── CLI commands ────────────────────────────────────────────────────

describe("commands", () => {
	it("project command calls startMenu", async () => {
		vi.mocked(getSelectedProject).mockReturnValue("test");
		vi.mocked(runMenu).mockResolvedValue("quit");

		await commands.project();

		expect(runMenu).toHaveBeenCalled();
	});
});
