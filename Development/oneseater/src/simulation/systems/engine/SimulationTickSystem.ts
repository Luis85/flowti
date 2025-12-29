import { createSystem, WriteEvents, Storage, ReadResource } from "sim-ecs";
import { SimulationTickEvent } from "src/eventsystem/engine/SimulationTickEvent";
import { SimulationStore } from "src/simulation/stores/SimulationStore";
import { TimeScaleStore } from "src/simulation/stores/TimeScaleStore";

export const SimulationTickSystem = createSystem({
    tick: WriteEvents(SimulationTickEvent),
    lastEvent: Storage({timestamp: 0}),
	simulationStore: ReadResource(SimulationStore),
	timeScale: ReadResource(TimeScaleStore),
}).withRunFunction(async ({tick, lastEvent, simulationStore, timeScale}) => {
	if(!simulationStore.started) simulationStore.started = Date.now();
    lastEvent.timestamp = Date.now();
	simulationStore.speed = timeScale.multiplier;
	simulationStore.lastTick = Date.now();
    await tick.publish(new SimulationTickEvent(simulationStore.deltaTime, lastEvent.timestamp, simulationStore));
}).build();
