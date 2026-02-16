import { App, PluginSettingTab, Setting } from "obsidian";
import FlowtiBasePlugin from "src/main";
import type { IInstallerService } from "../installer/types";
import { InstallerWizardModal } from "../installer/InstallerWizardModal";
import { DEFAULT_ENTITY_PATHS } from "./settings";
import { INBOX_SOURCE_DEFINITIONS } from "../inbox/types";

/**
 * Settings tab for the Flowti plugin.
 * Provides UI for configuring plugin options and viewing user profile.
 */
export class FlowtiSettingTab extends PluginSettingTab {

	private plugin: FlowtiBasePlugin

	constructor(app: App, plugin: FlowtiBasePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("flowti-settings");

		this.displayUserSection(containerEl);
		this.displaySetupSection(containerEl);
		this.displayEventSystemSection(containerEl);
		this.displayInboxSection(containerEl);
		this.displayDocumentationSection(containerEl);
		this.displayEntityPathsSection(containerEl);
		this.displayGeneralSection(containerEl);
	}

	/**
	 * Display user profile section
	 */
	private displayUserSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "User profile" });

		const user = this.plugin.userService.getUser();

		if (user) {
			new Setting(containerEl)
				.setName("Your name")
				.setDesc(`Your display name within Flowti (ID: ${user.id})`)
				.addText((text) =>
					text
						.setValue(user.name)
						.onChange(async (value) => {
							if (value.trim()) {
								await this.plugin.userService.updateUserName(value);
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
						const installerService =
							await this.plugin.getService<IInstallerService>("installerService");
						await installerService.reset();
						new InstallerWizardModal(
							this.app,
							installerService,
							this.plugin.eventBus,
						).open();
					})
			);
	}

	/**
	 * Display event system toggle section
	 */
	private displayEventSystemSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Event System" });

		new Setting(containerEl)
			.setName("Enable event system")
			.setDesc(
				"When disabled, ingestion, subscriptions, and event definitions stop processing. " +
				"Low-level file events still fire."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.eventSystemEnabled)
					.onChange(async (value) => {
						this.plugin.settings.eventSystemEnabled = value;
						await this.plugin.saveSettings();
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
					.setValue(this.plugin.settings.showSystemEvents)
					.onChange(async (value) => {
						this.plugin.settings.showSystemEvents = value;
						await this.plugin.saveSettings();
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

		const enabled = new Set(this.plugin.settings.inboxEnabledSources ?? []);

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
							void this.plugin.eventBus.emit("settings.updateInboxEnabledSources", {
								sources: Array.from(enabled),
							});
						})
				);
		}
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
					.setValue(this.plugin.settings.docsRootPath)
					.setPlaceholder("03 - Resources/Documentation/Reference")
					.onChange(async (value) => {
						this.plugin.settings.docsRootPath = value;
						await this.plugin.saveSettings();
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

		// Ensure entityPaths exists (backwards compat)
		if (!this.plugin.settings.entityPaths) {
			this.plugin.settings.entityPaths = { ...DEFAULT_ENTITY_PATHS };
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
			const cfg = this.plugin.settings.entityPaths[entity.key] ?? { subfolder: entity.defaultSub, overridePath: "" };

			new Setting(containerEl)
				.setName(`${entity.label} subfolder`)
				.setDesc(`Subfolder name under docs root (default: "${entity.defaultSub}")`)
				.addText((text) =>
					text
						.setValue(cfg.subfolder)
						.setPlaceholder(entity.defaultSub)
						.onChange(async (value) => {
							this.plugin.settings.entityPaths[entity.key].subfolder = value || entity.defaultSub;
							await this.plugin.saveSettings();
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
							this.plugin.settings.entityPaths[entity.key].overridePath = value;
							await this.plugin.saveSettings();
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
					.setValue(this.plugin.settings.debugMode)
					.onChange(async (value) => {
						this.plugin.settings.debugMode = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
