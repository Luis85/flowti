<script setup lang="ts">
import { computed } from 'vue';
import type { Field } from '../../../../domain/make/type-schema.js';

const props = defineProps<{
	field: Extract<Field, { kind: 'number' }>;
	modelValue: number | null;
	error?: string;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', value: number | null): void }>();

const id = computed(() => `make-number-${props.field.name}`);
const displayValue = computed(() => props.modelValue === null ? '' : String(props.modelValue));

function onInput(ev: Event): void {
	const raw = (ev.target as HTMLInputElement).value;
	if (raw === '') { emit('update:modelValue', null); return; }
	const n = Number(raw);
	if (Number.isFinite(n)) emit('update:modelValue', n);
	else emit('update:modelValue', null);
}
</script>

<template>
	<label class="make-input make-number" :for="id">
		<span class="make-input__label" data-testid="input-label">
			{{ field.label ?? field.name }}<span v-if="field.required" aria-hidden="true"> *</span>
		</span>
		<input
			:id="id"
			type="number"
			:value="displayValue"
			:required="field.required"
			:data-testid="`input-number-${field.name}`"
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
