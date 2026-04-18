import { describe, it, expect } from 'vitest';
import { nextTick } from 'vue';
import MakeTypeSchemaDetails from '../../../../src/ui/pages/make/MakeTypeSchemaDetails.vue';
import { mountWithI18n } from '../../../__fixtures__/mount-with-i18n.js';

type SchemaDraft = {
	name: string;
	description: string;
	instancesFolder: string;
	titleFieldName: string | null;
};

function defaultDraft(overrides: Partial<SchemaDraft> = {}): SchemaDraft {
	return {
		name: 'My Type',
		description: 'A description',
		instancesFolder: 'types/my-type',
		titleFieldName: null,
		...overrides,
	};
}

function mountDetails(props: Record<string, unknown> = {}) {
	return mountWithI18n(MakeTypeSchemaDetails, {
		props: {
			draft: defaultDraft(),
			fieldNames: [] as string[],
			errors: {},
			hasExistingInstances: false,
			mode: 'edit',
			...props,
		},
	});
}

function mountDetailsAttached(props: Record<string, unknown> = {}) {
	const div = document.createElement('div');
	document.body.appendChild(div);
	return mountWithI18n(MakeTypeSchemaDetails, {
		attachTo: div,
		props: {
			draft: defaultDraft(),
			fieldNames: [] as string[],
			errors: {},
			hasExistingInstances: false,
			mode: 'new',
			...props,
		},
	});
}

describe('MakeTypeSchemaDetails', () => {
	it('renders name input with correct for/id linkage', () => {
		const wrapper = mountDetails();
		const root = wrapper.element as HTMLElement;
		const input = root.querySelector('#schema-name');
		const label = root.querySelector('label[for="schema-name"]');
		expect(input).not.toBeNull();
		expect(label).not.toBeNull();
	});

	it('renders description input with for/id linkage', () => {
		const wrapper = mountDetails();
		const root = wrapper.element as HTMLElement;
		const input = root.querySelector('#schema-description');
		const label = root.querySelector('label[for="schema-description"]');
		expect(input).not.toBeNull();
		expect(label).not.toBeNull();
	});

	it('renders folder input with for/id linkage', () => {
		const wrapper = mountDetails();
		const root = wrapper.element as HTMLElement;
		const input = root.querySelector('#schema-folder');
		const label = root.querySelector('label[for="schema-folder"]');
		expect(input).not.toBeNull();
		expect(label).not.toBeNull();
	});

	it('name input has required and aria-required="true" and visible * marker', () => {
		const wrapper = mountDetails();
		const root = wrapper.element as HTMLElement;
		const input = root.querySelector('#schema-name') as HTMLInputElement;
		expect(input.hasAttribute('required')).toBe(true);
		expect(input.getAttribute('aria-required')).toBe('true');
		const label = root.querySelector('label[for="schema-name"]') as HTMLElement;
		expect(label.textContent).toContain('*');
	});

	it('updating name input emits update:draft with new name', async () => {
		const wrapper = mountDetails({ draft: defaultDraft({ name: 'Old Name' }) });
		const root = wrapper.element as HTMLElement;
		const input = root.querySelector('#schema-name') as HTMLInputElement;
		input.value = 'New Name';
		input.dispatchEvent(new Event('input'));
		await nextTick();
		const events = wrapper.emitted('update:draft') as unknown[][];
		expect(events).toBeTruthy();
		expect(events[0]![0]).toMatchObject({ name: 'New Name' });
	});

	it('errors.name causes aria-invalid="true" and error text linked via aria-describedby', () => {
		const wrapper = mountDetails({ errors: { name: 'Name is required' } });
		const root = wrapper.element as HTMLElement;
		const input = root.querySelector('#schema-name') as HTMLInputElement;
		expect(input.getAttribute('aria-invalid')).toBe('true');
		const describedBy = input.getAttribute('aria-describedby');
		expect(describedBy).toBe('schema-name-error');
		const errorEl = root.querySelector('#schema-name-error') as HTMLElement;
		expect(errorEl).not.toBeNull();
		expect(errorEl.textContent).toContain('Name is required');
	});

	it('title-field dropdown lists null option and text-kind field names', () => {
		const wrapper = mountDetails({ fieldNames: ['title', 'summary'] });
		const root = wrapper.element as HTMLElement;
		const select = root.querySelector('#schema-title-field') as HTMLSelectElement;
		expect(select).not.toBeNull();
		const options = Array.from(select.options).map((o) => o.value);
		// First option is the null/empty value
		expect(options[0]).toBe('');
		expect(options).toContain('title');
		expect(options).toContain('summary');
	});

	it('orphan warning chip renders when hasExistingInstances and folder changed', () => {
		const wrapper = mountDetails({
			draft: defaultDraft({ instancesFolder: 'new-folder' }),
			hasExistingInstances: true,
			originalFolder: 'types/my-type',
		});
		const root = wrapper.element as HTMLElement;
		const warning = root.querySelector('[data-testid="schema-folder-orphans-warning"]');
		expect(warning).not.toBeNull();
	});

	it('orphan warning chip does NOT render when folder unchanged', () => {
		const wrapper = mountDetails({
			draft: defaultDraft({ instancesFolder: 'types/my-type' }),
			hasExistingInstances: true,
			originalFolder: 'types/my-type',
		});
		const root = wrapper.element as HTMLElement;
		const warning = root.querySelector('[data-testid="schema-folder-orphans-warning"]');
		expect(warning).toBeNull();
	});

	it('panel is open by default in new-mode', () => {
		const wrapper = mountDetails({ mode: 'new' });
		// The root element IS the <details> element
		const details = wrapper.element as HTMLDetailsElement;
		expect(details.open).toBe(true);
	});

	it('panel is closed by default in edit-mode', () => {
		const wrapper = mountDetails({ mode: 'edit' });
		// The root element IS the <details> element
		const details = wrapper.element as HTMLDetailsElement;
		expect(details.open).toBe(false);
	});

	it('in new-mode, name input receives focus on mount', async () => {
		const wrapper = mountDetailsAttached({ mode: 'new' });
		await nextTick();
		await nextTick();
		const root = wrapper.element as HTMLElement;
		const input = root.querySelector('#schema-name') as HTMLInputElement;
		expect(document.activeElement).toBe(input);
		wrapper.unmount();
	});
});
