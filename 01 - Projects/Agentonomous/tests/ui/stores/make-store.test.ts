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
	const mock = {
		listTypes:     vi.fn(),
		loadType:      vi.fn(),
		listInstances: vi.fn(),
	};
	const settings = { enabled: true, typesFolder: 'Make/Types', basesFolder: 'Make/Bases', defaultInstancesRoot: 'Make/Instances', favorites: ['book'] };
	return {
		getMakeService:  () => mock,
		getMakeSettings: () => settings,
		__mock:          mock,
	};
});

import * as makeModule from '../../../src/modules/make/make-module.js';
const mock = (makeModule as unknown as { __mock: {
	listTypes: ReturnType<typeof vi.fn>;
	loadType: ReturnType<typeof vi.fn>;
	listInstances: ReturnType<typeof vi.fn>;
} }).__mock;

describe('make-store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		mock.listTypes.mockReset();
		mock.loadType.mockReset();
		mock.listInstances.mockReset();
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
		}));
		const { useMakeStore: useStoreReloaded } = await import('../../../src/ui/stores/make-store.js');
		const store = useStoreReloaded();
		await store.loadTypes();
		expect(store.typesError).toMatch(/not ready/);
	});
});
