import { type App, Notice, type Plugin, PluginSettingTab, Setting } from 'obsidian';
import type { SettingsPort } from '../../domain/settings/settings-port.js';
import { DEFAULT_SETTINGS, isDefaultViewName, KNOWN_DEFAULT_VIEWS, type PluginSettings } from '../../domain/settings/plugin-settings.js';
import { isErr, isOk } from '../../domain/shared/result.js';

export class AgentonomousSettingsTab extends PluginSettingTab {
	private readonly port: SettingsPort;
	private current: PluginSettings = DEFAULT_SETTINGS;

	constructor(app: App, plugin: Plugin, port: SettingsPort) {
		super(app, plugin);
		this.port = port;
	}

	private async persist(next: PluginSettings): Promise<void> {
		const result = await this.port.save(next);
		if (isErr(result)) {
			new Notice(`Agentonomous: failed to save settings — ${result.error}`);
			return;
		}
		this.current = next;
	}

	display(): void {
		void (async () => {
			const loaded = await this.port.load();
			if (isOk(loaded)) {
				this.current = loaded.value;
			} else {
				new Notice(`Agentonomous: failed to load settings — using defaults`);
			}

			const { containerEl } = this;
			containerEl.empty();

			new Setting(containerEl)
				.setName('Show ribbon icon')
				.setDesc('Show the Agentonomous icon in the left ribbon.')
				.addToggle((toggle) => {
					toggle
						.setValue(this.current.showRibbonIcon)
						.onChange(async (value) => {
							await this.persist({ ...this.current, showRibbonIcon: value });
						});
				});

			new Setting(containerEl)
				.setName('Default view')
				.setDesc('Which view opens when the plugin launches.')
				.addDropdown((dropdown) => {
					for (const view of KNOWN_DEFAULT_VIEWS) {
						dropdown.addOption(view, view.charAt(0).toUpperCase() + view.slice(1));
					}
					dropdown
						.setValue(this.current.defaultView)
						.onChange(async (value) => {
							if (isDefaultViewName(value)) {
								await this.persist({ ...this.current, defaultView: value });
							} else {
								new Notice(`Agentonomous: unknown view "${value}"`);
							}
						});
				});
		})();
	}
}
