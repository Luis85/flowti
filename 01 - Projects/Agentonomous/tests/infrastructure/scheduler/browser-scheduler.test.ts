import { describe, expect, it, vi } from 'vitest';
import { BrowserScheduler } from '../../../src/infrastructure/scheduler/browser-scheduler.js';

describe('BrowserScheduler', () => {
	it('every runs the function at each interval and stops on cancel', () => {
		vi.useFakeTimers();
		const s = new BrowserScheduler();
		const fn = vi.fn();
		s.every('tick', 100, fn);
		vi.advanceTimersByTime(250);
		expect(fn).toHaveBeenCalledTimes(2);
		s.cancel('tick');
		vi.advanceTimersByTime(300);
		expect(fn).toHaveBeenCalledTimes(2);
		vi.useRealTimers();
	});

	it('once runs the function once after the delay', () => {
		vi.useFakeTimers();
		const s = new BrowserScheduler();
		const fn = vi.fn();
		s.once('one', 500, fn);
		vi.advanceTimersByTime(499);
		expect(fn).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(fn).toHaveBeenCalledOnce();
		vi.useRealTimers();
	});

	it('reusing an id cancels the previous registration', () => {
		vi.useFakeTimers();
		const s = new BrowserScheduler();
		const first = vi.fn();
		const second = vi.fn();
		s.every('tick', 100, first);
		s.every('tick', 100, second);
		vi.advanceTimersByTime(150);
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledOnce();
		s.cancelAll();
		vi.useRealTimers();
	});

	it('cancelAll cancels every scheduled task', () => {
		vi.useFakeTimers();
		const s = new BrowserScheduler();
		const a = vi.fn();
		const b = vi.fn();
		s.every('a', 100, a);
		s.once('b', 50, b);
		s.cancelAll();
		vi.advanceTimersByTime(500);
		expect(a).not.toHaveBeenCalled();
		expect(b).not.toHaveBeenCalled();
		vi.useRealTimers();
	});

	it('cancel on unknown id is a no-op', () => {
		const s = new BrowserScheduler();
		expect(() => { s.cancel('nope'); }).not.toThrow();
	});
});
