import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn(), warn: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
}));
vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => "{}"), writeFileSync: vi.fn(), mkdirSync: vi.fn(), readdirSync: vi.fn(() => []) },
}));
vi.mock("../../../src/infrastructure/shell.js", async () => {
	const { mockShellPreset } = await import("../../mocks/mock-presets.js");
	return mockShellPreset();
});
vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		basename: (p: string) => p.split("/").pop() || "",
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		resolve: (...args: string[]) => args.join("/"),
	},
}));
vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { iso: vi.fn(() => "2026-01-01T00:00:00.000Z"), now: vi.fn(() => new Date()), ms: vi.fn(() => 0) },
}));
vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
	CLI_PROJECT: "/cli",
}));
vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn() },
}));
vi.mock("../../../src/infrastructure/menu.js", () => ({
	runMenu: vi.fn(),
}));
vi.mock("../../../src/domain/plugins/plugin-loader.js", () => ({
	loadPlugins: vi.fn(() => []),
	discoverPluginFiles: vi.fn(() => []),
	validateManifest: vi.fn(() => ({ valid: true, errors: [], warnings: [] })),
	scaffoldPlugin: vi.fn(() => ({ path: "/vault/.flowti/plugins/test" })),
	PLUGINS_DIR: ".flowti/plugins",
}));
vi.mock("../../../src/domain/plugins/plugin-reference.js", () => ({
	generatePluginReference: vi.fn(() => ({ save: vi.fn() })),
}));
const capturedJson: unknown[] = [];
vi.mock("../../../src/infrastructure/output.js", () => ({
	resolveFormat: vi.fn((flags: Record<string, string | boolean>) => flags.format === "json" ? "json" : "text"),
	printOutput: vi.fn((fmt: string, data: unknown, render: () => void) => {
		if (fmt === "json") {
			capturedJson.push(data);
		} else {
			render();
		}
	}),
}));

vi.mock("../../../src/infrastructure/request-response.js", async () => {
	const actual = await vi.importActual<typeof import("../../../src/infrastructure/request-response.js")>("../../../src/infrastructure/request-response.js");
	return actual;
});

import { commands } from "../../../src/controller/plugins.controller.js";
import { log } from "../../../src/infrastructure/logger.js";
import { loadPlugins, discoverPluginFiles, validateManifest } from "../../../src/domain/plugins/plugin-loader.js";
import { generatePluginReference } from "../../../src/domain/plugins/plugin-reference.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { paths } from "../../../src/infrastructure/paths.js";
import {
	toPluginListItems,
	toPluginValidationItems,
} from "../../../src/domain/plugins/plugin-commands.js";
import type { LoadedPlugin } from "../../../src/domain/plugins/plugin-types.js";

beforeEach(() => {
	vi.clearAllMocks();
	capturedJson.length = 0;
});

// ── Helpers ──────────────────────────────────────────────────────────

function makePlugin(overrides: Partial<LoadedPlugin> = {}): LoadedPlugin {
	return {
		manifest: {
			name: "test-plugin",
			description: "A test plugin",
			version: "1.0.0",
			commands: {
				deploy: { description: "Deploy app", run: "npm run deploy" },
			},
		},
		path: "/vault/.flowti/plugins/test-plugin",
		commands: { "plugin:test-plugin:deploy": () => {} },
		valid: true,
		errors: [],
		...overrides,
	};
}

// ── plugin:list ──────────────────────────────────────────────────────

describe("plugin:list", () => {
	it("logs 'No plugins found' when list is empty", () => {
		vi.mocked(loadPlugins).mockReturnValue([]);

		commands["plugin:list"]({}, [], "plugin:list");

		expect(log).toHaveBeenCalledWith(expect.stringContaining("No plugins found"));
	});

	it("logs plugin names for valid plugins", () => {
		const plugin = makePlugin();
		vi.mocked(loadPlugins).mockReturnValue([plugin]);

		commands["plugin:list"]({}, [], "plugin:list");

		expect(log).toHaveBeenCalledWith(expect.stringContaining("test-plugin"));
	});

	it("logs errors for invalid plugins", () => {
		const plugin = makePlugin({
			valid: false,
			errors: ["Missing run field"],
		});
		vi.mocked(loadPlugins).mockReturnValue([plugin]);

		commands["plugin:list"]({}, [], "plugin:list");

		expect(log).toHaveBeenCalledWith(expect.stringContaining("Missing run field"));
	});
});

// ── plugin:validate ──────────────────────────────────────────────────

describe("plugin:validate", () => {
	it("logs 'No plugin manifests found' when no files discovered", () => {
		vi.mocked(discoverPluginFiles).mockReturnValue([]);

		commands["plugin:validate"]({}, [], "plugin:validate");

		expect(log).toHaveBeenCalledWith(expect.stringContaining("No plugin manifests found"));
	});

	it("logs parse error for unparseable manifest", () => {
		vi.mocked(discoverPluginFiles).mockReturnValue(["/vault/.flowti/plugins/bad/manifest.json"]);
		vi.mocked(disk.readFileSync).mockImplementation(() => {
			throw new SyntaxError("Unexpected token");
		});

		commands["plugin:validate"]({}, [], "plugin:validate");

		expect(log).toHaveBeenCalledWith(expect.stringContaining("Parse error"));
	});
});

// ── plugin:reference ─────────────────────────────────────────────────

describe("plugin:reference", () => {
	it("outputs JSON array for valid plugin with --format=json", () => {
		const plugin = makePlugin();
		vi.mocked(loadPlugins).mockReturnValue([plugin]);

		commands["plugin:list"]({ format: "json" }, [], "plugin:list");

		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		const jsonLine = logCalls.find((c) => typeof c === "string" && c.startsWith("["));
		expect(jsonLine).toBeDefined();
		const data = JSON.parse(jsonLine as string) as Array<Record<string, unknown>>;
		expect(data).toHaveLength(1);
		expect(data[0].name).toBe("test-plugin");
		expect(data[0].version).toBe("1.0.0");
		expect(data[0].valid).toBe(true);
		expect(data[0].commands).toEqual(["plugin:test-plugin:deploy"]);
	});
});

// ── plugin:validate --json ──────────────────────────────────────────

describe("plugin:validate --json", () => {
	it("outputs JSON validation results with --format=json", () => {
		vi.mocked(discoverPluginFiles).mockReturnValue(["/vault/.flowti/plugins/good/manifest.json"]);
		vi.mocked(disk.readFileSync).mockReturnValue(
			JSON.stringify({ name: "good", description: "ok" }),
		);
		vi.mocked(validateManifest).mockReturnValue({ valid: true, errors: [], warnings: [] });

		commands["plugin:validate"]({ format: "json" }, [], "plugin:validate");

		const logCalls = vi.mocked(log).mock.calls.map((c) => c[0]);
		const jsonLine = logCalls.find((c) => typeof c === "string" && c.startsWith("["));
		expect(jsonLine).toBeDefined();
		const parsed = JSON.parse(jsonLine as string);
		expect(parsed).toHaveLength(1);
		expect(parsed[0].name).toBe("good");
		expect(parsed[0].valid).toBe(true);
	});
});

// ── plugin:reference ─────────────────────────────────────────────────

describe("plugin:reference", () => {
	it("loads plugins, generates reference, saves, and logs success", () => {
		const saveFn = vi.fn();
		vi.mocked(loadPlugins).mockReturnValue([makePlugin()]);
		vi.mocked(generatePluginReference).mockReturnValue({ save: saveFn } as never);

		commands["plugin:reference"]({}, [], "plugin:reference");

		expect(loadPlugins).toHaveBeenCalled();
		expect(generatePluginReference).toHaveBeenCalled();
		expect(saveFn).toHaveBeenCalledWith(expect.stringContaining("Plugin Reference.md"));
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Reference saved"));
	});
});

// ── toPluginListItems (pure domain function) ─────────────────────────

describe("toPluginListItems", () => {
	it("returns empty array for empty input", () => {
		expect(toPluginListItems([])).toEqual([]);
	});

	it("maps a valid plugin to a list item", () => {
		const plugin = makePlugin();

		const items = toPluginListItems([plugin]);

		expect(items).toHaveLength(1);
		expect(items[0].name).toBe("test-plugin");
		expect(items[0].version).toBe("1.0.0");
		expect(items[0].description).toBe("A test plugin");
		expect(items[0].commands).toEqual(["plugin:test-plugin:deploy"]);
		expect(items[0].valid).toBe(true);
		expect(items[0].errors).toEqual([]);
	});

	it("maps version to null when not present", () => {
		const plugin = makePlugin({
			manifest: { name: "no-ver", description: "d", commands: {} },
		});

		const items = toPluginListItems([plugin]);

		expect(items[0].version).toBeNull();
	});

	it("maps empty description to empty string", () => {
		const plugin = makePlugin({
			manifest: { name: "p", description: "", commands: {} },
		});

		const items = toPluginListItems([plugin]);

		expect(items[0].description).toBe("");
	});

	it("maps invalid plugin with errors", () => {
		const plugin = makePlugin({
			valid: false,
			errors: ["Missing commands", "Bad format"],
		});

		const items = toPluginListItems([plugin]);

		expect(items[0].valid).toBe(false);
		expect(items[0].errors).toEqual(["Missing commands", "Bad format"]);
	});

	it("creates a copy of the errors array (mutation safe)", () => {
		const originalErrors = ["err1"];
		const plugin = makePlugin({ errors: originalErrors });

		const items = toPluginListItems([plugin]);
		items[0].errors.push("extra");

		expect(originalErrors).toHaveLength(1);
	});

	it("maps multiple plugins", () => {
		const plugins = [
			makePlugin(),
			makePlugin({
				manifest: { name: "second", description: "Two", version: "2.0", commands: {} },
				commands: {},
			}),
		];

		const items = toPluginListItems(plugins);

		expect(items).toHaveLength(2);
		expect(items[0].name).toBe("test-plugin");
		expect(items[1].name).toBe("second");
	});
});

// ── toPluginValidationItems (pure domain function) ───────────────────

describe("toPluginValidationItems", () => {
	it("returns empty array when no plugin files discovered", () => {
		vi.mocked(discoverPluginFiles).mockReturnValue([]);

		const items = toPluginValidationItems({ disk, paths }, "/vault");

		expect(items).toEqual([]);
		expect(discoverPluginFiles).toHaveBeenCalledWith(expect.any(Object), "/vault/.flowti/plugins", disk);
	});

	it("validates a valid manifest", () => {
		vi.mocked(discoverPluginFiles).mockReturnValue([
			"/vault/.flowti/plugins/my-plugin/manifest.json",
		]);
		vi.mocked(disk.readFileSync).mockReturnValue(
			JSON.stringify({ name: "my-plugin", description: "ok", commands: {} }),
		);
		vi.mocked(validateManifest).mockReturnValue({ valid: true, errors: [], warnings: [] });

		const items = toPluginValidationItems({ disk, paths }, "/vault");

		expect(items).toHaveLength(1);
		expect(items[0]).toEqual({
			name: "my-plugin",
			valid: true,
			errors: [],
			warnings: [],
		});
	});

	it("validates an invalid manifest with errors and warnings", () => {
		vi.mocked(discoverPluginFiles).mockReturnValue([
			"/vault/.flowti/plugins/broken/manifest.json",
		]);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({ name: "broken" }));
		vi.mocked(validateManifest).mockReturnValue({
			valid: false,
			errors: ["Missing commands field"],
			warnings: ["No version specified"],
		});

		const items = toPluginValidationItems({ disk, paths }, "/vault");

		expect(items[0].valid).toBe(false);
		expect(items[0].errors).toEqual(["Missing commands field"]);
		expect(items[0].warnings).toEqual(["No version specified"]);
	});

	it("handles JSON parse error gracefully", () => {
		vi.mocked(discoverPluginFiles).mockReturnValue([
			"/vault/.flowti/plugins/corrupt/manifest.json",
		]);
		vi.mocked(disk.readFileSync).mockImplementation(() => {
			throw new SyntaxError("Unexpected token");
		});

		const items = toPluginValidationItems({ disk, paths }, "/vault");

		expect(items[0]).toEqual({
			name: "corrupt",
			valid: false,
			errors: ["Parse error: Unexpected token"],
			warnings: [],
		});
	});

	it("handles non-Error thrown value", () => {
		vi.mocked(discoverPluginFiles).mockReturnValue([
			"/vault/.flowti/plugins/weird/manifest.json",
		]);
		vi.mocked(disk.readFileSync).mockImplementation(() => {
			throw "string error";
		});

		const items = toPluginValidationItems({ disk, paths }, "/vault");

		expect(items[0].errors[0]).toBe("Parse error: string error");
	});

	it("validates multiple plugin files", () => {
		vi.mocked(discoverPluginFiles).mockReturnValue([
			"/vault/.flowti/plugins/good/manifest.json",
			"/vault/.flowti/plugins/bad/manifest.json",
		]);
		vi.mocked(disk.readFileSync)
			.mockReturnValueOnce(JSON.stringify({ name: "good" }))
			.mockImplementationOnce(() => { throw new SyntaxError("bad JSON"); });
		vi.mocked(validateManifest).mockReturnValue({ valid: true, errors: [], warnings: [] });

		const items = toPluginValidationItems({ disk, paths }, "/vault");

		expect(items).toHaveLength(2);
		expect(items[0].name).toBe("good");
		expect(items[0].valid).toBe(true);
		expect(items[1].name).toBe("bad");
		expect(items[1].valid).toBe(false);
	});

	it("copies errors and warnings arrays (mutation safe)", () => {
		const origErrors = ["err"];
		const origWarnings = ["warn"];
		vi.mocked(discoverPluginFiles).mockReturnValue([
			"/vault/.flowti/plugins/p/manifest.json",
		]);
		vi.mocked(disk.readFileSync).mockReturnValue("{}");
		vi.mocked(validateManifest).mockReturnValue({
			valid: false,
			errors: origErrors,
			warnings: origWarnings,
		});

		const items = toPluginValidationItems({ disk, paths }, "/vault");
		items[0].errors.push("extra");
		items[0].warnings.push("extra");

		expect(origErrors).toHaveLength(1);
		expect(origWarnings).toHaveLength(1);
	});
});
