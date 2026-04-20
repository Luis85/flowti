<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Field, FieldKind } from '../../../domain/make/type-schema.js';
import { FIELD_KINDS_LITERAL } from '../../../domain/make/type-schema.js';
import type { FieldError } from '../../../domain/make/errors.js';
import { FIELD_KINDS } from '../../../domain/make/field-kinds/index.js';

const props = defineProps<{
	field: Field;
	index: number;
	isFirst: boolean;
	isLast: boolean;
	isOnly: boolean;
	isTitleField: boolean;
	errors: FieldError[];
}>();

const emit = defineEmits<{
	update: [field: Field];
	moveUp: [];
	moveDown: [];
	remove: [];
}>();

const { t } = useI18n();
const displayIndex = computed(() => props.index + 1);

function updateKind(e: Event): void {
	const kind = (e.target as HTMLSelectElement).value as FieldKind;
	// Wipe `default`; preserve name/required/label/description.
	const updated = FIELD_KINDS[kind].defaultField(props.field.name);
	emit('update', { ...updated, label: props.field.label, description: props.field.description, required: props.field.required });
}

function updateName(e: Event): void {
	emit('update', { ...props.field, name: (e.target as HTMLInputElement).value });
}
function updateLabel(e: Event): void {
	emit('update', { ...props.field, label: (e.target as HTMLInputElement).value });
}
function updateDescription(e: Event): void {
	emit('update', { ...props.field, description: (e.target as HTMLInputElement).value });
}
function updateRequired(e: Event): void {
	emit('update', { ...props.field, required: (e.target as HTMLInputElement).checked });
}

const hasError = computed(() => props.errors.length > 0);
const errorId = computed(() => `field-row-error-${props.index}`);

function formatFieldError(e: FieldError): string {
	switch (e.kind) {
		case 'required-missing': return t('make.type.field.error.requiredMissing', { field: e.fieldName });
		case 'invalid-text':     return t('make.type.field.error.invalidText',     { field: e.fieldName });
		case 'invalid-number':   return t('make.type.field.error.invalidNumber',   { field: e.fieldName });
		case 'invalid-boolean':  return t('make.type.field.error.invalidBoolean',  { field: e.fieldName });
		case 'invalid-list':     return t('make.type.field.error.invalidList',     { field: e.fieldName });
		case 'invalid-date':     return t('make.type.field.error.invalidDate',     { field: e.fieldName, expected: e.expected });
		case 'invalid-datetime': return t('make.type.field.error.invalidDatetime', { field: e.fieldName, expected: e.expected });
		case 'unknown-field':    return t('make.type.field.error.unknownField',    { field: e.fieldName });
		default: return ''; // exhaustive — but guards against unknown kinds if the union grows
	}
}

const errorText = computed(() => props.errors.map(formatFieldError).join('; '));
</script>

<template>
	<div :data-testid="`field-row-${field.name}`" class="field-row">
		<select
			:aria-label="t('make.type.field.kindLabel', { index: displayIndex })"
			:value="field.kind"
			@change="updateKind"
		>
			<option v-for="k in FIELD_KINDS_LITERAL" :key="k" :value="k">{{ k }}</option>
		</select>
		<input
			:value="field.name"
			:aria-label="t('make.type.field.nameLabel', { index: displayIndex })"
			:aria-invalid="hasError ? 'true' : 'false'"
			:aria-describedby="hasError ? errorId : undefined"
			@input="updateName"
		>
		<span
			v-if="isTitleField"
			:data-testid="`field-row-${field.name}-title-badge`"
			:aria-label="t('make.type.field.titleBadge')"
			class="title-badge"
		>★</span>
		<input
			:value="field.label ?? ''"
			:aria-label="t('make.type.field.labelLabel', { index: displayIndex })"
			@input="updateLabel"
		>
		<label class="required-cell">
			<input
				type="checkbox"
				:checked="field.required"
				:aria-label="t('make.type.field.requiredLabel', { index: displayIndex })"
				@change="updateRequired"
			>
		</label>
		<input
			:value="field.description ?? ''"
			:aria-label="t('make.type.field.descriptionLabel', { index: displayIndex })"
			@input="updateDescription"
		>
		<div class="field-row__actions">
			<button
				type="button"
				:aria-label="t('make.type.edit.moveUp', { index: displayIndex })"
				:disabled="isFirst"
				@click="emit('moveUp')"
			>
				▲
			</button>
			<button
				type="button"
				:aria-label="t('make.type.edit.moveDown', { index: displayIndex })"
				:disabled="isLast"
				@click="emit('moveDown')"
			>
				▼
			</button>
			<button
				type="button"
				:aria-label="t('make.type.edit.removeField', { index: displayIndex })"
				:disabled="isOnly"
				@click="emit('remove')"
			>
				🗑
			</button>
		</div>
		<p v-if="hasError" :id="errorId" class="field-row__error">{{ errorText }}</p>
	</div>
</template>

<style scoped>
.field-row { display: grid; grid-template-columns: auto 1fr auto 1fr auto 1fr auto; gap: 0.5rem; padding: 0.5rem; border: 1px solid var(--background-modifier-border); border-radius: 4px; }
.field-row input, .field-row select { min-height: 32px; }
.field-row__actions { display: flex; gap: 0.25rem; }
.field-row__actions button { min-width: 44px; min-height: 44px; }
.field-row__actions button[disabled] { opacity: 0.4; cursor: not-allowed; }
.field-row__error { grid-column: 1 / -1; color: var(--text-error); font-size: 0.75rem; margin: 0; }
.title-badge { color: var(--text-accent); }
@container (max-width: 600px) {
	.field-row { grid-template-columns: 1fr; }
}
</style>
