import { Setting } from 'obsidian';
import type { SettingsField, SettingsSchema } from '../../domain/settings/settings-schema.js';

type AugmentedEl = HTMLElement & {
	createEl: (tag: string, opts?: { text?: string; cls?: string }) => HTMLElement;
};

/**
 * Render a declarative schema into a container.  Each field edits a key on
 * `current` and calls `onChange(nextRecord)` whenever the user modifies a
 * value.  The caller persists the updated record (typically via
 * SettingsPort.saveSection).
 */
export function renderSettingsSchema(
	containerEl: HTMLElement,
	schema: SettingsSchema,
	current: Record<string, unknown>,
	onChange: (next: Record<string, unknown>) => void,
): void {
	const augmented = containerEl as AugmentedEl;
	augmented.createEl('h3', { text: schema.title });

	let state: Record<string, unknown> = { ...current };

	for (const field of schema.fields) {
		renderField(containerEl, field, state, (next) => {
			state = next;
			onChange(next);
		});
	}
}

function renderField(
	containerEl: HTMLElement,
	field: SettingsField,
	state: Record<string, unknown>,
	onChange: (next: Record<string, unknown>) => void,
): void {
	switch (field.kind) {
		case 'toggle':
			renderToggle(containerEl, field, state, onChange);
			return;
		case 'dropdown':
			renderDropdown(containerEl, field, state, onChange);
			return;
		case 'text':
			renderText(containerEl, field, state, onChange);
			return;
		case 'number':
			renderNumber(containerEl, field, state, onChange);
			return;
	}
}

function renderToggle(
	containerEl: HTMLElement,
	field: Extract<SettingsField, { kind: 'toggle' }>,
	state: Record<string, unknown>,
	onChange: (next: Record<string, unknown>) => void,
): void {
	const raw = state[field.key];
	const initial = typeof raw === 'boolean' ? raw : false;
	const setting = applyMeta(new Setting(containerEl), field);
	setting.addToggle((toggle) => {
		toggle
			.setValue(initial)
			.onChange((value) => { onChange({ ...state, [field.key]: value }); });
	});
}

function renderDropdown(
	containerEl: HTMLElement,
	field: Extract<SettingsField, { kind: 'dropdown' }>,
	state: Record<string, unknown>,
	onChange: (next: Record<string, unknown>) => void,
): void {
	const raw = state[field.key];
	const initial = typeof raw === 'string' ? raw : '';
	const setting = applyMeta(new Setting(containerEl), field);
	setting.addDropdown((dropdown) => {
		for (const opt of field.options) dropdown.addOption(opt.value, opt.label);
		dropdown
			.setValue(initial)
			.onChange((value) => { onChange({ ...state, [field.key]: value }); });
	});
}

function renderText(
	containerEl: HTMLElement,
	field: Extract<SettingsField, { kind: 'text' }>,
	state: Record<string, unknown>,
	onChange: (next: Record<string, unknown>) => void,
): void {
	const raw = state[field.key];
	const initial = typeof raw === 'string' ? raw : '';
	const setting = applyMeta(new Setting(containerEl), field);
	setting.addText((input) => {
		if (field.placeholder !== undefined) input.setPlaceholder(field.placeholder);
		input
			.setValue(initial)
			.onChange((value) => { onChange({ ...state, [field.key]: value }); });
	});
}

function renderNumber(
	containerEl: HTMLElement,
	field: Extract<SettingsField, { kind: 'number' }>,
	state: Record<string, unknown>,
	onChange: (next: Record<string, unknown>) => void,
): void {
	const initial = typeof state[field.key] === 'number' ? String(state[field.key]) : '';
	const setting = applyMeta(new Setting(containerEl), field);
	setting.addText((input) => {
		input.inputEl.type = 'number';
		if (field.min !== undefined) input.inputEl.min = String(field.min);
		if (field.max !== undefined) input.inputEl.max = String(field.max);
		if (field.step !== undefined) input.inputEl.step = String(field.step);
		input
			.setValue(initial)
			.onChange((value) => {
				const parsed = Number(value);
				if (Number.isNaN(parsed)) return;
				onChange({ ...state, [field.key]: parsed });
			});
	});
}

function applyMeta(setting: Setting, field: SettingsField): Setting {
	setting.setName(field.label);
	if (field.description !== undefined) setting.setDesc(field.description);
	return setting;
}
