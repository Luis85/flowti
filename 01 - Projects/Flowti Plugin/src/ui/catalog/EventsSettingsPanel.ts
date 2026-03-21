/**
 * Settings panel for the Events tab.
 * Renders filter toggles, system event toggle, category visibility/ordering, and reset.
 */

import { setIcon } from "obsidian";
import { DEFAULT_CATALOG_CATEGORIES } from "../../domain/settings/settings";
import type { CatalogComponentDeps } from "./types";
import { getOrderedCategories, getConfiguredCount, getFollowedCount } from "./helpers";

export interface EventsSettingsPanelCallbacks {
	filterChipConfigured: boolean;
	filterChipFollowed: boolean;
	onToggleConfigured: () => void;
	onToggleFollowed: () => void;
}

export function renderEventsSettingsPanel(
	container: HTMLElement,
	deps: CatalogComponentDeps,
	callbacks: EventsSettingsPanelCallbacks,
): void {
	container.empty();

	const state = deps.getState();
	const eventsFolder = deps.getEntityFolder("events");

	const configuredCount = getConfiguredCount(state.catalogCategories, state.showSystemEvents, state.discoveredEvents, deps.vaultQuery, eventsFolder, state.subscriptions, state.definitions);
	addToggleRow(container, callbacks.filterChipConfigured, `Only configured (${configuredCount})`, () => callbacks.onToggleConfigured());

	const followedCount = getFollowedCount(state.catalogCategories, state.showSystemEvents, state.discoveredEvents, deps.vaultQuery, eventsFolder, state.notifiedTypes);
	addToggleRow(container, callbacks.filterChipFollowed, `Only followed (${followedCount})`, () => callbacks.onToggleFollowed());

	addToggleRow(container, state.showSystemEvents, "Show system events", () => {
		void deps.eventBus.emit("settings.updateShowSystemEvents", { showSystemEvents: !state.showSystemEvents });
	});

	// Category visibility section
	const categories = getOrderedCategories(state.catalogCategories);

	if (!state.showSystemEvents) {
		container.createDiv({
			cls: "ft-text-muted ft-text-sm ft-settings-hint",
			text: "Enable system events to configure category visibility.",
		});
	} else {

	for (let i = 0; i < categories.length; i++) {
		const cat = categories[i];

		const row = container.createDiv({ cls: "ft-settings-row" });

		// Visibility toggle
		const toggle = row.createSpan({
			cls: `ft-visibility-toggle${cat.visible ? "" : " ft-visibility-off"}`,
		});
		toggle.setAttribute("aria-label", cat.visible ? "Hide category" : "Show category");
		setIcon(toggle, cat.visible ? "eye" : "eye-off");
		toggle.addEventListener("click", () => {
			categories[i] = { ...categories[i], visible: !categories[i].visible };
			void deps.eventBus.emit("settings.updateCatalogCategories", { categories: [...categories] });
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
				void deps.eventBus.emit("settings.updateCatalogCategories", { categories: [...categories] });
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
				void deps.eventBus.emit("settings.updateCatalogCategories", { categories: [...categories] });
			});
		}
	}

	} // end if showSystemEvents

	// Reset button
	const resetRow = container.createDiv({ cls: "ft-settings-reset" });
	const resetBtn = resetRow.createEl("button", {
		text: "Reset to defaults",
		cls: "ft-btn ft-btn-secondary",
	});
	resetBtn.addEventListener("click", () => {
		void deps.eventBus.emit("settings.updateCatalogCategories", {
			categories: [...DEFAULT_CATALOG_CATEGORIES],
		});
	});
}

function addToggleRow(container: HTMLElement, active: boolean, label: string, onClick: () => void): void {
	const row = container.createDiv({ cls: "ft-settings-row" });
	const toggle = row.createSpan({ cls: `ft-visibility-toggle${active ? "" : " ft-visibility-off"}` });
	setIcon(toggle, active ? "eye" : "eye-off");
	toggle.addEventListener("click", onClick);
	row.createSpan({ text: label, cls: "ft-settings-row-name" });
}
