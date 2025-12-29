import { App, Plugin, PluginSettingTab, Setting  } from 'obsidian';
import { WindTunnelBabylonView, WINDTUNNEL_VIEW_TYPE } from "./views/windtunnel-babylon-view";
import { WindTunnelView, VIEW_TYPE_WINDTUNNEL_OLD } from "./views/windtunnel-old-view";
// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();
		
		this.registerView(WINDTUNNEL_VIEW_TYPE,(leaf) => new WindTunnelBabylonView(leaf));
		this.registerView(VIEW_TYPE_WINDTUNNEL_OLD,(leaf) => new WindTunnelView(leaf));

		this.addRibbonIcon("box", "Wind Tunnel (Babylon.js)", () => {
			this.activateView(WINDTUNNEL_VIEW_TYPE);
		});
		this.addRibbonIcon("wind", "Wind Tunnel old", () => {
			this.activateView(VIEW_TYPE_WINDTUNNEL_OLD);
		});
		
		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

	}

	onunload() {
		this.app.workspace.detachLeavesOfType(WINDTUNNEL_VIEW_TYPE);
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_WINDTUNNEL_OLD);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
	
	async activateView(viewType: string) {
		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(viewType)[0];

		if (!leaf) {
		const newLeaf = workspace.getLeaf("tab");
		if (newLeaf) {
			await newLeaf.setViewState({ type: viewType, active: true });
			leaf = newLeaf;
		}
		}

		if (leaf) {
		workspace.revealLeaf(leaf);
		}
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
