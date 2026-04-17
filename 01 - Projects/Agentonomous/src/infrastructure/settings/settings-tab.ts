import { type App, Notice, type Plugin, PluginSettingTab, Setting } from 'obsidian';
import type { SettingsPort } from '../../domain/settings/settings-port.js';
import type { TranslationPort } from '../../domain/shared/translation-port.js';
import { CORE_SETTINGS_DEFAULTS, isDefaultViewName, KNOWN_DEFAULT_VIEWS, KNOWN_LOG_LEVELS, type CoreSettings, validateCoreSettings } from '../../domain/settings/plugin-settings.js';
import type { LogLevel } from '../../domain/shared/logger-port.js';
import { isErr, isOk } from '../../domain/shared/result.js';
import { isOneOf } from '../../domain/shared/utils/is-one-of.js';

export class AgentonomousSettingsTab extends PluginSettingTab {
	private readonly port: SettingsPort;
	private readonly t: TranslationPort;
	private current: CoreSettings = CORE_SETTINGS_DEFAULTS;

	constructor(app: App, plugin: Plugin, port: SettingsPort, t: TranslationPort) {
		super(app, plugin);
		this.port = port;
		this.t = t;
	}

	private async persist(next: CoreSettings): Promise<void> {
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
			if (isOk(validated)) {
				this.current = validated.value;
			}

			const { containerEl } = this;
			containerEl.empty();

			new Setting(containerEl)
				.setName(this.t.t('core.settings.showRibbonIcon'))
				.setDesc(this.t.t('core.settings.showRibbonIcon.desc'))
				.addToggle((toggle) => {
					toggle
						.setValue(this.current.showRibbonIcon)
						.onChange(async (value) => {
							await this.persist({ ...this.current, showRibbonIcon: value });
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
								await this.persist({ ...this.current, defaultView: value });
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
								await this.persist({ ...this.current, logLevel: value as LogLevel });
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
								// Remove locale key entirely (absent = auto)
								const { locale: _locale, ...rest } = this.current;
								await this.persist(rest as CoreSettings);
							} else {
								await this.persist({ ...this.current, locale: value });
							}
						});
				});
		})();
	}
}
