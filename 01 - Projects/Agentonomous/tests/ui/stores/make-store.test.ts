import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useMakeStore } from '../../../src/ui/stores/make-store.js';
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

vi.mock('../../../src/modules/make/make-module.js', () => {
	const svc = {
		listTypes:          vi.fn(),
		loadType:           vi.fn(),
		listInstances:      vi.fn(),
		createType:         vi.fn(),
		updateType:         vi.fn(),
		deleteType:         vi.fn(),
		regenerateBaseFile: vi.fn(),
		toggleFavorite:     vi.fn(),
	};
	let capturedHandlers: Record<string, ((payload: unknown) => void) | undefined> = {};
	const settings = { enabled: true, typesFolder: 'Make/Types', basesFolder: 'Make/Bases', defaultInstancesRoot: 'Make/Instances', favorites: ['book'] };
	return {
		getMakeService:  () => svc,
		getMakeSettings: () => settings,
		subscribeMakeEvents: (h: Record<string, ((payload: unknown) => void) | undefined>) => {
			capturedHandlers = h;
			return () => { capturedHandlers = {}; };
		},
		__mock:          svc,
		__captured:      () => capturedHandlers,
	};
});

import * as makeModule from '../../../src/modules/make/make-module.js';
const mock = (makeModule as unknown as { __mock: {
	listTypes:          ReturnType<typeof vi.fn>;
	loadType:           ReturnType<typeof vi.fn>;
	listInstances:      ReturnType<typeof vi.fn>;
	createType:         ReturnType<typeof vi.fn>;
	updateType:         ReturnType<typeof vi.fn>;
	deleteType:         ReturnType<typeof vi.fn>;
	regenerateBaseFile: ReturnType<typeof vi.fn>;
	toggleFavorite:     ReturnType<typeof vi.fn>;
} }).__mock;

describe('make-store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		mock.listTypes.mockReset();
		mock.loadType.mockReset();
		mock.listInstances.mockReset();
		mock.createType.mockReset();
		mock.updateType.mockReset();
		mock.deleteType.mockReset();
		mock.regenerateBaseFile.mockReset();
		mock.toggleFavorite.mockReset();
	});

	it('loadTypes populates types, flips loading false, leaves no error on success', async () => {
		mock.listTypes.mockResolvedValue({ kind: 'ok', value: [BOOK] });
		const store = useMakeStore();
		expect(store.typesLoaded).toBe(false);
		await store.loadTypes();
		expect(store.types).toEqual([BOOK]);
		expect(store.typesLoaded).toBe(true);
		expect(store.typesLoading).toBe(false);
		expect(store.typesError).toBeNull();
	});

	it('loadTypes on error sets typesError and typesLoaded stays false', async () => {
		mock.listTypes.mockResolvedValue({ kind: 'err', error: { kind: 'vault-error', cause: 'permission denied' } });
		const store = useMakeStore();
		await store.loadTypes();
		expect(store.typesError).toMatch(/vault-error/);
		expect(store.typesLoaded).toBe(false);
	});

	it('loadInstances(typeId) populates instancesByTypeId and tracks per-type loading', async () => {
		mock.listInstances.mockResolvedValue({ kind: 'ok', value: [DUNE] });
		const store = useMakeStore();
		const p = store.loadInstances('book');
		expect(store.instancesLoading.has('book')).toBe(true);
		await p;
		expect(store.instancesByTypeId.get('book')).toEqual([DUNE]);
		expect(store.instancesLoading.has('book')).toBe(false);
	});

	it('loadInstances error populates instancesError[typeId]', async () => {
		mock.listInstances.mockResolvedValue({ kind: 'err', error: { kind: 'vault-error', cause: 'EIO' } });
		const store = useMakeStore();
		await store.loadInstances('book');
		expect(store.instancesError.get('book')).toMatch(/vault-error/);
	});

	it('refreshAll wipes cache then re-fetches types', async () => {
		mock.listTypes.mockResolvedValue({ kind: 'ok', value: [BOOK] });
		mock.listInstances.mockResolvedValue({ kind: 'ok', value: [DUNE] });
		const store = useMakeStore();
		await store.loadTypes();
		await store.loadInstances('book');
		expect(store.types).toHaveLength(1);
		expect(store.instancesByTypeId.size).toBe(1);
		await store.refreshAll();
		expect(mock.listTypes).toHaveBeenCalledTimes(2);
	});

	it('getType returns cached TypeSchema or undefined', async () => {
		mock.listTypes.mockResolvedValue({ kind: 'ok', value: [BOOK] });
		const store = useMakeStore();
		await store.loadTypes();
		expect(store.getType('book')).toEqual(BOOK);
		expect(store.getType('missing')).toBeUndefined();
	});

	it('typesSortedByName sorts alphabetically', async () => {
		const ZEBRA: TypeSchema = { ...BOOK, id: 'zebra', name: 'Zebra', instancesFolder: 'Zebras' };
		mock.listTypes.mockResolvedValue({ kind: 'ok', value: [ZEBRA, BOOK] });
		const store = useMakeStore();
		await store.loadTypes();
		expect(store.typesSortedByName.map((t) => t.id)).toEqual(['book', 'zebra']);
	});

	it('instanceCountByTypeId returns undefined for types without loaded instances', async () => {
		mock.listTypes.mockResolvedValue({ kind: 'ok', value: [BOOK] });
		mock.listInstances.mockResolvedValue({ kind: 'ok', value: [DUNE, { ...DUNE, path: 'Books/Neuromancer.md', title: 'Neuromancer' }] });
		const store = useMakeStore();
		await store.loadTypes();
		expect(store.instanceCountByTypeId.get('book')).toBeUndefined();
		await store.loadInstances('book');
		expect(store.instanceCountByTypeId.get('book')).toBe(2);
	});

	it('favoriteTypes filters types by settings.favorites', async () => {
		const ZEBRA: TypeSchema = { ...BOOK, id: 'zebra', name: 'Zebra', instancesFolder: 'Zebras' };
		mock.listTypes.mockResolvedValue({ kind: 'ok', value: [BOOK, ZEBRA] });
		const store = useMakeStore();
		await store.loadTypes();
		expect(store.favoriteTypes.map((t) => t.id)).toEqual(['book']);
	});
});

describe('make-store — service not ready', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.resetModules();
	});

	it('sets typesError when getMakeService returns null', async () => {
		vi.doMock('../../../src/modules/make/make-module.js', () => ({
			getMakeService: () => null,
			getMakeSettings: () => null,
			subscribeMakeEvents: () => () => { /* no-op */ },
		}));
		const { useMakeStore: useStoreReloaded } = await import('../../../src/ui/stores/make-store.js');
		const store = useStoreReloaded();
		await store.loadTypes();
		expect(store.typesError).toMatch(/not ready/);
	});
});

describe('make-store write actions', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		mock.createType.mockReset();
		mock.updateType.mockReset();
		mock.deleteType.mockReset();
		mock.regenerateBaseFile.mockReset();
		mock.toggleFavorite.mockReset();
		mock.listTypes.mockReset();
		mock.listInstances.mockReset();
	});

	it('createType: returns Result; does NOT mutate types cache (event is sole mutator)', async () => {
		const NEW: TypeSchema = { ...BOOK, id: 'book', name: 'Book' };
		mock.createType.mockResolvedValue({ kind: 'ok', value: NEW });
		const store = useMakeStore();
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
		mock.createType.mockReturnValue(new Promise((r) => { resolveCall = r; }));
		const store = useMakeStore();
		const p = store.createType({ name: 'X', instancesFolder: 'X', titleFieldName: null, fields: [] });
		expect(store.savingType).toBe(true);
		resolveCall({ kind: 'ok', value: BOOK });
		await p;
		expect(store.savingType).toBe(false);
	});

	it('createType: sets saveError on vault-error', async () => {
		mock.createType.mockResolvedValue({ kind: 'err', error: { kind: 'vault-error', cause: 'EIO' } });
		const store = useMakeStore();
		await store.createType({ name: 'X', instancesFolder: 'X', titleFieldName: null, fields: [] });
		expect(store.saveError).toMatch(/vault-error/);
	});

	it('updateType: returns Result; forwards acknowledgeRenames option', async () => {
		mock.updateType.mockResolvedValue({ kind: 'ok', value: BOOK });
		const store = useMakeStore();
		await store.updateType('book', { description: 'x' }, { acknowledgeRenames: true });
		expect(mock.updateType).toHaveBeenCalledWith('book', { description: 'x' }, { acknowledgeRenames: true });
	});

	it('deleteType: returns Result; forwards options', async () => {
		mock.deleteType.mockResolvedValue({ kind: 'ok', value: { instancesDeleted: 0, baseFileDeleted: true } });
		const store = useMakeStore();
		const r = await store.deleteType('book', { alsoDeleteInstances: false, alsoDeleteBaseFile: true });
		expect(r.kind).toBe('ok');
		expect(mock.deleteType).toHaveBeenCalledWith('book', { alsoDeleteInstances: false, alsoDeleteBaseFile: true });
	});

	it('regenerateBaseFile: tracks per-type loading; clears on success', async () => {
		let resolveCall!: (v: unknown) => void;
		mock.regenerateBaseFile.mockReturnValue(new Promise((r) => { resolveCall = r; }));
		const store = useMakeStore();
		const p = store.regenerateBaseFile('book');
		expect(store.regeneratingForId.has('book')).toBe(true);
		resolveCall({ kind: 'ok', value: 'Make/Bases/book.base' });
		mock.listTypes.mockResolvedValue({ kind: 'ok', value: [BOOK] });
		await p;
		expect(store.regeneratingForId.has('book')).toBe(false);
	});

	it('regenerateBaseFile: sets regenerationError on user-edited', async () => {
		mock.regenerateBaseFile.mockResolvedValue({ kind: 'err', error: { kind: 'base-generation-failed', cause: 'user-edited' } });
		const store = useMakeStore();
		await store.regenerateBaseFile('book');
		expect(store.regenerationError.get('book')).toMatch(/user-edited/);
	});

	it('toggleFavorite: sets optimistic override during call, clears on completion', async () => {
		let resolveCall!: (v: unknown) => void;
		mock.toggleFavorite.mockReturnValue(new Promise((r) => { resolveCall = r; }));
		// getMakeSettings mock has favorites: ['book']; so toggling book should flip to false.
		const store = useMakeStore();
		const p = store.toggleFavorite('book');
		expect(store.isFavoritedForUI('book')).toBe(false); // optimistic
		expect(store.favoriteToggling.has('book')).toBe(true);
		resolveCall({ kind: 'ok', value: false });
		await p;
		expect(store.favoriteToggling.has('book')).toBe(false);
	});

	it('isFavoritedForUI: returns override when set, settings otherwise', () => {
		const store = useMakeStore();
		// No override: falls back to settings favorites which include 'book'.
		expect(store.isFavoritedForUI('book')).toBe(true);
		// 'recipe' not in favorites.
		expect(store.isFavoritedForUI('recipe')).toBe(false);
	});

	it('event onTypeCreated: appends schema to types cache', () => {
		const store = useMakeStore();
		const handlers = (makeModule as unknown as { __captured: () => Record<string, ((payload: unknown) => void) | undefined> }).__captured();
		const NEW: TypeSchema = { ...BOOK, id: 'novel', name: 'Novel', instancesFolder: 'Novels' };
		handlers['onTypeCreated']?.({ schema: NEW });
		expect(store.types).toContainEqual(NEW);
	});

	it('event onTypeUpdated: replaces schema in types cache', () => {
		const store = useMakeStore();
		store.types = [BOOK];
		const handlers = (makeModule as unknown as { __captured: () => Record<string, ((payload: unknown) => void) | undefined> }).__captured();
		const UPDATED: TypeSchema = { ...BOOK, description: 'Updated' };
		handlers['onTypeUpdated']?.({ schema: UPDATED });
		expect(store.types[0]).toMatchObject({ description: 'Updated' });
	});

	it('event onTypeDeleted: removes schema and clears related maps', () => {
		const store = useMakeStore();
		store.types = [BOOK];
		const handlers = (makeModule as unknown as { __captured: () => Record<string, ((payload: unknown) => void) | undefined> }).__captured();
		handlers['onTypeDeleted']?.({ typeId: 'book' });
		expect(store.types).toEqual([]);
	});
});
