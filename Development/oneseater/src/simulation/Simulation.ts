import { IPreptimeWorld, IRuntimeWorld } from "sim-ecs";
import { TEST_WORLD } from "./worlds/TestWorld";
import { SimulationState } from "./states/SimulationState";
import { Counter } from "./components/Counter";
import { createEventBus, IEventBus } from "src/eventsystem/EventBus";
import { SimulationStore } from "./stores/SimulationStore";
import { GameSettingsStore } from "./stores/GameSettingsStore";
import { SimulationStartedEvent } from "src/eventsystem/engine/SimulationStartedEvent";
import { SimulationStoppedEvent } from "src/eventsystem/engine/SimulationStoppedEvent";
import { TaskStore } from "./stores/TaskStore";
import { MessageStore } from "./stores/MessageStore";

export interface ISimulation {
	init(): Promise<void>;
	start(): Promise<void>;
	stop(): void;
	getEvents(): IEventBus;
	setDebug(debug: boolean): void;
	getStore(): SimulationStore;
	getMessages(): MessageStore;
	getTasks(): TaskStore;
	getSettings(): GameSettingsStore;
}

export class Simulation implements ISimulation {
	private prepWorld: IPreptimeWorld;
	private engine: IRuntimeWorld | undefined;
	private eventBus: IEventBus;

	constructor(private debug = false) {}

	setDebug(debug: boolean): void {
		this.debug = debug;
		this.eventBus.setDebug(this.debug);
	}

	async init(): Promise<void> {
		if (this.engine) {
			console.log("Engine already initialized...");
			return;
		}
		console.log("initializing simulation...");
		console.log("🔴🔴🔴🔴⚫");

		console.log("initializing world...");
		this.prepWorld = TEST_WORLD;
		this.prepWorld
			/// invoking the entity builder in this way automatically adds the entity to the world
			.buildEntity()
			.with(Counter)
			.build();
		console.log("🔴🔴⚫⚫⚫");
		console.log("initializing engine...");
		this.engine = await this.prepWorld.prepareRun({
			initialState: SimulationState,
		});
		this.eventBus = createEventBus(this.engine.eventBus);
	}

	async start(): Promise<void> {
		if (this.engine?.isRunning) return;

		console.log("🔴⚫⚫⚫⚫");
		if (!this.engine) {
			console.log("🔴🟡🔴🟡🔴");
			console.log("engine start aborted, no engine initialized...");
			console.log("🟡🔴🟡🔴🟡");
			return;
		}

		console.log("starting the engine...");
		console.log("...");
		console.log("⚫⚫⚫⚫⚫");
		console.log("vrooOooOOOommm...");
		this.eventBus.publish(new SimulationStartedEvent());
		await this.engine
			.start()
			.catch((error: Error) => {
				console.log("🔴🟡🔴🟡🔴");
				console.error(error);
				console.log("🟡🔴🟡🔴🟡");
			})
			.then(() => {
				console.log("🔴🔴🔴🔴🔴");
				console.log("engine stopped...");
				this.eventBus.publish(new SimulationStoppedEvent());
			});
	}

	stop(): void {
		if (!this.engine || !this.engine.isRunning) return;
		console.log("⚫🟡⚫🟡⚫");
		console.log("stopping the engine...");
		this.engine.stop();
	}

	getEvents(): IEventBus {
		if (!this.eventBus) throw new Error("No eventbus set");
		return this.eventBus;
	}

	getStore(): SimulationStore {
		const store = this.engine?.getResource(SimulationStore);
		if (!store) throw new Error("No store set");
		return store;
	}

	getTasks(): TaskStore {
		const tasks = this.engine?.getResource(TaskStore);
		if(!tasks) throw new Error('Task Store not set');
		return tasks;
	}

	getMessages(): MessageStore {
		const messages = this.engine?.getResource(MessageStore);
		if(!messages) throw new Error('Message Store not set');
		return messages;
	}

	getSettings(): GameSettingsStore {
		const settings = this.engine?.getResource(GameSettingsStore);
		if (!settings) throw new Error("No settings found in this world");
		return settings;
	}
}
