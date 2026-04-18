import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { defineComponent, h } from 'vue';
import { mountWithI18n } from '../../__fixtures__/mount-with-i18n.js';
import { createFakeMakeContext, fakeMakeService } from '../../__fixtures__/fake-make-context.js';
import { MakeContextKey } from '../../../src/ui/make-context-key.js';
import { useMakeStore } from '../../../src/ui/stores/make-store.js';
import type { MakeEventHandlers } from '../../../src/modules/make/make-module.js';
import type { TypeSchema } from '../../../src/domain/make/type-schema.js';
import type { InstanceRef } from '../../../src/domain/make/types.js';

const BOOK: TypeSchema = {
	id: 'book', name: 'Book', instancesFolder: 'Books', titleFieldName: 'title',
	fields: [{ kind: 'text', name: 'title', required: true }],
	createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z',
};
const DUNE: InstanceRef = {
	typeId: 'book', path: 'Books/Dune.md', title: 'Dune',
	createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z',
};

function mountStore(
	ctx = createFakeMakeContext(),
): { store: ReturnType<typeof useMakeStore>; handlers: MakeEventHandlers } {
	let store!: ReturnType<typeof useMakeStore>;
	let capturedHandlers: MakeEventHandlers = {};
	const ctxWithCapture = {
		...ctx,
		subscribe: (h: MakeEventHandlers) => {
			capturedHandlers = h;
			return () => { capturedHandlers = {}; };
		},
	};
	mountWithI18n(
		defineComponent({
			setup() { store = useMakeStore(); return () => h('div'); },
		}),
		{
			provide: { [MakeContextKey as symbol]: ctxWithCapture } as Record<PropertyKey, unknown>,
			plugins: [createPinia()],
		},
	);
	return { store, handlers: capturedHandlers };
}

beforeEach(() => { setActivePinia(createPinia()); });

describe('make-store', () => {
	it('loadTypes populates types, flips loading false, leaves no error on success', async () => {
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: [BOOK] });
		const { store } = mountStore(createFakeMakeContext({ service: fakeMakeService({ listTypes }) }));
		expect(store.typesLoaded).toBe(false);
		await store.loadTypes();
		expect(store.types).toEqual([BOOK]);
		expect(store.typesLoaded).toBe(true);
		expect(store.typesLoading).toBe(false);
		expect(store.typesError).toBeNull();
	});

	it('loadTypes on error sets typesError and typesLoaded stays false', async () => {
		const listTypes = vi.fn().mockResolvedValue({ kind: 'err', error: { kind: 'vault-error', cause: 'permission denied' } });
		const { store } = mountStore(createFakeMakeContext({ service: fakeMakeService({ listTypes }) }));
		await store.loadTypes();
		expect(store.typesError).toMatch(/vault-error/);
		expect(store.typesLoaded).toBe(false);
	});

	it('loadInstances(typeId) populates instancesByTypeId and tracks per-type loading', async () => {
		const listInstances = vi.fn().mockResolvedValue({ kind: 'ok', value: [DUNE] });
		const { store } = mountStore(createFakeMakeContext({ service: fakeMakeService({ listInstances }) }));
		const p = store.loadInstances('book');
		expect(store.instancesLoading.has('book')).toBe(true);
		await p;
		expect(store.instancesByTypeId.get('book')).toEqual([DUNE]);
		expect(store.instancesLoading.has('book')).toBe(false);
	});

	it('loadInstances error populates instancesError[typeId]', async () => {
		const listInstances = vi.fn().mockResolvedValue({ kind: 'err', error: { kind: 'vault-error', cause: 'EIO' } });
		const { store } = mountStore(createFakeMakeContext({ service: fakeMakeService({ listInstances }) }));
		await store.loadInstances('book');
		expect(store.instancesError.get('book')).toMatch(/vault-error/);
	});

	it('refreshAll wipes cache then re-fetches types', async () => {
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: [BOOK] });
		const listInstances = vi.fn().mockResolvedValue({ kind: 'ok', value: [DUNE] });
		const { store } = mountStore(createFakeMakeContext({ service: fakeMakeService({ listTypes, listInstances }) }));
		await store.loadTypes();
		await store.loadInstances('book');
		expect(store.types).toHaveLength(1);
		expect(store.instancesByTypeId.size).toBe(1);
		await store.refreshAll();
		expect(listTypes).toHaveBeenCalledTimes(2);
	});

	it('getType returns cached TypeSchema or undefined', async () => {
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: [BOOK] });
		const { store } = mountStore(createFakeMakeContext({ service: fakeMakeService({ listTypes }) }));
		await store.loadTypes();
		expect(store.getType('book')).toEqual(BOOK);
		expect(store.getType('missing')).toBeUndefined();
	});

	it('typesSortedByName sorts alphabetically', async () => {
		const ZEBRA: TypeSchema = { ...BOOK, id: 'zebra', name: 'Zebra', instancesFolder: 'Zebras' };
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: [ZEBRA, BOOK] });
		const { store } = mountStore(createFakeMakeContext({ service: fakeMakeService({ listTypes }) }));
		await store.loadTypes();
		expect(store.typesSortedByName.map((t) => t.id)).toEqual(['book', 'zebra']);
	});

	it('instanceCountByTypeId returns undefined for types without loaded instances', async () => {
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: [BOOK] });
		const listInstances = vi.fn().mockResolvedValue({ kind: 'ok', value: [DUNE, { ...DUNE, path: 'Books/Neuromancer.md', title: 'Neuromancer' }] });
		const { store } = mountStore(createFakeMakeContext({ service: fakeMakeService({ listTypes, listInstances }) }));
		await store.loadTypes();
		expect(store.instanceCountByTypeId.get('book')).toBeUndefined();
		await store.loadInstances('book');
		expect(store.instanceCountByTypeId.get('book')).toBe(2);
	});

	it('favoriteTypes filters types by settings.favorites', async () => {
		const ZEBRA: TypeSchema = { ...BOOK, id: 'zebra', name: 'Zebra', instancesFolder: 'Zebras' };
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: [BOOK, ZEBRA] });
		const { store } = mountStore(createFakeMakeContext({
			service: fakeMakeService({ listTypes }),
			settings: { enabled: true, typesFolder: 'Make/Types', basesFolder: 'Make/Bases', defaultInstancesRoot: 'Make/Instances', favorites: ['book'] },
		}));
		await store.loadTypes();
		expect(store.favoriteTypes.map((t) => t.id)).toEqual(['book']);
	});
});

describe('make-store — context invariant', () => {
	it('throws when MakeContextKey is not provided (useMakeContext() invariant)', () => {
		// The store calls useMakeContext() which throws if the context is missing.
		expect(() => {
			mountWithI18n(
				defineComponent({
					setup() { useMakeStore(); return () => h('div'); },
				}),
				{ plugins: [createPinia()] },
			);
		}).toThrow(/MakeContextKey not provided/);
	});
});

describe('make-store write actions', () => {
	it('createType: returns Result; does NOT mutate types cache (event is sole mutator)', async () => {
		const NEW: TypeSchema = { ...BOOK, id: 'book', name: 'Book' };
		const createType = vi.fn().mockResolvedValue({ kind: 'ok', value: NEW });
		const { store } = mountStore(createFakeMakeContext({ service: fakeMakeService({ createType }) }));
		const r = await store.createType({
			name: 'Book', instancesFolder: 'Books', titleFieldName: 'title',
			fields: [{ kind: 'text', name: 'title', required: true }],
		});
		expect(r).toMatchObject({ kind: 'ok', value: NEW });
		// Cache NOT mutated by action (event is source of truth).
		expect(store.types).toEqual([]);
		expect(store.savingType).toBe(false);
	});

	it('createType: exposes savingType flag during call', async () => {
		let resolveCall!: (value: unknown) => void;
		const createType = vi.fn().mockReturnValue(new Promise((r) => { resolveCall = r; }));
		const { store } = mountStore(createFakeMakeContext({ service: fakeMakeService({ createType }) }));
		const p = store.createType({ name: 'X', instancesFolder: 'X', titleFieldName: null, fields: [] });
		expect(store.savingType).toBe(true);
		resolveCall({ kind: 'ok', value: BOOK });
		await p;
		expect(store.savingType).toBe(false);
	});

	it('createType: sets saveError on vault-error', async () => {
		const createType = vi.fn().mockResolvedValue({ kind: 'err', error: { kind: 'vault-error', cause: 'EIO' } });
		const { store } = mountStore(createFakeMakeContext({ service: fakeMakeService({ createType }) }));
		await store.createType({ name: 'X', instancesFolder: 'X', titleFieldName: null, fields: [] });
		expect(store.saveError).toMatch(/vault-error/);
	});

	it('updateType: returns Result; forwards acknowledgeRenames option', async () => {
		const updateType = vi.fn().mockResolvedValue({ kind: 'ok', value: BOOK });
		const { store } = mountStore(createFakeMakeContext({ service: fakeMakeService({ updateType }) }));
		await store.updateType('book', { description: 'x' }, { acknowledgeRenames: true });
		expect(updateType).toHaveBeenCalledWith('book', { description: 'x' }, { acknowledgeRenames: true });
	});

	it('deleteType: returns Result; forwards options', async () => {
		const deleteType = vi.fn().mockResolvedValue({ kind: 'ok', value: { instancesDeleted: 0, baseFileDeleted: true } });
		const { store } = mountStore(createFakeMakeContext({ service: fakeMakeService({ deleteType }) }));
		const r = await store.deleteType('book', { alsoDeleteInstances: false, alsoDeleteBaseFile: true });
		expect(r.kind).toBe('ok');
		expect(deleteType).toHaveBeenCalledWith('book', { alsoDeleteInstances: false, alsoDeleteBaseFile: true });
	});

	it('regenerateBaseFile: tracks per-type loading; clears on success', async () => {
		let resolveCall!: (v: unknown) => void;
		const regenerateBaseFile = vi.fn().mockReturnValue(new Promise((r) => { resolveCall = r; }));
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: [BOOK] });
		const { store } = mountStore(createFakeMakeContext({ service: fakeMakeService({ regenerateBaseFile, listTypes }) }));
		const p = store.regenerateBaseFile('book');
		expect(store.regeneratingForId.has('book')).toBe(true);
		resolveCall({ kind: 'ok', value: 'Make/Bases/book.base' });
		await p;
		expect(store.regeneratingForId.has('book')).toBe(false);
	});

	it('regenerateBaseFile: sets regenerationError on user-edited', async () => {
		const regenerateBaseFile = vi.fn().mockResolvedValue({ kind: 'err', error: { kind: 'base-generation-failed', cause: 'user-edited' } });
		const { store } = mountStore(createFakeMakeContext({ service: fakeMakeService({ regenerateBaseFile }) }));
		await store.regenerateBaseFile('book');
		expect(store.regenerationError.get('book')).toMatch(/user-edited/);
	});

	it('toggleFavorite: sets optimistic override during call, clears on completion', async () => {
		let resolveCall!: (v: unknown) => void;
		const toggleFavorite = vi.fn().mockReturnValue(new Promise((r) => { resolveCall = r; }));
		// Settings has favorites: ['book']; toggling book should flip to false optimistically.
		const { store } = mountStore(createFakeMakeContext({
			service: fakeMakeService({ toggleFavorite }),
			settings: { enabled: true, typesFolder: 'Make/Types', basesFolder: 'Make/Bases', defaultInstancesRoot: 'Make/Instances', favorites: ['book'] },
		}));
		const p = store.toggleFavorite('book');
		expect(store.isFavoritedForUI('book')).toBe(false); // optimistic
		expect(store.favoriteToggling.has('book')).toBe(true);
		resolveCall({ kind: 'ok', value: false });
		await p;
		expect(store.favoriteToggling.has('book')).toBe(false);
	});

	it('isFavoritedForUI: returns override when set, settings otherwise', () => {
		const { store } = mountStore(createFakeMakeContext({
			settings: { enabled: true, typesFolder: 'Make/Types', basesFolder: 'Make/Bases', defaultInstancesRoot: 'Make/Instances', favorites: ['book'] },
		}));
		// No override: falls back to settings favorites which include 'book'.
		expect(store.isFavoritedForUI('book')).toBe(true);
		// 'recipe' not in favorites.
		expect(store.isFavoritedForUI('recipe')).toBe(false);
	});

	it('event onTypeCreated: appends schema to types cache', () => {
		const { store, handlers } = mountStore();
		const NEW: TypeSchema = { ...BOOK, id: 'novel', name: 'Novel', instancesFolder: 'Novels' };
		handlers['onTypeCreated']?.({ schema: NEW });
		expect(store.types).toContainEqual(NEW);
	});

	it('event onTypeUpdated: replaces schema in types cache', () => {
		const { store, handlers } = mountStore();
		store.types = [BOOK];
		const UPDATED: TypeSchema = { ...BOOK, description: 'Updated' };
		handlers['onTypeUpdated']?.({ schema: UPDATED });
		expect(store.types[0]).toMatchObject({ description: 'Updated' });
	});

	it('event onTypeDeleted: removes schema and clears related maps', () => {
		const { store, handlers } = mountStore();
		store.types = [BOOK];
		handlers['onTypeDeleted']?.({ typeId: 'book', name: 'Book' });
		expect(store.types).toEqual([]);
	});
});
