import { describe, it, expect } from "vitest";
import {
	packageJsonTemplate,
	tsconfigTemplate,
	vitestConfigTemplate,
	esbuildConfigTemplate,
	eslintConfigTemplate,
	gitignoreTemplate,
	flowtiConfigTemplate,
	sharedTemplates,
} from "../../../src/domain/scaffold/templates/shared-templates.js";
import type { ScaffoldDefinition, ScaffoldVariables } from "../../../src/domain/scaffold/scaffold-types.js";

const VARS: ScaffoldVariables = {
	name: "Test Project",
	id: "test-project",
	pascal: "TestProject",
	camel: "testProject",
	author: "Author",
};

const DEF: ScaffoldDefinition = {
	id: "test",
	label: "Test",
	description: "Test scaffold.",
	prompts: [],
	package: {
		type: "module",
		scripts: { build: "tsc", test: "vitest run" },
		devDependencies: { typescript: "^5.9.0", vitest: "^4.0.0" },
	},
	flowtiConfig: {
		tools: { build: "npm run build" },
	},
	directories: [],
	files: [],
	nextSteps: [],
};

describe("packageJsonTemplate", () => {
	it("includes project name as id", () => {
		const result = packageJsonTemplate(VARS, DEF);
		const pkg = JSON.parse(result);
		expect(pkg.name).toBe("test-project");
	});

	it("includes scripts from definition", () => {
		const pkg = JSON.parse(packageJsonTemplate(VARS, DEF));
		expect(pkg.scripts.build).toBe("tsc");
		expect(pkg.scripts.test).toBe("vitest run");
	});

	it("includes devDependencies from definition", () => {
		const pkg = JSON.parse(packageJsonTemplate(VARS, DEF));
		expect(pkg.devDependencies.typescript).toBe("^5.9.0");
	});

	it("sets type module from definition", () => {
		const pkg = JSON.parse(packageJsonTemplate(VARS, DEF));
		expect(pkg.type).toBe("module");
	});

	it("marks as private", () => {
		const pkg = JSON.parse(packageJsonTemplate(VARS, DEF));
		expect(pkg.private).toBe(true);
	});
});

describe("tsconfigTemplate", () => {
	it("targets ES2022", () => {
		const result = tsconfigTemplate(VARS, DEF);
		const tsconfig = JSON.parse(result);
		expect(tsconfig.compilerOptions.target).toBe("ES2022");
	});

	it("uses NodeNext modules", () => {
		const tsconfig = JSON.parse(tsconfigTemplate(VARS, DEF));
		expect(tsconfig.compilerOptions.module).toBe("NodeNext");
	});

	it("enables strict mode", () => {
		const tsconfig = JSON.parse(tsconfigTemplate(VARS, DEF));
		expect(tsconfig.compilerOptions.strict).toBe(true);
	});
});

describe("vitestConfigTemplate", () => {
	it("includes vitest import", () => {
		const result = vitestConfigTemplate(VARS, DEF);
		expect(result).toContain("vitest/config");
	});

	it("includes test glob", () => {
		const result = vitestConfigTemplate(VARS, DEF);
		expect(result).toContain("tests/**/*.test.ts");
	});
});

describe("esbuildConfigTemplate", () => {
	it("includes project name in comment", () => {
		const result = esbuildConfigTemplate(VARS, DEF);
		expect(result).toContain("Test Project");
	});

	it("targets node platform", () => {
		const result = esbuildConfigTemplate(VARS, DEF);
		expect(result).toContain("node");
	});

	it("outputs ESM format", () => {
		const result = esbuildConfigTemplate(VARS, DEF);
		expect(result).toContain("esm");
	});
});

describe("eslintConfigTemplate", () => {
	it("includes typescript-eslint", () => {
		const result = eslintConfigTemplate(VARS, DEF);
		expect(result).toContain("@typescript-eslint");
	});

	it("includes complexity rule", () => {
		const result = eslintConfigTemplate(VARS, DEF);
		expect(result).toContain("complexity");
	});
});

describe("gitignoreTemplate", () => {
	it("includes node_modules", () => {
		expect(gitignoreTemplate(VARS, DEF)).toContain("node_modules/");
	});

	it("includes dist", () => {
		expect(gitignoreTemplate(VARS, DEF)).toContain("dist/");
	});
});

describe("flowtiConfigTemplate", () => {
	it("includes project id as name", () => {
		const result = JSON.parse(flowtiConfigTemplate(VARS, DEF));
		expect(result.name).toBe("test-project");
	});

	it("includes tools from definition", () => {
		const result = JSON.parse(flowtiConfigTemplate(VARS, DEF));
		expect(result.tools.build).toBe("npm run build");
	});
});

describe("sharedTemplates registry", () => {
	it("exports all expected template IDs", () => {
		const ids = Object.keys(sharedTemplates);
		expect(ids).toContain("package-json");
		expect(ids).toContain("tsconfig");
		expect(ids).toContain("vitest-config");
		expect(ids).toContain("esbuild-config");
		expect(ids).toContain("eslint-config");
		expect(ids).toContain("gitignore");
		expect(ids).toContain("flowti-config");
	});
});
