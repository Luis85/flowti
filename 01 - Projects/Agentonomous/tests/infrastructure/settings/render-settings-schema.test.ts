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

describe('renderSettingsSchema \u2014 folder kind', () => {
	it('renders a text input + Browse button when pickFolder is provided', () => {
		const container = makeContainer();
		const onChange = vi.fn();
		const pickFolder = vi.fn(async () => null);
		renderSettingsSchema(
			container,
			{ title: 'Make', fields: [{ kind: 'folder', key: 'typesFolder', label: 'Types folder' }] },
			{ typesFolder: 'Make/Types' },
			onChange,
			{ pickFolder },
		);
		const settings = _settingsByContainer.get(container) ?? [];
		const folderSetting = settings.at(-1)!;
		expect(folderSetting._texts).toHaveLength(1);
		expect(folderSetting._buttons).toHaveLength(1);
	});

	it('omits the Browse button when pickFolder is not provided', () => {
		const container = makeContainer();
		renderSettingsSchema(
			container,
			{ title: 'Make', fields: [{ kind: 'folder', key: 'typesFolder', label: 'Types folder' }] },
			{ typesFolder: 'Make/Types' },
			vi.fn(),
		);
		const settings = _settingsByContainer.get(container) ?? [];
		const folderSetting = settings.at(-1)!;
		// Text input is always present; Browse button skipped when pickFolder absent.
		expect(folderSetting._texts).toHaveLength(1);
		expect(folderSetting._buttons).toHaveLength(0);
	});

	it('clicking Browse calls pickFolder and propagates the chosen path', async () => {
		const container = makeContainer();
		const onChange = vi.fn();
		const pickFolder = vi.fn(async () => 'Make/Types/Archive');
		renderSettingsSchema(
			container,
			{ title: 'Make', fields: [{ kind: 'folder', key: 'typesFolder', label: 'Types folder' }] },
			{ typesFolder: 'Make/Types' },
			onChange,
			{ pickFolder },
		);
		const folderSetting = (_settingsByContainer.get(container) ?? []).at(-1)!;
		const browseBtn = folderSetting._buttons[0];
		if (browseBtn === undefined) throw new Error('Browse button not registered');
		await browseBtn._triggerAsync();
		expect(pickFolder).toHaveBeenCalledOnce();
		expect(onChange).toHaveBeenCalledWith({ typesFolder: 'Make/Types/Archive' });
	});

	it('null from pickFolder leaves the current value unchanged (no onChange)', async () => {
		const container = makeContainer();
		const onChange = vi.fn();
		const pickFolder = vi.fn(async () => null);
		renderSettingsSchema(
			container,
			{ title: 'Make', fields: [{ kind: 'folder', key: 'typesFolder', label: 'Types folder' }] },
			{ typesFolder: 'Make/Types' },
			onChange,
			{ pickFolder },
		);
		const folderSetting = (_settingsByContainer.get(container) ?? []).at(-1)!;
		const browseBtn = folderSetting._buttons[0];
		if (browseBtn === undefined) throw new Error('Browse button not registered');
		await browseBtn._triggerAsync();
		expect(pickFolder).toHaveBeenCalledOnce();
		expect(onChange).not.toHaveBeenCalled();
	});

	it('typing a trailing-slash value normalizes on onChange', () => {
		const container = makeContainer();
		const onChange = vi.fn();
		renderSettingsSchema(
			container,
			{ title: 'Make', fields: [{ kind: 'folder', key: 'typesFolder', label: 'Types folder' }] },
			{ typesFolder: 'Make/Types' },
			onChange,
			{ pickFolder: vi.fn(async () => null) },
		);
		const folderSetting = (_settingsByContainer.get(container) ?? []).at(-1)!;
		folderSetting._texts[0]!._trigger('Make/Types/Archive/');
		expect(onChange).toHaveBeenCalledWith({ typesFolder: 'Make/Types/Archive' });
	});
});
