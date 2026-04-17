import { defineModule } from '../../domain/shared/module.js';
import { EVENT_INSPECTOR_DEFAULTS, validateEventInspectorSettings, type EventInspectorSettings } from './event-inspector-settings.js';
import type { Unsubscribe } from '../../domain/shared/unsubscribe.js';
import type { EventEnvelope } from '../../domain/shared/event-bus.js';
import enMessages from './locales/en.json' with { type: 'json' };

export const VIEW_TYPE_EVENT_INSPECTOR = 'agentonomous-event-inspector';

type Listener = (envelope: EventEnvelope) => void;

type ModuleState = {
	busUnsub: Unsubscribe;
	readonly buffer: EventEnvelope[];
	maxEvents: number;
	readonly listeners: Set<Listener>;
};

let state: ModuleState | null = null;

export function getEventInspectorBuffer(): readonly EventEnvelope[] {
	return state?.buffer ?? [];
}

export function getEventInspectorMaxEvents(): number {
	return state?.maxEvents ?? EVENT_INSPECTOR_DEFAULTS.maxEvents;
}

export function subscribeToEvents(listener: Listener): Unsubscribe {
	if (state === null) return () => {};
	state.listeners.add(listener);
	return () => { state?.listeners.delete(listener); };
}

export const EventInspectorModule = defineModule<EventInspectorSettings>({
	id: 'event-inspector',
	name: 'Event Inspector',
	dependsOn: ['core'],
	settingsKey: 'eventInspector',
	settingsDefaults: EVENT_INSPECTOR_DEFAULTS,
	validateSettings: validateEventInspectorSettings,
	messages: { en: enMessages },
	views: [
		{
			type: VIEW_TYPE_EVENT_INSPECTOR,
			displayName: 'Event inspector',
			icon: 'activity',
			defaultLocation: 'right',
		},
	],

	commands: [
		{
			id: 'toggle-event-inspector',
			name: 'Toggle event inspector',
			opensView: VIEW_TYPE_EVENT_INSPECTOR,
			ribbon: { icon: 'activity', title: 'Event inspector', visibleByDefault: false },
		},
	],

	init(ports, settings) {
		if (state !== null) {
			this.destroy();
		}

		if (!settings.enabled) {
			ports.logger.info('event-inspector', 'Event inspector disabled by settings');
			return Promise.resolve();
		}

		const buffer: EventEnvelope[] = [];
		const listeners = new Set<Listener>();

		const busUnsub = ports.eventBus.onAny((envelope) => {
			if (state === null) return;
			buffer.push(envelope);
			if (buffer.length > state.maxEvents) {
				buffer.splice(0, buffer.length - state.maxEvents);
			}
			for (const listener of listeners) {
				listener(envelope);
			}
		});

		state = { busUnsub, buffer, maxEvents: settings.maxEvents, listeners };

		ports.logger.info('event-inspector', `Capturing events (max: ${String(settings.maxEvents)})`);
		return Promise.resolve();
	},

	onSettingsChange(next) {
		if (state === null) return;
		state.maxEvents = next.maxEvents;
		if (state.buffer.length > next.maxEvents) {
			state.buffer.splice(0, state.buffer.length - next.maxEvents);
		}
	},

	destroy() {
		state?.busUnsub();
		state = null;
	},
});
