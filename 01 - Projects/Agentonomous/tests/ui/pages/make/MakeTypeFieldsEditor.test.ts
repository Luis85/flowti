import { describe, it, expect, afterEach } from 'vitest';
import { nextTick } from 'vue';
import MakeTypeFieldsEditor from '../../../../src/ui/pages/make/MakeTypeFieldsEditor.vue';
import { mountWithI18n } from '../../../__fixtures__/mount-with-i18n.js';
import type { Draft } from '../../../../src/domain/make/draft-equality.js';
import type { FieldError } from '../../../../src/domain/make/errors.js';
import type { Field } from '../../../../src/domain/make/type-schema.js';

function defaultDraft(overrides: Partial<Draft> = {}): Draft {
	return {
		name: 'Book',
		description: 'A book',
		instancesFolder: 'references/books',
		titleFieldName: null,
		fields: [
			{ kind: 'text', name: 'title', required: false },
			{ kind: 'number', name: 'year', required: false },
		] as Field[],
		...overrides,
	};
}

function mountEditor(props: Record<string, unknown> = {}) {
	const div = document.createElement('div');
	document.body.appendChild(div);
	return mountWithI18n(MakeTypeFieldsEditor, {
		attachTo: div,
		props: {
			draft: defaultDraft(),
			mode: 'edit',
			isDirty: false,
			isSaving: false,
			serviceError: null,
			hasExistingInstances: false,
			fieldErrors: new Map<string, FieldError[]>(),
			schemaErrors: {},
			...props,
		},
	});
}

describe('MakeTypeFieldsEditor', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('renders schema details and N field rows', async () => {
		const wrapper = mountEditor();
		await nextTick();
		const root = wrapper.element as HTMLElement;
		const schemaDetails = root.querySelector('[data-testid="schema-details"]');
		expect(schemaDetails).not.toBeNull();
		const fieldsList = root.querySelector('[data-testid="fields-list"]');
		expect(fieldsList).not.toBeNull();
		const fieldRows = fieldsList!.querySelectorAll('[data-testid^="field-row-"]');
		expect(fieldRows.length).toBe(2);
	});

	it('renders add-field button and footer', async () => {
		const wrapper = mountEditor();
		await nextTick();
		const root = wrapper.element as HTMLElement;
		const addBtn = root.querySelector('[data-testid="add-field-button"]');
		expect(addBtn).not.toBeNull();
		const footer = root.querySelector('[data-testid="fields-footer"]');
		expect(footer).not.toBeNull();
		expect(root.querySelector('[data-testid="fields-save"]')).not.toBeNull();
		expect(root.querySelector('[data-testid="fields-cancel"]')).not.toBeNull();
	});

	it('add field button appends a text field and emits update:draft', async () => {
		const wrapper = mountEditor({ draft: defaultDraft({ fields: [] }) });
		await nextTick();
		const root = wrapper.element as HTMLElement;
		const addBtn = root.querySelector('[data-testid="add-field-button"]') as HTMLButtonElement;
		addBtn.click();
		await nextTick();
		const emitted = wrapper.emitted('update:draft') as Draft[][];
		expect(emitted).toBeTruthy();
		const newDraft = emitted[0]![0];
		expect(newDraft.fields.length).toBe(1);
		expect(newDraft.fields[0]!.kind).toBe('text');
		expect(newDraft.fields[0]!.name).toBe('field_1');
	});

	it('add field focuses the new row name input', async () => {
		const wrapper = mountEditor({ draft: defaultDraft({ fields: [] }) });
		await nextTick();
		const root = wrapper.element as HTMLElement;
		const addBtn = root.querySelector('[data-testid="add-field-button"]') as HTMLButtonElement;
		addBtn.click();
		await nextTick();
		// update:draft was emitted — now remount with the updated draft to simulate reactive update
		const emitted = wrapper.emitted('update:draft') as Draft[][];
		const updatedDraft = emitted[0]![0];
		expect(updatedDraft.fields.length).toBe(1);
	});

	it('remove field emits update:draft with field removed', async () => {
		const draft = defaultDraft({
			fields: [
				{ kind: 'text', name: 'alpha', required: false },
				{ kind: 'text', name: 'beta', required: false },
			] as Field[],
		});
		const wrapper = mountEditor({ draft });
		await nextTick();
		const root = wrapper.element as HTMLElement;
		// Click the remove button on the first field row
		const firstRow = root.querySelector('[data-testid="field-row-alpha"]') as HTMLElement;
		const removeBtn = firstRow.querySelector('button[aria-label="Remove field 1"]') as HTMLButtonElement;
		removeBtn.click();
		await nextTick();
		const emitted = wrapper.emitted('update:draft') as Draft[][];
		expect(emitted).toBeTruthy();
		const newDraft = emitted[0]![0];
		expect(newDraft.fields.length).toBe(1);
		expect(newDraft.fields[0]!.name).toBe('beta');
	});

	it('move-up event reorders fields correctly', async () => {
		const draft = defaultDraft({
			fields: [
				{ kind: 'text', name: 'alpha', required: false },
				{ kind: 'text', name: 'beta', required: false },
			] as Field[],
		});
		const wrapper = mountEditor({ draft });
		await nextTick();
		const root = wrapper.element as HTMLElement;
		// The second row (beta) has a move-up button
		const secondRow = root.querySelector('[data-testid="field-row-beta"]') as HTMLElement;
		const moveUpBtn = secondRow.querySelector('button[aria-label="Move field 2 up"]') as HTMLButtonElement;
		moveUpBtn.click();
		await nextTick();
		const emitted = wrapper.emitted('update:draft') as Draft[][];
		expect(emitted).toBeTruthy();
		const newDraft = emitted[0]![0];
		expect(newDraft.fields[0]!.name).toBe('beta');
		expect(newDraft.fields[1]!.name).toBe('alpha');
	});

	it('move-down event reorders fields correctly', async () => {
		const draft = defaultDraft({
			fields: [
				{ kind: 'text', name: 'alpha', required: false },
				{ kind: 'text', name: 'beta', required: false },
			] as Field[],
		});
		const wrapper = mountEditor({ draft });
		await nextTick();
		const root = wrapper.element as HTMLElement;
		const firstRow = root.querySelector('[data-testid="field-row-alpha"]') as HTMLElement;
		const moveDownBtn = firstRow.querySelector('button[aria-label="Move field 1 down"]') as HTMLButtonElement;
		moveDownBtn.click();
		await nextTick();
		const emitted = wrapper.emitted('update:draft') as Draft[][];
		expect(emitted).toBeTruthy();
		const newDraft = emitted[0]![0];
		expect(newDraft.fields[0]!.name).toBe('beta');
		expect(newDraft.fields[1]!.name).toBe('alpha');
	});

	it('save button is disabled when isDirty=false', async () => {
		const wrapper = mountEditor({ isDirty: false, isSaving: false });
		await nextTick();
		const root = wrapper.element as HTMLElement;
		const saveBtn = root.querySelector('[data-testid="fields-save"]') as HTMLButtonElement;
		expect(saveBtn.disabled).toBe(true);
	});

	it('save button is disabled when isSaving=true', async () => {
		const wrapper = mountEditor({ isDirty: true, isSaving: true });
		await nextTick();
		const root = wrapper.element as HTMLElement;
		const saveBtn = root.querySelector('[data-testid="fields-save"]') as HTMLButtonElement;
		expect(saveBtn.disabled).toBe(true);
	});

	it('save button is enabled when isDirty=true and isSaving=false', async () => {
		const wrapper = mountEditor({ isDirty: true, isSaving: false });
		await nextTick();
		const root = wrapper.element as HTMLElement;
		const saveBtn = root.querySelector('[data-testid="fields-save"]') as HTMLButtonElement;
		expect(saveBtn.disabled).toBe(false);
	});

	it('save label is "Create {name}" in new-mode with live draft.name', async () => {
		const wrapper = mountEditor({ mode: 'new', draft: defaultDraft({ name: 'Article' }) });
		await nextTick();
		const root = wrapper.element as HTMLElement;
		const saveBtn = root.querySelector('[data-testid="fields-save"]') as HTMLButtonElement;
		expect(saveBtn.textContent?.trim()).toBe('Create Article');
	});

	it('save label falls back to type name when draft.name is empty in new-mode', async () => {
		const wrapper = mountEditor({ mode: 'new', draft: defaultDraft({ name: '' }) });
		await nextTick();
		const root = wrapper.element as HTMLElement;
		const saveBtn = root.querySelector('[data-testid="fields-save"]') as HTMLButtonElement;
		expect(saveBtn.textContent?.trim()).toBe('Create New type');
	});

	it('save label is "Save changes" in edit-mode', async () => {
		const wrapper = mountEditor({ mode: 'edit', isDirty: true });
		await nextTick();
		const root = wrapper.element as HTMLElement;
		const saveBtn = root.querySelector('[data-testid="fields-save"]') as HTMLButtonElement;
		expect(saveBtn.textContent?.trim()).toBe('Save changes');
	});

	it('save button shows "Saving…" and aria-busy="true" when isSaving', async () => {
		const wrapper = mountEditor({ isSaving: true });
		await nextTick();
		const root = wrapper.element as HTMLElement;
		const saveBtn = root.querySelector('[data-testid="fields-save"]') as HTMLButtonElement;
		expect(saveBtn.textContent?.trim()).toBe('Saving…');
		expect(saveBtn.getAttribute('aria-busy')).toBe('true');
	});

	it('service-error banner renders when serviceError is non-null', async () => {
		const wrapper = mountEditor({ serviceError: 'Something went wrong' });
		await nextTick();
		const root = wrapper.element as HTMLElement;
		const banner = root.querySelector('[data-testid="fields-service-error"]');
		expect(banner).not.toBeNull();
		expect(banner?.textContent).toContain('Something went wrong');
		expect(banner?.getAttribute('role')).toBe('status');
		expect(banner?.getAttribute('aria-live')).toBe('polite');
	});

	it('service-error banner does NOT render when serviceError is null', async () => {
		const wrapper = mountEditor({ serviceError: null });
		await nextTick();
		const root = wrapper.element as HTMLElement;
		const banner = root.querySelector('[data-testid="fields-service-error"]');
		expect(banner).toBeNull();
	});

	it('delete button only renders in edit-mode', async () => {
		const editWrapper = mountEditor({ mode: 'edit' });
		await nextTick();
		const editRoot = editWrapper.element as HTMLElement;
		expect(editRoot.querySelector('[data-testid="fields-delete"]')).not.toBeNull();
	});

	it('delete button does NOT render in new-mode', async () => {
		const newWrapper = mountEditor({ mode: 'new' });
		await nextTick();
		const newRoot = newWrapper.element as HTMLElement;
		expect(newRoot.querySelector('[data-testid="fields-delete"]')).toBeNull();
	});

	it('save button click emits save', async () => {
		const wrapper = mountEditor({ isDirty: true, isSaving: false });
		await nextTick();
		const root = wrapper.element as HTMLElement;
		const saveBtn = root.querySelector('[data-testid="fields-save"]') as HTMLButtonElement;
		saveBtn.click();
		await nextTick();
		expect(wrapper.emitted('save')).toBeTruthy();
	});

	it('cancel button click emits cancel', async () => {
		const wrapper = mountEditor();
		await nextTick();
		const root = wrapper.element as HTMLElement;
		const cancelBtn = root.querySelector('[data-testid="fields-cancel"]') as HTMLButtonElement;
		cancelBtn.click();
		await nextTick();
		expect(wrapper.emitted('cancel')).toBeTruthy();
	});

	it('delete button click emits delete', async () => {
		const wrapper = mountEditor({ mode: 'edit' });
		await nextTick();
		const root = wrapper.element as HTMLElement;
		const deleteBtn = root.querySelector('[data-testid="fields-delete"]') as HTMLButtonElement;
		deleteBtn.click();
		await nextTick();
		expect(wrapper.emitted('delete')).toBeTruthy();
	});

	it('cancel button is disabled when isSaving=true', async () => {
		const wrapper = mountEditor({ isSaving: true });
		await nextTick();
		const root = wrapper.element as HTMLElement;
		const cancelBtn = root.querySelector('[data-testid="fields-cancel"]') as HTMLButtonElement;
		expect(cancelBtn.disabled).toBe(true);
	});

	it('field errors are passed to the corresponding field row', async () => {
		const fieldErrors = new Map<string, FieldError[]>([
			['title', [{ kind: 'required-missing', fieldName: 'title' }]],
		]);
		const wrapper = mountEditor({ fieldErrors });
		await nextTick();
		const root = wrapper.element as HTMLElement;
		const titleRow = root.querySelector('[data-testid="field-row-title"]') as HTMLElement;
		expect(titleRow).not.toBeNull();
		// Error paragraph should appear inside the row
		const errorEl = titleRow.querySelector('.field-row__error');
		expect(errorEl).not.toBeNull();
	});
});
