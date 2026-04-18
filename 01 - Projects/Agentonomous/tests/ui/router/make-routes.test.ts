import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createAppRouter } from '../../../src/ui/router/index.js';
import type { TypeSchema } from '../../../src/domain/make/type-schema.js';

const BOOK: TypeSchema = {
	id: 'book', name: 'Book', instancesFolder: 'Books', titleFieldName: 'title',
	fields: [{ kind: 'text', name: 'title', required: true }],
	createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z',
};

vi.mock('../../../src/modules/make/make-module.js', () => {
	const svc = { listTypes: vi.fn(), loadType: vi.fn(), listInstances: vi.fn() };
	return {
		getMakeService: () => svc,
		getMakeSettings: () => null,
		__mock: svc,
	};
});

import * as makeModule from '../../../src/modules/make/make-module.js';
const mock = (makeModule as unknown as { __mock: { listTypes: ReturnType<typeof vi.fn> } }).__mock;

describe('Make routes', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		mock.listTypes.mockReset();
	});

	it('registers /make, /make/types, /make/types/:typeId', () => {
		const router = createAppRouter();
		const names = router.getRoutes().map((r) => r.name).filter(Boolean);
		expect(names).toContain('make-home');
		expect(names).toContain('make-types');
		expect(names).toContain('make-type');
	});

	it('redirects /make/types/:typeId to /make/types when the typeId is unknown', async () => {
		mock.listTypes.mockResolvedValue({ kind: 'ok', value: [BOOK] });
		const router = createAppRouter();
		await router.push('/make/types/missing-id');
		await router.isReady();
		expect(router.currentRoute.value.name).toBe('make-types');
	});

	it('allows /make/types/:typeId when the typeId matches a known type', async () => {
		mock.listTypes.mockResolvedValue({ kind: 'ok', value: [BOOK] });
		const router = createAppRouter();
		await router.push('/make/types/book');
		await router.isReady();
		expect(router.currentRoute.value.name).toBe('make-type');
	});

	it('redirects to /make/types when typesError is set after loading', async () => {
		mock.listTypes.mockResolvedValue({ kind: 'err', error: { kind: 'vault-error', cause: 'EIO' } });
		const router = createAppRouter();
		await router.push('/make/types/book');
		await router.isReady();
		expect(router.currentRoute.value.name).toBe('make-types');
	});
});
