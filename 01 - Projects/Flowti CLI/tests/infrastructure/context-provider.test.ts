import { describe, it, expect } from "vitest";
import { interpolate, buildRouterContext } from "../../src/infrastructure/context-provider.js";
import type { RouterContext } from "../../src/infrastructure/sitemap-types.js";
import type { CliDeps } from "../../src/infrastructure/deps.js";
import type { ProjectContext } from "../../src/infrastructure/types.js";

const stubDeps = {} as CliDeps;

function makeProject(overrides: Partial<ProjectContext> = {}): ProjectContext {
	return {
		path: "/projects/my-app",
		pkg: { name: "my-app", version: "1.2.3" },
		config: { name: "My App" } as any,
		scripts: {},
		...overrides,
	};
}

function makeCtx(overrides: Partial<RouterContext> = {}): RouterContext {
	return { deps: stubDeps, ...overrides };
}

// ── interpolate ─────────────────────────────────────────────────────

describe("interpolate", () => {
	it("replaces {{project.name}} with config name", () => {
		const ctx = makeCtx({ project: makeProject() });
		expect(interpolate("{{project.name}}", ctx)).toBe("My App");
	});

	it("replaces {{project.version}} with package version", () => {
		const ctx = makeCtx({ project: makeProject() });
		expect(interpolate("v{{project.version}}", ctx)).toBe("v1.2.3");
	});

	it("replaces {{project.path}} with project path", () => {
		const ctx = makeCtx({ project: makeProject() });
		expect(interpolate("{{project.path}}", ctx)).toBe("/projects/my-app");
	});

	it("falls back to package name when config name is empty", () => {
		const ctx = makeCtx({ project: makeProject({ config: { name: "" } as any }) });
		expect(interpolate("{{project.name}}", ctx)).toBe("my-app");
	});

	it("returns empty string for unknown template paths", () => {
		const ctx = makeCtx({ project: makeProject() });
		expect(interpolate("{{project.unknown}}", ctx)).toBe("");
	});

	it("returns empty string when no project context", () => {
		const ctx = makeCtx();
		expect(interpolate("{{project.name}}", ctx)).toBe("");
	});

	it("leaves non-template text unchanged", () => {
		const ctx = makeCtx({ project: makeProject() });
		expect(interpolate("Hello World", ctx)).toBe("Hello World");
	});

	it("replaces multiple templates in one string", () => {
		const ctx = makeCtx({ project: makeProject() });
		expect(interpolate("{{project.name}} v{{project.version}}", ctx)).toBe("My App v1.2.3");
	});

	it("handles whitespace in template braces", () => {
		const ctx = makeCtx({ project: makeProject() });
		expect(interpolate("{{ project.name }}", ctx)).toBe("My App");
	});
});

// ── buildRouterContext ──────────────────────────────────────────────

describe("buildRouterContext", () => {
	it("builds context with all fields", () => {
		const project = makeProject();
		const tools = { esbuild: true, tsc: false, obsidian: false, vitest: true };
		const ctx = buildRouterContext(stubDeps, project, tools);

		expect(ctx.deps).toBe(stubDeps);
		expect(ctx.project).toBe(project);
		expect(ctx.tools).toEqual(tools);
	});

	it("builds context without project or tools", () => {
		const ctx = buildRouterContext(stubDeps);
		expect(ctx.deps).toBe(stubDeps);
		expect(ctx.project).toBeUndefined();
		expect(ctx.tools).toBeUndefined();
	});
});
