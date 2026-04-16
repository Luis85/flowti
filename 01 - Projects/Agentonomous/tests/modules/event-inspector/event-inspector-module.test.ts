import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from '../../../src/domain/shared/event-bus.js';
import '../../../src/domain/shared/core-events.js';

describe('EventInspectorModule', () => {
	it('init subscribes to the bus and captures events', async () => {
		const { EventInspectorModule } = await import('../../../src/modules/event-inspector/event-inspector-module.js');
		const bus = createEventBus();
		const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), setLevel: vi.fn() };
		const ports = {
			eventBus: bus,
			logger,
			settings: { load: vi.fn(), save: vi.fn(), subscribe: vi.fn(() => () => {}) },
			notifications: { show: vi.fn() },
			views: { registerAll: vi.fn(), openView: vi.fn() },
		};

		await EventInspectorModule.init(ports, { enabled: true, maxEvents: 100, filterChannels: [] });
		expect(logger.info).toHaveBeenCalled();

		// Emit an event — the module should capture it via onAny
		bus.emit('core', { phase: 'ready' });

		EventInspectorModule.destroy();
	});

	it('does not subscribe when disabled', async () => {
		const { EventInspectorModule } = await import('../../../src/modules/event-inspector/event-inspector-module.js');
		const bus = createEventBus();
		const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), setLevel: vi.fn() };
		const ports = {
			eventBus: bus,
			logger,
			settings: { load: vi.fn(), save: vi.fn(), subscribe: vi.fn(() => () => {}) },
			notifications: { show: vi.fn() },
			views: { registerAll: vi.fn(), openView: vi.fn() },
		};

		await EventInspectorModule.init(ports, { enabled: false, maxEvents: 100, filterChannels: [] });
		expect(logger.info).toHaveBeenCalledWith('event-inspector', 'Event inspector disabled by settings');
		EventInspectorModule.destroy();
	});

	it('getEventBuffer returns null before init and after destroy', async () => {
		const { EventInspectorModule, getEventBuffer } = await import('../../../src/modules/event-inspector/event-inspector-module.js');

		// After destroy from prior test, buffer should be null
		expect(getEventBuffer()).toBeNull();

		const bus = createEventBus();
		const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), setLevel: vi.fn() };
		const ports = {
			eventBus: bus,
			logger,
			settings: { load: vi.fn(), save: vi.fn(), subscribe: vi.fn(() => () => {}) },
			notifications: { show: vi.fn() },
			views: { registerAll: vi.fn(), openView: vi.fn() },
		};

		await EventInspectorModule.init(ports, { enabled: true, maxEvents: 50, filterChannels: [] });
		expect(getEventBuffer()).not.toBeNull();

		EventInspectorModule.destroy();
		expect(getEventBuffer()).toBeNull();
	});

	it('captured events appear in the buffer', async () => {
		const { EventInspectorModule, getEventBuffer } = await import('../../../src/modules/event-inspector/event-inspector-module.js');
		const bus = createEventBus();
		const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), setLevel: vi.fn() };
		const ports = {
			eventBus: bus,
			logger,
			settings: { load: vi.fn(), save: vi.fn(), subscribe: vi.fn(() => () => {}) },
			notifications: { show: vi.fn() },
			views: { registerAll: vi.fn(), openView: vi.fn() },
		};

		await EventInspectorModule.init(ports, { enabled: true, maxEvents: 100, filterChannels: [] });
		bus.emit('core', { phase: 'ready' });
		bus.emit('core', { phase: 'initializing' });

		const buffer = getEventBuffer();
		expect(buffer?.getAll()).toHaveLength(2);

		EventInspectorModule.destroy();
	});
});
