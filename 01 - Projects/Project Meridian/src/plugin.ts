import { Plugin } from 'obsidian';
import { MeridianGameView, MERIDIAN_VIEW_TYPE } from './infrastructure/engine/game-view.js';
import { MeridianBTInspectorView, MERIDIAN_BT_INSPECTOR_VIEW_TYPE, type BTInspectorDeps } from './infrastructure/ui/bt-inspector-view.js';
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
import type { GameConfig } from './domain/schemas/game-config-schema.js';

export class MeridianPlugin extends Plugin {
	private settings: MeridianSettings = { ...DEFAULT_SETTINGS };
	private logger: Logger | null = null;
	private performanceTracker: PerformanceTracker | null = null;
	private gameDeps: GameCoreDeps | null = null;
	private batchableEventBus: BatchableEventBus | null = null;
	private previousLogLevel: LogLevel = DEFAULT_SETTINGS.logLevel;
	/** Immutable baseline config from game-config.json — never mutated by settings */
	private baseConfig: GameConfig | null = null;
	private inspectorDeps: BTInspectorDeps | null = null;

	async onload(): Promise<void> {
		// Lightweight registrations only — keep onload fast (Obsidian load-time guide)
		await this.loadSettings();

		this.logger = createConsoleLogger(this.settings.logLevel);
		this.performanceTracker = createPerformanceTracker(this.logger);
		this.performanceTracker.setEnabled(this.settings.performanceTracking);

		this.registerView(MERIDIAN_VIEW_TYPE, (leaf) => {
			const view = new MeridianGameView(leaf, this.gameDeps, this.batchableEventBus);
			// Wire agent-click → BT inspector. Factory runs on every view construction,
			// so this survives tab close/reopen and works regardless of init timing.
			view.setOnAgentSelected((agentId) => { void this.openBTInspectorForAgent(agentId); });
			return view;
		});

		this.registerView(
			MERIDIAN_BT_INSPECTOR_VIEW_TYPE,
			(leaf) => new MeridianBTInspectorView(leaf, this.inspectorDeps),
		);

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

		this.addRibbonIcon('git-branch', 'BT Inspector', async () => {
			await this.openBTInspector();
		});

		this.addCommand({
			id: 'open-bt-inspector',
			name: 'Open BT Inspector',
			callback: () => { void this.openBTInspector(); },
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
			void this.initializeGame();
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

		if (this.gameDeps !== null && this.baseConfig !== null) {
			this.gameDeps.logger = this.logger;
			this.gameDeps.performanceTracker = this.performanceTracker;

			const config = this.gameDeps.config;
			const base = this.baseConfig;
			const speed = this.settings.gameSpeed;

			// Game speed: faster tick interval = more ticks per second
			config.tick_interval_ms = Math.max(50, Math.round(base.tick_interval_ms / speed));

			// Needs rates: always computed from base * settings multiplier (never cumulative)
			config.needs.hunger_decay = base.needs.hunger_decay * this.settings.hungerRate;
			config.needs.thirst_decay = base.needs.thirst_decay * this.settings.thirstRate;
			config.needs.energy_decay = base.needs.energy_decay * this.settings.energyRate;

			// Economy overrides (0 = use base config)
			config.economy.food_price = this.settings.foodPrice > 0
				? this.settings.foodPrice
				: base.economy.food_price;
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

	/** Read game-config.json from the plugin folder or dev vault path */
	private async loadGameConfig(): Promise<Record<string, unknown>> {
		const candidates = [
			`${this.manifest.dir}/game-config.json`,
			'01 - Projects/Project Meridian/configs/game-config.json',
		];
		for (const configPath of candidates) {
			const exists = await this.app.vault.adapter.exists(configPath);
			if (exists) {
				const content = await this.app.vault.adapter.read(configPath);
				return JSON.parse(content) as Record<string, unknown>;
			}
		}
		this.logger?.warn('Meridian', 'No game-config.json found, using schema defaults');
		return {};
	}

	/** Deferred game initialization — called after Obsidian workspace is fully loaded */
	private async initializeGame(): Promise<void> {
		this.logger?.info('Meridian', 'Game initialization started');

		this.batchableEventBus = createEventBus();
		const configOverrides = await this.loadGameConfig();
		this.baseConfig = GameConfigSchema.parse(configOverrides);
		// Deep clone — live config is mutated by applySettings, base stays immutable
		const config = GameConfigSchema.parse(configOverrides);

		if (this.logger !== null && this.performanceTracker !== null) {
			this.gameDeps = {
				logger: this.logger,
				eventBus: this.batchableEventBus,
				config,
				performanceTracker: this.performanceTracker,
				tickCount: 0,
				writeFile: null,
				dataRoot: '',
			};
		}

		// Vault file writer for daily economy reports
		const vault = this.app.vault;
		const writeFile = async (path: string, content: string): Promise<void> => {
			const existing = vault.getFileByPath(path);
			if (existing !== null) {
				await vault.modify(existing, content);
			} else {
				const folderPath = path.substring(0, path.lastIndexOf('/'));
				const folder = vault.getFolderByPath(folderPath);
				if (folder === null) {
					await vault.createFolder(folderPath);
				}
				await vault.create(path, content);
			}
		};

		if (this.gameDeps !== null) {
			this.gameDeps.writeFile = writeFile;
		}

		// Create inspector deps — used by MeridianBTInspectorView to access agents and vault
		if (this.gameDeps !== null) {
			const vaultAdapter = {
				list: async (path: string): Promise<string[]> => {
					const exists = await this.app.vault.adapter.exists(path);
					if (!exists) return [];
					const listing = await this.app.vault.adapter.list(path);
					return listing.files;
				},
				read: async (path: string): Promise<string> => {
					return this.app.vault.adapter.read(path);
				},
			};
			this.inspectorDeps = {
				getAgents: () => {
					const gameLeaves = this.app.workspace.getLeavesOfType(MERIDIAN_VIEW_TYPE);
					const first = gameLeaves[0];
					if (first === undefined) return [];
					const view = first.view as MeridianGameView;
					return view.getAgents();
				},
				getAgentById: (id: string) => {
					return this.inspectorDeps?.getAgents().find(a => a.agentId === id);
				},
				vault: vaultAdapter,
				logger: this.logger!,
				dataRoot: () => this.gameDeps?.dataRoot ?? '',
			};
			// Refresh any already-open inspector views with the new deps
			for (const leaf of this.app.workspace.getLeavesOfType(MERIDIAN_BT_INSPECTOR_VIEW_TYPE)) {
				const view = leaf.view as MeridianBTInspectorView;
				view.setDeps(this.inspectorDeps);
			}
		}

		// Sync config with saved settings (schema defaults differ from user settings)
		this.applySettings();

		// Vault event listeners MUST be registered here, not in onload() (Obsidian guideline)
	}

	private async openBTInspector(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(MERIDIAN_BT_INSPECTOR_VIEW_TYPE);
		const first = existing[0];
		if (first !== undefined) {
			await this.app.workspace.revealLeaf(first);
			return;
		}
		const leaf = this.app.workspace.getLeaf('tab');
		await leaf.setViewState({ type: MERIDIAN_BT_INSPECTOR_VIEW_TYPE, active: true });
	}

	private async openBTInspectorForAgent(agentId: string): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(MERIDIAN_BT_INSPECTOR_VIEW_TYPE);
		const first = existing[0];
		if (first !== undefined) {
			await this.app.workspace.revealLeaf(first);
			const view = first.view as MeridianBTInspectorView;
			await view.showAgent(agentId);
			return;
		}
		const leaf = this.app.workspace.getLeaf('tab');
		await leaf.setViewState({
			type: MERIDIAN_BT_INSPECTOR_VIEW_TYPE,
			active: true,
			state: { agentId },
		});
	}
}
