import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { formatRelativeDate } from '../../../../src/ui/pages/make/format-relative-date.js';

describe('formatRelativeDate', () => {
	const NOW = new Date('2026-04-19T12:00:00.000Z');

	beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
	afterAll(() => { vi.useRealTimers(); });

	it('returns "just now" for <60s in the past', () => {
		expect(formatRelativeDate('2026-04-19T11:59:30.000Z')).toBe('just now');
	});

	it('returns Nm ago for 1m–59m in the past', () => {
		expect(formatRelativeDate('2026-04-19T11:55:00.000Z')).toBe('5m ago');
		expect(formatRelativeDate('2026-04-19T11:01:00.000Z')).toBe('59m ago');
	});

	it('returns Nh ago for 1h–23h in the past', () => {
		expect(formatRelativeDate('2026-04-19T10:00:00.000Z')).toBe('2h ago');
		expect(formatRelativeDate('2026-04-18T13:00:00.000Z')).toBe('23h ago');
	});

	it('returns Nd ago for 1d–6d in the past', () => {
		expect(formatRelativeDate('2026-04-18T12:00:00.000Z')).toBe('1d ago');
		expect(formatRelativeDate('2026-04-13T12:00:00.000Z')).toBe('6d ago');
	});

	it('returns Nw ago for 7d–28d in the past (1w–4w)', () => {
		expect(formatRelativeDate('2026-04-12T12:00:00.000Z')).toBe('1w ago');
		expect(formatRelativeDate('2026-03-22T12:00:00.000Z')).toBe('4w ago');
	});

	it('falls back to ISO date slice for >4w in the past', () => {
		expect(formatRelativeDate('2026-03-01T12:00:00.000Z')).toBe('2026-03-01');
	});

	it('returns "just now" for any future timestamp (clock skew guard)', () => {
		expect(formatRelativeDate('2026-04-19T12:00:30.000Z')).toBe('just now');
	});

	it('returns empty string for invalid input (non-ISO, empty string)', () => {
		expect(formatRelativeDate('not a date')).toBe('');
		expect(formatRelativeDate('')).toBe('');
	});
});
