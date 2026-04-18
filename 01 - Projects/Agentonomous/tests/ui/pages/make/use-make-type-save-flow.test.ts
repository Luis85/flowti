import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { createI18n, useI18n } from 'vue-i18n';
import enMessages from '../../../../src/modules/make/locales/en.json' with { type: 'json' };
import { useMakeStore } from '../../../../src/ui/stores/make-store.js';
import { useMakeTypeDraft } from '../../../../src/ui/pages/make/use-make-type-draft.js';
import { useMakeTypeSaveFlow } from '../../../../src/ui/pages/make/use-make-type-save-flow.js';
import type { TypeSchema } from '../../../../src/domain/make/type-schema.js';

vi.mock('../../../../src/modules/make/make-module.js', () => {
	const svc = {
		listTypes: vi.fn(),
		listInstances: vi.fn(),
		createType: vi.fn(),
		updateType: vi.fn(),
		deleteType: vi.fn(),
		regenerateBaseFile: vi.fn(),
		toggleFavorite: vi.fn(),
	};
	return {
		getMakeService: () => svc,
		getMakeSettings: () => ({ enabled: true, typesFolder: 'Make/Types', basesFolder: 'Make/Bases', defaultInstancesRoot: 'Make/Instances', favorites: [] }),
		subscribeMakeEvents: () => () => { /* no-op */ },
		__mock: svc,
	};
});
import * as makeModule from '../../../../src/modules/make/make-module.js';
const mock = (makeModule as unknown as {
	__mock: {
		createType: ReturnType<typeof vi.fn>;
		updateType: ReturnType<typeof vi.fn>;
		regenerateBaseFile: ReturnType<typeof vi.fn>;
		listTypes: ReturnType<typeof vi.fn>;
	};
}).__mock;

const BOOK: TypeSchema = {
	id: 'book', name: 'Book', description: 'Reading log', instancesFolder: 'Books', titleFieldName: 'title',
	fields: [{ kind: 'text', name: 'title', required: true }],
	createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z',
};

// Suppress unused import warning — useI18n needed only for type inference in tests
void useI18n;

function makeTFn(): (key: string, values?: Record<string, unknown>) => string {
	const i18n = createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { en: enMessages } });
	// Cast to access the t function from the global scope
	return (key: string, values?: Record<string, unknown>) =>
		(i18n.global.t as (k: string, v?: Record<string, unknown>) => string)(key, values);
}

async function setupEditFlow(path = '/make/types/book') {
	const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/make/types/:typeId', component: { template: '<div />' } }] });
	await router.push(path);
	await router.isReady();
	const store = useMakeStore();
	store.types = [BOOK];
	store.typesLoaded = true;
	const t = makeTFn();
	const route = router.currentRoute.value;
	const draftState = useMakeTypeDraft(route, store);
	const flow = useMakeTypeSaveFlow(store, draftState, router, t, undefined);
	return { router, store, draftState, flow };
}

describe('useMakeTypeSaveFlow', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		mock.createType?.mockReset();
		mock.updateType?.mockReset();
		mock.regenerateBaseFile?.mockReset();
		mock.listTypes?.mockReset();
		mock.listTypes?.mockResolvedValue({ kind: 'ok', value: [BOOK] });
	});

	it('onSave in edit-mode calls updateType and calls applyResult on success', async () => {
		const updated: TypeSchema = { ...BOOK, name: 'Book Updated' };
		mock.updateType.mockResolvedValue({ kind: 'ok', value: updated });
		const { flow, draftState } = await setupEditFlow();
		await flow.onSave();
		expect(mock.updateType).toHaveBeenCalledWith('book', expect.objectContaining({ name: 'Book' }), undefined);
		// After applyResult, draft matches the saved schema
		expect(draftState.draft.value.name).toBe('Book Updated');
	});

	it('duplicate-name error populates schemaErrors.name', async () => {
		mock.updateType.mockResolvedValue({ kind: 'err', error: { kind: 'duplicate-name', name: 'Book' } });
		const { flow } = await setupEditFlow();
		await flow.onSave();
		expect(flow.schemaErrors.value.name).toContain('Book');
	});

	it('field-rename-warning opens renameWarningOpen', async () => {
		mock.updateType.mockResolvedValue({
			kind: 'err',
			error: {
				kind: 'invalid-schema',
				issues: [{ kind: 'field-rename-warning', renames: [{ oldName: 'title', newName: 'heading', position: 0 }], affectedCount: 2 }],
			},
		});
		const { flow } = await setupEditFlow();
		await flow.onSave();
		expect(flow.renameWarningOpen.value).toBe(true);
		expect(flow.renameWarningBody.value).toContain('title');
		expect(flow.renameWarningBody.value).toContain('heading');
	});

	it('onRenameAcknowledge cancel does NOT call updateType again', async () => {
		mock.updateType.mockResolvedValue({
			kind: 'err',
			error: {
				kind: 'invalid-schema',
				issues: [{ kind: 'field-rename-warning', renames: [{ oldName: 'a', newName: 'b', position: 0 }], affectedCount: 1 }],
			},
		});
		const { flow } = await setupEditFlow();
		await flow.onSave();
		const callsBefore = mock.updateType.mock.calls.length;
		await flow.onRenameAcknowledge('cancel');
		expect(mock.updateType.mock.calls.length).toBe(callsBefore);
		expect(flow.renameWarningOpen.value).toBe(false);
	});

	it('onRenameAcknowledge confirm re-calls updateType with acknowledgeRenames', async () => {
		mock.updateType
			.mockResolvedValueOnce({
				kind: 'err',
				error: {
					kind: 'invalid-schema',
					issues: [{ kind: 'field-rename-warning', renames: [{ oldName: 'a', newName: 'b', position: 0 }], affectedCount: 1 }],
				},
			})
			.mockResolvedValueOnce({ kind: 'ok', value: BOOK });
		const { flow } = await setupEditFlow();
		await flow.onSave();
		await flow.onRenameAcknowledge('confirm');
		expect(mock.updateType).toHaveBeenCalledTimes(2);
		expect(mock.updateType).toHaveBeenLastCalledWith('book', expect.any(Object), { acknowledgeRenames: true });
	});

	it('user-edited regenerate error sets overwriteWarningOpen', async () => {
		mock.regenerateBaseFile.mockResolvedValue({
			kind: 'err',
			error: { kind: 'base-generation-failed', cause: 'user-edited' },
		});
		const { flow } = await setupEditFlow();
		await flow.onRegenerate();
		expect(flow.overwriteWarningOpen.value).toBe(true);
	});

	it('onOverwriteConfirm confirm re-calls onRegenerate with force=true', async () => {
		mock.regenerateBaseFile
			.mockResolvedValueOnce({ kind: 'err', error: { kind: 'base-generation-failed', cause: 'user-edited' } })
			.mockResolvedValueOnce({ kind: 'ok', value: 'Make/Bases/book.md' });
		mock.listTypes.mockResolvedValue({ kind: 'ok', value: [BOOK] });
		const { flow } = await setupEditFlow();
		await flow.onRegenerate();
		await flow.onOverwriteConfirm('confirm');
		expect(mock.regenerateBaseFile).toHaveBeenCalledTimes(2);
		expect(mock.regenerateBaseFile).toHaveBeenLastCalledWith('book', { force: true });
	});

	it('onOverwriteConfirm cancel does NOT re-call regenerate', async () => {
		mock.regenerateBaseFile.mockResolvedValue({
			kind: 'err', error: { kind: 'base-generation-failed', cause: 'user-edited' },
		});
		const { flow } = await setupEditFlow();
		await flow.onRegenerate();
		const callsBefore = mock.regenerateBaseFile.mock.calls.length;
		await flow.onOverwriteConfirm('cancel');
		expect(mock.regenerateBaseFile.mock.calls.length).toBe(callsBefore);
	});
});
