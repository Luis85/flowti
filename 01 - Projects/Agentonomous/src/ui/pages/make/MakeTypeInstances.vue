<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMakeStore } from '../../stores/make-store.js';
import { useCreateInstanceFlow } from './use-create-instance-flow.js';
import SchemaForm from '../../components/make/SchemaForm.vue';
import OverwriteDialog from '../../components/make/OverwriteDialog.vue';
import { PluginContextKey } from '../../plugin-context-key.js';
import type { InstanceRef, TypeId } from '../../../domain/make/types.js';
import type { TypeSchema } from '../../../domain/make/type-schema.js';

const { t } = useI18n();

const props = defineProps<{
	type:      TypeSchema;
	instances: readonly InstanceRef[] | undefined;
	loading:   boolean;
	error:     string | null;
}>();

const ctx = inject(PluginContextKey);
const store = useMakeStore();
const typeIdRef = computed<TypeId>(() => props.type.id);
const flow = useCreateInstanceFlow(
	typeIdRef,
	store,
	ctx?.notifications,
	t as (key: string, values?: Record<string, unknown>) => string,
);
const flowSubmitting    = flow.submitting;
const flowServerErrors  = flow.serverErrors;
const flowOverwriteDialog = flow.overwriteDialog;

const formRef = ref<InstanceType<typeof SchemaForm> | null>(null);
const panelOpen = ref(false);

// Auto-open the panel when the instances list arrives empty.
watch(
	() => (props.instances === undefined ? null : props.instances.length === 0),
	(isEmpty) => {
		if (isEmpty === true) panelOpen.value = true;
	},
	{ immediate: true },
);

function togglePanel(): void {
	panelOpen.value = !panelOpen.value;
}

function closePanel(): void {
	panelOpen.value = false;
}

/** Returns true when the latest flow operation completed without inline errors and without opening the overwrite dialog. */
function flowSucceeded(): boolean {
	return flow.serverErrors.value.length === 0 && flow.overwriteDialog.value === null;
}

async function onSubmit(payload: { raw: Record<string, unknown>; explicitFilename: string | null }): Promise<void> {
	await flow.submit(payload);
	if (flowSucceeded()) closePanel();
}

async function onConfirmOverwrite(): Promise<void> {
	await flow.confirmOverwrite();
	if (flowSucceeded()) closePanel();
}

function onRename(): void {
	flow.cancelOverwrite();
	formRef.value?.focusNameInput();
}

const sorted = computed(() => {
	const list = props.instances ?? [];
	return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
});

function shortDate(iso: string): string {
	return iso.slice(0, 10);
}
</script>

<template>
	<div class="make-type-instances">
		<header class="make-type-instances__header">
			<h2 data-testid="make-type-instances-heading">{{ t('make.instances.heading') }}</h2>
			<button
				type="button"
				data-testid="new-instance-button"
				:aria-expanded="panelOpen ? 'true' : 'false'"
				@click="togglePanel"
			>
				+ {{ t('make.instances.new-button') }}
			</button>
		</header>

		<section
			v-if="panelOpen"
			data-testid="create-panel"
			class="make-type-instances__panel"
		>
			<h3>{{ t('make.form.panel-title') }}</h3>
			<SchemaForm
				ref="formRef"
				data-testid="create-panel-form"
				:schema="type"
				:submitting="flowSubmitting"
				:server-errors="flowServerErrors"
				@submit="onSubmit"
				@cancel="closePanel"
			/>
		</section>

		<p v-if="loading" data-testid="make-type-instances-loading" class="loading">Loading…</p>
		<p v-else-if="error" data-testid="make-type-instances-error" class="error">{{ error }}</p>
		<p v-else-if="sorted.length === 0" data-testid="make-type-instances-empty" class="empty">
			{{ t('make.type.instances.empty', { typeName: type.name }) }}
		</p>
		<ul v-else class="instances-list">
			<li
				v-for="instanceRef in sorted"
				:key="instanceRef.path"
				:data-testid="`instance-row-${instanceRef.path}`"
				class="instance-row"
			>
				<span class="instance-title">{{ instanceRef.title }}</span>
				<span class="instance-date">{{ t('make.type.instances.createdLabel', { date: shortDate(instanceRef.createdAt) }) }}</span>
			</li>
		</ul>

		<OverwriteDialog
			v-if="flowOverwriteDialog !== null"
			:path="flowOverwriteDialog.path"
			@overwrite="onConfirmOverwrite"
			@rename="onRename"
			@cancel="flow.cancelOverwrite"
		/>
	</div>
</template>

<style scoped>
.make-type-instances { padding: 0.5rem 0; display: flex; flex-direction: column; gap: 0.75rem; }
.make-type-instances__header { display: flex; justify-content: space-between; align-items: center; }
.make-type-instances__header h2 { margin: 0; font-size: 1rem; }
.make-type-instances__panel { padding: 0.75rem; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-secondary); display: flex; flex-direction: column; gap: 0.5rem; }
.make-type-instances__panel h3 { margin: 0; font-size: 0.95rem; }
.loading,
.empty { color: var(--text-muted); margin: 0; }
.error { color: var(--text-error); margin: 0; }
.instances-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.instance-row { display: flex; justify-content: space-between; padding: 0.375rem 0.5rem; border: 1px solid var(--background-modifier-border); border-radius: 4px; }
.instance-title { font-weight: 500; }
.instance-date { color: var(--text-muted); font-size: 0.875rem; }
</style>
