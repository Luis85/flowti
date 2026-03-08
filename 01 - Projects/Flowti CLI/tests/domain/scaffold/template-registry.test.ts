import { describe, it, expect } from "vitest";
import { createTemplateRegistry, registerAll } from "../../../src/domain/scaffold/templates/template-registry.js";
import type { TemplateFn } from "../../../src/domain/scaffold/scaffold-types.js";

const stubTemplate: TemplateFn = (vars) => `Hello ${vars.name}`;

describe("TemplateRegistry", () => {
	it("starts empty", () => {
		const reg = createTemplateRegistry();
		expect(reg.ids()).toEqual([]);
	});

	it("registers and resolves a template", () => {
		const reg = createTemplateRegistry();
		reg.register("test", stubTemplate);
		expect(reg.has("test")).toBe(true);
		expect(reg.resolve("test")).toBe(stubTemplate);
	});

	it("returns undefined for unknown id", () => {
		const reg = createTemplateRegistry();
		expect(reg.resolve("unknown")).toBeUndefined();
		expect(reg.has("unknown")).toBe(false);
	});

	it("lists registered ids", () => {
		const reg = createTemplateRegistry();
		reg.register("a", stubTemplate);
		reg.register("b", stubTemplate);
		expect(reg.ids()).toEqual(["a", "b"]);
	});

	it("overwrites existing id", () => {
		const reg = createTemplateRegistry();
		const other: TemplateFn = () => "other";
		reg.register("test", stubTemplate);
		reg.register("test", other);
		expect(reg.resolve("test")).toBe(other);
	});
});

describe("registerAll", () => {
	it("registers multiple templates at once", () => {
		const reg = createTemplateRegistry();
		registerAll(reg, { x: stubTemplate, y: stubTemplate });
		expect(reg.ids()).toEqual(["x", "y"]);
	});
});
