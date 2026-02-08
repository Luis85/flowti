import { App, PluginSettingTab, Setting } from "obsidian";
import FlowtiBasePlugin from "src/main";

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
