import { describe, expect, it } from 'vitest';
import { summarizeEnvelope, formatEventTime } from '../../../src/domain/shared/event-summary.js';
import type { EventEnvelope } from '../../../src/domain/shared/event-bus.js';

function envelope(channel: string, payload: unknown): EventEnvelope {
	return {
		channel: channel as never,
		payload: payload as never,
		traceId: 'trace-1',
		eventId: 'evt-1',
		timestamp: 0,
	};
}

describe('summarizeEnvelope', () => {
	it('prefers message over other keys', () => {
		expect(summarizeEnvelope(envelope('log', { message: 'hello', level: 'info' }))).toBe('hello');
	});

	it('falls back to action when message is absent', () => {
		expect(summarizeEnvelope(envelope('health', { action: 'health-check' }))).toBe('health-check');
	});

	it('uses phase for core events', () => {
		expect(summarizeEnvelope(envelope('core', { phase: 'ready' }))).toBe('ready');
	});

	it('uses level when only level is present', () => {
		expect(summarizeEnvelope(envelope('x', { level: 'warn' }))).toBe('warn');
	});

	it('falls back to any string value', () => {
		expect(summarizeEnvelope(envelope('x', { foo: 42, bar: 'hi' }))).toBe('hi');
	});

	it('uses channel when payload has no string fields', () => {
		expect(summarizeEnvelope(envelope('x', { n: 42, b: true }))).toBe('x');
	});

	it('uses channel when payload is not an object', () => {
		expect(summarizeEnvelope(envelope('x', null))).toBe('x');
		expect(summarizeEnvelope(envelope('x', 'raw-string'))).toBe('x');
	});

	it('ignores empty string values', () => {
		expect(summarizeEnvelope(envelope('x', { message: '', action: 'go' }))).toBe('go');
	});
});

describe('formatEventTime', () => {
	it('pads all fields', () => {
		const fixed = new Date(2026, 0, 1, 2, 3, 4, 56).getTime();
		expect(formatEventTime(fixed)).toBe('02:03:04.056');
	});

	it('renders milliseconds to 3 digits', () => {
		const fixed = new Date(2026, 0, 1, 10, 20, 30, 5).getTime();
		expect(formatEventTime(fixed)).toBe('10:20:30.005');
	});
});
