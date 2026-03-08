import { describe, it, expect } from "vitest";
import { validateDefinition, isValidDefinition } from "../../../src/domain/scaffold/scaffold-schema.js";

const VALID_DEF = {
	id: "test-scaffold",
	label: "Test Scaffold",
	description: "A test scaffold.",
	prompts: [],
	package: {
		type: "module",
		scripts: { build: "tsc" },
		devDependencies: { typescript: "^5.0.0" },
	},
	flowtiConfig: {},
	directories: ["src"],
	files: [
		{ path: "src/main.ts", templateId: "project-main" },
	],
	nextSteps: ["npm install"],
};

// ── validateDefinition ───────────────────────────────────────────────

describe("validateDefinition", () => {
	it("returns no errors for a valid definition", () => {
		expect(validateDefinition(VALID_DEF)).toEqual([]);
	});

	it("rejects null", () => {
		const errors = validateDefinition(null);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain("non-null object");
	});

	it("rejects non-object", () => {
		expect(validateDefinition("string")).toHaveLength(1);
	});

	it("requires id field", () => {
		const def = { ...VALID_DEF, id: "" };
		const errors = validateDefinition(def);
		expect(errors.some(e => e.includes('"id"'))).toBe(true);
	});

	it("requires label field", () => {
		const def = { ...VALID_DEF, label: undefined };
		const errors = validateDefinition(def);
		expect(errors.some(e => e.includes('"label"'))).toBe(true);
	});

	it("requires description field", () => {
		const def = { ...VALID_DEF, description: "" };
		const errors = validateDefinition(def);
		expect(errors.some(e => e.includes('"description"'))).toBe(true);
	});

	it("requires package field", () => {
		const def = { ...VALID_DEF, package: undefined };
		const errors = validateDefinition(def);
		expect(errors.some(e => e.includes('"package"'))).toBe(true);
	});

	it("requires package.scripts", () => {
		const def = { ...VALID_DEF, package: { devDependencies: {} } };
		const errors = validateDefinition(def);
		expect(errors.some(e => e.includes("package.scripts"))).toBe(true);
	});

	it("requires package.devDependencies", () => {
		const def = { ...VALID_DEF, package: { scripts: {} } };
		const errors = validateDefinition(def);
		expect(errors.some(e => e.includes("package.devDependencies"))).toBe(true);
	});

	it("requires files array", () => {
		const def = { ...VALID_DEF, files: "not-array" };
		const errors = validateDefinition(def);
		expect(errors.some(e => e.includes('"files"'))).toBe(true);
	});

	it("detects missing file path", () => {
		const def = { ...VALID_DEF, files: [{ templateId: "foo" }] };
		const errors = validateDefinition(def);
		expect(errors.some(e => e.includes("path"))).toBe(true);
	});

	it("detects missing templateId", () => {
		const def = { ...VALID_DEF, files: [{ path: "src/main.ts" }] };
		const errors = validateDefinition(def);
		expect(errors.some(e => e.includes("templateId"))).toBe(true);
	});

	it("detects duplicate file paths", () => {
		const def = {
			...VALID_DEF,
			files: [
				{ path: "src/main.ts", templateId: "a" },
				{ path: "src/main.ts", templateId: "b" },
			],
		};
		const errors = validateDefinition(def);
		expect(errors.some(e => e.includes("duplicate"))).toBe(true);
	});

	it("validates templateIds against known list", () => {
		const errors = validateDefinition(VALID_DEF, ["other-template"]);
		expect(errors.some(e => e.includes("unknown templateId"))).toBe(true);
	});

	it("passes when templateIds are in known list", () => {
		const errors = validateDefinition(VALID_DEF, ["project-main"]);
		expect(errors).toEqual([]);
	});

	it("validates prompt structure", () => {
		const def = { ...VALID_DEF, prompts: [{ label: "test" }] };
		const errors = validateDefinition(def);
		expect(errors.some(e => e.includes("variable"))).toBe(true);
	});

	it("rejects non-array prompts", () => {
		const def = { ...VALID_DEF, prompts: "not-array" };
		const errors = validateDefinition(def);
		expect(errors.some(e => e.includes("prompts"))).toBe(true);
	});

	it("rejects non-array directories", () => {
		const def = { ...VALID_DEF, directories: "not-array" };
		const errors = validateDefinition(def);
		expect(errors.some(e => e.includes("directories"))).toBe(true);
	});

	it("rejects non-array nextSteps", () => {
		const def = { ...VALID_DEF, nextSteps: 42 };
		const errors = validateDefinition(def);
		expect(errors.some(e => e.includes("nextSteps"))).toBe(true);
	});
});

// ── isValidDefinition ────────────────────────────────────────────────

describe("isValidDefinition", () => {
	it("returns true for valid definition", () => {
		expect(isValidDefinition(VALID_DEF)).toBe(true);
	});

	it("returns false for invalid definition", () => {
		expect(isValidDefinition({})).toBe(false);
	});
});
