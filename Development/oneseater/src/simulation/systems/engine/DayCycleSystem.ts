import {
	createSystem,
	ReadResource,
	WriteEvents,
	WriteResource,
} from "sim-ecs";
import { DayPhaseChangedEvent } from "src/eventsystem/engine/DayPhaseChangedEvent";
import { SimTimeAdvancedEvent } from "src/eventsystem/engine/SimTimeAdvancedEvent";
import { SimulationStore } from "src/simulation/stores/SimulationStore";
import { TimeScaleStore } from "src/simulation/stores/TimeScaleStore";
import { DayPhase, DAY_MS, MINUTE_MS } from "src/simulation/types";

const PHASE_BOUNDARIES = [
	{ minute: 0, phase: "night" as DayPhase },
	{ minute: 360, phase: "morning" as DayPhase },
	{ minute: 540, phase: "work" as DayPhase },
	{ minute: 1020, phase: "session" as DayPhase },
	{ minute: 1200, phase: "wrapup" as DayPhase },
	{ minute: 1440, phase: "night" as DayPhase }, // day rollover
];

function phaseAtMinute(minute: number): DayPhase {
	if (minute < 360) return "night";
	if (minute < 540) return "morning";
	if (minute < 1020) return "work";
	if (minute < 1200) return "session";
	return "wrapup";
}

function boundariesBetween(prevMinute: number, nextMinute: number): number[] {
	// returns boundary minutes strictly > prevMinute and <= nextMinute
	const out: number[] = [];
	for (const b of PHASE_BOUNDARIES) {
		if (b.minute > prevMinute && b.minute <= nextMinute) out.push(b.minute);
	}
	return out;
}

export const DayCycleSystem = createSystem({
	simAdvanced: WriteEvents(SimTimeAdvancedEvent),
	dayPhaseChanged: WriteEvents(DayPhaseChangedEvent),
	sim: WriteResource(SimulationStore),
	timeScale: ReadResource(TimeScaleStore),
})
	.withRunFunction(
		async ({ simAdvanced, dayPhaseChanged, sim, timeScale }) => {
			const realDt = sim.deltaTime ?? 0;
			if (realDt <= 0) return;

			const simDt = realDt * (timeScale.multiplier ?? 1);
			if (simDt <= 0) {
				return;
			}
			sim.lastSimDtMs = simDt;

			if (sim.paused || (timeScale.multiplier ?? 1) === 0) {
				sim.lastSimDtMs = 0;
				return;
			}

			const prevNow = sim.simNowMs;
			const prevMinute = sim.minuteOfDay;
			const prevPhase = sim.phase;
			const prevDay = sim.dayIndex;
			const nextNow = prevNow + simDt;
			sim.simNowMs = nextNow;

			const nextDay = Math.floor(nextNow / DAY_MS);
			const nextMinute = Math.floor((nextNow % DAY_MS) / MINUTE_MS);

			sim.dayIndex = nextDay;
			sim.minuteOfDay = nextMinute;

			await simAdvanced.publish(
				new SimTimeAdvancedEvent(
					realDt,
					simDt,
					timeScale.multiplier,
					nextNow,
					nextDay,
					sim.minuteOfDay
				)
			);

			if (nextDay === prevDay) {
				// same day: walk boundaries
				const crossed = boundariesBetween(prevMinute, nextMinute);
				let from = prevPhase;

				for (const boundaryMinute of crossed) {
					const to = phaseAtMinute(boundaryMinute);
					if (to !== from) {
						sim.phase = to;
						void dayPhaseChanged.publish(
							new DayPhaseChangedEvent(nextDay, from, to)
						);
						from = to;
					}
				}

				// ensure final phase matches
				const finalPhase = phaseAtMinute(nextMinute);
				if (finalPhase !== sim.phase) {
					const fromPhase = sim.phase;
					sim.phase = finalPhase;
					void dayPhaseChanged.publish(
						new DayPhaseChangedEvent(nextDay, fromPhase, finalPhase)
					);
				}
			} else {
				// day rollover: you can do a simple approach:
				// 1) emit remaining boundaries to 1440 on prev day
				const crossedEnd = boundariesBetween(prevMinute, 1440);
				let from = prevPhase;
				for (const boundaryMinute of crossedEnd) {
					const to = phaseAtMinute(
						boundaryMinute === 1440 ? 0 : boundaryMinute
					);
					if (to !== from) {
						void dayPhaseChanged.publish(
							new DayPhaseChangedEvent(prevDay, from, to)
						);
						from = to;
					}
				}

				// 2) at new day start, phase becomes phaseAtMinute(nextMinute)
				const startPhase = phaseAtMinute(nextMinute);
				sim.phase = startPhase;
				void dayPhaseChanged.publish(
					new DayPhaseChangedEvent(nextDay, "night", startPhase)
				);
			}
		}
	)
	.build();
