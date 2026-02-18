import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import type { IUserService } from "../user/types";
import type { IEventBus } from "../../infrastructure/events/types";
import type { IInstallerService } from "../installer/types";
import { InstallerWizardModal } from "../installer/InstallerWizardModal";
import { DEFAULT_ENTITY_PATHS, type FlowtiSettings } from "./settings";
import { INBOX_SOURCE_DEFINITIONS } from "../inbox/types";
import { attachFolderSuggest } from "../../ui/FolderSuggest";

/**
 * Dependencies injected into FlowtiSettingTab.
 *
 * Replaces the previous direct `FlowtiBasePlugin` reference so
 * the domain layer never imports the plugin orchestrator.
 */
export interface FlowtiSettingTabDeps {
	userService: IUserService;
	eventBus: IEventBus;
	getSettings: () => FlowtiSettings;
	saveSettings: () => Promise<void>;
	getInstallerService: () => Promise<IInstallerService>;
}

/**
 * Settings tab for the Flowti plugin.
 * Provides UI for configuring plugin options and viewing user profile.
 */
export class FlowtiSettingTab extends PluginSettingTab {

	private deps: FlowtiSettingTabDeps;

	constructor(app: App, plugin: Plugin, deps: FlowtiSettingTabDeps) {
		super(app, plugin);
		this.deps = deps;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("flowti-settings");

		this.displayUserSection(containerEl);
		this.displaySetupSection(containerEl);
		this.displayEventSystemSection(containerEl);
		this.displayInboxSection(containerEl);
		this.displaySessionSection(containerEl);
		this.displayDocumentationSection(containerEl);
		this.displayEntityPathsSection(containerEl);
		this.displayGeneralSection(containerEl);
	}

	/**
	 * Display user profile section
	 */
	private displayUserSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "User profile" });

		const user = this.deps.userService.getUser();

		if (user) {
			new Setting(containerEl)
				.setName("Your name")
				.setDesc(`Your display name within Flowti (ID: ${user.id})`)
				.addText((text) =>
					text
						.setValue(user.name)
						.onChange(async (value) => {
							if (value.trim()) {
								await this.deps.userService.updateUserName(value);
							}
						})
				);
		} else {
			containerEl.createEl("p", {
				text: "No user configured. Please restart the plugin to set up your profile.",
				cls: "flowti-settings-warning",
			});
		}
	}

	/**
	 * Display setup section with restart button
	 */
	private displaySetupSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Setup" });

		new Setting(containerEl)
			.setName("Run setup wizard")
			.setDesc(
				"Re-run the installation wizard to scaffold folders and configure your profile"
			)
			.addButton((btn) =>
				btn
					.setButtonText("Restart setup")
					.onClick(async () => {
						const installerService = await this.deps.getInstallerService();
						await installerService.reset();
						new InstallerWizardModal(
							this.app,
							installerService,
							this.deps.eventBus,
						).open();
					})
			);
	}

	/**
	 * Display event system toggle section
	 */
	private displayEventSystemSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Event System" });

		const settings = this.deps.getSettings();

		new Setting(containerEl)
			.setName("Enable event system")
			.setDesc(
				"When disabled, ingestion, subscriptions, and event definitions stop processing. " +
				"Low-level file events still fire."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(settings.eventSystemEnabled)
					.onChange(async (value) => {
						this.deps.getSettings().eventSystemEnabled = value;
						await this.deps.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Show system events")
			.setDesc(
				"Show internal plugin events (tagged 'system') in the Event Catalog. " +
				"Disable to focus on your own domain events."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(settings.showSystemEvents)
					.onChange(async (value) => {
						this.deps.getSettings().showSystemEvents = value;
						await this.deps.saveSettings();
					})
			);
	}

	/**
	 * Display inbox notification sources section
	 */
	private displayInboxSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Inbox" });
		containerEl.createEl("p", {
			text: "Choose which events create inbox notifications. " +
				"Disabling a source stops new items; existing items are not affected.",
			cls: "setting-item-description",
		});

		const enabled = new Set(this.deps.getSettings().inboxEnabledSources ?? []);

		for (const src of INBOX_SOURCE_DEFINITIONS) {
			new Setting(containerEl)
				.setName(src.label)
				.setDesc(src.desc)
				.addToggle((toggle) =>
					toggle
						.setValue(enabled.has(src.event))
						.onChange(async (value) => {
							if (value) {
								enabled.add(src.event);
							} else {
								enabled.delete(src.event);
							}
							void this.deps.eventBus.emit("settings.updateInboxEnabledSources", {
								sources: Array.from(enabled),
							});
						})
				);
		}
	}

	/**
	 * Display session settings section
	 */
	private displaySessionSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Sessions" });

		const settings = this.deps.getSettings();
		const filter = [...(settings.sessionActivityFilterGlobal ?? [])];

		let inputValue = "";
		new Setting(containerEl)
			.setName("Activity log folder filter")
			.setDesc(
				"Vault folders excluded from the session activity log globally (prefix match). " +
				"Per-session filters can be set in each Session Workspace."
			)
			.addText((text) => {
				text.setPlaceholder("e.g. .obsidian/");
				text.onChange((value) => { inputValue = value; });
				attachFolderSuggest(text.inputEl, this.app, (path) => { inputValue = path; });
			})
			.addExtraButton((btn) =>
				btn.setIcon("plus").setTooltip("Add folder").onClick(async () => {
					if (inputValue.trim()) {
						settings.sessionActivityFilterGlobal.push(inputValue.trim());
						await this.deps.saveSettings();
						this.display();
					}
				})
			);

		for (const folder of filter) {
			new Setting(containerEl)
				.setName(folder)
				.addExtraButton((btn) =>
					btn.setIcon("x").setTooltip("Remove").onClick(async () => {
						settings.sessionActivityFilterGlobal =
							settings.sessionActivityFilterGlobal.filter((f) => f !== folder);
						await this.deps.saveSettings();
						this.display();
					})
				);
		}

		this.displayCustomSessionTypes(containerEl, settings);
	}

	/**
	 * Display custom session type creation/editing within the Sessions section.
	 */
	private displayCustomSessionTypes(containerEl: HTMLElement, settings: FlowtiSettings): void {
		containerEl.createEl("h4", { text: "Custom Session Types" });
		containerEl.createEl("p", {
			text: "Create custom session types with their own guiding questions, duration, and goals.",
			cls: "setting-item-description",
		});

		const customTypes = settings.customSessionTypes ?? {};

		// List existing custom types
		for (const [key, cfg] of Object.entries(customTypes)) {
			new Setting(containerEl)
				.setName(cfg.label || key)
				.setDesc(`${cfg.defaultDuration} min | ${cfg.guidingQuestions.length} questions`)
				.addExtraButton((btn) =>
					btn.setIcon("x").setTooltip("Remove").onClick(() => {
						const updated = { ...customTypes };
						delete updated[key];
						void this.deps.eventBus.emit("settings.updateCustomSessionTypes", { types: updated });
						// Re-render after a tick to let event propagate
						setTimeout(() => this.display(), 50);
					})
				);
		}

		// Add new custom type form
		let typeName = "";
		let typeLabel = "";
		let typeDuration = "25";
		let typeQuestions = "";

		new Setting(containerEl)
			.setName("Type key")
			.setDesc("A unique slug (e.g. sprint-review)")
			.addText((text) =>
				text.setPlaceholder("e.g. sprint-review")
					.onChange((value) => { typeName = value; })
			);

		new Setting(containerEl)
			.setName("Display label")
			.addText((text) =>
				text.setPlaceholder("e.g. Sprint Review")
					.onChange((value) => { typeLabel = value; })
			);

		new Setting(containerEl)
			.setName("Default duration (min)")
			.addText((text) =>
				text.setValue("25")
					.onChange((value) => { typeDuration = value; })
			);

		new Setting(containerEl)
			.setName("Guiding questions")
			.setDesc("One per line")
			.addTextArea((ta) =>
				ta.setPlaceholder("What is the goal?\nWhat do we need to decide?")
					.onChange((value) => { typeQuestions = value; })
			);

		new Setting(containerEl)
			.addButton((btn) =>
				btn.setButtonText("Add Custom Type").setCta().onClick(() => {
					const key = typeName.trim().toLowerCase().replace(/\s+/g, "-");
					const label = typeLabel.trim();
					if (!key || !label) return;
					const dur = parseInt(typeDuration, 10) || 25;
					const questions = typeQuestions.split("\n").map((q) => q.trim()).filter(Boolean);
					const updated = {
						...customTypes,
						[key]: { type: key, label, icon: "star", guidingQuestions: questions, defaultDuration: dur, defaultGoals: [] },
					};
					void this.deps.eventBus.emit("settings.updateCustomSessionTypes", { types: updated });
					setTimeout(() => this.display(), 50);
				})
			);
	}

	/**
	 * Display documentation settings section
	 */
	private displayDocumentationSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Documentation" });

		new Setting(containerEl)
			.setName("Documentation root path")
			.setDesc(
				"Vault folder under which documentation subfolders " +
				"(Events, Domains, Services, Categories, Flows, Systems, Actors) are created."
			)
			.addText((text) =>
				text
					.setValue(this.deps.getSettings().docsRootPath)
					.setPlaceholder("03 - Resources/Documentation/Reference")
					.onChange(async (value) => {
						this.deps.getSettings().docsRootPath = value;
						await this.deps.saveSettings();
					})
			);
	}

	/**
	 * Display per-entity folder path settings
	 */
	private displayEntityPathsSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Entity Folder Paths" });
		containerEl.createEl("p", {
			text: "Customise where each entity type stores its documentation files. " +
				"By default, each uses a subfolder under the documentation root path. " +
				"Set an override path to use a completely independent vault location.",
			cls: "setting-item-description",
		});

		const settings = this.deps.getSettings();

		// Ensure entityPaths exists (backwards compat)
		if (!settings.entityPaths) {
			settings.entityPaths = { ...DEFAULT_ENTITY_PATHS };
		}

		const entities: Array<{ key: keyof typeof DEFAULT_ENTITY_PATHS; label: string; defaultSub: string }> = [
			{ key: "events", label: "Events", defaultSub: "Events" },
			{ key: "domains", label: "Domains", defaultSub: "Domains" },
			{ key: "services", label: "Services", defaultSub: "Services" },
			{ key: "categories", label: "Categories", defaultSub: "Categories" },
			{ key: "flows", label: "Flows", defaultSub: "Flows" },
			{ key: "systems", label: "Systems", defaultSub: "Systems" },
			{ key: "actors", label: "Actors", defaultSub: "Actors" },
		];

		for (const entity of entities) {
			const cfg = settings.entityPaths[entity.key] ?? { subfolder: entity.defaultSub, overridePath: "" };

			new Setting(containerEl)
				.setName(`${entity.label} subfolder`)
				.setDesc(`Subfolder name under docs root (default: "${entity.defaultSub}")`)
				.addText((text) =>
					text
						.setValue(cfg.subfolder)
						.setPlaceholder(entity.defaultSub)
						.onChange(async (value) => {
							this.deps.getSettings().entityPaths[entity.key].subfolder = value || entity.defaultSub;
							await this.deps.saveSettings();
						})
				);

			new Setting(containerEl)
				.setName(`${entity.label} override path`)
				.setDesc("Absolute vault path (overrides root + subfolder when set)")
				.addText((text) =>
					text
						.setValue(cfg.overridePath)
						.setPlaceholder("Leave empty to use default")
						.onChange(async (value) => {
							this.deps.getSettings().entityPaths[entity.key].overridePath = value;
							await this.deps.saveSettings();
						})
				);
		}
	}

	/**
	 * Display general settings section
	 */
	private displayGeneralSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "General" });

		new Setting(containerEl)
			.setName("Debug mode")
			.setDesc(
				"Log detailed information to the developer console (Ctrl+Shift+I)"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.deps.getSettings().debugMode)
					.onChange(async (value) => {
						this.deps.getSettings().debugMode = value;
						await this.deps.saveSettings();
					})
			);
	}
}
