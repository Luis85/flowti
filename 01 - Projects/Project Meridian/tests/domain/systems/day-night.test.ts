import { describe, it, expect } from 'vitest';
import { advanceTime } from '../../../src/domain/systems/day-night.js';

const defaultConfig = {
	ticks_per_day: 480,
	day_night: {
		dawn: { start: 0, end: 59 },
		day: { start: 60, end: 299 },
		dusk: { start: 300, end: 359 },
		night: { start: 360, end: 479 },
	},
};

describe('advanceTime', () => {
	it('returns dawn at tick 0', () => {
		const result = advanceTime(0, defaultConfig);
		expect(result.state.phase).toBe('dawn');
		expect(result.state.tickInCycle).toBe(0);
		expect(result.state.dayCount).toBe(0);
	});

	it('returns day at tick 60', () => {
		expect(advanceTime(60, defaultConfig).state.phase).toBe('day');
	});

	it('returns dusk at tick 300', () => {
		expect(advanceTime(300, defaultConfig).state.phase).toBe('dusk');
	});

	it('returns night at tick 360', () => {
		expect(advanceTime(360, defaultConfig).state.phase).toBe('night');
	});

	it('wraps back to dawn on new cycle', () => {
		const result = advanceTime(480, defaultConfig);
		expect(result.state.phase).toBe('dawn');
		expect(result.state.tickInCycle).toBe(0);
		expect(result.state.dayCount).toBe(1);
	});

	it('increments dayCount each full cycle', () => {
		expect(advanceTime(960, defaultConfig).state.dayCount).toBe(2);
		expect(advanceTime(1440, defaultConfig).state.dayCount).toBe(3);
	});

	it('phaseChanged is true on dawn→day transition', () => {
		const atDawn = advanceTime(59, defaultConfig);
		const atDay = advanceTime(60, defaultConfig);
		expect(atDawn.state.phase).toBe('dawn');
		expect(atDay.state.phase).toBe('day');
		expect(atDay.phaseChanged).toBe(true);
		expect(atDay.previousPhase).toBe('dawn');
	});

	it('phaseChanged is false within same phase', () => {
		expect(advanceTime(100, defaultConfig).phaseChanged).toBe(false);
	});

	it('falls back to night if no phase matches', () => {
		const gapConfig = {
			ticks_per_day: 100,
			day_night: {
				dawn: { start: 0, end: 10 },
				day: { start: 20, end: 50 },
				dusk: { start: 60, end: 70 },
				night: { start: 80, end: 99 },
			},
		};
		expect(advanceTime(15, gapConfig).state.phase).toBe('night');
	});
});
