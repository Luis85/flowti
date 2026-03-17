/**
 * effect-handlers.ts — TUI effect handlers for build, test, lint, review, and publish.
 *
 * These are the highest-value handlers — they make the TUI usable for development
 * workflows. Each handler calls shell.run() with the appropriate command and
 * records pipeline state on success/failure.
 */

import type { TuiHandlerRegistry } from "./tui-handler-registry.js";
import type { TuiActionContext } from "./tui-handler-types.js";

export function registerEffectHandlers(registry: TuiHandlerRegistry): void {
	// Build
	registry.registerHandler("build:interactive", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		const code = ctx.deps.shell.run("node configs/esbuild.config.mjs", { cwd: ctx.project.path });
		ctx.session.pipeline["buildPassed"] = code === 0;
		return code === 0
			? { kind: "ok", message: "Build complete" }
			: { kind: "error", message: "Build failed" };
	});

	// Type check
	registry.registerHandler("devtools:check", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		const code = ctx.deps.shell.run("npx tsc --noEmit --project configs/tsconfig.json", { cwd: ctx.project.path });
		return code === 0
			? { kind: "ok", message: "Type check clean" }
			: { kind: "error", message: "Type check failed" };
	});

	// Lint
	registry.registerHandler("devtools:lint", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		const code = ctx.deps.shell.run("npx eslint src/ --config configs/eslint.config.mjs", { cwd: ctx.project.path });
		return code === 0
			? { kind: "ok", message: "Lint clean" }
			: { kind: "error", message: "Lint errors found" };
	});

	// Rebuild CLI
	registry.registerHandler("devtools:rebuild", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		const code = ctx.deps.shell.run("node configs/esbuild.config.mjs", { cwd: ctx.project.path });
		return code === 0
			? { kind: "ok", message: "Rebuild complete" }
			: { kind: "error", message: "Rebuild failed" };
	});

	// Run all reports
	registry.registerHandler("reports:run-all", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		const buildCode = ctx.deps.shell.run("node configs/esbuild.config.mjs", { cwd: ctx.project.path });
		if (buildCode !== 0) return { kind: "error", message: "Report generation failed (build)" };
		const testCode = ctx.deps.shell.run("npx vitest run --config configs/vitest.config.ts", { cwd: ctx.project.path });
		return testCode === 0
			? { kind: "ok", message: "Reports generated" }
			: { kind: "error", message: "Report generation failed (tests)" };
	});

	// Health
	registry.registerHandler("health:show", async () => {
		return { kind: "navigate", target: "health" };
	});

	// Sitemap export
	registry.registerHandler("sitemap:export", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		const code = ctx.deps.shell.run("node -e \"require('./src/domain/sitemap/sitemap-export.js').exportSitemapToMarkdown()\"", { cwd: ctx.project.path });
		return code === 0
			? { kind: "ok", message: "Sitemap exported" }
			: { kind: "error", message: "Sitemap export failed" };
	});

	// Review pipeline handlers
	registry.registerHandler("review:build", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		const code = ctx.deps.shell.run("node configs/esbuild.config.mjs", { cwd: ctx.project.path });
		ctx.session.pipeline["review:buildPassed"] = code === 0;
		return code === 0
			? { kind: "ok", message: "Review build passed" }
			: { kind: "error", message: "Review build failed" };
	});

	registry.registerHandler("review:test", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		const code = ctx.deps.shell.run("npx vitest run --config configs/vitest.config.ts", { cwd: ctx.project.path });
		ctx.session.pipeline["review:testPassed"] = code === 0;
		return code === 0
			? { kind: "ok", message: "Review tests passed" }
			: { kind: "error", message: "Review tests failed" };
	});

	// Publish pipeline handlers
	registry.registerHandler("publish:build", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		const code = ctx.deps.shell.run("node configs/esbuild.config.mjs", { cwd: ctx.project.path });
		ctx.session.pipeline["publish:buildPassed"] = code === 0;
		return code === 0
			? { kind: "ok", message: "Publish build passed" }
			: { kind: "error", message: "Publish build failed" };
	});

	registry.registerHandler("publish:test", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		const code = ctx.deps.shell.run("npx vitest run --config configs/vitest.config.ts", { cwd: ctx.project.path });
		ctx.session.pipeline["publish:testPassed"] = code === 0;
		return code === 0
			? { kind: "ok", message: "Publish tests passed" }
			: { kind: "error", message: "Publish tests failed" };
	});
}
