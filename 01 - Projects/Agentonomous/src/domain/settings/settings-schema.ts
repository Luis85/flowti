/**
 * Declarative schema describing a module's user-facing settings.  Modules
 * attach a `SettingsSchema` to their definition; the settings tab aggregates
 * every schema and renders one section per module.  Modules never touch the
 * tab's DOM directly.
 */
export type SettingsSchema = {
	/** Section heading shown above the fields (usually the module name). */
	readonly title: string;
	/** Fields, rendered in order. */
	readonly fields: ReadonlyArray<SettingsField>;
};

export type SettingsField =
	| ToggleField
	| DropdownField
	| TextField
	| NumberField;

export type ToggleField = {
	readonly kind: 'toggle';
	readonly key: string;
	readonly label: string;
	readonly description?: string;
};

export type DropdownField = {
	readonly kind: 'dropdown';
	readonly key: string;
	readonly label: string;
	readonly description?: string;
	readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>;
};

export type TextField = {
	readonly kind: 'text';
	readonly key: string;
	readonly label: string;
	readonly description?: string;
	readonly placeholder?: string;
};

export type NumberField = {
	readonly kind: 'number';
	readonly key: string;
	readonly label: string;
	readonly description?: string;
	readonly min?: number;
	readonly max?: number;
	readonly step?: number;
};
