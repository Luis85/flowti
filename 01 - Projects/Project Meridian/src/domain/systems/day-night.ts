import type { TimeState } from '../core/component-data.js';

export interface DayNightConfig {
	ticks_per_day: number;
	day_night: {
		dawn: { start: number; end: number };
		day: { start: number; end: number };
		dusk: { start: number; end: number };
		night: { start: number; end: number };
	};
}

export interface DayNightResult {
	state: TimeState;
	phaseChanged: boolean;
	previousPhase: TimeState['phase'];
}

const PHASE_ORDER: readonly TimeState['phase'][] = ['dawn', 'day', 'dusk', 'night'];

function resolvePhase(tickInCycle: number, phases: DayNightConfig['day_night']): TimeState['phase'] {
	for (const phase of PHASE_ORDER) {
		const range = phases[phase];
		if (tickInCycle >= range.start && tickInCycle <= range.end) {
			return phase;
		}
	}
	return 'night';
}

function resolvePreviousPhase(tickInCycle: number, ticksPerDay: number, phases: DayNightConfig['day_night']): TimeState['phase'] {
	const prevTick = tickInCycle === 0 ? ticksPerDay - 1 : tickInCycle - 1;
	return resolvePhase(prevTick, phases);
}

export function advanceTime(
	currentTick: number,
	config: DayNightConfig,
): DayNightResult {
	const tickInCycle = currentTick % config.ticks_per_day;
	const dayCount = Math.floor(currentTick / config.ticks_per_day);
	const phase = resolvePhase(tickInCycle, config.day_night);
	const previousPhase = resolvePreviousPhase(tickInCycle, config.ticks_per_day, config.day_night);
	const phaseChanged = phase !== previousPhase;

	return {
		state: { phase, tickInCycle, dayCount, dayBoundaryThisTick: false },
		phaseChanged,
		previousPhase,
	};
}
