import { TFile } from "obsidian";
import type { App } from "obsidian";
import {
	EVENT_CATALOG,
	EVENT_CATEGORIES,
	type EventCatalogEntry,
} from "../../infrastructure/events/catalog";
import type { DiscoveredEvent } from "../../domain/discovery/types";
import type { CatalogCategoryConfig } from "../../domain/settings/settings";
import type { Subscription } from "../../domain/subscription/types";
import type { EventDefinition } from "../../domain/eventDefinition/types";
import {
	getEventDocPathResolved,
	generateEventDocContent,
} from "../eventDocTemplate";
import type { FileSystemClient } from "../../infrastructure/filesystem/FileSystemClient";
import type {
	FlowEntry,
	SystemEntry,
	ActorEntry,
} from "./types";

/** Category label for user-defined discovered events */
export const CUSTOM_EVENTS_CATEGORY = "Custom Events";

// ─────────────────────────────────────────────────────────────
// Frontmatter utilities
// ─────────────────────────────────────────────────────────────

export function readFrontmatter(app: App, path: string): Record<string, unknown> | undefined {
	const file = app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) return undefined;
	return app.metadataCache.getFileCache(file)?.frontmatter as
		| Record<string, unknown>
		| undefined;
}

export function fmString(fm: Record<string, unknown> | undefined, key: string): string | undefined {
	const val = fm?.[key];
	return typeof val === "string" && val.trim() ? val.trim() : undefined;
}

export function fmStringArray(fm: Record<string, unknown> | undefined, key: string): string[] {
	if (!fm) return [];
	const val = fm[key];
	if (!Array.isArray(val)) return [];
	return val.filter((v: unknown) => typeof v === "string") as string[];
}

export function normalizeDocFrontmatter(
	app: App,
	file: TFile,
	docType: string,
	nameField: string,
	name: string,
	metadata: { description: string; events?: string[]; domains: string[]; services: string[] },
): void {
	void app.fileManager.processFrontMatter(file, (fm) => {
		fm.type = docType;
		fm[nameField] = name;
		if (!fm.description) fm.description = metadata.description;
		fm.domains = metadata.domains;
		fm.services = metadata.services;
		if (metadata.events !== undefined) {
			fm.events = metadata.events;
		}
		if (!fm.created) fm.created = new Date().toISOString();
	});
}

// ─────────────────────────────────────────────────────────────
// Rendering helpers
// ─────────────────────────────────────────────────────────────

export function renderStat(container: HTMLElement, value: string, label: string): void {
	const stat = container.createDiv({ cls: "ft-catalog-stat" });
	stat.createDiv({ text: value, cls: "ft-catalog-stat-value" });
	stat.createDiv({ text: label, cls: "ft-catalog-stat-label" });
}

export function renderRelatedSection(
	container: HTMLElement,
	heading: string,
	items: { name: string; onClick: () => void }[],
): void {
	if (items.length === 0) return;
	const section = container.createDiv({ cls: "ft-detail-section" });
	const sectionHeader = section.createDiv({ cls: "ft-detail-section-header" });
	sectionHeader.createSpan({
		text: `${heading} (${items.length})`,
		cls: "ft-heading ft-heading-sm",
	});
	for (const item of items) {
		const row = section.createDiv({ cls: "ft-catalog-row" });
		row.style.cursor = "pointer";
		const link = row.createSpan({ text: item.name, cls: "ft-event-type" });
		link.addEventListener("click", item.onClick);
	}
}

// ─────────────────────────────────────────────────────────────
// State query helpers
// ─────────────────────────────────────────────────────────────

export function isConfigured(
	eventType: string,
	subscriptions: Subscription[],
	definitions: EventDefinition[],
): boolean {
	return (
		subscriptions.some((s) => s.eventType === eventType) ||
		definitions.some((d) => d.sourceEventType === eventType)
	);
}

export function isSystemOnly(events: EventCatalogEntry[]): boolean {
	return events.length > 0 && events.every((e) => e.tags.includes("system"));
}

export function getOrderedCategories(catalogCategories: CatalogCategoryConfig[]): CatalogCategoryConfig[] {
	const knownNames = new Set<string>(EVENT_CATEGORIES as readonly string[]);
	const result = catalogCategories.filter((c) => knownNames.has(c.name));
	const settingsNames = new Set(result.map((c) => c.name));
	for (const cat of EVENT_CATEGORIES) {
		if (!settingsNames.has(cat)) {
			result.push({ name: cat, visible: true });
		}
	}
	return result;
}

export function discoveredToCatalogEntries(
	discoveredEvents: DiscoveredEvent[],
	app: App,
	eventsFolder: string,
): EventCatalogEntry[] {
	return discoveredEvents.map((d) => {
		const sourceFm = readFrontmatter(app, d.sourcePath);
		const docPath = getEventDocPathResolved(eventsFolder, d.eventName);
		const docFm = readFrontmatter(app, docPath);

		return {
			type: d.eventName,
			category: CUSTOM_EVENTS_CATEGORY,
			description:
				fmString(docFm, "description") ??
				fmString(sourceFm, "description") ??
				`Custom event (triggered ${d.triggerCount}x)`,
			direction:
				fmString(docFm, "direction") ?? "User → EventBus",
			domain:
				fmString(docFm, "domain") ?? "custom",
			services:
				fmString(docFm, "services") ?? "Discovery",
			stability: (fmString(docFm, "stability") as EventCatalogEntry["stability"]) ?? "experimental",
			visibility: (fmString(docFm, "visibility") as EventCatalogEntry["visibility"]) ?? "user-facing",
			tags: [],
		};
	});
}

export function getVisibleEntries(
	catalogCategories: CatalogCategoryConfig[],
	showSystemEvents: boolean,
	discoveredEvents: DiscoveredEvent[],
	app: App,
	eventsFolder: string,
): EventCatalogEntry[] {
	const allEntries = [...EVENT_CATALOG, ...discoveredToCatalogEntries(discoveredEvents, app, eventsFolder)];
	const visibleCats = new Set(
		getOrderedCategories(catalogCategories).filter((c) => c.visible).map((c) => c.name),
	);
	visibleCats.add(CUSTOM_EVENTS_CATEGORY);
	return allEntries.filter((e) => {
		if (!visibleCats.has(e.category)) return false;
		if (!showSystemEvents && e.tags.includes("system")) return false;
		return true;
	});
}

export function resolveEntry(
	eventType: string,
	discoveredEvents: DiscoveredEvent[],
	app: App,
	eventsFolder: string,
): EventCatalogEntry | undefined {
	const system = EVENT_CATALOG.find((e) => e.type === eventType);
	if (system) return system;
	const discovered = discoveredToCatalogEntries(discoveredEvents, app, eventsFolder)
		.find((e) => e.type === eventType);
	return discovered;
}

export function getConfiguredCount(
	catalogCategories: CatalogCategoryConfig[],
	showSystemEvents: boolean,
	discoveredEvents: DiscoveredEvent[],
	app: App,
	eventsFolder: string,
	subscriptions: Subscription[],
	definitions: EventDefinition[],
): number {
	return getVisibleEntries(catalogCategories, showSystemEvents, discoveredEvents, app, eventsFolder)
		.filter((e) => isConfigured(e.type, subscriptions, definitions)).length;
}

export function getFollowedCount(
	catalogCategories: CatalogCategoryConfig[],
	showSystemEvents: boolean,
	discoveredEvents: DiscoveredEvent[],
	app: App,
	eventsFolder: string,
	notifiedTypes: Set<string>,
): number {
	return getVisibleEntries(catalogCategories, showSystemEvents, discoveredEvents, app, eventsFolder)
		.filter((e) => notifiedTypes.has(e.type)).length;
}

// ─────────────────────────────────────────────────────────────
// Cross-reference helpers
// ─────────────────────────────────────────────────────────────

export interface RelatedCriteria {
	events?: string[];
	domains?: string[];
	services?: string[];
}

export function findRelatedFlows(flowEntries: FlowEntry[], criteria: RelatedCriteria): FlowEntry[] {
	return flowEntries.filter((f) => {
		if (criteria.events?.length && f.events.some((e) => criteria.events!.includes(e))) return true;
		if (criteria.domains?.length && f.domains.some((d) => criteria.domains!.includes(d))) return true;
		if (criteria.services?.length && f.services.some((s) => criteria.services!.includes(s))) return true;
		return false;
	});
}

export function findRelatedSystems(systemEntries: SystemEntry[], criteria: RelatedCriteria): SystemEntry[] {
	return systemEntries.filter((s) => {
		if (criteria.events?.length && s.events.some((e) => criteria.events!.includes(e.type))) return true;
		if (criteria.domains?.length && s.domains.some((d) => criteria.domains!.includes(d))) return true;
		if (criteria.services?.length && s.services.some((sv) => criteria.services!.includes(sv))) return true;
		return false;
	});
}

export function findRelatedActors(actorEntries: ActorEntry[], criteria: RelatedCriteria): ActorEntry[] {
	return actorEntries.filter((a) => {
		if (criteria.events?.length && a.events.some((e) => criteria.events!.includes(e))) return true;
		if (criteria.domains?.length && a.domains.some((d) => criteria.domains!.includes(d))) return true;
		if (criteria.services?.length && a.services.some((s) => criteria.services!.includes(s))) return true;
		return false;
	});
}

// ─────────────────────────────────────────────────────────────
// File helpers
// ─────────────────────────────────────────────────────────────

export function getSourcePath(discoveredEvents: DiscoveredEvent[], eventName: string): string | undefined {
	return discoveredEvents.find((d) => d.eventName === eventName)?.sourcePath;
}

export async function openFile(app: App, path: string): Promise<void> {
	const file = app.vault.getAbstractFileByPath(path);
	if (file && file instanceof TFile) {
		const leaf = app.workspace.getLeaf(false);
		await leaf.openFile(file);
	}
}

export async function openOrCreateEventDoc(
	app: App,
	fileSystemClient: FileSystemClient,
	eventsFolder: string,
	entry: EventCatalogEntry,
): Promise<void> {
	const docPath = getEventDocPathResolved(eventsFolder, entry.type);

	let file = app.vault.getAbstractFileByPath(docPath);

	if (!file) {
		const content = generateEventDocContent(entry);
		try {
			await fileSystemClient.createFile(docPath, content, {
				createFolders: true,
			});
		} catch (err) {
			console.error(`[Flowti] Failed to create event doc: ${docPath}`, err);
			return;
		}
		file = app.vault.getAbstractFileByPath(docPath);
	}

	if (file && file instanceof TFile) {
		const leaf = app.workspace.getLeaf(false);
		await leaf.openFile(file);
	}
}
