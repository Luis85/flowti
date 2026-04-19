import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import MakeTypeInstances from '../../../../src/ui/pages/make/MakeTypeInstances.vue';
import { MakeTypeInstancesPage } from '../../../../src/ui/pages/make/MakeTypeInstances.po.js';
import { mountWithI18n } from '../../../__fixtures__/mount-with-i18n.js';
import { createFakeMakeContext, fakeMakeService } from '../../../__fixtures__/fake-make-context.js';
import { MakeContextKey } from '../../../../src/ui/make-context-key.js';
import { useMakeStore } from '../../../../src/ui/stores/make-store.js';
import { ok, err } from '../../../../src/domain/shared/result.js';
import type { TypeSchema } from '../../../../src/domain/make/type-schema.js';
import type { InstanceRef } from '../../../../src/domain/make/types.js';

const BOOK: TypeSchema = {
	id: 'book',
	name: 'Book',
	description: 'Reading log',
	instancesFolder: 'Books',
	titleFieldName: 'title',
	fields: [
		{ kind: 'text', name: 'title',  required: true },
		{ kind: 'text', name: 'author', required: false },
	],
	createdAt: '2026-04-18T00:00:00.000Z',
	updatedAt: '2026-04-18T00:00:00.000Z',
};

const SAMPLE_INSTANCE: InstanceRef = {
	typeId: 'book',
	path: 'Books/Dune.md',
	title: 'Dune',
	createdAt: '2026-04-19T00:00:00.000Z',
	updatedAt: '2026-04-19T00:00:00.000Z',
};

const NOTE_NO_TITLE: TypeSchema = {
	id: 'note',
	name: 'Note',
	instancesFolder: 'Notes',
	titleFieldName: null,
	fields: [{ kind: 'text', name: 'body', required: false }],
	createdAt: '2026-04-18T00:00:00.000Z',
	updatedAt: '2026-04-18T00:00:00.000Z',
};

let createInstanceSpy: ReturnType<typeof vi.fn>;

function mountPage(opts: {
	type?: TypeSchema;
	instances?: readonly InstanceRef[] | undefined;
	loading?: boolean;
	error?: string | null;
} = {}) {
	const ctx = createFakeMakeContext({
		service: fakeMakeService({ createInstance: createInstanceSpy }),
	});
	const pinia = createPinia();
	const wrapper = mountWithI18n(MakeTypeInstances, {
		props: {
			type:      opts.type      ?? BOOK,
			instances: opts.instances,
			loading:   opts.loading   ?? false,
			error:     opts.error     ?? null,
		},
		provide: { [MakeContextKey as symbol]: ctx } as Record<PropertyKey, unknown>,
		plugins: [pinia],
		attachTo: document.body,
	});
	setActivePinia(pinia);
	const page = new MakeTypeInstancesPage(wrapper.element as HTMLElement);
	const store = useMakeStore();
	return { wrapper, page, store, ctx };
}

describe('MakeTypeInstances — create form', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		createInstanceSpy = vi.fn();
		document.body.innerHTML = '';
	});

	it('[+ New instance] button toggles the panel', async () => {
		const { wrapper, page } = mountPage({ instances: [SAMPLE_INSTANCE] });
		expect(page.createPanel).toBeNull();
		page.newInstanceButton?.click();
		await nextTick();
		expect(page.createPanel).not.toBeNull();
		page.newInstanceButton?.click();
		await nextTick();
		expect(page.createPanel).toBeNull();
		wrapper.unmount();
	});

	it('panel auto-opens when instances list is empty', async () => {
		const { wrapper, page } = mountPage({ instances: [] });
		await nextTick();
		expect(page.createPanel).not.toBeNull();
		wrapper.unmount();
	});

	it('successful submit calls store.createInstance with typeId, raw values and explicitFilename=null', async () => {
		createInstanceSpy.mockResolvedValue(ok(SAMPLE_INSTANCE));
		const { wrapper, page, store } = mountPage({ instances: [SAMPLE_INSTANCE] });
		const spy = vi.spyOn(store, 'createInstance');
		page.newInstanceButton?.click();
		await nextTick();
		const titleInput = page.form.titleInput;
		expect(titleInput).not.toBeNull();
		titleInput!.value = 'Dune';
		titleInput!.dispatchEvent(new Event('input'));
		await nextTick();
		page.form.submitButton?.click();
		await flushPromises();
		expect(spy).toHaveBeenCalledWith('book', expect.objectContaining({ title: 'Dune' }), null);
		wrapper.unmount();
	});

	it('instance-exists shows OverwriteDialog; Overwrite button re-submits with overwrite: true', async () => {
		createInstanceSpy
			.mockResolvedValueOnce(err({ kind: 'instance-exists', path: 'Books/Dune.md' }))
			.mockResolvedValueOnce(ok(SAMPLE_INSTANCE));
		const { wrapper, page, store } = mountPage({ instances: [SAMPLE_INSTANCE] });
		const spy = vi.spyOn(store, 'createInstance');
		page.newInstanceButton?.click();
		await nextTick();
		page.form.titleInput!.value = 'Dune';
		page.form.titleInput!.dispatchEvent(new Event('input'));
		await nextTick();
		page.form.submitButton?.click();
		await flushPromises();
		expect(page.overwriteDialog.dialog).not.toBeNull();
		page.overwriteDialog.overwriteButton?.click();
		await flushPromises();
		expect(spy).toHaveBeenLastCalledWith('book', expect.objectContaining({ title: 'Dune' }), null, { overwrite: true });
		expect(page.overwriteDialog.dialog).toBeNull();
		wrapper.unmount();
	});

	it('OverwriteDialog Cancel clears the dialog without re-submitting', async () => {
		createInstanceSpy.mockResolvedValue(err({ kind: 'instance-exists', path: 'Books/Dune.md' }));
		const { wrapper, page, store } = mountPage({ instances: [SAMPLE_INSTANCE] });
		const spy = vi.spyOn(store, 'createInstance');
		page.newInstanceButton?.click();
		await nextTick();
		page.form.titleInput!.value = 'Dune';
		page.form.titleInput!.dispatchEvent(new Event('input'));
		await nextTick();
		page.form.submitButton?.click();
		await flushPromises();
		expect(page.overwriteDialog.dialog).not.toBeNull();
		const callsBefore = spy.mock.calls.length;
		page.overwriteDialog.cancelButton?.click();
		await flushPromises();
		expect(page.overwriteDialog.dialog).toBeNull();
		expect(spy.mock.calls.length).toBe(callsBefore);
		wrapper.unmount();
	});

	it('OverwriteDialog "Choose different name" focuses the title input', async () => {
		createInstanceSpy.mockResolvedValue(err({ kind: 'instance-exists', path: 'Books/Dune.md' }));
		const { wrapper, page } = mountPage({ instances: [SAMPLE_INSTANCE] });
		page.newInstanceButton?.click();
		await nextTick();
		page.form.titleInput!.value = 'Dune';
		page.form.titleInput!.dispatchEvent(new Event('input'));
		await nextTick();
		page.form.submitButton?.click();
		await flushPromises();
		expect(page.overwriteDialog.dialog).not.toBeNull();
		page.overwriteDialog.renameButton?.click();
		await flushPromises();
		expect(page.overwriteDialog.dialog).toBeNull();
		expect(document.activeElement).toBe(page.form.titleInput);
		wrapper.unmount();
	});

	it('closes the panel after a successful submit', async () => {
		createInstanceSpy.mockResolvedValue(ok(SAMPLE_INSTANCE));
		const { wrapper, page } = mountPage({ instances: [SAMPLE_INSTANCE] });
		page.newInstanceButton?.click();
		await nextTick();
		expect(page.createPanel).not.toBeNull();
		page.form.titleInput!.value = 'Dune';
		page.form.titleInput!.dispatchEvent(new Event('input'));
		await nextTick();
		page.form.submitButton?.click();
		await flushPromises();
		expect(page.createPanel).toBeNull();
		wrapper.unmount();
	});

	it('keeps the panel open when submit returns invalid-values', async () => {
		createInstanceSpy.mockResolvedValue(err({ kind: 'invalid-values', issues: [{ kind: 'required-missing', fieldName: 'author' }] }));
		const { wrapper, page } = mountPage({ instances: [SAMPLE_INSTANCE] });
		page.newInstanceButton?.click();
		await nextTick();
		page.form.titleInput!.value = 'Dune';
		page.form.titleInput!.dispatchEvent(new Event('input'));
		await nextTick();
		page.form.submitButton?.click();
		await flushPromises();
		expect(page.createPanel).not.toBeNull();
		wrapper.unmount();
	});

	it('closes the panel after a successful overwrite confirm', async () => {
		createInstanceSpy
			.mockResolvedValueOnce(err({ kind: 'instance-exists', path: 'Books/Dune.md' }))
			.mockResolvedValueOnce(ok(SAMPLE_INSTANCE));
		const { wrapper, page } = mountPage({ instances: [SAMPLE_INSTANCE] });
		page.newInstanceButton?.click();
		await nextTick();
		page.form.titleInput!.value = 'Dune';
		page.form.titleInput!.dispatchEvent(new Event('input'));
		await nextTick();
		page.form.submitButton?.click();
		await flushPromises();
		expect(page.overwriteDialog.dialog).not.toBeNull();
		expect(page.createPanel).not.toBeNull();
		page.overwriteDialog.overwriteButton?.click();
		await flushPromises();
		expect(page.overwriteDialog.dialog).toBeNull();
		expect(page.createPanel).toBeNull();
		wrapper.unmount();
	});

	it('with titleFieldName=null, focusNameInput focuses the filename input after rename', async () => {
		createInstanceSpy.mockResolvedValue(err({ kind: 'instance-exists', path: 'Notes/foo.md' }));
		const { wrapper, page } = mountPage({ type: NOTE_NO_TITLE, instances: [] });
		await nextTick();
		// Panel auto-opened (empty instances). Filename input is rendered.
		expect(page.form.filenameInput).not.toBeNull();
		page.form.filenameInput!.value = 'foo';
		page.form.filenameInput!.dispatchEvent(new Event('input'));
		await nextTick();
		page.form.submitButton?.click();
		await flushPromises();
		expect(page.overwriteDialog.dialog).not.toBeNull();
		page.overwriteDialog.renameButton?.click();
		await flushPromises();
		expect(document.activeElement).toBe(page.form.filenameInput);
		wrapper.unmount();
	});
});

describe('MakeTypeInstances — list rendering (regression)', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		createInstanceSpy = vi.fn();
		document.body.innerHTML = '';
	});

	it('renders the list of instances when present', async () => {
		const { wrapper, page } = mountPage({ instances: [SAMPLE_INSTANCE] });
		expect(page.instanceRow('Books/Dune.md')).not.toBeNull();
		wrapper.unmount();
	});

	it('renders loading state when loading=true', async () => {
		const { wrapper, page } = mountPage({ loading: true });
		expect(page.loading).not.toBeNull();
		wrapper.unmount();
	});

	it('renders error message when error is set', async () => {
		const { wrapper, page } = mountPage({ instances: [], error: 'vault-error: EIO' });
		expect(page.error).not.toBeNull();
		expect(page.error?.textContent).toContain('vault-error');
		wrapper.unmount();
	});
});
