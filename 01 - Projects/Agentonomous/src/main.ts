import { Plugin } from 'obsidian';
import { createI18n } from 'vue-i18n';
import { createEventBus } from './domain/shared/event-bus.js';
import { ObsidianSettingsAdapter } from './infrastructure/obsidian/obsidian-settings-adapter.js';
import { ObsidianCommandAdapter } from './infrastructure/obsidian/obsidian-command-adapter.js';
import { ObsidianNotificationAdapter } from './infrastructure/obsidian/obsidian-notification-adapter.js';
import { ObsidianPlatformAdapter } from './infrastructure/obsidian/obsidian-platform-adapter.js';
import { ObsidianVaultAdapter } from './infrastructure/obsidian/obsidian-vault-adapter.js';
import { ObsidianFileExtensionAdapter } from './infrastructure/obsidian/obsidian-file-extension-adapter.js';
import { ViewRegistry } from './infrastructure/obsidian/view-registry.js';
import { HomepageView, VIEW_TYPE_HOMEPAGE } from './infrastructure/views/homepage-view.js';
import { AgentonomousSettingsTab } from './infrastructure/settings/settings-tab.js';
import { Logger } from './core/logger.js';
import { PluginCore } from './core/plugin-core.js';
import { CoreModule } from './modules/core/core-module.js';
import { EventInspectorModule } from './modules/event-inspector/event-inspector-module.js';
import { EventInspectorView, VIEW_TYPE_EVENT_INSPECTOR } from './modules/event-inspector/views/event-inspector-view.js';
import { HealthMonitorModule } from './modules/health-monitor/health-monitor-module.js';
import { FileDetailModule, VIEW_TYPE_FILE_DETAIL } from './modules/file-detail/file-detail-module.js';
import { FileDetailView } from './modules/file-detail/views/file-detail-view.js';
import type { TranslationPort } from './domain/shared/translation-port.js';
import type { PluginContext, ModuleStatus } from './plugin.js';

export default class AgentonomousPlugin extends Plugin {
	private core: PluginCore | null = null;

	async onload(): Promise<void> {
		const bus = createEventBus();
		const platform = new ObsidianPlatformAdapter();

		// i18n — messages are merged in via i18nMerge callback during PluginCore.init()
		const i18n = createI18n({
			locale: platform.locale,
			fallbackLocale: 'en',
			messages: {},
			legacy: false,
		});

		const translationPort: TranslationPort = {
			t: (key, params) => String(i18n.global.t(key, params ?? {})),
			get locale() { return i18n.global.locale.value; },
		};

		const settings = new ObsidianSettingsAdapter(this);
		const vault = new ObsidianVaultAdapter(this.app);
		const fileExtensions = new ObsidianFileExtensionAdapter(this);
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
			{
				type: VIEW_TYPE_FILE_DETAIL,
				displayName: 'File detail',
				icon: 'file-search',
				defaultLocation: 'right',
				viewFactory: (leaf, _ctx) => new FileDetailView(leaf),
			},
		]);
		const logger = new Logger(bus, 'info');
		const notifications = new ObsidianNotificationAdapter();
		const commands = new ObsidianCommandAdapter(this, views);

		this.core = new PluginCore(
			{
				settings,
				commands,
				views,
				logger,
				notifications,
				eventBus: bus,
				t: translationPort,
				platform,
				vault,
				i18nMerge: (locale, messages) => { i18n.global.mergeLocaleMessage(locale, messages); },
			},
			[CoreModule, EventInspectorModule, HealthMonitorModule, FileDetailModule],
		);
		await this.core.init();

		const moduleStatus: readonly ModuleStatus[] = this.core.registeredModules.map((m) => ({
			id: m.id,
			name: m.name,
			status: this.core!.degradedModules.includes(m.id) ? 'degraded' as const : 'ready' as const,
		}));

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
			t: translationPort,
			platform,
			vault,
			i18n,
			moduleStatus,
		};
		views.registerAll(this, ctx);
		// registerExtensions must come AFTER registerAll — Obsidian requires
		// view types to be registered before extensions can reference them.
		this.core.registerExtensions(fileExtensions);
		this.addSettingTab(new AgentonomousSettingsTab(this.app, this, settings, translationPort));
		this.register(() => { this.core?.destroy(); });
	}
}
