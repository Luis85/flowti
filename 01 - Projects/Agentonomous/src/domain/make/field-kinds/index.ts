import { TEXT_FIELD_KIND } from './text.js';
import { LIST_FIELD_KIND } from './list.js';
import { NUMBER_FIELD_KIND } from './number.js';
import { CHECKBOX_FIELD_KIND } from './checkbox.js';
import { DATE_FIELD_KIND } from './date.js';
import { DATETIME_FIELD_KIND } from './datetime.js';
import type { FieldKind } from '../type-schema.js';
import type { FieldKindSpec } from '../field-kind-spec.js';

export const FIELD_KINDS = {
	text: TEXT_FIELD_KIND,
	list: LIST_FIELD_KIND,
	number: NUMBER_FIELD_KIND,
	checkbox: CHECKBOX_FIELD_KIND,
	date: DATE_FIELD_KIND,
	datetime: DATETIME_FIELD_KIND,
} as const satisfies { readonly [K in FieldKind]: FieldKindSpec<K> };

export function getFieldKindSpec<K extends FieldKind>(kind: K): (typeof FIELD_KINDS)[K] {
	return FIELD_KINDS[kind];
}

export { TEXT_FIELD_KIND, LIST_FIELD_KIND, NUMBER_FIELD_KIND, CHECKBOX_FIELD_KIND, DATE_FIELD_KIND, DATETIME_FIELD_KIND };
