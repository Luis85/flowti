import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { useMakeTypeDraft } from '../../../../src/ui/pages/make/use-make-type-draft.js';
import { useMakeStore } from '../../../../src/ui/stores/make-store.js';
import { createFakeMakeContext } from '../../../__fixtures__/fake-make-context.js';
import { MakeContextKey } from '../../../../src/ui/make-context-key.js';
import type { TypeSchema } from '../../../../src/domain/make/type-schema.js';

const BOOK: TypeSchema = {
	id: 'book', name: 'Book', instancesFolder: 'Books', titleFieldName: 'title',
	fields: [{ kind: 'text', name: 'title', required: true }],
	createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z',
};

async function mountComposable(initialPath: string, seedTypes: TypeSchema[] = []) {
	const router = createRouter({ history: createMemoryHistory(), routes: [
		{ path: '/make/types/new', name: 'make-type-new', component: { template: '<div/>' } },
		{ path: '/make/types/:typeId', name: 'make-type', component: { template: '<div/>' } },
	]});
	await router.push(initialPath);
	await router.isReady();
	const ctx = createFakeMakeContext();
	let captured!: ReturnType<typeof useMakeTypeDraft>;
	const TestComp = defineComponent({
		setup() {
			const store = useMakeStore();
			store.types = seedTypes;
			captured = useMakeTypeDraft(router.currentRoute.value, store);
			return () => h('div');
		},
	});
	mount(TestComp, {
		global: {
			plugins: [router, createPinia()],
			provide: { [MakeContextKey as symbol]: ctx } as Record<PropertyKey, unknown>,
		},
	});
	return captured;
}

describe('useMakeTypeDraft', () => {
	beforeEach(() => { setActivePinia(createPinia()); });

	it('new-mode: seeds one text field named "title" with titleFieldName="title"', async () => {
		const result = await mountComposable('/make/types/new');
		expect(result.isNewMode.value).toBe(true);
		expect(result.draft.value.fields).toHaveLength(1);
		expect(result.draft.value.fields[0]).toMatchObject({ kind: 'text', name: 'title' });
		expect(result.draft.value.titleFieldName).toBe('title');
	});

	it('new-mode: isDirty is true from the start (even with pristine seed)', async () => {
		const result = await mountComposable('/make/types/new');
		expect(result.isDirty.value).toBe(true);
	});

	it('edit-mode: seeds draft from committed type', async () => {
		const result = await mountComposable('/make/types/book', [BOOK]);
		expect(result.isNewMode.value).toBe(false);
		expect(result.draft.value.name).toBe('Book');
		expect(result.draft.value.fields).toEqual(BOOK.fields);
	});

	it('edit-mode: isDirty starts false; flips true when draft changes', async () => {
		const result = await mountComposable('/make/types/book', [BOOK]);
		expect(result.isDirty.value).toBe(false);
		result.draft.value = { ...result.draft.value, name: 'Book Review' };
		expect(result.isDirty.value).toBe(true);
	});

	it('applyResult: resets draft to the saved schema; clears isDirty', async () => {
		const result = await mountComposable('/make/types/book', [BOOK]);
		result.draft.value = { ...result.draft.value, name: 'Modified' };
		expect(result.isDirty.value).toBe(true);
		const saved: TypeSchema = { ...BOOK, name: 'Modified', updatedAt: '2026-04-19T00:00:00.000Z' };
		result.applyResult(saved);
		expect(result.draft.value.name).toBe('Modified');
		expect(result.isDirty.value).toBe(false);
	});
});
