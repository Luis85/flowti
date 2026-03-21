/**
 * Sitemap canvas layout presets — ids must match Flowti vault CLI `LWt` in `.flowti/bin/main.mjs`
 * (`storybook:canvas-generate --preset=<id>`).
 */

export type SitemapCanvasPresetId =
	| "web-app"
	| "landing"
	| "dashboard"
	| "e-commerce"
	| "enterprise"
	| "cli"
	| "obsidian-plugin"
	| "docs"
	| "system-design"
	| "service-design"
	| "product-design";

export type SitemapCanvasPreset = { id: SitemapCanvasPresetId; label: string };

/** Canonical list (labels match pre–multi-tab project UI, commit ec05c322). */
export const SITEMAP_CANVAS_PRESETS: readonly SitemapCanvasPreset[] = [
	{ id: "web-app", label: "Web App" },
	{ id: "landing", label: "Landing" },
	{ id: "dashboard", label: "Dashboard" },
	{ id: "e-commerce", label: "E-Commerce" },
	{ id: "enterprise", label: "Enterprise" },
	{ id: "cli", label: "CLI" },
	{ id: "obsidian-plugin", label: "Plugin" },
	{ id: "docs", label: "Docs" },
	{ id: "system-design", label: "System" },
	{ id: "service-design", label: "Service" },
	{ id: "product-design", label: "Product" },
] as const;
