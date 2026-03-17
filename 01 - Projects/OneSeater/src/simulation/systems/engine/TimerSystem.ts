import {
	createSystem,
	ReadResource,
	WriteResource,
	ReadEvents,
	WriteEvents,
} from "sim-ecs";
import { AddTimerEvent } from "src/eventsystem/timer/AddTimerEvent";
import { RemoveTimerEvent } from "src/eventsystem/timer/RemoveTimerEvent";
import { TimerExpiredEvent } from "src/eventsystem/timer/TimerExpiredEvent";
import { SimulationStore } from "src/simulation/stores/SimulationStore";
import { TimerStore } from "src/simulation/stores/TimerStore";
import { Timer } from "src/simulation/timer/types";

let timerIdCounter = 0;
function generateTimerId(): string {
	return `timer_${Date.now()}_${++timerIdCounter}`;
}

export const TimerSystem = createSystem({
	sim: ReadResource(SimulationStore),
	timerStore: WriteResource(TimerStore),

	// Eingehende Events
	addTimerEvents: ReadEvents(AddTimerEvent),
	removeTimerEvents: ReadEvents(RemoveTimerEvent),

	// Ausgehende Events
	expiredEvents: WriteEvents(TimerExpiredEvent),
})
	.withName("TimerSystem")
	.withRunFunction(
		({
			sim,
			timerStore,
			addTimerEvents,
			removeTimerEvents,
			expiredEvents,
		}) => {
			const nowMs = sim.simNowMs ?? 0;

			if(sim.paused) return

			if(sim.debug) console.log('TimerStore', timerStore)

			// === Neue Timer hinzufügen ===
			for (const event of addTimerEvents.iter()) {
				const opts = event.options;

				const timer: Timer = {
					id: opts.id ?? generateTimerId(),
					expiresAt: nowMs + opts.delayMs,
					trigger: opts.trigger,
					repeat: opts.repeat
						? {
								intervalMs: opts.repeat.intervalMs,
								maxRepeats: opts.repeat.maxRepeats,
								currentRepeat: 0,
						}
						: undefined,
					createdAt: nowMs,
					source: opts.source,
				};

				// Überschreibe wenn ID bereits existiert
				timerStore.add(timer);
				console.log('Timer Added', timer)
			}

			// === Timer entfernen ===
			for (const event of removeTimerEvents.iter()) {
				console.log('Timer Removed', event)
				timerStore.remove(event.timerId);
			}

			// === Abgelaufene Timer verarbeiten ===
			const expired = timerStore.getExpired(nowMs);

			for (const timer of expired) {
				// Event auslösen
				console.log('Timer Expired', timer)
				expiredEvents.publish(new TimerExpiredEvent(timer));

				// Repeat oder entfernen?
				if (timer.repeat) {
					timer.repeat.currentRepeat++;

					const maxReached =
						timer.repeat.maxRepeats != null &&
						timer.repeat.currentRepeat >= timer.repeat.maxRepeats;

					if (maxReached) {
						timerStore.remove(timer.id);
					} else {
						// Nächsten Ablauf setzen
						timer.expiresAt = nowMs + timer.repeat.intervalMs;
					}
				} else {
					timerStore.remove(timer.id);
				}
			}
		}
	)
	.build();
