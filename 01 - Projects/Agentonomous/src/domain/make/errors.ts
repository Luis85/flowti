import type { NonEmptyArray, TypeId } from './types.js';

export type FieldRename = {
	readonly oldName: string;
	readonly newName: string;
	readonly position: number;
};

export type SchemaError =
	| { readonly kind: 'invalid-json';          readonly reason: string }
	| { readonly kind: 'missing-required-key';  readonly key: string }
	| { readonly kind: 'invalid-field-kind';    readonly received: string }
	| { readonly kind: 'duplicate-field-name';  readonly name: string }
	| { readonly kind: 'title-field-not-text';  readonly titleFieldName: string }
	| { readonly kind: 'title-field-missing';   readonly titleFieldName: string }
	| { readonly kind: 'invalid-field-default'; readonly fieldName: string; readonly reason: string }
	| { readonly kind: 'invalid-name';          readonly name: string; readonly reason: 'empty' | 'too-long' | 'illegal-char' | 'reserved' }
	| { readonly kind: 'invalid-folder-path';   readonly path: string }
	| { readonly kind: 'field-rename-warning'; readonly renames: readonly FieldRename[]; readonly affectedCount: number };

export type FieldError =
	| { readonly kind: 'required-missing'; readonly fieldName: string }
	| { readonly kind: 'invalid-text';     readonly fieldName: string }
	| { readonly kind: 'invalid-number';   readonly fieldName: string }
	| { readonly kind: 'invalid-boolean';  readonly fieldName: string }
	| { readonly kind: 'invalid-list';     readonly fieldName: string }
	| { readonly kind: 'invalid-date';     readonly fieldName: string; readonly expected: 'YYYY-MM-DD' }
	| { readonly kind: 'invalid-datetime'; readonly fieldName: string; readonly expected: 'ISO-8601' }
	| { readonly kind: 'unknown-field';    readonly fieldName: string };

export type MakeError =
	| { readonly kind: 'vault-error';            readonly cause: string }
	| { readonly kind: 'invalid-schema';         readonly issues: NonEmptyArray<SchemaError> }
	| { readonly kind: 'invalid-values';         readonly issues: NonEmptyArray<FieldError> }
	| { readonly kind: 'type-not-found';         readonly typeId: TypeId }
	| { readonly kind: 'duplicate-name';         readonly name: string }
	| { readonly kind: 'instance-exists';        readonly path: string }
	| { readonly kind: 'no-title-field' }
	| { readonly kind: 'base-generation-failed'; readonly cause: string }
	| { readonly kind: 'not-implemented'; readonly feature?: string };

export type IoError = {
	readonly kind: 'io-error';
	readonly cause: string;
};

export type CorruptTypeRef = {
	readonly path: string;
	readonly filename: string;
	readonly error: SchemaError | IoError;
};
