<script setup lang="ts">
import { ref } from 'vue';
import type { Field } from '../../../../domain/make/type-schema.js';

const props = defineProps<{
	field: Extract<Field, { kind: 'list' }>;
	modelValue: readonly string[];
	error?: string;
	ariaInvalid?: boolean | 'true' | 'false';
	ariaDescribedby?: string;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', value: readonly string[]): void }>();

const draft = ref('');
const duplicateHint = ref('');
function add(): void {
	const trimmed = draft.value.trim();
	if (trimmed === '') return;
	if (props.modelValue.includes(trimmed)) {
		duplicateHint.value = `"${trimmed}" is already in the list`;
		draft.value = '';
		return;
	}
	duplicateHint.value = '';
	emit('update:modelValue', [...props.modelValue, trimmed]);
	draft.value = '';
}
function remove(index: number): void {
	const next = [...props.modelValue];
	next.splice(index, 1);
	emit('update:modelValue', next);
}
function onDraftKeydown(ev: KeyboardEvent): void {
	if (duplicateHint.value !== '') duplicateHint.value = '';
	if (ev.key === 'Enter' || ev.key === ',') {
		ev.preventDefault();
		add();
	}
}
</script>

<template>
	<div class="make-input make-list">
		<span class="make-input__label" data-testid="input-label">
			{{ field.label ?? field.name }}<span v-if="field.required" aria-hidden="true"> *</span>
		</span>
		<div class="chips" :data-testid="`input-list-${field.name}`">
			<span v-for="(chip, i) in modelValue" :key="chip" class="chip">
				{{ chip }}
				<button type="button" :data-testid="`chip-remove-${field.name}-${i}`" @click="remove(i)">×</button>
			</span>
			<!-- aria-invalid/aria-describedby applied to the draft input — the only single editable control in this composite widget. -->
			<input
				v-model="draft"
				type="text"
				:placeholder="field.required && modelValue.length === 0 ? 'Add at least one' : 'Add...'"
				:aria-invalid="ariaInvalid"
				:aria-describedby="ariaDescribedby"
				:data-testid="`input-list-draft-${field.name}`"
				@keydown="onDraftKeydown"
			>
		</div>
		<span v-if="duplicateHint" class="make-input__hint" data-testid="input-duplicate-hint">{{ duplicateHint }}</span>
		<span v-if="field.description" class="make-input__help" data-testid="input-help">{{ field.description }}</span>
		<span v-if="error" class="make-input__error" data-testid="input-error">{{ error }}</span>
	</div>
</template>

<style scoped>
.make-input { display: flex; flex-direction: column; gap: 0.25rem; }
.make-input__label { font-size: 0.875rem; }
.make-input__help { font-size: 0.75rem; color: var(--text-muted); }
.make-input__hint { font-size: 0.75rem; color: var(--text-accent); }
.make-input__error { font-size: 0.75rem; color: var(--text-error); }
.chips { display: flex; flex-wrap: wrap; gap: 0.25rem; padding: 0.25rem; border: 1px solid var(--background-modifier-border); border-radius: 4px; }
.chip { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.125rem 0.5rem; background: var(--background-modifier-hover); border-radius: 999px; font-size: 0.75rem; }
.chip button { background: none; border: none; cursor: pointer; color: inherit; font-size: 1rem; line-height: 1; }
input { flex: 1 1 auto; min-width: 6rem; padding: 0.25rem; background: transparent; border: none; color: var(--text-normal); outline: none; }
</style>
