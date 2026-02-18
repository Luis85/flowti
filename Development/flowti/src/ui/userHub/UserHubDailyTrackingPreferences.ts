/**
 * Daily Tracking preferences detail panel for the User Hub.
 *
 * Renders 2 settings:
 * 1. Enable/disable daily session auto-start
 * 2. Daily note path template (supports {{date:YYYY-MM-DD}} placeholders)
 *
 * All mutations flow through EventBus commands → SettingsService.
 */

import { setIcon } from "obsidian";
import type { UserHubComponentDeps } from "./types";

export class UserHubDailyTrackingPreferences {
	constructor(
		private container: HTMLElement,
		private deps: UserHubComponentDeps,
	) {}

	render(): void {
		this.container.empty();
		const settings = this.deps.getSettings();

		const section = this.container.createDiv({ cls: "ft-detail-section" });
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = header.createSpan();
		setIcon(icon, "calendar");
		icon.addClass("ft-icon-muted");
		header.createEl("h3", { text: "Daily Tracking", cls: "ft-heading ft-heading-sm" }).style.margin = "0";

		section.createEl("p", {
			text: "Automatically start a passive all-day session when Obsidian opens.",
			cls: "ft-text-sm ft-text-muted",
		});

		// Enable toggle
		const toggleRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		toggleRow.style.marginTop = "0.5rem";
		const toggleLabel = toggleRow.createSpan({ text: "Enable daily session", cls: "ft-text-sm" });
		toggleLabel.style.minWidth = "140px";
		const toggle = toggleRow.createEl("input");
		toggle.type = "checkbox";
		toggle.checked = settings.enableDailySession;
		toggle.addEventListener("change", () => {
			void this.deps.eventBus.emit("settings.updateDailySession", {
				enableDailySession: toggle.checked,
				dailyNotePath: pathInput.value.trim(),
			});
			setTimeout(() => this.deps.scheduleRender(), 50);
		});

		// Daily note path
		const pathRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		pathRow.style.marginTop = "0.5rem";
		const pathLabel = pathRow.createSpan({ text: "Daily note path", cls: "ft-text-sm" });
		pathLabel.style.minWidth = "140px";
		const pathInput = pathRow.createEl("input", { cls: "ft-input" });
		pathInput.type = "text";
		pathInput.value = settings.dailyNotePath;
		pathInput.placeholder = "03 - Resources/Daily Notes/{{date:YYYY-MM-DD}}.md";
		pathInput.style.flex = "1";
		pathInput.addEventListener("change", () => {
			void this.deps.eventBus.emit("settings.updateDailySession", {
				enableDailySession: toggle.checked,
				dailyNotePath: pathInput.value.trim(),
			});
		});
	}
}
