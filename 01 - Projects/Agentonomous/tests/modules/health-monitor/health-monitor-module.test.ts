import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from '../../../src/domain/shared/event-bus.js';
import '../../../src/domain/shared/core-events.js';
import { fakeModulePorts, fakeLogger, fakeNotifications, fakeScheduler } from '../../__fakes__/fake-ports.js';

describe('HealthMonitorModule', () => {
	it('schedules a periodic health-check tick that emits on the bus', async () => {
		const { HealthMonitorModule } = await import('../../../src/modules/health-monitor/health-monitor-module.js');
		const bus = createEventBus();
		const scheduler = fakeScheduler();
		const ports = fakeModulePorts({ eventBus: bus, scheduler });

		await HealthMonitorModule.init(ports, undefined);
		expect(scheduler.scheduled.has('health-monitor:tick')).toBe(true);

		const listener = vi.fn();
		bus.on('health-monitor', listener);

		await scheduler.fire('health-monitor:tick');
		expect(listener).toHaveBeenCalledOnce();

		await HealthMonitorModule.destroy();
		expect(scheduler.scheduled.has('health-monitor:tick')).toBe(false);
	});

	it('logs when initialized', async () => {
		const { HealthMonitorModule } = await import('../../../src/modules/health-monitor/health-monitor-module.js');
		const bus = createEventBus();
		const logger = fakeLogger();
		const ports = fakeModulePorts({ eventBus: bus, logger });

		await HealthMonitorModule.init(ports, undefined);
		expect(logger.info).toHaveBeenCalledWith('health-monitor', 'Health monitoring active');
		await HealthMonitorModule.destroy();
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

		await HealthMonitorModule.destroy();
	});

	it('init() called twice replaces the scheduled tick', async () => {
		const { HealthMonitorModule } = await import('../../../src/modules/health-monitor/health-monitor-module.js');
		const bus = createEventBus();
		const scheduler = fakeScheduler();
		const ports = fakeModulePorts({ eventBus: bus, scheduler });

		await HealthMonitorModule.init(ports, undefined);
		await HealthMonitorModule.destroy();

		await HealthMonitorModule.init(ports, undefined);
		expect(scheduler.scheduled.size).toBe(1);
		await HealthMonitorModule.destroy();
	});

	it('double init without destroy does not leave stale state', async () => {
		const { HealthMonitorModule } = await import('../../../src/modules/health-monitor/health-monitor-module.js');
		const bus = createEventBus();
		const scheduler = fakeScheduler();
		const ports = fakeModulePorts({ eventBus: bus, scheduler });

		await HealthMonitorModule.init(ports, undefined);
		await HealthMonitorModule.init(ports, undefined); // self-guard triggers destroy first
		expect(scheduler.scheduled.size).toBe(1);
		await HealthMonitorModule.destroy();
	});
});
