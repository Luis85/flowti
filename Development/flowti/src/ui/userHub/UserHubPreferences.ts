/**
 * Preferences component for the User Hub.
 *
 * Renders user profile editing and inbox source toggles
 * in a master-detail split layout.
 */

import { setIcon } from "obsidian";
import type { UserHubComponentDeps } from "./types";
import { INBOX_SOURCE_DEFINITIONS } from "../../domain/inbox/types";

export class UserHubPreferences {
	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: UserHubComponentDeps,
	) {}

	renderMaster(): void {
		this.masterEl.empty();
		this.renderProfileSection();
		this.renderInboxSourcesSection();
	}

	renderDetail(): void {
		this.detailEl.empty();

		const info = this.detailEl.createDiv({ cls: "ft-detail-section" });
		const header = info.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = header.createSpan();
		setIcon(icon, "settings");
		icon.addClass("ft-icon-muted");
		header.createEl("h3", { text: "Preferences", cls: "ft-heading" }).style.margin = "0";

		info.createEl("p", {
			text: "Configure your personal settings. Changes are saved automatically.",
			cls: "ft-text-muted",
		});
	}

	private renderProfileSection(): void {
		const section = this.masterEl.createDiv({ cls: "ft-detail-section" });
		section.createEl("h3", { text: "User Profile", cls: "ft-heading ft-heading-sm" });

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

	private renderInboxSourcesSection(): void {
		const section = this.masterEl.createDiv({ cls: "ft-detail-section" });
		section.style.marginTop = "1rem";
		section.createEl("h3", { text: "Inbox Sources", cls: "ft-heading ft-heading-sm" });
		section.createEl("p", {
			text: "Choose which events create inbox notifications.",
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
