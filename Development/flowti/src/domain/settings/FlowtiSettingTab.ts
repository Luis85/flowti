import { App, PluginSettingTab, Setting } from "obsidian";
import FlowtiBasePlugin from "src/main";
import type { IInstallerService } from "../installer/types";
import { InstallerWizardModal } from "../installer/InstallerWizardModal";

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
