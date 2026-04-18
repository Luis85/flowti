import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import MakeType from '../../../../src/ui/pages/make/MakeType.vue';
import MakeTypes from '../../../../src/ui/pages/make/MakeTypes.vue';
import { MakeTypePage } from '../../../../src/ui/pages/make/MakeType.po.js';
import { mountWithI18n } from '../../../__fixtures__/mount-with-i18n.js';
import { useMakeStore } from '../../../../src/ui/stores/make-store.js';
import type { TypeSchema } from '../../../../src/domain/make/type-schema.js';
import type { InstanceRef } from '../../../../src/domain/make/types.js';

const BOOK: TypeSchema = {
	id: 'book', name: 'Book', description: 'Reading log', instancesFolder: 'Books', titleFieldName: 'title',
	fields: [
		{ kind: 'text', name: 'title', required: true },
		{ kind: 'text', name: 'author', required: false },
		{ kind: 'number', name: 'pages', required: false, description: 'Page count' },
	],
	createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z',
};
const DUNE: InstanceRef = { typeId: 'book', path: 'Books/Dune.md', title: 'Dune', createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z' };
const NEURO: InstanceRef = { typeId: 'book', path: 'Books/Neuromancer.md', title: 'Neuromancer', createdAt: '2026-04-19T00:00:00.000Z', updatedAt: '2026-04-19T00:00:00.000Z' };

vi.mock('../../../../src/modules/make/make-module.js', () => {
	const svc = { listTypes: vi.fn(), loadType: vi.fn(), listInstances: vi.fn() };
	return {
		getMakeService:  () => svc,
		getMakeSettings: () => ({ enabled: true, typesFolder: 'Make/Types', basesFolder: 'Make/Bases', defaultInstancesRoot: 'Make/Instances', favorites: [] }),
		subscribeMakeEvents: () => () => { /* no-op */ },
		__mock: svc,
	};
});
import * as makeModule from '../../../../src/modules/make/make-module.js';
const mock = (makeModule as unknown as { __mock: { listTypes: ReturnType<typeof vi.fn>; listInstances: ReturnType<typeof vi.fn> } }).__mock;

async function mountTypePage(initialPath = '/make/types/book') {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/make/types', component: MakeTypes },
			{ path: '/make/types/:typeId', component: MakeType },
		],
	});
	await router.push(initialPath);
	await router.isReady();
	const wrapper = mountWithI18n(MakeType, { router });
	return { wrapper, router, page: new MakeTypePage(wrapper.element as HTMLElement) };
}

describe('MakeType', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		mock.listTypes.mockReset();
		mock.listInstances.mockReset();
		mock.listTypes.mockResolvedValue({ kind: 'ok', value: [BOOK] });
		mock.listInstances.mockResolvedValue({ kind: 'ok', value: [DUNE, NEURO] });
		const s = useMakeStore();
		s.types = [BOOK];
		s.typesLoaded = true;
	});

	it('renders header with type name and folder', async () => {
		const { page } = await mountTypePage();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.title).toContain('Book');
		expect(page.folder).toContain('Books');
	});

	it('defaults to the Instances tab when no hash is present', async () => {
		const { page } = await mountTypePage();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.activeTab).toBe('instances');
		expect(page.instanceRows.length).toBeGreaterThan(0);
	});

	it('selects the Fields tab on mount when url hash is #fields (hash-restore)', async () => {
		const { page } = await mountTypePage('/make/types/book#fields');
		await new Promise((r) => setTimeout(r, 0));
		expect(page.activeTab).toBe('fields');
		expect(page.fieldRows.length).toBe(BOOK.fields.length);
	});

	it('clicking a tab updates route.hash', async () => {
		const { router, page } = await mountTypePage();
		await new Promise((r) => setTimeout(r, 0));
		page.fieldsTabButton?.click();
		await new Promise((r) => setTimeout(r, 0));
		expect(router.currentRoute.value.hash).toBe('#fields');
		page.instancesTabButton?.click();
		await new Promise((r) => setTimeout(r, 0));
		expect(router.currentRoute.value.hash).toBe('#instances');
	});

	it('Fields tab marks the title field', async () => {
		const { page } = await mountTypePage('/make/types/book#fields');
		await new Promise((r) => setTimeout(r, 0));
		const titleRow = page.fieldRows.find((r) => r.getAttribute('data-testid') === 'field-row-title');
		expect(titleRow?.querySelector('[data-testid="field-row-title-title-badge"]')).not.toBeNull();
	});

	it('Instances tab sorts by createdAt descending', async () => {
		const { page } = await mountTypePage();
		await new Promise((r) => setTimeout(r, 0));
		const titles = page.instanceRows.map((r) => r.dataset['testid']?.replace('instance-row-', ''));
		expect(titles[0]).toBe('Books/Neuromancer.md');
		expect(titles[1]).toBe('Books/Dune.md');
	});

	it('Fields tab shows empty state when type.fields is empty', async () => {
		const empty: TypeSchema = { ...BOOK, fields: [] };
		const s = useMakeStore();
		s.types = [empty];
		const { page } = await mountTypePage('/make/types/book#fields');
		await new Promise((r) => setTimeout(r, 0));
		expect(page.fieldsEmpty).not.toBeNull();
	});

	it('Instances tab shows empty state when instances list is empty', async () => {
		mock.listInstances.mockResolvedValue({ kind: 'ok', value: [] });
		const { page } = await mountTypePage();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.instancesEmpty).not.toBeNull();
	});

	it('Instances tab shows the error when instancesError is set', async () => {
		mock.listInstances.mockResolvedValue({ kind: 'err', error: { kind: 'vault-error', cause: 'EIO' } });
		const { page } = await mountTypePage();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.instancesError).not.toBeNull();
		expect(page.instancesError?.textContent).toContain('vault-error');
	});

	it('Instances tab shows loading indicator while fetching', async () => {
		mock.listInstances.mockReturnValue(new Promise(() => { /* hang */ }));
		const { page } = await mountTypePage();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.instancesLoading).not.toBeNull();
	});
});
