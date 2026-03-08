import { describe, it, expect } from "vitest";
import { buildScaffoldPlan, interpolate, resolveNextSteps } from "../../../src/domain/scaffold/scaffold-plan.js";
import { createTemplateRegistry } from "../../../src/domain/scaffold/templates/template-registry.js";
import type { ScaffoldDefinition, ScaffoldContext, ScaffoldVariables, TemplateFn } from "../../../src/domain/scaffold/scaffold-types.js";

// ── Test helpers ─────────────────────────────────────────────────────

const STUB_VARS: ScaffoldVariables = {
	name: "My Tool",
	id: "my-tool",
	pascal: "MyTool",
	camel: "myTool",
	author: "Test Author",
};

function createStubDef(overrides?: Partial<ScaffoldDefinition>): ScaffoldDefinition {
	return {
		id: "test",
		label: "Test",
		description: "A test scaffold.",
		prompts: [],
		package: {
			type: "module",
			scripts: { build: "tsc" },
			devDependencies: { typescript: "^5.0.0" },
		},
		flowtiConfig: {},
		directories: [],
		files: [],
		nextSteps: [],
		...overrides,
	};
}

// ── interpolate ──────────────────────────────────────────────────────

describe("interpolate", () => {
	it("replaces single variable", () => {
		expect(interpolate("Hello {{name}}", { name: "World" })).toBe("Hello World");
	});

	it("replaces multiple variables", () => {
		expect(interpolate("{{a}}-{{b}}", { a: "x", b: "y" })).toBe("x-y");
	});

	it("replaces unknown variables with empty string", () => {
		expect(interpolate("Hello {{unknown}}", {})).toBe("Hello ");
	});

	it("leaves strings without placeholders unchanged", () => {
		expect(interpolate("no placeholders", {})).toBe("no placeholders");
	});

	it("handles path-like strings", () => {
		expect(interpolate("src/{{id}}/main.ts", { id: "my-tool" })).toBe("src/my-tool/main.ts");
	});
});

// ── buildScaffoldPlan ────────────────────────────────────────────────

describe("buildScaffoldPlan", () => {
	it("resolves file mappings through the registry", () => {
		const reg = createTemplateRegistry();
		const fn: TemplateFn = (vars) => `// ${vars.name}`;
		reg.register("main", fn);

		const def = createStubDef({
			files: [{ path: "src/main.ts", templateId: "main" }],
		});
		const ctx: ScaffoldContext = { vars: STUB_VARS, outputPath: "/out", definition: def };

		const plan = buildScaffoldPlan(ctx, reg);
		expect(plan).toHaveLength(1);
		expect(plan[0].path).toBe("src/main.ts");
		expect(plan[0].content).toBe("// My Tool");
	});

	it("interpolates variables in file paths", () => {
		const reg = createTemplateRegistry();
		reg.register("t", () => "content");

		const def = createStubDef({
			files: [{ path: "src/{{id}}/main.ts", templateId: "t" }],
		});
		const ctx: ScaffoldContext = { vars: STUB_VARS, outputPath: "/out", definition: def };

		const plan = buildScaffoldPlan(ctx, reg);
		expect(plan[0].path).toBe("src/my-tool/main.ts");
	});

	it("adds .gitkeep for empty declared directories", () => {
		const reg = createTemplateRegistry();

		const def = createStubDef({ directories: ["docs", "src"] });
		const ctx: ScaffoldContext = { vars: STUB_VARS, outputPath: "/out", definition: def };

		const plan = buildScaffoldPlan(ctx, reg);
		expect(plan).toHaveLength(2);
		expect(plan.map(f => f.path)).toContain("docs/.gitkeep");
		expect(plan.map(f => f.path)).toContain("src/.gitkeep");
	});

	it("skips .gitkeep for directories that have files", () => {
		const reg = createTemplateRegistry();
		reg.register("t", () => "content");

		const def = createStubDef({
			directories: ["src"],
			files: [{ path: "src/main.ts", templateId: "t" }],
		});
		const ctx: ScaffoldContext = { vars: STUB_VARS, outputPath: "/out", definition: def };

		const plan = buildScaffoldPlan(ctx, reg);
		const paths = plan.map(f => f.path);
		expect(paths).toContain("src/main.ts");
		expect(paths).not.toContain("src/.gitkeep");
	});

	it("throws on unknown templateId", () => {
		const reg = createTemplateRegistry();
		const def = createStubDef({
			files: [{ path: "x.ts", templateId: "unknown" }],
		});
		const ctx: ScaffoldContext = { vars: STUB_VARS, outputPath: "/out", definition: def };

		expect(() => buildScaffoldPlan(ctx, reg)).toThrow("unknown");
	});

	it("passes definition to template functions", () => {
		const reg = createTemplateRegistry();
		const fn: TemplateFn = (_vars, def) => def.id;
		reg.register("def-id", fn);

		const def = createStubDef({
			files: [{ path: "out.txt", templateId: "def-id" }],
		});
		const ctx: ScaffoldContext = { vars: STUB_VARS, outputPath: "/out", definition: def };

		const plan = buildScaffoldPlan(ctx, reg);
		expect(plan[0].content).toBe("test");
	});
});

// ── resolveNextSteps ─────────────────────────────────────────────────

describe("resolveNextSteps", () => {
	it("interpolates variables in next steps", () => {
		const def = createStubDef({ nextSteps: ["cd {{outputPath}}", "npm install"] });
		const steps = resolveNextSteps(def, { outputPath: "/my/path" });
		expect(steps).toEqual(["cd /my/path", "npm install"]);
	});

	it("returns empty array when no steps", () => {
		const def = createStubDef({ nextSteps: [] });
		expect(resolveNextSteps(def, {})).toEqual([]);
	});
});
