/**
 * Generic entity folder scanner shared by FlowsTab, ActorsTab, ProductsTab, and SystemsTab.
 *
 * Extracts the duplicated scan logic: folder resolution, frontmatter reading,
 * field extraction, normalize-on-read, and alphabetical sort.
 */

import { TFile, TFolder } from "obsidian";
import { EVENT_CATALOG, type EventCatalogEntry } from "../../infrastructure/events/catalog";
import {
	readFrontmatter, fmString, fmStringArray, normalizeDocFrontmatter,
	discoveredToCatalogEntries,
} from "./helpers";
import type { CatalogComponentDeps } from "./types";
import type { EntityType } from "../../domain/docs/pathResolver";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/** Raw data extracted from frontmatter before tab-specific mapping. */
export interface RawScanEntry {
	name: string;
	description: string;
	events: string[];
	domains: string[];
	services: string[];
	filePath: string;
	fm: Record<string, unknown> | undefined;
}

/** Context provided to mapEntry callbacks. */
export interface ScanContext {
	entryMap: Map<string, EventCatalogEntry>;
	allEntries: EventCatalogEntry[];
}

/** Configuration for a scanEntityFolder call. */
export interface EntityScanConfig<T> {
	/** Which entity folder to scan (e.g. "flows", "actors"). */
	entityType: EntityType;
	/** Frontmatter fields to try for the name, in priority order. */
	nameFields: string[];
	/** Expected frontmatter `type` value (e.g. "FlowDoc"). */
	docType: string;
	/** Key used by normalizeDocFrontmatter for the name field (e.g. "flow"). */
	normalizeNameKey: string;
	/** Extra frontmatter fields merged into `services` (e.g. ["Systems"]). */
	extraServiceFields?: string[];
	/** Extra frontmatter fields merged into `domains` (e.g. ["Domains"]). */
	extraDomainFields?: string[];
	/** Whether to read `events` from frontmatter. Default true. Set false for Systems. */
	readEvents?: boolean;
	/** Maps raw scan data to the tab-specific entry type. */
	mapEntry: (raw: RawScanEntry, context: ScanContext) => T;
}

// ─────────────────────────────────────────────────────────────
// Scanner
// ─────────────────────────────────────────────────────────────

/**
 * Scans an entity folder and returns sorted entries.
 *
 * Handles folder resolution, TFile filtering, frontmatter extraction,
 * doc normalization, and alphabetical sort — the common work duplicated
 * across FlowsTab, ActorsTab, ProductsTab, and SystemsTab.
 */
export function scanEntityFolder<T extends { name: string }>(
	config: EntityScanConfig<T>,
	deps: CatalogComponentDeps,
): T[] {
	const folderPath = deps.getEntityFolder(config.entityType);
	const folder = deps.app.vault.getAbstractFileByPath(folderPath);

	if (!folder || !(folder instanceof TFolder)) {
		return [];
	}

	const allEntries = [
		...EVENT_CATALOG,
		...discoveredToCatalogEntries(
			deps.getState().discoveredEvents,
			deps.vaultQuery,
			deps.getEntityFolder("events"),
		),
	];
	const entryMap = new Map(allEntries.map((e) => [e.type, e]));
	const context: ScanContext = { entryMap, allEntries };
	const entries: T[] = [];

	for (const child of folder.children) {
		if (!(child instanceof TFile) || child.extension !== "md") continue;

		const fm = readFrontmatter(deps.vaultQuery, child.path);

		// Resolve name from frontmatter fallback fields
		let name: string | undefined;
		if (fm) {
			for (const field of config.nameFields) {
				name = fmString(fm, field);
				if (name) break;
			}
		}
		name ??= child.basename;

		const description = (fm && fmString(fm, "description")) ?? "";
		const events = config.readEvents !== false ? fmStringArray(fm, "events") : [];
		const domains = [
			...fmStringArray(fm, "domains"),
			...(config.extraDomainFields?.flatMap((f) => fmStringArray(fm, f)) ?? []),
		];
		const services = [
			...fmStringArray(fm, "services"),
			...(config.extraServiceFields?.flatMap((f) => fmStringArray(fm, f)) ?? []),
		];

		const raw: RawScanEntry = { name, description, events, domains, services, filePath: child.path, fm };
		entries.push(config.mapEntry(raw, context));

		// Auto-normalize non-conforming frontmatter
		if (!fm || fm.type !== config.docType) {
			normalizeDocFrontmatter(
				deps.app, child, config.docType, config.normalizeNameKey, name,
				{
					description,
					domains,
					services,
					...(config.readEvents !== false ? { events } : {}),
				},
			);
		}
	}

	return entries.sort((a, b) => a.name.localeCompare(b.name));
}
