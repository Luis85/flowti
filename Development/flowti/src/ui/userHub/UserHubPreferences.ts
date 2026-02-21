/**
 * Preferences component for the User Hub.
 *
 * Master-detail layout with 5 categories:
 * - Profile: display name and user identity
 * - Inbox: notification source toggles
 * - Sessions: activity filter, custom types, output templates
 * - Nudges: time-based session start reminders
 * - Trains: train of thought preferences
 */

import { setIcon } from "obsidian";
import type { UserHubComponentDeps, PreferencesCategory } from "./types";
import { INBOX_SOURCE_DEFINITIONS } from "../../domain/inbox/types";
import { UserHubSessionPreferences } from "./UserHubSessionPreferences";
import { UserHubNudgePreferences } from "./UserHubNudgePreferences";
import { UserHubTrainPreferences } from "./UserHubTrainPreferences";
import { attachFolderSuggest } from "../FolderSuggest";

const CATEGORIES: ReadonlyArray<{ id: PreferencesCategory; label: string; icon: string; description: string }> = [
	{ id: "profile", label: "Profile", icon: "user", description: "Display name and identity" },
	{ id: "inbox", label: "Inbox", icon: "inbox", description: "Notification source toggles" },
	{ id: "sessions", label: "Sessions", icon: "timer", description: "Activity filter, types, templates" },
	{ id: "nudges", label: "Nudges", icon: "bell", description: "Time-based session start reminders" },
	{ id: "trains", label: "Trains", icon: "train-front", description: "Train of Thought settings" },
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
		} else if (category === "nudges") {
			new UserHubNudgePreferences(this.detailEl, this.deps).render();
		} else if (category === "trains") {
			new UserHubTrainPreferences(this.detailEl, this.deps).render();
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

		// ── Watched Folders ──
		const folderSection = section.createDiv({ cls: "ft-detail-section" });
		folderSection.style.marginTop = "1rem";
		const folderHeader = folderSection.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const folderIcon = folderHeader.createSpan();
		setIcon(folderIcon, "folder-open");
		folderIcon.addClass("ft-icon-muted");
		folderHeader.createEl("h4", { text: "Watched Folders", cls: "ft-heading" }).style.margin = "0";

		folderSection.createEl("p", {
			text: "Vault folders monitored for untyped notes. Notes without a 'type' frontmatter field will appear in your inbox.",
			cls: "ft-text-sm ft-text-muted",
		});

		const settings = this.deps.getSettings();
		const folders = [...(settings.inboxWatchedFolders ?? [])];

		for (let i = 0; i < folders.length; i++) {
			const f = folders[i];
			const fRow = folderSection.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			fRow.style.padding = "0.25rem 0";

			const primaryToggle = fRow.createEl("input");
			primaryToggle.type = "checkbox";
			primaryToggle.checked = !!f.isPrimary;
			primaryToggle.title = "Primary (route to target folder on triage)";
			primaryToggle.addEventListener("change", () => {
				folders[i] = { ...f, isPrimary: primaryToggle.checked };
				void this.deps.eventBus.emit("settings.updateInboxWatchedFolders", { folders });
				this.deps.scheduleRender();
			});
			fRow.createSpan({ text: "P", cls: `ft-badge ft-text-sm ${f.isPrimary ? "" : "ft-badge-muted"}` }).title = "Primary";

			const recToggle = fRow.createEl("input");
			recToggle.type = "checkbox";
			recToggle.checked = f.recursive;
			recToggle.title = "Recursive (include subfolders)";
			recToggle.addEventListener("change", () => {
				folders[i] = { ...f, recursive: recToggle.checked };
				void this.deps.eventBus.emit("settings.updateInboxWatchedFolders", { folders });
				this.deps.scheduleRender();
			});

			fRow.createSpan({ text: f.path, cls: "ft-text-sm" }).style.flex = "1";
			fRow.createSpan({ text: f.recursive ? "recursive" : "direct only", cls: "ft-badge ft-badge-muted ft-text-sm" });

			const removeBtn = fRow.createSpan({ cls: "ft-cursor-pointer" });
			setIcon(removeBtn, "x");
			removeBtn.addEventListener("click", () => {
				folders.splice(i, 1);
				void this.deps.eventBus.emit("settings.updateInboxWatchedFolders", { folders });
				this.deps.scheduleRender();
			});
		}

		// Add row
		const addRow = folderSection.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		addRow.style.marginTop = "0.5rem";

		const pathInput = addRow.createEl("input", { cls: "ft-input" });
		pathInput.type = "text";
		pathInput.placeholder = "e.g. 00 - Connectivity/inbox";
		pathInput.style.flex = "1";
		attachFolderSuggest(pathInput, this.deps.app, (selected) => {
			pathInput.value = selected.replace(/\/$/, "");
		});

		const addBtn = addRow.createEl("button", { text: "+", cls: "mod-cta" });
		addBtn.style.minWidth = "2rem";
		addBtn.addEventListener("click", () => {
			const path = pathInput.value.trim();
			if (!path) return;
			folders.push({ path, recursive: false, isPrimary: false });
			void this.deps.eventBus.emit("settings.updateInboxWatchedFolders", { folders });
			this.deps.scheduleRender();
		});

		// ── Triage Target Folder ──
		const targetSection = section.createDiv({ cls: "ft-detail-section" });
		targetSection.style.marginTop = "1rem";
		const targetHeader = targetSection.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const targetIcon = targetHeader.createSpan();
		setIcon(targetIcon, "folder-input");
		targetIcon.addClass("ft-icon-muted");
		targetHeader.createEl("h4", { text: "Triage Target Folder", cls: "ft-heading" }).style.margin = "0";

		targetSection.createEl("p", {
			text: "Notes from primary watched folders will be moved here after triage.",
			cls: "ft-text-sm ft-text-muted",
		});

		const targetInput = targetSection.createEl("input", { cls: "ft-input" });
		targetInput.type = "text";
		targetInput.value = settings.inboxTriageTargetFolder ?? "";
		targetInput.placeholder = "e.g. 01 - Now/notes";
		targetInput.style.width = "100%";
		attachFolderSuggest(targetInput, this.deps.app, (selected) => {
			const path = selected.replace(/\/$/, "");
			targetInput.value = path;
			void this.deps.eventBus.emit("settings.updateInboxTriageTargetFolder", { folder: path });
		});
		targetInput.addEventListener("change", () => {
			void this.deps.eventBus.emit("settings.updateInboxTriageTargetFolder", { folder: targetInput.value.trim() });
		});
	}
}
