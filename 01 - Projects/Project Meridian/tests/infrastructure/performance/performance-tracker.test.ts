import { describe, it, expect } from 'vitest';
import { createPerformanceTracker } from '../../../src/infrastructure/performance/performance-tracker.js';

describe('PerformanceTracker', () => {
	it('starts disabled by default', () => {
		const tracker = createPerformanceTracker();
		expect(tracker.enabled).toBe(false);
	});

	it('does nothing when disabled', () => {
		const tracker = createPerformanceTracker();
		tracker.startSystem('TestSystem');
		tracker.endSystem();
		const result = tracker.completeTick(1);
		expect(result).toBeNull();
	});

	it('tracks system timing when enabled', () => {
		const tracker = createPerformanceTracker();
		tracker.setEnabled(true);

		tracker.startSystem('SystemA');
		// Simulate some work
		tracker.endSystem();

		tracker.startSystem('SystemB');
		tracker.endSystem();

		const result = tracker.completeTick(1);
		expect(result).not.toBeNull();
		if (result !== null) {
			expect(result.tick).toBe(1);
			expect(result.systems).toHaveLength(2);
			expect(result.systems[0]?.name).toBe('SystemA');
			expect(result.systems[1]?.name).toBe('SystemB');
			expect(result.totalMs).toBeGreaterThanOrEqual(0);
		}
	});

	it('maintains history up to limit', () => {
		const tracker = createPerformanceTracker();
		tracker.setEnabled(true);

		for (let i = 0; i < 5; i++) {
			tracker.startSystem('Sys');
			tracker.endSystem();
			tracker.completeTick(i);
		}

		expect(tracker.history()).toHaveLength(5);
		expect(tracker.history(2)).toHaveLength(2);
	});

	it('calculates system averages', () => {
		const tracker = createPerformanceTracker();
		tracker.setEnabled(true);

		for (let i = 0; i < 3; i++) {
			tracker.startSystem('Sys');
			tracker.endSystem();
			tracker.completeTick(i);
		}

		const avgs = tracker.averages(3);
		expect(avgs.has('Sys')).toBe(true);
		const avg = avgs.get('Sys');
		expect(avg).toBeGreaterThanOrEqual(0);
	});

	it('resets state after completeTick even if endSystem was not called', () => {
		const tracker = createPerformanceTracker();
		tracker.setEnabled(true);

		// Simulate a system that errors before endSystem is called
		tracker.startSystem('CrashingSystem');
		// endSystem() NOT called — simulating a throw
		tracker.completeTick(1);

		// Next tick should still capture tickStart correctly
		tracker.startSystem('HealthySystem');
		tracker.endSystem();
		const result = tracker.completeTick(2);

		expect(result).not.toBeNull();
		if (result !== null) {
			expect(result.tick).toBe(2);
			// totalMs should be small (just the HealthySystem timing), not inflated
			// by the gap between ticks
			expect(result.totalMs).toBeLessThan(100);
			expect(result.systems).toHaveLength(1);
			expect(result.systems[0]?.name).toBe('HealthySystem');
		}
	});

	it('can be toggled on and off', () => {
		const tracker = createPerformanceTracker();
		tracker.setEnabled(true);
		expect(tracker.enabled).toBe(true);

		tracker.startSystem('Sys');
		tracker.endSystem();
		const result1 = tracker.completeTick(1);
		expect(result1).not.toBeNull();

		tracker.setEnabled(false);
		expect(tracker.enabled).toBe(false);

		tracker.startSystem('Sys');
		tracker.endSystem();
		const result2 = tracker.completeTick(2);
		expect(result2).toBeNull();
	});
});
