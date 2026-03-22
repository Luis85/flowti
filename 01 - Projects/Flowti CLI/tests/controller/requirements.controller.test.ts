/**
 * requirements.controller.test.ts — Tests for IREB requirements management commands.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must come BEFORE imports) ─────────────────────────────

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/infrastructure/shell.js", async () => {
	const { mockShellPreset } = await import("../mocks/mock-presets.js");
	return mockShellPreset();
});
vi.mock("../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => true),
		readFileSync: vi.fn(() => ""),
		readdirSync: vi.fn(() => []),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
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
	proc: { exit: vi.fn(), argv: () => [], cwd: () => "/", env: () => ({}) },
	pidOps: { isPidAlive: vi.fn(() => false), isPortListening: vi.fn(async () => false), killPid: vi.fn(() => false) },
}));

// Mock domain modules
vi.mock("../../src/domain/requirements/requirement-store.js", () => ({
	requirementStore: {
		list: vi.fn(() => [
			{ id: "REQ-001", name: "User Auth", requirementType: "functional", status: "draft" },
		]),
		updateField: vi.fn(() => true),
		create: vi.fn(() => "/project/requirements/user-auth.md"),
		resolveDir: vi.fn(() => "/project/docs/requirements"),
	},
	useCaseStore: {
		list: vi.fn(() => [
			{ id: "UC-001", name: "User Login", actor: "End User" },
		]),
		create: vi.fn(() => "/project/requirements/use-cases/user-login.md"),
		resolveDir: vi.fn(() => "/project/docs/requirements/use-cases"),
	},
	userStoryStore: {
		list: vi.fn(() => [
			{ id: "US-001", name: "Login Story", role: "User", goal: "log in", benefit: "access dashboard" },
		]),
		create: vi.fn(() => "/project/requirements/stories/login-story.md"),
		resolveDir: vi.fn(() => "/project/docs/requirements/user-stories"),
	},
	listRequirements: vi.fn(() => [
		{ id: "REQ-001", name: "User Auth", requirementType: "functional", status: "draft" },
	]),
	createRequirement: vi.fn(() => "/project/requirements/user-auth.md"),
	nextId: vi.fn((prefix: string) => `${prefix}-001`),
	listUseCases: vi.fn(() => [
		{ id: "UC-001", name: "User Login", actor: "End User" },
	]),
	createUseCase: vi.fn(() => "/project/requirements/use-cases/user-login.md"),
	listUserStories: vi.fn(() => [
		{ id: "US-001", name: "Login Story", role: "User", goal: "log in", benefit: "access dashboard" },
	]),
	createUserStory: vi.fn(() => "/project/requirements/stories/login-story.md"),
}));
vi.mock("../../src/ui/displays/requirements-display.js", () => ({
	renderRequirementList: vi.fn(),
	renderUseCaseList: vi.fn(),
	renderUserStoryList: vi.fn(),
	renderRequirementAdded: vi.fn(),
	renderRequirementUpdated: vi.fn(),
}));
vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderError: vi.fn(),
	renderNoProject: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { commands } from "../../src/controller/requirements.controller.js";
import { initializeDeps } from "../../src/infrastructure/command-engine.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { paths } from "../../src/infrastructure/paths.js";
import { shell } from "../../src/infrastructure/shell.js";
import { log } from "../../src/infrastructure/logger.js";
import { requirementStore, useCaseStore, userStoryStore, createRequirement, createUseCase, createUserStory } from "../../src/domain/requirements/requirement-store.js";
import { renderError } from "../../src/ui/renderers/common-renderers.js";

const mockProject = {
	name: "test",
	path: "/project",
	config: { name: "test", reports: { generators: [] } },
	scripts: {},
	pkg: null,
};

// ── Tests ────────────────────────────────────────────────────────

describe("requirements.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		initializeDeps({
			disk, shell, paths,
			proc: { exit: vi.fn() as never, argv: () => [], cwd: () => "/", env: () => ({}) },
			pidOps: { isPidAlive: vi.fn(() => false), isPortListening: vi.fn(async () => false), killPid: vi.fn(() => false) },
			clock: { iso: () => "", now: () => new Date(), ms: () => 0, safeIso: () => "" },
			input: { ask: vi.fn() as never, askYesNo: vi.fn() as never, waitForEnter: vi.fn() as never, askAbortable: vi.fn() as never },
			bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn() } as never,
			log, warn: vi.fn(),
			worldState: {} as never, workerManager: {} as never, processRunner: {} as never,
		});
	});

	describe("requirements:list", () => {
		it("returns list of requirements for a project", () => {
			commands["requirements:list"]({}, [], "requirements:list", mockProject);
			expect(requirementStore.list).toHaveBeenCalled();
		});

		it("does nothing without a project", () => {
			commands["requirements:list"]({}, [], "requirements:list", undefined);
			expect(requirementStore.list).not.toHaveBeenCalled();
		});
	});

	describe("requirements:add", () => {
		it("creates a requirement with valid flags", () => {
			commands["requirements:add"](
				{ name: "User Auth", type: "functional" },
				[], "requirements:add", mockProject,
			);
			expect(createRequirement).toHaveBeenCalled();
		});

		it("returns error when --name is missing", () => {
			commands["requirements:add"]({}, [], "requirements:add", mockProject);
			expect(createRequirement).not.toHaveBeenCalled();
		});

		it("returns error for invalid type", () => {
			commands["requirements:add"]({ name: "Bad", type: "invalid" }, [], "requirements:add", mockProject);
			expect(createRequirement).not.toHaveBeenCalled();
		});
	});

	describe("requirements:update", () => {
		it("updates requirement status with valid flags", () => {
			commands["requirements:update"](
				{ name: "User Auth", status: "approved" },
				[], "requirements:update", mockProject,
			);
			expect(requirementStore.updateField).toHaveBeenCalled();
		});

		it("returns error when --name or --status is missing", () => {
			commands["requirements:update"]({ name: "Test" }, [], "requirements:update", mockProject);
			expect(requirementStore.updateField).not.toHaveBeenCalled();
		});

		it("returns error for invalid status", () => {
			commands["requirements:update"]({ name: "Test", status: "invalid" }, [], "requirements:update", mockProject);
			expect(requirementStore.updateField).not.toHaveBeenCalled();
		});
	});

	describe("usecases:list", () => {
		it("returns list of use cases for a project", () => {
			commands["usecases:list"]({}, [], "usecases:list", mockProject);
			expect(useCaseStore.list).toHaveBeenCalled();
		});

		it("does nothing without a project", () => {
			commands["usecases:list"]({}, [], "usecases:list", undefined);
			expect(useCaseStore.list).not.toHaveBeenCalled();
		});
	});

	describe("usecases:add", () => {
		it("creates a use case with valid flags", () => {
			commands["usecases:add"](
				{ name: "User Login", actor: "End User" },
				[], "usecases:add", mockProject,
			);
			expect(createUseCase).toHaveBeenCalled();
		});

		it("returns error when --name is missing", () => {
			commands["usecases:add"]({ actor: "User" }, [], "usecases:add", mockProject);
			expect(createUseCase).not.toHaveBeenCalled();
		});

		it("returns error when --actor is missing", () => {
			commands["usecases:add"]({ name: "Login" }, [], "usecases:add", mockProject);
			expect(createUseCase).not.toHaveBeenCalled();
		});
	});

	describe("stories:list", () => {
		it("returns list of user stories for a project", () => {
			commands["stories:list"]({}, [], "stories:list", mockProject);
			expect(userStoryStore.list).toHaveBeenCalled();
		});
	});

	describe("stories:add", () => {
		it("creates a user story with valid flags", () => {
			commands["stories:add"](
				{ name: "Login Story", role: "User", goal: "log in", benefit: "access dashboard" },
				[], "stories:add", mockProject,
			);
			expect(createUserStory).toHaveBeenCalled();
		});

		it("returns error when --name is missing", () => {
			commands["stories:add"]({ role: "User", goal: "x", benefit: "y" }, [], "stories:add", mockProject);
			expect(createUserStory).not.toHaveBeenCalled();
		});

		it("returns error when --role, --goal, or --benefit is missing", () => {
			commands["stories:add"]({ name: "Story" }, [], "stories:add", mockProject);
			expect(createUserStory).not.toHaveBeenCalled();
		});
	});
});
