/**
 * sitemap.controller.ts — Controller for sitemap inspection commands.
 *
 * Provides non-interactive commands to validate, inspect status, and list
 * views from configs/sitemap.json. Works with the selected project's sitemap
 * when a project is active, otherwise falls back to the CLI's own sitemap.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types.js";
import type { LogFn } from "../infrastructure/command-engine.js";
import type { PageObject } from "../infrastructure/sitemap-types.js";
import type { CommandContext } from "../infrastructure/command-engine.js";
import { loadSitemap } from "../infrastructure/sitemap-loader.js";
import { computeHash } from "../infrastructure/sitemap-watcher.js";
import { CLI_PROJECT } from "../infrastructure/config.js";
import { log as logSingleton } from "../infrastructure/logger.js";
import { RESET, DIM, GREEN, RED, YELLOW, CYAN } from "../infrastructure/ui.js";

// ── View models ──────────────────────────────────────────────────────

export interface ValidateModel {
	readonly ok: boolean;
	readonly errors: readonly string[];
	readonly warnings: readonly string[];
	readonly viewCount: number;
}

export interface StatusModel {
	readonly path: string;
	readonly hash: string;
	readonly viewCount: number;
	readonly lastModified: string;
}

export interface ViewEntry {
	readonly id: string;
	readonly kind: string;
	readonly label: string;
	readonly actionCount: number;
	readonly description?: string;
	readonly domain?: string;
	readonly configPath?: string;
	readonly parent?: string;
	readonly route?: import("../infrastructure/sitemap-types.js").RouteConfig;
}

export interface ViewsModel {
	readonly views: readonly ViewEntry[];
}

// ── Renderers ────────────────────────────────────────────────────────

function renderValidate(data: ValidateModel): void {
	if (data.ok) {
		logSingleton(`\n  ${GREEN}Sitemap OK${RESET} ${DIM}(${data.viewCount} pages)${RESET}`);
		if (data.warnings.length > 0) {
			for (const w of data.warnings) logSingleton(`  ${YELLOW}•${RESET} ${w}`);
		}
		logSingleton();
	} else {
		logSingleton(`\n  ${RED}Sitemap validation failed:${RESET}`);
		for (const err of data.errors) {
			logSingleton(`  ${RED}•${RESET} ${err}`);
		}
		logSingleton();
	}
}

function renderStatus(data: StatusModel): void {
	logSingleton(`\n  ${CYAN}Sitemap Status${RESET}`);
	logSingleton(`  ${DIM}Path:${RESET}          ${data.path}`);
	logSingleton(`  ${DIM}Hash:${RESET}          ${data.hash.slice(0, 12)}...`);
	logSingleton(`  ${DIM}Pages:${RESET}         ${data.viewCount}`);
	logSingleton(`  ${DIM}Last modified:${RESET} ${data.lastModified}\n`);
}

function renderViews(data: ViewsModel): void {
	logSingleton(`\n  ${CYAN}Sitemap Pages${RESET} ${DIM}(${data.views.length} total)${RESET}\n`);
	for (const v of data.views) {
		const tag = `${DIM}${v.kind}${RESET}`;
		const actions = `${DIM}${v.actionCount} actions${RESET}`;
		logSingleton(`  ${v.id.padEnd(30)} ${tag.padEnd(20)}  ${actions}`);
		renderViewMeta(v);
	}
	logSingleton();
}

function renderViewMeta(v: ViewsModel["views"][number]): void {
	const pad = "".padEnd(30);
	if (v.description) logSingleton(`  ${pad} ${DIM}${v.description}${RESET}`);
	if (v.domain) logSingleton(`  ${pad} ${DIM}domain: ${v.domain}${RESET}`);
	if (v.configPath) logSingleton(`  ${pad} ${DIM}config: ${v.configPath}${RESET}`);
	if (v.parent) logSingleton(`  ${pad} ${DIM}parent: ${v.parent}${RESET}`);
	if (v.route?.path) logSingleton(`  ${pad} ${DIM}route: ${v.route.path}${RESET}`);
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Resolve the sitemap path: use the selected project's sitemap when available,
 * otherwise fall back to the CLI's own sitemap. Supports `--project` flag.
 */
function resolveSitemapPath(ctx: CommandContext): string {
	const projectRoot = ctx.project?.path ?? CLI_PROJECT;
	return ctx.deps.paths.join(projectRoot, "configs", "sitemap.json");
}

function pageToEntry(id: string, page: PageObject): ViewEntry {
	return {
		id,
		kind: page.kind,
		label: page.label,
		actionCount: page.actions.length,
		...(page.description ? { description: page.description } : {}),
		...(page.domain ? { domain: page.domain } : {}),
		...(page.configPath ? { configPath: page.configPath } : {}),
		...(page.parent ? { parent: page.parent } : {}),
		...(page.route ? { route: page.route } : {}),
	};
}

// ── Commands ─────────────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = {
	"sitemap:validate": adaptDescriptor<Record<string, unknown>, ValidateModel>({
		handler: (ctx) => {
			const sitemapPath = resolveSitemapPath(ctx);
			const result = loadSitemap(sitemapPath, ctx.deps.disk);

			return {
				ok: result.ok,
				errors: result.errors,
				warnings: result.warnings,
				viewCount: result.sitemap ? Object.keys(result.sitemap.pages).length : 0,
			};
		},
		renderer: (data: ValidateModel) => renderValidate(data),
	}),

	"sitemap:status": adaptDescriptor<Record<string, unknown>, StatusModel | ValidateModel>({
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const sitemapPath = resolveSitemapPath(ctx);

			if (!disk.existsSync(sitemapPath)) {
				return {
					ok: false,
					errors: [`Sitemap file not found: ${sitemapPath}`],
					warnings: [],
					viewCount: 0,
				} as ValidateModel;
			}

			const content = disk.readFileSync(sitemapPath, "utf-8");
			const hash = computeHash(content);
			const stats = disk.statSync(sitemapPath);
			const result = loadSitemap(sitemapPath, disk);
			const viewCount = result.sitemap ? Object.keys(result.sitemap.pages).length : 0;

			return {
				path: paths.relative(ctx.deps.proc.cwd(), sitemapPath),
				hash,
				viewCount,
				lastModified: stats.mtime.toISOString(),
			} as StatusModel;
		},
		renderer: (data: StatusModel | ValidateModel) => {
			if ("ok" in data) { renderValidate(data as ValidateModel); return; }
			renderStatus(data as StatusModel);
		},
	}),

	"sitemap:views": adaptDescriptor<Record<string, unknown>, ViewsModel | ValidateModel>({
		handler: (ctx) => {
			const sitemapPath = resolveSitemapPath(ctx);
			const result = loadSitemap(sitemapPath, ctx.deps.disk);

			if (!result.ok || !result.sitemap) {
				return {
					ok: false,
					errors: result.errors,
					warnings: result.warnings,
					viewCount: 0,
				} as ValidateModel;
			}

			const views: ViewEntry[] = Object.entries(result.sitemap.pages).map(
				([id, page]) => pageToEntry(id, page),
			);

			return { views };
		},
		renderer: (data: ViewsModel | ValidateModel) => {
			if ("ok" in data) { renderValidate(data as ValidateModel); return; }
			renderViews(data as ViewsModel);
		},
	}),
};
