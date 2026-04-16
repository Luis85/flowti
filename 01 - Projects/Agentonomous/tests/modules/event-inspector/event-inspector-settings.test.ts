import { describe, expect, it } from 'vitest';
import {
	EVENT_INSPECTOR_DEFAULTS,
	validateEventInspectorSettings,
} from '../../../src/modules/event-inspector/event-inspector-settings.js';

describe('validateEventInspectorSettings', () => {
	it('returns err for non-object input', () => {
		expect(validateEventInspectorSettings('bad').kind).toBe('err');
		expect(validateEventInspectorSettings(null).kind).toBe('err');
		expect(validateEventInspectorSettings([]).kind).toBe('err');
	});

	it('returns err when enabled is not boolean', () => {
		expect(validateEventInspectorSettings({ enabled: 'yes', maxEvents: 10, filterChannels: [] }).kind).toBe('err');
	});

	it('returns err when maxEvents is not a positive number', () => {
		expect(validateEventInspectorSettings({ enabled: true, maxEvents: 0, filterChannels: [] }).kind).toBe('err');
		expect(validateEventInspectorSettings({ enabled: true, maxEvents: 'big', filterChannels: [] }).kind).toBe('err');
	});

	it('returns err when filterChannels is not an array', () => {
		expect(validateEventInspectorSettings({ enabled: true, maxEvents: 10, filterChannels: 'all' }).kind).toBe('err');
	});

	it('returns ok for valid settings', () => {
		const result = validateEventInspectorSettings({ enabled: false, maxEvents: 200, filterChannels: ['core', 'ui'] });
		expect(result.kind).toBe('ok');
		if (result.kind === 'ok') {
			expect(result.value.enabled).toBe(false);
			expect(result.value.maxEvents).toBe(200);
			expect(result.value.filterChannels).toEqual(['core', 'ui']);
		}
	});

	it('filters non-string entries from filterChannels', () => {
		const result = validateEventInspectorSettings({ enabled: true, maxEvents: 50, filterChannels: ['a', 1, null, 'b'] });
		expect(result.kind).toBe('ok');
		if (result.kind === 'ok') {
			expect(result.value.filterChannels).toEqual(['a', 'b']);
		}
	});
});

describe('EVENT_INSPECTOR_DEFAULTS', () => {
	it('has enabled true', () => {
		expect(EVENT_INSPECTOR_DEFAULTS.enabled).toBe(true);
	});

	it('has maxEvents 500', () => {
		expect(EVENT_INSPECTOR_DEFAULTS.maxEvents).toBe(500);
	});
});
