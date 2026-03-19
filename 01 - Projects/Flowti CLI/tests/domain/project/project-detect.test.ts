import { describe, it, expect } from "vitest";
import { detectProject } from "../../../src/domain/project/project-detect.js";

function mockDeps(files: Record<string, string>) {
	return {
		disk: {
			existsSync: (p: string) => Object.keys(files).some((f) => p.endsWith(f)),
			readFileSync: (p: string) => {
				const key = Object.keys(files).find((f) => p.endsWith(f));
				return key ? files[key] : "";
			},
		},
		paths: {
			join: (...args: string[]) => args.join("/"),
		},
	};
}

describe("detectProject", () => {
	it("detects typescript when tsconfig.json exists", () => {
		const deps = mockDeps({ "tsconfig.json": "{}", "package.json": "{}" });
		const result = detectProject("/project", deps);
		expect(result.type).toBe("typescript");
	});

	it("detects javascript when no tsconfig", () => {
		const deps = mockDeps({ "package.json": "{}" });
		const result = detectProject("/project", deps);
		expect(result.type).toBe("javascript");
	});

	it("detects React framework from devDependencies", () => {
		const pkg = JSON.stringify({ devDependencies: { react: "^18", "vite": "^5" } });
		const deps = mockDeps({ "package.json": pkg, "vite.config.ts": "" });
		const result = detectProject("/project", deps);
		expect(result.framework).toBe("React");
	});

	it("detects Angular from angular.json", () => {
		const deps = mockDeps({ "package.json": "{}", "angular.json": "{}" });
		const result = detectProject("/project", deps);
		expect(result.framework).toBe("Angular");
	});

	it("detects npm from package-lock.json", () => {
		const deps = mockDeps({ "package.json": "{}", "package-lock.json": "" });
		const result = detectProject("/project", deps);
		expect(result.packageManager).toBe("npm");
	});

	it("detects yarn from yarn.lock", () => {
		const deps = mockDeps({ "package.json": "{}", "yarn.lock": "" });
		const result = detectProject("/project", deps);
		expect(result.packageManager).toBe("yarn");
	});

	it("detects vitest from devDependencies", () => {
		const pkg = JSON.stringify({ devDependencies: { vitest: "^1" } });
		const deps = mockDeps({ "package.json": pkg });
		const result = detectProject("/project", deps);
		expect(result.testFramework).toBe("vitest");
	});

	it("detects existing flowti.config.json", () => {
		const deps = mockDeps({ "package.json": "{}", "configs/flowti.config.json": "{}" });
		const result = detectProject("/project", deps);
		expect(result.hasConfig).toBe(true);
	});

	it("returns unknown type when no package.json", () => {
		const deps = mockDeps({});
		const result = detectProject("/project", deps);
		expect(result.type).toBe("unknown");
	});
});
