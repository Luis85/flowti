import { ItemView, WorkspaceLeaf, setIcon, TFile } from "obsidian";
import {
	EVENT_CATALOG,
	EVENT_CATEGORIES,
	getEventsByCategory,
	type EventCatalogEntry,
} from "../infrastructure/events/catalog";
import type { IEventBus } from "../infrastructure/events/types";
import type { DiscoveredEvent } from "../domain/discovery/types";
import { type CatalogCategoryConfig, DEFAULT_CATALOG_CATEGORIES } from "../domain/settings/settings";
import type { ViewStateProvider } from "../infrastructure/views/registry";
import { FileSystemClient } from "../infrastructure/filesystem/FileSystemClient";
import { getEventDocPath, generateEventDocContent } from "./eventDocTemplate";
import { ConfirmModal, InputModal } from "./modals";

export const VIEW_TYPE_EVENT_CATALOG = "flowti-event-catalog";

/** Category label for user-defined discovered events */
const CUSTOM_EVENTS_CATEGORY = "Custom Events";

/**
 * A view that displays all available events grouped by category.
 * Serves as a reference for the event system — shows event types,
 * descriptions, and data flow directions. Also displays user-land
 * events discovered from vault files with `type: "Event"` frontmatter.
 *
 * Each event and category has a visibility toggle (eye icon) that
 * controls whether the event appears in the Event Log.
 *
 * Includes an inline settings panel (gear icon) for reordering
 * and toggling category visibility.
 */
export class EventCatalogView extends ItemView {
	private filterInput: HTMLInputElement;
	private categoryContainer: HTMLElement;
	private settingsPanel: HTMLElement;
	private settingsPanelVisible = false;
	private countBadge: HTMLElement;
	private eventBus: IEventBus;
	private fileSystemClient: FileSystemClient;
	private discoveredEvents: DiscoveredEvent[] = [];
	private excludedTypes: Set<string> = new Set();
	private notifiedTypes: Set<string> = new Set();
	private catalogCategories: CatalogCategoryConfig[] = DEFAULT_CATALOG_CATEGORIES;
	private collapsedCategories: Set<string> = new Set();
	private eventDocsBasePath = "03 - Resources/Documentation/Reference/Events";
	private unsubscribes: (() => void)[] = [];

	private state: ViewStateProvider;

	constructor(leaf: WorkspaceLeaf, eventBus: IEventBus, state: ViewStateProvider) {
		super(leaf);
		this.eventBus = eventBus;
		this.state = state;
		this.fileSystemClient = new FileSystemClient({ eventBus });
	}

	getViewType(): string {
		return VIEW_TYPE_EVENT_CATALOG;
	}

	getDisplayText(): string {
		return "Event Catalog";
	}

	getIcon(): string {
		return "list";
	}

	async onOpen(): Promise<void> {
		// Initialize all state from live providers (not just defaults)
		const settings = this.state.getSettings();
		this.catalogCategories = settings.catalogCategories;
		this.eventDocsBasePath = settings.eventDocsBasePath;
		this.excludedTypes = new Set(this.state.getExcludedTypes());
		this.notifiedTypes = new Set(this.state.getNotifiedTypes());
		this.discoveredEvents = this.state.getDiscoveredEvents();
		this.collapsedCategories = this.state.collapsedCategories;

		const container = this.containerEl.children[1];
		container.empty();

		const wrapper = container.createDiv({ cls: "flowti-container ft-p-4" });

		this.renderHeader(wrapper);
		this.renderFilterBar(wrapper);

		this.settingsPanel = wrapper.createDiv({ cls: "ft-settings-panel ft-hidden" });
		this.categoryContainer = wrapper.createDiv({ cls: "ft-flex ft-flex-col ft-gap-2" });

		// Subscribe to discovery events for live updates
		this.unsubscribes.push(
			this.eventBus.on("discovery.loaded", (event) => {
				this.discoveredEvents = event.payload.discoveredEvents;
				this.renderCategories(this.filterInput?.value?.toLowerCase() ?? "");
			})
		);

		this.unsubscribes.push(
			this.eventBus.on("discovery.updated", (event) => {
				const idx = this.discoveredEvents.findIndex(
					(e) => e.eventName === event.payload.event.eventName
				);
				if (idx >= 0) {
					this.discoveredEvents[idx] = event.payload.event;
				} else {
					this.discoveredEvents.push(event.payload.event);
				}
				this.renderCategories(this.filterInput?.value?.toLowerCase() ?? "");
			})
		);

		this.unsubscribes.push(
			this.eventBus.on("discovery.removed", (event) => {
				this.discoveredEvents = this.discoveredEvents.filter(
					(e) => e.eventName !== event.payload.eventName
				);
				this.renderCategories(this.filterInput?.value?.toLowerCase() ?? "");
			})
		);

		// Subscribe to event filter state
		this.unsubscribes.push(
			this.eventBus.on("eventFilter.loaded", (event) => {
				this.excludedTypes = new Set(event.payload.excludedTypes);
				this.renderCategories(this.filterInput?.value?.toLowerCase() ?? "");
			})
		);

		this.unsubscribes.push(
			this.eventBus.on("eventFilter.changed", (event) => {
				this.excludedTypes = new Set(event.payload.excludedTypes);
				this.renderCategories(this.filterInput?.value?.toLowerCase() ?? "");
			})
		);

		// Subscribe to event notify state
		this.unsubscribes.push(
			this.eventBus.on("eventNotify.loaded", (event) => {
				this.notifiedTypes = new Set(event.payload.notifiedTypes);
				this.renderCategories(this.filterInput?.value?.toLowerCase() ?? "");
			})
		);

		this.unsubscribes.push(
			this.eventBus.on("eventNotify.changed", (event) => {
				this.notifiedTypes = new Set(event.payload.notifiedTypes);
				this.renderCategories(this.filterInput?.value?.toLowerCase() ?? "");
			})
		);

		// Subscribe to settings
		this.unsubscribes.push(
			this.eventBus.on("settings.loaded", (event) => {
				this.eventDocsBasePath = event.payload.settings.eventDocsBasePath;
				this.catalogCategories = event.payload.settings.catalogCategories;
				this.renderCategories(this.filterInput?.value?.toLowerCase() ?? "");
				if (this.settingsPanelVisible) this.renderSettingsPanel();
			})
		);
		this.unsubscribes.push(
			this.eventBus.on("settings.changed", (event) => {
				this.eventDocsBasePath = event.payload.settings.eventDocsBasePath;
				this.catalogCategories = event.payload.settings.catalogCategories;
				this.renderCategories(this.filterInput?.value?.toLowerCase() ?? "");
				if (this.settingsPanelVisible) this.renderSettingsPanel();
			})
		);

		this.renderCategories("");
	}

	async onClose(): Promise<void> {
		for (const unsub of this.unsubscribes) {
			unsub();
		}
		this.unsubscribes = [];
	}

	private renderHeader(container: HTMLElement): void {
		const section = container.createDiv({ cls: "ft-mb-2" });

		const titleRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-1" });
		titleRow.createEl("h1", {
			text: "Event Catalog",
			cls: "ft-heading ft-heading-lg",
		});
		this.countBadge = titleRow.createSpan({
			text: `${EVENT_CATALOG.length} events`,
			cls: "ft-badge ft-badge-muted",
		});

		// Gear icon to toggle settings panel
		const gearBtn = titleRow.createSpan({ cls: "ft-visibility-toggle" });
		gearBtn.setAttribute("aria-label", "Category settings");
		setIcon(gearBtn, "settings");
		gearBtn.addEventListener("click", () => {
			this.settingsPanelVisible = !this.settingsPanelVisible;
			this.settingsPanel.classList.toggle("ft-hidden");
			if (this.settingsPanelVisible) {
				this.renderSettingsPanel();
			}
		});

		section.createEl("p", {
			text: "All available events in the Flowti event system, grouped by category.",
			cls: "ft-text-muted ft-text-sm",
		});

		section.createEl("hr", { cls: "ft-divider" });
	}

	private renderFilterBar(container: HTMLElement): void {
		const bar = container.createDiv({ cls: "ft-mb-2" });
		this.filterInput = bar.createEl("input", { cls: "ft-input" });
		this.filterInput.type = "text";
		this.filterInput.placeholder = "Filter events by name, description, domain or service...";
		this.filterInput.addEventListener("input", () => {
			this.renderCategories(this.filterInput.value.toLowerCase());
		});
	}

	/**
	 * Renders the inline settings panel for category visibility and reordering.
	 */
	private renderSettingsPanel(): void {
		this.settingsPanel.empty();

		const categories = this.getOrderedCategories();

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
				void this.eventBus.emit("settings.updateCatalogCategories", { categories: [...categories] });
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
					void this.eventBus.emit("settings.updateCatalogCategories", { categories: [...categories] });
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
					void this.eventBus.emit("settings.updateCatalogCategories", { categories: [...categories] });
				});
			}
		}

		// Reset button
		const resetRow = this.settingsPanel.createDiv({ cls: "ft-settings-reset" });
		const resetBtn = resetRow.createEl("button", {
			text: "Reset to defaults",
			cls: "ft-btn ft-btn-secondary",
		});
		resetBtn.addEventListener("click", () => {
			void this.eventBus.emit("settings.updateCatalogCategories", {
				categories: [...DEFAULT_CATALOG_CATEGORIES],
			});
		});
	}

	/**
	 * Converts discovered events to catalog entries, enriching each entry
	 * with metadata from its EventDoc (if present) and event source file.
	 *
	 * Priority: EventDoc frontmatter > event source frontmatter > defaults.
	 */
	private discoveredToCatalogEntries(): EventCatalogEntry[] {
		return this.discoveredEvents.map((d) => {
			const sourceFm = this.readFrontmatter(d.sourcePath);
			const docPath = getEventDocPath(this.eventDocsBasePath, d.eventName);
			const docFm = this.readFrontmatter(docPath);

			return {
				type: d.eventName,
				category: CUSTOM_EVENTS_CATEGORY,
				description:
					this.fmString(docFm, "description") ??
					this.fmString(sourceFm, "description") ??
					`Custom event (triggered ${d.triggerCount}x)`,
				direction:
					this.fmString(docFm, "direction") ?? "User \u2192 EventBus",
				domain:
					this.fmString(docFm, "domain") ?? "custom",
				services:
					this.fmString(docFm, "services") ?? "Discovery",
			};
		});
	}

	/**
	 * Reads frontmatter from a vault file via the metadata cache (synchronous).
	 * Returns undefined if the file doesn't exist or has no frontmatter.
	 */
	private readFrontmatter(path: string): Record<string, unknown> | undefined {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return undefined;
		return this.app.metadataCache.getFileCache(file)?.frontmatter as
			| Record<string, unknown>
			| undefined;
	}

	/**
	 * Extracts a non-empty string value from frontmatter.
	 */
	private fmString(fm: Record<string, unknown> | undefined, key: string): string | undefined {
		const val = fm?.[key];
		return typeof val === "string" && val.trim() ? val.trim() : undefined;
	}

	/**
	 * Determines the category visibility state based on excluded types.
	 */
	private getCategoryVisibility(entries: EventCatalogEntry[]): "all" | "none" | "partial" {
		const excludedCount = entries.filter((e) => this.excludedTypes.has(e.type)).length;
		if (excludedCount === 0) return "all";
		if (excludedCount === entries.length) return "none";
		return "partial";
	}

	/**
	 * Computes the ordered category list, merging settings with the canonical
	 * EVENT_CATEGORIES. Handles schema evolution: new categories that aren't
	 * in saved settings get appended at the end (visible by default).
	 */
	private getOrderedCategories(): CatalogCategoryConfig[] {
		const knownNames = new Set<string>(EVENT_CATEGORIES as readonly string[]);

		// Start with settings order, keep only still-existing categories
		const result = this.catalogCategories.filter((c) => knownNames.has(c.name));

		// Append any new categories not in settings (visible by default)
		const settingsNames = new Set(result.map((c) => c.name));
		for (const cat of EVENT_CATEGORIES) {
			if (!settingsNames.has(cat)) {
				result.push({ name: cat, visible: true });
			}
		}

		return result;
	}

	private renderCategories(filter: string): void {
		this.categoryContainer.empty();

		const discoveredEntries = this.discoveredToCatalogEntries();
		const allEntries = [...EVENT_CATALOG, ...discoveredEntries];

		// Use settings-driven order and visibility
		const orderedCategories = this.getOrderedCategories();
		const visibleCategories = orderedCategories
			.filter((c) => c.visible)
			.map((c) => c.name);

		// Custom Events always on top (so the "+" button is always reachable),
		// then settings-ordered categories
		const allCategories = [
			CUSTOM_EVENTS_CATEGORY,
			...visibleCategories,
		];

		let visibleCount = 0;

		for (const category of allCategories) {
			let entries = allEntries.filter((e) => e.category === category);

			if (filter) {
				entries = entries.filter(
					(e) =>
						e.type.toLowerCase().includes(filter) ||
						e.description.toLowerCase().includes(filter) ||
						e.domain.toLowerCase().includes(filter) ||
						e.services.toLowerCase().includes(filter)
				);
			}

			if (entries.length === 0 && category !== CUSTOM_EVENTS_CATEGORY) continue;

			visibleCount += entries.length;
			this.renderCategorySection(this.categoryContainer, category, entries);
		}

		this.countBadge.textContent = filter
			? `${visibleCount} / ${allEntries.length} events`
			: `${allEntries.length} events`;
	}

	private renderCategorySection(
		container: HTMLElement,
		category: string,
		entries: EventCatalogEntry[]
	): void {
		const isCollapsed = this.collapsedCategories.has(category);
		const section = container.createDiv({ cls: "ft-catalog-card" });

		const header = section.createDiv({
			cls: "ft-flex ft-items-center ft-justify-between ft-category-header",
		});

		const titleRow = header.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const chevron = titleRow.createSpan({
			text: isCollapsed ? "\u25B6" : "\u25BC",
			cls: "ft-text-muted ft-text-sm",
		});
		titleRow.createEl("h3", {
			text: category,
			cls: "ft-heading ft-heading-sm",
		});

		// Category stats
		const visibleCount = entries.filter((e) => !this.excludedTypes.has(e.type)).length;
		const notifiedCount = entries.filter((e) => this.notifiedTypes.has(e.type)).length;

		const stats = titleRow.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });

		const visibleBadge = stats.createSpan({ cls: "ft-badge ft-badge-muted ft-flex ft-items-center ft-gap-1" });
		setIcon(visibleBadge.createSpan(), "eye");
		visibleBadge.createSpan({ text: `${visibleCount}/${entries.length}` });

		if (notifiedCount > 0) {
			const notifyBadge = stats.createSpan({ cls: "ft-badge ft-badge-muted ft-flex ft-items-center ft-gap-1" });
			setIcon(notifyBadge.createSpan(), "bell");
			notifyBadge.createSpan({ text: `${notifiedCount}` });
		}

		const controls = header.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });

		// Category visibility toggle
		const allCategoryEntries = getEventsByCategory(category);
		// For discovered events, use the entries directly since they aren't in the static catalog
		const toggleEntries = allCategoryEntries.length > 0 ? allCategoryEntries : entries;
		const visibility = this.getCategoryVisibility(toggleEntries);

		const catToggle = controls.createSpan({ cls: "ft-visibility-toggle" });
		catToggle.setAttribute("aria-label", visibility === "none" ? "Show all in Event Log" : "Hide all from Event Log");
		setIcon(catToggle, visibility === "none" ? "eye-off" : "eye");
		if (visibility === "partial") catToggle.classList.add("ft-visibility-partial");
		if (visibility === "none") catToggle.classList.add("ft-visibility-off");

		catToggle.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.eventBus.emit("eventFilter.toggleCategory", { category });
		});

		// Add event button (custom events only)
		if (category === CUSTOM_EVENTS_CATEGORY) {
			const addBtn = controls.createSpan({ cls: "ft-visibility-toggle" });
			addBtn.setAttribute("aria-label", "Create custom event");
			setIcon(addBtn, "plus");
			addBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				new InputModal(this.app, {
					title: "Create Custom Event",
					placeholder: "my.custom.event",
					submitLabel: "Create",
					onSubmit: (name) => {
						void this.eventBus.emit("discovery.create", { eventName: name });
					},
				}).open();
			});
		}

		// Section description for custom events
		if (category === CUSTOM_EVENTS_CATEGORY) {
			const desc = section.createEl("p", {
				text: "Events discovered from your vault. Click the doc icon to add metadata.",
				cls: "ft-text-muted ft-text-sm ft-mt-1 ft-mb-1",
			});
			if (isCollapsed) desc.classList.add("ft-hidden");
		}

		const list = section.createDiv({ cls: `ft-catalog-list${isCollapsed ? " ft-hidden" : ""}` });

		for (const entry of entries) {
			this.renderEventRow(list, entry);
		}

		// Toggle collapse — persisted via settings
		header.addEventListener("click", () => {
			if (this.collapsedCategories.has(category)) {
				this.collapsedCategories.delete(category);
			} else {
				this.collapsedCategories.add(category);
			}
			list.classList.toggle("ft-hidden");
			chevron.textContent = this.collapsedCategories.has(category) ? "\u25B6" : "\u25BC";
			// Also toggle the section description for custom events
			const desc = section.querySelector(".ft-text-muted.ft-text-sm.ft-mt-1");
			if (desc) desc.classList.toggle("ft-hidden");
			void this.eventBus.emit("settings.updateCollapsedCategories", {
				collapsed: [...this.collapsedCategories],
			});
		});
	}

	private renderEventRow(container: HTMLElement, entry: EventCatalogEntry): void {
		const isExcluded = this.excludedTypes.has(entry.type);
		const isCustom = entry.category === CUSTOM_EVENTS_CATEGORY;
		const row = container.createDiv({
			cls: `ft-catalog-row${isExcluded ? " ft-event-excluded" : ""}`,
		});

		// Event type (monospace)
		row.createSpan({ text: entry.type, cls: "ft-event-type ft-truncate" });

		// Description (muted, fills remaining space)
		const desc = row.createSpan({ text: entry.description, cls: "ft-text-muted ft-text-sm ft-truncate" });
		desc.style.flex = "1";
		desc.style.minWidth = "0";

		// Domain + Service
		row.createSpan({ text: entry.domain, cls: "ft-catalog-meta" });
		row.createSpan({ text: entry.services, cls: "ft-catalog-meta" });

		// Action icons
		const actions = row.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });

		// Source file link (custom events only)
		if (isCustom) {
			const sourcePath = this.getSourcePath(entry.type);
			if (sourcePath) {
				const sourceLink = actions.createSpan({ cls: "ft-visibility-toggle" });
				sourceLink.setAttribute("aria-label", "Open event source file");
				setIcon(sourceLink, "file-input");
				sourceLink.addEventListener("click", (e) => {
					e.stopPropagation();
					void this.openFile(sourcePath);
				});
			}
		}

		// Doc link icon
		const docLink = actions.createSpan({ cls: "ft-visibility-toggle" });
		docLink.setAttribute("aria-label", "Open event documentation");
		setIcon(docLink, "file-text");
		docLink.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.openOrCreateEventDoc(entry);
		});

		// Notification toggle (bell)
		const isNotified = this.notifiedTypes.has(entry.type);
		const bellToggle = actions.createSpan({
			cls: `ft-visibility-toggle${isNotified ? "" : " ft-visibility-off"}`,
		});
		bellToggle.setAttribute("aria-label", isNotified ? "Disable notification" : "Enable notification");
		setIcon(bellToggle, isNotified ? "bell" : "bell-off");
		bellToggle.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.eventBus.emit("eventNotify.toggle", { eventType: entry.type });
		});

		// Visibility toggle
		const toggle = actions.createSpan({
			cls: `ft-visibility-toggle${isExcluded ? " ft-visibility-off" : ""}`,
		});
		toggle.setAttribute("aria-label", isExcluded ? "Show in Event Log" : "Hide from Event Log");
		setIcon(toggle, isExcluded ? "eye-off" : "eye");
		toggle.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.eventBus.emit("eventFilter.toggle", { eventType: entry.type });
		});

		// Delete button (custom events only)
		if (isCustom) {
			const deleteBtn = actions.createSpan({ cls: "ft-visibility-toggle ft-visibility-off" });
			deleteBtn.setAttribute("aria-label", "Remove from catalog");
			setIcon(deleteBtn, "trash-2");
			deleteBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				new ConfirmModal(this.app, {
					message: `Remove "${entry.type}" from the catalog?`,
					confirmLabel: "Remove",
					onConfirm: () => {
						void this.eventBus.emit("discovery.remove", { eventName: entry.type });
					},
				}).open();
			});
		}
	}

	/**
	 * Looks up the source file path for a discovered event.
	 */
	private getSourcePath(eventName: string): string | undefined {
		return this.discoveredEvents.find((d) => d.eventName === eventName)?.sourcePath;
	}

	/**
	 * Opens a vault file by path.
	 */
	private async openFile(path: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file && file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);
		}
	}

	/**
	 * Opens the documentation file for an event, creating it if it doesn't exist.
	 */
	private async openOrCreateEventDoc(entry: EventCatalogEntry): Promise<void> {
		const docPath = getEventDocPath(this.eventDocsBasePath, entry.type);

		let file = this.app.vault.getAbstractFileByPath(docPath);

		if (!file) {
			const content = generateEventDocContent(entry);
			try {
				await this.fileSystemClient.createFile(docPath, content, {
					createFolders: true,
				});
			} catch (err) {
				console.error(`[Flowti] Failed to create event doc: ${docPath}`, err);
				return;
			}
			file = this.app.vault.getAbstractFileByPath(docPath);
		}

		if (file && file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);
		}
	}
}
