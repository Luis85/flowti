import { describe, it, expect } from "vitest";
import { mainTemplate, mainTestTemplate, projectTemplates } from "../../../src/domain/scaffold/templates/project-templates.js";
import type { ScaffoldDefinition, ScaffoldVariables } from "../../../src/domain/scaffold/scaffold-types.js";

const VARS: ScaffoldVariables = {
	name: "My Tool",
	id: "my-tool",
	pascal: "MyTool",
	camel: "myTool",
	author: "Author",
	date: "2026-03-22",
};

const DEF: ScaffoldDefinition = {
	id: "test",
	label: "Test",
	description: "Test scaffold.",
	prompts: [],
	package: { scripts: {}, devDependencies: {} },
	flowtiConfig: {},
	directories: [],
	files: [],
	nextSteps: [],
};

describe("mainTemplate", () => {
	it("includes project name", () => {
		const result = mainTemplate(VARS, DEF);
		expect(result).toContain("My Tool");
	});

	it("includes help flag handling", () => {
		const result = mainTemplate(VARS, DEF);
		expect(result).toContain("--help");
	});

	it("includes version flag handling", () => {
		const result = mainTemplate(VARS, DEF);
		expect(result).toContain("--version");
	});

	it("includes main() call", () => {
		const result = mainTemplate(VARS, DEF);
		expect(result).toContain("main()");
	});
});

describe("mainTestTemplate", () => {
	it("includes project name in describe", () => {
		const result = mainTestTemplate(VARS, DEF);
		expect(result).toContain("My Tool");
	});

	it("includes vitest imports", () => {
		const result = mainTestTemplate(VARS, DEF);
		expect(result).toContain("import { describe, it, expect }");
	});

	it("includes project id in test assertion", () => {
		const result = mainTestTemplate(VARS, DEF);
		expect(result).toContain("my-tool");
	});

	it("has at least two test cases", () => {
		const result = mainTestTemplate(VARS, DEF);
		const itCount = (result.match(/\bit\(/g) ?? []).length;
		expect(itCount).toBeGreaterThanOrEqual(2);
	});
});

describe("projectTemplates registry", () => {
	it("exports project-main and project-main-test", () => {
		expect(Object.keys(projectTemplates)).toEqual(["project-main", "project-main-test"]);
	});
});
