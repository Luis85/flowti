import { Plugin } from 'obsidian';
import { createEventBus } from './domain/shared/event-bus.js';
import { CORE_COMMANDS } from './domain/commands/core-commands.js';
import { defineModule } from './domain/shared/module.js';
import { ObsidianSettingsAdapter } from './infrastructure/obsidian/obsidian-settings-adapter.js';
import { ObsidianCommandAdapter } from './infrastructure/obsidian/obsidian-command-adapter.js';
import { ObsidianNotificationAdapter } from './infrastructure/obsidian/obsidian-notification-adapter.js';
import { ViewRegistry } from './infrastructure/obsidian/view-registry.js';
import { HomepageView } from './infrastructure/views/homepage-view.js';
import { AgentonomousSettingsTab } from './infrastructure/settings/settings-tab.js';
import { VIEW_TYPE_HOMEPAGE } from './domain/views/view-types.js';
import { Logger } from './core/logger.js';
import { PluginCore } from './core/plugin-core.js';
import type { PluginContext } from './plugin.js';

const tempModule = defineModule({
	id: 'core-temp',
	name: 'Core (temporary)',
	commands: CORE_COMMANDS,
	async init() {},
	destroy() {},
});

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
		]);
		const logger = new Logger(bus, 'info');
		const notifications = new ObsidianNotificationAdapter();
		const commands = new ObsidianCommandAdapter(this, views);

		this.core = new PluginCore(
			{ settings, commands, views, logger, notifications, eventBus: bus },
			[tempModule],
		);
		await this.core.init();

		const ctx: PluginContext = {
			app: this.app,
			plugin: this,
			settings,
			viewRegistry: views,
			eventBus: bus,
			logger,
		};
		views.registerAll(this, ctx);
		this.addSettingTab(new AgentonomousSettingsTab(this.app, this, settings));
		this.register(() => { this.core?.destroy(); });
	}
}
