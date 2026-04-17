import { describe, expect, it, vi } from 'vitest';
import { renderSettingsSchema } from '../../../src/infrastructure/settings/render-settings-schema.js';
import type { SettingsSchema } from '../../../src/domain/settings/settings-schema.js';
import { _settingsByContainer } from '../../__stubs__/obsidian.js';

function makeContainer(): HTMLElement & { createEl: (tag: string, opts?: { text?: string }) => HTMLElement; empty: () => void } {
	const el = document.createElement('div') as HTMLElement & {
		createEl: (tag: string, opts?: { text?: string }) => HTMLElement;
		empty: () => void;
	};
	el.createEl = (tag: string, opts?: { text?: string }): HTMLElement => {
		const child = document.createElement(tag);
		if (opts?.text !== undefined) child.textContent = opts.text;
		el.appendChild(child);
		return child;
	};
	el.empty = () => { el.innerHTML = ''; };
	return el;
}

describe('renderSettingsSchema', () => {
	it('renders the schema title as an h3', () => {
		const container = makeContainer();
		renderSettingsSchema(container, { title: 'My Module', fields: [] }, {}, vi.fn());
		const h3 = container.querySelector('h3');
		expect(h3?.textContent).toBe('My Module');
	});

	it('renders a toggle field and fires onChange with the updated record', () => {
		const container = makeContainer();
		const onChange = vi.fn();
		const schema: SettingsSchema = {
			title: 'T',
			fields: [{ kind: 'toggle', key: 'enabled', label: 'Enabled' }],
		};
		renderSettingsSchema(container, schema, { enabled: false }, onChange);

		const settings = _settingsByContainer.get(container) ?? [];
		expect(settings).toHaveLength(1);
		settings[0]?._toggles[0]?._trigger(true);
		expect(onChange).toHaveBeenCalledWith({ enabled: true });
	});

	it('renders a dropdown field and fires onChange with the chosen value', () => {
		const container = makeContainer();
		const onChange = vi.fn();
		const schema: SettingsSchema = {
			title: 'T',
			fields: [{
				kind: 'dropdown',
				key: 'level',
				label: 'Level',
				options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
			}],
		};
		renderSettingsSchema(container, schema, { level: 'a' }, onChange);

		const settings = _settingsByContainer.get(container) ?? [];
		settings[0]?._dropdowns[0]?._trigger('b');
		expect(onChange).toHaveBeenCalledWith({ level: 'b' });
	});

	it('renders multiple fields in order', () => {
		const container = makeContainer();
		const schema: SettingsSchema = {
			title: 'T',
			fields: [
				{ kind: 'toggle', key: 'a', label: 'A' },
				{ kind: 'toggle', key: 'b', label: 'B' },
			],
		};
		renderSettingsSchema(container, schema, {}, vi.fn());

		const settings = _settingsByContainer.get(container) ?? [];
		expect(settings).toHaveLength(2);
	});

	it('uses default (false / empty string) when the key is absent from state', () => {
		const container = makeContainer();
		const onChange = vi.fn();
		const schema: SettingsSchema = {
			title: 'T',
			fields: [{ kind: 'toggle', key: 'enabled', label: 'Enabled' }],
		};
		renderSettingsSchema(container, schema, {}, onChange);

		const settings = _settingsByContainer.get(container) ?? [];
		settings[0]?._toggles[0]?._trigger(true);
		expect(onChange).toHaveBeenCalledWith({ enabled: true });
	});
});
