import { describe, it, expect } from 'vitest';
import { MakeModule, getMakeService, subscribeMakeEvents, VIEW_TYPE_MAKE } from '../../../src/modules/make/make-module.js';
import { MAKE_DEFAULTS } from '../../../src/modules/make/make-settings.js';
import { fakeModulePorts } from '../../__fakes__/fake-ports.js';
import { createEventBus } from '../../../src/domain/shared/event-bus.js';
import type { TypeSchema } from '../../../src/domain/make/type-schema.js';

const BOOK: TypeSchema = {
	id: 'book', name: 'Book', instancesFolder: 'Books', titleFieldName: 'title',
	fields: [{ kind: 'text', name: 'title', required: true }],
	createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z',
};

describe('MakeModule', () => {
	it('registers view and commands declaratively', () => {
		expect(MakeModule.views?.[0]?.type).toBe(VIEW_TYPE_MAKE);
		expect(MakeModule.commands?.[0]?.id).toBe('open-make');
	});
	it('init exposes a service; destroy clears it', async () => {
		await MakeModule.init(fakeModulePorts(), MAKE_DEFAULTS);
		expect(getMakeService()).not.toBeNull();
		await MakeModule.destroy();
		expect(getMakeService()).toBeNull();
	});
	it('init is idempotent', async () => {
		await MakeModule.init(fakeModulePorts(), MAKE_DEFAULTS);
		await MakeModule.init(fakeModulePorts(), MAKE_DEFAULTS);
		expect(getMakeService()).not.toBeNull();
		await MakeModule.destroy();
	});
	it('onSettingsChange with folder change destroys and re-inits', async () => {
		await MakeModule.init(fakeModulePorts(), MAKE_DEFAULTS);
		const before = getMakeService();
		MakeModule.onSettingsChange?.({ ...MAKE_DEFAULTS, typesFolder: 'OtherTypes' });
		const after = getMakeService();
		expect(after).not.toBe(before);        // different service instance
		expect(after).not.toBeNull();
		await MakeModule.destroy();
	});
	it('onSettingsChange for non-folder change keeps the SAME service instance', async () => {
		await MakeModule.init(fakeModulePorts(), MAKE_DEFAULTS);
		const before = getMakeService();
		MakeModule.onSettingsChange?.({ ...MAKE_DEFAULTS, favorites: ['book'] });
		const after = getMakeService();
		expect(after).toBe(before);             // same instance — no rebuild
		await MakeModule.destroy();
	});
	it('onSettingsChange updates state.settings in place for non-folder changes', async () => {
		await MakeModule.init(fakeModulePorts(), MAKE_DEFAULTS);
		MakeModule.onSettingsChange?.({ ...MAKE_DEFAULTS, favorites: ['book', 'recipe'] });
		// The getter used by the service should now return the new favorites.
		// (Direct assertion is via the module-level getter exported for tests.)
		const { getMakeSettings } = await import('../../../src/modules/make/make-module.js');
		expect(getMakeSettings()?.favorites).toEqual(['book', 'recipe']);
		await MakeModule.destroy();
	});
});

describe('subscribeMakeEvents', () => {
	it('returns a no-op when module is not initialised', () => {
		const unsubscribe = subscribeMakeEvents({ onTypeCreated: () => { /* noop */ } });
		expect(typeof unsubscribe).toBe('function');
		unsubscribe();
	});

	it('dispatches payload-only handler on matching channel', async () => {
		const ports = fakeModulePorts({ eventBus: createEventBus() });
		await MakeModule.init(ports, MAKE_DEFAULTS);
		const received: TypeSchema[] = [];
		const unsubscribe = subscribeMakeEvents({
			onTypeCreated: (p) => { received.push(p.schema); },
		});
		ports.eventBus.emit('make:type-created', { schema: BOOK });
		expect(received).toEqual([BOOK]);
		unsubscribe();
		ports.eventBus.emit('make:type-created', { schema: BOOK });
		expect(received).toHaveLength(1);
		await MakeModule.destroy();
	});

	it('subscribes to multiple channels independently', async () => {
		const ports = fakeModulePorts({ eventBus: createEventBus() });
		await MakeModule.init(ports, MAKE_DEFAULTS);
		const typeCreated: TypeSchema[] = [];
		const typeDeleted: string[] = [];
		subscribeMakeEvents({
			onTypeCreated: (p) => { typeCreated.push(p.schema); },
			onTypeDeleted: (p) => { typeDeleted.push(p.typeId); },
		});
		ports.eventBus.emit('make:type-created', { schema: BOOK });
		ports.eventBus.emit('make:type-deleted', { typeId: 'book', name: 'Book' });
		expect(typeCreated).toHaveLength(1);
		expect(typeDeleted).toEqual(['book']);
		await MakeModule.destroy();
	});
});
