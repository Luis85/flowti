declare module '../../domain/shared/event-bus.js' {
	interface EventMap {
		'event-inspector': { action: 'buffer-full' | 'filter-changed' };
	}
}
