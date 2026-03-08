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
}));

vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn() },
}));

vi.mock("../../../src/infrastructure/menu.js", () => ({
	runMenu: vi.fn(),
}));

vi.mock("../../../src/domain/scaffold/scaffold.js", () => ({
	scaffold: vi.fn(() => ({ created: 5, outputPath: "/mock/output" })),
	listDefinitions: vi.fn(() => [
		{ id: "flowti-project", label: "Flowti Project", description: "Full Flowti project." },
	]),
}));

import * as fsMod from "../../../src/infrastructure/filesystem.js";
import * as shellMod from "../../../src/infrastructure/shell.js";
import { log } from "../../../src/infrastructure/logger.js";
import { input } from "../../../src/infrastructure/input.js";
import { runMenu } from "../../../src/infrastructure/menu.js";
import { getSelectedProject, setSelectedProject } from "../../../src/infrastructure/state.js";
import { scaffold as scaffoldProject } from "../../../src/domain/scaffold/scaffold.js";
import { listProjects, getProjectPath, startMenu, commands } from "../../../src/domain/project/project.js";

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

		const result = listProjects();
		expect(result).toEqual(["alpha", "beta"]);
	});

	it("returns empty array when PROJECTS_DIR does not exist", () => {
		const mockFs = createMockFs();
		// Override readdirSync to throw
		mockFs.readdirSync = () => { throw new Error("ENOENT"); };
		setDisk(mockFs);

		expect(listProjects()).toEqual([]);
	});

	it("filters out files (only directories)", () => {
		const mockFs = createMockFs({
			"/mock/projects/readme.md": "content",
		});
		// readme.md is a file, not a directory — should be excluded
		setDisk(mockFs);

		const result = listProjects();
		// readme.md won't appear as a directory entry
		expect(result.includes("readme.md")).toBe(false);
	});
});

// ── getProjectPath ──────────────────────────────────────────────────

describe("getProjectPath", () => {
	it("joins PROJECTS_DIR with project name", () => {
		const result = getProjectPath("my-app");
		expect(result.replace(/\\/g, "/")).toContain("mock/projects/my-app");
	});
});

// ── startMenu ───────────────────────────────────────────────────────

describe("startMenu", () => {
	it("calls runMenu with Start Menu title and correct items", async () => {
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
	it("logs message when no projects exist", async () => {
		const mockFs = createMockFs();
		mockFs.readdirSync = () => { throw new Error("ENOENT"); };
		setDisk(mockFs);
		vi.mocked(getSelectedProject).mockReturnValue(null);

		// First call: startMenu runs runMenu for "Start Menu"
		// We invoke the Load Project action, which calls loadProjectMenu
		let callCount = 0;
		vi.mocked(runMenu).mockImplementation(async (title, items) => {
			callCount++;
			if (callCount === 1) {
				// Start Menu — invoke "Load Project"
				const arr = items as Array<{ key?: string; action?: () => unknown }>;
				const loadAction = arr.find((i) => i.key === "1");
				await (loadAction?.action?.() as Promise<unknown>);
				return "quit"; // quit after
			}
			return "main";
		});

		await startMenu();

		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		expect(logCalls.some((c) => typeof c === "string" && c.includes("No project folders found"))).toBe(true);
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
		vi.mocked(input.ask).mockResolvedValue("");
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
				// Start Menu — Create Project
				const arr = items as Array<{ key?: string; action?: () => unknown }>;
				await (arr.find((i) => i.key === "2")?.action?.() as Promise<unknown>);
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

		expect(scaffoldProject).toHaveBeenCalledWith(expect.objectContaining({
			definitionId: "flowti-project",
			name: "new-project",
		}));
		expect(setSelectedProject).toHaveBeenCalledWith("new-project");
	});

	it("offers GitHub clone option", async () => {
		const mockFs = createMockFs();
		setDisk(mockFs);
		vi.mocked(input.ask)
			.mockResolvedValueOnce("gh-project") // project name
			.mockResolvedValueOnce("https://github.com/test/repo"); // github url
		vi.mocked(getSelectedProject).mockReturnValue(null);
		const sh = createMockShell();
		setShell(sh);

		let callCount = 0;
		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			callCount++;
			if (callCount === 1) {
				const arr = items as Array<{ key?: string; action?: () => unknown }>;
				await (arr.find((i) => i.key === "2")?.action?.() as Promise<unknown>);
				return "quit";
			}
			if (callCount === 2) {
				// Template selection — pick GitHub clone (key "g")
				const arr = items as Array<{ key?: string; action?: () => unknown }>;
				const result = await (arr.find((i) => i.key === "g")?.action?.() as Promise<unknown>);
				expect(result).toBe("quit");
				return "quit";
			}
			return "main";
		});

		await startMenu();

		expect(sh.calls).toHaveLength(1);
		expect(sh.calls[0].cmd).toContain("git clone");
	});

	it("handles failed GitHub clone", async () => {
		const mockFs = createMockFs();
		setDisk(mockFs);
		vi.mocked(input.ask)
			.mockResolvedValueOnce("fail-project")
			.mockResolvedValueOnce("https://github.com/bad/repo");
		vi.mocked(getSelectedProject).mockReturnValue(null);
		const sh = createMockShell();
		sh.run = (cmd: string, opts?: Record<string, unknown>) => {
			(sh.calls as Array<{ method: string; cmd: string; opts?: Record<string, unknown> }>).push({ method: "run", cmd, opts });
			return cmd.includes("git clone") ? 1 : 0;
		};
		setShell(sh);

		let callCount = 0;
		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			callCount++;
			if (callCount === 1) {
				const arr = items as Array<{ key?: string; action?: () => unknown }>;
				await (arr.find((i) => i.key === "2")?.action?.() as Promise<unknown>);
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
		expect(logCalls.some((c) => typeof c === "string" && c.includes("Clone failed"))).toBe(true);
	});

	it("cancels GitHub clone when URL is empty", async () => {
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
				await (arr.find((i) => i.key === "2")?.action?.() as Promise<unknown>);
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
