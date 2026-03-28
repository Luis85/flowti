import { PluginSettingTab, Setting } from 'obsidian';
import type { App, Plugin } from 'obsidian';
import type { MeridianSettings } from '../../domain/core/settings.js';
import type { LogLevel } from '../../domain/core/logger.js';

interface SettingsTabDeps {
	getSettings(): MeridianSettings;
	saveSettings(settings: MeridianSettings): Promise<void>;
}

export class MeridianSettingsTab extends PluginSettingTab {
	private deps: SettingsTabDeps;

	constructor(app: App, plugin: Plugin, deps: SettingsTabDeps) {
		super(app, plugin);
		this.deps = deps;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const settings = this.deps.getSettings();

		new Setting(containerEl)
			.setHeading()
			.setName('Logging');

		new Setting(containerEl)
			.setName('Log level')
			.setDesc('Minimum log level displayed in the developer console.')
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						debug: 'Debug',
						info: 'Info',
						warn: 'Warning',
						error: 'Error',
					})
					.setValue(settings.logLevel)
					.onChange(async (value) => {
						settings.logLevel = value as LogLevel;
						await this.deps.saveSettings(settings);
					}),
			);

		new Setting(containerEl)
			.setHeading()
			.setName('Development');

		new Setting(containerEl)
			.setName('Debug mode')
			.setDesc('Enable debug overlays, verbose logging, and the debug panel.')
			.addToggle((toggle) =>
				toggle
					.setValue(settings.debugMode)
					.onChange(async (value) => {
						settings.debugMode = value;
						await this.deps.saveSettings(settings);
					}),
			);

		new Setting(containerEl)
			.setName('Performance tracking')
			.setDesc('Track system execution times per tick. Visible in the debug panel.')
			.addToggle((toggle) =>
				toggle
					.setValue(settings.performanceTracking)
					.onChange(async (value) => {
						settings.performanceTracking = value;
						await this.deps.saveSettings(settings);
					}),
			);
	}
}
