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

describe('MakeTypeInstances — row actions', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		createInstanceSpy = vi.fn();
		document.body.innerHTML = '';
	});

	it('Open in Obsidian calls store.openInstance with tab mode', async () => {
		const { wrapper, page, store } = mountPage({ instances: [SAMPLE_INSTANCE] });
		const spy = vi.spyOn(store, 'openInstance').mockResolvedValue(ok(undefined));
		page.row(0).openButton?.click();
		await flushPromises();
		expect(spy).toHaveBeenCalledWith('Books/Dune.md', 'tab');
		wrapper.unmount();
	});

	it('Delete shows confirm dialog, then calls store.deleteInstance on confirm', async () => {
		const { wrapper, page, store } = mountPage({ instances: [SAMPLE_INSTANCE] });
		const spy = vi.spyOn(store, 'deleteInstance').mockResolvedValue(ok(undefined));
		page.row(0).deleteButton?.click();
		await nextTick();
		expect(page.deleteInstanceConfirm.dialog).not.toBeNull();
		page.deleteInstanceConfirm.button('confirm')?.click();
		await flushPromises();
		expect(spy).toHaveBeenCalledWith('Books/Dune.md');
		wrapper.unmount();
	});

	it('Delete cancel closes dialog without calling service', async () => {
		const { wrapper, page, store } = mountPage({ instances: [SAMPLE_INSTANCE] });
		const spy = vi.spyOn(store, 'deleteInstance');
		page.row(0).deleteButton?.click();
		await nextTick();
		expect(page.deleteInstanceConfirm.dialog).not.toBeNull();
		page.deleteInstanceConfirm.button('cancel')?.click();
		await flushPromises();
		expect(page.deleteInstanceConfirm.dialog).toBeNull();
		expect(spy).not.toHaveBeenCalled();
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

describe('MakeTypeInstances — keyboard a11y', () => {
	const DUNE:  InstanceRef = { typeId: 'book', path: 'Books/Dune.md',        title: 'Dune',         createdAt: '2026-04-19T00:00:00.000Z', updatedAt: '2026-04-19T00:00:00.000Z' };
	const NEURO: InstanceRef = { typeId: 'book', path: 'Books/Neuromancer.md', title: 'Neuromancer',  createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z' };
	const FOUND: InstanceRef = { typeId: 'book', path: 'Books/Foundation.md',  title: 'Foundation',   createdAt: '2026-04-17T00:00:00.000Z', updatedAt: '2026-04-17T00:00:00.000Z' };

	beforeEach(() => {
		setActivePinia(createPinia());
		createInstanceSpy = vi.fn();
		document.body.innerHTML = '';
	});

	function rows(wrapperEl: HTMLElement): HTMLElement[] {
		const list = wrapperEl.querySelectorAll('li.instance-row');
		const result: HTMLElement[] = [];
		list.forEach((el) => { if (el instanceof HTMLElement) result.push(el); });
		return result;
	}
	function row(wrapperEl: HTMLElement, i: number): HTMLElement {
		const r = rows(wrapperEl)[i];
		if (r === undefined) throw new Error(`row ${i} not found`);
		return r;
	}

	it('list has role=list and rows have role=listitem with aria-posinset/aria-setsize', () => {
		const { wrapper } = mountPage({ instances: [DUNE, NEURO, FOUND] });
		const root = wrapper.element as HTMLElement;
		const list = root.querySelector('.instances-list');
		expect(list).not.toBeNull();
		expect((list as HTMLElement).getAttribute('role')).toBe('list');
		const rs = rows(root);
		expect(rs).toHaveLength(3);
		rs.forEach((r, i) => {
			expect(r.getAttribute('role')).toBe('listitem');
			expect(r.getAttribute('aria-posinset')).toBe(String(i + 1));
			expect(r.getAttribute('aria-setsize')).toBe('3');
		});
		wrapper.unmount();
	});

	it('applies roving tabindex: only first row has tabindex=0 by default; buttons are tabindex=-1', () => {
		const { wrapper } = mountPage({ instances: [DUNE, NEURO, FOUND] });
		const root = wrapper.element as HTMLElement;
		expect(row(root, 0).getAttribute('tabindex')).toBe('0');
		expect(row(root, 1).getAttribute('tabindex')).toBe('-1');
		expect(row(root, 2).getAttribute('tabindex')).toBe('-1');
		// Buttons inside rows are NOT in the Tab sequence (single tabstop for the list).
		const buttons = root.querySelectorAll('.instance-row__actions button');
		buttons.forEach((btn) => {
			expect((btn as HTMLElement).getAttribute('tabindex')).toBe('-1');
		});
		wrapper.unmount();
	});

	it('ArrowDown moves roving tabindex to the next row; ArrowUp wraps backwards', async () => {
		const { wrapper } = mountPage({ instances: [DUNE, NEURO, FOUND] });
		const root = wrapper.element as HTMLElement;
		row(root, 0).focus();
		row(root, 0).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		await nextTick();
		expect(row(root, 1).getAttribute('tabindex')).toBe('0');
		expect(row(root, 0).getAttribute('tabindex')).toBe('-1');
		row(root, 1).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
		await nextTick();
		expect(row(root, 0).getAttribute('tabindex')).toBe('0');
		wrapper.unmount();
	});

	it('Home jumps to first row, End jumps to last', async () => {
		const { wrapper } = mountPage({ instances: [DUNE, NEURO, FOUND] });
		const root = wrapper.element as HTMLElement;
		row(root, 0).focus();
		row(root, 0).dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
		await nextTick();
		expect(row(root, 2).getAttribute('tabindex')).toBe('0');
		row(root, 2).focus();
		row(root, 2).dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
		await nextTick();
		expect(row(root, 0).getAttribute('tabindex')).toBe('0');
		wrapper.unmount();
	});

	it('Delete key on focused row opens the delete-instance confirm dialog', async () => {
		const { wrapper } = mountPage({ instances: [DUNE] });
		const root = wrapper.element as HTMLElement;
		row(root, 0).focus();
		row(root, 0).dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
		await nextTick();
		const dialog = document.body.querySelector('[data-testid="confirm-dialog"]');
		expect(dialog).not.toBeNull();
		expect(dialog?.textContent).toContain('Dune');
		wrapper.unmount();
	});

	it('Enter key on focused row invokes openInstance on the store', async () => {
		const { wrapper, store } = mountPage({ instances: [DUNE] });
		const openSpy = vi.spyOn(store, 'openInstance').mockResolvedValue({ kind: 'ok', value: undefined });
		const root = wrapper.element as HTMLElement;
		row(root, 0).focus();
		row(root, 0).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		await flushPromises();
		expect(openSpy).toHaveBeenCalledWith('Books/Dune.md', 'tab');
		wrapper.unmount();
	});
});
