import './event-inspector-events.js';
import { defineModule } from '../../domain/shared/module.js';
import { EVENT_INSPECTOR_DEFAULTS, validateEventInspectorSettings, type EventInspectorSettings } from './event-inspector-settings.js';
import { pushEvent, setMaxBufferSize, clearPending } from './event-inspector-store.js';
import type { Unsubscribe } from '../../domain/shared/unsubscribe.js';
import enMessages from './locales/en.json' with { type: 'json' };

export const VIEW_TYPE_EVENT_INSPECTOR = 'agentonomous-event-inspector';

type ModuleState = {
	busUnsub: Unsubscribe;
};

let state: ModuleState | null = null;

export const EventInspectorModule = defineModule<EventInspectorSettings>({
	id: 'event-inspector',
	name: 'Event Inspector',
	dependsOn: ['core'],
	settingsKey: 'eventInspector',
	settingsDefaults: EVENT_INSPECTOR_DEFAULTS,
	validateSettings: validateEventInspectorSettings,
	messages: { en: enMessages },

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

		setMaxBufferSize(settings.maxEvents);
		clearPending();

		const busUnsub = ports.eventBus.onAny((envelope) => {
			pushEvent(envelope);
		});

		state = { busUnsub };

		ports.logger.info('event-inspector', `Capturing events (max: ${String(settings.maxEvents)})`);
		return Promise.resolve();
	},

	destroy() {
		state?.busUnsub();
		state = null;
	},
});
