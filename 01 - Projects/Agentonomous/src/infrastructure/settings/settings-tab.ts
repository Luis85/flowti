import { type App, type Plugin, PluginSettingTab, Setting } from 'obsidian';
import type { SettingsPort } from '../../domain/settings/settings-port.js';
import { DEFAULT_SETTINGS, type PluginSettings } from '../../domain/settings/plugin-settings.js';
import { isOk } from '../../domain/shared/result.js';

export class AgentonomousSettingsTab extends PluginSettingTab {
	private readonly port: SettingsPort;
	private current: PluginSettings = DEFAULT_SETTINGS;

	constructor(app: App, plugin: Plugin, port: SettingsPort) {
		super(app, plugin);
		this.port = port;
	}

	display(): void {
		void (async () => {
			const loaded = await this.port.load();
			if (isOk(loaded)) this.current = loaded.value;

			const { containerEl } = this;
			containerEl.empty();

			new Setting(containerEl)
				.setName('Show ribbon icon')
				.setDesc('Show the Agentonomous icon in the left ribbon.')
				.addToggle((toggle) => {
					toggle
						.setValue(this.current.showRibbonIcon)
						.onChange(async (value) => {
							this.current = { ...this.current, showRibbonIcon: value };
							await this.port.save(this.current);
						});
				});

			new Setting(containerEl)
				.setName('Default view')
				.setDesc('Which view opens when the plugin launches.')
				.addDropdown((dropdown) => {
					dropdown
						.addOption('home', 'Home')
						.setValue(this.current.defaultView)
						.onChange(async (value) => {
							if (value === 'home') {
								this.current = { ...this.current, defaultView: 'home' };
								await this.port.save(this.current);
							}
						});
				});
		})();
	}
}
