import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import MakeHome from '../../../../src/ui/pages/make/MakeHome.vue';
import MakeTypes from '../../../../src/ui/pages/make/MakeTypes.vue';
import { MakeHomePage } from '../../../../src/ui/pages/make/MakeHome.po.js';
import { mountWithI18n } from '../../../__fixtures__/mount-with-i18n.js';
import { createFakeMakeContext, fakeMakeService } from '../../../__fixtures__/fake-make-context.js';
import { MakeContextKey } from '../../../../src/ui/make-context-key.js';
import type { TypeSchema } from '../../../../src/domain/make/type-schema.js';

const BOOK: TypeSchema = {
	id: 'book', name: 'Book', instancesFolder: 'Books', titleFieldName: 'title',
	fields: [{ kind: 'text', name: 'title', required: true }],
	createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z',
};

// Per-test service spy — set in each test.
let listTypesSpy: ReturnType<typeof vi.fn>;

async function mountHome() {
	const ctx = createFakeMakeContext({
		service: fakeMakeService({ listTypes: listTypesSpy }),
		settings: { enabled: true, typesFolder: 'Make/Types', basesFolder: 'Make/Bases', defaultInstancesRoot: 'Make/Instances', favorites: ['book'] },
	});
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/make', component: MakeHome },
			{ path: '/make/types', component: MakeTypes },
			{ path: '/make/types/new', component: { template: '<div/>' } },
		],
	});
	await router.push('/make');
	await router.isReady();
	const wrapper = mountWithI18n(MakeHome, {
		router,
		provide: { [MakeContextKey as symbol]: ctx } as Record<PropertyKey, unknown>,
		plugins: [createPinia()],
	});
	return { wrapper, router, page: new MakeHomePage(wrapper.element as HTMLElement) };
}

describe('MakeHome', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		listTypesSpy = vi.fn();
	});

	it('renders title and blurb', async () => {
		listTypesSpy.mockResolvedValue({ kind: 'ok', value: { types: [BOOK], issues: [] } });
		const { page } = await mountHome();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.title).toContain('Make');
		expect(page.blurb.length).toBeGreaterThan(0);
	});

	it('shows the Browse types CTA when types exist', async () => {
		listTypesSpy.mockResolvedValue({ kind: 'ok', value: { types: [BOOK], issues: [] } });
		const { page } = await mountHome();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.browseCta).not.toBeNull();
	});

	it('shows the empty-state copy and hides the CTA when no types exist', async () => {
		listTypesSpy.mockResolvedValue({ kind: 'ok', value: { types: [], issues: [] } });
		const { page } = await mountHome();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.browseCta).toBeNull();
		expect(page.empty).not.toBeNull();
	});

	it('renders favorite chips for favorites present in types', async () => {
		listTypesSpy.mockResolvedValue({ kind: 'ok', value: { types: [BOOK], issues: [] } });
		const { page } = await mountHome();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.favoriteChips.length).toBe(1);
		expect(page.favoriteChips[0]?.textContent).toContain('Book');
	});

	it('hides favorites section when no favorited types are loaded', async () => {
		listTypesSpy.mockResolvedValue({ kind: 'ok', value: { types: [], issues: [] } });
		const { page } = await mountHome();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.favoritesHeading).toBeNull();
	});

	it('shows a spinner while typesLoading is true', async () => {
		listTypesSpy.mockReturnValue(new Promise(() => { /* never resolves */ }));
		const { page } = await mountHome();
		expect(page.spinner).not.toBeNull();
	});

	it('shows "Create type" button in empty state (testid make-home-create-cta-empty)', async () => {
		listTypesSpy.mockResolvedValue({ kind: 'ok', value: { types: [], issues: [] } });
		const { page } = await mountHome();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.createCtaEmpty).not.toBeNull();
	});

	it('"Create type" empty-state button links to /make/types/new', async () => {
		listTypesSpy.mockResolvedValue({ kind: 'ok', value: { types: [], issues: [] } });
		const { page } = await mountHome();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.createCtaEmpty?.getAttribute('href')).toBe('/make/types/new');
	});

	it('shows "Create type" button beside Browse CTA when types exist (testid make-home-create-cta-populated)', async () => {
		listTypesSpy.mockResolvedValue({ kind: 'ok', value: { types: [BOOK], issues: [] } });
		const { page } = await mountHome();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.createCtaPopulated).not.toBeNull();
	});

	it('"Create type" populated-state button links to /make/types/new', async () => {
		listTypesSpy.mockResolvedValue({ kind: 'ok', value: { types: [BOOK], issues: [] } });
		const { page } = await mountHome();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.createCtaPopulated?.getAttribute('href')).toBe('/make/types/new');
	});

	it('"Create type" populated-state button is hidden when no types exist', async () => {
		listTypesSpy.mockResolvedValue({ kind: 'ok', value: { types: [], issues: [] } });
		const { page } = await mountHome();
		await new Promise((r) => setTimeout(r, 0));
		expect(page.createCtaPopulated).toBeNull();
	});

});
