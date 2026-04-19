import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { flushPromises } from '@vue/test-utils';
import MakeHome from '../../../../src/ui/pages/make/MakeHome.vue';
import MakeTypes from '../../../../src/ui/pages/make/MakeTypes.vue';
import { MakeHomePage } from '../../../../src/ui/pages/make/MakeHome.po.js';
import { mountWithI18n } from '../../../__fixtures__/mount-with-i18n.js';
import { createFakeMakeContext, fakeMakeService } from '../../../__fixtures__/fake-make-context.js';
import { MakeContextKey } from '../../../../src/ui/make-context-key.js';
import { useMakeStore } from '../../../../src/ui/stores/make-store.js';
import type { TypeSchema } from '../../../../src/domain/make/type-schema.js';
import type { InstanceRef, KpiSnapshot } from '../../../../src/domain/make/types.js';
import type { MakeService } from '../../../../src/modules/make/make-service.js';

const BOOK: TypeSchema = {
	id: 'book', name: 'Book', instancesFolder: 'Books', titleFieldName: 'title',
	fields: [{ kind: 'text', name: 'title', required: true }],
	createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z',
};

const DUNE:  InstanceRef = { typeId: 'book', path: 'Books/Dune.md',  title: 'Dune',  createdAt: '2026-04-19T10:00:00.000Z', updatedAt: '2026-04-19T10:00:00.000Z' };
const NEURO: InstanceRef = { typeId: 'book', path: 'Books/Neuro.md', title: 'Neuro', createdAt: '2026-04-18T12:00:00.000Z', updatedAt: '2026-04-18T12:00:00.000Z' };

const EMPTY_KPIS:  KpiSnapshot = { typesCount: 0, instancesCount: 0, createdThisWeek: 0, perType: {},           recentlyCreated: [] };
const TYPES_ONLY:  KpiSnapshot = { typesCount: 1, instancesCount: 0, createdThisWeek: 0, perType: { book: 0 }, recentlyCreated: [] };
const POPULATED:   KpiSnapshot = { typesCount: 1, instancesCount: 12, createdThisWeek: 3, perType: { book: 12 }, recentlyCreated: [DUNE, NEURO] };

const NOW = new Date('2026-04-19T12:00:00.000Z');
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterAll(() => { vi.useRealTimers(); });

async function mountHome(opts: {
	listTypes?: MakeService['listTypes'];
	getKpis?:   MakeService['getKpis'];
} = {}) {
	const listTypes = opts.listTypes ?? vi.fn().mockResolvedValue({ kind: 'ok', value: { types: [BOOK], issues: [] } });
	const getKpis   = opts.getKpis   ?? vi.fn().mockResolvedValue(POPULATED);
	const ctx = createFakeMakeContext({
		service: fakeMakeService({ listTypes, getKpis }),
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
	const pinia = createPinia();
	setActivePinia(pinia);
	const wrapper = mountWithI18n(MakeHome, {
		router,
		provide: { [MakeContextKey as symbol]: ctx } as Record<PropertyKey, unknown>,
		plugins: [pinia],
	});
	const store = useMakeStore();
	return { wrapper, router, page: new MakeHomePage(wrapper.element as HTMLElement), store };
}

describe('MakeHome — existing behaviors preserved', () => {
	beforeEach(() => { setActivePinia(createPinia()); });

	it('renders title and blurb', async () => {
		const { page } = await mountHome();
		await flushPromises();
		expect(page.title).toContain('Make');
		expect(page.blurb.length).toBeGreaterThan(0);
	});

	it('shows empty-state copy + CTA when 0 types', async () => {
		const { page } = await mountHome({ listTypes: vi.fn().mockResolvedValue({ kind: 'ok', value: { types: [], issues: [] } }), getKpis: vi.fn().mockResolvedValue(EMPTY_KPIS) });
		await flushPromises();
		expect(page.empty).not.toBeNull();
		expect(page.createCtaEmpty).not.toBeNull();
		expect(page.createCtaEmpty?.getAttribute('href')).toBe('/make/types/new');
	});

	it('shows Browse + Create CTAs when types exist', async () => {
		const { page } = await mountHome();
		await flushPromises();
		expect(page.browseCta).not.toBeNull();
		expect(page.createCtaPopulated).not.toBeNull();
	});

	it('favorites chips render for favorites present in types', async () => {
		const { page } = await mountHome();
		await flushPromises();
		expect(page.favoriteChips.length).toBe(1);
		expect(page.favoriteChips[0]?.textContent).toContain('Book');
	});
});

describe('MakeHome — KPI row', () => {
	beforeEach(() => { setActivePinia(createPinia()); });

	it('does NOT render KPI row in the 0-types branch', async () => {
		const { page } = await mountHome({ listTypes: vi.fn().mockResolvedValue({ kind: 'ok', value: { types: [], issues: [] } }), getKpis: vi.fn().mockResolvedValue(EMPTY_KPIS) });
		await flushPromises();
		expect(page.kpiTypes).toBeNull();
	});

	it('renders 3 KPI tiles when types exist — Types / Instances / This week — with correct values', async () => {
		const { page } = await mountHome();
		await flushPromises();
		expect(page.kpiTypes).not.toBeNull();
		expect(page.kpiInstances).not.toBeNull();
		expect(page.kpiWeek).not.toBeNull();
		expect(page.kpiTypes?.textContent).toContain('1');
		expect(page.kpiInstances?.textContent).toContain('12');
		expect(page.kpiWeek?.textContent).toContain('3');
	});

	it('renders zeros in KPI tiles when types exist but 0 instances (TYPES_ONLY snapshot)', async () => {
		const { page } = await mountHome({ getKpis: vi.fn().mockResolvedValue(TYPES_ONLY) });
		await flushPromises();
		expect(page.kpiTypes?.textContent).toContain('1');
		expect(page.kpiInstances?.textContent).toContain('0');
		expect(page.kpiWeek?.textContent).toContain('0');
	});
});

describe('MakeHome — Recently created section', () => {
	beforeEach(() => { setActivePinia(createPinia()); });

	it('does NOT render section in the 0-types branch', async () => {
		const { page } = await mountHome({ listTypes: vi.fn().mockResolvedValue({ kind: 'ok', value: { types: [], issues: [] } }), getKpis: vi.fn().mockResolvedValue(EMPTY_KPIS) });
		await flushPromises();
		expect(page.recentHeading).toBeNull();
	});

	it('renders heading + placeholder when types exist but 0 instances', async () => {
		const { page } = await mountHome({ getKpis: vi.fn().mockResolvedValue(TYPES_ONLY) });
		await flushPromises();
		expect(page.recentHeading).not.toBeNull();
		expect(page.recentEmpty).not.toBeNull();
		expect(page.recentEmpty?.textContent?.length).toBeGreaterThan(0);
	});

	it('renders rows for the kpis.recentlyCreated list in order', async () => {
		const { page } = await mountHome();
		await flushPromises();
		expect(page.recentRows).toHaveLength(2);
		expect(page.recentRows[0]!.textContent).toContain('Dune');
		expect(page.recentRows[1]!.textContent).toContain('Neuro');
	});

	it('row click calls store.openInstance with the correct path and tab mode', async () => {
		const { wrapper, page, store } = await mountHome();
		const openSpy = vi.spyOn(store, 'openInstance').mockResolvedValue({ kind: 'ok', value: undefined });
		await flushPromises();
		(page.recentRows[0] as HTMLElement).click();
		await flushPromises();
		expect(openSpy).toHaveBeenCalledWith('Books/Dune.md', 'tab');
		wrapper.unmount();
	});

	it('row keyboard Enter calls store.openInstance with the correct path and tab mode', async () => {
		const { wrapper, page, store } = await mountHome();
		const openSpy = vi.spyOn(store, 'openInstance').mockResolvedValue({ kind: 'ok', value: undefined });
		await flushPromises();
		(page.recentRows[0] as HTMLElement).focus();
		(page.recentRows[0] as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		await flushPromises();
		expect(openSpy).toHaveBeenCalledWith('Books/Dune.md', 'tab');
		wrapper.unmount();
	});
});

describe('MakeHome — mount calls loadKpis', () => {
	beforeEach(() => { setActivePinia(createPinia()); });

	it('calls service.getKpis at mount (when types exist)', async () => {
		const getKpis = vi.fn().mockResolvedValue(POPULATED);
		await mountHome({ getKpis });
		await flushPromises();
		expect(getKpis).toHaveBeenCalled();
	});

	it('calls BOTH service.listTypes and service.getKpis at mount — types and KPIs load together', async () => {
		const listTypes = vi.fn().mockResolvedValue({ kind: 'ok', value: { types: [BOOK], issues: [] } }) as unknown as MakeService['listTypes'];
		const getKpis   = vi.fn().mockResolvedValue(POPULATED);
		await mountHome({ listTypes, getKpis });
		await flushPromises();
		expect(listTypes).toHaveBeenCalledTimes(1);
		expect(getKpis).toHaveBeenCalledTimes(1);
	});
});

describe('MakeHome — accessibility and i18n polish', () => {
	beforeEach(() => { setActivePinia(createPinia()); });

	it('KPI group carries a specific aria-label ("Key metrics"), not the page title', async () => {
		const { wrapper, page } = await mountHome();
		await flushPromises();
		const group = page.kpiGroup;
		expect(group).not.toBeNull();
		expect(group!.getAttribute('role')).toBe('group');
		expect(group!.getAttribute('aria-label')).toBe('Key metrics');
		wrapper.unmount();
	});

	it('KPI labels switch to singular form when count is 1 (types/instances)', async () => {
		const oneOfEach: KpiSnapshot = { typesCount: 1, instancesCount: 1, createdThisWeek: 0, perType: { book: 1 }, recentlyCreated: [] };
		const { page } = await mountHome({ getKpis: vi.fn().mockResolvedValue(oneOfEach) });
		await flushPromises();
		// Labels are next to the numeric value; value=1 should pair with singular "Type"/"Instance".
		expect(page.kpiTypes?.textContent).toContain('Type');
		expect(page.kpiTypes?.textContent).not.toContain('Types');
		expect(page.kpiInstances?.textContent).toContain('Instance');
		expect(page.kpiInstances?.textContent).not.toContain('Instances');
		expect(page.kpiWeek?.textContent).toContain('This week');
	});

	it('loading spinner uses the i18n key and exposes role=status + aria-live=polite', async () => {
		// Simulate a listTypes call that never resolves during the test — so
		// typesLoading stays true long enough to assert the spinner markup.
		const pending = new Promise<never>(() => { /* never resolves */ });
		const listTypes = vi.fn().mockReturnValue(pending) as unknown as MakeService['listTypes'];
		const { wrapper, page } = await mountHome({ listTypes });
		const spinner = page.spinner;
		expect(spinner).not.toBeNull();
		expect(spinner!.textContent?.trim()).toBe('Loading…');
		expect(spinner!.getAttribute('role')).toBe('status');
		expect(spinner!.getAttribute('aria-live')).toBe('polite');
		wrapper.unmount();
	});
});
