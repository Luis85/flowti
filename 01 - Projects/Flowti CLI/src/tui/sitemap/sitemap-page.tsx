/**
 * sitemap-page.tsx — Universal sitemap-driven page renderer.
 *
 * Reads a PageObject definition and renders:
 * - Header (label + description)
 * - Content zone (kind-based: dashboard, list, or form)
 * - EffectStrip (status line for running effects)
 * - SitemapActionBar (keyboard-wired actions)
 */

import React, { useCallback, useState } from "react";
import { Box, Text } from "ink";
import type { PageObject } from "../../domain/sitemap/unified-page.js";
import { SitemapActionBar } from "./sitemap-action-bar.js";
import { EffectStrip } from "./effect-strip.js";
import { getLoaderForPage } from "./loader-map.js";
import { resolvePageActions, type SitemapActionDef } from "../hooks/use-sitemap-actions.js";
import { dispatchAction } from "../hooks/use-action-dispatch.js";
import { useActionEffect } from "../hooks/use-action-effect.js";
import { useNavigationContext } from "./navigation-context.js";
import { buildTuiFlatContext } from "../hooks/use-condition-context.js";
import { useLoaderContext, useTuiContext } from "../context.js";
import { useLoader } from "../hooks/use-loader.js";
import { StatGrid } from "../primitives/stat-grid.js";
import type { StatCardData } from "../primitives/stat-card.js";
import type { TuiHandlerRegistry } from "../registry/tui-handler-registry.js";
import type { TuiActionContext } from "../registry/tui-handler-types.js";

interface SitemapPageProps {
	readonly page: PageObject;
	readonly pageId: string;
	readonly params: Record<string, string>;
	readonly registry?: TuiHandlerRegistry;
	readonly enabled?: boolean;
}

export function SitemapPage({ page, pageId, params, registry, enabled = true }: SitemapPageProps): React.JSX.Element {
	const tuiCtx = useTuiContext();
	const nav = useNavigationContext();
	const effect = useActionEffect();

	// Build condition context
	const flatCtx = buildTuiFlatContext(
		tuiCtx.projectPath ? { name: "", path: tuiCtx.projectPath } : undefined,
		undefined,
		undefined,
	);

	// Resolve actions — empty registry fallback for condition evaluation
	const noopRegistry = { hasCondition: () => false, getCondition: () => () => false };
	const actions = resolvePageActions(page.actions ?? [], flatCtx, registry ?? noopRegistry as never);

	// Build action context for handler dispatch
	const actionCtx: TuiActionContext = {
		deps: { disk: tuiCtx.deps.disk, paths: tuiCtx.deps.paths, clock: tuiCtx.deps.clock, shell: tuiCtx.deps.shell },
		session: { pipeline: {}, selectedProject: tuiCtx.projectPath },
		project: tuiCtx.projectPath ? { name: "", path: tuiCtx.projectPath } : undefined,
		params,
	};

	const handleAction = useCallback((action: SitemapActionDef) => {
		if (registry) {
			dispatchAction(action, nav, registry, actionCtx, effect.run);
		}
	}, [registry, nav, actionCtx, effect.run]);

	return React.createElement(Box, { flexDirection: "column", flexGrow: 1 },
		// Header
		React.createElement(Box, { paddingX: 1 },
			React.createElement(Text, { bold: true, color: "cyan" }, page.label),
			page.description
				? React.createElement(Text, { dimColor: true }, ` \u2014 ${page.description}`)
				: null,
		),

		// Content zone — kind-based rendering
		React.createElement(ContentZone, { page, pageId, params }),

		// Effect strip
		React.createElement(EffectStrip, { state: effect.state, message: effect.message }),

		// Action bar
		React.createElement(SitemapActionBar, { actions, onAction: handleAction, enabled }),
	);
}

// ── Content Zone ────────────────────────────────────────────────────

interface ContentZoneProps {
	readonly page: PageObject;
	readonly pageId: string;
	readonly params: Record<string, string>;
}

function ContentZone({ page, pageId, params }: ContentZoneProps): React.JSX.Element {
	// Form pages render from page.fields, not from a loader
	if (page.kind === "form") {
		return React.createElement(FormContent, { page });
	}

	return React.createElement(LoadedContentZone, { page, pageId, params });
}

interface LoadedContentZoneProps {
	readonly page: PageObject;
	readonly pageId: string;
	readonly params: Record<string, string>;
}

function LoadedContentZone({ page, pageId, params }: LoadedContentZoneProps): React.JSX.Element {
	const loaderCtx = useLoaderContext(params);
	const loader = getLoaderForPage(pageId);

	if (!loader) {
		return React.createElement(Box, { flexDirection: "column", flexGrow: 1, paddingX: 1 },
			React.createElement(Text, { dimColor: true }, `No loader for page: ${pageId}`),
		);
	}

	const { data, error } = useLoader(loader, loaderCtx);

	if (error) {
		return React.createElement(Box, { flexDirection: "column", flexGrow: 1, paddingX: 1 },
			React.createElement(Text, { color: "red" }, `Error: ${error}`),
		);
	}
	if (!data) {
		return React.createElement(Box, { flexDirection: "column", flexGrow: 1, paddingX: 1 },
			React.createElement(Text, { dimColor: true }, "Loading..."),
		);
	}

	switch (page.kind) {
		case "page":
		case "layout":
			return renderDashboardContent(data);
		case "list":
			return renderListContent(data);
		default:
			return React.createElement(Box, { flexDirection: "column", flexGrow: 1, paddingX: 1 },
				React.createElement(Text, { dimColor: true }, `Page kind: ${page.kind}`),
			);
	}
}

// ── Dashboard Rendering ─────────────────────────────────────────────

function renderDashboardContent(data: unknown): React.JSX.Element {
	if (typeof data !== "object" || data === null) {
		return React.createElement(Box, { flexDirection: "column", flexGrow: 1, paddingX: 1 },
			React.createElement(Text, { dimColor: true }, "No data"),
		);
	}

	const record = data as Record<string, unknown>;
	const stats: StatCardData[] = [];
	const sections: { title: string; content: React.ReactNode }[] = [];

	for (const [key, value] of Object.entries(record)) {
		if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
			stats.push({ label: formatLabel(key), value: String(value) });
		} else if (Array.isArray(value)) {
			sections.push({
				title: formatLabel(key),
				content: value.length > 0
					? React.createElement(React.Fragment, null,
						...value.map((item, i) =>
							React.createElement(Text, { key: i }, `  ${formatListItem(item)}`),
						),
					)
					: React.createElement(Text, { dimColor: true }, "None"),
			});
		} else if (typeof value === "object" && value !== null) {
			sections.push({
				title: formatLabel(key),
				content: React.createElement(React.Fragment, null,
					...Object.entries(value as Record<string, unknown>).map(([k, v]) =>
						React.createElement(Text, { key: k }, `  ${formatLabel(k)}: ${String(v)}`),
					),
				),
			});
		}
	}

	return React.createElement(Box, { flexDirection: "column", flexGrow: 1 },
		stats.length > 0
			? React.createElement(Box, { marginBottom: 1, paddingX: 1 }, React.createElement(StatGrid, { stats }))
			: null,
		React.createElement(Box, { flexDirection: "column", flexGrow: 1, paddingX: 1 },
			...sections.map((s, i) =>
				React.createElement(Box, { key: i, flexDirection: "column", marginBottom: 1 },
					React.createElement(Text, { bold: true, color: "cyan" }, `\u2500 ${s.title}`),
					React.createElement(Box, { flexDirection: "column", paddingLeft: 2 }, s.content),
				),
			),
		),
	);
}

// ── List Rendering ──────────────────────────────────────────────────

function renderListContent(data: unknown): React.JSX.Element {
	const items = findListItems(data);

	if (items.length === 0) {
		return React.createElement(Box, { flexDirection: "column", flexGrow: 1, paddingX: 1 },
			React.createElement(Text, { dimColor: true }, "No items"),
		);
	}

	return React.createElement(Box, { flexDirection: "column", flexGrow: 1, paddingX: 1 },
		...items.map((item, i) =>
			React.createElement(Text, { key: i }, `  ${formatListItem(item)}`),
		),
	);
}

/** Finds the first array property in data, or treats data as an array if it is one. */
function findListItems(data: unknown): readonly unknown[] {
	if (Array.isArray(data)) return data;
	if (typeof data === "object" && data !== null) {
		for (const value of Object.values(data as Record<string, unknown>)) {
			if (Array.isArray(value)) return value;
		}
	}
	return [];
}

// ── Form Rendering ──────────────────────────────────────────────────

interface FormContentProps {
	readonly page: PageObject;
}

function FormContent({ page }: FormContentProps): React.JSX.Element {
	const fields = page.fields ?? [];
	const [values] = useState<Record<string, string | boolean>>(() => {
		const initial: Record<string, string | boolean> = {};
		for (const field of fields) {
			if (field.defaultValue !== undefined) {
				initial[field.name] = typeof field.defaultValue === "number"
					? String(field.defaultValue)
					: field.defaultValue;
			} else {
				initial[field.name] = field.type === "checkbox" || field.type === "toggle" ? false : "";
			}
		}
		return initial;
	});

	if (fields.length === 0) {
		return React.createElement(Box, { flexDirection: "column", flexGrow: 1, paddingX: 1 },
			React.createElement(Text, { dimColor: true }, "No form fields defined"),
		);
	}

	return React.createElement(Box, { flexDirection: "column", flexGrow: 1, paddingX: 1 },
		...fields.map((field) =>
			React.createElement(Box, { key: field.name, marginBottom: 0 },
				React.createElement(Text, { bold: true }, `${field.label}: `),
				React.createElement(Text, null, String(values[field.name] ?? "")),
			),
		),
	);
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Converts camelCase or kebab-case to a human-readable label. */
function formatLabel(key: string): string {
	return key
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/[-_]/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Formats a list item for display — handles objects, strings, and primitives. */
function formatListItem(item: unknown): string {
	if (typeof item === "string") return item;
	if (typeof item === "number" || typeof item === "boolean") return String(item);
	if (typeof item === "object" && item !== null) {
		const record = item as Record<string, unknown>;
		const name = record["name"] ?? record["label"] ?? record["title"] ?? record["id"];
		if (typeof name === "string") {
			const status = record["status"] ?? record["state"];
			return status ? `${name} (${String(status)})` : name;
		}
		return JSON.stringify(item);
	}
	return String(item);
}
