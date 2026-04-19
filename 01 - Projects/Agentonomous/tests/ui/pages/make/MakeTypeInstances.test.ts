import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import MakeTypeInstances from '../../../../src/ui/pages/make/MakeTypeInstances.vue';
import { MakeTypeInstancesPage } from '../../../../src/ui/pages/make/MakeTypeInstances.po.js';
import { mountWithI18n } from '../../../__fixtures__/mount-with-i18n.js';
import { createFakeMakeContext, fakeMakeService } from '../../../__fixtures__/fake-make-context.js';
import { MakeContextKey } from '../../../../src/ui/make-context-key.js';
import { PluginContextKey } from '../../../../src/ui/plugin-context-key.js';
import { useMakeStore } from '../../../../src/ui/stores/make-store.js';
import { ok, err } from '../../../../src/domain/shared/result.js';
import type { TypeSchema } from '../../../../src/domain/make/type-schema.js';
import type { InstanceRef } from '../../../../src/domain/make/types.js';
import type { PluginContext } from '../../../../src/plugin.js';

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
	notificationsSpy?: { success: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
} = {}) {
	const ctx = createFakeMakeContext({
		service: fakeMakeService({ createInstance: createInstanceSpy }),
	});
	const notificationsSpy = opts.notificationsSpy ?? { success: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() };
	const pluginCtx = { notifications: notificationsSpy } as unknown as PluginContext;
	const pinia = createPinia();
	const wrapper = mountWithI18n(MakeTypeInstances, {
		props: {
			type:      opts.type      ?? BOOK,
			instances: opts.instances,
			loading:   opts.loading   ?? false,
			error:     opts.error     ?? null,
		},
		provide: {
			[MakeContextKey as symbol]:   ctx,
			[PluginContextKey as symbol]: pluginCtx,
		} as Record<PropertyKey, unknown>,
		plugins: [pinia],
		attachTo: document.body,
	});
	setActivePinia(pinia);
	const page = new MakeTypeInstancesPage(wrapper.element as HTMLElement);
	const store = useMakeStore();
	const rerenderInstances = async (next: readonly InstanceRef[] | undefined): Promise<void> => {
		await wrapper.setProps({ instances: next });
		await nextTick();
	};
	return { wrapper, page, store, ctx, notificationsSpy, rerenderInstances };
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

describe('MakeTypeInstances — select mode foundation', () => {
	const DUNE:  InstanceRef = { typeId: 'book', path: 'Books/Dune.md',        title: 'Dune',         createdAt: '2026-04-19T00:00:00.000Z', updatedAt: '2026-04-19T00:00:00.000Z' };
	const NEURO: InstanceRef = { typeId: 'book', path: 'Books/Neuromancer.md', title: 'Neuromancer',  createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z' };
	const FOUND: InstanceRef = { typeId: 'book', path: 'Books/Foundation.md',  title: 'Foundation',   createdAt: '2026-04-17T00:00:00.000Z', updatedAt: '2026-04-17T00:00:00.000Z' };

	beforeEach(() => {
		setActivePinia(createPinia());
		createInstanceSpy = vi.fn();
		document.body.innerHTML = '';
	});

	it('renders a Select toggle button in the header (default off, no checkboxes shown)', () => {
		const { wrapper } = mountPage({ instances: [DUNE, NEURO, FOUND] });
		const toggle = wrapper.find('[data-testid="select-mode-toggle"]');
		expect(toggle.exists()).toBe(true);
		expect(toggle.attributes('aria-pressed')).toBe('false');
		expect(wrapper.findAll('[data-testid^="instance-row-checkbox-"]')).toHaveLength(0);
		wrapper.unmount();
	});

	it('clicking the Select toggle enters select mode: shows checkboxes, hides per-row delete buttons', async () => {
		const { wrapper } = mountPage({ instances: [DUNE, NEURO, FOUND] });
		await wrapper.find('[data-testid="select-mode-toggle"]').trigger('click');
		const checkboxes = wrapper.findAll('[data-testid^="instance-row-checkbox-"]');
		expect(checkboxes).toHaveLength(3);
		expect(wrapper.findAll('[data-testid^="delete-instance-"]')).toHaveLength(0);
		expect(wrapper.find('[data-testid="select-mode-toggle"]').attributes('aria-pressed')).toBe('true');
		wrapper.unmount();
	});

	it('toggling a row checkbox adds/removes its path from the selection', async () => {
		const { wrapper } = mountPage({ instances: [DUNE, NEURO, FOUND] });
		await wrapper.find('[data-testid="select-mode-toggle"]').trigger('click');
		const cb = wrapper.find(`[data-testid="instance-row-checkbox-${DUNE.path}"]`);
		expect(cb.attributes('aria-checked')).toBe('false');
		await cb.trigger('click');
		expect(wrapper.find(`[data-testid="instance-row-checkbox-${DUNE.path}"]`).attributes('aria-checked')).toBe('true');
		await wrapper.find(`[data-testid="instance-row-checkbox-${DUNE.path}"]`).trigger('click');
		expect(wrapper.find(`[data-testid="instance-row-checkbox-${DUNE.path}"]`).attributes('aria-checked')).toBe('false');
		wrapper.unmount();
	});

	it('list gets aria-multiselectable="true" only in select mode; rows expose aria-selected', async () => {
		const { wrapper } = mountPage({ instances: [DUNE, NEURO, FOUND] });
		const list = () => wrapper.find('.instances-list');
		expect(list().attributes('aria-multiselectable')).toBeUndefined();
		await wrapper.find('[data-testid="select-mode-toggle"]').trigger('click');
		expect(list().attributes('aria-multiselectable')).toBe('true');
		const rows = wrapper.findAll('li.instance-row');
		expect(rows).toHaveLength(3);
		expect(rows[0]!.attributes('aria-selected')).toBe('false');
		await wrapper.find(`[data-testid="instance-row-checkbox-${DUNE.path}"]`).trigger('click');
		expect(wrapper.findAll('li.instance-row')[0]!.attributes('aria-selected')).toBe('true');
		wrapper.unmount();
	});

	it('exiting select mode clears selection', async () => {
		const { wrapper } = mountPage({ instances: [DUNE, NEURO, FOUND] });
		await wrapper.find('[data-testid="select-mode-toggle"]').trigger('click');
		await wrapper.find(`[data-testid="instance-row-checkbox-${DUNE.path}"]`).trigger('click');
		expect(wrapper.findAll('li.instance-row')[0]!.attributes('aria-selected')).toBe('true');
		await wrapper.find('[data-testid="select-mode-toggle"]').trigger('click');
		await wrapper.find('[data-testid="select-mode-toggle"]').trigger('click');
		expect(wrapper.findAll('li.instance-row')[0]!.attributes('aria-selected')).toBe('false');
		wrapper.unmount();
	});

	it('selection hygiene: paths removed from the list also leave the selection set', async () => {
		const { wrapper, rerenderInstances } = mountPage({ instances: [DUNE, NEURO, FOUND] });
		await wrapper.find('[data-testid="select-mode-toggle"]').trigger('click');
		await wrapper.find(`[data-testid="instance-row-checkbox-${DUNE.path}"]`).trigger('click');
		await wrapper.find(`[data-testid="instance-row-checkbox-${NEURO.path}"]`).trigger('click');
		await rerenderInstances([DUNE, FOUND]);
		const rows = wrapper.findAll('li.instance-row');
		expect(rows).toHaveLength(2);
		expect(rows[0]!.attributes('aria-selected')).toBe('true');  // DUNE
		expect(rows[1]!.attributes('aria-selected')).toBe('false'); // FOUND
		wrapper.unmount();
	});

	it('select-mode toggle is disabled while loading=true', () => {
		const { wrapper } = mountPage({ instances: undefined, loading: true });
		const toggle = wrapper.find('[data-testid="select-mode-toggle"]');
		expect(toggle.attributes('disabled')).toBeDefined();
		wrapper.unmount();
	});
});

describe('MakeTypeInstances — selection toolbar', () => {
	const DUNE:  InstanceRef = { typeId: 'book', path: 'Books/Dune.md',        title: 'Dune',         createdAt: '2026-04-19T00:00:00.000Z', updatedAt: '2026-04-19T00:00:00.000Z' };
	const NEURO: InstanceRef = { typeId: 'book', path: 'Books/Neuromancer.md', title: 'Neuromancer',  createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z' };
	const FOUND: InstanceRef = { typeId: 'book', path: 'Books/Foundation.md',  title: 'Foundation',   createdAt: '2026-04-17T00:00:00.000Z', updatedAt: '2026-04-17T00:00:00.000Z' };

	beforeEach(() => {
		setActivePinia(createPinia());
		createInstanceSpy = vi.fn();
		document.body.innerHTML = '';
	});

	async function enterSelectMode(wrapper: ReturnType<typeof mountPage>['wrapper']): Promise<void> {
		await wrapper.find('[data-testid="select-mode-toggle"]').trigger('click');
	}

	it('toolbar is visible only in select mode', async () => {
		const { wrapper } = mountPage({ instances: [DUNE, NEURO, FOUND] });
		expect(wrapper.find('[data-testid="bulk-toolbar"]').exists()).toBe(false);
		await enterSelectMode(wrapper);
		expect(wrapper.find('[data-testid="bulk-toolbar"]').exists()).toBe(true);
		wrapper.unmount();
	});

	it('count text reflects selected.size and updates as the user toggles rows', async () => {
		const { wrapper } = mountPage({ instances: [DUNE, NEURO, FOUND] });
		await enterSelectMode(wrapper);
		const count = () => wrapper.find('[data-testid="bulk-toolbar-count"]').text();
		expect(count()).toContain('0');
		await wrapper.find(`[data-testid="instance-row-checkbox-${DUNE.path}"]`).trigger('click');
		expect(count()).toContain('1');
		await wrapper.find(`[data-testid="instance-row-checkbox-${NEURO.path}"]`).trigger('click');
		expect(count()).toContain('2');
		wrapper.unmount();
	});

	it('select-all checkbox is tristate: none → all → none', async () => {
		const { wrapper } = mountPage({ instances: [DUNE, NEURO, FOUND] });
		await enterSelectMode(wrapper);
		const sa = () => wrapper.find('[data-testid="bulk-toolbar-select-all"]');
		expect(sa().attributes('aria-checked')).toBe('false');
		await sa().trigger('click');
		expect(sa().attributes('aria-checked')).toBe('true');
		const rows = wrapper.findAll('li.instance-row');
		expect(rows.every((r) => r.attributes('aria-selected') === 'true')).toBe(true);
		await sa().trigger('click');
		expect(sa().attributes('aria-checked')).toBe('false');
		expect(wrapper.findAll('li.instance-row').every((r) => r.attributes('aria-selected') === 'false')).toBe(true);
		wrapper.unmount();
	});

	it('select-all reads "mixed" when some (but not all) rows are selected', async () => {
		const { wrapper } = mountPage({ instances: [DUNE, NEURO, FOUND] });
		await enterSelectMode(wrapper);
		await wrapper.find(`[data-testid="instance-row-checkbox-${DUNE.path}"]`).trigger('click');
		const sa = wrapper.find('[data-testid="bulk-toolbar-select-all"]');
		expect(sa.attributes('aria-checked')).toBe('mixed');
		wrapper.unmount();
	});

	it('Delete selected button is disabled when 0 selected', async () => {
		const { wrapper } = mountPage({ instances: [DUNE, NEURO, FOUND] });
		await enterSelectMode(wrapper);
		const btn = wrapper.find('[data-testid="bulk-toolbar-delete"]');
		expect(btn.attributes('disabled')).toBeDefined();
		await wrapper.find(`[data-testid="instance-row-checkbox-${DUNE.path}"]`).trigger('click');
		expect(wrapper.find('[data-testid="bulk-toolbar-delete"]').attributes('disabled')).toBeUndefined();
		wrapper.unmount();
	});

	it('Done button exits select mode and clears selection', async () => {
		const { wrapper } = mountPage({ instances: [DUNE, NEURO, FOUND] });
		await enterSelectMode(wrapper);
		await wrapper.find(`[data-testid="instance-row-checkbox-${DUNE.path}"]`).trigger('click');
		await wrapper.find('[data-testid="bulk-toolbar-done"]').trigger('click');
		expect(wrapper.find('[data-testid="bulk-toolbar"]').exists()).toBe(false);
		await enterSelectMode(wrapper);
		expect(wrapper.findAll('li.instance-row')[0]!.attributes('aria-selected')).toBe('false');
		wrapper.unmount();
	});
});

describe('MakeTypeInstances — bulk delete confirm + success', () => {
	const DUNE:  InstanceRef = { typeId: 'book', path: 'Books/Dune.md',        title: 'Dune',         createdAt: '2026-04-19T00:00:00.000Z', updatedAt: '2026-04-19T00:00:00.000Z' };
	const NEURO: InstanceRef = { typeId: 'book', path: 'Books/Neuromancer.md', title: 'Neuromancer',  createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z' };

	beforeEach(() => {
		setActivePinia(createPinia());
		createInstanceSpy = vi.fn();
		document.body.innerHTML = '';
	});

	it('clicking Delete selected opens a destructive confirm dialog with count in the title', async () => {
		const { wrapper } = mountPage({ instances: [DUNE, NEURO] });
		await wrapper.find('[data-testid="select-mode-toggle"]').trigger('click');
		await wrapper.find(`[data-testid="instance-row-checkbox-${DUNE.path}"]`).trigger('click');
		await wrapper.find(`[data-testid="instance-row-checkbox-${NEURO.path}"]`).trigger('click');
		await wrapper.find('[data-testid="bulk-toolbar-delete"]').trigger('click');
		const dialog = document.body.querySelector('[data-testid="confirm-dialog"]');
		expect(dialog).not.toBeNull();
		expect(dialog?.textContent).toContain('2');
		wrapper.unmount();
	});

	it('confirming the dialog calls store.bulkDeleteInstances with the selected paths', async () => {
		const { wrapper, store } = mountPage({ instances: [DUNE, NEURO] });
		const spy = vi.spyOn(store, 'bulkDeleteInstances').mockResolvedValue({
			kind: 'ok',
			value: { deletedPaths: ['Books/Dune.md', 'Books/Neuromancer.md'], failures: [] },
		});
		await wrapper.find('[data-testid="select-mode-toggle"]').trigger('click');
		await wrapper.find(`[data-testid="instance-row-checkbox-${DUNE.path}"]`).trigger('click');
		await wrapper.find(`[data-testid="instance-row-checkbox-${NEURO.path}"]`).trigger('click');
		await wrapper.find('[data-testid="bulk-toolbar-delete"]').trigger('click');
		const confirmBtn = document.body.querySelector<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]');
		expect(confirmBtn).not.toBeNull();
		confirmBtn!.click();
		await flushPromises();
		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy).toHaveBeenCalledWith('book', expect.arrayContaining(['Books/Dune.md', 'Books/Neuromancer.md']));
		wrapper.unmount();
	});

	it('on full success: notificationsSpy.success fires, select mode exits, selection clears', async () => {
		const { wrapper, store, notificationsSpy } = mountPage({ instances: [DUNE] });
		vi.spyOn(store, 'bulkDeleteInstances').mockResolvedValue({
			kind: 'ok',
			value: { deletedPaths: ['Books/Dune.md'], failures: [] },
		});
		await wrapper.find('[data-testid="select-mode-toggle"]').trigger('click');
		await wrapper.find(`[data-testid="instance-row-checkbox-${DUNE.path}"]`).trigger('click');
		await wrapper.find('[data-testid="bulk-toolbar-delete"]').trigger('click');
		(document.body.querySelector('[data-testid="confirm-dialog-confirm"]') as HTMLButtonElement).click();
		await flushPromises();
		expect(notificationsSpy.success).toHaveBeenCalledTimes(1);
		expect(notificationsSpy.success).toHaveBeenCalledWith(expect.stringMatching(/1/));
		expect(wrapper.find('[data-testid="bulk-toolbar"]').exists()).toBe(false);
		wrapper.unmount();
	});

	it('cancelling the dialog does NOT call bulkDeleteInstances and stays in select mode with selection intact', async () => {
		const { wrapper, store } = mountPage({ instances: [DUNE, NEURO] });
		const spy = vi.spyOn(store, 'bulkDeleteInstances');
		await wrapper.find('[data-testid="select-mode-toggle"]').trigger('click');
		await wrapper.find(`[data-testid="instance-row-checkbox-${DUNE.path}"]`).trigger('click');
		await wrapper.find('[data-testid="bulk-toolbar-delete"]').trigger('click');
		(document.body.querySelector('[data-testid="confirm-dialog-cancel"]') as HTMLButtonElement).click();
		await flushPromises();
		expect(spy).not.toHaveBeenCalled();
		expect(wrapper.find('[data-testid="bulk-toolbar"]').exists()).toBe(true);
		expect(wrapper.findAll('li.instance-row')[0]!.attributes('aria-selected')).toBe('true');
		wrapper.unmount();
	});
});

describe('MakeTypeInstances — bulk delete partial-result dialog', () => {
	const DUNE:  InstanceRef = { typeId: 'book', path: 'Books/Dune.md',        title: 'Dune',         createdAt: '2026-04-19T00:00:00.000Z', updatedAt: '2026-04-19T00:00:00.000Z' };
	const NEURO: InstanceRef = { typeId: 'book', path: 'Books/Neuromancer.md', title: 'Neuromancer',  createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z' };

	beforeEach(() => {
		setActivePinia(createPinia());
		createInstanceSpy = vi.fn();
		document.body.innerHTML = '';
	});

	async function runBulkWithPartialResult(failurePath: string, succeededPath: string) {
		const mounted = mountPage({ instances: [DUNE, NEURO] });
		vi.spyOn(mounted.store, 'bulkDeleteInstances').mockResolvedValue({
			kind: 'ok',
			value: {
				deletedPaths: [succeededPath],
				failures:     [{ path: failurePath, error: 'locked' }],
			},
		});
		await mounted.wrapper.find('[data-testid="select-mode-toggle"]').trigger('click');
		await mounted.wrapper.find(`[data-testid="instance-row-checkbox-${DUNE.path}"]`).trigger('click');
		await mounted.wrapper.find(`[data-testid="instance-row-checkbox-${NEURO.path}"]`).trigger('click');
		await mounted.wrapper.find('[data-testid="bulk-toolbar-delete"]').trigger('click');
		(document.body.querySelector('[data-testid="confirm-dialog-confirm"]') as HTMLButtonElement).click();
		await flushPromises();
		return mounted;
	}

	it('on partial failure: opens the partial-result dialog with counts and failed path list', async () => {
		const { wrapper } = await runBulkWithPartialResult('Books/Neuromancer.md', 'Books/Dune.md');
		const dialogs = document.body.querySelectorAll('[data-testid="confirm-dialog"]');
		expect(dialogs).toHaveLength(1);
		const text = (dialogs[0] as HTMLElement).textContent ?? '';
		expect(text).toContain('1');
		expect(text).toContain('2');
		expect(text).toContain('Neuromancer');
		wrapper.unmount();
	});

	it('Retry calls bulkDeleteInstances with only the failed paths', async () => {
		const { wrapper, store } = mountPage({ instances: [DUNE, NEURO] });
		const calls: Array<readonly string[]> = [];
		vi.spyOn(store, 'bulkDeleteInstances').mockImplementation(async (_typeId, paths) => {
			calls.push(paths);
			if (calls.length === 1) {
				return { kind: 'ok', value: { deletedPaths: ['Books/Dune.md'], failures: [{ path: 'Books/Neuromancer.md', error: 'locked' }] } };
			}
			return { kind: 'ok', value: { deletedPaths: ['Books/Neuromancer.md'], failures: [] } };
		});
		await wrapper.find('[data-testid="select-mode-toggle"]').trigger('click');
		await wrapper.find(`[data-testid="instance-row-checkbox-${DUNE.path}"]`).trigger('click');
		await wrapper.find(`[data-testid="instance-row-checkbox-${NEURO.path}"]`).trigger('click');
		await wrapper.find('[data-testid="bulk-toolbar-delete"]').trigger('click');
		(document.body.querySelector('[data-testid="confirm-dialog-confirm"]') as HTMLButtonElement).click();
		await flushPromises();
		(document.body.querySelector('[data-testid="confirm-dialog-confirm"]') as HTMLButtonElement).click();
		await flushPromises();
		expect(calls).toHaveLength(2);
		expect(calls[1]).toEqual(['Books/Neuromancer.md']);
		wrapper.unmount();
	});

	it('Dismiss closes the partial-result dialog and leaves failed paths selected', async () => {
		const { wrapper } = await runBulkWithPartialResult('Books/Neuromancer.md', 'Books/Dune.md');
		(document.body.querySelector('[data-testid="confirm-dialog-cancel"]') as HTMLButtonElement).click();
		await flushPromises();
		expect(document.body.querySelector('[data-testid="confirm-dialog"]')).toBeNull();
		expect(wrapper.find('[data-testid="bulk-toolbar"]').exists()).toBe(true);
		expect(wrapper.find('[data-testid="bulk-toolbar-count"]').text()).toContain('1');
		wrapper.unmount();
	});

	it('truncates the path list to the first 3 with "+N more" when failures > 3', async () => {
		const failures = ['a', 'b', 'c', 'd', 'e'].map((n) => ({ path: `Books/${n}.md`, error: 'locked' }));
		const FAKE_INSTANCES: InstanceRef[] = failures.map((f) => ({
			typeId: 'book', path: f.path, title: f.path.split('/').pop()!.replace('.md', ''),
			createdAt: '2026-04-19T00:00:00.000Z', updatedAt: '2026-04-19T00:00:00.000Z',
		}));
		const { wrapper, store } = mountPage({ instances: FAKE_INSTANCES });
		vi.spyOn(store, 'bulkDeleteInstances').mockResolvedValue({
			kind: 'ok', value: { deletedPaths: [], failures },
		});
		await wrapper.find('[data-testid="select-mode-toggle"]').trigger('click');
		for (const f of failures) {
			await wrapper.find(`[data-testid="instance-row-checkbox-${f.path}"]`).trigger('click');
		}
		await wrapper.find('[data-testid="bulk-toolbar-delete"]').trigger('click');
		(document.body.querySelector('[data-testid="confirm-dialog-confirm"]') as HTMLButtonElement).click();
		await flushPromises();
		const text = (document.body.querySelector('[data-testid="confirm-dialog"]') as HTMLElement).textContent ?? '';
		expect(text).toContain('a.md');
		expect(text).toContain('b.md');
		expect(text).toContain('c.md');
		expect(text).toContain('+2 more');
		expect(text).not.toContain('e.md');
		wrapper.unmount();
	});
});
