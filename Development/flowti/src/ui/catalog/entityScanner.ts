/**
 * Generic entity folder scanner shared by FlowsTab, ActorsTab, ProductsTab, and SystemsTab.
 *
 * Extracts the duplicated scan logic: folder resolution, frontmatter reading,
 * field extraction, and alphabetical sort. Non-conforming files are collected
 * but NOT written to during scan (TD-32).
 */

import { TFile, TFolder } from "obsidian";
import { EVENT_CATALOG, type EventCatalogEntry } from "../../infrastructure/events/catalog";
import {
	readFrontmatter, fmString, fmStringArray,
	discoveredToCatalogEntries,
} from "./helpers";
import type { NonConformingFile } from "./helpers";
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

/** Result returned by scanEntityFolder — entries plus files needing normalization. */
export interface ScanResult<T> {
	entries: T[];
	nonConforming: NonConformingFile[];
}

// ─────────────────────────────────────────────────────────────
// Scanner
// ─────────────────────────────────────────────────────────────

/**
 * Scans an entity folder and returns sorted entries plus non-conforming files.
 *
 * Handles folder resolution, TFile filtering, frontmatter extraction,
 * and alphabetical sort — the common work duplicated across entity tabs.
 * Non-conforming files are collected but NOT written during scan (TD-32).
 */
export function scanEntityFolder<T extends { name: string }>(
	config: EntityScanConfig<T>,
	deps: CatalogComponentDeps,
): ScanResult<T> {
	const folderPath = deps.getEntityFolder(config.entityType);
	const folder = deps.app.vault.getAbstractFileByPath(folderPath);

	if (!folder || !(folder instanceof TFolder)) {
		return { entries: [], nonConforming: [] };
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
	const nonConforming: NonConformingFile[] = [];

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

		// Collect non-conforming files for deferred normalization (TD-32)
		if (!fm || fm.type !== config.docType) {
			nonConforming.push({
				file: child,
				docType: config.docType,
				nameField: config.normalizeNameKey,
				name,
				metadata: {
					description,
					domains,
					services,
					...(config.readEvents !== false ? { events } : {}),
				},
			});
		}
	}

	return {
		entries: entries.sort((a, b) => a.name.localeCompare(b.name)),
		nonConforming,
	};
}
