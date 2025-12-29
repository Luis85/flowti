import { createMachine, assign } from "xstate";
import { TogglePauseEvent } from "src/eventsystem/engine/TogglePauseEvent";

export type SimEvent = TogglePauseEvent;

type SimContext = {
  paused: boolean;
};

export const SIMULATION_MACHINE = createMachine(
  {
    id: "simulation",
    types: {} as { context: SimContext; events: SimEvent },
    context: { paused: false },
    initial: "running",
    states: {
      running: {
        entry: assign({ paused: false }),
        on: {
          "sim:pause:toggle": {
            target: "paused",
          },
        },
      },
      paused: {
        entry: assign({ paused: true }),
        on: {
          "sim:pause:toggle": {
            target: "running",
          },
        },
      },
    },
  }
);
