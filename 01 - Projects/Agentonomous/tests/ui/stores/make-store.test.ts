import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { defineComponent, h } from 'vue';
import { mountWithI18n } from '../../__fixtures__/mount-with-i18n.js';
import { createFakeMakeContext, fakeMakeService } from '../../__fixtures__/fake-make-context.js';
import { fakeWorkspace } from '../../__fakes__/fake-ports.js';
import { MakeContextKey } from '../../../src/ui/make-context-key.js';
import { useMakeStore } from '../../../src/ui/stores/make-store.js';
import type { MakeEventHandlers } from '../../../src/modules/make/make-module.js';
import type { TypeSchema } from '../../../src/domain/make/type-schema.js';
import type { InstanceRef } from '../../../src/domain/make/types.js';
import type { CorruptTypeRef } from '../../../src/domain/make/errors.js';

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
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: { types: [BOOK], issues: [] } });
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
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: { types: [BOOK], issues: [] } });
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
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: { types: [BOOK], issues: [] } });
		const { store } = mountStore(createFakeMakeContext({ service: fakeMakeService({ listTypes }) }));
		await store.loadTypes();
		expect(store.getType('book')).toEqual(BOOK);
		expect(store.getType('missing')).toBeUndefined();
	});

	it('typesSortedByName sorts alphabetically', async () => {
		const ZEBRA: TypeSchema = { ...BOOK, id: 'zebra', name: 'Zebra', instancesFolder: 'Zebras' };
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: { types: [ZEBRA, BOOK], issues: [] } });
		const { store } = mountStore(createFakeMakeContext({ service: fakeMakeService({ listTypes }) }));
		await store.loadTypes();
		expect(store.typesSortedByName.map((t) => t.id)).toEqual(['book', 'zebra']);
	});

	it('instanceCountByTypeId returns undefined for types without loaded instances', async () => {
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: { types: [BOOK], issues: [] } });
		const listInstances = vi.fn().mockResolvedValue({ kind: 'ok', value: [DUNE, { ...DUNE, path: 'Books/Neuromancer.md', title: 'Neuromancer' }] });
		const { store } = mountStore(createFakeMakeContext({ service: fakeMakeService({ listTypes, listInstances }) }));
		await store.loadTypes();
		expect(store.instanceCountByTypeId.get('book')).toBeUndefined();
		await store.loadInstances('book');
		expect(store.instanceCountByTypeId.get('book')).toBe(2);
	});

	it('initially exposes empty issues ref', () => {
		const { store } = mountStore();
		expect(store.issues).toEqual([]);
	});

	it('loadTypes populates both types and issues from ListTypesResult', async () => {
		const issue: CorruptTypeRef = {
			path: 'Make/Types/broken.json',
			filename: 'broken.json',
			error: { kind: 'invalid-json', reason: 'unexpected token' },
		};
		const listTypes = vi.fn().mockResolvedValue({
			kind: 'ok',
			value: { types: [BOOK], issues: [issue] },
		});
		const { store } = mountStore(createFakeMakeContext({ service: fakeMakeService({ listTypes }) }));
		await store.loadTypes();
		expect(store.types).toHaveLength(1);
		expect(store.issues).toHaveLength(1);
		expect(store.issues[0]?.filename).toBe('broken.json');
	});

	it('favoriteTypes filters types by settings.favorites', async () => {
		const ZEBRA: TypeSchema = { ...BOOK, id: 'zebra', name: 'Zebra', instancesFolder: 'Zebras' };
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: { types: [BOOK, ZEBRA], issues: [] } });
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
		const updateType = vi.fn().mockResolvedValue({ kind: 'ok', value: { schema: BOOK } });
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
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: { types: [BOOK], issues: [] } });
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

describe('make-store — deleteCorruptFile', () => {
	const ISSUE: CorruptTypeRef = {
		path: 'Make/Types/x.json', filename: 'x.json',
		error: { kind: 'invalid-json', reason: 'bad' },
	};

	it('calls service.deleteCorruptFile and triggers loadTypes on success', async () => {
		const deleteCorruptFile = vi.fn().mockResolvedValue({ kind: 'ok', value: undefined });
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: { types: [], issues: [ISSUE] } });
		const { store } = mountStore(createFakeMakeContext({ service: fakeMakeService({ deleteCorruptFile, listTypes }) }));
		await store.loadTypes();
		const callsBefore = listTypes.mock.calls.length;
		const result = await store.deleteCorruptFile('Make/Types/x.json');
		expect(result.kind).toBe('ok');
		expect(deleteCorruptFile).toHaveBeenCalledWith('Make/Types/x.json');
		expect(listTypes.mock.calls.length).toBeGreaterThan(callsBefore);
	});

	it('does not refresh on failure', async () => {
		const deleteCorruptFile = vi.fn().mockResolvedValue({ kind: 'err', error: { kind: 'vault-error', cause: 'nope' } });
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: { types: [], issues: [] } });
		const { store } = mountStore(createFakeMakeContext({ service: fakeMakeService({ deleteCorruptFile, listTypes }) }));
		await store.loadTypes();
		const callsBefore = listTypes.mock.calls.length;
		const result = await store.deleteCorruptFile('Make/Types/x.json');
		expect(result.kind).toBe('err');
		expect(listTypes.mock.calls.length).toBe(callsBefore);
	});
});

describe('make-store — deleteInstance', () => {
	it('delegates to service.deleteInstance', async () => {
		const deleteInstance = vi.fn().mockResolvedValue({ kind: 'ok', value: undefined });
		const { store } = mountStore(createFakeMakeContext({ service: fakeMakeService({ deleteInstance }) }));
		const result = await store.deleteInstance('Books/Dune.md');
		expect(deleteInstance).toHaveBeenCalledWith('Books/Dune.md');
		expect(result.kind).toBe('ok');
	});
});

describe('make-store — instance lifecycle subscriptions', () => {
	it('reloads instances on make:instance-created', async () => {
		const listInstances = vi.fn().mockResolvedValue({ kind: 'ok', value: [] });
		const { handlers } = mountStore(createFakeMakeContext({ service: fakeMakeService({ listInstances }) }));
		const before = listInstances.mock.calls.length;
		handlers['onInstanceCreated']?.({ typeId: 'book', path: 'Books/Dune.md' });
		// Allow the async loadInstances to complete.
		await Promise.resolve();
		await Promise.resolve();
		expect(listInstances.mock.calls.length).toBeGreaterThan(before);
		expect(listInstances).toHaveBeenLastCalledWith('book');
	});

	it('reloads instances on make:instance-deleted', async () => {
		const listInstances = vi.fn().mockResolvedValue({ kind: 'ok', value: [] });
		const { handlers } = mountStore(createFakeMakeContext({ service: fakeMakeService({ listInstances }) }));
		const before = listInstances.mock.calls.length;
		handlers['onInstanceDeleted']?.({ typeId: 'book', path: 'Books/Dune.md' });
		await Promise.resolve();
		await Promise.resolve();
		expect(listInstances.mock.calls.length).toBeGreaterThan(before);
		expect(listInstances).toHaveBeenLastCalledWith('book');
	});

	it('reloads types on make:instances-moved (instancesFolder may have changed)', async () => {
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: { types: [], issues: [] } });
		const { handlers } = mountStore(createFakeMakeContext({ service: fakeMakeService({ listTypes }) }));
		const before = listTypes.mock.calls.length;
		handlers['onInstancesMoved']?.({
			typeId: 'book',
			report: { oldFolder: 'Books', newFolder: 'Library', movedCount: 2, failedMoves: [] },
		});
		await Promise.resolve();
		await Promise.resolve();
		expect(listTypes.mock.calls.length).toBeGreaterThan(before);
	});

	it('logs warning when subscription refresh rejects', async () => {
		const warnSpy = vi.fn();
		const logger = { debug: vi.fn(), info: vi.fn(), warn: warnSpy, error: vi.fn(), setLevel: vi.fn() };
		const listInstances = vi.fn().mockRejectedValue(new Error('boom'));
		const { handlers } = mountStore(createFakeMakeContext({
			service: fakeMakeService({ listInstances }),
			logger,
		}));
		handlers['onInstanceCreated']?.({ typeId: 'book', path: 'Books/Dune.md' });
		// Allow the catch to fire.
		await Promise.resolve();
		await Promise.resolve();
		expect(warnSpy).toHaveBeenCalled();
		expect(warnSpy.mock.calls[0]?.[0]).toBe('make-store');
		expect(String(warnSpy.mock.calls[0]?.[1])).toContain('boom');
	});
});

describe('make-store — createInstance', () => {
	const REF: InstanceRef = {
		typeId: 'book', path: 'Books/Dune.md', title: 'Dune',
		createdAt: '2026-04-19T00:00:00.000Z', updatedAt: '2026-04-19T00:00:00.000Z',
	};

	it('delegates to service and returns the Result', async () => {
		const createInstance = vi.fn().mockResolvedValue({ kind: 'ok', value: REF });
		const { store } = mountStore(createFakeMakeContext({ service: fakeMakeService({ createInstance }) }));
		const result = await store.createInstance('book', { title: 'Dune' }, null);
		expect(createInstance).toHaveBeenCalledWith('book', { title: 'Dune' }, null, undefined);
		expect(result.kind).toBe('ok');
	});

	it('forwards options.overwrite through', async () => {
		const createInstance = vi.fn().mockResolvedValue({ kind: 'ok', value: REF });
		const { store } = mountStore(createFakeMakeContext({ service: fakeMakeService({ createInstance }) }));
		await store.createInstance('book', { title: 'Dune' }, null, { overwrite: true });
		expect(createInstance).toHaveBeenCalledWith('book', { title: 'Dune' }, null, { overwrite: true });
	});
});

describe('make-store — openInstance', () => {
	it('delegates to ctx.workspace.openFile with default mode tab', async () => {
		const { port: workspace, calls } = fakeWorkspace();
		const { store } = mountStore(createFakeMakeContext({ workspace }));
		await store.openInstance('Books/dune.md');
		expect(calls).toEqual([{ path: 'Books/dune.md', mode: 'tab' }]);
	});

	it('honors explicit mode', async () => {
		const { port: workspace, calls } = fakeWorkspace();
		const { store } = mountStore(createFakeMakeContext({ workspace }));
		await store.openInstance('Books/dune.md', 'split');
		expect(calls).toEqual([{ path: 'Books/dune.md', mode: 'split' }]);
	});
});
