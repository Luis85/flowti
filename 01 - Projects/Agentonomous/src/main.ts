import { Plugin } from 'obsidian';
import { ObsidianSettingsAdapter } from './infrastructure/obsidian/obsidian-settings-adapter.js';
import { ViewRegistry } from './infrastructure/obsidian/view-registry.js';
import { HomepageView, VIEW_TYPE_HOMEPAGE } from './infrastructure/views/homepage-view.js';
import { AgentonomousSettingsTab } from './infrastructure/settings/settings-tab.js';
import { createPluginContext } from './plugin.js';

export default class AgentonomousPlugin extends Plugin {
	async onload(): Promise<void> {
		const settings = new ObsidianSettingsAdapter(this);
		await settings.load();

		const registry = new ViewRegistry([
			{
				type: VIEW_TYPE_HOMEPAGE,
				displayName: 'Agentonomous homepage',
				icon: 'bot',
				defaultLocation: 'main',
				viewFactory: (leaf, ctx) => new HomepageView(leaf, ctx),
			},
			// Example future sidebar panel:
			// { type: 'agentonomous-inspector', displayName: 'Agent inspector', icon: 'search', defaultLocation: 'right', viewFactory: (leaf, ctx) => new InspectorView(leaf, ctx) },
		]);

		const ctx = createPluginContext(this, settings, registry);
		registry.registerAll(this, ctx);

		this.addCommand({
			id: 'open-homepage',
			name: 'Open homepage',
			callback: () => { void registry.openView(this, VIEW_TYPE_HOMEPAGE); },
		});

		this.addSettingTab(new AgentonomousSettingsTab(this.app, this, settings));
	}

	onunload(): void {
		// Chunk 5 will wire CommandAdapter + cleanup here.
	}
}
