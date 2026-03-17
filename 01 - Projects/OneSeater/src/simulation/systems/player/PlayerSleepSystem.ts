import { createSystem, ReadEvents, WriteEvents, WriteResource, ReadResource, Storage } from "sim-ecs";
import { GoToSleepEvent } from "src/eventsystem/player/GoToSleepEvent";
import { SleepFinishedEvent } from "src/eventsystem/player/SleepFinishedEvent";
import { SleepInterruptedEvent } from "src/eventsystem/player/SleepInterruptedEvent";
import { TaskFinishedEvent } from "src/eventsystem/tasks/TaskFinishedEvent";
import { GameSettingsStore } from "src/simulation/stores/GameSettingsStore";
import { PlayerEnergyStore } from "src/simulation/stores/PlayerEnergyStore";
import { SimulationStore } from "src/simulation/stores/SimulationStore";
import { TimeScaleStore } from "src/simulation/stores/TimeScaleStore";
import { MINUTE_MS } from "src/simulation/types";
import { clamp } from "src/simulation/utils";


const SLEEP_TARGET_NORMAL = 80;
const SLEEP_TARGET_EXHAUSTED = 70;
const SLEEP_TIMESCALE = 36000

const SLEEP_TUNING = {
	regenPerHourBase: 12,
	regenMinPerHour: 4,
	regenMaxPerHour: 20,

	wakeTarget: SLEEP_TARGET_NORMAL,
	rngBonuses: [0, 5, 10, 20] as const,
	rngWeights: [0.25, 0.35, 0.25, 0.15] as const,
	exhausted: {
		regenMultiplier: 0.8, // 20% schlechtere Regeneration
		rngWeights: [0.45, 0.35, 0.15, 0.05] as const, // mehr 0/5, weniger 10/20
	},
	normal: {
		regenMultiplier: 1.0,
		rngWeights: [0.25, 0.35, 0.25, 0.15] as const,
	},
	exhaustedStacks: {
		max: 5,
		addOnExhaustedSleep: 1,
		reduceOnNormalSleep: 1,

		// regen multiplier per stack (multiplicative, capped)
		regenMultPerStack: 0.92, // each stack = -8% regen
		regenMultMin: 0.65, // never worse than -35%

		// RNG penalty per stack: shift roll upward
		rngShiftPerStack: 0.06, // each stack pushes roll toward low bonus
		rngShiftMax: 0.25, // cap
	},
};

export const PlayerSleepSystem = createSystem({
	// inputs
	sleepInput: ReadEvents(GoToSleepEvent),
	interruptInput: ReadEvents(SleepInterruptedEvent),

	// outputs
	sleepFinished: WriteEvents(SleepFinishedEvent),
	taskFinished: WriteEvents(TaskFinishedEvent),

	// stores
	sim: WriteResource(SimulationStore),
	settings: ReadResource(GameSettingsStore),
	timeScale: WriteResource(TimeScaleStore),
	energy: WriteResource(PlayerEnergyStore),

	storage: Storage({
		sleptMs: 0,
		exhaustedSleep: false,
	}),
})
	.withName("PlayerSleepSystem")
	.withRunFunction(
		async ({
			sleepInput,
			interruptInput,
			sleepFinished,
			sim,
			settings,
			timeScale,
			energy,
			storage,
			taskFinished,
		}) => {
			if (sim.paused) return;
			/* ----------------------------------
			 * 1) Handle sleep start
			 * ---------------------------------- */
			let sleepEvt: GoToSleepEvent | undefined;
			for (const e of sleepInput.iter()) sleepEvt = e;

			if (sleepEvt && sim.player.status !== "sleeping") {
				sim.player.status = "sleeping";
				sim.player.sleepStartedAt = sim.simNowMs;
				storage.sleptMs = 0;
				timeScale.set(SLEEP_TIMESCALE);

				energy.sleepTarget =
					sleepEvt.reason === "exhausted"
						? SLEEP_TARGET_EXHAUSTED
						: SLEEP_TARGET_NORMAL;
				energy.sleepCompleted = false;

				const isExhausted = sleepEvt.reason === "exhausted";

				if (isExhausted) {
					energy.exhaustedSleepStacks = Math.min(
						SLEEP_TUNING.exhaustedStacks.max,
						energy.exhaustedSleepStacks +
							SLEEP_TUNING.exhaustedStacks.addOnExhaustedSleep
					);

				// we will award some xp if the player went to bed on it's own like a big boy he is
				} else {
					// normal sleep reduces stacks (recovery)
					energy.exhaustedSleepStacks = Math.max(
						0,
						energy.exhaustedSleepStacks -
							SLEEP_TUNING.exhaustedStacks.reduceOnNormalSleep
					);
					void taskFinished.publish(
						new TaskFinishedEvent(
							'sleep-' + Date.now(),
							"player:sleep",
							"system",
							0, // energyCost
							0, // timeCostMinutes
							3, // xpGain
						)
					);
				}

				// remember for this sleep run
				storage.exhaustedSleep = isExhausted;
			}

			/* ----------------------------------
			 * 2) Handle sleep interrupt
			 * ---------------------------------- */
			let interrupt: SleepInterruptedEvent | undefined;
			for (const e of interruptInput.iter()) interrupt = e;

			if (interrupt && sim.player.status === "sleeping") {
				timeScale.set(1);
				sim.player.status = "active";
				storage.sleptMs = 0;
				return;
			}

			/* ----------------------------------
			 * 3) If not sleeping → nothing to do
			 * ---------------------------------- */
			if (sim.player.status !== "sleeping") return;

			const simDt = sim.lastSimDtMs ?? 0;
			if (simDt <= 0) return;

			storage.sleptMs += simDt;

			/* ----------------------------------
			 * 4) Energy regeneration
			 * ---------------------------------- */
			const current = energy.energy;
			const hours = simDt / (60 * MINUTE_MS);

			const exhaustionFactor = clamp(
				(energy.sleepTarget - current) / energy.sleepTarget,
				0,
				1
			);

			let regenPerHour =
				SLEEP_TUNING.regenPerHourBase * (0.5 + exhaustionFactor);
			const mode = storage.exhaustedSleep
				? SLEEP_TUNING.exhausted
				: SLEEP_TUNING.normal;
			regenPerHour *= mode.regenMultiplier;
			const stacks = clamp(
				energy.exhaustedSleepStacks ?? 0,
				0,
				SLEEP_TUNING.exhaustedStacks.max
			);

			let stackRegenMult = Math.pow(
				SLEEP_TUNING.exhaustedStacks.regenMultPerStack,
				stacks
			);
			stackRegenMult = Math.max(
				stackRegenMult,
				SLEEP_TUNING.exhaustedStacks.regenMultMin
			);

			regenPerHour *= stackRegenMult;
			regenPerHour = clamp(
				regenPerHour,
				SLEEP_TUNING.regenMinPerHour,
				SLEEP_TUNING.regenMaxPerHour
			);

			energy.energy = clamp(current + regenPerHour * hours, 0, 100);
			sim.player.stats.energy = energy.energy;

			/* ----------------------------------
			 * 5) Wake-up condition
			 * ---------------------------------- */
			if (energy.energy >= energy.sleepTarget && !energy.sleepCompleted) {
				const before = energy.energy;

				const mode = storage.exhaustedSleep
					? SLEEP_TUNING.exhausted
					: SLEEP_TUNING.normal;

				const stacks = clamp(
					energy.exhaustedSleepStacks ?? 0,
					0,
					SLEEP_TUNING.exhaustedStacks.max
				);
				const shift = clamp(
					stacks * SLEEP_TUNING.exhaustedStacks.rngShiftPerStack,
					0,
					SLEEP_TUNING.exhaustedStacks.rngShiftMax
				);

				// push roll towards 0-bonus side by compressing high values
				const r = clamp(Math.random() * (1 - shift), 0, 0.999999);

				const bonus = weightedPick(
					SLEEP_TUNING.rngBonuses,
					mode.rngWeights,
					r
				);

				energy.energy = clamp(energy.energy + bonus, 0, 100);
				energy.sleepCompleted = true;
				sim.player.stats.energy = energy.energy;

				sim.player.status = "active";

				// Slow down after sleep to give the player opportunity to catch up
				if(settings.slowAfterSleep) timeScale.set(1);
				
				void sleepFinished.publish(
					new SleepFinishedEvent(
						before,
						energy.energy,
						Math.floor(storage.sleptMs / MINUTE_MS)
					)
				);

				storage.sleptMs = 0;
				storage.exhaustedSleep = false;
				if (energy.energy >= 95) {
					energy.exhaustedSleepStacks = Math.max(
						0,
						energy.exhaustedSleepStacks - 1
					);
				}

				sim.player.stats.exhaustedSleepStacks = energy.exhaustedSleepStacks;
			}
		}
	)
	.build();

// RNG helper
function weightedPick<T>(
	values: readonly T[],
	weights: readonly number[],
	r: number
): T {
	const total = weights.reduce((a, b) => a + Math.max(0, b), 0);
	let x = r * total;
	for (let i = 0; i < values.length; i++) {
		x -= Math.max(0, weights[i]);
		if (x <= 0) return values[i];
	}
	return values[values.length - 1];
}
