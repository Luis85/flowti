import { describe, expect, it, beforeEach } from 'vitest';
import { createEventBus } from '../../../src/domain/shared/event-bus.js';
import '../../../src/domain/shared/core-events.js';
import { fakeModulePorts, fakeLogger } from '../../__fakes__/fake-ports.js';
import { clearPending } from '../../../src/modules/event-inspector/event-inspector-store.js';

describe('EventInspectorModule', () => {
	beforeEach(() => {
		clearPending();
	});

	it('init subscribes to the bus and captures events', async () => {
		const { EventInspectorModule } = await import('../../../src/modules/event-inspector/event-inspector-module.js');
		const bus = createEventBus();
		const logger = fakeLogger();
		const ports = fakeModulePorts({ eventBus: bus, logger });

		await EventInspectorModule.init(ports, { enabled: true, maxEvents: 100, filterChannels: [] });
		expect(logger.info).toHaveBeenCalled();

		bus.emit('core', { phase: 'ready' });

		EventInspectorModule.destroy();
	});

	it('does not subscribe when disabled', async () => {
		const { EventInspectorModule } = await import('../../../src/modules/event-inspector/event-inspector-module.js');
		const bus = createEventBus();
		const logger = fakeLogger();
		const ports = fakeModulePorts({ eventBus: bus, logger });

		await EventInspectorModule.init(ports, { enabled: false, maxEvents: 100, filterChannels: [] });
		expect(logger.info).toHaveBeenCalledWith('event-inspector', 'Event inspector disabled by settings');
		EventInspectorModule.destroy();
	});

	it('init() called twice does not leak the first subscription', async () => {
		const { EventInspectorModule } = await import('../../../src/modules/event-inspector/event-inspector-module.js');
		const bus = createEventBus();
		const ports = fakeModulePorts({ eventBus: bus });

		await EventInspectorModule.init(ports, { enabled: true, maxEvents: 100, filterChannels: [] });
		const countAfterFirst = bus.listenerCount();
		EventInspectorModule.destroy();

		await EventInspectorModule.init(ports, { enabled: true, maxEvents: 100, filterChannels: [] });
		const countAfterSecond = bus.listenerCount();
		expect(countAfterSecond).toBe(countAfterFirst);
		EventInspectorModule.destroy();
	});

	it('double init without destroy does not leak listeners', async () => {
		const { EventInspectorModule } = await import('../../../src/modules/event-inspector/event-inspector-module.js');
		const bus = createEventBus();
		const ports = fakeModulePorts({ eventBus: bus });

		await EventInspectorModule.init(ports, { enabled: true, maxEvents: 100, filterChannels: [] });
		const countAfterFirst = bus.listenerCount();
		await EventInspectorModule.init(ports, { enabled: true, maxEvents: 100, filterChannels: [] });
		expect(bus.listenerCount()).toBe(countAfterFirst);
		EventInspectorModule.destroy();
	});
});
