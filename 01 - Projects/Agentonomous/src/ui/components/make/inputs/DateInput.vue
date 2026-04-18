<script setup lang="ts">
import { computed } from 'vue';
import type { Field } from '../../../../domain/make/type-schema.js';
import { parseLocalDate } from '../../../../domain/make/field-kinds/date.js';

const props = defineProps<{
	field: Extract<Field, { kind: 'date' }>;
	modelValue: Date | null;
	error?: string;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', value: Date | null): void }>();

const id = computed(() => `make-date-${props.field.name}`);
const displayValue = computed(() => {
	if (props.modelValue === null) return '';
	const d = props.modelValue;
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});

function onInput(ev: Event): void {
	const raw = (ev.target as HTMLInputElement).value;
	if (raw === '') { emit('update:modelValue', null); return; }
	emit('update:modelValue', parseLocalDate(raw));
}
</script>

<template>
	<label class="make-input make-date" :for="id">
		<span class="make-input__label" data-testid="input-label">
			{{ field.label ?? field.name }}<span v-if="field.required" aria-hidden="true"> *</span>
		</span>
		<input
			:id="id"
			type="date"
			:value="displayValue"
			:required="field.required"
			:data-testid="`input-date-${field.name}`"
			@input="onInput"
		>
		<span v-if="field.description" class="make-input__help" data-testid="input-help">{{ field.description }}</span>
		<span v-if="error" class="make-input__error" data-testid="input-error">{{ error }}</span>
	</label>
</template>

<style scoped>
.make-input { display: flex; flex-direction: column; gap: 0.25rem; }
.make-input__label { font-size: 0.875rem; }
.make-input__help { font-size: 0.75rem; color: var(--text-muted); }
.make-input__error { font-size: 0.75rem; color: var(--text-error); }
input { padding: 0.375rem 0.5rem; background: var(--background-primary); color: var(--text-normal); border: 1px solid var(--background-modifier-border); border-radius: 4px; }
</style>
