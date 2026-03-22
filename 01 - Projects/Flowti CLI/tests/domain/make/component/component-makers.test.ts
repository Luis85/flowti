import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ComponentDefinition, ComponentVariables, ComponentTemplateDeps } from "../../../../src/domain/make/component/component-types.js";

const mockDeps: ComponentTemplateDeps = {
	clock: { iso: () => "2026-01-01T00:00:00.000Z", ms: () => 0, now: () => new Date("2026-01-01"), safeIso: () => "2026-01-01T00-00-00" },
};

beforeEach(() => {
	vi.clearAllMocks();
});

// ── Template property rendering ─────────────────────────────────────

describe("componentDocTemplate property frontmatter", () => {
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
			actions: [],
			variants: [],
			states: [],
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

		const result = componentDocTemplate(vars, def, mockDeps).toString();

		expect(result).toContain("variant: primary");
		expect(result).toContain("disabled: false");
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
			actions: [],
			variants: [],
			states: [],
			nextSteps: [],
		};

		const vars: ComponentVariables = {
			name: "Empty",
			kebab: "empty",
			pascal: "Empty",
			camel: "empty",
			"prop.priority": "",
		};

		const result = componentDocTemplate(vars, def, mockDeps).toString();
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

		const result = componentDocTemplate(vars, def, mockDeps).toString();
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
			actions: [],
			variants: [],
			states: [],
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

		const result = c4DocTemplate(vars, def, mockDeps).toString();
		expect(result).toContain("region: eu-west");
	});
});
