/**
 * storybook-scaffold.ts — Generate a Storybook component library from a sitemap.
 *
 * Pure domain function that reads a sitemap JSON file (supporting both CLI
 * `pages` format and Plugin `views` format), then generates all scaffold
 * files for a Storybook component library in the chosen framework.
 *
 * Returns file descriptors without performing I/O — the caller writes them.
 */

import type { CliDeps } from "../../infrastructure/deps.js";

import * as reactTemplates from "./templates/storybook/react.js";
import * as vueTemplates from "./templates/storybook/vue.js";
import * as angularTemplates from "./templates/storybook/angular.js";
import * as litTemplates from "./templates/storybook/lit.js";
import * as cliAppTemplates from "./templates/storybook/cli-app.js";

// ── Types ────────────────────────────────────────────────────────────

export type ScaffoldFramework = "react" | "vue" | "angular" | "lit" | "cli-app";

export const SCAFFOLD_FRAMEWORKS: readonly ScaffoldFramework[] = [
	"react", "vue", "angular", "lit", "cli-app",
] as const;

export interface ScaffoldFile {
	path: string;
	content: string;
}

export interface ScaffoldResult {
	files: ScaffoldFile[];
	framework: string;
	pageCount: number;
}

interface SitemapPage {
	label?: string;
	kind?: string;
}

interface FrameworkTemplate {
	getStorybookConfig(): string;
	getStoryTemplate(pageName: string, pascal: string): string;
	getComponentStub(pageName: string, pascal: string): string;
	getPackageDeps(): Record<string, string>;
}

export type ScaffoldDeps = Pick<CliDeps, "disk" | "paths">;

// ── Framework template registry ──────────────────────────────────────

const frameworkTemplates: Record<ScaffoldFramework, FrameworkTemplate> = {
	react: reactTemplates,
	vue: vueTemplates,
	angular: angularTemplates,
	lit: litTemplates,
	"cli-app": cliAppTemplates,
};

// ── Helpers ──────────────────────────────────────────────────────────

function toPascal(s: string): string {
	return s
		.replace(/[^a-zA-Z0-9]+/g, " ")
		.replace(/(^|\s)\w/g, (match) => match.toUpperCase())
		.replace(/\s+/g, "");
}

function toKebab(s: string): string {
	return s
		.replace(/[^a-zA-Z0-9]+/g, "-")
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.toLowerCase()
		.replace(/^-+|-+$/g, "");
}

function extractPages(sitemap: Record<string, unknown>): Array<{ id: string; label: string }> {
	// CLI format: { pages: { "page-id": { label, kind, ... } } }
	if (sitemap.pages && typeof sitemap.pages === "object" && !Array.isArray(sitemap.pages)) {
		const pages = sitemap.pages as Record<string, SitemapPage>;
		return Object.entries(pages).map(([id, page]) => ({
			id,
			label: page.label ?? id,
		}));
	}

	// Plugin format: { views: { "view-id": { label, ... } } }
	if (sitemap.views && typeof sitemap.views === "object" && !Array.isArray(sitemap.views)) {
		const views = sitemap.views as Record<string, SitemapPage>;
		return Object.entries(views).map(([id, view]) => ({
			id,
			label: view.label ?? id,
		}));
	}

	return [];
}

function buildPackageJson(name: string, devDeps: Record<string, string>): string {
	const pkg = {
		name,
		version: "0.1.0",
		private: true,
		scripts: {
			storybook: "storybook dev -p 6006",
			"build-storybook": "storybook build",
		},
		devDependencies: devDeps,
	};
	return JSON.stringify(pkg, null, "\t") + "\n";
}

// ── Main scaffold function ───────────────────────────────────────────

export function scaffoldStorybookFromSitemap(
	sitemapPath: string,
	framework: string,
	deps: ScaffoldDeps,
): ScaffoldResult {
	const fw = framework as ScaffoldFramework;
	if (!SCAFFOLD_FRAMEWORKS.includes(fw)) {
		return { files: [], framework, pageCount: 0 };
	}

	const templates = frameworkTemplates[fw];
	const raw = deps.disk.readFileSync(sitemapPath, "utf8");
	const sitemap = JSON.parse(raw) as Record<string, unknown>;
	const pages = extractPages(sitemap);

	if (pages.length === 0) {
		return { files: [], framework, pageCount: 0 };
	}

	const files: ScaffoldFile[] = [];

	// .storybook/main.ts
	files.push({
		path: ".storybook/main.ts",
		content: templates.getStorybookConfig(),
	});

	// package.json
	const sitemapBasename = deps.paths.basename(sitemapPath, deps.paths.extname(sitemapPath));
	const projectName = `${toKebab(sitemapBasename)}-storybook`;
	files.push({
		path: "package.json",
		content: buildPackageJson(projectName, templates.getPackageDeps()),
	});

	// Per-page: story file + component stub
	for (const page of pages) {
		const kebab = toKebab(page.id);
		const pascal = toPascal(page.label);

		files.push({
			path: `src/${kebab}/${kebab}.stories.ts`,
			content: templates.getStoryTemplate(kebab, pascal),
		});

		const stubExt = fw === "vue" ? ".vue" : fw === "angular" ? ".component.ts" : ".tsx";
		files.push({
			path: `src/${kebab}/${kebab}${stubExt}`,
			content: templates.getComponentStub(kebab, pascal),
		});
	}

	return { files, framework, pageCount: pages.length };
}
