import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-03-09" },
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
	},
}));

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: { mkdirSync: vi.fn(), writeFileSync: vi.fn() },
}));

import { generatePluginReference } from "../../../src/domain/plugins/plugin-reference.js";
import type { LoadedPlugin } from "../../../src/domain/plugins/plugin-types.js";

beforeEach(() => vi.clearAllMocks());

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

// ── Tests ────────────────────────────────────────────────────────────

describe("generatePluginReference", () => {
	it("returns empty totals for empty plugins list", () => {
		const doc = generatePluginReference([]);
		const output = doc.toString();

		expect(output).toContain("total_plugins: 0");
		expect(output).toContain("valid_plugins: 0");
		expect(output).toContain("total_commands: 0");
		expect(output).not.toContain("## Plugins");
		expect(output).not.toContain("## Invalid Plugins");
	});

	it("renders a single valid plugin with commands", () => {
		const plugin = makePlugin();
		const doc = generatePluginReference([plugin]);
		const output = doc.toString();

		expect(output).toContain("total_plugins: 1");
		expect(output).toContain("valid_plugins: 1");
		expect(output).toContain("total_commands: 1");
		expect(output).toContain("## Plugins");
		expect(output).toContain("| test-plugin | 1.0.0 | A test plugin | 1 |");
		expect(output).toContain("### test-plugin");
		expect(output).toContain("| deploy | Deploy app |");
	});

	it("renders a valid plugin without commands (no command table)", () => {
		const plugin = makePlugin({
			manifest: {
				name: "empty-plugin",
				description: "No commands here",
				version: "0.1.0",
				commands: {},
			},
			commands: {},
		});
		const doc = generatePluginReference([plugin]);
		const output = doc.toString();

		expect(output).toContain("### empty-plugin");
		expect(output).toContain("No commands here");
		expect(output).toContain("total_commands: 0");
		// No command table header row
		expect(output).not.toContain("| Command | Description | Run |");
	});

	it("renders invalid plugins in a warning callout", () => {
		const plugin = makePlugin({
			manifest: {
				name: "broken-plugin",
				description: "Broken",
				commands: {},
			},
			valid: false,
			errors: ["Missing run field", "Bad name format"],
		});
		const doc = generatePluginReference([plugin]);
		const output = doc.toString();

		expect(output).toContain("## Invalid Plugins");
		expect(output).toContain("[!warning]");
		expect(output).toContain("**broken-plugin**: Missing run field, Bad name format");
		expect(output).not.toContain("## Plugins");
	});

	it("renders both sections for a mix of valid and invalid plugins", () => {
		const valid = makePlugin();
		const invalid = makePlugin({
			manifest: {
				name: "bad-plugin",
				description: "Bad",
				commands: {},
			},
			valid: false,
			errors: ["Invalid manifest"],
		});
		const doc = generatePluginReference([valid, invalid]);
		const output = doc.toString();

		expect(output).toContain("total_plugins: 2");
		expect(output).toContain("valid_plugins: 1");
		expect(output).toContain("## Plugins");
		expect(output).toContain("## Invalid Plugins");
		expect(output).toContain("Valid: 1");
		expect(output).toContain("**bad-plugin**: Invalid manifest");
	});

	it("frontmatter has correct total_commands count across plugins", () => {
		const plugin1 = makePlugin({
			manifest: {
				name: "alpha",
				description: "Alpha",
				version: "1.0.0",
				commands: {
					build: { description: "Build", run: "npm build" },
					test: { description: "Test", run: "npm test" },
				},
			},
			commands: {
				"plugin:alpha:build": () => {},
				"plugin:alpha:test": () => {},
			},
		});
		const plugin2 = makePlugin({
			manifest: {
				name: "beta",
				description: "Beta",
				version: "2.0.0",
				commands: {
					deploy: { description: "Deploy", run: "npm deploy" },
				},
			},
			commands: { "plugin:beta:deploy": () => {} },
		});
		const doc = generatePluginReference([plugin1, plugin2]);
		const output = doc.toString();

		expect(output).toContain("total_commands: 3");
	});
});
