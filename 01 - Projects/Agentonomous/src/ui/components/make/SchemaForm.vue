<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Field, TypeSchema } from '../../../domain/make/type-schema.js';
import type { FieldError } from '../../../domain/make/errors.js';
import { FIELD_KINDS } from '../../../domain/make/field-kinds/index.js';
import { INPUT_COMPONENTS } from './inputs/registry.js';

const props = withDefaults(defineProps<{
	schema: TypeSchema;
	serverErrors?: readonly FieldError[];
	initialValues?: Readonly<Record<string, unknown>>;
	submitting?: boolean;
}>(), {
	serverErrors: () => [],
	initialValues: () => ({}),
	submitting: false,
});

const emit = defineEmits<{
	submit: [payload: { raw: Record<string, unknown>; explicitFilename: string | null }];
	cancel: [];
}>();

const { t } = useI18n();

const titleField = computed<Field | null>(() => {
	if (props.schema.titleFieldName === null) return null;
	return props.schema.fields.find((f) => f.name === props.schema.titleFieldName) ?? null;
});

const remainingFields = computed<readonly Field[]>(() => {
	const titleName = props.schema.titleFieldName;
	if (titleName === null) return props.schema.fields;
	return props.schema.fields.filter((f) => f.name !== titleName);
});

function emptyForKind(kind: Field['kind']): unknown {
	switch (kind) {
		case 'text':     return '';
		case 'list':     return [];
		case 'number':   return null;
		case 'checkbox': return false;
		case 'date':     return null;
		case 'datetime': return null;
	}
}

function seedValues(): Record<string, unknown> {
	const seeded: Record<string, unknown> = {};
	for (const field of props.schema.fields) {
		if (Object.prototype.hasOwnProperty.call(props.initialValues, field.name)) {
			seeded[field.name] = props.initialValues[field.name];
		} else if (field.default !== undefined) {
			seeded[field.name] = field.default;
		} else {
			seeded[field.name] = emptyForKind(field.kind);
		}
	}
	return seeded;
}

const values = ref<Record<string, unknown>>(seedValues());
const explicitFilename = ref<string>('');
const clientErrors = ref<readonly FieldError[]>([]);

function errorFor(fieldName: string): FieldError | undefined {
	const client = clientErrors.value.find((e) => e.fieldName === fieldName);
	if (client !== undefined) return client;
	return props.serverErrors.find((e) => e.fieldName === fieldName);
}

function errorMessageFor(error: FieldError): string {
	return t(`make.form.errors.${error.kind}`, error as unknown as Record<string, unknown>);
}

function errorMessage(fieldName: string): string | undefined {
	const error = errorFor(fieldName);
	return error === undefined ? undefined : errorMessageFor(error);
}

function fieldErrorTestId(fieldName: string): string {
	return `schema-form-error-${fieldName}`;
}

function isEmpty(field: Field, raw: unknown): boolean {
	if (raw === null || raw === undefined) return true;
	if (field.kind === 'text' && typeof raw === 'string' && raw.trim() === '') return true;
	if (field.kind === 'list' && Array.isArray(raw) && raw.length === 0) return true;
	return false;
}

function validateField(field: Field, raw: unknown): FieldError | null {
	if (isEmpty(field, raw)) {
		if (field.required) return { kind: 'required-missing', fieldName: field.name };
		return null;
	}
	const spec = FIELD_KINDS[field.kind];
	// Type-narrowed dispatch: spec.validateValue accepts the field's own kind variant.
	const result = (spec.validateValue as (f: Field, r: unknown) => ReturnType<typeof spec.validateValue>)(field, raw);
	if (result.kind === 'err') return result.error;
	return null;
}

function onSubmit(): void {
	const errors: FieldError[] = [];

	if (props.schema.titleFieldName === null) {
		const filename = explicitFilename.value;
		if (filename.trim() === '') {
			errors.push({ kind: 'invalid-text', fieldName: '__filename__' });
		}
	}

	for (const field of props.schema.fields) {
		const error = validateField(field, values.value[field.name]);
		if (error !== null) errors.push(error);
	}

	if (errors.length > 0) {
		clientErrors.value = errors;
		return;
	}

	clientErrors.value = [];
	emit('submit', {
		raw: { ...values.value },
		explicitFilename: props.schema.titleFieldName === null ? explicitFilename.value : null,
	});
}

function onCancel(): void {
	emit('cancel');
}

function setFieldValue(name: string, value: unknown): void {
	values.value = { ...values.value, [name]: value };
}

function ariaDescribedBy(fieldName: string): string | undefined {
	return errorFor(fieldName) === undefined ? undefined : fieldErrorTestId(fieldName);
}
</script>

<template>
	<form class="schema-form" novalidate @submit.prevent="onSubmit">
		<template v-if="titleField !== null">
			<label class="schema-form__field" :for="`schema-form-title-input-${schema.id}`">
				<span class="schema-form__label">
					{{ titleField.label ?? titleField.name }}
					<span class="schema-form__suffix">{{ t('make.form.title-suffix') }}</span>
				</span>
				<input
					:id="`schema-form-title-input-${schema.id}`"
					type="text"
					data-testid="schema-form-title"
					:value="values[titleField.name] ?? ''"
					:aria-required="titleField.required ? 'true' : undefined"
					:aria-invalid="errorFor(titleField.name) !== undefined ? 'true' : undefined"
					:aria-describedby="ariaDescribedBy(titleField.name)"
					@input="setFieldValue(titleField.name, ($event.target as HTMLInputElement).value)"
				>
				<span
					v-if="errorMessage(titleField.name)"
					:id="fieldErrorTestId(titleField.name)"
					:data-testid="fieldErrorTestId(titleField.name)"
					class="schema-form__error"
				>
					{{ errorMessage(titleField.name) }}
				</span>
			</label>
		</template>
		<template v-else>
			<label class="schema-form__field" for="schema-form-filename-input">
				<span class="schema-form__label">
					{{ t('make.form.filename') }}
					<span class="schema-form__suffix">{{ t('make.form.filename-help') }}</span>
				</span>
				<input
					id="schema-form-filename-input"
					type="text"
					data-testid="schema-form-filename"
					:value="explicitFilename"
					aria-required="true"
					:aria-invalid="errorFor('__filename__') !== undefined ? 'true' : undefined"
					:aria-describedby="ariaDescribedBy('__filename__')"
					@input="explicitFilename = ($event.target as HTMLInputElement).value"
				>
				<span
					v-if="errorMessage('__filename__')"
					:id="fieldErrorTestId('__filename__')"
					:data-testid="fieldErrorTestId('__filename__')"
					class="schema-form__error"
				>
					{{ errorMessage('__filename__') }}
				</span>
			</label>
		</template>

		<div
			v-for="field in remainingFields"
			:key="field.name"
			class="schema-form__field"
		>
			<component
				:is="INPUT_COMPONENTS[field.kind]"
				:field="field"
				:model-value="values[field.name]"
				:error="errorMessage(field.name)"
				:aria-required="field.required ? 'true' : undefined"
				:aria-invalid="errorFor(field.name) !== undefined ? 'true' : undefined"
				:aria-describedby="ariaDescribedBy(field.name)"
				@update:model-value="(v: unknown) => setFieldValue(field.name, v)"
			/>
			<span
				v-if="errorMessage(field.name)"
				:id="fieldErrorTestId(field.name)"
				:data-testid="fieldErrorTestId(field.name)"
				class="schema-form__sr-only"
			>
				{{ errorMessage(field.name) }}
			</span>
		</div>

		<footer class="schema-form__actions">
			<button
				type="button"
				data-testid="schema-form-cancel"
				:disabled="submitting"
				@click="onCancel"
			>
				{{ t('make.form.cancel') }}
			</button>
			<button
				type="submit"
				data-testid="schema-form-submit"
				:disabled="submitting"
				:aria-busy="submitting ? 'true' : undefined"
			>
				{{ t('make.form.submit') }}
			</button>
		</footer>
	</form>
</template>

<style scoped>
.schema-form { display: flex; flex-direction: column; gap: 0.75rem; }
.schema-form__field { display: flex; flex-direction: column; gap: 0.25rem; }
.schema-form__label { font-size: 0.875rem; }
.schema-form__suffix { color: var(--text-muted); margin-left: 0.25rem; font-size: 0.75rem; }
.schema-form__error { font-size: 0.75rem; color: var(--text-error); }
.schema-form__sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.schema-form__actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem; }
.schema-form input[type="text"] { padding: 0.375rem 0.5rem; background: var(--background-primary); color: var(--text-normal); border: 1px solid var(--background-modifier-border); border-radius: 4px; }
</style>
