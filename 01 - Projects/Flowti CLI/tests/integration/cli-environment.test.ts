/**
 * cli-environment.test.ts — Integration test for the full Flowti CLI lifecycle.
 *
 * Exercises the flow a user encounters from a fresh vault:
 *   1. Prerequisites check (git + node available)
 *   2. Config resolution (.flowti/config.json exists and is valid)
 *   3. State starts empty (no project selected)
 *   4. Project creation (scaffold a project via definition)
 *   5. Project selection persists in state
 *
 * Uses a MockTestVault so no real I/O occurs — safe for npm test.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockTestVault, type MockTestVault } from "../helpers/test-vault.js";
import { createMockShell } from "../mocks/mock-shell.js";
import { createMockFs } from "../mocks/mock-fs.js";
import { paths } from "../../src/infrastructure/paths.js";

// ── Module mocks ────────────────────────────────────────────────────
// Note: vi.mock factories are hoisted — cannot reference local const/let.
// All paths must be string literals.

let vault: MockTestVault;

vi.mock("../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/test-vaults/flowti-cli-test",
	CLI_PROJECT: "/test-vaults/flowti-cli-test/01 - Projects/Flowti CLI",
	PROJECTS_DIR: "/test-vaults/flowti-cli-test/01 - Projects",
	PLUGIN_ROOT: "/test-vaults/flowti-cli-test/Development/flowti",
	cliConfig: {
		version: "1.0.0",
		source: "01 - Projects/Flowti CLI",
		projectsFolder: "01 - Projects",
		onboarding: { nodeMinVersion: 16 },
		testing: { vault: "flowti-cli-test" },
	},
	loadJson: vi.fn(),
}));

vi.mock("../../src/infrastructure/state.js", () => ({
	getSelectedProject: vi.fn(() => null),
	setSelectedProject: vi.fn(),
	clearSelectedProject: vi.fn(),
	loadState: vi.fn(() => ({})),
	saveState: vi.fn(),
}));

vi.mock("../../src/infrastructure/filesystem.js", () => ({
	disk: {},
}));

vi.mock("../../src/infrastructure/shell.js", () => ({
	shell: {},
}));

vi.mock("../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
	printBanner: vi.fn(),
}));

vi.mock("../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
	error: vi.fn(),
}));

vi.mock("../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn() },
}));

vi.mock("../../src/infrastructure/menu.js", () => ({
	runMenu: vi.fn(),
}));

vi.mock("../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn(), argv: () => [], cwd: () => "/mock", env: () => ({}) },
}));

// Mock scaffold module to avoid pulling in the full definition dependency tree
vi.mock("../../src/domain/scaffold/scaffold.js", () => ({
	scaffold: vi.fn(() => ({ created: 5, outputPath: "/mock/output" })),
	listDefinitions: vi.fn(() => [
		{ id: "flowti-project", label: "Flowti Project", description: "Full Flowti project with CLI integration." },
	]),
}));

// ── Imports (after mocks) ───────────────────────────────────────────

import * as fsMod from "../../src/infrastructure/filesystem.js";
import * as shellMod from "../../src/infrastructure/shell.js";
import { log } from "../../src/infrastructure/logger.js";
import { input } from "../../src/infrastructure/input.js";
import { runMenu } from "../../src/infrastructure/menu.js";
import { setSelectedProject, getSelectedProject, loadState, saveState } from "../../src/infrastructure/state.js";
import { checkPrerequisites } from "../../src/domain/onboarding/onboarding.js";
import { listProjects, startMenu } from "../../src/ui/menus/project-menu.js";
import { resolveCommand } from "../../src/infrastructure/dispatch.js";
import { scaffold as scaffoldProject } from "../../src/domain/scaffold/scaffold.js";
import {
	resolveTestVaultRoot,
	resolveTestVaultLayout,
	buildTestVaultConfig,
	scaffoldTestVault,
	teardownTestVault,
} from "../../src/infrastructure/test-vault.js";

// ── Helpers ─────────────────────────────────────────────────────────

function setDisk(mockFs: MockTestVault["fs"]): void {
	Object.assign(fsMod, { disk: mockFs });
}

function setShell(sh: ReturnType<typeof createMockShell>): void {
	Object.assign(shellMod, { shell: sh });
}

// ── Setup ───────────────────────────────────────────────────────────

beforeEach(() => {
	vi.clearAllMocks();
	vault = createMockTestVault("flowti-cli-test", {
		config: {
			source: "01 - Projects/Flowti CLI",
			onboarding: { nodeMinVersion: 16 },
			testing: { vault: "flowti-cli-test" },
		},
	});
	setDisk(vault.fs);
});

// ═══════════════════════════════════════════════════════════════════
// Test Vault Service
// ═══════════════════════════════════════════════════════════════════

describe("TestVault service", () => {
	it("resolves test vault root as sibling to vault", () => {
		const root = resolveTestVaultRoot("my-test", "/vaults/main");
		// On Windows, path.resolve prepends drive letter — normalize
		expect(root.replace(/\\/g, "/")).toContain("/vaults/my-test");
	});

	it("resolves layout paths from root", () => {
		const layout = resolveTestVaultLayout("/v/test");
		expect(layout.configPath.replace(/\\/g, "/")).toBe("/v/test/.flowti/config.json");
		expect(layout.statePath.replace(/\\/g, "/")).toBe("/v/test/.flowti/var/state.json");
		expect(layout.binDir.replace(/\\/g, "/")).toBe("/v/test/.flowti/bin");
		expect(layout.projectsDir.replace(/\\/g, "/")).toBe("/v/test/01 - Projects");
	});

	it("resolves layout with custom projects folder", () => {
		const layout = resolveTestVaultLayout("/v/test", "Projects");
		expect(layout.projectsDir.replace(/\\/g, "/")).toBe("/v/test/Projects");
	});

	it("builds config with defaults", () => {
		const config = buildTestVaultConfig({ name: "test" });
		expect(config.version).toBe("1.0.0");
		expect(config.projectsFolder).toBe("01 - Projects");
	});

	it("builds config with overrides", () => {
		const config = buildTestVaultConfig({
			name: "test",
			projectsFolder: "my-projects",
			config: { defaultAuthor: "Test Author" },
		});
		expect(config.projectsFolder).toBe("my-projects");
		expect(config.defaultAuthor).toBe("Test Author");
	});

	it("scaffolds a complete vault structure", () => {
		const fs = vault.fs;
		expect(fs.existsSync(vault.layout.configPath)).toBe(true);
		expect(fs.existsSync(vault.layout.stateDir)).toBe(true);
		expect(fs.existsSync(vault.layout.binDir)).toBe(true);
		expect(fs.existsSync(vault.layout.projectsDir)).toBe(true);

		const config = JSON.parse(fs.readFileSync(vault.layout.configPath, "utf-8"));
		expect(config.version).toBe("1.0.0");
		expect(config.testing?.vault).toBe("flowti-cli-test");
	});

	it("teardown calls rmSync on the vault root", () => {
		const fs = vault.fs;
		const rmSpy = vi.spyOn(fs, "rmSync");
		teardownTestVault(vault.layout.root, fs);
		expect(rmSpy).toHaveBeenCalledWith(vault.layout.root, { recursive: true, force: true });
	});

	it("copies CLI build when sourceBinDir is provided", () => {
		const fs = createMockFs({
			"/source/bin/main.js": "// main bundle",
			"/source/bin/index.js": "// bootstrap",
			"/source/bin/main.js.map": "// sourcemap",
		});
		const layout = scaffoldTestVault("/v/copy-test", {
			name: "copy-test",
			sourceBinDir: "/source/bin",
		}, fs);
		expect(fs.existsSync(paths.join(layout.binDir, "main.js"))).toBe(true);
		expect(fs.existsSync(paths.join(layout.binDir, "index.js"))).toBe(true);
		expect(fs.existsSync(paths.join(layout.binDir, "main.js.map"))).toBe(true);
		expect(fs.readFileSync(paths.join(layout.binDir, "main.js"), "utf-8")).toBe("// main bundle");
		const pkg = JSON.parse(fs.readFileSync(paths.join(layout.binDir, "package.json"), "utf-8"));
		expect(pkg.type).toBe("module");
	});

	it("skips missing source files gracefully", () => {
		const fs = createMockFs({
			"/source/bin/main.js": "// main only",
		});
		const layout = scaffoldTestVault("/v/partial-test", {
			name: "partial-test",
			sourceBinDir: "/source/bin",
		}, fs);
		expect(fs.existsSync(paths.join(layout.binDir, "main.js"))).toBe(true);
		expect(fs.existsSync(paths.join(layout.binDir, "index.js"))).toBe(false);
		// package.json is always written when sourceBinDir is set
		expect(fs.existsSync(paths.join(layout.binDir, "package.json"))).toBe(true);
	});

	it("does not copy build when sourceBinDir is omitted", () => {
		const fs = createMockFs();
		const layout = scaffoldTestVault("/v/no-bin-test", { name: "no-bin-test" }, fs);
		expect(fs.existsSync(paths.join(layout.binDir, "main.js"))).toBe(false);
		expect(fs.existsSync(paths.join(layout.binDir, "package.json"))).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════════
// Phase 1: Prerequisites
// ═══════════════════════════════════════════════════════════════════

describe("Phase 1: Prerequisites", () => {
	it("passes when git and node are available", () => {
		const exit = vi.fn();
		const sh = createMockShell({
			outputs: { "node --version": "v22.0.0" },
		});
		checkPrerequisites({ shell: sh, proc: { exit } });
		expect(exit).not.toHaveBeenCalled();
	});

	it("fails when git is missing", () => {
		const exit = vi.fn();
		const sh = createMockShell({
			failChecks: ["git --version"],
			outputs: { "node --version": "v22.0.0" },
		});
		checkPrerequisites({ shell: sh, proc: { exit } });
		expect(exit).toHaveBeenCalledWith(2);
	});

	it("fails when node version is below minimum", () => {
		const exit = vi.fn();
		const sh = createMockShell({
			outputs: { "node --version": "v14.0.0" },
		});
		checkPrerequisites({ shell: sh, proc: { exit } });
		expect(exit).toHaveBeenCalledWith(2);
	});
});

// ═══════════════════════════════════════════════════════════════════
// Phase 2: Config resolution
// ═══════════════════════════════════════════════════════════════════

describe("Phase 2: Config resolution", () => {
	it("vault has a valid .flowti/config.json", () => {
		const raw = vault.fs.readFileSync(vault.layout.configPath, "utf-8");
		const config = JSON.parse(raw);
		expect(config.version).toBe("1.0.0");
		expect(config.projectsFolder).toBe("01 - Projects");
	});

	it("config declares source project path", () => {
		const raw = vault.fs.readFileSync(vault.layout.configPath, "utf-8");
		const config = JSON.parse(raw);
		expect(config.source).toBe("01 - Projects/Flowti CLI");
	});

	it("config declares test vault name", () => {
		const raw = vault.fs.readFileSync(vault.layout.configPath, "utf-8");
		const config = JSON.parse(raw);
		expect(config.testing?.vault).toBe("flowti-cli-test");
	});
});

// ═══════════════════════════════════════════════════════════════════
// Phase 3: State initialization
// ═══════════════════════════════════════════════════════════════════

describe("Phase 3: State initialization", () => {
	it("no project selected on fresh vault", () => {
		expect(getSelectedProject()).toBeNull();
	});

	it("vault has .flowti/var directory ready for state", () => {
		expect(vault.fs.existsSync(vault.layout.stateDir)).toBe(true);
	});

	it("state file does not exist on fresh vault", () => {
		expect(vault.fs.existsSync(vault.layout.statePath)).toBe(false);
	});

	it("state can be written to the vault filesystem", () => {
		vault.fs.writeFileSync(
			vault.layout.statePath,
			JSON.stringify({ selectedProject: "test-app" }),
			"utf-8",
		);
		const raw = vault.fs.readFileSync(vault.layout.statePath, "utf-8");
		expect(JSON.parse(raw).selectedProject).toBe("test-app");
	});
});

// ═══════════════════════════════════════════════════════════════════
// Phase 4: Command dispatch (no project context)
// ═══════════════════════════════════════════════════════════════════

describe("Phase 4: Command dispatch", () => {
	const handlers = { build: vi.fn(), project: vi.fn() };
	const projectFree = new Set(["help", "project"]);

	it("dispatches help without a project", () => {
		const result = resolveCommand("help", {}, ["help"], handlers, projectFree, undefined, null);
		expect(result).toEqual({ action: "help", section: "main" });
	});

	it("dispatches project-free commands without a project", () => {
		const result = resolveCommand("project", {}, ["project"], handlers, projectFree, undefined, null);
		expect(result.action).toBe("run");
	});

	it("rejects project-bound commands without a project", () => {
		const result = resolveCommand("build", {}, ["build"], handlers, projectFree, undefined, null);
		expect(result).toEqual({ action: "no-project", command: "build" });
	});
});

// ═══════════════════════════════════════════════════════════════════
// Phase 5: Project creation (full flow)
// ═══════════════════════════════════════════════════════════════════

describe("Phase 5: Project creation flow", () => {
	it("starts with an empty projects list", () => {
		const projects = listProjects({ disk: fsMod.disk });
		expect(projects).toEqual([]);
	});

	it("shows 'Create Your First Project' when no projects exist", async () => {
		let capturedItems: Array<{ key?: string; label?: string }> = [];
		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			capturedItems = items as Array<{ key?: string; label?: string }>;
			return "quit";
		});

		await startMenu();

		// No "Open Project" option
		expect(capturedItems.find((i) => i.label?.includes("Open Project"))).toBeUndefined();
		// "Create Your First Project" at key 1
		const createItem = capturedItems.find((i) => i.key === "1");
		expect(createItem?.label).toContain("Create Your First Project");
	});

	it("scaffolds a project via the Create Project menu", async () => {
		vi.mocked(input.ask).mockResolvedValue("my-first-app");

		let callCount = 0;
		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			callCount++;
			if (callCount === 1) {
				// Start Menu — no projects, so "Create" is at key 1
				const arr = items as Array<{ key?: string; action?: () => unknown }>;
				await (arr.find((i) => i.key === "1")?.action?.() as Promise<unknown>);
				return "quit";
			}
			if (callCount === 2) {
				// Scaffold selection — pick first definition (key 1)
				const arr = items as Array<{ key?: string; action?: () => unknown }>;
				const result = arr.find((i) => i.key === "1")?.action?.();
				expect(result).toBe("quit");
				return "quit";
			}
			return "main";
		});

		await startMenu();

		// Scaffold was called with correct options
		expect(scaffoldProject).toHaveBeenCalledWith(
			expect.objectContaining({ disk: expect.anything(), paths: expect.anything() }),
			expect.objectContaining({
				definitionId: "flowti-project",
				name: "my-first-app",
				outputDir: expect.stringContaining("my-first-app"),
			}),
		);

		// Project was selected and persisted in state
		expect(setSelectedProject).toHaveBeenCalledWith("my-first-app");
	});

	it("adds git submodule from remote URL", async () => {
		const sh = createMockShell();
		setShell(sh);
		vi.mocked(input.ask)
			.mockResolvedValueOnce("cloned-project")
			.mockResolvedValueOnce("https://github.com/test/repo");

		let callCount = 0;
		vi.mocked(runMenu).mockImplementation(async (_title, items) => {
			callCount++;
			if (callCount === 1) {
				// No projects — "Create" is at key 1
				const arr = items as Array<{ key?: string; action?: () => unknown }>;
				await (arr.find((i) => i.key === "1")?.action?.() as Promise<unknown>);
				return "quit";
			}
			if (callCount === 2) {
				// Template selection — pick "Load Git Project from Remote" (key g)
				const arr = items as Array<{ key?: string; action?: () => unknown }>;
				await (arr.find((i) => i.key === "g")?.action?.() as Promise<unknown>);
				return "quit";
			}
			return "main";
		});

		await startMenu();

		expect(sh.calls).toHaveLength(1);
		expect(sh.calls[0].cmd).toContain("git submodule add");
		expect(sh.calls[0].cmd).toContain("https://github.com/test/repo");
		expect(setSelectedProject).toHaveBeenCalledWith("cloned-project");
	});

	it("rejects duplicate project name", async () => {
		// Pre-populate a project in the vault
		vault.fs.writeFileSync(
			`${vault.layout.projectsDir}/existing-app/package.json`,
			"{}",
			"utf-8",
		);
		vi.mocked(input.ask).mockResolvedValue("existing-app");

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
});

// ═══════════════════════════════════════════════════════════════════
// Phase 6: End-to-end — full installation → first project
// ═══════════════════════════════════════════════════════════════════

describe("Phase 6: Full lifecycle", () => {
	it("fresh vault → prerequisites → create first project → project selected", async () => {
		// 1. Prerequisites pass
		const exit = vi.fn();
		const sh = createMockShell({ outputs: { "node --version": "v22.0.0" } });
		setShell(sh);
		checkPrerequisites({ shell: sh, proc: { exit } });
		expect(exit).not.toHaveBeenCalled();

		// 2. No project selected
		expect(getSelectedProject()).toBeNull();

		// 3. No projects yet
		expect(listProjects({ disk: fsMod.disk })).toEqual([]);

		// 4. Create a project via the Start Menu (no projects — key 1 is Create)
		vi.mocked(input.ask).mockResolvedValue("hello-world");
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
				arr.find((i) => i.key === "1")?.action?.(); // First scaffold definition
				return "quit";
			}
			return "main";
		});

		await startMenu();

		// 5. Scaffold was called
		expect(scaffoldProject).toHaveBeenCalledWith(
			expect.objectContaining({ disk: expect.anything(), paths: expect.anything() }),
			expect.objectContaining({
				definitionId: "flowti-project",
				name: "hello-world",
				outputDir: expect.stringContaining("hello-world"),
			}),
		);

		// 6. Project was selected
		expect(setSelectedProject).toHaveBeenCalledWith("hello-world");
	});
});
