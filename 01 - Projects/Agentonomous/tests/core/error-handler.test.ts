import { describe, expect, it } from 'vitest';
import { ErrorHandler } from '../../src/core/error-handler.js';
import { createEventBus } from '../../src/domain/shared/event-bus.js';
import { fakeLogger, fakeNotifications } from '../__fakes__/fake-ports.js';

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

	it('shows Notice for each error when core event has degraded: true', () => {
		const bus = createEventBus();
		const logger = fakeLogger();
		const notifications = fakeNotifications();
		new ErrorHandler(bus, logger, notifications);
		bus.emit('core', { phase: 'ready', degraded: true, errors: ['Module "alpha" failed', 'Module "beta" failed'] });
		expect(notifications.messages).toContain('Module "alpha" failed');
		expect(notifications.messages).toContain('Module "beta" failed');
	});

	it('does not show Notice for core events without degraded flag', () => {
		const bus = createEventBus();
		const logger = fakeLogger();
		const notifications = fakeNotifications();
		new ErrorHandler(bus, logger, notifications);
		bus.emit('core', { phase: 'ready' });
		expect(notifications.messages).toHaveLength(0);
	});

	it('destroy() also unsubscribes from core channel', () => {
		const bus = createEventBus();
		const logger = fakeLogger();
		const notifications = fakeNotifications();
		const handler = new ErrorHandler(bus, logger, notifications);
		handler.destroy();
		bus.emit('core', { phase: 'ready', degraded: true, errors: ['Module "x" failed'] });
		expect(notifications.messages).toHaveLength(0);
	});
});
