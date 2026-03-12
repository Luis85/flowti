/**
 * project.controller.test.ts — Tests for project selection command.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must come BEFORE imports) ─────────────────────────────

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn(), warn: vi.fn() }));
vi.mock("../../src/infrastructure/shell.js", () => ({
	shell: { run: vi.fn(() => 0) },
}));
vi.mock("../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => true),
		readFileSync: vi.fn(() => ""),
		readdirSync: vi.fn(() => []),
		writeFileSync: vi.fn(),
	},
}));
vi.mock("../../src/infrastructure/paths.js", () => ({
	paths: {
		join: vi.fn((...args: string[]) => args.join("/")),
		resolve: vi.fn((...args: string[]) => args.join("/")),
		relative: vi.fn((_a: string, b: string) => b),
		dirname: vi.fn((p: string) => p),
		basename: vi.fn((p: string) => p.split("/").pop() ?? p),
	},
}));
vi.mock("../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
	CLI_PROJECT: "/vault/cli",
}));
vi.mock("../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn() },
}));
vi.mock("../../src/infrastructure/output.js", () => ({
	output: { write: vi.fn() },
}));

// Mock domain module
vi.mock("../../src/ui/menus/project-menu.js", () => ({
	startMenu: vi.fn(),
	listProjects: vi.fn(() => []),
	getProjectPath: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { commands } from "../../src/controller/project.controller.js";
import { startMenu } from "../../src/ui/menus/project-menu.js";

const mockProject = {
	name: "test",
	path: "/project",
	config: { name: "test", reports: { generators: [] } },
	scripts: {},
	pkg: null,
};

// ── Tests ────────────────────────────────────────────────────────

describe("project.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("project", () => {
		it("calls startMenu", async () => {
			vi.mocked(startMenu).mockResolvedValue(undefined);

			await commands["project"]({}, [], "project", mockProject);

			expect(startMenu).toHaveBeenCalled();
		});

		it("works without a project context", async () => {
			vi.mocked(startMenu).mockResolvedValue(undefined);

			await commands["project"]({}, [], "project", undefined);

			expect(startMenu).toHaveBeenCalled();
		});
	});
});
