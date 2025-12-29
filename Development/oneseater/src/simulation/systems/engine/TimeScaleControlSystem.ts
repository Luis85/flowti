import { createSystem, ReadEvents, WriteEvents, WriteResource } from "sim-ecs";
import { SetTimeScaleEvent } from "src/eventsystem/engine/SetTimeScaleEvent";
import { TimeScaleChangedEvent } from "src/eventsystem/engine/TimeScaleChangedEvent";
import { TimeScaleStore } from "src/simulation/stores/TimeScaleStore";

export const TimeScaleControlSystem = createSystem({
	input: ReadEvents(SetTimeScaleEvent),
	timeScale: WriteResource(TimeScaleStore),
	out: WriteEvents(TimeScaleChangedEvent),
})
	.withName("TimeScaleControlSystem")
	.withRunFunction(async ({ input, timeScale, out }) => {
		let last: SetTimeScaleEvent | undefined;

		for (const evt of input.iter()) last = evt;
		if (!last) return;

		timeScale.set(last.multiplier);

		void out.publish(new TimeScaleChangedEvent(timeScale.multiplier));
	})
	.build();
