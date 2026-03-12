import { describe, it, expect } from "vitest";
import {
	toJson, manifestTemplate, packageTemplate, tsconfigTemplate,
	esbuildTemplate, vitestTemplate, gitignoreTemplate,
} from "../../../src/domain/make/templates/config.js";

describe("toJson", () => {
	it("produces tab-indented JSON with trailing newline", () => {
		const result = toJson({ a: 1 });
		expect(result).toBe('{\n\t"a": 1\n}\n');
	});
});

describe("manifestTemplate", () => {
	it("includes required fields", () => {
		const json = JSON.parse(manifestTemplate({ id: "my-plugin", name: "My Plugin", author: "Author" }));
		expect(json.id).toBe("my-plugin");
		expect(json.name).toBe("My Plugin");
		expect(json.author).toBe("Author");
		expect(json.version).toBe("0.0.1");
		expect(json.isDesktopOnly).toBe(true);
	});

	it("allows custom version and description", () => {
		const json = JSON.parse(manifestTemplate({ id: "x", name: "X", author: "A", version: "2.0.0", description: "Custom" }));
		expect(json.version).toBe("2.0.0");
		expect(json.description).toBe("Custom");
	});
});

describe("packageTemplate", () => {
	it("generates plugin package.json with main: main.js", () => {
		const json = JSON.parse(packageTemplate("plugin", "My Plugin", "my-plugin"));
		expect(json.name).toBe("my-plugin");
		expect(json.main).toBe("main.js");
		expect(json.scripts.build).toContain("esbuild");
		expect(json.devDependencies.obsidian).toBeDefined();
	});

	it("generates app package.json with coverage dep", () => {
		const json = JSON.parse(packageTemplate("app", "My App", "my-app"));
		expect(json.devDependencies["@vitest/coverage-v8"]).toBeDefined();
		expect(json.scripts.test).toContain("check");
	});

	it("generates cli package.json with type: module", () => {
		const json = JSON.parse(packageTemplate("cli", "My CLI", "my-cli"));
		expect(json.type).toBe("module");
		expect(json.main).toBeUndefined();
		expect(json.devDependencies.typescript).toBeDefined();
		expect(json.devDependencies.obsidian).toBeUndefined();
	});
});

describe("tsconfigTemplate", () => {
	it("uses NodeNext for CLI", () => {
		const json = JSON.parse(tsconfigTemplate("cli"));
		expect(json.compilerOptions.module).toBe("NodeNext");
		expect(json.compilerOptions.moduleResolution).toBe("NodeNext");
	});

	it("uses ESNext/bundler for plugin", () => {
		const json = JSON.parse(tsconfigTemplate("plugin"));
		expect(json.compilerOptions.module).toBe("ESNext");
		expect(json.compilerOptions.moduleResolution).toBe("bundler");
	});

	it("includes vitest/globals types for app", () => {
		const json = JSON.parse(tsconfigTemplate("app"));
		expect(json.compilerOptions.types).toContain("vitest/globals");
		expect(json.include).toContain("tests/**/*.ts");
	});
});

describe("esbuildTemplate", () => {
	it("includes plugin ID in OUTDIR", () => {
		const result = esbuildTemplate("my-plugin");
		expect(result).toContain('"my-plugin"');
		expect(result).toContain("esbuild.context");
	});
});

describe("vitestTemplate", () => {
	it("app template includes happy-dom and setup files", () => {
		const result = vitestTemplate("app");
		expect(result).toContain("happy-dom");
		expect(result).toContain("obsidian-stub");
	});

	it("cli template is minimal", () => {
		const result = vitestTemplate("cli");
		expect(result).not.toContain("happy-dom");
		expect(result).toContain("tests/**/*.test.ts");
	});
});

describe("gitignoreTemplate", () => {
	it("plugin includes main.js and styles.css", () => {
		const result = gitignoreTemplate("plugin");
		expect(result).toContain("main.js");
		expect(result).toContain("styles.css");
	});

	it("cli does not include main.js", () => {
		const result = gitignoreTemplate("cli");
		expect(result).not.toContain("main.js");
		expect(result).toContain("node_modules/");
	});
});
