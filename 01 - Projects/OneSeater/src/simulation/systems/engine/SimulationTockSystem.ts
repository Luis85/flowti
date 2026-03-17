import { createSystem, WriteEvents, ReadResource } from "sim-ecs";
import { SimulationTockEvent } from "src/eventsystem/engine/SimulationTockEvent";
import { SimulationStore } from "src/simulation/stores/SimulationStore";

export const SimulationTockSystem = createSystem({
    tock: WriteEvents(SimulationTockEvent),
	simulationStore: ReadResource(SimulationStore),
}).withRunFunction(async ({tock, simulationStore}) => {
	const stepDuration = Date.now() - simulationStore.lastTick;
    await tock.publish(new SimulationTockEvent(Date.now(), stepDuration, simulationStore));
}).build();
