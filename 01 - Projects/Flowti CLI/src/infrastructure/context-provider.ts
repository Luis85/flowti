/**
 * context-provider.ts — Builds RouterContext and resolves template strings.
 *
 * Provides the runtime context that the SitemapRouter passes to handlers and
 * uses for template interpolation (e.g., `{{project.name}}` in view titles).
 */

import type { ProjectContext } from "./types.js";
import type { CliDeps } from "./deps.js";
import type { RouterContext } from "./sitemap-types.js";

// ── Template interpolation ──────────────────────────────────────────

const TEMPLATE_RE = /\{\{([^}]+)\}\}/g;

/**
 * Replace `{{key}}` placeholders in a string with values from context.
 *
 * Supported paths:
 * - `project.name` → project config name or package name
 * - `project.version` → package version
 *
 * Unknown keys resolve to an empty string.
 */
export function interpolate(template: string, ctx: RouterContext): string {
	return template.replace(TEMPLATE_RE, (_match, path: string) => {
		const trimmed = path.trim();
		return resolveTemplatePath(trimmed, ctx);
	});
}

function resolveTemplatePath(path: string, ctx: RouterContext): string {
	if (!ctx.project) return "";

	switch (path) {
		case "project.name":
			return ctx.project.config.name || ctx.project.pkg?.name || "";
		case "project.version":
			return ctx.project.pkg?.version || "";
		case "project.path":
			return ctx.project.path;
		default:
			return "";
	}
}

// ── Context building ────────────────────────────────────────────────

export interface ToolDetectionResult {
	readonly esbuild: boolean;
	readonly tsc: boolean;
	readonly obsidian: boolean;
	readonly vitest: boolean;
}

/**
 * Build a RouterContext from the current state.
 */
export function buildRouterContext(
	deps: CliDeps,
	project?: ProjectContext,
	tools?: ToolDetectionResult,
): RouterContext {
	return {
		deps,
		project,
		tools: tools ? { ...tools } : undefined,
	};
}
