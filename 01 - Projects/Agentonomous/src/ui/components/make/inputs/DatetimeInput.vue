<script setup lang="ts">
import { computed } from 'vue';
import type { Field } from '../../../../domain/make/type-schema.js';

const props = defineProps<{
	field: Extract<Field, { kind: 'datetime' }>;
	modelValue: Date | null;
	error?: string;
	ariaInvalid?: boolean | 'true' | 'false';
	ariaDescribedby?: string;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', value: Date | null): void }>();

const id = computed(() => `make-datetime-${props.field.name}`);

const displayValue = computed(() => {
	if (props.modelValue === null) return '';
	const d = props.modelValue;
	const pad = (n: number): string => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
});

function onInput(ev: Event): void {
	const raw = (ev.target as HTMLInputElement).value;
	if (raw === '') { emit('update:modelValue', null); return; }
	const d = new Date(raw);
	if (Number.isNaN(d.getTime())) emit('update:modelValue', null);
	else emit('update:modelValue', d);
}
</script>

<template>
	<label class="make-input make-datetime" :for="id">
		<span class="make-input__label" data-testid="input-label">
			{{ field.label ?? field.name }}<span v-if="field.required" aria-hidden="true"> *</span>
		</span>
		<input
			:id="id"
			type="datetime-local"
			:value="displayValue"
			:required="field.required"
			:aria-invalid="ariaInvalid"
			:aria-describedby="ariaDescribedby"
			:data-testid="`input-datetime-${field.name}`"
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
