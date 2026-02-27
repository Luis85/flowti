/**
 * Shared rendering helpers for catalog views.
 *
 * Layout builders, stat rendering, and related-section rendering.
 */

import { Setting } from "obsidian";
import type { IEventBus } from "../../../infrastructure/events/types";
import type { Subscription } from "../../../domain/subscription/types";

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
// Subscription form + row rendering
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
		// eslint-disable-next-line obsidianmd/ui/sentence-case
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
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			"The event type to watch for. Use dot notation (e.g. file.created, file.modified). Open the event catalog to browse all available types.",
		);
		eventSetting.addText((text) => {
			// eslint-disable-next-line obsidianmd/ui/sentence-case
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
		.setDesc("Glob pattern matched against the full vault path. Use ** for any depth, * for one level. Example: reports/** matches all files under reports/. Leave empty to match any path.")
		.addText((text) => {
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			text.setPlaceholder("reports/**");
			text.setValue(formData.pathPattern);
			text.onChange((value) => { formData.pathPattern = value; });
		});

	new Setting(container)
		.setName("Extension")
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		.setDesc("File extension without the dot. Only files with this extension will match. Example: csv, md, json. Leave empty to match any extension.")
		.addText((text) => {
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			text.setPlaceholder("csv");
			text.setValue(formData.extension);
			text.onChange((value) => { formData.extension = value; });
		});

	new Setting(container)
		.setName("Name pattern")
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		.setDesc("Glob pattern matched against the filename only (not the full path). Example: report-*.csv matches report-jan.csv. Leave empty to match any filename.")
		.addText((text) => {
			// eslint-disable-next-line obsidianmd/ui/sentence-case
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
