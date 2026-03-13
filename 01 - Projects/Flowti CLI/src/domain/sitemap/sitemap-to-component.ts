/**
 * sitemap-to-component.ts — Converts sitemap PageObjects to ComponentDefinitions.
 *
 * Enables the sitemap to serve as a source for application visualization.
 * Each view maps to a component definition that the component system can
 * render, browse, and diagram.
 *
 * Mapping:
 *   View id           → ComponentDefinition.id
 *   View title        → ComponentDefinition.label
 *   View description  → ComponentDefinition.description
 *   View icon         → ComponentDefinition.icon
 *   View domain       → ComponentDefinition.domain
 *   navigate items    → ComponentDefinition.children
 *   parent            → ComponentDefinition.metadata.parent (+ reverse children for dynamic views)
 *   route             → ComponentDefinition.metadata.route
 *   handler/command   → ComponentDefinition.actions
 *   capabilities      → ComponentDefinition.actions (dynamic views)
 *   context           → ComponentDefinition.metadata.context
 *   configPath        → ComponentDefinition.metadata.configPath
 *   View status       → ComponentDefinition.metadata.status
 */

import type { Sitemap, ViewDefinition, StaticView, DynamicView, SitemapItem } from "../../infrastructure/sitemap-types.js";
import type { ComponentDefinition, ComponentAction, ComponentChild, ComponentKind } from "../make/component/component-types.js";

// ── Public API ──────────────────────────────────────────────────────

/**
 * Convert an entire sitemap into an array of ComponentDefinitions.
 * One component per view. Parent→child relationships are resolved so
 * that dynamic views also get children derived from `parent` fields.
 */
export function sitemapToComponents(sitemap: Sitemap): ComponentDefinition[] {
	// First pass: convert each view independently
	const components = Object.entries(sitemap.views).map(([id, view]) =>
		viewToComponent(id, view),
	);

	// Second pass: for dynamic views that have no navigate-derived children,
	// resolve children from the `parent` field on other views.
	const parentIndex = new Map<string, string[]>();
	for (const [id, view] of Object.entries(sitemap.views)) {
		if (view.parent) {
			const siblings = parentIndex.get(view.parent) ?? [];
			siblings.push(id);
			parentIndex.set(view.parent, siblings);
		}
	}

	for (const comp of components) {
		const childIds = parentIndex.get(comp.id);
		if (childIds && (!comp.children || comp.children.length === 0)) {
			comp.children = childIds.map((childId) => ({
				name: childId,
				slot: "navigation",
				optional: false,
			}));
		}
	}

	return components;
}

/**
 * Convert a single sitemap view to a ComponentDefinition.
 */
export function viewToComponent(id: string, view: ViewDefinition): ComponentDefinition {
	const isStatic = view.type === undefined || view.type === "menu";

	return {
		id,
		kind: resolveKind(view),
		label: view.title,
		description: view.description ?? "",
		domain: view.domain,
		icon: view.icon,
		prompts: [],
		files: [],
		metadata: buildMetadata(view),
		properties: [],
		actions: isStatic
			? extractActionsFromItems(view as StaticView)
			: extractActionsFromCapabilities(view as DynamicView),
		variants: [],
		states: [],
		children: isStatic
			? extractChildrenFromItems(view as StaticView)
			: [],
		nextSteps: [],
	};
}

// ── Kind resolution ─────────────────────────────────────────────────

/** Map a view to the closest ComponentKind. */
function resolveKind(view: ViewDefinition): ComponentKind {
	// Views are pages in the application navigation graph
	return "page";
}

// ── Metadata extraction ─────────────────────────────────────────────

function buildMetadata(view: ViewDefinition): Record<string, unknown> {
	const meta: Record<string, unknown> = {};

	if (view.status) meta.status = view.status;
	if (view.context) meta.context = [...view.context];
	if (view.parent) meta.parent = view.parent;
	if (view.route) meta.route = { ...view.route };

	const isDynamic = view.type === "dynamic";
	if (isDynamic) {
		const dv = view as DynamicView;
		if (dv.handler) meta.handler = dv.handler;
		if (dv.configPath) meta.configPath = dv.configPath;
	}

	return meta;
}

// ── Action extraction ───────────────────────────────────────────────

/** Extract actions from static view items (handler, command, signal). */
function extractActionsFromItems(view: StaticView): ComponentAction[] {
	const actions: ComponentAction[] = [];

	for (const entry of view.items) {
		if ("separator" in entry) continue;
		const item = entry as SitemapItem;

		if (item.handler) {
			actions.push({ name: item.handler, description: item.label });
		} else if (item.command) {
			actions.push({ name: item.command, description: item.label });
		} else if (item.signal) {
			actions.push({ name: `signal:${item.signal}`, description: item.label });
		}
		// navigate items become children, not actions
	}

	return actions;
}

/** Extract actions from dynamic view capabilities list. */
function extractActionsFromCapabilities(view: DynamicView): ComponentAction[] {
	if (!view.capabilities) return [];

	return view.capabilities.map((cap) => ({
		name: toActionName(cap),
		description: cap,
	}));
}

/** Convert a human-readable capability string to an action name. */
function toActionName(capability: string): string {
	return capability
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, "")
		.trim()
		.replace(/\s+/g, "-");
}

// ── Children extraction ─────────────────────────────────────────────

/** Extract child components from static view navigate items. */
function extractChildrenFromItems(view: StaticView): ComponentChild[] {
	const children: ComponentChild[] = [];

	for (const entry of view.items) {
		if ("separator" in entry) continue;
		const item = entry as SitemapItem;

		if (item.navigate) {
			children.push({
				name: item.navigate,
				slot: "navigation",
				optional: isOptionalNavigation(item),
			});
		}
	}

	return children;
}

/** A navigation target is optional if it has a disabled condition. */
function isOptionalNavigation(item: SitemapItem): boolean {
	return item.disabled !== undefined && item.disabled !== false;
}
