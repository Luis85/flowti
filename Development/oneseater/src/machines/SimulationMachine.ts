import { ActorRefFrom, createActor, SnapshotFrom } from "xstate";
import type { SimulationStore } from "../simulation/stores/SimulationStore";
import { SimEvent, SIMULATION_MACHINE } from "./types";
import { IEventBus } from "src/eventsystem";

export class SimulationMachine {
	private actor: ActorRefFrom<typeof SIMULATION_MACHINE>;

	constructor(private event: IEventBus, private store: SimulationStore) {
		this.actor = createActor(SIMULATION_MACHINE);
		
		this.actor.subscribe((state) => {
			this.store.paused = state.context.paused;
		});

		this.actor.start();
	}

	send = (event: SimEvent) => this.actor.send(event);

	getSnapshot(): SnapshotFrom<typeof SIMULATION_MACHINE> {
		return this.actor.getSnapshot();
	}
}
