import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type * as ex from 'excalibur';
import { createGameEngine } from './game-engine.js';
import { createGameLoader } from './game-loader.js';
import { createTickRunner } from './tick-runner.js';
import { MeridianTickSystem } from './tick-system.js';
import type { BatchableEventBus } from './batchable-event-bus.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import { createTraitResolverSystem } from '../systems/trait-resolver-system.js';
import { createNeedsDecaySystem } from '../systems/needs-decay-system.js';
import { createMoodSystem } from '../systems/mood-system.js';
import { createMemoryDecaySystem } from '../systems/memory-decay-system.js';
import { createAgentSpawner, type VaultReader } from '../entity/agent-spawner.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { TraitDefinition } from '../../domain/systems/trait-resolver.js';

export const MERIDIAN_VIEW_TYPE = 'meridian-game-view';

export class MeridianGameView extends ItemView {
	private engine: ex.Engine | null = null;
	private disposeEngine: (() => void) | null = null;
	private deps: GameCoreDeps | null;
	private batchableEventBus: BatchableEventBus | null;
	private traitDefinitions: Record<string, TraitDefinition>;

	constructor(leaf: WorkspaceLeaf, deps: GameCoreDeps | null, batchableEventBus: BatchableEventBus | null = null, traitDefinitions: Record<string, TraitDefinition> = {}) {
		super(leaf);
		this.deps = deps;
		this.batchableEventBus = batchableEventBus;
		this.traitDefinitions = traitDefinitions;
	}

	getViewType(): string {
		return MERIDIAN_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Project Meridian';
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.classList.add('meridian-game-container');

		try {
			const style = getComputedStyle(container);
			const bgColor = style.getPropertyValue('--background-primary').trim() || '#1a1a2e';

			const { engine, dispose } = createGameEngine(container, {
				backgroundColor: bgColor,
			});
			this.engine = engine;
			this.disposeEngine = dispose;

			// Wire tick infrastructure if deps and event bus are available
			if (this.deps !== null && this.batchableEventBus !== null) {
				const tickRunner = createTickRunner(this.batchableEventBus);
				const tickSystem = new MeridianTickSystem(tickRunner, this.deps);
				this.engine.currentScene.world.add(tickSystem);
				this.deps.logger.info('Meridian', 'Tick system registered');

				// Spawn agents from vault
				const vault = this.app.vault;
				const vaultAdapter: VaultReader = {
					list: (path: string): Promise<string[]> => {
						return Promise.resolve(
							vault.getFiles()
								.filter(f => f.path.startsWith(path) && f.path.endsWith('.json'))
								.map(f => f.path),
						);
					},
					read: async (path: string): Promise<string> => {
						const file = vault.getFileByPath(path);
						if (file === null) throw new Error(`File not found: ${path}`);
						return vault.read(file);
					},
				};

				const spawner = createAgentSpawner(this.deps.logger, this.deps.config.mood, this.deps.config.memory.max_entries);
				const spawnResult = await spawner.spawnFromVault(vaultAdapter, '03 - Resources/Agents');

				const spawnedAgents: AgentActor[] = spawnResult.agents;
				for (const agent of spawnedAgents) {
					this.engine.currentScene.add(agent);
				}

				const getAgents = (): AgentActor[] => spawnedAgents;

				// Register the 4 game systems with the tick runner
				tickRunner.register(createTraitResolverSystem(getAgents, this.traitDefinitions));
				tickRunner.register(createNeedsDecaySystem(getAgents));
				tickRunner.register(createMoodSystem(getAgents));
				tickRunner.register(createMemoryDecaySystem(getAgents));

				this.deps.logger.info('Meridian', `Game systems registered, ${String(spawnedAgents.length)} agents spawned`);
			} else {
				console.warn('[Meridian] Game deps not ready — tick system not registered. View opened before initializeGame() completed.');
			}

			const loader = createGameLoader();
			void this.engine.start(loader).catch((err: unknown) => {
				this.showError(container, err);
			});
		} catch (err: unknown) {
			this.showError(container, err);
		}
	}

	// eslint-disable-next-line @typescript-eslint/require-await -- Obsidian ItemView interface requires async
	async onClose(): Promise<void> {
		this.disposeEngine?.();
		this.disposeEngine = null;
		if (this.engine !== null) {
			this.engine.stop();
			this.engine = null;
		}
	}

	private showError(container: HTMLElement, err: unknown): void {
		const message = err instanceof Error ? err.message : String(err);
		console.error('[Meridian] Engine failed to initialize:', message);

		// Clear any partial canvas state
		container.empty();

		const errorEl = container.createDiv({ cls: 'meridian-error' });
		errorEl.createEl('h3', { text: 'Project Meridian' });
		errorEl.createEl('p', { text: 'The game engine failed to start.' });
		errorEl.createEl('code', { text: message });
		errorEl.createEl('p', { text: 'Check the developer console for details.' });
	}
}
