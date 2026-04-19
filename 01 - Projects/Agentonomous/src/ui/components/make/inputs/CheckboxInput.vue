<script setup lang="ts">
import type { Field } from '../../../../domain/make/type-schema.js';

defineProps<{
	field: Extract<Field, { kind: 'checkbox' }>;
	modelValue: boolean;
	error?: string;
	ariaInvalid?: boolean | 'true' | 'false';
	ariaDescribedby?: string;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();
</script>

<template>
	<label class="make-input make-checkbox">
		<span class="make-checkbox__row">
			<input
				type="checkbox"
				:checked="modelValue"
				:aria-invalid="ariaInvalid"
				:aria-describedby="ariaDescribedby"
				:data-testid="`input-checkbox-${field.name}`"
				@change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
			>
			<span class="make-input__label" data-testid="input-label">
				{{ field.label ?? field.name }}<span v-if="field.required" aria-hidden="true"> *</span>
			</span>
		</span>
		<span v-if="field.description" class="make-input__help" data-testid="input-help">{{ field.description }}</span>
		<span v-if="error" class="make-input__error" data-testid="input-error">{{ error }}</span>
	</label>
</template>

<style scoped>
.make-input { display: flex; flex-direction: column; gap: 0.25rem; }
.make-checkbox__row { display: flex; gap: 0.5rem; align-items: center; }
.make-input__label { font-size: 0.875rem; }
.make-input__help { font-size: 0.75rem; color: var(--text-muted); }
.make-input__error { font-size: 0.75rem; color: var(--text-error); }
</style>
