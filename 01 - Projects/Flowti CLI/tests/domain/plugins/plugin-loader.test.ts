import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";
import { createMockFs } from "../../mocks/mock-fs.js";
import { createMockShell } from "../../mocks/mock-shell.js";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

import {
	discoverPluginFiles,
	validateManifest,
	loadPluginFile,
	loadPlugins,
	namespacedCommandKey,
	detectCollisions,
	scaffoldPlugin,
	PLUGINS_DIR,
	MANIFEST_FILENAME,
} from "../../../src/domain/plugins/plugin-loader.js";
import type { LoadedPlugin } from "../../../src/domain/plugins/plugin-types.js";

const testPaths = {
	join: (...args: string[]) => args.join("/"),
	basename: (p: string, ext?: string) => { const b = path.basename(p); return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b; },
	dirname: (p: string) => path.dirname(p).replace(/\\/g, "/"),
	resolve: (...args: string[]) => args.join("/"),
	relative: (_from: string, to: string) => to,
	extname: (p: string) => { const m = p.match(/\.[^.]+$/); return m ? m[0] : ""; },
	isAbsolute: (p: string) => p.startsWith("/"),
	sep: "/" as const,
};

const testDeps = { paths: testPaths } as const;

beforeEach(() => vi.clearAllMocks());

// ── namespacedCommandKey ────────────────────────────────────────────

describe("namespacedCommandKey", () => {
	it("builds plugin:<name>:<cmd> format", () => {
		expect(namespacedCommandKey("my-plugin", "deploy")).toBe("plugin:my-plugin:deploy");
	});

	it("handles single-word names", () => {
		expect(namespacedCommandKey("lint", "fix")).toBe("plugin:lint:fix");
	});
});

// ── validateManifest ────────────────────────────────────────────────

describe("validateManifest", () => {
	const validManifest = {
		name: "my-plugin",
		description: "A test plugin",
		version: "1.0.0",
		commands: {
			deploy: { description: "Deploy app", run: "npm run deploy" },
		},
	};

	it("accepts a valid manifest", () => {
		const result = validateManifest(validManifest);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it("rejects null", () => {
		const result = validateManifest(null);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("Manifest must be a JSON object");
	});

	it("rejects arrays", () => {
		const result = validateManifest([]);
		expect(result.valid).toBe(false);
	});

	it("rejects missing name", () => {
		const result = validateManifest({ ...validManifest, name: "" });
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("name");
	});

	it("rejects invalid name format (uppercase)", () => {
		const result = validateManifest({ ...validManifest, name: "MyPlugin" });
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("lowercase");
	});

	it("rejects missing description", () => {
		const result = validateManifest({ ...validManifest, description: "" });
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("description");
	});

	it("rejects non-object commands", () => {
		const result = validateManifest({ ...validManifest, commands: "bad" });
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("commands");
	});

	it("rejects command without run field", () => {
		const result = validateManifest({
			...validManifest,
			commands: { deploy: { description: "Deploy" } },
		});
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain('missing "run"');
	});

	it("rejects command without description", () => {
		const result = validateManifest({
			...validManifest,
			commands: { deploy: { run: "npm deploy" } },
		});
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain('missing "description"');
	});

	it("warns on empty commands object", () => {
		const result = validateManifest({ ...validManifest, commands: {} });
		expect(result.valid).toBe(true);
		expect(result.warnings).toContain("Plugin defines no commands");
	});

	it("warns on non-string version", () => {
		const result = validateManifest({ ...validManifest, version: 123 });
		expect(result.valid).toBe(true);
		expect(result.warnings[0]).toContain("version");
	});
});

// ── discoverPluginFiles ─────────────────────────────────────────────

describe("discoverPluginFiles", () => {
	it("returns empty array when directory does not exist", () => {
		const fs = createMockFs({});
		expect(discoverPluginFiles(testDeps, "/vault/.flowti/plugins", fs)).toEqual([]);
	});

	it("finds manifest.json in plugin subdirectories", () => {
		const fs = createMockFs({
			"/vault/.flowti/plugins/my-plugin/manifest.json": "{}",
			"/vault/.flowti/plugins/other/manifest.json": "{}",
		});
		const result = discoverPluginFiles(testDeps, "/vault/.flowti/plugins", fs);
		expect(result).toHaveLength(2);
		expect(result[0]).toContain("my-plugin");
		expect(result[0]).toContain("manifest.json");
		expect(result[1]).toContain("other");
	});

	it("ignores directories without manifest.json", () => {
		const fs = createMockFs({
			"/vault/.flowti/plugins/my-plugin/manifest.json": "{}",
			"/vault/.flowti/plugins/incomplete/readme.txt": "hello",
		});
		const result = discoverPluginFiles(testDeps, "/vault/.flowti/plugins", fs);
		expect(result).toHaveLength(1);
		expect(result[0]).toContain("my-plugin");
	});

	it("ignores files at the plugins root level", () => {
		const fs = createMockFs({
			"/vault/.flowti/plugins/stray.json": "{}",
			"/vault/.flowti/plugins/my-plugin/manifest.json": "{}",
		});
		const result = discoverPluginFiles(testDeps, "/vault/.flowti/plugins", fs);
		expect(result).toHaveLength(1);
	});
});

// ── loadPluginFile ──────────────────────────────────────────────────

describe("loadPluginFile", () => {
	const validJson = JSON.stringify({
		name: "test-plugin",
		description: "Test",
		commands: {
			greet: { description: "Say hello", run: "echo hello" },
		},
	});

	it("loads a valid plugin manifest", () => {
		const fs = createMockFs({ "/vault/.flowti/plugins/test-plugin/manifest.json": validJson });
		const sh = createMockShell();
		const result = loadPluginFile(testDeps, "/vault/.flowti/plugins/test-plugin/manifest.json", fs, sh, "/vault");

		expect(result.valid).toBe(true);
		expect(result.manifest.name).toBe("test-plugin");
		expect(result.commands).toHaveProperty("plugin:test-plugin:greet");
	});

	it("returns invalid for malformed JSON", () => {
		const fs = createMockFs({ "/vault/.flowti/plugins/bad/manifest.json": "not json" });
		const sh = createMockShell();
		const result = loadPluginFile(testDeps, "/vault/.flowti/plugins/bad/manifest.json", fs, sh, "/vault");

		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("Failed to parse");
	});

	it("returns invalid for bad manifest structure", () => {
		const fs = createMockFs({ "/vault/.flowti/plugins/bad/manifest.json": '{"name": ""}' });
		const sh = createMockShell();
		const result = loadPluginFile(testDeps, "/vault/.flowti/plugins/bad/manifest.json", fs, sh, "/vault");

		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
	});

	it("uses directory name as fallback name on error", () => {
		const fs = createMockFs({ "/vault/.flowti/plugins/my-cool-plugin/manifest.json": "not json" });
		const sh = createMockShell();
		const result = loadPluginFile(testDeps, "/vault/.flowti/plugins/my-cool-plugin/manifest.json", fs, sh, "/vault");

		expect(result.manifest.name).toBe("my-cool-plugin");
	});

	it("namespaces commands as plugin:<name>:<cmd>", () => {
		const fs = createMockFs({ "/vault/.flowti/plugins/test-plugin/manifest.json": validJson });
		const sh = createMockShell();
		const result = loadPluginFile(testDeps, "/vault/.flowti/plugins/test-plugin/manifest.json", fs, sh, "/vault");

		const keys = Object.keys(result.commands);
		expect(keys).toEqual(["plugin:test-plugin:greet"]);
	});

	it("wrapped command calls shell.run with correct cwd", () => {
		const fs = createMockFs({ "/vault/.flowti/plugins/test-plugin/manifest.json": validJson });
		const sh = createMockShell();
		const result = loadPluginFile(testDeps, "/vault/.flowti/plugins/test-plugin/manifest.json", fs, sh, "/vault");

		result.commands["plugin:test-plugin:greet"]({}, [], "plugin:test-plugin:greet");

		expect(sh.calls).toHaveLength(1);
		expect(sh.calls[0].cmd).toBe("echo hello");
		expect(sh.calls[0].opts?.cwd).toBe("/vault");
	});

	it("propagates non-zero exit code from shell.run", () => {
		const fs = createMockFs({ "/vault/.flowti/plugins/test-plugin/manifest.json": validJson });
		const sh = createMockShell({ exitCodes: { "echo hello": 1 } });
		const result = loadPluginFile(testDeps, "/vault/.flowti/plugins/test-plugin/manifest.json", fs, sh, "/vault");

		// Save original and capture process.exitCode
		const origExitCode = process.exitCode;
		result.commands["plugin:test-plugin:greet"]({}, [], "plugin:test-plugin:greet");

		expect(process.exitCode).toBe(1);

		// Restore
		process.exitCode = origExitCode;
	});

	it("does not set exit code on success", () => {
		const fs = createMockFs({ "/vault/.flowti/plugins/test-plugin/manifest.json": validJson });
		const sh = createMockShell(); // exit code 0 by default
		const result = loadPluginFile(testDeps, "/vault/.flowti/plugins/test-plugin/manifest.json", fs, sh, "/vault");

		const origExitCode = process.exitCode;
		process.exitCode = undefined;
		result.commands["plugin:test-plugin:greet"]({}, [], "plugin:test-plugin:greet");

		expect(process.exitCode).toBeUndefined();
		process.exitCode = origExitCode;
	});
});

// ── loadPlugins ─────────────────────────────────────────────────────

describe("loadPlugins", () => {
	it("returns empty array when no plugins directory", () => {
		const fs = createMockFs({});
		const sh = createMockShell();
		expect(loadPlugins(testDeps, "/vault", fs, sh)).toEqual([]);
	});

	it("loads all plugins from the vault plugins directory", () => {
		const plugin1 = JSON.stringify({
			name: "alpha",
			description: "Alpha plugin",
			commands: { run: { description: "Run alpha", run: "alpha run" } },
		});
		const plugin2 = JSON.stringify({
			name: "beta",
			description: "Beta plugin",
			commands: { run: { description: "Run beta", run: "beta run" } },
		});
		const fs = createMockFs({
			"/vault/.flowti/plugins/alpha/manifest.json": plugin1,
			"/vault/.flowti/plugins/beta/manifest.json": plugin2,
		});
		const sh = createMockShell();
		const result = loadPlugins(testDeps, "/vault", fs, sh);

		expect(result).toHaveLength(2);
		expect(result[0].valid).toBe(true);
		expect(result[1].valid).toBe(true);
	});
});

// ── scaffoldPlugin ──────────────────────────────────────────────────

describe("scaffoldPlugin", () => {
	it("creates a new plugin directory with manifest.json", () => {
		const fs = createMockFs({});
		const result = scaffoldPlugin(testDeps, "/vault", "my-plugin", "A test plugin", fs);

		expect("path" in result).toBe(true);
		if ("path" in result) {
			expect(result.path).toContain("my-plugin");
		}
		expect(fs.existsSync("/vault/.flowti/plugins/my-plugin/manifest.json")).toBe(true);

		const manifest = JSON.parse(fs.readFileSync("/vault/.flowti/plugins/my-plugin/manifest.json", "utf-8"));
		expect(manifest.name).toBe("my-plugin");
		expect(manifest.description).toBe("A test plugin");
		expect(manifest.commands.hello).toBeDefined();
	});

	it("rejects invalid plugin names", () => {
		const fs = createMockFs({});
		const result = scaffoldPlugin(testDeps, "/vault", "My Plugin!", "bad", fs);
		expect("error" in result).toBe(true);
	});

	it("rejects duplicate plugin names", () => {
		const fs = createMockFs({
			"/vault/.flowti/plugins/existing/manifest.json": "{}",
		});
		const result = scaffoldPlugin(testDeps, "/vault", "existing", "dup", fs);
		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toContain("already exists");
		}
	});
});

// ── detectCollisions ────────────────────────────────────────────────

describe("detectCollisions", () => {
	function makePlugin(name: string, cmdKeys: string[]): LoadedPlugin {
		const commands: Record<string, () => void> = {};
		const manifestCommands: Record<string, { description: string; run: string }> = {};
		for (const key of cmdKeys) {
			commands[key] = () => {};
			const cmdName = key.replace(`plugin:${name}:`, "");
			manifestCommands[cmdName] = { description: "test", run: "echo" };
		}
		return {
			manifest: { name, description: "test", commands: manifestCommands },
			path: `/plugins/${name}/manifest.json`,
			commands,
			valid: true,
			errors: [],
		};
	}

	it("detects collision with built-in commands", () => {
		const plugins = [makePlugin("bad", ["build"])];
		const builtins = new Set(["build", "help"]);
		const collisions = detectCollisions(plugins, builtins);

		expect(collisions).toHaveLength(1);
		expect(collisions[0]).toContain("collides with a built-in");
	});

	it("detects duplicate plugin commands across plugins", () => {
		const plugins = [
			makePlugin("a", ["plugin:a:deploy"]),
			makePlugin("b", ["plugin:a:deploy"]),
		];
		const collisions = detectCollisions(plugins, new Set());

		expect(collisions).toHaveLength(1);
		expect(collisions[0]).toContain("Duplicate");
	});

	it("returns empty for valid non-colliding plugins", () => {
		const plugins = [
			makePlugin("a", ["plugin:a:deploy"]),
			makePlugin("b", ["plugin:b:test"]),
		];
		const collisions = detectCollisions(plugins, new Set(["build"]));

		expect(collisions).toHaveLength(0);
	});

	it("skips invalid plugins", () => {
		const plugin = makePlugin("bad", ["build"]);
		plugin.valid = false;
		const collisions = detectCollisions([plugin], new Set(["build"]));

		expect(collisions).toHaveLength(0);
	});
});
