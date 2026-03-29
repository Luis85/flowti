import { Plugin } from 'obsidian';
import { MeridianGameView, MERIDIAN_VIEW_TYPE } from './infrastructure/engine/game-view.js';
import { MeridianSettingsTab } from './infrastructure/settings/settings-tab.js';
import { createConsoleLogger } from './infrastructure/logger/console-logger.js';
import { createPerformanceTracker } from './infrastructure/performance/performance-tracker.js';
import { createEventBus } from './infrastructure/event-bus.js';
import { GameConfigSchema } from './domain/schemas/game-config-schema.js';
import { DEFAULT_SETTINGS, type MeridianSettings } from './domain/core/settings.js';
import type { Logger } from './domain/core/logger.js';
import type { PerformanceTracker } from './domain/core/performance.js';
import type { GameCoreDeps } from './domain/core/game-deps.js';
import type { BatchableEventBus } from './infrastructure/engine/batchable-event-bus.js';
import type { LogLevel } from './domain/core/logger.js';

export class MeridianPlugin extends Plugin {
	private settings: MeridianSettings = { ...DEFAULT_SETTINGS };
	private logger: Logger | null = null;
	private performanceTracker: PerformanceTracker | null = null;
	private gameDeps: GameCoreDeps | null = null;
	private batchableEventBus: BatchableEventBus | null = null;
	private previousLogLevel: LogLevel = DEFAULT_SETTINGS.logLevel;

	async onload(): Promise<void> {
		// Lightweight registrations only — keep onload fast (Obsidian load-time guide)
		await this.loadSettings();

		this.logger = createConsoleLogger(this.settings.logLevel);
		this.performanceTracker = createPerformanceTracker(this.logger);
		this.performanceTracker.setEnabled(this.settings.performanceTracking);

		this.registerView(MERIDIAN_VIEW_TYPE, (leaf) => new MeridianGameView(leaf, this.gameDeps, this.batchableEventBus));

		this.addRibbonIcon('gamepad-2', 'Project Meridian', async () => {
			const existingLeaves = this.app.workspace.getLeavesOfType(MERIDIAN_VIEW_TYPE);
			const first = existingLeaves[0];
			if (first !== undefined) {
				await this.app.workspace.revealLeaf(first);
				return;
			}
			const leaf = this.app.workspace.getLeaf('tab');
			await leaf.setViewState({ type: MERIDIAN_VIEW_TYPE, active: true });
		});

		this.addSettingTab(new MeridianSettingsTab(this.app, this, {
			getSettings: () => this.settings,
			saveSettings: async (s) => {
				this.settings = s;
				await this.saveData(s);
				this.applySettings();
			},
		}));

		// Heavy initialization deferred until workspace is ready
		this.app.workspace.onLayoutReady(() => {
			this.initializeGame();
		});
	}

	onunload(): void {
		// Do NOT detach leaves — Obsidian reinitializes them at original positions during plugin updates
		// View-level cleanup (engine stop) happens in MeridianGameView.onClose()
	}

	private async loadSettings(): Promise<void> {
		const data: unknown = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data as Partial<MeridianSettings> | undefined);
	}

	/** Apply settings changes at runtime (called when user changes settings) */
	private applySettings(): void {
		// Only recreate logger if log level changed
		if (this.logger === null || this.previousLogLevel !== this.settings.logLevel) {
			this.logger = createConsoleLogger(this.settings.logLevel);
			this.previousLogLevel = this.settings.logLevel;
		}

		// Only recreate tracker if logger changed
		this.performanceTracker ??= createPerformanceTracker(this.logger);
		this.performanceTracker.setEnabled(this.settings.performanceTracking);

		if (this.gameDeps !== null) {
			this.gameDeps.logger = this.logger;
			this.gameDeps.performanceTracker = this.performanceTracker;

			// Hot-swap simulation settings
			const config = this.gameDeps.config;
			config.tick_interval_ms = Math.max(50, Math.round(1000 / this.settings.tickRate));
			config.ticks_per_day = Math.round(
				this.settings.dayCycleDuration * this.settings.tickRate,
			);
			config.perception.base_multiplier = this.settings.perceptionRadius;
		}

		// Toggle ExcaliburJS debug mode on active game views
		this.applyDebugMode();
	}

	private applyDebugMode(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(MERIDIAN_VIEW_TYPE)) {
			const view = leaf.view as MeridianGameView;
			view.setDebugMode(this.settings.debugMode);
		}
	}

	/** Deferred game initialization — called after Obsidian workspace is fully loaded */
	private initializeGame(): void {
		this.logger?.info('Meridian', 'Game initialization started');

		this.batchableEventBus = createEventBus();
		const config = GameConfigSchema.parse({});

		if (this.logger !== null && this.performanceTracker !== null) {
			this.gameDeps = {
				logger: this.logger,
				eventBus: this.batchableEventBus,
				config,
				performanceTracker: this.performanceTracker,
				tickCount: 0,
			};
		}

		// Sync config with saved settings (schema defaults differ from user settings)
		this.applySettings();

		// Vault event listeners MUST be registered here, not in onload() (Obsidian guideline)
	}
}
