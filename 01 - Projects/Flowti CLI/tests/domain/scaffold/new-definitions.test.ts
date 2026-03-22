import { describe, it, expect } from "vitest";
import { validateDefinition } from "../../../src/domain/scaffold/scaffold-schema.js";
import { createTemplateRegistry, registerAll } from "../../../src/domain/scaffold/templates/template-registry.js";
import { sharedTemplates } from "../../../src/domain/scaffold/templates/shared-templates.js";
import { projectTemplates } from "../../../src/domain/scaffold/templates/project-templates.js";
import { bareTemplates } from "../../../src/domain/scaffold/templates/bare-templates.js";
import { cliTemplates } from "../../../src/domain/scaffold/templates/cli-templates.js";
import { pluginTemplates } from "../../../src/domain/scaffold/templates/plugin-templates.js";
import type { ScaffoldDefinition, ScaffoldVariables } from "../../../src/domain/scaffold/scaffold-types.js";

import flowtiBareDef from "../../../src/domain/scaffold/definitions/flowti-bare.json" with { type: "json" };
import flowtiCliDef from "../../../src/domain/scaffold/definitions/flowti-cli.json" with { type: "json" };
import flowtiPluginDef from "../../../src/domain/scaffold/definitions/flowti-obsidian-plugin.json" with { type: "json" };

// ── Helpers ──────────────────────────────────────────────────────────

const VARS: ScaffoldVariables = {
	name: "Test Project",
	id: "test-project",
	pascal: "TestProject",
	camel: "testProject",
	author: "Test Author",
	date: "2026-03-22",
};

function createDefaultRegistry() {
	const registry = createTemplateRegistry();
	registerAll(registry, sharedTemplates);
	registerAll(registry, projectTemplates);
	registerAll(registry, bareTemplates);
	registerAll(registry, cliTemplates);
	registerAll(registry, pluginTemplates);
	return registry;
}

const DEFINITIONS: { id: string; raw: unknown; def: ScaffoldDefinition }[] = [
	{ id: "flowti-bare", raw: flowtiBareDef, def: flowtiBareDef as unknown as ScaffoldDefinition },
	{ id: "flowti-cli", raw: flowtiCliDef, def: flowtiCliDef as unknown as ScaffoldDefinition },
	{ id: "flowti-obsidian-plugin", raw: flowtiPluginDef, def: flowtiPluginDef as unknown as ScaffoldDefinition },
];

// ── Definition Loading ───────────────────────────────────────────────

describe("new definitions — loading", () => {
	it.each(DEFINITIONS)("$id is a non-null object with required fields", ({ def }) => {
		expect(def).toBeDefined();
		expect(typeof def.id).toBe("string");
		expect(typeof def.label).toBe("string");
		expect(typeof def.description).toBe("string");
		expect(Array.isArray(def.files)).toBe(true);
		expect(Array.isArray(def.directories)).toBe(true);
		expect(Array.isArray(def.nextSteps)).toBe(true);
	});

	it("all three IDs are distinct", () => {
		const ids = DEFINITIONS.map(d => d.id);
		expect(new Set(ids).size).toBe(3);
	});
});

// ── Definition Validation ────────────────────────────────────────────

describe("new definitions — validation", () => {
	it.each(DEFINITIONS)("$id passes validateDefinition with zero errors", ({ raw }) => {
		const errors = validateDefinition(raw);
		expect(errors).toEqual([]);
	});

	it.each(DEFINITIONS)("$id passes validateDefinition with known template IDs", ({ raw }) => {
		const knownIds = createDefaultRegistry().ids();
		const errors = validateDefinition(raw, knownIds);
		expect(errors).toEqual([]);
	});
});

// ── Template Resolution ──────────────────────────────────────────────

describe("new definitions — template resolution", () => {
	const registry = createDefaultRegistry();
	const knownIds = registry.ids();

	it.each(DEFINITIONS)("$id — all templateIds resolve in the default registry", ({ def }) => {
		for (const file of def.files) {
			expect(knownIds).toContain(file.templateId);
			expect(registry.has(file.templateId)).toBe(true);
			expect(registry.resolve(file.templateId)).toBeTypeOf("function");
		}
	});

	it("bare definition uses bare-specific templates", () => {
		const bareIds = flowtiBareDef.files.map(f => f.templateId);
		expect(bareIds).toContain("bare-index");
		expect(bareIds).toContain("bare-index-test");
	});

	it("cli definition uses cli-specific templates", () => {
		const cliIds = flowtiCliDef.files.map(f => f.templateId);
		expect(cliIds).toContain("cli-main");
		expect(cliIds).toContain("cli-main-test");
	});

	it("plugin definition uses plugin-specific templates", () => {
		const pluginIds = flowtiPluginDef.files.map(f => f.templateId);
		expect(pluginIds).toContain("plugin-tsconfig");
		expect(pluginIds).toContain("plugin-esbuild-config");
		expect(pluginIds).toContain("plugin-manifest");
		expect(pluginIds).toContain("plugin-styles");
		expect(pluginIds).toContain("plugin-main");
		expect(pluginIds).toContain("plugin-main-test");
	});
});

// ── Dry Run ──────────────────────────────────────────────────────────

describe("new definitions — dry run", () => {
	const registry = createDefaultRegistry();

	function dryRun(def: ScaffoldDefinition): string[] {
		const files: string[] = [];
		for (const file of def.files) {
			const fn = registry.resolve(file.templateId);
			expect(fn).toBeDefined();
			const content = fn!(VARS, def);
			expect(typeof content).toBe("string");
			expect(content.length).toBeGreaterThan(0);
			files.push(file.path);
		}
		return files;
	}

	it("flowti-bare produces all expected files", () => {
		const files = dryRun(flowtiBareDef as unknown as ScaffoldDefinition);
		expect(files).toContain("package.json");
		expect(files).toContain("configs/tsconfig.json");
		expect(files).toContain("configs/vitest.config.ts");
		expect(files).toContain("src/index.ts");
		expect(files).toContain("tests/index.test.ts");
		expect(files).toContain(".gitignore");
		expect(files).toContain("README.md");
		expect(files).toHaveLength(10);
	});

	it("flowti-cli produces all expected files", () => {
		const files = dryRun(flowtiCliDef as unknown as ScaffoldDefinition);
		expect(files).toContain("package.json");
		expect(files).toContain("configs/esbuild.config.mjs");
		expect(files).toContain("src/main.ts");
		expect(files).toContain("tests/main.test.ts");
		expect(files).toContain("README.md");
		expect(files).toHaveLength(11);
	});

	it("flowti-obsidian-plugin produces all expected files", () => {
		const files = dryRun(flowtiPluginDef as unknown as ScaffoldDefinition);
		expect(files).toContain("package.json");
		expect(files).toContain("manifest.json");
		expect(files).toContain("styles.css");
		expect(files).toContain("src/main.ts");
		expect(files).toContain("tests/main.test.ts");
		expect(files).toContain("configs/esbuild.config.mjs");
		expect(files).toContain("README.md");
		expect(files).toHaveLength(13);
	});

	it.each(DEFINITIONS)("$id — no duplicate file paths", ({ def }) => {
		const paths = def.files.map(f => f.path);
		expect(new Set(paths).size).toBe(paths.length);
	});
});

// ── Template Output ──────────────────────────────────────────────────

describe("bareTemplates output", () => {
	const DEF = flowtiBareDef as unknown as ScaffoldDefinition;

	it("bare-index contains project name", () => {
		const content = bareTemplates["bare-index"](VARS, DEF);
		expect(content).toContain("Test Project");
	});

	it("bare-index contains greet function", () => {
		const content = bareTemplates["bare-index"](VARS, DEF);
		expect(content).toContain("export function greet");
	});

	it("bare-index-test contains vitest imports", () => {
		const content = bareTemplates["bare-index-test"](VARS, DEF);
		expect(content).toContain("import { describe, it, expect }");
	});

	it("bare-index-test contains describe block with project name", () => {
		const content = bareTemplates["bare-index-test"](VARS, DEF);
		expect(content).toContain('describe("Test Project"');
	});
});

describe("cliTemplates output", () => {
	const DEF = flowtiCliDef as unknown as ScaffoldDefinition;

	it("cli-main contains project name", () => {
		const content = cliTemplates["cli-main"](VARS, DEF);
		expect(content).toContain("Test Project");
	});

	it("cli-main contains parseArgs function", () => {
		const content = cliTemplates["cli-main"](VARS, DEF);
		expect(content).toContain("function parseArgs");
	});

	it("cli-main contains --help and --version handling", () => {
		const content = cliTemplates["cli-main"](VARS, DEF);
		expect(content).toContain("--help");
		expect(content).toContain("--version");
	});

	it("cli-main contains main() call", () => {
		const content = cliTemplates["cli-main"](VARS, DEF);
		expect(content).toContain("main()");
	});

	it("cli-main uses kebab-case ID in usage line", () => {
		const content = cliTemplates["cli-main"](VARS, DEF);
		expect(content).toContain("test-project");
	});

	it("cli-main-test contains vitest imports", () => {
		const content = cliTemplates["cli-main-test"](VARS, DEF);
		expect(content).toContain("import { describe, it, expect }");
	});

	it("cli-main-test references project ID", () => {
		const content = cliTemplates["cli-main-test"](VARS, DEF);
		expect(content).toContain("test-project");
	});
});

describe("pluginTemplates output", () => {
	const DEF = flowtiPluginDef as unknown as ScaffoldDefinition;

	it("plugin-main contains Plugin class with PascalCase name", () => {
		const content = pluginTemplates["plugin-main"](VARS, DEF);
		expect(content).toContain("class TestProjectPlugin");
		expect(content).toContain('import { Plugin } from "obsidian"');
	});

	it("plugin-main contains onload and onunload methods", () => {
		const content = pluginTemplates["plugin-main"](VARS, DEF);
		expect(content).toContain("onload()");
		expect(content).toContain("onunload()");
	});

	it("plugin-manifest produces valid JSON with plugin metadata", () => {
		const content = pluginTemplates["plugin-manifest"](VARS, DEF);
		const parsed = JSON.parse(content);
		expect(parsed.id).toBe("test-project");
		expect(parsed.name).toBe("Test Project");
		expect(parsed.version).toBe("0.0.1");
		expect(parsed.minAppVersion).toBe("1.5.0");
		expect(parsed.author).toBe("Test Author");
	});

	it("plugin-tsconfig targets ES2022 with bundler resolution", () => {
		const content = pluginTemplates["plugin-tsconfig"](VARS, DEF);
		const parsed = JSON.parse(content);
		expect(parsed.compilerOptions.target).toBe("ES2022");
		expect(parsed.compilerOptions.moduleResolution).toBe("bundler");
	});

	it("plugin-esbuild-config uses CJS format and externalizes obsidian", () => {
		const content = pluginTemplates["plugin-esbuild-config"](VARS, DEF);
		expect(content).toContain('"cjs"');
		expect(content).toContain('"obsidian"');
		expect(content).toContain("builtins");
	});

	it("plugin-esbuild-config contains project name in comment", () => {
		const content = pluginTemplates["plugin-esbuild-config"](VARS, DEF);
		expect(content).toContain("Test Project");
	});

	it("plugin-styles contains project name comment", () => {
		const content = pluginTemplates["plugin-styles"](VARS, DEF);
		expect(content).toContain("Test Project");
	});

	it("plugin-main-test contains vitest imports and project ID", () => {
		const content = pluginTemplates["plugin-main-test"](VARS, DEF);
		expect(content).toContain("import { describe, it, expect }");
		expect(content).toContain("test-project");
	});
});
