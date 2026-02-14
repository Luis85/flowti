import { TFile, Setting } from "obsidian";
import type { App } from "obsidian";
import type { IVaultQueryService } from "../../infrastructure/services/VaultQueryService";
import type { IWorkspaceService } from "../../infrastructure/services/WorkspaceService";
import {
	EVENT_CATALOG,
	EVENT_CATEGORIES,
	type EventCatalogEntry,
} from "../../infrastructure/events/catalog";
import type { IEventBus } from "../../infrastructure/events/types";
import type { DiscoveredEvent } from "../../domain/discovery/types";
import type { CatalogCategoryConfig } from "../../domain/settings/settings";
import type { Subscription } from "../../domain/subscription/types";
import type { EventDefinition } from "../../domain/eventDefinition/types";
import {
	getEventDocPathResolved,
	generateEventDocContent,
} from "../eventDocTemplate";
import type {
	FlowEntry,
	SystemEntry,
	ActorEntry,
	ProductEntry,
} from "./types";

/** Elements returned by buildSplitLayout. */
export interface SplitLayout {
	dashboardEl: HTMLElement;
	splitEl: HTMLElement;
	masterEl: HTMLElement;
	searchHeaderEl: HTMLElement;
	searchInput: HTMLInputElement;
	masterTreeEl: HTMLElement;
	detailEl: HTMLElement;
}

/**
 * Creates the shared dashboard + split-pane layout used by both
 * EventCatalogView and DataExchangeHubView.
 *
 * Appends all elements to `wrapper`. The caller is responsible for
 * creating the wrapper div and rendering its top bar first.
 */
export function buildSplitLayout(wrapper: HTMLElement, opts: {
	searchPlaceholder: string;
	onSearch: (text: string) => void;
}): SplitLayout {
	const dashboardEl = wrapper.createDiv({ cls: "ft-catalog-dashboard ft-view-dashboard" });

	const splitEl = wrapper.createDiv({ cls: "ft-catalog-split ft-hidden ft-view-split" });

	const masterEl = splitEl.createDiv({ cls: "ft-catalog-master" });
	const searchHeaderEl = masterEl.createDiv({ cls: "ft-catalog-master-header" });
	const searchInput = searchHeaderEl.createEl("input", { cls: "ft-catalog-master-search" });
	searchInput.type = "text";
	searchInput.placeholder = opts.searchPlaceholder;
	searchInput.addEventListener("input", () => opts.onSearch(searchInput.value.toLowerCase()));

	const masterTreeEl = masterEl.createDiv({ cls: "ft-catalog-master-tree" });
	const detailEl = splitEl.createDiv({ cls: "ft-catalog-detail" });

	return { dashboardEl, splitEl, masterEl, searchHeaderEl, searchInput, masterTreeEl, detailEl };
}

/** Category label for discovered events without an assigned category */
export const UNCATEGORIZED_CATEGORY = "Uncategorized";

/** @deprecated Use UNCATEGORIZED_CATEGORY instead */
export const CUSTOM_EVENTS_CATEGORY = UNCATEGORIZED_CATEGORY;

/** Returns true if the event type belongs to a user-discovered event (not a system catalog event). */
export function isDiscoveredEvent(
	eventType: string,
	discoveredEvents: DiscoveredEvent[],
): boolean {
	return discoveredEvents.some((d) => d.eventName === eventType);
}

// ─────────────────────────────────────────────────────────────
// Frontmatter utilities
// ─────────────────────────────────────────────────────────────

export function readFrontmatter(vaultQuery: IVaultQueryService, path: string): Record<string, unknown> | undefined {
	return vaultQuery.getFrontmatter(path);
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
		row.addClass("ft-cursor-pointer");
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
	vaultQuery: IVaultQueryService,
	eventsFolder: string,
): EventCatalogEntry[] {
	return discoveredEvents.map((d) => {
		const sourceFm = readFrontmatter(vaultQuery, d.sourcePath);
		const docPath = getEventDocPathResolved(eventsFolder, d.eventName);
		const docFm = readFrontmatter(vaultQuery, docPath);

		return {
			type: d.eventName,
			category:
				fmString(docFm, "category") ??
				d.category ??
				UNCATEGORIZED_CATEGORY,
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
	vaultQuery: IVaultQueryService,
	eventsFolder: string,
): EventCatalogEntry[] {
	const discoveredEntries = discoveredToCatalogEntries(discoveredEvents, vaultQuery, eventsFolder);
	const allEntries = [...EVENT_CATALOG, ...discoveredEntries];
	const visibleCats = new Set(
		getOrderedCategories(catalogCategories).filter((c) => c.visible).map((c) => c.name),
	);
	// All user categories are always visible
	for (const entry of discoveredEntries) visibleCats.add(entry.category);
	// All EVENT_CATALOG entries originate from plugin code → system
	const discoveredTypes = new Set(discoveredEntries.map((e) => e.type));
	return allEntries.filter((e) => {
		if (!visibleCats.has(e.category)) return false;
		if (!showSystemEvents && !discoveredTypes.has(e.type)) return false;
		return true;
	});
}

export function resolveEntry(
	eventType: string,
	discoveredEvents: DiscoveredEvent[],
	vaultQuery: IVaultQueryService,
	eventsFolder: string,
): EventCatalogEntry | undefined {
	const system = EVENT_CATALOG.find((e) => e.type === eventType);
	if (system) return system;
	const discovered = discoveredToCatalogEntries(discoveredEvents, vaultQuery, eventsFolder)
		.find((e) => e.type === eventType);
	return discovered;
}

export function getConfiguredCount(
	catalogCategories: CatalogCategoryConfig[],
	showSystemEvents: boolean,
	discoveredEvents: DiscoveredEvent[],
	vaultQuery: IVaultQueryService,
	eventsFolder: string,
	subscriptions: Subscription[],
	definitions: EventDefinition[],
): number {
	return getVisibleEntries(catalogCategories, showSystemEvents, discoveredEvents, vaultQuery, eventsFolder)
		.filter((e) => isConfigured(e.type, subscriptions, definitions)).length;
}

export function getFollowedCount(
	catalogCategories: CatalogCategoryConfig[],
	showSystemEvents: boolean,
	discoveredEvents: DiscoveredEvent[],
	vaultQuery: IVaultQueryService,
	eventsFolder: string,
	notifiedTypes: Set<string>,
): number {
	return getVisibleEntries(catalogCategories, showSystemEvents, discoveredEvents, vaultQuery, eventsFolder)
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

export function findRelatedProducts(productEntries: ProductEntry[], criteria: RelatedCriteria): ProductEntry[] {
	return productEntries.filter((p) => {
		if (criteria.events?.length && p.events.some((e) => criteria.events!.includes(e))) return true;
		if (criteria.domains?.length && p.domains.some((d) => criteria.domains!.includes(d))) return true;
		if (criteria.services?.length && p.services.some((s) => criteria.services!.includes(s))) return true;
		return false;
	});
}

// ─────────────────────────────────────────────────────────────
// File helpers
// ─────────────────────────────────────────────────────────────

export function getSourcePath(discoveredEvents: DiscoveredEvent[], eventName: string): string | undefined {
	return discoveredEvents.find((d) => d.eventName === eventName)?.sourcePath;
}

export async function openFile(workspace: IWorkspaceService, path: string): Promise<void> {
	await workspace.openFile(path);
}

export async function openOrCreateEventDoc(
	vaultQuery: IVaultQueryService,
	workspace: IWorkspaceService,
	eventBus: IEventBus,
	eventsFolder: string,
	entry: EventCatalogEntry,
): Promise<void> {
	const docPath = getEventDocPathResolved(eventsFolder, entry.type);

	if (vaultQuery.fileExists(docPath)) {
		await workspace.openFile(docPath);
		return;
	}

	// Create via DocService — it will emit doc.created when done
	const content = generateEventDocContent(entry);
	await eventBus.emit("doc.create", {
		docType: "EventDoc" as const,
		name: entry.type,
		path: docPath,
		content,
		source: "openOrCreateEventDoc",
	});

	// Try to open the newly created file
	if (vaultQuery.fileExists(docPath)) {
		await workspace.openFile(docPath);
	}
}


// ─────────────────────────────────────────────────────────────
// Subscription form helpers
// ─────────────────────────────────────────────────────────────

export interface SubscriptionFormData {
	eventType: string;
	label: string;
	pathPattern: string;
	extension: string;
	namePattern: string;
}

export function renderSubscriptionForm(container: HTMLElement, opts: {
	isEdit: boolean;
	eventTypeLocked: boolean;
	formData: SubscriptionFormData;
	onSave: () => void;
	onCancel: () => void;
}): void {
	const { isEdit, eventTypeLocked, formData, onSave, onCancel } = opts;

	container.createEl("h3", {
		text: isEdit ? "Edit Watcher" : "New Watcher",
	});

	container.createEl("p", {
		text: "A watcher monitors a specific event type and filters matching files for processing. All filter fields use AND logic \u2014 a file must match every specified filter.",
		cls: "ft-text-muted ft-text-sm ft-mb-2",
	});

	const eventSetting = new Setting(container).setName("Event type");
	if (eventTypeLocked) {
		eventSetting.setDesc("Watched event type");
		eventSetting.addText((text) => {
			text.setValue(formData.eventType);
			text.setDisabled(true);
		});
	} else {
		eventSetting.setDesc(
			"The event type to watch for. Use dot notation (e.g. file.created, file.modified). Open the Event Catalog to browse all available types.",
		);
		eventSetting.addText((text) => {
			text.setPlaceholder("file.created");
			text.setValue(formData.eventType);
			text.onChange((value) => { formData.eventType = value; });
		});
	}

	new Setting(container)
		.setName("Label")
		.setDesc("A friendly name to identify this watcher in lists. Recommended when you have multiple watchers for the same event.")
		.addText((text) => {
			text.setPlaceholder("My subscription");
			text.setValue(formData.label);
			text.onChange((value) => { formData.label = value; });
		});

	new Setting(container)
		.setName("Path pattern")
		.setDesc("Glob pattern matched against the full vault path. Use ** for any depth, * for one level. Example: Reports/** matches all files under Reports/. Leave empty to match any path.")
		.addText((text) => {
			text.setPlaceholder("Reports/**");
			text.setValue(formData.pathPattern);
			text.onChange((value) => { formData.pathPattern = value; });
		});

	new Setting(container)
		.setName("Extension")
		.setDesc("File extension without the dot. Only files with this extension will match. Example: csv, md, json. Leave empty to match any extension.")
		.addText((text) => {
			text.setPlaceholder("csv");
			text.setValue(formData.extension);
			text.onChange((value) => { formData.extension = value; });
		});

	new Setting(container)
		.setName("Name pattern")
		.setDesc("Glob pattern matched against the filename only (not the full path). Example: report-*.csv matches report-jan.csv. Leave empty to match any filename.")
		.addText((text) => {
			text.setPlaceholder("report-*.csv");
			text.setValue(formData.namePattern);
			text.onChange((value) => { formData.namePattern = value; });
		});

	const btnRow = container.createDiv({ cls: "ft-flex ft-gap-2 ft-mt-4" });

	const cancelBtn = btnRow.createEl("button", {
		text: "Cancel",
		cls: "ft-btn ft-btn-ghost",
	});
	cancelBtn.addEventListener("click", onCancel);

	const saveBtn = btnRow.createEl("button", {
		text: isEdit ? "Save" : "Create",
		cls: "ft-btn ft-btn-primary",
	});
	saveBtn.addEventListener("click", onSave);
}

export function renderSubscriptionRow(container: HTMLElement, sub: Subscription, opts: {
	showEventType: boolean;
	eventBus: IEventBus;
	onEdit: () => void;
	onDelete: () => void;
}): void {
	const setting = new Setting(container);

	const filterParts: string[] = [];
	if (sub.filters.pathPattern) filterParts.push(`path: ${sub.filters.pathPattern}`);
	if (sub.filters.extension) filterParts.push(`ext: ${sub.filters.extension}`);
	if (sub.filters.namePattern) filterParts.push(`name: ${sub.filters.namePattern}`);
	const filterDesc = filterParts.length > 0 ? filterParts.join(", ") : "no filters";

	setting.setName(opts.showEventType ? (sub.label || sub.eventType) : (sub.label || "(no label)"));
	setting.setDesc(opts.showEventType ? `${sub.eventType} \u2014 ${filterDesc}` : filterDesc);

	setting.addToggle((toggle) => {
		toggle.setValue(sub.enabled);
		toggle.onChange((value) => {
			void opts.eventBus.emit("subscription.update", {
				subscriptionId: sub.id,
				enabled: value,
			});
		});
	});

	setting.addExtraButton((btn) => {
		btn.setIcon("pencil");
		btn.setTooltip("Edit");
		btn.onClick(opts.onEdit);
	});

	setting.addExtraButton((btn) => {
		btn.setIcon("trash-2");
		btn.setTooltip("Delete");
		btn.onClick(opts.onDelete);
	});
}
