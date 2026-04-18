import type { EventBus, EventEnvelope } from '../domain/shared/event-bus.js';
import type { LoggerPort } from '../domain/shared/logger-port.js';
import type { NotificationPort } from '../domain/shared/notification-port.js';
import type { Unsubscribe } from '../domain/shared/unsubscribe.js';

export class ErrorHandler {
	private readonly unsubs: readonly Unsubscribe[];

	constructor(
		bus: EventBus,
		private readonly logger: LoggerPort,
		private readonly notifications: NotificationPort,
	) {
		this.unsubs = [
			bus.on('error', (envelope) => { this.handle(envelope); }),
			bus.on('core', (envelope) => { this.handleCore(envelope); }),
		];
	}

	destroy(): void {
		for (const unsub of this.unsubs) unsub();
	}

	private handle(envelope: EventEnvelope<'error'>): void {
		const { severity, message, source, code } = envelope.payload;
		this.logger.error(source, `[${code}] ${message}`);
		if (severity === 'fatal') {
			this.notifications.error(message);
		} else if (severity === 'user') {
			this.notifications.warn(message);
		}
	}

	private handleCore(envelope: EventEnvelope<'core'>): void {
		const payload = envelope.payload;
		if (payload.phase === 'settings-change-failure') return;
		const { degraded, errors } = payload;
		if (degraded !== true || errors === undefined) return;
		for (const error of errors) {
			this.notifications.warn(error);
		}
	}
}
