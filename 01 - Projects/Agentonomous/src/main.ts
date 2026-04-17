import { Plugin } from 'obsidian';
import { createI18n } from 'vue-i18n';
import './styles.css';
import './all-events.js';
import { createEventBus } from './domain/shared/event-bus.js';
import { ObsidianSettingsAdapter } from './infrastructure/obsidian/obsidian-settings-adapter.js';
import { ObsidianCommandAdapter } from './infrastructure/obsidian/obsidian-command-adapter.js';
import { ObsidianNotificationAdapter } from './infrastructure/obsidian/obsidian-notification-adapter.js';
import { ObsidianPlatformAdapter } from './infrastructure/obsidian/obsidian-platform-adapter.js';
import { ObsidianVaultAdapter } from './infrastructure/obsidian/obsidian-vault-adapter.js';
import { ObsidianFileExtensionAdapter } from './infrastructure/obsidian/obsidian-file-extension-adapter.js';
import { ViewRegistry } from './infrastructure/obsidian/view-registry.js';
import { VIEW_REGISTRATIONS } from './infrastructure/obsidian/views/index.js';
import { AgentonomousSettingsTab } from './infrastructure/settings/settings-tab.js';
import { Logger } from './core/logger.js';
import { PluginCore } from './core/plugin-core.js';
import { CoreModule } from './modules/core/core-module.js';
import { EventInspectorModule } from './modules/event-inspector/event-inspector-module.js';
import { HealthMonitorModule } from './modules/health-monitor/health-monitor-module.js';
import { FileDetailModule } from './modules/file-detail/file-detail-module.js';
import type { TranslationPort } from './domain/shared/translation-port.js';
import type { PluginContext, ModuleStatus } from './plugin.js';

export default class AgentonomousPlugin extends Plugin {
	private core: PluginCore | null = null;

	async onload(): Promise<void> {
		const bus = createEventBus();
		const platform = new ObsidianPlatformAdapter();

		// i18n — messages are merged in via i18nMerge callback during PluginCore.init()
		// Suppress missing/fallback warnings: only `en` ships today; any other
		// locale legitimately falls back to `en`, and logging each miss floods
		// the console on every Settings tab render.
		const i18n = createI18n({
			locale: platform.locale,
			fallbackLocale: 'en',
			messages: {},
			legacy: false,
			missingWarn: false,
			fallbackWarn: false,
		});

		const translationPort: TranslationPort = {
			t: (key, params) => String(i18n.global.t(key, params ?? {})),
			get locale() { return i18n.global.locale.value; },
		};

		const settings = new ObsidianSettingsAdapter(this);
		const vault = new ObsidianVaultAdapter(this.app);
		const fileExtensions = new ObsidianFileExtensionAdapter(this);
		const views = new ViewRegistry();
		const logger = new Logger(bus, 'info');
		const notifications = new ObsidianNotificationAdapter();
		const commands = new ObsidianCommandAdapter(this, views);

		const modules = [CoreModule, EventInspectorModule, HealthMonitorModule, FileDetailModule];

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
			modules,
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

		// Collect view intents from successfully initialized modules, then
		// resolve each intent to its matching Obsidian ViewRegistration.
		// registerAll must come BEFORE registerExtensions — Obsidian requires
		// view types to be registered before extensions can reference them.
		const activeIntentTypes = new Set(
			this.core.registeredModules.flatMap((m) => (m.views ?? []).map((v) => v.type)),
		);
		const activeRegistrations = VIEW_REGISTRATIONS.filter((r) => activeIntentTypes.has(r.type));
		views.registerAll(this, ctx, activeRegistrations);
		this.core.registerExtensions(fileExtensions);
		this.addSettingTab(new AgentonomousSettingsTab(this.app, this, settings, translationPort));
		this.register(() => { this.core?.destroy(); });
	}
}
