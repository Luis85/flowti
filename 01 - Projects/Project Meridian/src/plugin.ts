import { Plugin } from 'obsidian';
import { MeridianGameView, MERIDIAN_VIEW_TYPE } from './infrastructure/engine/game-view.js';
import { MeridianSettingsTab } from './infrastructure/settings/settings-tab.js';
import { createConsoleLogger } from './infrastructure/logger/console-logger.js';
import { createPerformanceTracker } from './infrastructure/performance/performance-tracker.js';
import { DEFAULT_SETTINGS, type MeridianSettings } from './domain/core/settings.js';
import type { Logger } from './domain/core/logger.js';
import type { PerformanceTracker } from './domain/core/performance.js';

export class MeridianPlugin extends Plugin {
	private settings: MeridianSettings = { ...DEFAULT_SETTINGS };
	private logger: Logger | null = null;
	private performanceTracker: PerformanceTracker | null = null;

	async onload(): Promise<void> {
		// Lightweight registrations only — keep onload fast (Obsidian load-time guide)
		await this.loadSettings();

		this.logger = createConsoleLogger(this.settings.logLevel);
		this.performanceTracker = createPerformanceTracker(this.logger);
		this.performanceTracker.setEnabled(this.settings.performanceTracking);

		this.registerView(MERIDIAN_VIEW_TYPE, (leaf) => new MeridianGameView(leaf));

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
	}

	/** Deferred game initialization — called after Obsidian workspace is fully loaded */
	private initializeGame(): void {
		this.logger?.info('Meridian', 'Game initialization started');
		// Phase 1+: GameDeps composition root, VaultSync startup, system registration
		// Vault event listeners MUST be registered here, not in onload() (Obsidian guideline)
	}
}
