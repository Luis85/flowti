import { TFile, TFolder, setIcon } from "obsidian";
import {
	EVENT_CATALOG,
	type EventCatalogEntry,
} from "../../infrastructure/events/catalog";
import { DEFAULT_CATALOG_CATEGORIES } from "../../domain/settings/settings";
import {
	getCategoryDocPathResolved,
	generateCategoryDocContent,
} from "../eventDocTemplate";
import { InputModal, CreateEventModal } from "../modals";
import type { CatalogComponentDeps, CatalogState, CategoryEntry } from "./types";
import {
	UNCATEGORIZED_CATEGORY,
	readFrontmatter,
	fmString,
	fmStringArray,
	normalizeDocFrontmatter,
	isConfigured,
	getOrderedCategories,
	discoveredToCatalogEntries,
	getVisibleEntries,
	resolveEntry,
	getConfiguredCount,
	getFollowedCount,
	openFile,
} from "./helpers";
import { EventDetailPanel } from "./EventDetailPanel";

/**
 * Events tab component — filter chips, master tree, detail panel,
 * category scanning, settings panel, and category doc helpers.
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
		const entry = resolveEntry(eventType, state.discoveredEvents, this.deps.app, this.deps.getEntityFolder("events"));
		if (entry && state.collapsedCategories.has(entry.category)) {
			state.collapsedCategories.delete(entry.category);
		}
	}

	/** Count badge text for the orchestrator's updateCountBadge */
	getCountText(): string {
		const state = this.deps.getState();
		const visible = getVisibleEntries(state.catalogCategories, state.showSystemEvents, state.discoveredEvents, this.deps.app, this.deps.getEntityFolder("events"));
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
		this.settingsPanel.empty();

		const state = this.deps.getState();
		const eventsFolder = this.deps.getEntityFolder("events");

		// Configured filter toggle
		const configuredCount = getConfiguredCount(state.catalogCategories, state.showSystemEvents, state.discoveredEvents, this.deps.app, eventsFolder, state.subscriptions, state.definitions);
		const configuredRow = this.settingsPanel.createDiv({ cls: "ft-settings-row" });
		const configuredToggle = configuredRow.createSpan({
			cls: `ft-visibility-toggle${this.filterChipConfigured ? "" : " ft-visibility-off"}`,
		});
		setIcon(configuredToggle, this.filterChipConfigured ? "eye" : "eye-off");
		configuredToggle.setAttribute("aria-label", this.filterChipConfigured ? "Show all" : "Only configured");
		configuredToggle.addEventListener("click", () => {
			this.filterChipConfigured = !this.filterChipConfigured;
			this.renderMasterTree();
			this.renderSettingsPanel();
		});
		configuredRow.createSpan({ text: `Only configured (${configuredCount})`, cls: "ft-settings-row-name" });

		// Followed filter toggle
		const followedCount = getFollowedCount(state.catalogCategories, state.showSystemEvents, state.discoveredEvents, this.deps.app, eventsFolder, state.notifiedTypes);
		const followedRow = this.settingsPanel.createDiv({ cls: "ft-settings-row" });
		const followedToggle = followedRow.createSpan({
			cls: `ft-visibility-toggle${this.filterChipFollowed ? "" : " ft-visibility-off"}`,
		});
		setIcon(followedToggle, this.filterChipFollowed ? "eye" : "eye-off");
		followedToggle.setAttribute("aria-label", this.filterChipFollowed ? "Show all" : "Only followed");
		followedToggle.addEventListener("click", () => {
			this.filterChipFollowed = !this.filterChipFollowed;
			this.renderMasterTree();
			this.renderSettingsPanel();
		});
		followedRow.createSpan({ text: `Only followed (${followedCount})`, cls: "ft-settings-row-name" });

		// Show system events toggle
		const systemRow = this.settingsPanel.createDiv({ cls: "ft-settings-row" });
		const systemToggle = systemRow.createSpan({
			cls: `ft-visibility-toggle${state.showSystemEvents ? "" : " ft-visibility-off"}`,
		});
		setIcon(systemToggle, state.showSystemEvents ? "eye" : "eye-off");
		systemToggle.setAttribute("aria-label", state.showSystemEvents ? "Hide system events" : "Show system events");
		systemToggle.addEventListener("click", () => {
			void this.deps.eventBus.emit("settings.updateShowSystemEvents", {
				showSystemEvents: !state.showSystemEvents,
			});
		});
		systemRow.createSpan({ text: "Show system events", cls: "ft-settings-row-name" });

		// Category visibility section
		const categories = getOrderedCategories(state.catalogCategories);

		if (!state.showSystemEvents) {
			const hint = this.settingsPanel.createDiv({ cls: "ft-text-muted ft-text-sm" });
			hint.style.padding = "0.5rem 0";
			hint.textContent = "Enable system events to configure category visibility.";
		} else {

		for (let i = 0; i < categories.length; i++) {
			const cat = categories[i];

			const row = this.settingsPanel.createDiv({ cls: "ft-settings-row" });

			// Visibility toggle
			const toggle = row.createSpan({
				cls: `ft-visibility-toggle${cat.visible ? "" : " ft-visibility-off"}`,
			});
			toggle.setAttribute("aria-label", cat.visible ? "Hide category" : "Show category");
			setIcon(toggle, cat.visible ? "eye" : "eye-off");
			toggle.addEventListener("click", () => {
				categories[i] = { ...categories[i], visible: !categories[i].visible };
				void this.deps.eventBus.emit("settings.updateCatalogCategories", { categories: [...categories] });
			});

			// Category name
			row.createSpan({ text: cat.name, cls: "ft-settings-row-name" });

			// Arrow controls
			const arrows = row.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });

			const upBtn = arrows.createSpan({
				cls: `ft-visibility-toggle${i === 0 ? " ft-btn-disabled" : ""}`,
			});
			upBtn.setAttribute("aria-label", "Move up");
			setIcon(upBtn, "chevron-up");
			if (i > 0) {
				upBtn.addEventListener("click", () => {
					[categories[i - 1], categories[i]] = [categories[i], categories[i - 1]];
					void this.deps.eventBus.emit("settings.updateCatalogCategories", { categories: [...categories] });
				});
			}

			const downBtn = arrows.createSpan({
				cls: `ft-visibility-toggle${i === categories.length - 1 ? " ft-btn-disabled" : ""}`,
			});
			downBtn.setAttribute("aria-label", "Move down");
			setIcon(downBtn, "chevron-down");
			if (i < categories.length - 1) {
				downBtn.addEventListener("click", () => {
					[categories[i], categories[i + 1]] = [categories[i + 1], categories[i]];
					void this.deps.eventBus.emit("settings.updateCatalogCategories", { categories: [...categories] });
				});
			}
		}

		} // end if showSystemEvents

		// Reset button
		const resetRow = this.settingsPanel.createDiv({ cls: "ft-settings-reset" });
		const resetBtn = resetRow.createEl("button", {
			text: "Reset to defaults",
			cls: "ft-btn ft-btn-secondary",
		});
		resetBtn.addEventListener("click", () => {
			void this.deps.eventBus.emit("settings.updateCatalogCategories", {
				categories: [...DEFAULT_CATALOG_CATEGORIES],
			});
		});
	}

	// ── Master tree ─────────────────────────────────────────────

	private renderMasterTree(): void {
		this.scanCategories();
		this.masterTreeEl.empty();

		const state = this.deps.getState();
		const eventsFolder = this.deps.getEntityFolder("events");

		const discoveredEntries = discoveredToCatalogEntries(state.discoveredEvents, this.deps.app, eventsFolder);
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

		let visibleCount = 0;

		// User categories first
		for (const category of userCategories) {
			let entries = allEntries.filter((e) => e.category === category);
			entries = this.applyFilters(entries, state);
			if (entries.length === 0 && category !== UNCATEGORIZED_CATEGORY) continue;
			visibleCount += entries.length;
			this.renderMasterCategory(this.masterTreeEl, category, entries, true);
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
				this.renderMasterCategory(this.masterTreeEl, category, entries, false);
			}
		}

		const totalVisible = getVisibleEntries(state.catalogCategories, state.showSystemEvents, state.discoveredEvents, this.deps.app, eventsFolder).length;
		this.countBadge.textContent = state.filterText || this.filterChipConfigured || this.filterChipFollowed
			? `${visibleCount} / ${totalVisible} events`
			: `${totalVisible} events`;

		// Validate selection still exists
		this.validateSelection(allEntries);
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

	private renderMasterCategory(
		container: HTMLElement,
		category: string,
		entries: EventCatalogEntry[],
		isUserCategory: boolean,
	): void {
		const state = this.deps.getState();
		const isCollapsed = state.collapsedCategories.has(category);
		const group = container.createDiv({ cls: "ft-master-category" });

		const headerCls = isUserCategory
			? "ft-master-category-header"
			: "ft-master-category-header ft-master-category-system";
		const header = group.createDiv({ cls: headerCls });

		const isEmptyUncategorized = category === UNCATEGORIZED_CATEGORY && entries.length === 0;

		let chevron: HTMLSpanElement | null = null;
		if (isEmptyUncategorized) {
			const plusIcon = header.createSpan();
			setIcon(plusIcon, "plus");
			plusIcon.style.opacity = "0.6";
		} else {
			chevron = header.createSpan({
				text: isCollapsed ? "\u25B6" : "\u25BC",
			});
			chevron.style.fontSize = "0.6rem";
		}

		const displayLabel = isEmptyUncategorized ? "Create new Event" : category;
		const catLabel = header.createSpan({ text: displayLabel });

		// Show description from category doc as tooltip
		const catEntry = this.categoryEntries.find((c) => c.name === category);
		if (catEntry?.description) {
			catLabel.title = catEntry.description;
		}

		// Count badge with enhanced info
		if (entries.length > 0) {
			const visibleInLog = entries.filter((e) => !state.excludedTypes.has(e.type)).length;
			const configuredInCat = entries.filter((e) => isConfigured(e.type, state.subscriptions, state.definitions)).length;

			const parts: string[] = [String(entries.length)];
			if (visibleInLog < entries.length) parts.push(`${visibleInLog} vis`);
			if (configuredInCat > 0) parts.push(`${configuredInCat} conf`);

			header.createSpan({
				text: parts.join(" \u00B7 "),
				cls: "ft-master-category-count",
			});
		}

		if (isEmptyUncategorized) {
			// No extra buttons — the whole header is the CTA
		} else if (isUserCategory) {
			// Add button for user categories
			const addBtn = header.createSpan({ cls: "ft-visibility-toggle" });
			addBtn.style.marginLeft = "auto";
			setIcon(addBtn, "plus");
			addBtn.setAttribute("aria-label", "Create event");
			addBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				if (category !== UNCATEGORIZED_CATEGORY) {
					// Auto-inherit category for named user categories
					new InputModal(this.deps.app, {
						title: `Create Event in "${category}"`,
						placeholder: "my.custom.event",
						submitLabel: "Create",
						inputName: "Event name",
						inputDesc: "Use dot notation (e.g. order.placed)",
						onSubmit: (name) => {
							void this.deps.eventBus.emit("discovery.create", { eventName: name, category });
						},
					}).open();
				} else {
					// Uncategorized — open full CreateEventModal with category choice
					new CreateEventModal(this.deps.app, {
						title: "Create Custom Event",
						existingCategories: this.getUserCategories(),
						onSubmit: (name, cat) => {
							void this.deps.eventBus.emit("discovery.create", {
								eventName: name,
								...(cat ? { category: cat } : {}),
							});
						},
					}).open();
				}
			});
		} else {
			// Category doc button (system categories)
			const catDocBtn = header.createSpan({ cls: "ft-visibility-toggle" });
			catDocBtn.setAttribute("aria-label", catEntry?.filePath ? "Open category doc" : "Create category doc");
			setIcon(catDocBtn, "file-text");
			catDocBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				if (catEntry?.filePath) {
					void openFile(this.deps.app, catEntry.filePath);
				} else {
					void this.openOrCreateCategoryDoc(category, entries);
				}
			});

			// Category visibility toggle (system categories)
			const catEntries = entries.length > 0 ? entries : [];
			const excludedCount = catEntries.filter((e) => state.excludedTypes.has(e.type)).length;
			const vis = excludedCount === 0 ? "all" : excludedCount === catEntries.length ? "none" : "partial";

			const catToggle = header.createSpan({ cls: "ft-visibility-toggle" });
			catToggle.setAttribute("aria-label", vis === "none" ? "Show all in Activity Log" : "Hide all from Activity Log");
			setIcon(catToggle, vis === "none" ? "eye-off" : "eye");
			if (vis === "partial") catToggle.classList.add("ft-visibility-partial");
			if (vis === "none") catToggle.classList.add("ft-visibility-off");

			catToggle.addEventListener("click", (e) => {
				e.stopPropagation();
				void this.deps.eventBus.emit("eventFilter.toggleCategory", { category });
			});
		}

		const list = group.createDiv();
		if (isCollapsed) list.classList.add("ft-hidden");

		for (const entry of entries) {
			this.renderMasterEventItem(list, entry);
		}

		if (isEmptyUncategorized) {
			header.addEventListener("click", () => {
				new CreateEventModal(this.deps.app, {
					title: "Create Custom Event",
					existingCategories: this.getUserCategories(),
					onSubmit: (name, cat) => {
						void this.deps.eventBus.emit("discovery.create", {
							eventName: name,
							...(cat ? { category: cat } : {}),
						});
					},
				}).open();
			});
		} else {
			header.addEventListener("click", () => {
				if (state.collapsedCategories.has(category)) {
					state.collapsedCategories.delete(category);
				} else {
					state.collapsedCategories.add(category);
				}
				list.classList.toggle("ft-hidden");
				if (chevron) chevron.textContent = state.collapsedCategories.has(category) ? "\u25B6" : "\u25BC";
				void this.deps.eventBus.emit("settings.updateCollapsedCategories", {
					collapsed: [...state.collapsedCategories],
				});
			});
		}
	}

	private renderMasterEventItem(container: HTMLElement, entry: EventCatalogEntry): void {
		const state = this.deps.getState();
		const isSelected = this.selectedEventType === entry.type;
		const isExcluded = state.excludedTypes.has(entry.type);
		const cls = `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}${isExcluded ? " ft-master-event-excluded" : ""}`;
		const item = container.createDiv({ cls });

		item.createSpan({ text: entry.type, cls: "ft-master-event-name" });

		// Tag badges
		if (entry.tags.length > 0) {
			const tagContainer = item.createDiv({ cls: "ft-master-tags" });
			for (const tag of entry.tags) {
				tagContainer.createSpan({ text: tag, cls: "ft-badge ft-badge-tag" });
			}
		}

		// Status dots
		const configured = isConfigured(entry.type, state.subscriptions, state.definitions);
		const followed = state.notifiedTypes.has(entry.type);

		if (configured || followed || isExcluded) {
			const dots = item.createDiv({ cls: "ft-master-status-dots" });
			if (isExcluded) {
				const dot = dots.createDiv({ cls: "ft-master-status-dot ft-master-dot-hidden" });
				dot.setAttribute("aria-label", "Hidden from Activity Log");
				dot.title = "Hidden from Activity Log";
			}
			if (configured) {
				const dot = dots.createDiv({ cls: "ft-master-status-dot ft-master-dot-configured" });
				dot.setAttribute("aria-label", "Has watchers or transforms");
				dot.title = "Has watchers or transforms";
			}
			if (followed) {
				const dot = dots.createDiv({ cls: "ft-master-status-dot ft-master-dot-followed" });
				dot.setAttribute("aria-label", "Followed \u2014 triggers Notice popup");
				dot.title = "Followed \u2014 triggers Notice popup";
			}
		}

		item.addEventListener("click", () => {
			this.selectedEventType = entry.type;
			this.renderMasterTree();
			this.renderDetail();
		});
	}

	// ── Detail panel ────────────────────────────────────────────

	private renderDetail(): void {
		this.detailPanel.render(this.selectedEventType);
	}

	// ── Category scan ───────────────────────────────────────────

	private scanCategories(): void {
		const state = this.deps.getState();
		const eventsFolder = this.deps.getEntityFolder("events");
		const allEntries = [...EVENT_CATALOG, ...discoveredToCatalogEntries(state.discoveredEvents, this.deps.app, eventsFolder)];
		const categoryMap = new Map<string, EventCatalogEntry[]>();

		for (const entry of allEntries) {
			const list = categoryMap.get(entry.category) ?? [];
			list.push(entry);
			categoryMap.set(entry.category, list);
		}

		// Scan folder for documented categories
		const categoriesFolder = this.deps.getEntityFolder("categories");
		const folder = this.deps.app.vault.getAbstractFileByPath(categoriesFolder);
		const fileMap = new Map<string, { filePath: string; description: string; domains: string[]; services: string[] }>();

		if (folder && folder instanceof TFolder) {
			for (const child of folder.children) {
				if (!(child instanceof TFile) || child.extension !== "md") continue;

				const fm = readFrontmatter(this.deps.app, child.path);
				const name = (fm && (fmString(fm, "category")
					?? fmString(fm, "name"))) ?? child.basename;
				const description = (fm && fmString(fm, "description")) ?? "";
				const domains = fmStringArray(fm, "domains");
				const services = fmStringArray(fm, "services");

				fileMap.set(name, { filePath: child.path, description, domains, services });

				if (!categoryMap.has(name)) categoryMap.set(name, []);

				if (!fm || fm.type !== "CategoryDoc") {
					normalizeDocFrontmatter(this.deps.app, child, "CategoryDoc", "category", name, { description, domains, services });
				}
			}
		}

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

	// ── Helpers ──────────────────────────────────────────────────

	private validateSelection(allEntries: EventCatalogEntry[]): void {
		if (this.selectedEventType && !allEntries.some((e) => e.type === this.selectedEventType)) {
			this.selectedEventType = null;
			this.renderDetail();
		}
	}

	private getUserCategories(): string[] {
		const state = this.deps.getState();
		const entries = discoveredToCatalogEntries(
			state.discoveredEvents, this.deps.app, this.deps.getEntityFolder("events"),
		);
		return [...new Set(entries.map((e) => e.category))]
			.filter((c) => c !== UNCATEGORIZED_CATEGORY)
			.sort();
	}

	private async openOrCreateCategoryDoc(category: string, events: EventCatalogEntry[]): Promise<void> {
		const docPath = getCategoryDocPathResolved(this.deps.getEntityFolder("categories"), category);

		let file = this.deps.app.vault.getAbstractFileByPath(docPath);

		if (!file) {
			const content = generateCategoryDocContent(category, events);
			try {
				await this.deps.fileSystemClient.createFile(docPath, content, { createFolders: true });
			} catch (err) {
				console.error(`[Flowti] Failed to create category doc: ${docPath}`, err);
				return;
			}
			file = this.deps.app.vault.getAbstractFileByPath(docPath);
		}

		if (file && file instanceof TFile) {
			const leaf = this.deps.app.workspace.getLeaf(false);
			await leaf.openFile(file);
		}
	}
}
