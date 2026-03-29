import { ItemView, type WorkspaceLeaf } from 'obsidian';
import * as ex from 'excalibur';
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
import { TimeComponent } from '../components/time-component.js';
import { PerceptionComponent } from '../components/perception-component.js';
import { createLocationLoader } from '../entity/location-loader.js';
import { createBTLoader } from '../entity/bt-loader.js';
import { createDayNightSystem } from '../systems/day-night-system.js';
import { createPerceptionSystem } from '../systems/perception-system.js';
import { createBehaviorTreeSystem } from '../systems/behavior-tree-system.js';
import { createMovementSystem } from '../systems/movement-system.js';
import type { BTNode } from '../../domain/systems/behavior-tree.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';

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
				if (spawnResult.errors.length > 0) {
					this.deps.logger.warn('Meridian', `${String(spawnResult.errors.length)} agent(s) failed to load`);
				}

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

				// Phase 1C: Load world data
				const locationLoader = createLocationLoader(this.deps.logger);
				const locationResult = await locationLoader.loadFromVault(vaultAdapter, '03 - Resources/Locations');
				if (locationResult.errors.length > 0) {
					this.deps.logger.warn('Meridian', `${String(locationResult.errors.length)} location(s) failed to load`);
				}
				const worldLocations = locationResult.items;

				const btLoaderInstance = createBTLoader(this.deps.logger);
				const btResult = await btLoaderInstance.loadFromVault(vaultAdapter, '03 - Resources/BehaviorTrees');
				if (btResult.errors.length > 0) {
					this.deps.logger.warn('Meridian', `${String(btResult.errors.length)} behavior tree(s) failed to load`);
				}

				// Build BT definitions map keyed by agent kind (strip "bt-" prefix from BT id)
				const btDefinitions: Record<string, BTNode> = {};
				for (const bt of btResult.items) {
					// BT ids are "bt-merchant", agent kinds are "merchant" — strip prefix to match
					const key = bt.id.startsWith('bt-') ? bt.id.slice(3) : bt.id;
					btDefinitions[key] = bt.root;
				}

				// Add location markers to the scene
				for (const loc of worldLocations) {
					this.engine.currentScene.add(createLocationMarker(loc));
				}

				// Create world entity for time state
				const worldEntity = new ex.Actor();
				worldEntity.addComponent(new TimeComponent({ phase: 'dawn', tickInCycle: 0, dayCount: 0 }));
				this.engine.currentScene.add(worldEntity);
				const getWorldEntity = () => worldEntity;

				// Add PerceptionComponent to each agent
				for (const agent of spawnedAgents) {
					agent.addComponent(new PerceptionComponent({ nearbyAgents: [], nearbyLocations: [] }));
				}

				const getLocations = () => worldLocations;

				// Register Phase 1C systems
				tickRunner.register(createDayNightSystem(getWorldEntity));
				tickRunner.register(createPerceptionSystem(getAgents, getLocations, getWorldEntity));
				tickRunner.register(createBehaviorTreeSystem(getAgents, btDefinitions, getWorldEntity, Date.now()));
				tickRunner.register(createMovementSystem(getAgents, getLocations));

				this.deps.logger.info('Meridian', `Phase 1C: ${String(worldLocations.length)} locations, ${String(btResult.items.length)} BTs loaded`);
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

function createLocationMarker(loc: WorldLocation): ex.Actor {
	const marker = new ex.Actor({ pos: new ex.Vector(loc.position.x, loc.position.y) });
	marker.graphics.use(new ex.Rectangle({ width: 20, height: 20, color: ex.Color.fromHex(loc.color) }));
	const label = new ex.Label({
		text: loc.name,
		pos: new ex.Vector(0, -18),
		font: new ex.Font({ size: 9, unit: ex.FontUnit.Px, color: ex.Color.fromHex('#aaaaaa') }),
	});
	marker.addChild(label);
	return marker;
}
