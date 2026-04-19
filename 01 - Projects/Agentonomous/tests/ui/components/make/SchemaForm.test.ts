import { describe, it, expect, afterEach } from 'vitest';
import { nextTick } from 'vue';
import SchemaForm from '../../../../src/ui/components/make/SchemaForm.vue';
import { SchemaFormPage } from '../../../../src/ui/components/make/SchemaForm.po.js';
import { mountWithI18n } from '../../../__fixtures__/mount-with-i18n.js';
import {
	BOOK_SCHEMA_WITH_TITLE,
	BOOK_SCHEMA_WITH_REQUIRED,
	SCHEMA_WITH_ALL_KINDS,
} from '../../../__fixtures__/make-schemas.js';
import type { FieldError } from '../../../../src/domain/make/errors.js';

function mountForm(props: Record<string, unknown> = {}) {
	const wrapper = mountWithI18n(SchemaForm, {
		props: {
			schema: BOOK_SCHEMA_WITH_TITLE,
			...props,
		},
		attachTo: document.body,
	});
	const page = new SchemaFormPage(wrapper.element as HTMLElement);
	return { wrapper, page };
}

describe('SchemaForm', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('renders the title field first when titleFieldName is set', async () => {
		const { page } = mountForm({ schema: BOOK_SCHEMA_WITH_TITLE });
		await nextTick();
		expect(page.titleInput).not.toBeNull();
		expect(page.filenameInput).toBeNull();
	});

	it('renders the explicit filename input when titleFieldName is null', async () => {
		const { page } = mountForm({ schema: SCHEMA_WITH_ALL_KINDS });
		await nextTick();
		expect(page.filenameInput).not.toBeNull();
		expect(page.titleInput).toBeNull();
	});

	it('dispatches the correct INPUT_COMPONENTS entry per FieldKind', async () => {
		const { page } = mountForm({ schema: SCHEMA_WITH_ALL_KINDS });
		await nextTick();
		expect(page.fieldInput('input-text-note')).not.toBeNull();
		expect(page.fieldInput('input-list-tags')).not.toBeNull();
		expect(page.fieldInput('input-number-rating')).not.toBeNull();
		expect(page.fieldInput('input-checkbox-archived')).not.toBeNull();
		expect(page.fieldInput('input-date-due')).not.toBeNull();
		expect(page.fieldInput('input-datetime-seenAt')).not.toBeNull();
	});

	it('surfaces server errors inline on matching fields', async () => {
		const serverErrors: FieldError[] = [
			{ kind: 'invalid-text', fieldName: 'author' },
		];
		const { page } = mountForm({ schema: BOOK_SCHEMA_WITH_TITLE, serverErrors });
		await nextTick();
		const err = page.fieldError('author');
		expect(err).not.toBeNull();
		expect(err?.textContent).toContain('author');
	});

	it('maps a server error with fieldName "__filename__" to the filename input', async () => {
		const serverErrors: FieldError[] = [
			{ kind: 'invalid-text', fieldName: '__filename__' },
		];
		const { page } = mountForm({ schema: SCHEMA_WITH_ALL_KINDS, serverErrors });
		await nextTick();
		expect(page.filenameError).not.toBeNull();
	});

	it('emits submit with raw values and explicitFilename=null when title field is set', async () => {
		const { wrapper, page } = mountForm({ schema: BOOK_SCHEMA_WITH_TITLE });
		await nextTick();
		const titleInput = page.titleInput!;
		titleInput.value = 'Dune';
		titleInput.dispatchEvent(new Event('input'));
		await nextTick();
		page.submitButton?.click();
		await nextTick();
		const emitted = wrapper.emitted('submit') as Array<[{ raw: Record<string, unknown>; explicitFilename: string | null }]>;
		expect(emitted).toBeTruthy();
		expect(emitted[0]![0].raw['title']).toBe('Dune');
		expect(emitted[0]![0].explicitFilename).toBeNull();
	});

	it('emits submit with explicitFilename when titleFieldName is null', async () => {
		const { wrapper, page } = mountForm({ schema: SCHEMA_WITH_ALL_KINDS });
		await nextTick();
		const filename = page.filenameInput!;
		filename.value = 'my-note';
		filename.dispatchEvent(new Event('input'));
		await nextTick();
		page.submitButton?.click();
		await nextTick();
		const emitted = wrapper.emitted('submit') as Array<[{ raw: Record<string, unknown>; explicitFilename: string | null }]>;
		expect(emitted).toBeTruthy();
		expect(emitted[0]![0].explicitFilename).toBe('my-note');
	});

	it('emits cancel when the cancel button is clicked', async () => {
		const { wrapper, page } = mountForm();
		await nextTick();
		page.cancelButton?.click();
		await nextTick();
		expect(wrapper.emitted('cancel')).toBeTruthy();
	});

	it('client-side required validation blocks submit and surfaces the error inline', async () => {
		const { wrapper, page } = mountForm({ schema: BOOK_SCHEMA_WITH_REQUIRED });
		await nextTick();
		page.submitButton?.click();
		await nextTick();
		expect(wrapper.emitted('submit')).toBeFalsy();
		// The required title field should have a title-section error and author should have a row error.
		expect(page.titleError).not.toBeNull();
		expect(page.fieldError('author')).not.toBeNull();
	});

	it('renders submitLabel prop on the submit button when provided', async () => {
		const { page } = mountForm({ schema: BOOK_SCHEMA_WITH_TITLE, submitLabel: 'Save' });
		await nextTick();
		expect(page.submitButton?.textContent?.trim()).toBe('Save');
	});

	it('rejects empty filename submission and surfaces the filename error', async () => {
		const { wrapper, page } = mountForm({ schema: SCHEMA_WITH_ALL_KINDS });
		await nextTick();
		// Submit without entering anything in the filename input.
		page.submitButton?.click();
		await nextTick();
		expect(wrapper.emitted('submit')).toBeFalsy();
		expect(page.filenameError).not.toBeNull();
	});
});
