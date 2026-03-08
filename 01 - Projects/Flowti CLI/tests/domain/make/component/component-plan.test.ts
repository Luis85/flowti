import { describe, it, expect } from "vitest";
import { buildComponentPlan, resolveNextSteps } from "../../../../src/domain/make/component/component-plan.js";
import type { ComponentVariables, ComponentDefinition, ComponentTemplateFn } from "../../../../src/domain/make/component/component-types.js";
import type { ComponentTemplateRegistry } from "../../../../src/domain/make/component/component-plan.js";

function makeDef(overrides: Partial<ComponentDefinition> = {}): ComponentDefinition {
	return {
		id: "test-component",
		kind: "component",
		label: "Test Component",
		description: "A test component.",
		prompts: [],
		files: [
			{ path: "docs/components/{{kebab}}.md", templateId: "doc" },
			{ path: "src/components/{{kebab}}/{{kebab}}.json", templateId: "def" },
		],
		metadata: { type: "component", status: "draft" },
		nextSteps: ["Edit docs/components/{{kebab}}.md"],
		...overrides,
	};
}

function makeVars(overrides: Partial<ComponentVariables> = {}): ComponentVariables {
	return {
		name: "User Profile",
		kebab: "user-profile",
		pascal: "UserProfile",
		camel: "userProfile",
		...overrides,
	};
}

function makeRegistry(fns: Record<string, ComponentTemplateFn>): ComponentTemplateRegistry {
	return new Map(Object.entries(fns));
}

describe("buildComponentPlan", () => {
	it("generates files with interpolated paths", () => {
		const registry = makeRegistry({
			doc: () => "# Doc",
			def: () => "{}",
		});
		const plan = buildComponentPlan(makeVars(), makeDef(), registry);

		expect(plan).toHaveLength(2);
		expect(plan[0].path).toBe("docs/components/user-profile.md");
		expect(plan[0].content).toBe("# Doc");
		expect(plan[1].path).toBe("src/components/user-profile/user-profile.json");
	});

	it("passes vars and def to template functions", () => {
		const vars = makeVars({ name: "Auth Service" });
		const def = makeDef({ kind: "c4-component" });
		const registry = makeRegistry({
			doc: (v, d) => `${v.name}|${d.kind}`,
			def: () => "{}",
		});
		const plan = buildComponentPlan(vars, def, registry);
		expect(plan[0].content).toBe("Auth Service|c4-component");
	});

	it("throws for unknown template ID", () => {
		const def = makeDef({
			files: [{ path: "test.md", templateId: "nonexistent" }],
		});
		const registry = makeRegistry({});
		expect(() => buildComponentPlan(makeVars(), def, registry)).toThrow("Unknown component template");
	});

	it("handles extra variables in path interpolation", () => {
		const def = makeDef({
			files: [{ path: "{{pascal}}/{{kebab}}.ts", templateId: "doc" }],
		});
		const registry = makeRegistry({ doc: () => "" });
		const plan = buildComponentPlan(makeVars(), def, registry);
		expect(plan[0].path).toBe("UserProfile/user-profile.ts");
	});
});

describe("resolveNextSteps", () => {
	it("interpolates variables in next steps", () => {
		const def = makeDef({ nextSteps: ["Edit {{kebab}}.md", "Run tests for {{pascal}}"] });
		const steps = resolveNextSteps(def, makeVars());
		expect(steps).toEqual(["Edit user-profile.md", "Run tests for UserProfile"]);
	});

	it("returns empty array when no next steps", () => {
		const def = makeDef({ nextSteps: [] });
		expect(resolveNextSteps(def, makeVars())).toEqual([]);
	});
});
