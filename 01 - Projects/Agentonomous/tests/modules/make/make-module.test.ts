import { describe, it, expect, vi } from 'vitest';
import { MakeModule, getMakeModuleState, VIEW_TYPE_MAKE } from '../../../src/modules/make/make-module.js';
import { MAKE_DEFAULTS, type MakeSettings } from '../../../src/modules/make/make-settings.js';
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
		expect(getMakeModuleState()).not.toBeNull();
		await MakeModule.destroy();
		expect(getMakeModuleState()).toBeNull();
	});
	it('init is idempotent', async () => {
		await MakeModule.init(fakeModulePorts(), MAKE_DEFAULTS);
		await MakeModule.init(fakeModulePorts(), MAKE_DEFAULTS);
		expect(getMakeModuleState()).not.toBeNull();
		await MakeModule.destroy();
	});
	it('onSettingsChange with folder change destroys and re-inits', async () => {
		await MakeModule.init(fakeModulePorts(), MAKE_DEFAULTS);
		const before = getMakeModuleState()?.service;
		await MakeModule.onSettingsChange?.({ ...MAKE_DEFAULTS, typesFolder: 'OtherTypes' });
		const after = getMakeModuleState()?.service;
		expect(after).not.toBe(before);        // different service instance
		expect(after).not.toBeNull();
		await MakeModule.destroy();
	});
	it('onSettingsChange for non-folder change keeps the SAME service instance', async () => {
		await MakeModule.init(fakeModulePorts(), MAKE_DEFAULTS);
		const before = getMakeModuleState()?.service;
		await MakeModule.onSettingsChange?.({ ...MAKE_DEFAULTS, favorites: ['book'] });
		const after = getMakeModuleState()?.service;
		expect(after).toBe(before);             // same instance — no rebuild
		await MakeModule.destroy();
	});
	it('onSettingsChange updates state.settings in place for non-folder changes', async () => {
		await MakeModule.init(fakeModulePorts(), MAKE_DEFAULTS);
		await MakeModule.onSettingsChange?.({ ...MAKE_DEFAULTS, favorites: ['book', 'recipe'] });
		// The getter used by the service should now return the new favorites.
		// (Direct assertion is via getMakeModuleState().)
		expect(getMakeModuleState()?.settings.favorites).toEqual(['book', 'recipe']);
		await MakeModule.destroy();
	});
});

describe('MakeModule onSettingsChange async', () => {
	it('rebuilds service when typesFolder changes (success path)', async () => {
		const ports = fakeModulePorts();
		await MakeModule.init(ports, MAKE_DEFAULTS);
		const before = getMakeModuleState()?.service;
		expect(before).not.toBeNull();
		await MakeModule.onSettingsChange!({ ...MAKE_DEFAULTS, typesFolder: 'Schemas' });
		const after = getMakeModuleState()?.service;
		expect(after).not.toBeNull();
		expect(after).not.toBe(before);
		expect(getMakeModuleState()?.settings.typesFolder).toBe('Schemas');
		await MakeModule.destroy();
	});

	it('re-throws when init fails during settings change, leaves module destroyed', async () => {
		const ports = fakeModulePorts();
		await MakeModule.init(ports, MAKE_DEFAULTS);
		// Failure-injection mechanism (deterministic): MakeModule.init's last
		// line calls `ports.logger.info('make', 'Make module initialised')`.
		// Spy on logger.info with mockImplementationOnce so ONLY the next
		// init throws.
		vi.spyOn(ports.logger, 'info').mockImplementationOnce(() => { throw new Error('logger boom'); });
		await expect(
			MakeModule.onSettingsChange!({ ...MAKE_DEFAULTS, typesFolder: 'Schemas' }),
		).rejects.toThrow('logger boom');
		expect(getMakeModuleState()).toBeNull();
		await MakeModule.destroy();
	});
});

describe('make:settings-changed event', () => {
	it('emits when a non-folder setting changes', async () => {
		const ports = fakeModulePorts({ eventBus: createEventBus() });
		await MakeModule.init(ports, MAKE_DEFAULTS);
		const received: MakeSettings[] = [];
		ports.eventBus.on('make:settings-changed', (e) => { received.push(e.payload.settings); });
		await MakeModule.onSettingsChange!({ ...MAKE_DEFAULTS, favorites: ['type-a'] });
		expect(received).toHaveLength(1);
		expect(received[0]?.favorites).toEqual(['type-a']);
		await MakeModule.destroy();
	});

	it('does not emit when a folder setting changes (re-init handles it)', async () => {
		const ports = fakeModulePorts({ eventBus: createEventBus() });
		await MakeModule.init(ports, MAKE_DEFAULTS);
		const received: MakeSettings[] = [];
		ports.eventBus.on('make:settings-changed', (e) => { received.push(e.payload.settings); });
		await MakeModule.onSettingsChange!({ ...MAKE_DEFAULTS, typesFolder: 'Schemas' });
		expect(received).toHaveLength(0);
		await MakeModule.destroy();
	});
});

describe('getMakeModuleState subscribe', () => {
	it('returns a no-op when module is not initialised', () => {
		const moduleState = getMakeModuleState();
		const unsubscribe = moduleState?.subscribe({ onTypeCreated: () => { /* noop */ } }) ?? (() => { /* noop */ });
		expect(typeof unsubscribe).toBe('function');
		unsubscribe();
	});

	it('dispatches payload-only handler on matching channel', async () => {
		const ports = fakeModulePorts({ eventBus: createEventBus() });
		await MakeModule.init(ports, MAKE_DEFAULTS);
		const received: TypeSchema[] = [];
		const moduleState = getMakeModuleState();
		expect(moduleState).not.toBeNull();
		const unsubscribe = moduleState!.subscribe({
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
		const moduleState = getMakeModuleState();
		expect(moduleState).not.toBeNull();
		moduleState!.subscribe({
			onTypeCreated: (p) => { typeCreated.push(p.schema); },
			onTypeDeleted: (p) => { typeDeleted.push(p.typeId); },
		});
		ports.eventBus.emit('make:type-created', { schema: BOOK });
		ports.eventBus.emit('make:type-deleted', { typeId: 'book', name: 'Book' });
		expect(typeCreated).toHaveLength(1);
		expect(typeDeleted).toEqual(['book']);
		await MakeModule.destroy();
	});

	it('invokes onInstancesDeletedBatch when make:instances-deleted-batch is emitted', async () => {
		const ports = fakeModulePorts({ eventBus: createEventBus() });
		await MakeModule.init(ports, MAKE_DEFAULTS);
		const calls: Array<{ readonly typeId: string; readonly deletedPaths: readonly string[]; readonly failures: readonly { readonly path: string; readonly error: string }[] }> = [];
		const moduleState = getMakeModuleState();
		expect(moduleState).not.toBeNull();
		const unsubscribe = moduleState!.subscribe({
			onInstancesDeletedBatch: (payload) => { calls.push(payload); },
		});
		ports.eventBus.emit('make:instances-deleted-batch', {
			typeId: 'book',
			deletedPaths: ['Books/Dune.md'],
			failures:     [{ path: 'Books/Foundation.md', error: 'locked' }],
		});
		expect(calls).toEqual([{
			typeId: 'book',
			deletedPaths: ['Books/Dune.md'],
			failures:     [{ path: 'Books/Foundation.md', error: 'locked' }],
		}]);
		unsubscribe();
		await MakeModule.destroy();
	});
});
