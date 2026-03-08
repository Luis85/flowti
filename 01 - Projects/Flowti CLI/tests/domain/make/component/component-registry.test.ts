import { describe, it, expect } from "vitest";
import { loadComponentDefinitions, createComponentTemplateRegistry } from "../../../../src/domain/make/component/component-registry.js";

describe("loadComponentDefinitions", () => {
	const definitions = loadComponentDefinitions();

	it("loads all 8 bundled definitions", () => {
		expect(definitions).toHaveLength(8);
	});

	it("includes the generic component", () => {
		const component = definitions.find((d) => d.id === "component");
		expect(component).toBeDefined();
		expect(component!.kind).toBe("component");
		expect(component!.label).toBe("Component - generic");
	});

	it("includes all C4 entity types", () => {
		const ids = definitions.map((d) => d.id);
		expect(ids).toContain("c4-system");
		expect(ids).toContain("c4-container");
		expect(ids).toContain("c4-component");
		expect(ids).toContain("c4-person");
	});

	it("includes the UI building block types", () => {
		const ids = definitions.map((d) => d.id);
		expect(ids).toContain("layout");
		expect(ids).toContain("page");
		expect(ids).toContain("ui-component");
	});

	it("UI building blocks have correct kinds", () => {
		expect(definitions.find((d) => d.id === "layout")!.kind).toBe("layout");
		expect(definitions.find((d) => d.id === "page")!.kind).toBe("page");
		expect(definitions.find((d) => d.id === "ui-component")!.kind).toBe("ui-component");
	});

	it("each definition has required fields", () => {
		for (const def of definitions) {
			expect(def.id).toBeTruthy();
			expect(def.kind).toBeTruthy();
			expect(def.label).toBeTruthy();
			expect(def.description).toBeTruthy();
			expect(Array.isArray(def.prompts)).toBe(true);
			expect(Array.isArray(def.files)).toBe(true);
			expect(def.metadata).toBeDefined();
			expect(Array.isArray(def.properties)).toBe(true);
			expect(Array.isArray(def.nextSteps)).toBe(true);
		}
	});

	it("each definition has at least one file mapping", () => {
		for (const def of definitions) {
			expect(def.files.length).toBeGreaterThan(0);
			for (const f of def.files) {
				expect(f.path).toBeTruthy();
				expect(f.templateId).toBeTruthy();
			}
		}
	});

	it("C4 definitions have c4Level in metadata", () => {
		const c4Defs = definitions.filter((d) => d.id.startsWith("c4-"));
		for (const def of c4Defs) {
			expect(def.metadata.c4Level).toBeDefined();
		}
	});
});

describe("createComponentTemplateRegistry", () => {
	const registry = createComponentTemplateRegistry();

	it("registers all required template functions", () => {
		expect(registry.has("component-doc")).toBe(true);
		expect(registry.has("c4-doc")).toBe(true);
		expect(registry.has("component-test")).toBe(true);
		expect(registry.has("component-definition")).toBe(true);
	});

	it("template functions are callable", () => {
		for (const [, fn] of registry) {
			expect(typeof fn).toBe("function");
		}
	});

	it("all definition file templateIds are resolvable", () => {
		const definitions = loadComponentDefinitions();
		for (const def of definitions) {
			for (const file of def.files) {
				expect(registry.has(file.templateId)).toBe(true);
			}
		}
	});
});
