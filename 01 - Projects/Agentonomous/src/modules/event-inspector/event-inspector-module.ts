import './event-inspector-events.js';
import { defineModule } from '../../domain/shared/module.js';
import { EVENT_INSPECTOR_DEFAULTS, validateEventInspectorSettings, type EventInspectorSettings } from './event-inspector-settings.js';
import { EventBuffer } from './event-inspector-buffer.js';
import type { Unsubscribe } from '../../domain/shared/unsubscribe.js';

export const VIEW_TYPE_EVENT_INSPECTOR = 'agentonomous-event-inspector';

/**
 * The module owns a plain-TS EventBuffer.  The Pinia store (and the Vue
 * sidebar view) wraps this buffer reactively when the leaf opens.
 * This keeps the module itself free of any Vue / Pinia / Obsidian imports.
 */
let sharedBuffer: EventBuffer | null = null;
let busUnsub: Unsubscribe | null = null;

/** Read-only accessor so the sidebar view can obtain the buffer on mount. */
export function getEventBuffer(): EventBuffer | null {
	return sharedBuffer;
}

export const EventInspectorModule = defineModule<EventInspectorSettings>({
	id: 'event-inspector',
	name: 'Event Inspector',
	dependsOn: ['core'],
	settingsKey: 'eventInspector',
	settingsDefaults: EVENT_INSPECTOR_DEFAULTS,
	validateSettings: validateEventInspectorSettings,

	commands: [
		{
			id: 'toggle-event-inspector',
			name: 'Toggle event inspector',
			opensView: VIEW_TYPE_EVENT_INSPECTOR,
			ribbon: { icon: 'activity', title: 'Event inspector', visibleByDefault: false },
		},
	],

	async init(ports, settings) {
		if (!settings.enabled) {
			ports.logger.info('event-inspector', 'Event inspector disabled by settings');
			return;
		}

		sharedBuffer = new EventBuffer(settings.maxEvents);

		busUnsub = ports.eventBus.onAny((envelope) => {
			sharedBuffer?.add(envelope);
		});

		ports.logger.info('event-inspector', `Capturing events (max: ${String(settings.maxEvents)})`);
	},

	destroy() {
		busUnsub?.();
		busUnsub = null;
		sharedBuffer = null;
	},
});
