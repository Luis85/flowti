import { ItemView, type WorkspaceLeaf, type Vault } from 'obsidian';
import * as ex from 'excalibur';
import { createGameEngine } from './game-engine.js';
import { createGameLoader } from './game-loader.js';
import { createWorldLoader, type WorldData } from './world-loader.js';
import { createTickRunner } from './tick-runner.js';
import { MeridianTickSystem } from './tick-system.js';
import type { BatchableEventBus } from './batchable-event-bus.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { TickScheduler } from '../../domain/core/tick-scheduler.js';
import type { VaultReader } from '../entity/agent-spawner.js';
import { createTraitResolverSystem } from '../systems/trait-resolver-system.js';
import { createNeedsDecaySystem } from '../systems/needs-decay-system.js';
import { createMoodSystem } from '../systems/mood-system.js';
import { createMemoryDecaySystem } from '../systems/memory-decay-system.js';
import { createDayNightSystem } from '../systems/day-night-system.js';
import { createPerceptionSystem } from '../systems/perception-system.js';
import { createBehaviorTreeSystem } from '../systems/behavior-tree-system.js';
import { createMovementSystem } from '../systems/movement-system.js';
import { TimeComponent } from '../components/time-component.js';
import { PerceptionComponent } from '../components/perception-component.js';
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

			const { engine, dispose } = createGameEngine(container, { backgroundColor: bgColor });
			this.engine = engine;
			this.disposeEngine = dispose;

			if (this.deps !== null && this.batchableEventBus !== null) {
				await this.initializeWorld(this.engine, this.deps, this.batchableEventBus, container);
			} else {
				console.warn('[Meridian] Game deps not ready — tick system not registered.');
			}

			const loader = createGameLoader();
			void this.engine.start(loader).catch((err: unknown) => {
				this.showError(container, err);
			});
		} catch (err: unknown) {
			this.showError(container, err);
		}
	}

	private async initializeWorld(engine: ex.Engine, deps: GameCoreDeps, eventBus: BatchableEventBus, container: HTMLElement): Promise<void> {
		// Show loading overlay
		const overlay = createLoadingOverlay(container);

		// Load all world data through unified loader
		const vaultAdapter = createVaultAdapter(this.app.vault);
		const worldLoader = createWorldLoader(deps.logger, {
			moodConfig: deps.config.mood,
			memoryMaxEntries: deps.config.memory.max_entries,
		});

		const world = await worldLoader.load(vaultAdapter, (_step, _total, label) => {
			overlay.textContent = label;
		});

		overlay.textContent = 'Starting simulation...';

		// Wire tick system
		const tickRunner = createTickRunner(eventBus);
		engine.currentScene.world.add(new MeridianTickSystem(tickRunner, deps));

		// Populate scene
		this.populateScene(engine, world, deps, tickRunner);

		// Remove overlay
		overlay.remove();
	}

	private populateScene(engine: ex.Engine, world: WorldData, deps: GameCoreDeps, tickRunner: TickScheduler): void {
		// Add agents to scene
		for (const agent of world.agents) {
			engine.currentScene.add(agent);
			agent.addComponent(new PerceptionComponent({ nearbyAgents: [], nearbyLocations: [] }));
		}

		// Add location markers
		for (const loc of world.locations) {
			engine.currentScene.add(createLocationMarker(loc));
		}

		// Create world entity for time state
		const worldEntity = new ex.Actor();
		worldEntity.addComponent(new TimeComponent({ phase: 'dawn', tickInCycle: 0, dayCount: 0 }));
		engine.currentScene.add(worldEntity);

		// Entity queries
		const getAgents = () => world.agents;
		const getLocations = () => world.locations;
		const getWorldEntity = () => worldEntity;

		// Register all systems (priority order handled by tick runner)
		tickRunner.register(createTraitResolverSystem(getAgents, world.traitDefs));
		tickRunner.register(createDayNightSystem(getWorldEntity));
		tickRunner.register(createNeedsDecaySystem(getAgents));
		tickRunner.register(createMoodSystem(getAgents));
		tickRunner.register(createPerceptionSystem(getAgents, getLocations, getWorldEntity));
		tickRunner.register(createMemoryDecaySystem(getAgents));
		tickRunner.register(createBehaviorTreeSystem(getAgents, world.btDefinitions, getWorldEntity, Date.now()));
		tickRunner.register(createMovementSystem(getAgents, getLocations));

		deps.logger.info('Meridian', `World ready: ${String(world.agents.length)} agents, ${String(world.locations.length)} locations, ${String(Object.keys(world.btDefinitions).length)} BTs, ${String(Object.keys(world.traitDefs).length)} traits`);
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
		container.empty();
		const errorEl = container.createDiv({ cls: 'meridian-error' });
		errorEl.createEl('h3', { text: 'Project Meridian' });
		errorEl.createEl('p', { text: 'The game engine failed to start.' });
		errorEl.createEl('code', { text: message });
		errorEl.createEl('p', { text: 'Check the developer console for details.' });
	}
}

function createLoadingOverlay(container: HTMLElement): HTMLElement {
	const overlay = document.createElement('div');
	overlay.className = 'meridian-loading';
	overlay.textContent = 'Loading world...';
	container.appendChild(overlay);
	return overlay;
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
