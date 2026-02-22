import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { IInstallerService } from "../installer/types";
import { InstallerWizardModal } from "../installer/InstallerWizardModal";
import { DEFAULT_ENTITY_PATHS, type FlowtiSettings } from "./settings";

/**
 * Dependencies injected into FlowtiSettingTab.
 *
 * Replaces the previous direct `FlowtiBasePlugin` reference so
 * the domain layer never imports the plugin orchestrator.
 */
export interface FlowtiSettingTabDeps {
	eventBus: IEventBus;
	getSettings: () => FlowtiSettings;
	saveSettings: () => Promise<void>;
	getInstallerService: () => Promise<IInstallerService>;
}

/**
 * Settings tab for the Flowti plugin.
 *
 * Cross-domain infrastructure settings only.
 * Domain-specific settings (User, Inbox, Sessions) are configured
 * in User Hub → Preferences tab. See UserHubPreferences.ts.
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

		this.displaySetupSection(containerEl);
		this.displayEventSystemSection(containerEl);
		this.displayDocumentationSection(containerEl);
		this.displayEntityPathsSection(containerEl);
		this.displayTrainSection(containerEl);
		this.displayGeneralSection(containerEl);
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

		new Setting(containerEl)
			.setName("Quick Capture folder")
			.setDesc(
				"Vault folder where Quick Capture notes are created. " +
				"The folder is created automatically if it doesn't exist."
			)
			.addText((text) =>
				text
					.setValue(this.deps.getSettings().captureFolder)
					.setPlaceholder("00 - Connectivity/inbox")
					.onChange(async (value) => {
						this.deps.getSettings().captureFolder = value;
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
	 * Display Train of Thoughts settings section
	 */
	private displayTrainSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Train of Thoughts" });

		const settings = this.deps.getSettings();

		new Setting(containerEl)
			.setName("Default train duration")
			.setDesc(
				"Default timer for Train of Thought sessions (0 = no timer)"
			)
			.addDropdown((dd) => {
				dd.addOption("0", "Unlimited (no timer)");
				dd.addOption("5", "5 min");
				dd.addOption("10", "10 min");
				dd.addOption("15", "15 min");
				dd.addOption("25", "25 min (Pomodoro)");
				dd.addOption("50", "50 min (Deep Work)");
				dd.setValue(String(settings.defaultTrainDuration));
				dd.onChange((value) => {
					void this.deps.eventBus.emit("settings.updateDefaultTrainDuration", {
						value: parseInt(value, 10),
					});
				});
			});

		new Setting(containerEl)
			.setName("Train folder")
			.setDesc("Vault folder where Train of Thought notes are saved")
			.addText((text) =>
				text
					.setValue(settings.trainFolder)
					.setPlaceholder("00 - Connectivity/trains")
					.onChange((value) => {
						void this.deps.eventBus.emit("settings.updateTrainFolder", { folder: value });
					})
			);

		new Setting(containerEl)
			.setName("Auto-open timeline")
			.setDesc("Automatically open the timeline sidebar when starting a train")
			.addToggle((toggle) =>
				toggle
					.setValue(settings.trainAutoOpenTimeline)
					.onChange((value) => {
						void this.deps.eventBus.emit("settings.updateTrainAutoOpenTimeline", { enabled: value });
					})
			);

		new Setting(containerEl)
			.setName("Maximum thoughts per train")
			.setDesc("Maximum number of thoughts allowed in a single train (1-1000)")
			.addText((text) =>
				text
					.setValue(String(settings.trainMaxThoughts))
					.setPlaceholder("100")
					.onChange((value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 1 && num <= 1000) {
							void this.deps.eventBus.emit("settings.updateTrainMaxThoughts", { max: num });
						}
					})
			);

		new Setting(containerEl)
			.setName("Canvas auto-generation")
			.setDesc("Automatically generate a .canvas file mirroring the train graph")
			.addToggle((toggle) =>
				toggle
					.setValue(settings.trainCanvasEnabled)
					.onChange((value) => {
						void this.deps.eventBus.emit("settings.updateTrainCanvasEnabled", { enabled: value });
					})
			);

		new Setting(containerEl)
			.setName("Auto-open canvas")
			.setDesc("Automatically open the canvas when a train starts")
			.addToggle((toggle) =>
				toggle
					.setValue(settings.trainCanvasAutoOpen)
					.onChange((value) => {
						void this.deps.eventBus.emit("settings.updateTrainCanvasAutoOpen", { enabled: value });
					})
			);
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
