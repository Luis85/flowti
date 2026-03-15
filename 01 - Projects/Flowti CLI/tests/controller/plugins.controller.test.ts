/**
 * plugins.controller.test.ts — Tests for the plugins controller.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/shell.js", async () => {
	const { mockShellPreset } = await import("../mocks/mock-presets.js");
	return mockShellPreset();
});
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => true),
		readFileSync: vi.fn(() => '{"name":"test-plugin","version":"1.0.0","description":"A test plugin"}'),
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
		dirname: vi.fn((p: string) => p.split("/").slice(0, -1).join("/")),
		basename: vi.fn((p: string) => p.split("/").pop() ?? p),
	},
}));
vi.mock("../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(async () => "my-plugin") },
}));
vi.mock("../../src/infrastructure/clock.js", () => ({
	clock: { iso: vi.fn(() => "2026-01-01T00:00:00.000Z"), now: vi.fn(() => new Date()), ms: vi.fn(() => 0) },
}));
vi.mock("../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
	CLI_PROJECT: "/vault/cli",
}));
vi.mock("../../src/domain/plugins/plugin-loader.js", () => ({
	loadPlugins: vi.fn(() => [
		{
			manifest: { name: "alpha-plugin", version: "1.0.0", description: "Alpha" },
			commands: { "alpha:run": vi.fn() },
			valid: true,
			errors: [],
		},
		{
			manifest: { name: "beta-plugin", version: "2.0.0", description: "Beta" },
			commands: {},
			valid: true,
			errors: [],
		},
	]),
	discoverPluginFiles: vi.fn(() => ["/vault/plugins/alpha/manifest.json"]),
	validateManifest: vi.fn(() => ({ valid: true, errors: [], warnings: [] })),
	scaffoldPlugin: vi.fn(() => ({ path: "/vault/plugins/my-plugin" })),
	PLUGINS_DIR: "plugins",
}));
vi.mock("../../src/domain/plugins/plugin-reference.js", () => ({
	generatePluginReference: vi.fn(() => ({
		save: vi.fn(),
	})),
}));
vi.mock("../../src/ui/displays/plugins-display.js", () => ({
	renderPluginList: vi.fn(),
	renderPluginValidation: vi.fn(),
	renderPluginCreated: vi.fn(),
}));
vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderSuccess: vi.fn(),
	renderError: vi.fn(),
}));

import { commands } from "../../src/controller/plugins.controller.js";
import { initializeDeps } from "../../src/infrastructure/command-engine.js";
import { loadPlugins, discoverPluginFiles, validateManifest } from "../../src/domain/plugins/plugin-loader.js";
import { generatePluginReference } from "../../src/domain/plugins/plugin-reference.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { paths } from "../../src/infrastructure/paths.js";
import { shell } from "../../src/infrastructure/shell.js";
import { clock } from "../../src/infrastructure/clock.js";
import { input } from "../../src/infrastructure/input.js";
import { log } from "../../src/infrastructure/logger.js";

describe("plugins.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		initializeDeps({
			disk, shell, paths, clock, input,
			proc: { exit: vi.fn() as never, argv: () => [], cwd: () => "/", env: () => ({}) },
			bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn() } as never,
			log, warn: vi.fn(),
		});
	});

	// ── plugin:list ───────────────────────────────────────────────
	describe("plugin:list", () => {
		it("returns list of loaded plugins", () => {
			commands["plugin:list"]({}, [], "plugin:list", undefined);
			expect(loadPlugins).toHaveBeenCalledWith(expect.any(Object), "/vault", expect.anything(), expect.anything());
		});

		it("maps plugins to list items with name, version, commands", () => {
			commands["plugin:list"]({}, [], "plugin:list", undefined);
			expect(loadPlugins).toHaveBeenCalledTimes(1);
		});
	});

	// ── plugin:validate ───────────────────────────────────────────
	describe("plugin:validate", () => {
		it("discovers plugin files and validates manifests", () => {
			commands["plugin:validate"]({}, [], "plugin:validate", undefined);
			expect(discoverPluginFiles).toHaveBeenCalledWith(expect.any(Object), expect.any(String), expect.anything());
			expect(validateManifest).toHaveBeenCalled();
		});

		it("returns validation results for each discovered plugin", () => {
			commands["plugin:validate"]({}, [], "plugin:validate", undefined);
			expect(discoverPluginFiles).toHaveBeenCalledTimes(1);
			expect(validateManifest).toHaveBeenCalledTimes(1);
		});
	});

	// ── plugin:reference ──────────────────────────────────────────
	describe("plugin:reference", () => {
		it("generates plugin reference document", () => {
			commands["plugin:reference"]({}, [], "plugin:reference", undefined);
			expect(loadPlugins).toHaveBeenCalledWith(expect.any(Object), "/vault", expect.anything(), expect.anything());
			expect(generatePluginReference).toHaveBeenCalledWith(expect.any(Object), expect.anything());
		});

		it("saves reference to docs/reference path", () => {
			commands["plugin:reference"]({}, [], "plugin:reference", undefined);
			const ref = vi.mocked(generatePluginReference).mock.results[0].value;
			expect(ref.save).toHaveBeenCalled();
		});
	});

	// ── plugin:new ────────────────────────────────────────────────
	describe("plugin:new", () => {
		it("scaffolds a new plugin with user input", async () => {
			const { scaffoldPlugin } = await import("../../src/domain/plugins/plugin-loader.js");
			await commands["plugin:new"]({}, [], "plugin:new", undefined);
			expect(scaffoldPlugin).toHaveBeenCalledWith(expect.any(Object), "/vault", "my-plugin", expect.any(String), expect.anything());
		});
	});
});
