import { Plugin } from 'obsidian';
import { ObsidianSettingsAdapter } from './infrastructure/obsidian/obsidian-settings-adapter.js';
import { ViewRegistry } from './infrastructure/obsidian/view-registry.js';
import { HomepageView, VIEW_TYPE_HOMEPAGE } from './infrastructure/views/homepage-view.js';
import { AgentonomousSettingsTab } from './infrastructure/settings/settings-tab.js';
import { registerRibbon, type RibbonHandle } from './infrastructure/ribbon/ribbon.js';
import { createPluginContext } from './plugin.js';
import { isOk } from './domain/shared/result.js';
import { DEFAULT_SETTINGS } from './domain/settings/plugin-settings.js';

export default class AgentonomousPlugin extends Plugin {
	private ribbon: RibbonHandle = null;

	async onload(): Promise<void> {
		const settings = new ObsidianSettingsAdapter(this);
		const initial = await settings.load();
		const current = isOk(initial) ? initial.value : DEFAULT_SETTINGS;

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

		this.ribbon = registerRibbon(this, {
			visible: current.showRibbonIcon,
			icon: 'bot',
			title: 'Open Agentonomous',
			onClick: () => { void registry.openView(this, VIEW_TYPE_HOMEPAGE); },
		});

		// Route the settings listener through Obsidian's register() so it is
		// torn down automatically on plugin unload (spec §3.2).
		this.register(settings.subscribe((s) => {
			this.ribbon?.remove();
			this.ribbon = registerRibbon(this, {
				visible: s.showRibbonIcon,
				icon: 'bot',
				title: 'Open Agentonomous',
				onClick: () => { void registry.openView(this, VIEW_TYPE_HOMEPAGE); },
			});
		}));

		this.addCommand({
			id: 'open-homepage',
			name: 'Open homepage',
			callback: () => { void registry.openView(this, VIEW_TYPE_HOMEPAGE); },
		});

		this.addSettingTab(new AgentonomousSettingsTab(this.app, this, settings));
	}

	onunload(): void {
		this.ribbon?.remove();
		this.ribbon = null;
	}
}
