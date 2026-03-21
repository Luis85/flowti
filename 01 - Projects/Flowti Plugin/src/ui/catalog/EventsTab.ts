import { TFile, TFolder } from "obsidian";
import {
	EVENT_CATALOG,
	type EventCatalogEntry,
} from "../../infrastructure/events/catalog";
import type { CatalogComponentDeps, CatalogState, CategoryEntry } from "./types";
import {
	UNCATEGORIZED_CATEGORY,
	readFrontmatter,
	fmString,
	fmStringArray,
	isConfigured,
	getOrderedCategories,
	discoveredToCatalogEntries,
	getVisibleEntries,
	resolveEntry,
	normalizeNonConformingFiles,
} from "./helpers";
import type { NonConformingFile } from "./helpers";
import { EventDetailPanel } from "./EventDetailPanel";
import { renderEventsSettingsPanel } from "./EventsSettingsPanel";
import { renderMasterCategory, type CategoryRenderContext } from "./EventsCategoryRenderer";

/**
 * Events tab component — filter chips, master tree, detail panel,
 * category scanning, settings panel, and category doc helpers.
 *
 * Rendering of the settings panel and category tree items is extracted into:
 * - {@link renderEventsSettingsPanel}
 * - {@link renderMasterCategory}
 */
export class EventsTab {
	private selectedEventType: string | null = null;
	private filterChipConfigured = false;
	private filterChipFollowed = false;
	private categoryEntries: CategoryEntry[] = [];
	private detailPanel: EventDetailPanel;

	constructor(
		private masterTreeEl: HTMLElement,
		private detailPanelEl: HTMLElement,
		private settingsPanel: HTMLElement,
		private countBadge: HTMLElement,
		private deps: CatalogComponentDeps,
	) {
		this.detailPanel = new EventDetailPanel(detailPanelEl, deps, () => {
			this.selectedEventType = null;
			this.renderMasterTree();
			this.renderDetail();
		});
	}

	// ── Public API ──────────────────────────────────────────────

	render(): void {
		this.renderMasterTree();
		this.renderDetail();
	}

	scan(): void {
		this.scanCategories();
	}

	getEntries(): CategoryEntry[] {
		return this.categoryEntries;
	}

	getSelectedEventType(): string | null {
		return this.selectedEventType;
	}

	setSelectedEventType(eventType: string | null): void {
		this.selectedEventType = eventType;
	}

	getFilterChipConfigured(): boolean { return this.filterChipConfigured; }
	getFilterChipFollowed(): boolean { return this.filterChipFollowed; }

	/** Called by orchestrator to expand a category when navigating to an event */
	ensureCategoryExpanded(eventType: string): void {
		const state = this.deps.getState();
		const entry = resolveEntry(eventType, state.discoveredEvents, this.deps.vaultQuery, this.deps.getEntityFolder("events"));
		if (entry && state.collapsedCategories.has(entry.category)) {
			state.collapsedCategories.delete(entry.category);
		}
	}

	/** Count badge text for the orchestrator's updateCountBadge */
	getCountText(): string {
		const state = this.deps.getState();
		const visible = getVisibleEntries(state.catalogCategories, state.showSystemEvents, state.discoveredEvents, this.deps.vaultQuery, this.deps.getEntityFolder("events"));
		const total = visible.length;
		const hasFilter = state.filterText || this.filterChipConfigured || this.filterChipFollowed;
		if (hasFilter) {
			let filtered = visible;
			if (state.filterText) {
				filtered = filtered.filter(
					(e) =>
						e.type.toLowerCase().includes(state.filterText) ||
						e.description.toLowerCase().includes(state.filterText) ||
						e.domain.toLowerCase().includes(state.filterText) ||
						e.services.toLowerCase().includes(state.filterText),
				);
			}
			if (this.filterChipConfigured) filtered = filtered.filter((e) => isConfigured(e.type, state.subscriptions, state.definitions));
			if (this.filterChipFollowed) filtered = filtered.filter((e) => state.notifiedTypes.has(e.type));
			return `${filtered.length} / ${total} events`;
		}
		return `${total} events`;
	}

	// ── Settings panel ──────────────────────────────────────────

	renderSettingsPanel(): void {
		renderEventsSettingsPanel(this.settingsPanel, this.deps, {
			filterChipConfigured: this.filterChipConfigured,
			filterChipFollowed: this.filterChipFollowed,
			onToggleConfigured: () => {
				this.filterChipConfigured = !this.filterChipConfigured;
				this.renderMasterTree();
				this.renderSettingsPanel();
			},
			onToggleFollowed: () => {
				this.filterChipFollowed = !this.filterChipFollowed;
				this.renderMasterTree();
				this.renderSettingsPanel();
			},
		});
	}

	// ── Master tree ─────────────────────────────────────────────

	private renderMasterTree(): void {
		this.scanCategories();
		this.masterTreeEl.empty();

		const state = this.deps.getState();
		const eventsFolder = this.deps.getEntityFolder("events");

		const discoveredEntries = discoveredToCatalogEntries(state.discoveredEvents, this.deps.vaultQuery, eventsFolder);
		const allEntries = [...EVENT_CATALOG, ...discoveredEntries];

		const orderedCategories = getOrderedCategories(state.catalogCategories);
		const visibleCategories = orderedCategories
			.filter((c) => c.visible)
			.map((c) => c.name);

		// Separate user categories (from discovered events) and system categories
		const userCategorySet = new Set(discoveredEntries.map((e) => e.category));
		const namedUserCategories = [...userCategorySet]
			.filter((c) => c !== UNCATEGORIZED_CATEGORY)
			.sort();
		const userCategories = [
			...namedUserCategories,
			UNCATEGORIZED_CATEGORY,
		];

		// System categories: visible settings categories, excluding any that overlap with user
		const systemCategories = visibleCategories.filter((c) => !userCategorySet.has(c));

		const ctx = this.buildRenderContext();
		let visibleCount = 0;

		// User categories first
		for (const category of userCategories) {
			let entries = allEntries.filter((e) => e.category === category);
			entries = this.applyFilters(entries, state);
			if (entries.length === 0 && category !== UNCATEGORIZED_CATEGORY) continue;
			visibleCount += entries.length;
			renderMasterCategory(this.masterTreeEl, category, entries, true, ctx);
		}

		// System categories section — only rendered when showSystemEvents is on
		if (state.showSystemEvents) {
			const systemCategoryEntries = systemCategories.map((category) => ({
				category,
				entries: this.applyFilters(allEntries.filter((e) => e.category === category), state),
			})).filter((c) => c.entries.length > 0);

			if (systemCategoryEntries.length > 0) {
				const divider = this.masterTreeEl.createDiv({ cls: "ft-section-divider" });
				divider.createSpan({ text: "System Events", cls: "ft-text-muted ft-text-sm" });
			}

			for (const { category, entries } of systemCategoryEntries) {
				visibleCount += entries.length;
				renderMasterCategory(this.masterTreeEl, category, entries, false, ctx);
			}
		}

		const totalVisible = getVisibleEntries(state.catalogCategories, state.showSystemEvents, state.discoveredEvents, this.deps.vaultQuery, eventsFolder).length;
		this.countBadge.textContent = state.filterText || this.filterChipConfigured || this.filterChipFollowed
			? `${visibleCount} / ${totalVisible} events`
			: `${totalVisible} events`;

		// Validate selection still exists
		if (this.selectedEventType && !allEntries.some((e) => e.type === this.selectedEventType)) {
			this.selectedEventType = null;
			this.renderDetail();
		}
	}

	private applyFilters(entries: EventCatalogEntry[], state: CatalogState): EventCatalogEntry[] {
		let filtered = entries;
		if (state.filterText) {
			filtered = filtered.filter(
				(e) =>
					e.type.toLowerCase().includes(state.filterText) ||
					e.description.toLowerCase().includes(state.filterText) ||
					e.domain.toLowerCase().includes(state.filterText) ||
					e.services.toLowerCase().includes(state.filterText),
			);
		}
		if (!state.showSystemEvents) {
			filtered = filtered.filter((e) => !e.tags.includes("system"));
		}
		if (this.filterChipConfigured) {
			filtered = filtered.filter((e) => isConfigured(e.type, state.subscriptions, state.definitions));
		}
		if (this.filterChipFollowed) {
			filtered = filtered.filter((e) => state.notifiedTypes.has(e.type));
		}
		return filtered;
	}

	// ── Detail panel ────────────────────────────────────────────

	private renderDetail(): void {
		this.detailPanel.render(this.selectedEventType);
	}

	// ── Category scan ───────────────────────────────────────────

	private scanCategories(): void {
		const state = this.deps.getState();
		const eventsFolder = this.deps.getEntityFolder("events");
		const allEntries = [...EVENT_CATALOG, ...discoveredToCatalogEntries(state.discoveredEvents, this.deps.vaultQuery, eventsFolder)];
		const categoryMap = new Map<string, EventCatalogEntry[]>();

		for (const entry of allEntries) {
			const list = categoryMap.get(entry.category) ?? [];
			list.push(entry);
			categoryMap.set(entry.category, list);
		}

		// Scan folder for documented categories
		const fileMap = this.scanCategoryFolder(categoryMap);

		// Merge with catalogCategories settings for visibility/order
		const orderedCategories = getOrderedCategories(state.catalogCategories);
		const visibilityMap = new Map(orderedCategories.map((c) => [c.name, c.visible]));

		this.categoryEntries = Array.from(categoryMap.entries())
			.map(([name, events]) => {
				const fileData = fileMap.get(name);
				return {
					name,
					description: fileData?.description ?? "",
					events,
					domains: fileData?.domains.length
						? fileData.domains
						: [...new Set(events.map((e) => e.domain))].sort(),
					services: fileData?.services.length
						? fileData.services
						: [...new Set(events.map((e) => e.services))].sort(),
					filePath: fileData?.filePath ?? null,
					visible: visibilityMap.get(name) ?? true,
				};
			})
			.sort((a, b) => {
				// Sort by settings order first (those in orderedCategories), then alphabetically
				const aIdx = orderedCategories.findIndex((c) => c.name === a.name);
				const bIdx = orderedCategories.findIndex((c) => c.name === b.name);
				if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
				if (aIdx !== -1) return -1;
				if (bIdx !== -1) return 1;
				return a.name.localeCompare(b.name);
			});
	}

	private scanCategoryFolder(
		categoryMap: Map<string, EventCatalogEntry[]>,
	): Map<string, { filePath: string; description: string; domains: string[]; services: string[] }> {
		const categoriesFolder = this.deps.getEntityFolder("categories");
		const folder = this.deps.app.vault.getAbstractFileByPath(categoriesFolder);
		const fileMap = new Map<string, { filePath: string; description: string; domains: string[]; services: string[] }>();

		const nonConforming: NonConformingFile[] = [];
		if (folder && folder instanceof TFolder) {
			for (const child of folder.children) {
				if (!(child instanceof TFile) || child.extension !== "md") continue;

				const fm = readFrontmatter(this.deps.vaultQuery, child.path);
				const name = (fm && (fmString(fm, "category")
					?? fmString(fm, "name"))) ?? child.basename;
				const description = (fm && fmString(fm, "description")) ?? "";
				const domains = fmStringArray(fm, "domains");
				const services = fmStringArray(fm, "services");

				fileMap.set(name, { filePath: child.path, description, domains, services });

				if (!categoryMap.has(name)) categoryMap.set(name, []);

				if (!fm || fm.type !== "CategoryDoc") {
					nonConforming.push({
						file: child, docType: "CategoryDoc", nameField: "category", name,
						metadata: { description, domains, services },
					});
				}
			}
		}
		normalizeNonConformingFiles(this.deps.app, nonConforming);

		return fileMap;
	}

	// ── Helpers ──────────────────────────────────────────────────

	private buildRenderContext(): CategoryRenderContext {
		return {
			deps: this.deps,
			state: this.deps.getState(),
			categoryEntries: this.categoryEntries,
			selectedEventType: this.selectedEventType,
			onSelectEvent: (eventType: string) => {
				this.selectedEventType = eventType;
				this.renderMasterTree();
				this.renderDetail();
			},
			getUserCategories: () => this.getUserCategories(),
		};
	}

	private getUserCategories(): string[] {
		const state = this.deps.getState();
		const entries = discoveredToCatalogEntries(
			state.discoveredEvents, this.deps.vaultQuery, this.deps.getEntityFolder("events"),
		);
		return [...new Set(entries.map((e) => e.category))]
			.filter((c) => c !== UNCATEGORIZED_CATEGORY)
			.sort();
	}
}
