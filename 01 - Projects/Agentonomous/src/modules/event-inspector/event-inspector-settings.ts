import { ok, err, type Result } from '../../domain/shared/result.js';

export type EventInspectorSettings = {
	readonly enabled: boolean;
	readonly maxEvents: number;
	readonly filterChannels: readonly string[];
};

export const EVENT_INSPECTOR_DEFAULTS: EventInspectorSettings = {
	enabled: true,
	maxEvents: 500,
	filterChannels: [],
};

export function validateEventInspectorSettings(raw: unknown): Result<EventInspectorSettings, string> {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return err('event-inspector settings must be an object');
	}
	const { enabled, maxEvents, filterChannels } = raw as Record<string, unknown>;
	if (typeof enabled !== 'boolean') return err('enabled must be boolean');
	if (typeof maxEvents !== 'number' || maxEvents < 1) return err('maxEvents must be a positive number');
	if (!Array.isArray(filterChannels)) return err('filterChannels must be an array');
	return ok({ enabled, maxEvents, filterChannels: filterChannels.filter((c): c is string => typeof c === 'string') });
}
