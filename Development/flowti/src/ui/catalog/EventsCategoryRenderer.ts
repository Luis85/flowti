/**
 * Category and event item renderer for the Events tab master tree.
 * Handles collapsible category groups, event items with status dots,
 * and category action buttons (create, doc, visibility).
 */

import { TFile, setIcon } from "obsidian";
import type { EventCatalogEntry } from "../../infrastructure/events/catalog";
import { getCategoryDocPathResolved, generateCategoryDocContent } from "../eventDocTemplate";
import { InputModal, CreateEventModal } from "../modals";
import type { CatalogComponentDeps, CatalogState, CategoryEntry } from "./types";
import { UNCATEGORIZED_CATEGORY, isConfigured, openFile } from "./helpers";

export interface CategoryRenderContext {
	deps: CatalogComponentDeps;
	state: CatalogState;
	categoryEntries: CategoryEntry[];
	selectedEventType: string | null;
	onSelectEvent: (eventType: string) => void;
	getUserCategories: () => string[];
}

export function renderMasterCategory(
	container: HTMLElement,
	category: string,
	entries: EventCatalogEntry[],
	isUserCategory: boolean,
	ctx: CategoryRenderContext,
): void {
	const { deps, state, categoryEntries } = ctx;
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
	const catEntry = categoryEntries.find((c) => c.name === category);
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
		renderUserCategoryActions(header, category, deps, ctx);
	} else {
		renderSystemCategoryActions(header, category, entries, state, deps, catEntry ?? null);
	}

	const list = group.createDiv();
	if (isCollapsed) list.classList.add("ft-hidden");

	for (const entry of entries) {
		renderMasterEventItem(list, entry, ctx);
	}

	if (isEmptyUncategorized) {
		header.addEventListener("click", () => {
			new CreateEventModal(deps.app, {
				title: "Create Custom Event",
				existingCategories: ctx.getUserCategories(),
				onSubmit: (name, cat) => {
					void deps.eventBus.emit("discovery.create", {
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
			void deps.eventBus.emit("settings.updateCollapsedCategories", {
				collapsed: [...state.collapsedCategories],
			});
		});
	}
}

function renderUserCategoryActions(
	header: HTMLElement,
	category: string,
	deps: CatalogComponentDeps,
	ctx: CategoryRenderContext,
): void {
	const addBtn = header.createSpan({ cls: "ft-visibility-toggle" });
	addBtn.style.marginLeft = "auto";
	setIcon(addBtn, "plus");
	addBtn.setAttribute("aria-label", "Create event");
	addBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		if (category !== UNCATEGORIZED_CATEGORY) {
			// Auto-inherit category for named user categories
			new InputModal(deps.app, {
				title: `Create Event in "${category}"`,
				placeholder: "my.custom.event",
				submitLabel: "Create",
				inputName: "Event name",
				inputDesc: "Use dot notation (e.g. order.placed)",
				onSubmit: (name) => {
					void deps.eventBus.emit("discovery.create", { eventName: name, category });
				},
			}).open();
		} else {
			// Uncategorized — open full CreateEventModal with category choice
			new CreateEventModal(deps.app, {
				title: "Create Custom Event",
				existingCategories: ctx.getUserCategories(),
				onSubmit: (name, cat) => {
					void deps.eventBus.emit("discovery.create", {
						eventName: name,
						...(cat ? { category: cat } : {}),
					});
				},
			}).open();
		}
	});
}

function renderSystemCategoryActions(
	header: HTMLElement,
	category: string,
	entries: EventCatalogEntry[],
	state: CatalogState,
	deps: CatalogComponentDeps,
	catEntry: CategoryEntry | null,
): void {
	// Category doc button
	const catDocBtn = header.createSpan({ cls: "ft-visibility-toggle" });
	catDocBtn.setAttribute("aria-label", catEntry?.filePath ? "Open category doc" : "Create category doc");
	setIcon(catDocBtn, "file-text");
	catDocBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		if (catEntry?.filePath) {
			void openFile(deps.workspace, catEntry.filePath);
		} else {
			void openOrCreateCategoryDoc(deps, category, entries);
		}
	});

	// Category visibility toggle
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
		void deps.eventBus.emit("eventFilter.toggleCategory", { category });
	});
}

function renderMasterEventItem(
	container: HTMLElement,
	entry: EventCatalogEntry,
	ctx: CategoryRenderContext,
): void {
	const { state, selectedEventType, onSelectEvent } = ctx;
	const isSelected = selectedEventType === entry.type;
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

	item.addEventListener("click", () => onSelectEvent(entry.type));
}

async function openOrCreateCategoryDoc(
	deps: CatalogComponentDeps,
	category: string,
	events: EventCatalogEntry[],
): Promise<void> {
	const docPath = getCategoryDocPathResolved(deps.getEntityFolder("categories"), category);

	const file = deps.app.vault.getAbstractFileByPath(docPath);

	if (file && file instanceof TFile) {
		const leaf = deps.app.workspace.getLeaf(false);
		await leaf.openFile(file);
		return;
	}

	const content = generateCategoryDocContent(category, events);
	await deps.eventBus.emit("doc.create", {
		docType: "CategoryDoc" as const,
		name: category,
		path: docPath,
		content,
		source: "EventsTab",
	});

	// Try to open the newly created file
	const newFile = deps.app.vault.getAbstractFileByPath(docPath);
	if (newFile && newFile instanceof TFile) {
		const leaf = deps.app.workspace.getLeaf(false);
		await leaf.openFile(newFile);
	}
}
