/**
 * sitemap.controller.ts — Controller for sitemap inspection commands.
 *
 * Provides non-interactive commands to validate, inspect status, and list
 * views from configs/sitemap.json. Works with the selected project's sitemap
 * when a project is active, otherwise falls back to the CLI's own sitemap.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler } from "../infrastructure/types.js";
import type { PageObject } from "../infrastructure/sitemap-types.js";
import { loadSitemap } from "../infrastructure/sitemap-loader.js";
import { computeHash } from "../infrastructure/sitemap-watcher.js";
import { CLI_PROJECT } from "../infrastructure/config.js";
import { log } from "../infrastructure/logger.js";
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
		log(`\n  ${GREEN}Sitemap OK${RESET} ${DIM}(${data.viewCount} pages)${RESET}`);
		if (data.warnings.length > 0) {
			for (const w of data.warnings) log(`  ${YELLOW}•${RESET} ${w}`);
		}
		log();
	} else {
		log(`\n  ${RED}Sitemap validation failed:${RESET}`);
		for (const err of data.errors) {
			log(`  ${RED}•${RESET} ${err}`);
		}
		log();
	}
}

function renderStatus(data: StatusModel): void {
	log(`\n  ${CYAN}Sitemap Status${RESET}`);
	log(`  ${DIM}Path:${RESET}          ${data.path}`);
	log(`  ${DIM}Hash:${RESET}          ${data.hash.slice(0, 12)}...`);
	log(`  ${DIM}Pages:${RESET}         ${data.viewCount}`);
	log(`  ${DIM}Last modified:${RESET} ${data.lastModified}\n`);
}

function renderViews(data: ViewsModel): void {
	log(`\n  ${CYAN}Sitemap Pages${RESET} ${DIM}(${data.views.length} total)${RESET}\n`);
	for (const v of data.views) {
		const tag = `${DIM}${v.kind}${RESET}`;
		const actions = `${DIM}${v.actionCount} actions${RESET}`;
		log(`  ${v.id.padEnd(30)} ${tag.padEnd(20)}  ${actions}`);
		renderViewMeta(v);
	}
	log();
}

function renderViewMeta(v: ViewsModel["views"][number]): void {
	const pad = "".padEnd(30);
	if (v.description) log(`  ${pad} ${DIM}${v.description}${RESET}`);
	if (v.domain) log(`  ${pad} ${DIM}domain: ${v.domain}${RESET}`);
	if (v.configPath) log(`  ${pad} ${DIM}config: ${v.configPath}${RESET}`);
	if (v.parent) log(`  ${pad} ${DIM}parent: ${v.parent}${RESET}`);
	if (v.route?.path) log(`  ${pad} ${DIM}route: ${v.route.path}${RESET}`);
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Resolve the sitemap path: use the selected project's sitemap when available,
 * otherwise fall back to the CLI's own sitemap. Supports `--project` flag.
 */
function resolveSitemapPath(req: {
	project?: { path: string };
	flags: Record<string, string | boolean>;
	deps: { paths: import("../infrastructure/types.js").IPaths };
}): string {
	const projectRoot = req.project?.path ?? CLI_PROJECT;
	return req.deps.paths.join(projectRoot, "configs", "sitemap.json");
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

// ── Controller actions ──────────────────────────────────────────────

const actions: Record<string, ControllerAction> = {
	"sitemap:validate": (req) => {
		const sitemapPath = resolveSitemapPath(req);
		const result = loadSitemap(sitemapPath, req.deps.disk);

		const model: ValidateModel = {
			ok: result.ok,
			errors: result.errors,
			warnings: result.warnings,
			viewCount: result.sitemap ? Object.keys(result.sitemap.pages).length : 0,
		};

		return dataResponse(model, renderValidate);
	},

	"sitemap:status": (req) => {
		const { disk, paths } = req.deps;
		const sitemapPath = resolveSitemapPath(req);

		if (!disk.existsSync(sitemapPath)) {
			const model: ValidateModel = {
				ok: false,
				errors: [`Sitemap file not found: ${sitemapPath}`],
				warnings: [],
				viewCount: 0,
			};
			return dataResponse(model, renderValidate);
		}

		const content = disk.readFileSync(sitemapPath, "utf-8");
		const hash = computeHash(content);
		const stats = disk.statSync(sitemapPath);
		const result = loadSitemap(sitemapPath, disk);
		const viewCount = result.sitemap ? Object.keys(result.sitemap.pages).length : 0;

		const model: StatusModel = {
			path: paths.relative(req.deps.proc.cwd(), sitemapPath),
			hash,
			viewCount,
			lastModified: stats.mtime.toISOString(),
		};

		return dataResponse(model, renderStatus);
	},

	"sitemap:views": (req) => {
		const sitemapPath = resolveSitemapPath(req);
		const result = loadSitemap(sitemapPath, req.deps.disk);

		if (!result.ok || !result.sitemap) {
			const model: ValidateModel = {
				ok: false,
				errors: result.errors,
				warnings: result.warnings,
				viewCount: 0,
			};
			return dataResponse(model, renderValidate);
		}

		const views: ViewEntry[] = Object.entries(result.sitemap.pages).map(
			([id, page]) => pageToEntry(id, page),
		);

		return dataResponse<ViewsModel>({ views }, renderViews);
	},
};

// ── Adapted commands for CommandRegistry ─────────────────────────────

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
