/**
 * Preferences component for the User Hub.
 *
 * Master-detail layout with 4 categories:
 * - Profile: display name and user identity
 * - Inbox: notification source toggles
 * - Sessions: activity filter, custom types, output templates
 * - Daily Tracking: auto-start and daily note path
 */

import { setIcon } from "obsidian";
import type { UserHubComponentDeps, PreferencesCategory } from "./types";
import { INBOX_SOURCE_DEFINITIONS } from "../../domain/inbox/types";
import { UserHubSessionPreferences } from "./UserHubSessionPreferences";
import { UserHubDailyTrackingPreferences } from "./UserHubDailyTrackingPreferences";

const CATEGORIES: ReadonlyArray<{ id: PreferencesCategory; label: string; icon: string; description: string }> = [
	{ id: "profile", label: "Profile", icon: "user", description: "Display name and identity" },
	{ id: "inbox", label: "Inbox", icon: "inbox", description: "Notification source toggles" },
	{ id: "sessions", label: "Sessions", icon: "timer", description: "Activity filter, types, templates" },
	{ id: "daily-tracking", label: "Daily Tracking", icon: "calendar", description: "Auto-start and daily note" },
];

export class UserHubPreferences {
	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: UserHubComponentDeps,
	) {}

	renderMaster(): void {
		this.masterEl.empty();

		const state = this.deps.getState();

		for (const cat of CATEGORIES) {
			const row = this.masterEl.createDiv({ cls: "ft-catalog-row ft-cursor-pointer" });
			if (state.selectedPreferencesCategory === cat.id) {
				row.addClass("ft-catalog-row-active");
				row.style.backgroundColor = "var(--background-modifier-hover)";
			}
			row.style.padding = "0.5rem 0.75rem";

			const content = row.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			const icon = content.createSpan();
			setIcon(icon, cat.icon);
			icon.addClass("ft-icon-muted");

			const text = content.createDiv();
			text.createDiv({ text: cat.label, cls: "ft-text-sm" });
			text.createDiv({ text: cat.description, cls: "ft-text-sm ft-text-muted" });

			row.addEventListener("click", () => {
				this.deps.setState({ selectedPreferencesCategory: cat.id });
				this.deps.scheduleRender();
			});
		}
	}

	renderDetail(): void {
		this.detailEl.empty();

		const state = this.deps.getState();
		const category = state.selectedPreferencesCategory;

		if (!category) {
			this.renderEmptyDetail();
			return;
		}

		if (category === "profile") {
			this.renderProfileDetail();
		} else if (category === "inbox") {
			this.renderInboxDetail();
		} else if (category === "sessions") {
			new UserHubSessionPreferences(this.detailEl, this.deps).render();
		} else if (category === "daily-tracking") {
			new UserHubDailyTrackingPreferences(this.detailEl, this.deps).render();
		}
	}

	// ── Detail renderers ───────────────────────────────────────

	private renderEmptyDetail(): void {
		const info = this.detailEl.createDiv({ cls: "ft-detail-section" });
		const header = info.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = header.createSpan();
		setIcon(icon, "settings");
		icon.addClass("ft-icon-muted");
		header.createEl("h3", { text: "Preferences", cls: "ft-heading" }).style.margin = "0";

		info.createEl("p", {
			text: "Select a category to configure your personal settings. Changes are saved automatically.",
			cls: "ft-text-muted",
		});
	}

	private renderProfileDetail(): void {
		const section = this.detailEl.createDiv({ cls: "ft-detail-section" });
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = header.createSpan();
		setIcon(icon, "user");
		icon.addClass("ft-icon-muted");
		header.createEl("h3", { text: "Profile", cls: "ft-heading" }).style.margin = "0";

		const user = this.deps.userService.getUser();

		if (!user) {
			section.createEl("p", {
				text: "No user profile configured. Run the setup wizard to create one.",
				cls: "ft-text-muted ft-text-sm",
			});
			return;
		}

		// Name editing row
		const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		row.style.marginTop = "0.5rem";
		const label = row.createSpan({ text: "Display name", cls: "ft-text-sm" });
		label.style.minWidth = "100px";

		const input = row.createEl("input", { cls: "ft-input" });
		input.type = "text";
		input.value = user.name;
		input.style.flex = "1";
		input.addEventListener("change", () => {
			const value = input.value.trim();
			if (value) {
				void this.deps.userService.updateUserName(value);
			}
		});

		// User ID display
		const idRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-text-sm ft-text-muted" });
		idRow.style.marginTop = "0.25rem";
		idRow.createSpan({ text: `User ID: ${user.id}` });
	}

	private renderInboxDetail(): void {
		const section = this.detailEl.createDiv({ cls: "ft-detail-section" });
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = header.createSpan();
		setIcon(icon, "inbox");
		icon.addClass("ft-icon-muted");
		header.createEl("h3", { text: "Inbox Sources", cls: "ft-heading" }).style.margin = "0";

		section.createEl("p", {
			text: "Choose which events create inbox notifications. Disabling a source stops new items; existing items are not affected.",
			cls: "ft-text-sm ft-text-muted",
		});

		const state = this.deps.getState();
		const enabled = new Set(state.inboxEnabledSources);

		for (const src of INBOX_SOURCE_DEFINITIONS) {
			const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			row.style.padding = "0.25rem 0";

			const toggle = row.createEl("input");
			toggle.type = "checkbox";
			toggle.checked = enabled.has(src.event);
			toggle.addEventListener("change", () => {
				if (toggle.checked) {
					enabled.add(src.event);
				} else {
					enabled.delete(src.event);
				}
				const sources = Array.from(enabled);
				void this.deps.eventBus.emit("settings.updateInboxEnabledSources", { sources });
				this.deps.setState({ inboxEnabledSources: sources });
			});

			const labelEl = row.createDiv();
			labelEl.createDiv({ text: src.label, cls: "ft-text-sm" });
			labelEl.createDiv({ text: src.desc, cls: "ft-text-sm ft-text-muted" });
		}
	}
}
