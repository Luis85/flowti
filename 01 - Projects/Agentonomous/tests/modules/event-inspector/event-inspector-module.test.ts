import { describe, expect, it } from 'vitest';
import { createEventBus } from '../../../src/domain/shared/event-bus.js';
import '../../../src/domain/shared/core-events.js';
import { fakeModulePorts, fakeLogger } from '../../__fakes__/fake-ports.js';

describe('EventInspectorModule', () => {
	it('init subscribes to the bus and captures events into the buffer', async () => {
		const { EventInspectorModule, getEventInspectorBuffer } = await import(
			'../../../src/modules/event-inspector/event-inspector-module.js'
		);
		const bus = createEventBus();
		const logger = fakeLogger();
		const ports = fakeModulePorts({ eventBus: bus, logger });

		await EventInspectorModule.init(ports, { enabled: true, maxEvents: 100, filterChannels: [] });
		bus.emit('core', { phase: 'ready' });

		expect(getEventInspectorBuffer()).toHaveLength(1);
		expect(logger.info).toHaveBeenCalled();

		await EventInspectorModule.destroy();
	});

	it('does not subscribe when disabled', async () => {
		const { EventInspectorModule, getEventInspectorBuffer } = await import(
			'../../../src/modules/event-inspector/event-inspector-module.js'
		);
		const bus = createEventBus();
		const logger = fakeLogger();
		const ports = fakeModulePorts({ eventBus: bus, logger });

		await EventInspectorModule.init(ports, { enabled: false, maxEvents: 100, filterChannels: [] });
		bus.emit('core', { phase: 'ready' });

		expect(getEventInspectorBuffer()).toHaveLength(0);
		expect(logger.info).toHaveBeenCalledWith('event-inspector', 'Event inspector disabled by settings');
		await EventInspectorModule.destroy();
	});

	it('buffer respects maxEvents', async () => {
		const { EventInspectorModule, getEventInspectorBuffer } = await import(
			'../../../src/modules/event-inspector/event-inspector-module.js'
		);
		const bus = createEventBus();
		const ports = fakeModulePorts({ eventBus: bus });

		await EventInspectorModule.init(ports, { enabled: true, maxEvents: 3, filterChannels: [] });
		for (let i = 0; i < 5; i++) {
			bus.emit('core', { phase: 'ready' });
		}

		expect(getEventInspectorBuffer()).toHaveLength(3);
		await EventInspectorModule.destroy();
	});

	it('subscribeToEvents receives live events and can unsubscribe', async () => {
		const { EventInspectorModule, subscribeToEvents } = await import(
			'../../../src/modules/event-inspector/event-inspector-module.js'
		);
		const bus = createEventBus();
		const ports = fakeModulePorts({ eventBus: bus });

		await EventInspectorModule.init(ports, { enabled: true, maxEvents: 100, filterChannels: [] });

		const received: string[] = [];
		const unsub = subscribeToEvents((env) => { received.push(String(env.channel)); });

		bus.emit('core', { phase: 'ready' });
		expect(received).toHaveLength(1);

		unsub();
		bus.emit('core', { phase: 'destroyed' });
		expect(received).toHaveLength(1);

		await EventInspectorModule.destroy();
	});

	it('init() called twice does not leak the first subscription', async () => {
		const { EventInspectorModule } = await import('../../../src/modules/event-inspector/event-inspector-module.js');
		const bus = createEventBus();
		const ports = fakeModulePorts({ eventBus: bus });

		await EventInspectorModule.init(ports, { enabled: true, maxEvents: 100, filterChannels: [] });
		const countAfterFirst = bus.listenerCount();
		await EventInspectorModule.destroy();

		await EventInspectorModule.init(ports, { enabled: true, maxEvents: 100, filterChannels: [] });
		const countAfterSecond = bus.listenerCount();
		expect(countAfterSecond).toBe(countAfterFirst);
		await EventInspectorModule.destroy();
	});

	it('double init without destroy does not leak listeners', async () => {
		const { EventInspectorModule } = await import('../../../src/modules/event-inspector/event-inspector-module.js');
		const bus = createEventBus();
		const ports = fakeModulePorts({ eventBus: bus });

		await EventInspectorModule.init(ports, { enabled: true, maxEvents: 100, filterChannels: [] });
		const countAfterFirst = bus.listenerCount();
		await EventInspectorModule.init(ports, { enabled: true, maxEvents: 100, filterChannels: [] });
		expect(bus.listenerCount()).toBe(countAfterFirst);
		await EventInspectorModule.destroy();
	});
});
