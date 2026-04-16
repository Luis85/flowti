declare module '../../domain/shared/event-bus.js' {
	interface EventMap {
		'file-detail': { action: 'file-opened'; path: string };
	}
}
