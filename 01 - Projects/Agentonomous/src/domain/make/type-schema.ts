export type FieldKind = 'text' | 'list' | 'number' | 'checkbox' | 'date' | 'datetime';

export type FieldBase = {
	readonly name: string;
	readonly label?: string;
	readonly description?: string;
	readonly required: boolean;
};

export type Field =
	| (FieldBase & { readonly kind: 'text';     readonly default?: string })
	| (FieldBase & { readonly kind: 'list';     readonly default?: readonly string[] })
	| (FieldBase & { readonly kind: 'number';   readonly default?: number })
	| (FieldBase & { readonly kind: 'checkbox'; readonly default?: boolean })
	| (FieldBase & { readonly kind: 'date';     readonly default?: string /* YYYY-MM-DD */ })
	| (FieldBase & { readonly kind: 'datetime'; readonly default?: string /* ISO 8601 */ });

export type FieldValue =
	| { readonly kind: 'text';     readonly value: string }
	| { readonly kind: 'list';     readonly value: readonly string[] }
	| { readonly kind: 'number';   readonly value: number }
	| { readonly kind: 'checkbox'; readonly value: boolean }
	| { readonly kind: 'date';     readonly value: Date }
	| { readonly kind: 'datetime'; readonly value: Date };

export type TypeSchema = {
	readonly id: string;
	readonly name: string;
	readonly description?: string;
	readonly instancesFolder: string;
	readonly titleFieldName: string | null;
	readonly fields: readonly Field[];
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly baseFile?: {
		readonly path: string;
		readonly generatedAt: string;
	};
};

export const FIELD_KINDS_LITERAL: readonly FieldKind[] = ['text', 'list', 'number', 'checkbox', 'date', 'datetime'] as const;
