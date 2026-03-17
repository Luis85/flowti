import { createSystem, WriteResource, WriteEvents, Storage } from "sim-ecs";
import { GoToSleepEvent } from "src/eventsystem/player/GoToSleepEvent";
import { PlayerEnergyStore } from "src/simulation/stores/PlayerEnergyStore";
import { SimulationStore } from "src/simulation/stores/SimulationStore";
import { clamp } from "src/simulation/utils";


const EXHAUSTION_TRIGGER_MINUTES = 5;
const ENERGY_MIN = 0;
const ENERGY_MAX = 100;
const MINUTE_MS = 60_000;

const DEFAULT_TUNING = {
	baselineDrainPerDay: 16,
	morningMultiplier: 0.9,
	workMultiplier: 1.0,
	nightMultiplier: 1.45,
	wrapupMultiplier: 1.15,
	sessionMultiplier: 1.05,
	minPerMinuteDrain: 0.0005,
	maxPerMinuteDrain: 0.05,
	enduranceMitigationPerPoint: 0.003,
	lowEnergyThreshold: 60, // ab hier beginnt Zusatz-Fatigue
	lowEnergyMaxBoost: 1.6, // maximal 60% mehr Drain bei 0 Energie
	lowEnergyCurve: 1.5, // >1 macht es steiler Richtung 0
};

export const PlayerEnergySystem = createSystem({
	sim: WriteResource(SimulationStore),
	energy: WriteResource(PlayerEnergyStore),
	sleepEvents: WriteEvents(GoToSleepEvent),

	storage: Storage({
		exhaustedMs: 0,
		sleepTriggered: false,
	}),
})
	.withName("PlayerEnergySystem")
	.withRunFunction(({ sim, energy, sleepEvents, storage }) => {
		if (sim.paused) return;

		const simDt = sim.lastSimDtMs ?? 0;
		if (simDt <= 0) return;

		const endurance = clamp(energy.endurance ?? 0, 0, 200);
		const fatigueMult = Math.max(0, energy.fatigueMult ?? 1.0);

		const perMinuteBase = DEFAULT_TUNING.baselineDrainPerDay / 1440;
		const minutes = simDt / MINUTE_MS;

		let drainPerMinute = perMinuteBase * phaseMultiplier(sim.phase);
		drainPerMinute *= fatigueMult;

		// --- low-energy acceleration (soft, continuous) ---
		const thr = DEFAULT_TUNING.lowEnergyThreshold;
		if (energy.energy < thr) {
			// x: 0 at threshold, 1 at 0 energy
			const x = clamp((thr - energy.energy) / thr, 0, 1);
			// curve: steeper near 0
			const shaped = Math.pow(x, DEFAULT_TUNING.lowEnergyCurve);
			// factor: 1 .. maxBoost
			const boost = 1 + shaped * (DEFAULT_TUNING.lowEnergyMaxBoost - 1);
			drainPerMinute *= boost;
		}

		const mitigation = clamp(
			1 - endurance * DEFAULT_TUNING.enduranceMitigationPerPoint,
			0.3,
			1.0
		);
		drainPerMinute *= mitigation;

		drainPerMinute = clamp(
			drainPerMinute,
			DEFAULT_TUNING.minPerMinuteDrain,
			DEFAULT_TUNING.maxPerMinuteDrain
		);

		const drain = drainPerMinute * minutes;
		energy.energy = clamp(energy.energy - drain, ENERGY_MIN, ENERGY_MAX);

		// --- exhaustion tracking ---
		if (energy.energy <= 0) {
			storage.exhaustedMs += simDt;

			if (
				!storage.sleepTriggered &&
				storage.exhaustedMs >= EXHAUSTION_TRIGGER_MINUTES * MINUTE_MS
			) {
				storage.sleepTriggered = true;
				sleepEvents.publish(new GoToSleepEvent("exhausted"));
			}
		} else {
			// reset if player recovers
			storage.exhaustedMs = 0;
			storage.sleepTriggered = false;
		}

		// update the sim state
		sim.player.stats.energy = energy.energy;
	})
	.build();


function phaseMultiplier(
	phase: SimulationStore["phase"],
	t = DEFAULT_TUNING
): number {
	switch (phase) {
		case "morning":
			return t.morningMultiplier;
		case "work":
			return t.workMultiplier;
		case "session":
			return t.sessionMultiplier;
		case "wrapup":
			return t.wrapupMultiplier;
		case "night":
		default:
			return t.nightMultiplier;
	}
}
