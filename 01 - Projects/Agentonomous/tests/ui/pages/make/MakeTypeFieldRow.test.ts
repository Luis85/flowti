import { describe, it, expect } from 'vitest';
import { nextTick } from 'vue';
import MakeTypeFieldRow from '../../../../src/ui/pages/make/MakeTypeFieldRow.vue';
import { mountWithI18n } from '../../../__fixtures__/mount-with-i18n.js';
import type { Field } from '../../../../src/domain/make/type-schema.js';
import type { FieldError } from '../../../../src/domain/make/errors.js';

function defaultField(overrides: Partial<Field> = {}): Field {
	return {
		kind: 'text',
		name: 'title',
		required: false,
		...overrides,
	} as Field;
}

function mountRow(props: Record<string, unknown> = {}) {
	return mountWithI18n(MakeTypeFieldRow, {
		props: {
			field: defaultField(),
			index: 0,
			isFirst: false,
			isLast: false,
			isOnly: false,
			isTitleField: false,
			errors: [] as FieldError[],
			...props,
		},
	});
}

describe('MakeTypeFieldRow', () => {
	it('name input has correct aria-label with index interpolation', () => {
		const wrapper = mountRow({ index: 1 });
		const root = wrapper.element as HTMLElement;
		const nameInput = root.querySelector('input[aria-label="Field 2 name"]');
		expect(nameInput).not.toBeNull();
	});

	it('kind select has correct aria-label', () => {
		const wrapper = mountRow({ index: 0 });
		const root = wrapper.element as HTMLElement;
		const select = root.querySelector('select[aria-label="Field 1 kind"]');
		expect(select).not.toBeNull();
	});

	it('label input has correct aria-label', () => {
		const wrapper = mountRow({ index: 2 });
		const root = wrapper.element as HTMLElement;
		const labelInput = root.querySelector('input[aria-label="Field 3 label"]');
		expect(labelInput).not.toBeNull();
	});

	it('kind change emits update with reset default and preserves label/description/required', async () => {
		const wrapper = mountRow({
			field: defaultField({ kind: 'text', name: 'myfield', label: 'My Label', description: 'My desc', required: true }),
		});
		const root = wrapper.element as HTMLElement;
		const select = root.querySelector('select') as HTMLSelectElement;
		// Find the 'number' option and select it by index, then dispatch change event
		const options = Array.from(select.options);
		const numberIndex = options.findIndex((o) => o.value === 'number');
		expect(numberIndex).toBeGreaterThan(-1);
		select.selectedIndex = numberIndex;
		select.dispatchEvent(new Event('change', { bubbles: true }));
		await nextTick();
		const events = wrapper.emitted('update') as Field[][];
		expect(events).toBeTruthy();
		const emitted = events[0]![0];
		expect(emitted.kind).toBe('number');
		// default for number field should NOT carry over string default
		expect((emitted as { default?: unknown }).default).toBeUndefined();
		// Preserved fields
		expect(emitted.label).toBe('My Label');
		expect(emitted.description).toBe('My desc');
		expect(emitted.required).toBe(true);
	});

	it('moveUp button emits moveUp on click when not first', async () => {
		const wrapper = mountRow({ isFirst: false });
		const root = wrapper.element as HTMLElement;
		const upBtn = root.querySelector('button[aria-label="Move field 1 up"]') as HTMLButtonElement;
		expect(upBtn).not.toBeNull();
		upBtn.click();
		await nextTick();
		expect(wrapper.emitted('moveUp')).toBeTruthy();
	});

	it('moveUp button is disabled when isFirst', () => {
		const wrapper = mountRow({ isFirst: true });
		const root = wrapper.element as HTMLElement;
		const upBtn = root.querySelector('button[aria-label="Move field 1 up"]') as HTMLButtonElement;
		expect(upBtn.disabled).toBe(true);
	});

	it('moveDown button emits moveDown on click when not last', async () => {
		const wrapper = mountRow({ isLast: false });
		const root = wrapper.element as HTMLElement;
		const downBtn = root.querySelector('button[aria-label="Move field 1 down"]') as HTMLButtonElement;
		expect(downBtn).not.toBeNull();
		downBtn.click();
		await nextTick();
		expect(wrapper.emitted('moveDown')).toBeTruthy();
	});

	it('moveDown button is disabled when isLast', () => {
		const wrapper = mountRow({ isLast: true });
		const root = wrapper.element as HTMLElement;
		const downBtn = root.querySelector('button[aria-label="Move field 1 down"]') as HTMLButtonElement;
		expect(downBtn.disabled).toBe(true);
	});

	it('remove button emits remove on click', async () => {
		const wrapper = mountRow({ isOnly: false });
		const root = wrapper.element as HTMLElement;
		const removeBtn = root.querySelector('button[aria-label="Remove field 1"]') as HTMLButtonElement;
		expect(removeBtn).not.toBeNull();
		removeBtn.click();
		await nextTick();
		expect(wrapper.emitted('remove')).toBeTruthy();
	});

	it('remove button is disabled when isOnly', () => {
		const wrapper = mountRow({ isOnly: true });
		const root = wrapper.element as HTMLElement;
		const removeBtn = root.querySelector('button[aria-label="Remove field 1"]') as HTMLButtonElement;
		expect(removeBtn.disabled).toBe(true);
	});

	it('title badge renders when isTitleField', () => {
		const wrapper = mountRow({ isTitleField: true, field: defaultField({ name: 'title' }) });
		const root = wrapper.element as HTMLElement;
		const badge = root.querySelector('[data-testid="field-row-title-title-badge"]');
		expect(badge).not.toBeNull();
		expect(badge?.textContent).toContain('★');
	});

	it('title badge NOT rendered when isTitleField is false', () => {
		const wrapper = mountRow({ isTitleField: false, field: defaultField({ name: 'title' }) });
		const root = wrapper.element as HTMLElement;
		const badge = root.querySelector('[data-testid="field-row-title-title-badge"]');
		expect(badge).toBeNull();
	});

	it('error state sets aria-invalid="true" on name input', () => {
		const errors: FieldError[] = [{ kind: 'required-missing', fieldName: 'title' }];
		const wrapper = mountRow({ errors });
		const root = wrapper.element as HTMLElement;
		const nameInput = root.querySelector('input[aria-label="Field 1 name"]') as HTMLInputElement;
		expect(nameInput.getAttribute('aria-invalid')).toBe('true');
	});

	it('error text is rendered and correctly interpolated', () => {
		const errors: FieldError[] = [{ kind: 'required-missing', fieldName: 'title' }];
		const wrapper = mountRow({ errors });
		const root = wrapper.element as HTMLElement;
		const errorEl = root.querySelector('.field-row__error') as HTMLElement;
		expect(errorEl).not.toBeNull();
		expect(errorEl.textContent).toContain('title');
		expect(errorEl.textContent).toContain('required');
	});

	it('no error state when errors is empty', () => {
		const wrapper = mountRow({ errors: [] });
		const root = wrapper.element as HTMLElement;
		const nameInput = root.querySelector('input[aria-label="Field 1 name"]') as HTMLInputElement;
		expect(nameInput.getAttribute('aria-invalid')).toBe('false');
		const errorEl = root.querySelector('.field-row__error');
		expect(errorEl).toBeNull();
	});
});
