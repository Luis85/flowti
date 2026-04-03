import { PluginSettingTab, Setting } from 'obsidian';
import type { App, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, type MeridianSettings } from '../../domain/core/settings.js';
import type { LogLevel } from '../../domain/core/logger.js';

interface SettingsTabDeps {
	getSettings(): MeridianSettings;
	saveSettings(settings: MeridianSettings): Promise<void>;
}

const SPEED_LABELS: Record<number, string> = {
	0.25: '0.25x (quarter)',
	0.5: '0.5x (half)',
	1: '1x (normal)',
	2: '2x (fast)',
	3: '3x (faster)',
	5: '5x (fastest)',
};

export class MeridianSettingsTab extends PluginSettingTab {
	private deps: SettingsTabDeps;

	constructor(app: App, plugin: Plugin, deps: SettingsTabDeps) {
		super(app, plugin);
		this.deps = deps;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const settings = this.deps.getSettings();

		// ── Game Speed ───────────────────────────────────────────────
		new Setting(containerEl)
			.setHeading()
			.setName('Game Speed');

		new Setting(containerEl)
			.setName('Simulation speed')
			.setDesc('How fast the world runs. Higher = faster days, faster needs decay.')
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(SPEED_LABELS)
					.setValue(String(settings.gameSpeed))
					.onChange(async (value) => {
						settings.gameSpeed = Number(value);
						await this.deps.saveSettings(settings);
					}),
			);

		// ── Needs Tuning ─────────────────────────────────────────────
		new Setting(containerEl)
			.setHeading()
			.setName('Needs Balance');

		this.addRateSlider(containerEl, settings, 'hungerRate', 'Hunger rate',
			'How fast agents get hungry. 0.5 = half speed, 2 = double speed.');

		this.addRateSlider(containerEl, settings, 'thirstRate', 'Thirst rate',
			'How fast agents get thirsty.');

		this.addRateSlider(containerEl, settings, 'energyRate', 'Energy rate',
			'How fast agents lose energy.');

		// ── Economy Tuning ───────────────────────────────────────────
		new Setting(containerEl)
			.setHeading()
			.setName('Economy Balance');

		new Setting(containerEl)
			.setName('Food price')
			.setDesc('Base price of food at the market. 0 = use config default.')
			.addSlider((slider) =>
				slider
					.setLimits(0, 20, 1)
					.setValue(settings.foodPrice)
					.setDynamicTooltip()
					.onChange(async (value) => {
						settings.foodPrice = value;
						await this.deps.saveSettings(settings);
					}),
			);

		// ── Reset ────────────────────────────────────────────────────
		new Setting(containerEl)
			.setName('Reset to defaults')
			.setDesc('Restore all settings to their default values.')
			.addButton((button) =>
				button
					.setButtonText('Reset')
					.setWarning()
					.onClick(async () => {
						await this.deps.saveSettings({ ...DEFAULT_SETTINGS });
						this.display();
					}),
			);

		// ── Developer ────────────────────────────────────────────────
		new Setting(containerEl)
			.setHeading()
			.setName('Developer');

		new Setting(containerEl)
			.setName('Log level')
			.setDesc('Minimum log level displayed in the developer console.')
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						debug: 'Debug',
						info: 'Info',
						warn: 'Warning',
						error: 'Error',
					})
					.setValue(settings.logLevel)
					.onChange(async (value) => {
						settings.logLevel = value as LogLevel;
						await this.deps.saveSettings(settings);
					}),
			);

		new Setting(containerEl)
			.setName('Debug mode')
			.setDesc('Enable debug overlays and verbose logging.')
			.addToggle((toggle) =>
				toggle
					.setValue(settings.debugMode)
					.onChange(async (value) => {
						settings.debugMode = value;
						await this.deps.saveSettings(settings);
					}),
			);

		new Setting(containerEl)
			.setName('Performance tracking')
			.setDesc('Track system execution times per tick.')
			.addToggle((toggle) =>
				toggle
					.setValue(settings.performanceTracking)
					.onChange(async (value) => {
						settings.performanceTracking = value;
						await this.deps.saveSettings(settings);
					}),
			);
	}

	private addRateSlider(
		containerEl: HTMLElement,
		settings: MeridianSettings,
		key: 'hungerRate' | 'thirstRate' | 'energyRate',
		name: string,
		desc: string,
	): void {
		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addSlider((slider) =>
				slider
					.setLimits(0.1, 5, 0.1)
					.setValue(settings[key])
					.setDynamicTooltip()
					.onChange(async (value) => {
						settings[key] = value;
						await this.deps.saveSettings(settings);
					}),
			);
	}
}
