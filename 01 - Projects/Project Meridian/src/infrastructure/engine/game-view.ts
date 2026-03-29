import { ItemView, type WorkspaceLeaf, type Vault } from 'obsidian';
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
import { createTraitLoader } from '../entity/trait-loader.js';
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

	constructor(leaf: WorkspaceLeaf, deps: GameCoreDeps | null, batchableEventBus: BatchableEventBus | null = null) {
		super(leaf);
		this.deps = deps;
		this.batchableEventBus = batchableEventBus;
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
				await this.wireGameSystems(this.engine, this.deps, this.batchableEventBus);
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

	private async wireGameSystems(engine: ex.Engine, deps: GameCoreDeps, eventBus: BatchableEventBus): Promise<void> {
		const tickRunner = createTickRunner(eventBus);
		const tickSystem = new MeridianTickSystem(tickRunner, deps);
		engine.currentScene.world.add(tickSystem);
		deps.logger.info('Meridian', 'Tick system registered');

		const vaultAdapter = createVaultAdapter(this.app.vault);

		// Phase 1B: Spawn agents + register life systems
		const spawner = createAgentSpawner(deps.logger, deps.config.mood, deps.config.memory.max_entries);
		const spawnResult = await spawner.spawnFromVault(vaultAdapter, '03 - Resources/Agents');
		if (spawnResult.errors.length > 0) {
			deps.logger.warn('Meridian', `${String(spawnResult.errors.length)} agent(s) failed to load`);
		}

		const spawnedAgents: AgentActor[] = spawnResult.agents;
		for (const agent of spawnedAgents) {
			engine.currentScene.add(agent);
		}

		const getAgents = (): AgentActor[] => spawnedAgents;

		// Load all vault data
		const { traitDefs, worldLocations, btDefinitions } = await this.loadWorldData(deps, vaultAdapter);

		tickRunner.register(createTraitResolverSystem(getAgents, traitDefs));
		tickRunner.register(createNeedsDecaySystem(getAgents));
		tickRunner.register(createMoodSystem(getAgents));
		tickRunner.register(createMemoryDecaySystem(getAgents));
		deps.logger.info('Meridian', `Phase 1B: ${String(spawnedAgents.length)} agents spawned`);

		for (const loc of worldLocations) {
			engine.currentScene.add(createLocationMarker(loc));
		}

		const worldEntity = new ex.Actor();
		worldEntity.addComponent(new TimeComponent({ phase: 'dawn', tickInCycle: 0, dayCount: 0 }));
		engine.currentScene.add(worldEntity);

		for (const agent of spawnedAgents) {
			agent.addComponent(new PerceptionComponent({ nearbyAgents: [], nearbyLocations: [] }));
		}

		const getLocations = () => worldLocations;
		const getWorldEntity = () => worldEntity;
		tickRunner.register(createDayNightSystem(getWorldEntity));
		tickRunner.register(createPerceptionSystem(getAgents, getLocations, getWorldEntity));
		tickRunner.register(createBehaviorTreeSystem(getAgents, btDefinitions, getWorldEntity, Date.now()));
		tickRunner.register(createMovementSystem(getAgents, getLocations));
		deps.logger.info('Meridian', `Phase 1C: ${String(worldLocations.length)} locations, ${String(Object.keys(btDefinitions).length)} BTs registered`);
	}

	private async loadWorldData(deps: GameCoreDeps, vault: VaultReader): Promise<{
		traitDefs: Record<string, TraitDefinition>;
		worldLocations: WorldLocation[];
		btDefinitions: Record<string, BTNode>;
	}> {
		const traitResult = await createTraitLoader(deps.logger).loadFromVault(vault, '03 - Resources/Traits');
		if (traitResult.errors.length > 0) {
			deps.logger.warn('Meridian', `${String(traitResult.errors.length)} trait(s) failed to load`);
		}
		const traitDefs: Record<string, TraitDefinition> = {};
		for (const trait of traitResult.items) {
			traitDefs[trait.id] = trait;
		}

		const locationResult = await createLocationLoader(deps.logger).loadFromVault(vault, '03 - Resources/Locations');
		if (locationResult.errors.length > 0) {
			deps.logger.warn('Meridian', `${String(locationResult.errors.length)} location(s) failed to load`);
		}

		const btResult = await createBTLoader(deps.logger).loadFromVault(vault, '03 - Resources/BehaviorTrees');
		if (btResult.errors.length > 0) {
			deps.logger.warn('Meridian', `${String(btResult.errors.length)} behavior tree(s) failed to load`);
		}
		const btDefinitions: Record<string, BTNode> = {};
		for (const bt of btResult.items) {
			const key = bt.id.startsWith('bt-') ? bt.id.slice(3) : bt.id;
			btDefinitions[key] = bt.root;
		}

		deps.logger.info('Meridian', `World data: ${String(traitResult.items.length)} traits, ${String(locationResult.items.length)} locations, ${String(btResult.items.length)} BTs`);
		return { traitDefs, worldLocations: locationResult.items, btDefinitions };
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

function createVaultAdapter(vault: Vault): VaultReader {
	return {
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
