<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Field, TypeSchema } from '../../../domain/make/type-schema.js';
import type { FieldError } from '../../../domain/make/errors.js';
import { FIELD_KINDS } from '../../../domain/make/field-kinds/index.js';
import { INPUT_COMPONENTS } from './inputs/registry.js';
import TextInput from './inputs/TextInput.vue';

const props = withDefaults(defineProps<{
	schema: TypeSchema;
	serverErrors?: readonly FieldError[];
	initialValues?: Readonly<Record<string, unknown>>;
	submitting?: boolean;
	submitLabel?: string;
}>(), {
	serverErrors: () => [],
	initialValues: () => ({}),
	submitting: false,
	submitLabel: undefined,
});

const emit = defineEmits<{
	submit: [payload: { raw: Record<string, unknown>; explicitFilename: string | null }];
	cancel: [];
}>();

const { t } = useI18n();

const FILENAME_PSEUDO_FIELD: Extract<Field, { kind: 'text' }> = {
	kind: 'text',
	name: '__filename__',
	label: t('make.form.filename'),
	description: t('make.form.filename-help'),
	required: true,
};

const titleField = computed<Extract<Field, { kind: 'text' }> | null>(() => {
	if (props.schema.titleFieldName === null) return null;
	const found = props.schema.fields.find((f) => f.name === props.schema.titleFieldName);
	if (found?.kind !== 'text') return null;
	return found;
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
const titleInputRef = ref<HTMLElement | null>(null);
const filenameInputRef = ref<HTMLElement | null>(null);

function focusNameInput(): void {
	const target = titleInputRef.value ?? filenameInputRef.value;
	target?.querySelector<HTMLInputElement>('input')?.focus();
}

defineExpose({ focusNameInput });

function errorFor(fieldName: string): FieldError | null {
	const client = clientErrors.value.find((e) => e.fieldName === fieldName);
	if (client !== undefined) return client;
	const server = props.serverErrors.find((e) => e.fieldName === fieldName);
	return server ?? null;
}

function errorMessageFor(error: FieldError): string {
	return t(`make.form.errors.${error.kind}`, error as unknown as Record<string, unknown>);
}

function errorMessage(fieldName: string): string | undefined {
	const error = errorFor(fieldName);
	return error === null ? undefined : errorMessageFor(error);
}

const filenameError = computed<FieldError | null>(() => errorFor('__filename__'));
const filenameErrorMessage = computed<string | undefined>(() => {
	const err = filenameError.value;
	return err === null ? undefined : errorMessageFor(err);
});

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

function titleModel(): string {
	if (titleField.value === null) return '';
	const v = values.value[titleField.value.name];
	return typeof v === 'string' ? v : '';
}

function setTitleModel(value: string): void {
	if (titleField.value === null) return;
	setFieldValue(titleField.value.name, value);
}
</script>

<template>
	<form
		class="schema-form"
		data-testid="schema-form"
		novalidate
		@submit.prevent="onSubmit"
	>
		<section data-testid="form-title-section" class="schema-form__field">
			<template v-if="titleField !== null">
				<div ref="titleInputRef" data-testid="form-title-input">
					<TextInput
						:field="titleField"
						:model-value="titleModel()"
						:error="errorMessage(titleField.name)"
						:aria-invalid="errorFor(titleField.name) !== null"
						:aria-describedby="errorFor(titleField.name) !== null ? 'form-title-error' : undefined"
						@update:model-value="setTitleModel"
					/>
				</div>
				<p
					v-if="errorMessage(titleField.name)"
					id="form-title-error"
					data-testid="form-title-error"
					class="make-field-error"
				>
					{{ errorMessage(titleField.name) }}
				</p>
			</template>
			<template v-else>
				<div ref="filenameInputRef" data-testid="form-filename-input">
					<TextInput
						:field="FILENAME_PSEUDO_FIELD"
						:model-value="explicitFilename"
						:error="filenameErrorMessage"
						:aria-invalid="filenameError !== null"
						:aria-describedby="filenameError !== null ? 'form-filename-error' : undefined"
						@update:model-value="(v: string) => { explicitFilename = v; }"
					/>
				</div>
				<p
					v-if="filenameErrorMessage"
					id="form-filename-error"
					data-testid="form-filename-error"
					class="make-field-error"
				>
					{{ filenameErrorMessage }}
				</p>
			</template>
		</section>

		<div data-testid="form-fields" class="schema-form__fields">
			<div
				v-for="field in remainingFields"
				:key="field.name"
				class="make-field-row schema-form__field"
			>
				<div :data-testid="`form-field-${field.name}`">
					<component
						:is="INPUT_COMPONENTS[field.kind]"
						:field="field"
						:model-value="values[field.name]"
						:error="errorMessage(field.name)"
						:aria-required="field.required ? 'true' : undefined"
						:aria-invalid="errorFor(field.name) !== null"
						:aria-describedby="errorFor(field.name) !== null ? `form-field-${field.name}-error` : undefined"
						@update:model-value="(v: unknown) => setFieldValue(field.name, v)"
					/>
				</div>
				<p
					v-if="errorMessage(field.name)"
					:id="`form-field-${field.name}-error`"
					:data-testid="`form-field-${field.name}-error`"
					class="make-field-error"
				>
					{{ errorMessage(field.name) }}
				</p>
			</div>
		</div>

		<footer class="schema-form__actions">
			<button
				type="button"
				data-testid="form-cancel"
				:disabled="submitting"
				@click="onCancel"
			>
				{{ t('make.form.cancel') }}
			</button>
			<button
				type="submit"
				data-testid="form-submit"
				:disabled="submitting"
				:aria-busy="submitting ? 'true' : undefined"
			>
				{{ submitLabel ?? t('make.form.submit') }}
			</button>
		</footer>
	</form>
</template>

<style scoped>
.schema-form { display: flex; flex-direction: column; gap: 0.75rem; }
.schema-form__fields { display: flex; flex-direction: column; gap: 0.75rem; }
.schema-form__field { display: flex; flex-direction: column; gap: 0.25rem; }
.make-field-error { font-size: 0.75rem; color: var(--text-error); margin: 0; }
.schema-form__actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem; }
</style>
