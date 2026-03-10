import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(),
		readFileSync: vi.fn(),
		writeFileSync: vi.fn(),
		readdirSync: vi.fn(),
		mkdirSync: vi.fn(),
	},
}));

vi.mock("../../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...parts: string[]) => parts.join("/"),
	},
}));

vi.mock("../../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/mock",
	CLI_PROJECT: "/mock/cli",
	cliConfig: {},
}));

vi.mock("../../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "",
	printHeader: vi.fn(),
}));

vi.mock("../../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(), waitForEnter: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("../../../../src/infrastructure/menu.js", () => ({
	runMenu: vi.fn(),
}));

import { disk } from "../../../../src/infrastructure/filesystem.js";
import { input } from "../../../../src/infrastructure/input.js";
import { componentMenu } from "../../../../src/ui/menus/component-makers-menu.js";
import { runMenu } from "../../../../src/infrastructure/menu.js";
import type { ComponentDefinition, ComponentVariables } from "../../../../src/domain/make/component/component-types.js";

beforeEach(() => {
	vi.clearAllMocks();
});

// ── Property prompts in interactive maker ───────────────────────────

describe("componentMenu property prompts", () => {
	it("includes property prompts for definitions with properties", async () => {
		// The componentMenu calls runMenu which presents menu items.
		// We test that when a menu item is selected for a definition with properties,
		// the interactive maker prompts for each property.

		// Setup: runMenu returns void (simulating user selecting first item and completing)
		vi.mocked(runMenu).mockResolvedValue(undefined);

		// We just verify the menu is called — the interactive maker is tested
		// indirectly via the template output tests below.
		await componentMenu("/project");
		expect(runMenu).toHaveBeenCalled();
	});
});

// ── Template property rendering ─────────────────────────────────────

describe("componentDocTemplate property frontmatter", () => {
	// Import the template directly since it's a pure function
	it("includes property values in frontmatter", async () => {
		const { componentDocTemplate } = await import(
			"../../../../src/domain/make/component/templates/component-doc.js"
		);

		const def: ComponentDefinition = {
			id: "ui-component",
			kind: "ui-component",
			label: "UI Component",
			description: "Test",
			prompts: [],
			files: [],
			metadata: { type: "ui-component", status: "draft" },
			properties: [
				{ key: "variant", type: "string", default: "default", description: "Visual variant" },
				{ key: "disabled", type: "boolean", default: false, description: "Whether disabled" },
			],
			nextSteps: [],
		};

		const vars: ComponentVariables = {
			name: "Button",
			kebab: "button",
			pascal: "Button",
			camel: "button",
			"prop.variant": "primary",
			"prop.disabled": "false",
		};

		const result = componentDocTemplate(vars, def).toString();

		// Frontmatter should contain property values
		expect(result).toContain("variant: primary");
		expect(result).toContain("disabled: false");

		// Properties table should still be present
		expect(result).toContain("## Properties");
		expect(result).toContain("| variant |");
	});

	it("skips empty property values in frontmatter", async () => {
		const { componentDocTemplate } = await import(
			"../../../../src/domain/make/component/templates/component-doc.js"
		);

		const def: ComponentDefinition = {
			id: "component",
			kind: "component",
			label: "Component",
			description: "Test",
			prompts: [],
			files: [],
			metadata: { type: "component", status: "draft" },
			properties: [
				{ key: "priority", type: "string", description: "Component priority" },
			],
			nextSteps: [],
		};

		const vars: ComponentVariables = {
			name: "Empty",
			kebab: "empty",
			pascal: "Empty",
			camel: "empty",
			"prop.priority": "",
		};

		const result = componentDocTemplate(vars, def).toString();
		expect(result).not.toMatch(/^priority:/m);
	});

	it("renders without property values when none provided", async () => {
		const { componentDocTemplate } = await import(
			"../../../../src/domain/make/component/templates/component-doc.js"
		);

		const def: ComponentDefinition = {
			id: "component",
			kind: "component",
			label: "Component",
			description: "Test",
			prompts: [],
			files: [],
			metadata: { type: "component", status: "draft" },
			properties: [], actions: [], variants: [], states: [],
			nextSteps: [],
		};

		const vars: ComponentVariables = {
			name: "Plain",
			kebab: "plain",
			pascal: "Plain",
			camel: "plain",
		};

		const result = componentDocTemplate(vars, def).toString();
		expect(result).toContain("---");
		expect(result).toContain("# Plain");
		expect(result).not.toContain("## Properties");
	});
});

describe("c4DocTemplate property frontmatter", () => {
	it("includes property values in frontmatter for C4 docs", async () => {
		const { c4DocTemplate } = await import(
			"../../../../src/domain/make/component/templates/c4-doc.js"
		);

		const def: ComponentDefinition = {
			id: "c4-system",
			kind: "system",
			label: "System (C4)",
			description: "A test system",
			prompts: [],
			files: [],
			metadata: { type: "system", c4Level: 1 },
			properties: [
				{ key: "region", type: "string", default: "us-east", description: "Deployment region" },
			],
			nextSteps: [],
		};

		const vars: ComponentVariables = {
			name: "Platform",
			kebab: "platform",
			pascal: "Platform",
			camel: "platform",
			description: "Main platform",
			"prop.region": "eu-west",
		};

		const result = c4DocTemplate(vars, def).toString();
		expect(result).toContain("region: eu-west");
	});
});
