/**
 * sitemap-loader.ts — Parse and validate configs/sitemap.json.
 *
 * Reads the sitemap file, validates its structure against the schema,
 * and returns a typed Sitemap object. Reports clear error messages
 * for malformed definitions.
 */

import type { IFileSystem } from "./types.js";
import type {
	Sitemap,
	ViewDefinition,
} from "./sitemap-types.js";

// ── Public API ──────────────────────────────────────────────────────

export interface LoadResult {
	readonly ok: boolean;
	readonly sitemap?: Sitemap;
	readonly errors: readonly string[];
}

/** Load and validate sitemap from a file path. */
export function loadSitemap(sitemapPath: string, fs: IFileSystem): LoadResult {
	if (!fs.existsSync(sitemapPath)) {
		return { ok: false, errors: [`Sitemap file not found: ${sitemapPath}`] };
	}

	let raw: unknown;
	try {
		const content = fs.readFileSync(sitemapPath, "utf-8");
		raw = JSON.parse(content);
	} catch (err) {
		return { ok: false, errors: [`Failed to parse sitemap JSON: ${(err as Error).message}`] };
	}

	return validateSitemap(raw);
}

/** Validate a parsed JSON value as a Sitemap. */
export function validateSitemap(raw: unknown): LoadResult {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		return { ok: false, errors: ["Sitemap must be a JSON object"] };
	}

	const obj = raw as Record<string, unknown>;
	const headerErrors = validateSitemapHeader(obj);
	if (headerErrors) return { ok: false, errors: headerErrors };

	const views = obj.views as Record<string, unknown>;
	const viewIds = Object.keys(views);
	const errors: string[] = [];

	if (viewIds.length === 0) {
		errors.push("Sitemap must define at least one view");
	}

	const validatedViews: Record<string, ViewDefinition> = {};
	for (const id of viewIds) {
		const viewErrors = validateView(id, views[id], viewIds);
		if (viewErrors.length > 0) {
			errors.push(...viewErrors);
		} else {
			validatedViews[id] = views[id] as ViewDefinition;
		}
	}

	if (errors.length > 0) return { ok: false, errors };
	return { ok: true, sitemap: { version: 1, views: validatedViews }, errors: [] };
}

function validateSitemapHeader(obj: Record<string, unknown>): string[] | null {
	const errors: string[] = [];
	if (obj.version !== 1) {
		errors.push(`Unsupported sitemap version: ${String(obj.version)} (expected 1)`);
	}
	if (typeof obj.views !== "object" || obj.views === null || Array.isArray(obj.views)) {
		errors.push("Sitemap must have a 'views' object");
		return errors;
	}
	return errors.length > 0 ? errors : null;
}

// ── View validation ─────────────────────────────────────────────────

function validateView(id: string, raw: unknown, allViewIds: string[]): string[] {
	const prefix = `View "${id}"`;

	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		return [`${prefix}: must be an object`];
	}

	const view = raw as Record<string, unknown>;
	const type = view.type ?? "menu";

	if (type !== "menu" && type !== "dynamic") {
		return [`${prefix}: unknown type "${String(type)}" (expected "menu" or "dynamic")`];
	}

	const errors: string[] = [];
	if (typeof view.title !== "string" || view.title.length === 0) {
		errors.push(`${prefix}: must have a non-empty "title" string`);
	}
	errors.push(...validateContext(view.context, prefix));
	errors.push(...validateViewType(type, view, id, allViewIds, prefix));
	return errors;
}

function validateContext(context: unknown, prefix: string): string[] {
	if (context === undefined) return [];
	if (!Array.isArray(context)) return [`${prefix}: "context" must be an array`];
	const errors: string[] = [];
	for (const c of context) {
		if (c !== "project") {
			errors.push(`${prefix}: unknown context "${String(c)}" (expected "project")`);
		}
	}
	return errors;
}

function validateViewType(
	type: string, view: Record<string, unknown>,
	id: string, allViewIds: string[], prefix: string,
): string[] {
	const errors: string[] = [];
	if (type === "dynamic") {
		if (typeof view.handler !== "string" || view.handler.length === 0) {
			errors.push(`${prefix}: dynamic view must have a "handler" string`);
		}
		if (view.items !== undefined) {
			errors.push(...validateItems(id, view.items, allViewIds));
		}
	}
	if (type === "menu") {
		if (!Array.isArray(view.items)) {
			errors.push(`${prefix}: static view must have an "items" array`);
		} else {
			errors.push(...validateItems(id, view.items, allViewIds));
		}
	}
	return errors;
}

// ── Items validation ────────────────────────────────────────────────

function validateItems(viewId: string, items: unknown, allViewIds: string[]): string[] {
	if (!Array.isArray(items)) {
		return [`View "${viewId}": "items" must be an array`];
	}
	const errors: string[] = [];
	const keys = new Set<string>();
	const autoIndex = { next: 1 };
	for (let i = 0; i < items.length; i++) {
		errors.push(...validateEntry(viewId, i, items[i], allViewIds, keys, autoIndex));
	}
	return errors;
}

// ── Entry validation ────────────────────────────────────────────────

function validateEntry(
	viewId: string,
	index: number,
	raw: unknown,
	allViewIds: string[],
	keys: Set<string>,
	autoIndex: { next: number },
): string[] {
	const prefix = `View "${viewId}" item[${index}]`;

	if (typeof raw !== "object" || raw === null) {
		return [`${prefix}: must be an object`];
	}

	const entry = raw as Record<string, unknown>;
	const type = entry.type;

	if (typeof type !== "string") {
		return [`${prefix}: must have a "type" field (one of: "item", "separator", "slot", "listProvider")`];
	}

	switch (type) {
		case "separator": return [];
		case "slot": return validateSlot(entry, prefix);
		case "listProvider": return validateListProvider(entry, prefix);
		case "item": {
			const errors: string[] = [];
			errors.push(...validateKey(entry, prefix, keys, autoIndex));
			if (typeof entry.label !== "string" || entry.label.length === 0) {
				errors.push(`${prefix}: must have a non-empty "label" string`);
			}
			errors.push(...validateAction(entry, prefix, allViewIds));
			errors.push(...validateDisabled(entry, prefix));
			return errors;
		}
		default:
			return [`${prefix}: unknown type "${type}" (expected: "item", "separator", "slot", "listProvider")`];
	}
}

function validateSlot(entry: Record<string, unknown>, prefix: string): string[] {
	if (typeof entry.slot !== "string" || entry.slot.length === 0) {
		return [`${prefix}: "slot" must be a non-empty string`];
	}
	return [];
}

function validateListProvider(entry: Record<string, unknown>, prefix: string): string[] {
	if (typeof entry.listProvider !== "string" || entry.listProvider.length === 0) {
		return [`${prefix}: "listProvider" must be a non-empty string`];
	}
	return [];
}

function validateKey(entry: Record<string, unknown>, prefix: string, keys: Set<string>, autoIndex: { next: number }): string[] {
	if (entry.key === undefined || entry.key === null || entry.key === "") {
		let candidate = String(autoIndex.next);
		while (keys.has(candidate)) candidate = String(++autoIndex.next);
		entry.key = candidate;
		autoIndex.next++;
	}
	if (typeof entry.key !== "string" || entry.key.length === 0) {
		return [`${prefix}: must have a non-empty "key" string`];
	}
	if (keys.has(entry.key)) {
		return [`${prefix}: duplicate key "${entry.key}"`];
	}
	keys.add(entry.key);
	return [];
}

const ACTION_KEYS = ["navigate", "command", "handler", "signal"] as const;
const VALID_SIGNALS = new Set(["back", "quit", "start"]);

function validateAction(
	entry: Record<string, unknown>,
	prefix: string,
	allViewIds: string[],
): string[] {
	const present = ACTION_KEYS.filter((a) => entry[a] !== undefined);
	if (present.length === 0) {
		return [`${prefix}: must have exactly one action (navigate, command, handler, or signal)`];
	}
	if (present.length > 1) {
		return [`${prefix}: has multiple actions (${present.join(", ")}) — exactly one is allowed`];
	}
	return validateActionValue(present[0], entry[present[0]], prefix, allViewIds);
}

function validateActionValue(action: string, value: unknown, prefix: string, allViewIds: string[]): string[] {
	if (action === "navigate") {
		if (typeof value !== "string") return [`${prefix}: "navigate" must be a string`];
		if (!allViewIds.includes(value)) return [`${prefix}: navigates to unknown view "${value}"`];
		return [];
	}
	if ((action === "command" || action === "handler") && typeof value !== "string") {
		return [`${prefix}: "${action}" must be a string`];
	}
	if (action === "signal" && (typeof value !== "string" || !VALID_SIGNALS.has(value))) {
		return [`${prefix}: "signal" must be "back", "quit", or "start"`];
	}
	return [];
}

function validateDisabled(entry: Record<string, unknown>, prefix: string): string[] {
	if (entry.disabled === undefined) return [];
	const d = entry.disabled;
	if (typeof d === "boolean" || typeof d === "string") return [];
	if (typeof d === "object" && d !== null && "unless" in d) {
		if (typeof (d as Record<string, unknown>).unless !== "string") {
			return [`${prefix}: "disabled.unless" must be a string`];
		}
		return [];
	}
	return [`${prefix}: "disabled" must be boolean, string, or { unless: string }`];
}
