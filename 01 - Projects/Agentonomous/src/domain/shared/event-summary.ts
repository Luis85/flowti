import type { EventEnvelope } from './event-bus.js';

const SUMMARY_KEYS = ['message', 'action', 'phase', 'level', 'code', 'trigger', 'type'] as const;

/**
 * Extract a short human-readable summary from any event envelope.
 *
 * Tries known summary fields in priority order; falls back to the first
 * string value in the payload, then to the channel name itself.  Payloads
 * are diverse across channels, so this heuristic lets the Inspector render
 * something meaningful without knowing every event type.
 */
export function summarizeEnvelope(envelope: EventEnvelope): string {
	const payload: unknown = envelope.payload;
	if (typeof payload !== 'object' || payload === null) {
		return String(envelope.channel);
	}

	const record = payload as Record<string, unknown>;

	for (const key of SUMMARY_KEYS) {
		const value = record[key];
		if (typeof value === 'string' && value.length > 0) return value;
	}

	for (const value of Object.values(record)) {
		if (typeof value === 'string' && value.length > 0) return value;
	}

	return String(envelope.channel);
}

/**
 * Format a timestamp as HH:MM:SS.mmm for dense event-log rendering.
 */
export function formatEventTime(timestamp: number): string {
	const d = new Date(timestamp);
	const pad = (n: number, width = 2): string => String(n).padStart(width, '0');
	return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}
