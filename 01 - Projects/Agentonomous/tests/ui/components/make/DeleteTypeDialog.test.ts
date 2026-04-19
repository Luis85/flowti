import { describe, it, expect, afterEach } from 'vitest';
import { nextTick } from 'vue';
import DeleteTypeDialog from '../../../../src/ui/components/make/DeleteTypeDialog.vue';
import { DeleteTypeDialogPage } from '../../../../src/ui/components/make/DeleteTypeDialog.po.js';
import { mountWithI18n } from '../../../__fixtures__/mount-with-i18n.js';
import type { TypeSchema } from '../../../../src/domain/make/type-schema.js';

function defaultType(overrides: Partial<TypeSchema> = {}): TypeSchema {
	return {
		id: 'book',
		name: 'Book',
		instancesFolder: 'references/books',
		titleFieldName: 'title',
		fields: [],
		createdAt: '2026-01-01T00:00:00Z',
		updatedAt: '2026-01-01T00:00:00Z',
		baseFile: { path: 'Make/Bases/Book.md', generatedAt: '2026-01-01T00:00:00Z' },
		...overrides,
	};
}

function mountDialog(props: Record<string, unknown> = {}) {
	const wrapper = mountWithI18n(DeleteTypeDialog, {
		props: {
			open: true,
			type: defaultType(),
			instanceCount: 3,
			isDeleting: false,
			typesFolder: 'Make/Types',
			...props,
		},
		attachTo: document.body,
	});
	const page = new DeleteTypeDialogPage(document.body);
	return { wrapper, page };
}

describe('DeleteTypeDialog', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('renders title from type.name via i18n key', async () => {
		const { page } = mountDialog({ type: defaultType({ name: 'Article' }) });
		await nextTick();
		expect(page.title).toContain('Article');
	});

	it('renders type-file path', async () => {
		const { page } = mountDialog({ type: defaultType({ id: 'my-type' }) });
		await nextTick();
		expect(page.typeFilePath).toContain('Make/Types/my-type.json');
	});

	it('uses the provided typesFolder prop in the displayed type-file path', async () => {
		const type: TypeSchema = {
			id: 'my-type',
			name: 'My Type',
			instancesFolder: 'Make/Instances/my-type',
			titleFieldName: 'title',
			fields: [{ kind: 'text', name: 'title', required: true }],
			createdAt: '2026-04-18T00:00:00.000Z',
			updatedAt: '2026-04-18T00:00:00.000Z',
		};
		const { page } = mountDialog({ type, typesFolder: 'Custom/Schemas' });
		await nextTick();
		expect(page.typeFilePath).toContain('Custom/Schemas/my-type.json');
	});

	it('instanceCount === null shows checking text inside aria-live region', async () => {
		const { page } = mountDialog({ instanceCount: null });
		await nextTick();
		const instanceEl = document.querySelector('[data-testid="delete-type-instance-line"]');
		expect(instanceEl).not.toBeNull();
		expect(instanceEl?.getAttribute('aria-live')).toBe('polite');
		expect(page.instanceLine).toContain('Checking');
	});

	it('instanceCount === 0 shows noInstances text', async () => {
		const { page } = mountDialog({ instanceCount: 0 });
		await nextTick();
		expect(page.instanceLine).toContain('no instances');
	});

	it('instanceCount === 1 uses singular hasInstancesOne key', async () => {
		const { page } = mountDialog({ instanceCount: 1, type: defaultType({ instancesFolder: 'references/books' }) });
		await nextTick();
		expect(page.instanceLine).toContain('1 existing note');
		expect(page.instanceLine).toContain('references/books');
	});

	it('instanceCount > 1 uses plural hasInstancesOther with count', async () => {
		const { page } = mountDialog({ instanceCount: 5, type: defaultType({ instancesFolder: 'references/books' }) });
		await nextTick();
		expect(page.instanceLine).toContain('5');
		expect(page.instanceLine).toContain('references/books');
	});

	it('base-file checkbox is disabled when type.baseFile === undefined', async () => {
		const { page } = mountDialog({ type: defaultType({ baseFile: undefined }) });
		await nextTick();
		expect(page.baseCheckbox).not.toBeNull();
		expect(page.baseCheckbox?.disabled).toBe(true);
	});

	it('base-file checkbox is enabled when type.baseFile is defined', async () => {
		const { page } = mountDialog({ type: defaultType({ baseFile: { path: 'Make/Bases/Book.md', generatedAt: '2026-01-01T00:00:00Z' } }) });
		await nextTick();
		expect(page.baseCheckbox?.disabled).toBe(false);
	});

	it('shows base file path in code element when baseFile is defined', async () => {
		const { page } = mountDialog({ type: defaultType({ baseFile: { path: 'Make/Bases/Book.md', generatedAt: '2026-01-01T00:00:00Z' } }) });
		await nextTick();
		expect(page.baseFilePath).toBe('Make/Bases/Book.md');
	});

	it('confirm emits confirm with alsoDeleteBaseFile=false by default', async () => {
		const { wrapper, page } = mountDialog();
		await nextTick();
		page.confirmButton?.click();
		await nextTick();
		const emitted = wrapper.emitted('confirm') as Array<[{ alsoDeleteBaseFile: boolean; alsoDeleteInstances: boolean }]>;
		expect(emitted).toBeTruthy();
		expect(emitted[0]![0]).toEqual({ alsoDeleteBaseFile: false, alsoDeleteInstances: false });
	});

	it('confirm emits confirm with alsoDeleteBaseFile=true when checkbox checked', async () => {
		const { wrapper, page } = mountDialog();
		await nextTick();
		const checkbox = page.baseCheckbox!;
		checkbox.checked = true;
		checkbox.dispatchEvent(new Event('change'));
		await nextTick();
		page.confirmButton?.click();
		await nextTick();
		const emitted = wrapper.emitted('confirm') as Array<[{ alsoDeleteBaseFile: boolean; alsoDeleteInstances: boolean }]>;
		expect(emitted).toBeTruthy();
		expect(emitted[0]![0]).toEqual({ alsoDeleteBaseFile: true, alsoDeleteInstances: false });
	});

	it('cascade checkbox is rendered when instanceCount > 0', async () => {
		const { page } = mountDialog({ instanceCount: 3 });
		await nextTick();
		expect(page.instancesCheckbox).not.toBeNull();
	});

	it('cascade checkbox is not rendered when instanceCount === 0', async () => {
		const { page } = mountDialog({ instanceCount: 0 });
		await nextTick();
		expect(page.instancesCheckbox).toBeNull();
	});

	it('cascade checkbox is not rendered while instanceCount is loading (null)', async () => {
		const { page } = mountDialog({ instanceCount: null });
		await nextTick();
		expect(page.instancesCheckbox).toBeNull();
	});

	it('confirm emits alsoDeleteInstances=true when cascade checkbox is checked', async () => {
		const { wrapper, page } = mountDialog({ instanceCount: 2 });
		await nextTick();
		const checkbox = page.instancesCheckbox!;
		checkbox.checked = true;
		checkbox.dispatchEvent(new Event('change'));
		await nextTick();
		page.confirmButton?.click();
		await nextTick();
		const emitted = wrapper.emitted('confirm') as Array<[{ alsoDeleteBaseFile: boolean; alsoDeleteInstances: boolean }]>;
		expect(emitted).toBeTruthy();
		expect(emitted[0]![0]).toEqual({ alsoDeleteBaseFile: false, alsoDeleteInstances: true });
	});

	it('cancel button click emits cancel', async () => {
		const { wrapper, page } = mountDialog();
		await nextTick();
		page.cancelButton?.click();
		await nextTick();
		expect(wrapper.emitted('cancel')).toBeTruthy();
	});

	it('backdrop click emits cancel', async () => {
		const { wrapper, page } = mountDialog();
		await nextTick();
		page.backdrop?.click();
		await nextTick();
		expect(wrapper.emitted('cancel')).toBeTruthy();
	});

	it('Escape key emits cancel', async () => {
		const { wrapper } = mountDialog();
		await nextTick();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await nextTick();
		expect(wrapper.emitted('cancel')).toBeTruthy();
	});

	it('isDeleting: confirm button shows "Deleting…" and aria-busy="true" and is disabled', async () => {
		const { page } = mountDialog({ isDeleting: true });
		await nextTick();
		const confirmBtn = page.confirmButton!;
		expect(confirmBtn.textContent?.trim()).toBe('Deleting…');
		expect(confirmBtn.getAttribute('aria-busy')).toBe('true');
		expect(confirmBtn.disabled).toBe(true);
	});

	it('isDeleting: cancel button is disabled', async () => {
		const { page } = mountDialog({ isDeleting: true });
		await nextTick();
		expect(page.cancelButton?.disabled).toBe(true);
	});

	it('confirm button has destructive class', async () => {
		const { page } = mountDialog();
		await nextTick();
		expect(page.confirmButton?.classList.contains('destructive')).toBe(true);
	});

	it('has role=alertdialog', async () => {
		const { page } = mountDialog();
		await nextTick();
		expect(page.dialog?.getAttribute('role')).toBe('alertdialog');
	});

	it('has aria-modal=true', async () => {
		const { page } = mountDialog();
		await nextTick();
		expect(page.dialog?.getAttribute('aria-modal')).toBe('true');
	});

	it('has aria-labelledby set', async () => {
		const { page } = mountDialog();
		await nextTick();
		expect(page.dialog?.getAttribute('aria-labelledby')).toBeTruthy();
	});

	it('has aria-describedby set', async () => {
		const { page } = mountDialog();
		await nextTick();
		expect(page.dialog?.getAttribute('aria-describedby')).toBeTruthy();
	});

	it('does not render when open=false', async () => {
		const { page } = mountDialog({ open: false });
		await nextTick();
		expect(page.dialog).toBeNull();
		expect(page.backdrop).toBeNull();
	});
});
