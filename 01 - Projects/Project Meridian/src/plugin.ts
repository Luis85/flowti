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
import type { TraitDefinition } from './domain/systems/trait-resolver.js';

export class MeridianPlugin extends Plugin {
	private settings: MeridianSettings = { ...DEFAULT_SETTINGS };
	private logger: Logger | null = null;
	private performanceTracker: PerformanceTracker | null = null;
	private gameDeps: GameCoreDeps | null = null;
	private batchableEventBus: BatchableEventBus | null = null;
	private traitDefinitions: Record<string, TraitDefinition> = {};

	async onload(): Promise<void> {
		// Lightweight registrations only — keep onload fast (Obsidian load-time guide)
		await this.loadSettings();

		this.logger = createConsoleLogger(this.settings.logLevel);
		this.performanceTracker = createPerformanceTracker(this.logger);
		this.performanceTracker.setEnabled(this.settings.performanceTracking);

		this.registerView(MERIDIAN_VIEW_TYPE, (leaf) => new MeridianGameView(leaf, this.gameDeps, this.batchableEventBus, this.traitDefinitions));

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
		this.logger = createConsoleLogger(this.settings.logLevel);
		// Recreate tracker so its closure captures the fresh logger reference
		this.performanceTracker = createPerformanceTracker(this.logger);
		this.performanceTracker.setEnabled(this.settings.performanceTracking);
		// Propagate to live deps so the running tick system sees new references
		if (this.gameDeps !== null) {
			Object.assign(this.gameDeps, {
				logger: this.logger,
				performanceTracker: this.performanceTracker,
			});
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

		// Vault event listeners MUST be registered here, not in onload() (Obsidian guideline)
	}
}
