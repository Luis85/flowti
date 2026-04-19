import type { Component } from 'vue';
import type { FieldKind } from '../../../../domain/make/type-schema.js';
import TextInput from './TextInput.vue';
import ListInput from './ListInput.vue';
import NumberInput from './NumberInput.vue';
import CheckboxInput from './CheckboxInput.vue';
import DateInput from './DateInput.vue';
import DatetimeInput from './DatetimeInput.vue';

export const INPUT_COMPONENTS: Readonly<Record<FieldKind, Component>> = {
	text:     TextInput,
	list:     ListInput,
	number:   NumberInput,
	checkbox: CheckboxInput,
	date:     DateInput,
	datetime: DatetimeInput,
} as const;
