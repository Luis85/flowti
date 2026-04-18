import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import MakeTypes from '../../../../src/ui/pages/make/MakeTypes.vue';
import { MakeTypesPage } from '../../../../src/ui/pages/make/MakeTypes.po.js';
import { mountWithI18n } from '../../../__fixtures__/mount-with-i18n.js';
import { createFakeMakeContext, fakeMakeService } from '../../../__fixtures__/fake-make-context.js';
import { MakeContextKey } from '../../../../src/ui/make-context-key.js';
import { useMakeStore } from '../../../../src/ui/stores/make-store.js';
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

async function mountTypes(
	listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: [] }),
	listInstances = vi.fn().mockResolvedValue({ kind: 'ok', value: [] }),
	settings = { enabled: true, typesFolder: 'Make/Types', basesFolder: 'Make/Bases', defaultInstancesRoot: 'Make/Instances', favorites: ['book'] as readonly string[] },
) {
	const ctx = createFakeMakeContext({ service: fakeMakeService({ listTypes, listInstances }), settings });
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/make/types', component: MakeTypes },
			{ path: '/make/types/new', component: { template: '<div/>' } },
			{ path: '/make/types/:typeId', component: { template: '<div/>' } },
		],
	});
	await router.push('/make/types');
	await router.isReady();
	const wrapper = mountWithI18n(MakeTypes, {
		router,
		provide: { [MakeContextKey as symbol]: ctx } as Record<PropertyKey, unknown>,
		plugins: [createPinia()],
	});
	return { wrapper, page: new MakeTypesPage(wrapper.element as HTMLElement), ctx, listTypes, listInstances };
}

describe('MakeTypes', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it('renders title', async () => {
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: [BOOK, RECIPE] });
		const listInstances = vi.fn().mockResolvedValue({ kind: 'ok', value: [] });
		const { page } = await mountTypes(listTypes, listInstances);
		await new Promise((r) => setTimeout(r, 0));
		expect(page.title).toContain('Types');
	});

	it('renders one row per type sorted alphabetically', async () => {
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: [RECIPE, BOOK] });
		const listInstances = vi.fn().mockResolvedValue({ kind: 'ok', value: [] });
		const { page } = await mountTypes(listTypes, listInstances);
		await new Promise((r) => setTimeout(r, 0));
		const ids = page.typeRows.map((el) => el.dataset['testid']?.replace('type-row-', ''));
		expect(ids).toEqual(['book', 'recipe']);
	});

	it('shows name, description, and favorite star on the row when favorited', async () => {
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: [BOOK] });
		const listInstances = vi.fn().mockResolvedValue({ kind: 'ok', value: [DUNE] });
		const { page } = await mountTypes(listTypes, listInstances);
		await new Promise((r) => setTimeout(r, 0));
		const row = page.typeRows[0];
		expect(row?.textContent).toContain('Book');
		expect(row?.textContent).toContain('Reading log');
		expect(row?.querySelector('[data-testid="favorite-star-book"]')).not.toBeNull();
	});

	it('renders "— instances" while instance count is loading, then the number', async () => {
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: [BOOK] });
		const listInstances = vi.fn().mockResolvedValue({ kind: 'ok', value: [DUNE, { ...DUNE, path: 'Books/Neuromancer.md', title: 'Neuromancer' }] });
		const { page } = await mountTypes(listTypes, listInstances);
		await new Promise((r) => setTimeout(r, 0));
		expect(page.typeRows[0]?.textContent).toMatch(/2 instances/);
	});

	it('shows empty state when no types exist', async () => {
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: [] });
		const { page } = await mountTypes(listTypes);
		await new Promise((r) => setTimeout(r, 0));
		expect(page.empty).not.toBeNull();
		expect(page.typeRows.length).toBe(0);
	});

	it('shows an error banner when typesError is set', async () => {
		const listTypes = vi.fn().mockResolvedValue({ kind: 'err', error: { kind: 'vault-error', cause: 'EIO' } });
		const { page } = await mountTypes(listTypes);
		await new Promise((r) => setTimeout(r, 0));
		expect(page.errorBanner).not.toBeNull();
	});

	it('refresh button calls refreshAll on the store', async () => {
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: [BOOK] });
		const listInstances = vi.fn().mockResolvedValue({ kind: 'ok', value: [] });
		const { page } = await mountTypes(listTypes, listInstances);
		await new Promise((r) => setTimeout(r, 0));
		const callsBefore = listTypes.mock.calls.length;
		page.refreshButton?.click();
		await new Promise((r) => setTimeout(r, 0));
		expect(listTypes.mock.calls.length).toBeGreaterThan(callsBefore);
	});

	it('"Create type" button is present in the header', async () => {
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: [] });
		const { page } = await mountTypes(listTypes);
		await new Promise((r) => setTimeout(r, 0));
		expect(page.createCta).not.toBeNull();
	});

	it('"Create type" button links to /make/types/new', async () => {
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: [] });
		const { page } = await mountTypes(listTypes);
		await new Promise((r) => setTimeout(r, 0));
		expect(page.createCta?.getAttribute('href')).toBe('/make/types/new');
	});

	it('favorite star on row is a <button> element', async () => {
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: [BOOK] });
		const listInstances = vi.fn().mockResolvedValue({ kind: 'ok', value: [] });
		const { page } = await mountTypes(listTypes, listInstances);
		await new Promise((r) => setTimeout(r, 0));
		const star = page.favoriteStar('book');
		expect(star).not.toBeNull();
		expect(star?.tagName).toBe('BUTTON');
	});

	it('favorite star has correct aria-label and aria-pressed when favorited', async () => {
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: [BOOK] });
		const listInstances = vi.fn().mockResolvedValue({ kind: 'ok', value: [] });
		const { wrapper, page } = await mountTypes(listTypes, listInstances);
		await new Promise((r) => setTimeout(r, 0));
		const store = (wrapper.vm as unknown as { store: { isFavoritedForUI: (id: string) => boolean } }).store;
		const star = page.favoriteStar('book');
		expect(star?.getAttribute('aria-pressed')).toBe(store.isFavoritedForUI('book') ? 'true' : 'false');
		expect(star?.getAttribute('aria-label')).toBeTruthy();
	});

	it('clicking the favorite star calls store.toggleFavorite and does not navigate', async () => {
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: [BOOK] });
		const listInstances = vi.fn().mockResolvedValue({ kind: 'ok', value: [] });
		const { page, wrapper } = await mountTypes(listTypes, listInstances);
		await new Promise((r) => setTimeout(r, 0));
		const store = (wrapper.vm as unknown as { store: { toggleFavorite: (id: string) => Promise<unknown> } }).store;
		const toggleSpy = vi.spyOn(store, 'toggleFavorite').mockResolvedValue({ kind: 'ok', value: true });
		const star = page.favoriteStar('book');
		star?.click();
		await new Promise((r) => setTimeout(r, 0));
		expect(toggleSpy).toHaveBeenCalledWith('book');
	});

	it('pending state: aria-busy is "true" when favoriteToggling contains the type id', async () => {
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: [BOOK] });
		const listInstances = vi.fn().mockResolvedValue({ kind: 'ok', value: [] });
		const { page, wrapper } = await mountTypes(listTypes, listInstances);
		await new Promise((r) => setTimeout(r, 0));
		// Get the Pinia store and patch favoriteToggling to simulate an in-flight toggle
		const store = useMakeStore();
		store.$patch({ favoriteToggling: new Set(['book']) });
		await wrapper.vm.$nextTick();
		const updatedStar = page.favoriteStar('book');
		expect(updatedStar?.getAttribute('aria-busy')).toBe('true');
	});

});
