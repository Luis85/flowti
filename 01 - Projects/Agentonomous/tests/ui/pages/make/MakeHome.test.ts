import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import MakeHome from '../../../../src/ui/pages/make/MakeHome.vue';
import MakeTypes from '../../../../src/ui/pages/make/MakeTypes.vue';
import { MakeHomePage } from '../../../../src/ui/pages/make/MakeHome.po.js';
import { mountWithI18n } from '../../../__fixtures__/mount-with-i18n.js';
import type { TypeSchema } from '../../../../src/domain/make/type-schema.js';

const BOOK: TypeSchema = {
	id: 'book', name: 'Book', instancesFolder: 'Books', titleFieldName: 'title',
	fields: [{ kind: 'text', name: 'title', required: true }],
	createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z',
};

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
const mock = (makeModule as unknown as { __mock: { listTypes: ReturnType<typeof vi.fn> } }).__mock;

async function mountHome() {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/make', component: MakeHome },
			{ path: '/make/types', component: MakeTypes },
		],
	});
	await router.push('/make');
	await router.isReady();
	const wrapper = mountWithI18n(MakeHome, { router });
	return { wrapper, router, page: new MakeHomePage(wrapper.element as HTMLElement) };
}

describe('MakeHome', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		mock.listTypes.mockReset();
	});

	it('renders title and blurb', async () => {
		mock.listTypes.mockResolvedValue({ kind: 'ok', value: [BOOK] });
		const { page } = await mountHome();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.title).toContain('Make');
		expect(page.blurb.length).toBeGreaterThan(0);
	});

	it('shows the Browse types CTA when types exist', async () => {
		mock.listTypes.mockResolvedValue({ kind: 'ok', value: [BOOK] });
		const { page } = await mountHome();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.browseCta).not.toBeNull();
	});

	it('shows the empty-state copy and hides the CTA when no types exist', async () => {
		mock.listTypes.mockResolvedValue({ kind: 'ok', value: [] });
		const { page } = await mountHome();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.browseCta).toBeNull();
		expect(page.empty).not.toBeNull();
	});

	it('renders favorite chips for favorites present in types', async () => {
		mock.listTypes.mockResolvedValue({ kind: 'ok', value: [BOOK] });
		const { page } = await mountHome();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.favoriteChips.length).toBe(1);
		expect(page.favoriteChips[0]?.textContent).toContain('Book');
	});

	it('hides favorites section when no favorited types are loaded', async () => {
		mock.listTypes.mockResolvedValue({ kind: 'ok', value: [] });
		const { page } = await mountHome();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.favoritesHeading).toBeNull();
	});

	it('shows a spinner while typesLoading is true', async () => {
		mock.listTypes.mockReturnValue(new Promise(() => { /* never resolves */ }));
		const { page } = await mountHome();
		expect(page.spinner).not.toBeNull();
	});
});
