import { describe, it, expect } from "vitest";
import { componentDocTemplate } from "../../../../src/domain/make/component/templates/component-doc.js";
import { c4DocTemplate } from "../../../../src/domain/make/component/templates/c4-doc.js";
import { componentTestTemplate } from "../../../../src/domain/make/component/templates/component-test.js";
import { componentDefinitionTemplate } from "../../../../src/domain/make/component/templates/component-definition.js";
import type { ComponentVariables, ComponentDefinition } from "../../../../src/domain/make/component/component-types.js";

function vars(overrides: Partial<ComponentVariables> = {}): ComponentVariables {
	return { name: "Auth Service", kebab: "auth-service", pascal: "AuthService", camel: "authService", ...overrides };
}

function def(overrides: Partial<ComponentDefinition> = {}): ComponentDefinition {
	return {
		id: "component", kind: "component", label: "Component", description: "Test.",
		prompts: [], files: [], metadata: { type: "component", status: "draft" }, nextSteps: [],
		...overrides,
	};
}

describe("componentDocTemplate", () => {
	it("generates valid YAML frontmatter", () => {
		const output = componentDocTemplate(vars(), def());
		expect(output).toMatch(/^---\n/);
		expect(output).toContain("type: component");
		expect(output).toContain("status: draft");
		expect(output).toContain("created:");
	});

	it("includes the component name as heading", () => {
		const output = componentDocTemplate(vars(), def());
		expect(output).toContain("# Auth Service");
	});

	it("includes description when provided", () => {
		const output = componentDocTemplate(vars({ description: "Handles authentication." }), def());
		expect(output).toContain("Handles authentication.");
	});

	it("includes owner when provided", () => {
		const output = componentDocTemplate(vars({ owner: "Platform Team" }), def());
		expect(output).toContain("owner: Platform Team");
	});
});

describe("c4DocTemplate", () => {
	it("generates C4 System doc with boundaries section", () => {
		const output = c4DocTemplate(vars(), def({ kind: "system", metadata: { type: "system", c4Level: 1 } }));
		expect(output).toContain("c4: System");
		expect(output).toContain("c4Level: 1");
		expect(output).toContain("## Boundaries");
		expect(output).toContain("## Containers");
	});

	it("generates C4 Container doc with components section", () => {
		const output = c4DocTemplate(
			vars({ technology: "Node.js", containedBy: "payment-system" }),
			def({ kind: "container", metadata: { type: "container", c4Level: 2 } }),
		);
		expect(output).toContain("c4: Container");
		expect(output).toContain("technology: Node.js");
		expect(output).toContain("containedBy: payment-system");
		expect(output).toContain("## Components");
	});

	it("generates C4 Component doc with responsibilities section", () => {
		const output = c4DocTemplate(vars(), def({ kind: "c4-component", metadata: { type: "c4-component", c4Level: 3 } }));
		expect(output).toContain("c4: Component");
		expect(output).toContain("## Responsibilities");
	});

	it("generates C4 Person doc with role section", () => {
		const output = c4DocTemplate(vars(), def({ kind: "person", metadata: { type: "person", c4Level: 0 } }));
		expect(output).toContain("c4: Person");
		expect(output).toContain("## Role");
		expect(output).toContain("## Interactions");
	});
});

describe("componentTestTemplate", () => {
	it("generates a valid test file", () => {
		const output = componentTestTemplate(vars(), def());
		expect(output).toContain('describe("Auth Service"');
		expect(output).toContain("import(");
		expect(output).toContain("auth-service/auth-service.json");
	});
});

describe("componentDefinitionTemplate", () => {
	it("generates valid JSON with name and id", () => {
		const output = componentDefinitionTemplate(vars(), def());
		const parsed = JSON.parse(output);
		expect(parsed.name).toBe("Auth Service");
		expect(parsed.id).toBe("auth-service");
		expect(parsed.type).toBe("component");
		expect(parsed.status).toBe("draft");
	});

	it("includes extra variables when provided", () => {
		const output = componentDefinitionTemplate(
			vars({ description: "Authenticates users", technology: "JWT", owner: "Security" }),
			def({ metadata: { type: "c4-component", c4Level: 3 } }),
		);
		const parsed = JSON.parse(output);
		expect(parsed.description).toBe("Authenticates users");
		expect(parsed.technology).toBe("JWT");
		expect(parsed.owner).toBe("Security");
	});
});
