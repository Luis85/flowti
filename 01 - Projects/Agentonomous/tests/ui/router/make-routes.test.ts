import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { defineComponent, h } from 'vue';
import { mountWithI18n } from '../../__fixtures__/mount-with-i18n.js';
import { createFakeMakeContext, fakeMakeService } from '../../__fixtures__/fake-make-context.js';
import { MakeContextKey } from '../../../src/ui/make-context-key.js';
import { useMakeStore } from '../../../src/ui/stores/make-store.js';
import { createAppRouter } from '../../../src/ui/router/index.js';
import type { TypeSchema } from '../../../src/domain/make/type-schema.js';

const BOOK: TypeSchema = {
	id: 'book', name: 'Book', instancesFolder: 'Books', titleFieldName: 'title',
	fields: [{ kind: 'text', name: 'title', required: true }],
	createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z',
};

// Per-test service spy.
let listTypesSpy: ReturnType<typeof vi.fn>;

/**
 * Create a router and prime the Pinia store by mounting a component inside
 * an app that provides MakeContextKey. The route guard calls useMakeStore()
 * outside setup; Pinia returns the cached instance after first initialization.
 */
async function createPrimedRouter() {
	const pinia = createPinia();
	const ctx = createFakeMakeContext({
		service: fakeMakeService({ listTypes: listTypesSpy }),
	});
	const router = createAppRouter();

	// Mount a component with MakeContextKey provided so the Pinia setup store
	// initialises (inject resolves during setup) and caches its instance.
	mountWithI18n(
		defineComponent({ setup() { useMakeStore(); return () => h('div'); } }),
		{
			provide: { [MakeContextKey as symbol]: ctx } as Record<PropertyKey, unknown>,
			plugins: [pinia, router],
		},
	);

	return { router, ctx, pinia };
}

describe('Make routes', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		listTypesSpy = vi.fn();
	});

	it('registers /make, /make/types, /make/types/:typeId', () => {
		const router = createAppRouter();
		const names = router.getRoutes().map((r) => r.name).filter(Boolean);
		expect(names).toContain('make-home');
		expect(names).toContain('make-types');
		expect(names).toContain('make-type');
	});

	it('redirects /make/types/:typeId to /make/types when the typeId is unknown', async () => {
		listTypesSpy.mockResolvedValue({ kind: 'ok', value: { types: [BOOK], issues: [] } });
		const { router } = await createPrimedRouter();
		await router.push('/make/types/missing-id');
		await router.isReady();
		expect(router.currentRoute.value.name).toBe('make-types');
	});

	it('allows /make/types/:typeId when the typeId matches a known type', async () => {
		listTypesSpy.mockResolvedValue({ kind: 'ok', value: { types: [BOOK], issues: [] } });
		const { router } = await createPrimedRouter();
		await router.push('/make/types/book');
		await router.isReady();
		expect(router.currentRoute.value.name).toBe('make-type');
	});

	it('redirects to /make/types when typesError is set after loading', async () => {
		listTypesSpy.mockResolvedValue({ kind: 'err', error: { kind: 'vault-error', cause: 'EIO' } });
		const { router } = await createPrimedRouter();
		await router.push('/make/types/book');
		await router.isReady();
		expect(router.currentRoute.value.name).toBe('make-types');
	});

	it('registers /make/types/new BEFORE /make/types/:typeId (declaration order)', () => {
		const router = createAppRouter();
		const routes = router.getRoutes();
		const newIdx = routes.findIndex((r) => r.name === 'make-type-new');
		const dynIdx = routes.findIndex((r) => r.name === 'make-type');
		expect(newIdx).toBeGreaterThanOrEqual(0);
		expect(dynIdx).toBeGreaterThanOrEqual(0);
		expect(newIdx).toBeLessThan(dynIdx);
	});

	it('/make/types/new resolves to make-type-new (not captured as :typeId="new")', async () => {
		listTypesSpy.mockResolvedValue({ kind: 'ok', value: { types: [], issues: [] } });
		const { router } = await createPrimedRouter();
		await router.push('/make/types/new');
		await router.isReady();
		expect(router.currentRoute.value.name).toBe('make-type-new');
	});
});
