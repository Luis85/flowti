import { Setting } from 'obsidian';
import type { SettingsField, SettingsSchema } from '../../domain/settings/settings-schema.js';
import type { TranslationPort } from '../../domain/shared/translation-port.js';

type AugmentedEl = HTMLElement & {
	createEl: (tag: string, opts?: { text?: string; cls?: string }) => HTMLElement;
};

export type RenderSettingsOptions = {
	/** Opens a folder-picker modal; used by the `folder` field kind. */
	readonly pickFolder?: () => Promise<string | null>;
	/** Translator for picker-related UI strings. Optional — falls back to English literals. */
	readonly t?: TranslationPort;
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
	options?: RenderSettingsOptions,
): void {
	const augmented = containerEl as AugmentedEl;
	augmented.createEl('h3', { text: schema.title });

	// Shared latest-state cell. Each field's onChange calls `update(partial)`
	// which merges into this cell, so interleaved edits across fields never
	// compose onto a stale snapshot (previous design: each renderer received
	// a by-value `state` and spread it in its closure, silently reverting
	// concurrent edits from sibling fields).
	let state: Record<string, unknown> = { ...current };
	const update = (partial: Record<string, unknown>): void => {
		state = { ...state, ...partial };
		onChange(state);
	};

	for (const field of schema.fields) {
		renderField(containerEl, field, state, update, options);
	}
}

function renderField(
	containerEl: HTMLElement,
	field: SettingsField,
	state: Record<string, unknown>,
	update: (partial: Record<string, unknown>) => void,
	options?: RenderSettingsOptions,
): void {
	switch (field.kind) {
		case 'toggle':
			renderToggle(containerEl, field, state, update);
			return;
		case 'dropdown':
			renderDropdown(containerEl, field, state, update);
			return;
		case 'text':
			renderText(containerEl, field, state, update);
			return;
		case 'number':
			renderNumber(containerEl, field, state, update);
			return;
		case 'folder':
			renderFolder(containerEl, field, state, update, options);
			return;
	}
}

function renderToggle(
	containerEl: HTMLElement,
	field: Extract<SettingsField, { kind: 'toggle' }>,
	state: Record<string, unknown>,
	update: (partial: Record<string, unknown>) => void,
): void {
	const raw = state[field.key];
	const initial = typeof raw === 'boolean' ? raw : false;
	const setting = applyMeta(new Setting(containerEl), field);
	setting.addToggle((toggle) => {
		toggle
			.setValue(initial)
			.onChange((value) => { update({ [field.key]: value }); });
	});
}

function renderDropdown(
	containerEl: HTMLElement,
	field: Extract<SettingsField, { kind: 'dropdown' }>,
	state: Record<string, unknown>,
	update: (partial: Record<string, unknown>) => void,
): void {
	const raw = state[field.key];
	const initial = typeof raw === 'string' ? raw : '';
	const setting = applyMeta(new Setting(containerEl), field);
	setting.addDropdown((dropdown) => {
		for (const opt of field.options) dropdown.addOption(opt.value, opt.label);
		dropdown
			.setValue(initial)
			.onChange((value) => { update({ [field.key]: value }); });
	});
}

function renderText(
	containerEl: HTMLElement,
	field: Extract<SettingsField, { kind: 'text' }>,
	state: Record<string, unknown>,
	update: (partial: Record<string, unknown>) => void,
): void {
	const raw = state[field.key];
	const initial = typeof raw === 'string' ? raw : '';
	const setting = applyMeta(new Setting(containerEl), field);
	setting.addText((input) => {
		if (field.placeholder !== undefined) input.setPlaceholder(field.placeholder);
		input
			.setValue(initial)
			.onChange((value) => { update({ [field.key]: value }); });
	});
}

function renderNumber(
	containerEl: HTMLElement,
	field: Extract<SettingsField, { kind: 'number' }>,
	state: Record<string, unknown>,
	update: (partial: Record<string, unknown>) => void,
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
				update({ [field.key]: parsed });
			});
	});
}

function renderFolder(
	containerEl: HTMLElement,
	field: Extract<SettingsField, { kind: 'folder' }>,
	state: Record<string, unknown>,
	update: (partial: Record<string, unknown>) => void,
	options?: RenderSettingsOptions,
): void {
	const raw = state[field.key];
	const initial = typeof raw === 'string' ? raw : '';
	const setting = applyMeta(new Setting(containerEl), field);
	const browseLabel = options?.t?.t('core.settings.folder.browse') ?? 'Browse\u2026';

	let textRef: { setValue(v: string): unknown } | null = null;

	setting.addText((input) => {
		textRef = input;
		if (field.placeholder !== undefined) input.setPlaceholder(field.placeholder);
		input
			.setValue(initial)
			.onChange((value) => {
				update({ [field.key]: normalizeFolderPath(value) });
			});
	});

	if (options?.pickFolder !== undefined) {
		const pickFolder = options.pickFolder;
		setting.addButton((btn) => {
			btn.setButtonText(browseLabel).onClick(async () => {
				const picked = await pickFolder();
				if (picked === null) return;
				// Defensive re-normalize: DialogPort contract already strips
				// trailing slashes, but the renderer should not depend on the
				// contract to protect its invariant.
				const normalized = normalizeFolderPath(picked);
				textRef?.setValue(normalized);
				update({ [field.key]: normalized });
			});
		});
	}
}

function normalizeFolderPath(value: string): string {
	return value.replace(/\/+$/, '');
}

function applyMeta(setting: Setting, field: SettingsField): Setting {
	setting.setName(field.label);
	if (field.description !== undefined) setting.setDesc(field.description);
	return setting;
}
