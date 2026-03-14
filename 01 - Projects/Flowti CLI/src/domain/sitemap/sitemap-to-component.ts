/**
 * sitemap-to-component.ts — Converts sitemap PageObjects to ComponentDefinitions.
 *
 * Enables the sitemap to serve as a source for application visualization.
 * Each page maps to a component definition that the component system can
 * render, browse, and diagram.
 *
 * Mapping:
 *   Page id           → ComponentDefinition.id
 *   Page label        → ComponentDefinition.label
 *   Page description  → ComponentDefinition.description
 *   Page icon         → ComponentDefinition.icon
 *   Page domain       → ComponentDefinition.domain
 *   Page kind         → ComponentDefinition.kind
 *   navigate actions  → ComponentDefinition.children
 *   parent            → ComponentDefinition.metadata.parent (+ reverse children)
 *   route             → ComponentDefinition.metadata.route
 *   handler/command   → ComponentDefinition.actions
 *   context           → ComponentDefinition.metadata.context
 *   configPath        → ComponentDefinition.metadata.configPath
 *   status            → ComponentDefinition.metadata.status
 */

import type { Sitemap, PageObject, PageAction } from "../../infrastructure/sitemap-types.js";
import type { ComponentDefinition, ComponentAction, ComponentChild, ComponentKind } from "../make/component/component-types.js";

// ── Public API ──────────────────────────────────────────────────────

/**
 * Convert an entire sitemap into an array of ComponentDefinitions.
 * One component per page. Parent→child relationships are resolved so
 * that pages with no navigate-derived children also get children
 * derived from the `parent` field on other pages.
 */
export function sitemapToComponents(sitemap: Sitemap): ComponentDefinition[] {
	// First pass: convert each page independently
	const components = Object.entries(sitemap.pages).map(([id, page]) =>
		pageToComponent(id, page),
	);

	// Second pass: resolve children from parent fields
	const parentIndex = new Map<string, string[]>();
	for (const [id, page] of Object.entries(sitemap.pages)) {
		if (page.parent) {
			const siblings = parentIndex.get(page.parent) ?? [];
			siblings.push(id);
			parentIndex.set(page.parent, siblings);
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
 * Convert a single sitemap page to a ComponentDefinition.
 */
export function pageToComponent(id: string, page: PageObject): ComponentDefinition {
	return {
		id,
		kind: resolveKind(page),
		label: page.label,
		description: page.description ?? "",
		domain: page.domain,
		icon: page.icon,
		prompts: [],
		files: [],
		metadata: buildMetadata(page),
		properties: [],
		actions: extractActionsFromPage(page),
		variants: [],
		states: [],
		children: extractChildrenFromPage(page),
		nextSteps: [],
	};
}

// ── Kind resolution ─────────────────────────────────────────────────

/** Map a page kind to the closest ComponentKind. */
function resolveKind(page: PageObject): ComponentKind {
	// PageKind is a superset of ComponentKind; most map directly
	return page.kind as ComponentKind;
}

// ── Metadata extraction ─────────────────────────────────────────────

function buildMetadata(page: PageObject): Record<string, unknown> {
	const meta: Record<string, unknown> = {};

	if (page.status) meta.status = page.status;
	if (page.context) meta.context = [...page.context];
	if (page.parent) meta.parent = page.parent;
	if (page.route) meta.route = { ...page.route };
	if (page.configPath) meta.configPath = page.configPath;

	return meta;
}

// ── Action extraction ───────────────────────────────────────────────

/** Extract component actions from page actions (handler, command, signal types). */
function extractActionsFromPage(page: PageObject): ComponentAction[] {
	const actions: ComponentAction[] = [];

	for (const action of page.actions) {
		if (action.type === "handler" || action.type === "command") {
			actions.push({ name: action.target ?? action.name, description: action.label });
		} else if (action.type === "signal") {
			actions.push({ name: `signal:${action.target}`, description: action.label });
		}
		// navigate and form actions become children, not component actions
	}

	return actions;
}

// ── Children extraction ─────────────────────────────────────────────

/** Extract child components from navigate and form actions. */
function extractChildrenFromPage(page: PageObject): ComponentChild[] {
	const children: ComponentChild[] = [];

	for (const action of page.actions) {
		if ((action.type === "navigate" || action.type === "form") && action.target) {
			children.push({
				name: action.target,
				slot: "navigation",
				optional: isOptionalAction(action),
			});
		}
	}

	return children;
}

/** An action target is optional if it has a disabled condition. */
function isOptionalAction(action: PageAction): boolean {
	return action.disabled !== undefined && action.disabled !== false;
}
