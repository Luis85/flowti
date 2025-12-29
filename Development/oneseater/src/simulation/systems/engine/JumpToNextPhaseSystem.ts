import { createSystem, ReadEvents, ReadResource, WriteResource } from "sim-ecs";
import { JumpToNextPhaseEvent } from "src/eventsystem/engine/JumpToNextPhaseEvent";
import { SimulationStore } from "src/simulation/stores/SimulationStore";
import { TimeScaleStore } from "src/simulation/stores/TimeScaleStore";
import { DayPhase, DAY_MS, MINUTE_MS } from "src/simulation/types";

function phaseForMinute(minute: number): DayPhase {
  if (minute < 360) return "night";
  if (minute < 540) return "morning";
  if (minute < 1020) return "work";
  if (minute < 1200) return "session";
  return "wrapup";
}

/** next start minute for the *next* phase boundary */
function nextPhaseStartMinute(minuteOfDay: number): number {
  // boundaries: 00:00, 06:00, 09:00, 17:00, 20:00, 24:00
  if (minuteOfDay < 360) return 360;
  if (minuteOfDay < 540) return 540;
  if (minuteOfDay < 1020) return 1020;
  if (minuteOfDay < 1200) return 1200;
  return 1440; // end of day -> next day 00:00
}

export const JumpToNextPhaseSystem = createSystem({
  input: ReadEvents(JumpToNextPhaseEvent),
  sim: WriteResource(SimulationStore),
  timeScale: ReadResource(TimeScaleStore),
})
  .withName("JumpToNextPhaseSystem")
  .withRunFunction(({ input, sim }) => {
    let requested = false;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _evt of input.iter()) {
      requested = true;
      break; // one jump per step
    }
    if (!requested) return;

    const curMinute = sim.minuteOfDay ?? 0;
    const nextStart = nextPhaseStartMinute(curMinute);

    const currentDayStartMs = Math.floor(sim.simNowMs / DAY_MS) * DAY_MS;

    if (nextStart >= 1440) {
      // jump to next day start 00:00
      sim.simNowMs = currentDayStartMs + DAY_MS;
      sim.dayIndex = Math.floor(sim.simNowMs / DAY_MS);
      sim.minuteOfDay = 0;
      sim.phase = phaseForMinute(0);
      return;
    }

    sim.simNowMs = currentDayStartMs + nextStart * MINUTE_MS;
    sim.minuteOfDay = nextStart;
  })
  .build();
