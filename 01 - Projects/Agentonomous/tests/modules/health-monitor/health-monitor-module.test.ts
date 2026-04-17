import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from '../../../src/domain/shared/event-bus.js';
import '../../../src/domain/shared/core-events.js';
import { fakeModulePorts, fakeLogger, fakeNotifications } from '../../__fakes__/fake-ports.js';

describe('HealthMonitorModule', () => {
	it('init starts periodic health checks and destroy clears them', async () => {
		vi.useFakeTimers();
		const { HealthMonitorModule } = await import('../../../src/modules/health-monitor/health-monitor-module.js');
		const bus = createEventBus();
		const ports = fakeModulePorts({ eventBus: bus });

		await HealthMonitorModule.init(ports, undefined);

		const listener = vi.fn();
		bus.on('health-monitor', listener);

		vi.advanceTimersByTime(60000);
		expect(listener).toHaveBeenCalledOnce();

		HealthMonitorModule.destroy();

		vi.advanceTimersByTime(60000);
		expect(listener).toHaveBeenCalledOnce(); // no second call — interval cleared

		vi.useRealTimers();
	});

	it('logs when initialized', async () => {
		const { HealthMonitorModule } = await import('../../../src/modules/health-monitor/health-monitor-module.js');
		const bus = createEventBus();
		const logger = fakeLogger();
		const ports = fakeModulePorts({ eventBus: bus, logger });

		await HealthMonitorModule.init(ports, undefined);
		expect(logger.info).toHaveBeenCalledWith('health-monitor', 'Health monitoring active');
		HealthMonitorModule.destroy();
	});

	it('handles core:ready and core:destroyed events without throwing', async () => {
		const { HealthMonitorModule } = await import('../../../src/modules/health-monitor/health-monitor-module.js');
		const bus = createEventBus();
		const ports = fakeModulePorts({ eventBus: bus });

		await HealthMonitorModule.init(ports, undefined);
		// Cover the branch: phase === 'ready'
		bus.emit('core', { phase: 'ready' });
		// Cover the branch: phase === 'destroyed'
		bus.emit('core', { phase: 'destroyed' });
		// Cover the else: phase not matching
		bus.emit('core', { phase: 'initializing' });
		HealthMonitorModule.destroy();
	});

	it('show-health command invokes logger and notifications', async () => {
		const { HealthMonitorModule } = await import('../../../src/modules/health-monitor/health-monitor-module.js');
		const bus = createEventBus();
		const logger = fakeLogger();
		const notifications = fakeNotifications();
		const ports = fakeModulePorts({ eventBus: bus, logger, notifications });

		await HealthMonitorModule.init(ports, undefined);

		const showHealthCmd = HealthMonitorModule.commands?.find((c) => c.id === 'show-health');
		expect(showHealthCmd).toBeDefined();
		void showHealthCmd?.callback?.();

		expect(logger.info).toHaveBeenCalledWith('health-monitor', expect.stringContaining('health'));
		expect(notifications.info).toHaveBeenCalledWith(expect.stringContaining('health'));

		HealthMonitorModule.destroy();
	});

	it('init() called twice does not leak the first subscription', async () => {
		const { HealthMonitorModule } = await import('../../../src/modules/health-monitor/health-monitor-module.js');
		const bus = createEventBus();
		const ports = fakeModulePorts({ eventBus: bus });

		await HealthMonitorModule.init(ports, undefined);
		const countAfterFirst = bus.listenerCount();
		HealthMonitorModule.destroy();

		await HealthMonitorModule.init(ports, undefined);
		const countAfterSecond = bus.listenerCount();
		expect(countAfterSecond).toBe(countAfterFirst);
		HealthMonitorModule.destroy();
	});

	it('double init without destroy does not leak listeners', async () => {
		const { HealthMonitorModule } = await import('../../../src/modules/health-monitor/health-monitor-module.js');
		const bus = createEventBus();
		const ports = fakeModulePorts({ eventBus: bus });

		await HealthMonitorModule.init(ports, undefined);
		const countAfterFirst = bus.listenerCount();
		await HealthMonitorModule.init(ports, undefined); // no destroy between
		expect(bus.listenerCount()).toBe(countAfterFirst);
		HealthMonitorModule.destroy();
	});
});
