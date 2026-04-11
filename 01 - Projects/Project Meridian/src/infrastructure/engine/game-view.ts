import { ItemView, type WorkspaceLeaf, type Vault } from 'obsidian';
import * as ex from 'excalibur';
import { BehaviourTree } from 'mistreevous';
import { createGameEngine } from './game-engine.js';
import { createGameLoader } from './game-loader.js';
import { createDebugOverlay } from './debug-overlay.js';
import { createQuestLogger, type QuestLogger } from '../ui/quest-logger.js';
import { createWorldLoader, type WorldData } from './world-loader.js';
import { createTickRunner } from './tick-runner.js';
import { MeridianTickSystem } from './tick-system.js';
import type { BatchableEventBus } from './batchable-event-bus.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { TickScheduler } from '../../domain/core/tick-scheduler.js';
import type { AgentActor } from '../entity/agent-actor.js';
import type { VaultReader } from '../entity/agent-spawner.js';
import { createBehaviorAgent } from '../entity/behavior-agent-factory.js';
import { createGameRNG, hashString } from '../../domain/core/game-rng.js';
import { createTraitResolverSystem } from '../systems/trait-resolver-system.js';
import { createNeedsDecaySystem } from '../systems/needs-decay-system.js';
import { createMoodSystem } from '../systems/mood-system.js';
import { createMemoryDecaySystem } from '../systems/memory-decay-system.js';
import { createDayNightSystem } from '../systems/day-night-system.js';
import { createPerceptionSystem } from '../systems/perception-system.js';
import { createBehaviorTreeSystem } from '../systems/behavior-tree-system.js';
import { createMovementSystem } from '../systems/movement-system.js';
import { createRestSystem } from '../systems/rest-system.js';
import { createFeedSystem } from '../systems/feed-system.js';
import { createSocializeSystem } from '../systems/socialize-system.js';
import { createLeisureSystem } from '../systems/leisure-system.js';
import { createFacilitySystem } from '../systems/facility-system.js';
import { createTradeSystem } from '../systems/trade-system.js';
import { createDialogueSystem } from '../systems/dialogue-system.js';
import { createGossipSystem } from '../systems/gossip-system.js';
import { createRelationshipCheckpointSystem } from '../systems/relationship-checkpoint-system.js';
import { createEconomySystem } from '../systems/economy-system.js';
import { createMonetaryPolicySystem } from '../systems/monetary-policy-system.js';
import { createWelfareSystem } from '../systems/welfare-system.js';
import { createStipendSystem } from '../systems/stipend-system.js';
import { createSubsidySystem } from '../systems/subsidy-system.js';
import { createEquipmentDecaySystem } from '../systems/equipment-decay-system.js';
import { createFacilityMaintenanceSystem } from '../systems/facility-maintenance-system.js';
import { createDailyReportSystem } from '../systems/daily-report-system.js';
import { createAbandonmentSystem } from '../systems/abandonment-system.js';
import { createQuestEvaluationSystem } from '../systems/quest-evaluation-system.js';
import { createQuestGenerationSystem } from '../systems/quest-generation-system.js';
import { TimeComponent } from '../components/time-component.js';
import { FacilityComponent } from '../components/facility-component.js';
import { EconomyComponent } from '../components/economy-component.js';
import { QuestBoardComponent } from '../components/quest-board-component.js';
import type { WorldLocation } from '../../domain/schemas/location-schema.js';

export const MERIDIAN_VIEW_TYPE = 'meridian-game-view';

export class MeridianGameView extends ItemView {
	private engine: ex.Engine | null = null;
	private disposeEngine: (() => void) | null = null;
	private debugUnsubscribe: (() => void) | null = null;
	private disposeOverlay: (() => void) | null = null;
	private questLogger: QuestLogger | null = null;
	private deps: GameCoreDeps | null;
	private batchableEventBus: BatchableEventBus | null;
	private worldAgents: AgentActor[] = [];
	private onAgentSelectedCb: ((agentId: string) => void) | null = null;

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

	getAgents(): AgentActor[] {
		return this.worldAgents;
	}

	/** Set the callback invoked when an agent is clicked on the canvas. */
	setOnAgentSelected(cb: ((agentId: string) => void) | null): void {
		this.onAgentSelectedCb = cb;
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
				this.deps?.logger.warn('Meridian', 'Game deps not ready — tick system not registered.');
				const msg = container.createDiv({ cls: 'meridian-loading' });
				msg.textContent = 'Simulation initializing... Please reopen this tab.';
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

		// Auto-detect data root: dev vault has project path, deployed vault has 03 - Resources/
		const devRoot = '01 - Projects/Project Meridian';
		const devProbe = await vaultAdapter.list(`${devRoot}/agents`);
		const dataRoot = devProbe.length > 0 ? devRoot : '03 - Resources';
		deps.dataRoot = dataRoot;

		const worldLoader = createWorldLoader(deps.logger, {
			moodConfig: deps.config.mood,
			memoryMaxEntries: deps.config.memory.max_entries,
			dataRoot,
			jobDefinitions: deps.config.jobs.definitions,
		});

		const world = await worldLoader.load(vaultAdapter, (_step, _total, label) => {
			overlay.textContent = label;
		});

		overlay.textContent = 'Starting simulation...';

		// Wire tick system
		const tickRunner = createTickRunner(eventBus);
		engine.currentScene.world.add(new MeridianTickSystem(tickRunner, deps));

		// Populate scene
		this.populateScene(engine, world, deps, tickRunner, container);

		// Centralized event debug logging — logs all game events at debug level
		this.debugUnsubscribe = eventBus.onAny((event) => {
			deps.logger.debug(event.source, `[${event.type}] tick ${String(event.tick)}`, event.payload);
		});

		// Remove overlay
		overlay.remove();
	}

	private populateScene(engine: ex.Engine, world: WorldData, deps: GameCoreDeps, tickRunner: TickScheduler, container: HTMLElement): void {
		this.worldAgents = [...world.agents];
		// Add agents to scene
		for (const agent of world.agents) {
			engine.currentScene.add(agent);
			agent.on('pointerdown', () => {
				if (this.onAgentSelectedCb !== null) {
					this.onAgentSelectedCb(agent.agentId);
				}
			});
		}

		// Add location markers and retain references for FacilityComponent queries
		const locationActors = new Map<string, ex.Actor>();
		for (const loc of world.locations) {
			const marker = createLocationMarker(loc);
			engine.currentScene.add(marker);

			if (loc.production !== null) {
				// Production facilities start empty — agents must work to produce.
				// Non-production facilities (market) get stock from their JSON data.
				const fund = loc.production.funding === 'treasury' ? 0 : deps.config.economy.facility_start_fund;
				marker.addComponent(new FacilityComponent({
					stock: [],
					fund,
					workProgress: 0,
					status: 'idle',
					workerId: null,
				}));
			}

			// Add fund-only FacilityComponent to tavern (non-production locations that receive gold)
			if (loc.type === 'rest' && loc.production === null) {
				marker.addComponent(new FacilityComponent({
					stock: [],
					fund: 0,
					workProgress: 0,
					status: 'idle',
					workerId: null,
				}));
			}

			// Add FacilityComponent to leisure-type locations (receive gold from agent visits)
			if (loc.type === 'leisure' && loc.production === null) {
				marker.addComponent(new FacilityComponent({
					stock: [],
					fund: 0,
					workProgress: 0,
					status: 'idle',
					workerId: null,
				}));
			}

			// Add FacilityComponent to market-type locations with fund/stock from location data
			if (loc.type === 'market' && loc.production === null) {
				marker.addComponent(new FacilityComponent({
					stock: loc.stock ?? [],
					fund: loc.fund ?? deps.config.economy.facility_start_fund,
					workProgress: 0,
					status: 'idle',
					workerId: null,
				}));
			}

			locationActors.set(loc.id, marker);
		}

		// Create world entity for time state + economy
		const worldEntity = new ex.Actor();
		worldEntity.addComponent(new TimeComponent({ phase: 'dawn', tickInCycle: 0, dayCount: 0, dayBoundaryThisTick: false }));
		worldEntity.addComponent(new EconomyComponent({
			treasury: deps.config.economy.treasury_start_sandbox,
			ledger: [],
			dailySummary: { totalWages: 0, totalTax: 0, totalSales: 0, totalConsumption: 0, avgWage: 0, wageSpread: 0, vacancyCount: 0, unemploymentCount: 0, jobSwitchesThisDay: 0, supplyDeliveries: 0, questsCompletedThisDay: 0 },
		}));
		worldEntity.addComponent(new QuestBoardComponent({ quests: [] }));
		engine.currentScene.add(worldEntity);

		// Entity queries
		const getAgents = () => world.agents;
		const getLocations = () => world.locations;
		const getWorldEntity = () => worldEntity;
		const getLocationActors = () => locationActors;
		const getItemRegistry = () => world.items;

		// Create BehaviorAgent + jobless BehaviourTree for each agent
		const jobTrees = world.jobTrees;
		const joblessMdsl = world.joblessMdsl;

		for (const agent of world.agents) {
			const swapBehaviorTree = (jobName: string | null): void => {
				const mdsl = jobName !== null ? jobTrees[jobName] : joblessMdsl;
				if (mdsl === undefined) {
					deps.logger.warn('Meridian', `No job tree for "${String(jobName)}"`);
					return;
				}
				const rng = createGameRNG(hashString(agent.agentId + (jobName ?? 'jobless')));
				agent.behaviorTree = new BehaviourTree(mdsl, agent.behaviorAgent, {
					random: () => rng.next(),
					getDeltaTime: () => deps.config.tick_interval_ms / 1000,
				});
			};

			const behaviorAgent = createBehaviorAgent({
				actor: agent,
				worldEntity: getWorldEntity,
				config: deps.config,
				getLocationActors,
				getLocations,
				tickCount: () => deps.tickCount,
				eventBus: deps.eventBus,
				swapBehaviorTree,
				jobsConfig: deps.config.jobs,
				getQuestBoard: () => worldEntity.get(QuestBoardComponent).state,
			});

			// Initialize with job-specific tree if agent has a job, otherwise jobless
			const initJob = agent.job;
			const initMdsl = initJob !== null ? (jobTrees[initJob] ?? joblessMdsl) : joblessMdsl;
			const rng = createGameRNG(hashString(agent.agentId + (initJob ?? 'jobless')));
			const tree = new BehaviourTree(initMdsl, behaviorAgent, {
				random: () => rng.next(),
				getDeltaTime: () => deps.config.tick_interval_ms / 1000,
			});

			agent.behaviorAgent = behaviorAgent;
			agent.behaviorTree = tree;
		}

		// Register all systems (priority order handled by tick runner)
		tickRunner.register(createTraitResolverSystem(getAgents, world.traitDefs));
		tickRunner.register(createDayNightSystem(getWorldEntity, getAgents, getLocationActors, getLocations));
		tickRunner.register(createWelfareSystem(getWorldEntity, getAgents));
		tickRunner.register(createStipendSystem(getWorldEntity, getAgents));
		tickRunner.register(createSubsidySystem(getWorldEntity, getLocationActors, getLocations));
		tickRunner.register(createEquipmentDecaySystem(getWorldEntity, getAgents));
		tickRunner.register(createFacilityMaintenanceSystem(getWorldEntity, getLocationActors));
		tickRunner.register(createDailyReportSystem(getWorldEntity, getAgents, getLocationActors, getLocations));
		tickRunner.register(createNeedsDecaySystem(getAgents));
		tickRunner.register(createMoodSystem(getAgents));
		tickRunner.register(createPerceptionSystem(getAgents, getLocations, getWorldEntity));
		tickRunner.register(createMemoryDecaySystem(getAgents));
		tickRunner.register(createBehaviorTreeSystem(getAgents));
		tickRunner.register(createMovementSystem(getAgents, getLocations, getLocationActors));
		tickRunner.register(createRestSystem(getAgents, getLocations, getWorldEntity, getLocationActors));
		tickRunner.register(createFeedSystem(getAgents, getWorldEntity));
		tickRunner.register(createSocializeSystem(getAgents));
		tickRunner.register(createLeisureSystem(getAgents, getLocations, getWorldEntity, getLocationActors));
		tickRunner.register(createFacilitySystem(getAgents, getLocations, getLocationActors, getWorldEntity, getItemRegistry));
		tickRunner.register(createTradeSystem(getAgents, getLocations, getLocationActors, getWorldEntity, getItemRegistry));
		tickRunner.register(createDialogueSystem(getAgents, Date.now()));
		tickRunner.register(createGossipSystem(getAgents, getLocations));
		tickRunner.register(createRelationshipCheckpointSystem(getAgents));
		tickRunner.register(createEconomySystem(getLocations, getLocationActors, getItemRegistry));
		tickRunner.register(createMonetaryPolicySystem(getAgents, getWorldEntity));
		tickRunner.register(createQuestEvaluationSystem(getWorldEntity, getAgents));
		tickRunner.register(createQuestGenerationSystem(getWorldEntity, getLocationActors, getLocations));
		tickRunner.register(createAbandonmentSystem(getLocationActors, getLocations, getAgents));

		deps.logger.info('Meridian', `World ready: ${String(world.agents.length)} agents, ${String(world.locations.length)} locations, ${String(world.regions.length)} regions, ${String(Object.keys(world.jobTrees).length)} jobs, ${String(Object.keys(world.traitDefs).length)} traits`);

		// Quest logger — subscribes to Quest* events, tracks each quest's timeline,
		// persists terminal quests to markdown files under <dataRoot>/Economy/Quests/.
		const resolveEntityName = (id: string): string => {
			const loc = world.locations.find(l => l.id === id);
			if (loc !== undefined) return loc.name;
			const agent = world.agents.find(a => a.agentId === id);
			if (agent !== undefined) return agent.agentName;
			return id;
		};
		this.questLogger = createQuestLogger({
			eventBus: deps.eventBus,
			getQuestBoard: () => worldEntity.get(QuestBoardComponent).state,
			resolveName: resolveEntityName,
			writeFile: deps.writeFile ?? undefined,
			dataRoot: () => deps.dataRoot,
		});
		const questLogger = this.questLogger;

		// Debug overlay
		const debugOverlay = createDebugOverlay(container, {
			getAgents,
			getWorldEntity,
			getLocations,
			getLocationActors,
			getTickCount: () => deps.tickCount,
			getTicksPerDay: () => deps.config.ticks_per_day,
			getItemRegistry,
			getEventBus: () => deps.eventBus,
			getConfig: () => deps.config,
			writeFile: deps.writeFile ?? undefined,
			dataRoot: deps.dataRoot,
			getQuestLogger: () => questLogger,
		});
		this.disposeOverlay = debugOverlay.dispose;
	}

	/** Toggle ExcaliburJS debug drawing (entity bounds, names, etc.) */
	setDebugMode(enabled: boolean): void {
		if (this.engine === null) return;
		const isCurrentlyDebug = this.engine.isDebug;
		if (enabled !== isCurrentlyDebug) {
			this.engine.toggleDebug();
		}
		if (enabled) {
			this.engine.debug.entity.showName = true;
			this.engine.debug.entity.showId = false;
		}
	}

	// eslint-disable-next-line @typescript-eslint/require-await -- Obsidian ItemView interface requires async
	async onClose(): Promise<void> {
		this.disposeOverlay?.();
		this.disposeOverlay = null;
		this.questLogger?.dispose();
		this.questLogger = null;
		this.debugUnsubscribe?.();
		this.debugUnsubscribe = null;
		if (this.engine !== null) {
			this.engine.stop();
			this.engine = null;
		}
		// Release WebGL context + canvas after engine stops
		this.disposeEngine?.();
		this.disposeEngine = null;
	}

	private showError(container: HTMLElement, err: unknown): void {
		const message = err instanceof Error ? err.message : String(err);
		// Logger not available during init failure — console is intentional here
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
		list: async (path: string): Promise<string[]> => {
			const exists = await vault.adapter.exists(path);
			if (!exists) return [];
			const listing = await vault.adapter.list(path);
			return listing.files.filter(f => f.endsWith('.json'));
		},
		read: async (path: string): Promise<string> => {
			return vault.adapter.read(path);
		},
	};
}

function createLocationMarker(loc: WorldLocation): ex.Actor {
	const isFacility = loc.production !== null;
	const size = isFacility ? 40 : 20;
	const marker = new ex.Actor({ pos: new ex.Vector(loc.position.x, loc.position.y) });
	marker.graphics.use(new ex.Rectangle({ width: size, height: size, color: ex.Color.fromHex(loc.color) }));
	const label = new ex.Label({
		text: loc.name,
		pos: new ex.Vector(0, -(size / 2 + 8)),
		font: new ex.Font({ size: 9, unit: ex.FontUnit.Px, color: ex.Color.fromHex('#aaaaaa') }),
	});
	marker.addChild(label);
	return marker;
}
