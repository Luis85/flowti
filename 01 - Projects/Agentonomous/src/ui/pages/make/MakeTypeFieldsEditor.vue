<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Draft } from '../../../domain/make/draft-equality.js';
import type { FieldError } from '../../../domain/make/errors.js';
import type { Field } from '../../../domain/make/type-schema.js';
import { FIELD_KINDS } from '../../../domain/make/field-kinds/index.js';
import MakeTypeSchemaDetails from './MakeTypeSchemaDetails.vue';
import MakeTypeFieldRow from './MakeTypeFieldRow.vue';

const props = defineProps<{
	draft: Draft;
	mode: 'new' | 'edit';
	isDirty: boolean;
	isSaving: boolean;
	serviceError: string | null;
	hasExistingInstances: boolean;
	originalFolder?: string;
	fieldErrors: Map<string, FieldError[]>;
	schemaErrors: { name?: string; folder?: string };
}>();

const emit = defineEmits<{
	'update:draft': [draft: Draft];
	save:           [];
	cancel:         [];
	delete:         [];
}>();

const { t } = useI18n();
const rowRefs = ref<Record<number, HTMLElement>>({});

function updateDraft(partial: Partial<Draft>): void {
	emit('update:draft', { ...props.draft, ...partial });
}

function updateField(index: number, field: Field): void {
	const nextFields = [...props.draft.fields];
	nextFields[index] = field;
	updateDraft({ fields: nextFields });
}

function addField(): void {
	const newIndex = props.draft.fields.length;
	const newField = FIELD_KINDS['text'].defaultField(`field_${newIndex + 1}`);
	updateDraft({ fields: [...props.draft.fields, newField] });
	void nextTick(() => {
		const el = rowRefs.value[newIndex];
		el?.querySelector<HTMLInputElement>('input[aria-label*="name"]')?.focus();
	});
}

function removeField(index: number): void {
	const focusIndex = index === 0 ? 1 : index - 1;
	const nextFields = props.draft.fields.filter((_, i) => i !== index);
	updateDraft({ fields: nextFields });
	void nextTick(() => {
		const el = rowRefs.value[focusIndex];
		el?.querySelector<HTMLInputElement>('input[aria-label*="name"]')?.focus();
	});
}

function moveField(index: number, direction: -1 | 1): void {
	const target = index + direction;
	if (target < 0 || target >= props.draft.fields.length) return;
	const nextFields = [...props.draft.fields];
	[nextFields[index], nextFields[target]] = [nextFields[target]!, nextFields[index]!];
	updateDraft({ fields: nextFields });
}

const saveLabel = computed(() => {
	if (props.isSaving) return t('make.type.edit.saving');
	if (props.mode === 'new') return t('make.type.edit.createButtonLive', { name: props.draft.name || t('make.type.create.title') });
	return t('make.type.edit.save');
});

const fieldNamesForTitle = computed(() => props.draft.fields.filter((f) => f.kind === 'text').map((f) => f.name));
</script>

<template>
	<div class="fields-editor">
		<MakeTypeSchemaDetails
			:draft="draft"
			:field-names="fieldNamesForTitle"
			:errors="schemaErrors"
			:has-existing-instances="hasExistingInstances"
			:original-folder="originalFolder"
			:mode="mode"
			@update:draft="updateDraft"
		/>

		<p v-if="draft.fields.length === 0" data-testid="make-type-fields-empty" class="fields-empty">
			{{ t('make.type.fields.empty') }}
		</p>
		<section data-testid="fields-list">
			<MakeTypeFieldRow
				v-for="(f, i) in draft.fields"
				:key="`${f.name}-${i}`"
				:ref="(el) => { if (el) rowRefs[i] = (el as { $el: HTMLElement }).$el; }"
				:field="f"
				:index="i"
				:is-first="i === 0"
				:is-last="i === draft.fields.length - 1"
				:is-only="draft.fields.length === 1"
				:is-title-field="f.name === draft.titleFieldName"
				:errors="fieldErrors.get(f.name) ?? []"
				@update="(field) => updateField(i, field)"
				@move-up="moveField(i, -1)"
				@move-down="moveField(i, 1)"
				@remove="removeField(i)"
			/>
		</section>

		<button type="button" data-testid="add-field-button" @click="addField">
			+ {{ t('make.type.edit.addField') }}
		</button>

		<div
			v-if="serviceError"
			data-testid="fields-service-error"
			role="status"
			aria-live="polite"
			class="service-error"
		>
			{{ serviceError }}
			<button type="button" @click="emit('save')">{{ t('make.type.edit.save') }}</button>
		</div>

		<footer data-testid="fields-footer">
			<button
				type="button"
				data-testid="fields-cancel"
				:disabled="isSaving"
				@click="emit('cancel')"
			>
				{{ t('make.type.edit.cancel') }}
			</button>
			<button
				type="button"
				data-testid="fields-save"
				:disabled="!isDirty || isSaving"
				:aria-busy="isSaving ? 'true' : 'false'"
				@click="emit('save')"
			>
				{{ saveLabel }}
			</button>
			<button
				v-if="mode === 'edit'"
				type="button"
				data-testid="fields-delete"
				class="destructive"
				@click="emit('delete')"
			>
				{{ t('make.type.edit.delete') }}
			</button>
		</footer>
	</div>
</template>

<style scoped>
.fields-editor { display: flex; flex-direction: column; gap: 1rem; }
.service-error { background: var(--background-modifier-error); color: var(--text-error); padding: 0.75rem 1rem; border-radius: 4px; display: flex; align-items: center; gap: 1rem; }
footer { display: flex; gap: 0.5rem; align-items: center; padding-top: 0.5rem; border-top: 1px solid var(--background-modifier-border); }
footer [data-testid="fields-delete"] { margin-left: auto; }
footer button.destructive { background: var(--text-error); color: var(--text-on-accent); }
</style>
