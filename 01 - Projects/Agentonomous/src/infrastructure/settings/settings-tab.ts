import { type App, Notice, type Plugin, PluginSettingTab, Setting } from 'obsidian';
import type { SettingsPort } from '../../domain/settings/settings-port.js';
import type { TranslationPort } from '../../domain/shared/translation-port.js';
import type { Module } from '../../domain/shared/module.js';
import { CORE_SETTINGS_DEFAULTS, isDefaultViewName, KNOWN_DEFAULT_VIEWS, KNOWN_LOG_LEVELS, type CoreSettings, validateCoreSettings } from '../../domain/settings/plugin-settings.js';
import type { LogLevel } from '../../domain/shared/logger-port.js';
import { isErr, isOk } from '../../domain/shared/result.js';
import { isOneOf } from '../../domain/shared/utils/is-one-of.js';
import { renderSettingsSchema } from './render-settings-schema.js';

export class AgentonomousSettingsTab extends PluginSettingTab {
	private readonly port: SettingsPort;
	private readonly t: TranslationPort;
	private readonly modules: readonly Module[];
	private current: CoreSettings = CORE_SETTINGS_DEFAULTS;

	constructor(
		app: App,
		plugin: Plugin,
		port: SettingsPort,
		t: TranslationPort,
		modules: readonly Module[] = [],
	) {
		super(app, plugin);
		this.port = port;
		this.t = t;
		this.modules = modules;
	}

	private async persistCore(next: CoreSettings): Promise<void> {
		const result = await this.port.saveSection('core', next);
		if (isErr(result)) {
			new Notice(this.t.t('core.errors.saveFailed'));
			return;
		}
		this.current = next;
	}

	display(): void {
		void (async () => {
			const loadResult = await this.port.loadSection('core');
			if (!isOk(loadResult)) {
				new Notice(`Agentonomous: failed to load settings — using defaults`);
			}
			const coreSection = isOk(loadResult) ? loadResult.value : null;
			const validated = validateCoreSettings(coreSection);
			if (isOk(validated)) this.current = validated.value;

			const { containerEl } = this;
			containerEl.empty();

			this.renderCoreSection(containerEl);
			await this.renderModuleSections(containerEl);
		})();
	}

	private renderCoreSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(this.t.t('core.settings.showRibbonIcon'))
			.setDesc(this.t.t('core.settings.showRibbonIcon.desc'))
			.addToggle((toggle) => {
				toggle
					.setValue(this.current.showRibbonIcon)
					.onChange(async (value) => {
						await this.persistCore({ ...this.current, showRibbonIcon: value });
					});
			});

		new Setting(containerEl)
			.setName(this.t.t('core.settings.defaultView'))
			.setDesc(this.t.t('core.settings.defaultView.desc'))
			.addDropdown((dropdown) => {
				for (const view of KNOWN_DEFAULT_VIEWS) {
					dropdown.addOption(view, view.charAt(0).toUpperCase() + view.slice(1));
				}
				dropdown
					.setValue(this.current.defaultView)
					.onChange(async (value) => {
						if (isDefaultViewName(value)) {
							await this.persistCore({ ...this.current, defaultView: value });
						} else {
							new Notice(`Agentonomous: unknown view "${value}"`);
						}
					});
			});

		new Setting(containerEl)
			.setName(this.t.t('core.settings.logLevel'))
			.setDesc(this.t.t('core.settings.logLevel.desc'))
			.addDropdown((dropdown) => {
				for (const level of KNOWN_LOG_LEVELS) {
					dropdown.addOption(level, level.charAt(0).toUpperCase() + level.slice(1));
				}
				dropdown
					.setValue(this.current.logLevel)
					.onChange(async (value) => {
						if (isOneOf(value, KNOWN_LOG_LEVELS)) {
							await this.persistCore({ ...this.current, logLevel: value as LogLevel });
						}
					});
			});

		new Setting(containerEl)
			.setName(this.t.t('core.settings.locale'))
			.setDesc(this.t.t('core.settings.locale.desc'))
			.addDropdown((dropdown) => {
				dropdown.addOption('', this.t.t('core.settings.locale.auto'));
				dropdown.addOption('en', 'English');
				const currentLocale = this.current.locale ?? '';
				dropdown
					.setValue(currentLocale)
					.onChange(async (value) => {
						if (value === '') {
							const { locale: _locale, ...rest } = this.current;
							await this.persistCore(rest as CoreSettings);
						} else {
							await this.persistCore({ ...this.current, locale: value });
						}
					});
			});
	}

	/**
	 * Render one section per module with a settingsSchema.  Each module owns
	 * its field shapes; the tab just wires reads/writes to SettingsPort.
	 */
	private async renderModuleSections(containerEl: HTMLElement): Promise<void> {
		for (const m of this.modules) {
			if (m.settingsSchema === undefined || m.settingsKey === undefined) continue;

			const loaded = await this.port.loadSection(m.settingsKey);
			const section = isOk(loaded) && typeof loaded.value === 'object' && loaded.value !== null
				? loaded.value as Record<string, unknown>
				: {};
			const defaults = (m.settingsDefaults ?? {}) as Record<string, unknown>;
			const initial: Record<string, unknown> = { ...defaults, ...section };

			const settingsKey = m.settingsKey;
			renderSettingsSchema(containerEl, m.settingsSchema, initial, (next) => {
				void this.persistModule(settingsKey, next);
			});
		}
	}

	private async persistModule(key: string, next: Record<string, unknown>): Promise<void> {
		const result = await this.port.saveSection(key, next);
		if (isErr(result)) {
			new Notice(this.t.t('core.errors.saveFailed'));
		}
	}
}
