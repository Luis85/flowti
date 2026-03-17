import { createSystem, Storage, WriteResource } from "sim-ecs";
import { SimulationStore } from "src/simulation/stores/SimulationStore";

/**
 * This System is responsible to calculate deltaTime and update the stored value of it
 */

const FRAME_TIME_CAP_MS = 33; // ~30 FPS safety cap

export const BeforeStepSystem = createSystem({
  simulationStore: WriteResource(SimulationStore),
  storage: Storage({ lastTimestampMs: 0 }),
})
  .withName("BeforeStepSystem")
  .withRunFunction(({ simulationStore, storage }) => {
    const now = performance.now();

    if (storage.lastTimestampMs === 0) {
      storage.lastTimestampMs = now;
      simulationStore.deltaTime = 0;
      return;
    }

    const realDt = Math.min(
      now - storage.lastTimestampMs,
      FRAME_TIME_CAP_MS
    );

    storage.lastTimestampMs = now;
    simulationStore.deltaTime = realDt;
  })
  .build();
