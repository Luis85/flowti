<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Draft } from '../../../domain/make/draft-equality.js';

type SchemaDraft = Pick<Draft, 'name' | 'description' | 'instancesFolder' | 'titleFieldName'>;

const props = defineProps<{
	draft: SchemaDraft;
	fieldNames: readonly string[];
	errors: { name?: string; folder?: string };
	hasExistingInstances: boolean;
	originalFolder?: string;
	mode: 'new' | 'edit';
}>();

const emit = defineEmits<{
	'update:draft': [draft: SchemaDraft];
}>();

const { t } = useI18n();
const nameInputRef = ref<HTMLInputElement | null>(null);

onMounted(() => {
	if (props.mode === 'new') {
		void nextTick(() => nameInputRef.value?.focus());
	}
});

function updateName(e: Event): void {
	emit('update:draft', { ...props.draft, name: (e.target as HTMLInputElement).value });
}
function updateDescription(e: Event): void {
	emit('update:draft', { ...props.draft, description: (e.target as HTMLInputElement).value });
}
function updateFolder(e: Event): void {
	emit('update:draft', { ...props.draft, instancesFolder: (e.target as HTMLInputElement).value });
}
function updateTitleField(e: Event): void {
	const value = (e.target as HTMLSelectElement).value;
	emit('update:draft', { ...props.draft, titleFieldName: value === '' ? null : value });
}
</script>

<template>
	<details data-testid="schema-details" :open="props.mode === 'new'">
		<summary data-testid="schema-details-summary">
			{{ draft.name || t('make.type.create.title') }}
		</summary>

		<div class="schema-details__body">
			<!-- Name -->
			<div class="schema-field">
				<label for="schema-name">
					{{ t('make.type.schema.name') }}
					<span class="required-marker" aria-hidden="true">{{ t('make.type.schema.nameRequired') }}</span>
				</label>
				<input
					id="schema-name"
					ref="nameInputRef"
					data-testid="schema-name"
					:value="draft.name"
					required
					aria-required="true"
					:aria-invalid="errors.name ? 'true' : 'false'"
					:aria-describedby="errors.name ? 'schema-name-error' : undefined"
					@input="updateName"
				>
				<p
					v-if="errors.name"
					id="schema-name-error"
					data-testid="schema-name-error"
					class="field-error"
				>
					{{ errors.name }}
				</p>
			</div>

			<!-- Description -->
			<div class="schema-field">
				<label for="schema-description">{{ t('make.type.schema.description') }}</label>
				<input
					id="schema-description"
					data-testid="schema-description"
					:value="draft.description"
					@input="updateDescription"
				>
			</div>

			<!-- Instances folder -->
			<div class="schema-field">
				<label for="schema-folder">
					{{ t('make.type.schema.folder') }}
					<span class="required-marker" aria-hidden="true">{{ t('make.type.schema.folderRequired') }}</span>
				</label>
				<input
					id="schema-folder"
					data-testid="schema-folder"
					:value="draft.instancesFolder"
					required
					aria-required="true"
					:aria-invalid="errors.folder ? 'true' : 'false'"
					:aria-describedby="errors.folder ? 'schema-folder-error' : undefined"
					@input="updateFolder"
				>
				<p
					v-if="errors.folder"
					id="schema-folder-error"
					data-testid="schema-folder-error"
					class="field-error"
				>
					{{ errors.folder }}
				</p>
				<p
					v-if="hasExistingInstances && draft.instancesFolder !== originalFolder"
					data-testid="schema-folder-orphans-warning"
					class="chip chip--warning"
				>
					{{ t('make.type.schema.folderOrphansWarning') }}
				</p>
			</div>

			<!-- Title field -->
			<div class="schema-field">
				<label for="schema-title-field">{{ t('make.type.schema.titleField') }}</label>
				<select
					id="schema-title-field"
					data-testid="schema-title-field"
					:value="draft.titleFieldName ?? ''"
					:disabled="fieldNames.length === 0"
					@change="updateTitleField"
				>
					<option value="">{{ t('make.type.schema.noTitleField') }}</option>
					<option v-for="name in fieldNames" :key="name" :value="name">{{ name }}</option>
				</select>
				<p v-if="fieldNames.length === 0" data-testid="schema-no-text-fields-msg" class="hint">
					{{ t('make.type.schema.noTextFieldsAvailable') }}
				</p>
			</div>
		</div>
	</details>
</template>

<style scoped>
.schema-details__body { display: flex; flex-direction: column; gap: 1rem; padding: 1rem 0; }
.schema-field { display: flex; flex-direction: column; gap: 0.25rem; }
.schema-field label { font-size: 0.875rem; font-weight: 500; }
.required-marker { color: var(--text-error); margin-left: 0.125rem; }
.field-error { color: var(--text-error); font-size: 0.75rem; margin: 0; }
.chip { padding: 0.375rem 0.75rem; border-radius: 4px; font-size: 0.75rem; margin: 0; }
.chip--warning { background: var(--background-modifier-hover); border-left: 3px solid var(--text-warning); color: var(--text-muted); }
.hint { color: var(--text-muted); font-size: 0.75rem; margin: 0; }
</style>
