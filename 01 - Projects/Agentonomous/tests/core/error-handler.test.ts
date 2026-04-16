import { describe, expect, it, vi } from 'vitest';
import { ErrorHandler } from '../../src/core/error-handler.js';
import { createEventBus } from '../../src/domain/shared/event-bus.js';
import type { LoggerPort } from '../../src/domain/shared/logger-port.js';
import type { NotificationPort } from '../../src/domain/shared/notification-port.js';

function fakeLogger(): LoggerPort {
	return { debug: vi.fn(), info: vi.fn(), error: vi.fn(), setLevel: vi.fn() };
}

function fakeNotifications(): NotificationPort & { messages: string[] } {
	const messages: string[] = [];
	return { show: (msg: string) => { messages.push(msg); }, messages };
}

describe('ErrorHandler', () => {
	it('logs all errors via logger.error()', () => {
		const bus = createEventBus();
		const logger = fakeLogger();
		const notifications = fakeNotifications();
		new ErrorHandler(bus, logger, notifications);
		bus.emit('error', { code: 'TEST_ERR', message: 'Something broke', source: 'test', severity: 'system' });
		expect(logger.error).toHaveBeenCalledWith('test', '[TEST_ERR] Something broke');
	});

	it('shows a notification for severity: user', () => {
		const bus = createEventBus();
		const logger = fakeLogger();
		const notifications = fakeNotifications();
		new ErrorHandler(bus, logger, notifications);
		bus.emit('error', { code: 'SAVE_FAILED', message: 'Could not save', source: 'settings', severity: 'user' });
		expect(notifications.messages).toContain('Could not save');
	});

	it('shows a notification for severity: fatal', () => {
		const bus = createEventBus();
		const logger = fakeLogger();
		const notifications = fakeNotifications();
		new ErrorHandler(bus, logger, notifications);
		bus.emit('error', { code: 'FATAL', message: 'Unrecoverable', source: 'core', severity: 'fatal' });
		expect(notifications.messages).toContain('Unrecoverable');
	});

	it('does NOT show a notification for severity: system', () => {
		const bus = createEventBus();
		const logger = fakeLogger();
		const notifications = fakeNotifications();
		new ErrorHandler(bus, logger, notifications);
		bus.emit('error', { code: 'SYS', message: 'Internal', source: 'core', severity: 'system' });
		expect(notifications.messages).toHaveLength(0);
	});

	it('destroy() unsubscribes from the bus', () => {
		const bus = createEventBus();
		const logger = fakeLogger();
		const notifications = fakeNotifications();
		const handler = new ErrorHandler(bus, logger, notifications);
		handler.destroy();
		bus.emit('error', { code: 'LATE', message: 'After destroy', source: 'test', severity: 'user' });
		expect(logger.error).not.toHaveBeenCalled();
	});
});
