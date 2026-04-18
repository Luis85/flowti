<script setup lang="ts">
import { computed } from 'vue';
import type { Field } from '../../../../domain/make/type-schema.js';

const props = defineProps<{
	field: Extract<Field, { kind: 'text' }>;
	modelValue: string;
	error?: string;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

const id = computed(() => `make-text-${props.field.name}`);
</script>

<template>
	<label class="make-input make-text" :for="id">
		<span class="make-input__label" data-testid="input-label">
			{{ field.label ?? field.name }}<span v-if="field.required" aria-hidden="true"> *</span>
		</span>
		<input
			:id="id"
			type="text"
			:value="modelValue"
			:required="field.required"
			:data-testid="`input-text-${field.name}`"
			@input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
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
