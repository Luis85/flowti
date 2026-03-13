/**
 * sitemap-project.ts — Project-level sitemap operations.
 *
 * Creates, reads, and imports project sitemaps. A project sitemap describes
 * the application's page structure and can be converted to components for
 * visualization and Storybook rendering.
 *
 * The project sitemap lives at `<projectRoot>/configs/sitemap.json` and
 * follows the same schema as the CLI's own sitemap.
 */

import type { CliDeps } from "../../infrastructure/deps.js";
import type { Sitemap } from "../../infrastructure/sitemap-types.js";
import type { ComponentInstance } from "../make/component/component-editor.js";
import { sitemapToComponents } from "./sitemap-to-component.js";
import { computeHash } from "../../infrastructure/sitemap-watcher.js";

export type SitemapProjectDeps = Pick<CliDeps, "disk" | "paths">;

const SITEMAP_RELATIVE = "configs/sitemap.json";
const SITEMAP_HASH_RELATIVE = "configs/.sitemap-hash";

// ── Path helpers ────────────────────────────────────────────────────

export function getSitemapPath(projectRoot: string, deps: SitemapProjectDeps): string {
	return deps.paths.join(projectRoot, ...SITEMAP_RELATIVE.split("/"));
}

function getHashPath(projectRoot: string, deps: SitemapProjectDeps): string {
	return deps.paths.join(projectRoot, ...SITEMAP_HASH_RELATIVE.split("/"));
}

// ── Existence / dirtiness checks ────────────────────────────────────

export function sitemapExists(projectRoot: string, deps: SitemapProjectDeps): boolean {
	return deps.disk.existsSync(getSitemapPath(projectRoot, deps));
}

/**
 * A project sitemap is "dirty" when its content hash differs from the
 * last-imported hash stored in `configs/.sitemap-hash`.
 */
export function isSitemapDirty(projectRoot: string, deps: SitemapProjectDeps): boolean {
	const sitemapPath = getSitemapPath(projectRoot, deps);
	const hashPath = getHashPath(projectRoot, deps);

	if (!deps.disk.existsSync(sitemapPath)) return false;
	if (!deps.disk.existsSync(hashPath)) return true; // never imported

	const content = deps.disk.readFileSync(sitemapPath, "utf-8");
	const currentHash = computeHash(content);
	const storedHash = deps.disk.readFileSync(hashPath, "utf-8").trim();

	return currentHash !== storedHash;
}

// ── Create barebones sitemap ────────────────────────────────────────

export interface CreateSitemapResult {
	readonly created: boolean;
	readonly path: string;
	readonly viewCount: number;
}

/**
 * Creates a barebones project sitemap with a start page, a detail page,
 * and a settings page. Returns the path and view count.
 */
export function createProjectSitemap(
	projectRoot: string,
	projectName: string,
	deps: SitemapProjectDeps,
): CreateSitemapResult {
	const sitemapPath = getSitemapPath(projectRoot, deps);

	if (deps.disk.existsSync(sitemapPath)) {
		return { created: false, path: sitemapPath, viewCount: 0 };
	}

	const sitemap: Sitemap = {
		version: 1,
		views: {
			"home": {
				title: projectName,
				icon: "home",
				domain: "navigation",
				status: "draft",
				description: `Landing page for ${projectName}.`,
				route: { path: "/", pathMatch: "full" },
				items: [
					{ key: "1", label: "Dashboard", navigate: "dashboard" },
					{ key: "2", label: "Settings", navigate: "settings" },
					{ separator: true },
					{ key: "q", label: "Quit", signal: "quit" },
				],
			},
			"dashboard": {
				type: "dynamic",
				title: "Dashboard",
				icon: "bar-chart",
				domain: "core",
				status: "draft",
				parent: "home",
				route: { path: "dashboard" },
				handler: "dashboard",
				description: "Main application dashboard.",
				capabilities: ["View summary", "Navigate to detail views"],
			},
			"settings": {
				title: "Settings",
				icon: "settings",
				domain: "core",
				status: "draft",
				parent: "home",
				route: { path: "settings" },
				description: "Application settings and preferences.",
				items: [
					{ key: "b", label: "Back", signal: "back" },
				],
			},
		},
	};

	const configsDir = deps.paths.join(projectRoot, "configs");
	if (!deps.disk.existsSync(configsDir)) {
		deps.disk.mkdirSync(configsDir, { recursive: true });
	}

	deps.disk.writeFileSync(sitemapPath, JSON.stringify(sitemap, null, "\t") + "\n", "utf-8");

	return {
		created: true,
		path: sitemapPath,
		viewCount: Object.keys(sitemap.views).length,
	};
}

// ── Import sitemap as components ────────────────────────────────────

export interface ImportSitemapResult {
	readonly imported: number;
	readonly skipped: number;
	readonly errors: readonly string[];
}

/**
 * Reads the project sitemap and writes each view as a ComponentInstance
 * to the project's `components/` directory. Existing components with the
 * same ID are skipped (use `regenerateFromSitemap` for overwrite).
 */
export function importSitemap(
	projectRoot: string,
	deps: SitemapProjectDeps,
): ImportSitemapResult {
	return importOrRegenerate(projectRoot, deps, false);
}

/**
 * Like `importSitemap` but overwrites existing component instances.
 * Called when the sitemap is dirty and the user wants to re-sync.
 */
export function regenerateFromSitemap(
	projectRoot: string,
	deps: SitemapProjectDeps,
): ImportSitemapResult {
	return importOrRegenerate(projectRoot, deps, true);
}

// ── Shared import/regenerate logic ──────────────────────────────────

function importOrRegenerate(
	projectRoot: string,
	deps: SitemapProjectDeps,
	overwrite: boolean,
): ImportSitemapResult {
	const sitemapPath = getSitemapPath(projectRoot, deps);

	if (!deps.disk.existsSync(sitemapPath)) {
		return { imported: 0, skipped: 0, errors: ["Sitemap file not found."] };
	}

	let sitemap: Sitemap;
	try {
		sitemap = JSON.parse(deps.disk.readFileSync(sitemapPath, "utf-8"));
	} catch (err) {
		return { imported: 0, skipped: 0, errors: [`Invalid JSON: ${(err as Error).message}`] };
	}

	const components = sitemapToComponents(sitemap);
	const componentsDir = deps.paths.join(projectRoot, "components");
	let imported = 0;
	let skipped = 0;

	for (const comp of components) {
		const compDir = deps.paths.join(componentsDir, comp.id);
		const jsonPath = deps.paths.join(compDir, `${comp.id}.json`);

		if (deps.disk.existsSync(jsonPath) && !overwrite) {
			skipped++;
			continue;
		}

		const instance = buildComponentInstance(comp);
		if (!deps.disk.existsSync(compDir)) {
			deps.disk.mkdirSync(compDir, { recursive: true });
		}
		deps.disk.writeFileSync(jsonPath, JSON.stringify(instance, null, "\t") + "\n", "utf-8");
		imported++;
	}

	// Store the current sitemap hash so we can detect dirtiness later
	const content = deps.disk.readFileSync(sitemapPath, "utf-8");
	const hashPath = getHashPath(projectRoot, deps);
	deps.disk.writeFileSync(hashPath, computeHash(content), "utf-8");

	return { imported, skipped, errors: [] };
}

function buildComponentInstance(comp: ReturnType<typeof sitemapToComponents>[number]): ComponentInstance {
	const instance: ComponentInstance = {
		name: comp.label,
		id: comp.id,
		type: comp.kind,
		status: (comp.metadata.status as string) ?? "draft",
		description: comp.description || undefined,
		domain: comp.domain,
		icon: comp.icon,
		properties: comp.properties.length > 0
			? Object.fromEntries(comp.properties.map((p) => [p.key, p.default ?? ""]))
			: undefined,
		actions: comp.actions.length > 0
			? comp.actions.map((a) => a.name)
			: undefined,
		children: comp.children && comp.children.length > 0
			? comp.children
			: undefined,
	};

	// Remove undefined keys for clean JSON
	for (const key of Object.keys(instance)) {
		if (instance[key] === undefined) delete instance[key];
	}
	return instance;
}
