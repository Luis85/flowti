import { describe, it, expect } from 'vitest';
import {
	createDemandTracker,
	recordConsumption,
	getDemandRate,
	type DemandTracker,
} from '../../../src/domain/systems/demand-tracker.js';

function emptyTracker(windowSize = 100): DemandTracker {
	return createDemandTracker(windowSize);
}

describe('DemandTracker', () => {
	it('returns 0 demand for unknown item', () => {
		const tracker = emptyTracker();
		expect(getDemandRate(tracker, 'bread', 50)).toBe(0);
	});

	it('records consumption and returns correct demand', () => {
		const tracker = emptyTracker();
		recordConsumption(tracker, 'bread', 1, 10);
		recordConsumption(tracker, 'bread', 2, 20);
		expect(getDemandRate(tracker, 'bread', 50)).toBe(3);
	});

	it('excludes events outside the window', () => {
		const tracker = emptyTracker(100);
		recordConsumption(tracker, 'bread', 1, 10);
		recordConsumption(tracker, 'bread', 1, 120);
		// At tick 150, window is [50, 150] — only tick 120 is in window
		expect(getDemandRate(tracker, 'bread', 150)).toBe(1);
	});

	it('prunes expired events on read', () => {
		const tracker = emptyTracker(100);
		recordConsumption(tracker, 'bread', 1, 10);
		recordConsumption(tracker, 'bread', 1, 20);
		recordConsumption(tracker, 'bread', 1, 130);
		getDemandRate(tracker, 'bread', 150);
		// After pruning, only tick 130 remains
		expect(tracker.events.get('bread')?.length).toBe(1);
	});

	it('tracks multiple items independently', () => {
		const tracker = emptyTracker();
		recordConsumption(tracker, 'bread', 3, 10);
		recordConsumption(tracker, 'wheat', 5, 10);
		expect(getDemandRate(tracker, 'bread', 50)).toBe(3);
		expect(getDemandRate(tracker, 'wheat', 50)).toBe(5);
	});

	it('handles window size of 0 — only current tick counts', () => {
		const tracker = emptyTracker(0);
		recordConsumption(tracker, 'bread', 1, 10);
		expect(getDemandRate(tracker, 'bread', 10)).toBe(1);
		expect(getDemandRate(tracker, 'bread', 11)).toBe(0);
	});
});
