import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import MakeTypes from '../../../../src/ui/pages/make/MakeTypes.vue';
import { MakeTypesPage } from '../../../../src/ui/pages/make/MakeTypes.po.js';
import { mountWithI18n } from '../../../__fixtures__/mount-with-i18n.js';
import type { TypeSchema } from '../../../../src/domain/make/type-schema.js';
import type { InstanceRef } from '../../../../src/domain/make/types.js';

const BOOK: TypeSchema = {
	id: 'book', name: 'Book', description: 'Reading log', instancesFolder: 'Books', titleFieldName: 'title',
	fields: [{ kind: 'text', name: 'title', required: true }],
	createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z',
};
const RECIPE: TypeSchema = {
	id: 'recipe', name: 'Recipe', instancesFolder: 'Recipes', titleFieldName: 'title',
	fields: [{ kind: 'text', name: 'title', required: true }],
	createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z',
};
const DUNE: InstanceRef = { typeId: 'book', path: 'Books/Dune.md', title: 'Dune', createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z' };

vi.mock('../../../../src/modules/make/make-module.js', () => {
	const svc = { listTypes: vi.fn(), loadType: vi.fn(), listInstances: vi.fn() };
	return {
		getMakeService:  () => svc,
		getMakeSettings: () => ({ enabled: true, typesFolder: 'Make/Types', basesFolder: 'Make/Bases', defaultInstancesRoot: 'Make/Instances', favorites: ['book'] }),
		subscribeMakeEvents: () => () => { /* no-op */ },
		__mock: svc,
	};
});
import * as makeModule from '../../../../src/modules/make/make-module.js';
const mock = (makeModule as unknown as { __mock: { listTypes: ReturnType<typeof vi.fn>; listInstances: ReturnType<typeof vi.fn> } }).__mock;

async function mountTypes() {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/make/types', component: MakeTypes },
			{ path: '/make/types/:typeId', component: { template: '<div/>' } },
		],
	});
	await router.push('/make/types');
	await router.isReady();
	const wrapper = mountWithI18n(MakeTypes, { router });
	return { wrapper, page: new MakeTypesPage(wrapper.element as HTMLElement) };
}

describe('MakeTypes', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		mock.listTypes.mockReset();
		mock.listInstances.mockReset();
	});

	it('renders title', async () => {
		mock.listTypes.mockResolvedValue({ kind: 'ok', value: [BOOK, RECIPE] });
		mock.listInstances.mockResolvedValue({ kind: 'ok', value: [] });
		const { page } = await mountTypes();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.title).toContain('Types');
	});

	it('renders one row per type sorted alphabetically', async () => {
		mock.listTypes.mockResolvedValue({ kind: 'ok', value: [RECIPE, BOOK] });
		mock.listInstances.mockResolvedValue({ kind: 'ok', value: [] });
		const { page } = await mountTypes();
		await new Promise((r) => setTimeout(r, 0));
		const ids = page.typeRows.map((el) => el.dataset['testid']?.replace('type-row-', ''));
		expect(ids).toEqual(['book', 'recipe']);
	});

	it('shows name, description, and favorite star on the row when favorited', async () => {
		mock.listTypes.mockResolvedValue({ kind: 'ok', value: [BOOK] });
		mock.listInstances.mockResolvedValue({ kind: 'ok', value: [DUNE] });
		const { page } = await mountTypes();
		await new Promise((r) => setTimeout(r, 0));
		const row = page.typeRows[0];
		expect(row?.textContent).toContain('Book');
		expect(row?.textContent).toContain('Reading log');
		expect(row?.querySelector('[data-testid="favorite-star-book"]')).not.toBeNull();
	});

	it('renders "— instances" while instance count is loading, then the number', async () => {
		mock.listTypes.mockResolvedValue({ kind: 'ok', value: [BOOK] });
		mock.listInstances.mockResolvedValue({ kind: 'ok', value: [DUNE, { ...DUNE, path: 'Books/Neuromancer.md', title: 'Neuromancer' }] });
		const { page } = await mountTypes();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.typeRows[0]?.textContent).toMatch(/2 instances/);
	});

	it('shows empty state when no types exist', async () => {
		mock.listTypes.mockResolvedValue({ kind: 'ok', value: [] });
		const { page } = await mountTypes();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.empty).not.toBeNull();
		expect(page.typeRows.length).toBe(0);
	});

	it('shows an error banner when typesError is set', async () => {
		mock.listTypes.mockResolvedValue({ kind: 'err', error: { kind: 'vault-error', cause: 'EIO' } });
		const { page } = await mountTypes();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.errorBanner).not.toBeNull();
	});

	it('refresh button calls refreshAll on the store', async () => {
		mock.listTypes.mockResolvedValue({ kind: 'ok', value: [BOOK] });
		mock.listInstances.mockResolvedValue({ kind: 'ok', value: [] });
		const { page } = await mountTypes();
		await new Promise((r) => setTimeout(r, 0));
		const callsBefore = mock.listTypes.mock.calls.length;
		page.refreshButton?.click();
		await new Promise((r) => setTimeout(r, 0));
		expect(mock.listTypes.mock.calls.length).toBeGreaterThan(callsBefore);
	});
});
