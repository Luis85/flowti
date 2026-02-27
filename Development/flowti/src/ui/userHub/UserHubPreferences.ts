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
	{ id: "dashboard", label: "Dashboard", icon: "layout-dashboard", description: "KPI measures, visible hubs, quick actions" },
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
			const isSelected = state.selectedPreferencesCategory === cat.id;
			const row = this.masterEl.createDiv({ cls: `ft-catalog-row ft-cursor-pointer ft-pref-cat-row${isSelected ? " ft-catalog-row-active ft-pref-cat-selected" : ""}` });

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

		if (category === "dashboard") {
			this.renderDashboardDetail();
		} else if (category === "profile") {
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
		header.createEl("h3", { text: "Preferences", cls: "ft-heading ft-m-0" });

		info.createEl("p", {
			text: "Select a category to configure your personal settings. Changes are saved automatically.",
			cls: "ft-text-muted",
		});
	}

	private renderDashboardDetail(): void {
		const section = this.detailEl.createDiv({ cls: "ft-detail-section" });
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = header.createSpan();
		setIcon(icon, "layout-dashboard");
		icon.addClass("ft-icon-muted");
		header.createEl("h3", { text: "Dashboard", cls: "ft-heading ft-m-0" });

		section.createEl("p", {
			text: "Configure KPI measures, visible hub summaries, and quick action buttons on the dashboard homepage.",
			cls: "ft-text-sm ft-text-muted",
		});

		const settings = this.deps.getSettings();
		const config = { ...settings.userHubConfig };
		const kpiMeasures = [...config.kpiMeasures];

		// ── KPI Measures ──
		const kpiSection = section.createDiv({ cls: "ft-detail-section ft-pref-folder-section-mt" });
		const kpiHeader = kpiSection.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const kpiIcon = kpiHeader.createSpan();
		setIcon(kpiIcon, "gauge");
		kpiIcon.addClass("ft-icon-muted");
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		kpiHeader.createEl("h4", { text: "KPI measures", cls: "ft-heading ft-m-0" });

		kpiSection.createEl("p", {
			text: "Choose up to 3 hub statistics to display on the KPI row. Leave empty for default.",
			cls: "ft-text-sm ft-text-muted",
		});

		// Build available options from hub registry
		const availableStats: Array<{ ref: string; display: string }> = [];
		const registry = this.deps.hubRegistry;
		if (registry) {
			for (const provider of registry.getAll()) {
				const hubId = provider.getHubId();
				if (hubId === "user-hub") continue;
				const summary = provider.getSummary();
				for (const stat of summary.stats) {
					availableStats.push({
						ref: `${hubId}:${stat.label}`,
						display: `${provider.getDisplayName()} \u2014 ${stat.label}`,
					});
				}
			}
		}

		for (let i = 0; i < 3; i++) {
			const row = kpiSection.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-pref-row" });
			row.createSpan({ text: `Measure ${i + 1}`, cls: "ft-text-sm ft-pref-label-sm" });

			const selectEl = row.createEl("select", { cls: "dropdown ft-flex-1" });
			const emptyOpt = selectEl.createEl("option", { text: "None" });
			emptyOpt.value = "";

			for (const opt of availableStats) {
				const optEl = selectEl.createEl("option", { text: opt.display });
				optEl.value = opt.ref;
			}

			selectEl.value = kpiMeasures[i] ?? "";
			selectEl.addEventListener("change", () => {
				kpiMeasures[i] = selectEl.value;
				const filtered = kpiMeasures.filter((m) => m !== "");
				void this.deps.eventBus.emit("settings.updateUserHubConfig", {
					config: { ...config, kpiMeasures: filtered },
				});
				this.deps.scheduleRender();
			});
		}

		// ── Visible Hubs ──
		const hubSection = section.createDiv({ cls: "ft-detail-section ft-pref-folder-section-mt" });
		const hubHeader = hubSection.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const hubIcon = hubHeader.createSpan();
		setIcon(hubIcon, "boxes");
		hubIcon.addClass("ft-icon-muted");
		hubHeader.createEl("h4", { text: "Visible hubs", cls: "ft-heading ft-m-0" });

		hubSection.createEl("p", {
			text: "Choose which hub summaries appear on the dashboard.",
			cls: "ft-text-sm ft-text-muted",
		});

		const visibleHubs = new Set(config.visibleHubs);
		if (registry) {
			for (const provider of registry.getAll()) {
				const hubId = provider.getHubId();
				if (hubId === "user-hub") continue;

				const row = hubSection.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-pref-row" });
				const toggle = row.createEl("input");
				toggle.type = "checkbox";
				toggle.checked = visibleHubs.has(hubId);
				toggle.addEventListener("change", () => {
					if (toggle.checked) {
						visibleHubs.add(hubId);
					} else {
						visibleHubs.delete(hubId);
					}
					void this.deps.eventBus.emit("settings.updateUserHubConfig", {
						config: { ...config, visibleHubs: Array.from(visibleHubs) },
					});
					this.deps.scheduleRender();
				});

				const rowIcon = row.createSpan();
				setIcon(rowIcon, provider.getIcon());
				rowIcon.addClass("ft-icon-muted");
				row.createSpan({ text: provider.getDisplayName(), cls: "ft-text-sm" });
			}
		}

		// ── Toolbar Actions ──
		const qaSection = section.createDiv({ cls: "ft-detail-section ft-pref-folder-section-mt" });
		const qaHeader = qaSection.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const qaIcon = qaHeader.createSpan();
		setIcon(qaIcon, "zap");
		qaIcon.addClass("ft-icon-muted");
		qaHeader.createEl("h4", { text: "Toolbar actions", cls: "ft-heading ft-m-0" });

		qaSection.createEl("p", {
			text: "Configure which buttons appear in the toolbar.",
			cls: "ft-text-sm ft-text-muted",
		});

		const qaToggleRow = qaSection.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-pref-row" });
		const qaToggle = qaToggleRow.createEl("input");
		qaToggle.type = "checkbox";
		qaToggle.checked = config.showQuickActions;
		qaToggle.addEventListener("change", () => {
			void this.deps.eventBus.emit("settings.updateUserHubConfig", {
				config: { ...config, showQuickActions: qaToggle.checked },
			});
			this.deps.scheduleRender();
		});
		qaToggleRow.createSpan({ text: "Show action buttons in toolbar", cls: "ft-text-sm" });

		// Hub button toggles
		const toolbarHubs = new Set(config.toolbarHubs ?? []);
		if (registry) {
			qaSection.createDiv({ text: "Hub buttons", cls: "ft-text-sm ft-font-semibold ft-mt-2" });
			for (const provider of registry.getAll()) {
				const hubId = provider.getHubId();
				if (hubId === "user-hub") continue;

				const row = qaSection.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-pref-row" });
				const toggle = row.createEl("input");
				toggle.type = "checkbox";
				toggle.checked = toolbarHubs.has(hubId);
				toggle.addEventListener("change", () => {
					if (toggle.checked) {
						toolbarHubs.add(hubId);
					} else {
						toolbarHubs.delete(hubId);
					}
					void this.deps.eventBus.emit("settings.updateUserHubConfig", {
						config: { ...config, toolbarHubs: Array.from(toolbarHubs) },
					});
					this.deps.scheduleRender();
				});

				const actIcon = row.createSpan();
				setIcon(actIcon, provider.getIcon());
				actIcon.addClass("ft-icon-muted");
				row.createSpan({ text: provider.getDisplayName(), cls: "ft-text-sm" });
			}
		}

		// Individual action toggles
		qaSection.createDiv({ text: "Tab & action buttons", cls: "ft-text-sm ft-font-semibold ft-mt-2" });
		const toolbarActions = new Set(config.toolbarActions ?? []);
		const ALL_TOOLBAR_ACTIONS: ReadonlyArray<{ id: string; icon: string; label: string }> = [
			{ id: "new-session", icon: "plus-circle", label: "New session" },
			{ id: "sessions", icon: "timer", label: "Sessions" },
			{ id: "inbox", icon: "inbox", label: "Inbox" },
			{ id: "preferences", icon: "settings", label: "Preferences" },
			{ id: "commands", icon: "terminal", label: "Commands" },
			{ id: "activity-log", icon: "activity", label: "Activity log" },
			{ id: "watchers", icon: "bell", label: "Watchers" },
		];

		for (const act of ALL_TOOLBAR_ACTIONS) {
			const row = qaSection.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-pref-row" });

			const toggle = row.createEl("input");
			toggle.type = "checkbox";
			toggle.checked = toolbarActions.has(act.id);
			toggle.addEventListener("change", () => {
				if (toggle.checked) {
					toolbarActions.add(act.id);
				} else {
					toolbarActions.delete(act.id);
				}
				void this.deps.eventBus.emit("settings.updateUserHubConfig", {
					config: { ...config, toolbarActions: Array.from(toolbarActions) },
				});
				this.deps.scheduleRender();
			});

			const actIcon = row.createSpan();
			setIcon(actIcon, act.icon);
			actIcon.addClass("ft-icon-muted");
			row.createSpan({ text: act.label, cls: "ft-text-sm" });
		}
	}

	private renderProfileDetail(): void {
		const section = this.detailEl.createDiv({ cls: "ft-detail-section" });
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = header.createSpan();
		setIcon(icon, "user");
		icon.addClass("ft-icon-muted");
		header.createEl("h3", { text: "Profile", cls: "ft-heading ft-m-0" });

		const user = this.deps.userService.getUser();

		if (!user) {
			section.createEl("p", {
				text: "No user profile configured. Run the setup wizard to create one.",
				cls: "ft-text-muted ft-text-sm",
			});
			return;
		}

		// Name editing row
		const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-pref-profile-row-mt" });
		row.createSpan({ text: "Display name", cls: "ft-text-sm ft-pref-label-sm" });

		const input = row.createEl("input", { cls: "ft-input ft-flex-1" });
		input.type = "text";
		input.value = user.name;
		input.addEventListener("change", () => {
			const value = input.value.trim();
			if (value) {
				void this.deps.userService.updateUserName(value);
			}
		});

		// User ID display
		const idRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-text-sm ft-text-muted ft-pref-id-row-mt" });
		idRow.createSpan({ text: `User ID: ${user.id}` });
	}

	private renderInboxDetail(): void {
		const section = this.detailEl.createDiv({ cls: "ft-detail-section" });
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = header.createSpan();
		setIcon(icon, "inbox");
		icon.addClass("ft-icon-muted");
		header.createEl("h3", { text: "Inbox sources", cls: "ft-heading ft-m-0" });

		section.createEl("p", {
			text: "Choose which events create inbox notifications. Disabling a source stops new items; existing items are not affected.",
			cls: "ft-text-sm ft-text-muted",
		});

		const state = this.deps.getState();
		const enabled = new Set(state.inboxEnabledSources);

		for (const src of INBOX_SOURCE_DEFINITIONS) {
			const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-pref-row" });

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
		const folderSection = section.createDiv({ cls: "ft-detail-section ft-pref-folder-section-mt" });
		const folderHeader = folderSection.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const folderIcon = folderHeader.createSpan();
		setIcon(folderIcon, "folder-open");
		folderIcon.addClass("ft-icon-muted");
		folderHeader.createEl("h4", { text: "Watched folders", cls: "ft-heading ft-m-0" });

		folderSection.createEl("p", {
			text: "Vault folders monitored for untyped notes. Notes without a 'type' frontmatter field will appear in your inbox.",
			cls: "ft-text-sm ft-text-muted",
		});

		const settings = this.deps.getSettings();
		const folders = [...(settings.inboxWatchedFolders ?? [])];

		for (let i = 0; i < folders.length; i++) {
			const f = folders[i];
			const fRow = folderSection.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-pref-row" });

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

			fRow.createSpan({ text: f.path, cls: "ft-text-sm ft-flex-1" });
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
		const addRow = folderSection.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-pref-add-row-mt" });

		const pathInput = addRow.createEl("input", { cls: "ft-input ft-flex-1" });
		pathInput.type = "text";
		pathInput.placeholder = "e.g. 00 - Connectivity/inbox";
		attachFolderSuggest(pathInput, this.deps.app, (selected) => {
			pathInput.value = selected.replace(/\/$/, "");
		});

		const addBtn = addRow.createEl("button", { text: "+", cls: "mod-cta ft-pref-add-btn-min" });
		addBtn.addEventListener("click", () => {
			const path = pathInput.value.trim();
			if (!path) return;
			folders.push({ path, recursive: false, isPrimary: false });
			void this.deps.eventBus.emit("settings.updateInboxWatchedFolders", { folders });
			this.deps.scheduleRender();
		});

		// ── Triage Target Folder ──
		const targetSection = section.createDiv({ cls: "ft-detail-section ft-pref-folder-section-mt" });
		const targetHeader = targetSection.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const targetIcon = targetHeader.createSpan();
		setIcon(targetIcon, "folder-input");
		targetIcon.addClass("ft-icon-muted");
		targetHeader.createEl("h4", { text: "Triage target folder", cls: "ft-heading ft-m-0" });

		targetSection.createEl("p", {
			text: "Notes from primary watched folders will be moved here after triage.",
			cls: "ft-text-sm ft-text-muted",
		});

		const targetInput = targetSection.createEl("input", { cls: "ft-input ft-pref-target-input" });
		targetInput.type = "text";
		targetInput.value = settings.inboxTriageTargetFolder ?? "";
		targetInput.placeholder = "e.g. 01 - Now/notes";
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
