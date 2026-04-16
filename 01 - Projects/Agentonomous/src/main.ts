import { Plugin } from 'obsidian';
import { createEventBus } from './domain/shared/event-bus.js';
import { ObsidianSettingsAdapter } from './infrastructure/obsidian/obsidian-settings-adapter.js';
import { ObsidianCommandAdapter } from './infrastructure/obsidian/obsidian-command-adapter.js';
import { ObsidianNotificationAdapter } from './infrastructure/obsidian/obsidian-notification-adapter.js';
import { ViewRegistry } from './infrastructure/obsidian/view-registry.js';
import { HomepageView, VIEW_TYPE_HOMEPAGE } from './infrastructure/views/homepage-view.js';
import { AgentonomousSettingsTab } from './infrastructure/settings/settings-tab.js';
import { Logger } from './core/logger.js';
import { PluginCore } from './core/plugin-core.js';
import { CoreModule } from './modules/core/core-module.js';
import { EventInspectorModule } from './modules/event-inspector/event-inspector-module.js';
import { EventInspectorView, VIEW_TYPE_EVENT_INSPECTOR } from './modules/event-inspector/views/event-inspector-view.js';
import { HealthMonitorModule } from './modules/health-monitor/health-monitor-module.js';
import type { PluginContext } from './plugin.js';

export default class AgentonomousPlugin extends Plugin {
	private core: PluginCore | null = null;

	async onload(): Promise<void> {
		const bus = createEventBus();
		const settings = new ObsidianSettingsAdapter(this);
		const views = new ViewRegistry([
			{
				type: VIEW_TYPE_HOMEPAGE,
				displayName: 'Agentonomous homepage',
				icon: 'bot',
				defaultLocation: 'main',
				viewFactory: (leaf, ctx) => new HomepageView(leaf, ctx),
			},
			{
				type: VIEW_TYPE_EVENT_INSPECTOR,
				displayName: 'Event inspector',
				icon: 'activity',
				defaultLocation: 'right',
				viewFactory: (leaf, _ctx) => new EventInspectorView(leaf),
			},
		]);
		const logger = new Logger(bus, 'info');
		const notifications = new ObsidianNotificationAdapter();
		const commands = new ObsidianCommandAdapter(this, views);

		this.core = new PluginCore(
			{ settings, commands, views, logger, notifications, eventBus: bus },
			[CoreModule, EventInspectorModule, HealthMonitorModule],
		);
		await this.core.init();

		// Ribbon visibility: adapter-level concern, driven by CoreSettings
		commands.setRibbonVisibility(this.core.coreSettings.showRibbonIcon);
		settings.subscribe(() => {
			if (this.core !== null) {
				commands.setRibbonVisibility(this.core.coreSettings.showRibbonIcon);
			}
		});

		const ctx: PluginContext = {
			app: this.app,
			plugin: this,
			settings,
			commands,
			views,
			logger,
			notifications,
			eventBus: bus,
		};
		views.registerAll(this, ctx);
		this.addSettingTab(new AgentonomousSettingsTab(this.app, this, settings));
		this.register(() => { this.core?.destroy(); });
	}
}
