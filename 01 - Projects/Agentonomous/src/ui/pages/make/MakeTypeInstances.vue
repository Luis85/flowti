<script setup lang="ts">
import { computed, inject, nextTick, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMakeStore } from '../../stores/make-store.js';
import { useCreateInstanceFlow } from './use-create-instance-flow.js';
import SchemaForm from '../../components/make/SchemaForm.vue';
import OverwriteDialog from '../../components/make/OverwriteDialog.vue';
import ConfirmDialog from '../../components/make/ConfirmDialog.vue';
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
const pendingInstanceDelete = ref<InstanceRef | null>(null);

// --- Bulk select mode ---
const selectMode    = ref(false);
const selectedPaths = shallowRef<ReadonlySet<string>>(new Set());

function toggleSelectMode(): void {
	if (props.loading) return;
	selectMode.value = !selectMode.value;
	if (!selectMode.value) selectedPaths.value = new Set();
}

function isRowSelected(path: string): boolean {
	return selectedPaths.value.has(path);
}

function toggleRowSelection(path: string): void {
	const next = new Set(selectedPaths.value);
	if (next.has(path)) next.delete(path); else next.add(path);
	selectedPaths.value = next;
}

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

// Selection hygiene: when the sorted list changes (refresh, external delete),
// drop any selected paths that no longer exist in the rendered set.
watch(
	() => sorted.value.map((r) => r.path),
	(currentPaths) => {
		const allowed = new Set(currentPaths);
		const next = new Set([...selectedPaths.value].filter((p) => allowed.has(p)));
		if (next.size !== selectedPaths.value.size) selectedPaths.value = next;
	},
);

function shortDate(iso: string): string {
	return iso.slice(0, 10);
}

function requestDeleteInstance(target: InstanceRef): void {
	pendingInstanceDelete.value = target;
}

// --- Roving tabindex + keyboard navigation for the instances list ---
const focusedRowIndex = ref(0);
const rowRefs = ref<(HTMLElement | null)[]>([]);

watch(() => sorted.value.length, (n) => {
	if (focusedRowIndex.value >= n) focusedRowIndex.value = Math.max(0, n - 1);
});

function setRowRef(el: Element | null, index: number): void {
	rowRefs.value[index] = el as HTMLElement | null;
}

function focusRow(index: number): void {
	const count = sorted.value.length;
	if (count === 0) return;
	const clamped = Math.max(0, Math.min(index, count - 1));
	focusedRowIndex.value = clamped;
	void nextTick(() => rowRefs.value[clamped]?.focus());
}

function onRowKeydown(e: KeyboardEvent, index: number): void {
	const target = e.target as HTMLElement | null;
	// Only act when the row itself has focus — don't steal keys from buttons inside it.
	if (target !== rowRefs.value[index]) return;
	const count = sorted.value.length;
	switch (e.key) {
		case 'ArrowDown': e.preventDefault(); focusRow((index + 1) % count); return;
		case 'ArrowUp':   e.preventDefault(); focusRow((index - 1 + count) % count); return;
		case 'Home':      e.preventDefault(); focusRow(0); return;
		case 'End':       e.preventDefault(); focusRow(count - 1); return;
		case 'Delete':    e.preventDefault(); requestDeleteInstance(sorted.value[index]!); return;
		case 'Enter':     e.preventDefault(); void store.openInstance(sorted.value[index]!.path, 'tab'); return;
		default: return;
	}
}

async function onConfirmInstanceDelete(choice: 'cancel' | 'confirm' | 'save' | 'discard' | 'reject'): Promise<void> {
	const target = pendingInstanceDelete.value;
	pendingInstanceDelete.value = null;
	if (target === null || choice !== 'confirm') return;
	await store.deleteInstance(target.path);
	// Cache refresh happens automatically via the make:instance-deleted subscription (Slice G).
}
</script>

<template>
	<div class="make-type-instances">
		<header class="make-type-instances__header">
			<h2 data-testid="make-type-instances-heading">{{ t('make.instances.heading') }}</h2>
			<div class="make-type-instances__header-actions">
				<button
					type="button"
					data-testid="select-mode-toggle"
					:aria-pressed="selectMode ? 'true' : 'false'"
					:disabled="loading"
					@click="toggleSelectMode"
				>
					{{ selectMode ? t('make.instances.bulk.done-button') : t('make.instances.bulk.select-button') }}
				</button>
				<button
					v-if="!selectMode"
					type="button"
					data-testid="new-instance-button"
					:aria-expanded="panelOpen ? 'true' : 'false'"
					@click="togglePanel"
				>
					+ {{ t('make.instances.new-button') }}
				</button>
			</div>
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
		<ul
			v-else
			role="list"
			class="instances-list"
			:aria-label="t('make.instances.heading')"
			:aria-multiselectable="selectMode ? 'true' : undefined"
		>
			<li
				v-for="(instanceRef, index) in sorted"
				:key="instanceRef.path"
				:ref="(el) => setRowRef(el as Element | null, index)"
				:data-testid="`instance-row-${instanceRef.path}`"
				class="instance-row"
				role="listitem"
				:tabindex="index === focusedRowIndex ? 0 : -1"
				:aria-posinset="index + 1"
				:aria-setsize="sorted.length"
				:aria-selected="selectMode ? (isRowSelected(instanceRef.path) ? 'true' : 'false') : undefined"
				@focus="focusedRowIndex = index"
				@keydown="(e: KeyboardEvent) => onRowKeydown(e, index)"
			>
				<span
					v-if="selectMode"
					role="checkbox"
					:data-testid="`instance-row-checkbox-${instanceRef.path}`"
					:aria-checked="isRowSelected(instanceRef.path) ? 'true' : 'false'"
					:aria-label="t('make.instances.bulk.select-row-aria', { title: instanceRef.title })"
					tabindex="-1"
					class="instance-row__checkbox"
					@click="() => toggleRowSelection(instanceRef.path)"
				>
					{{ isRowSelected(instanceRef.path) ? '☑' : '☐' }}
				</span>
				<span class="instance-title">{{ instanceRef.title }}</span>
				<span class="instance-date">{{ t('make.type.instances.createdLabel', { date: shortDate(instanceRef.createdAt) }) }}</span>
				<span v-if="!selectMode" class="instance-row__actions">
					<button
						type="button"
						tabindex="-1"
						:data-testid="`open-in-obsidian-${index}`"
						:aria-label="`${t('make.instance-actions.open-in-obsidian')} — ${instanceRef.title}`"
						@click="() => store.openInstance(instanceRef.path, 'tab')"
					>
						{{ t('make.instance-actions.open-in-obsidian') }}
					</button>
					<button
						type="button"
						tabindex="-1"
						:data-testid="`delete-instance-${index}`"
						:aria-label="`${t('make.instance-actions.delete')} — ${instanceRef.title}`"
						@click="() => requestDeleteInstance(instanceRef)"
					>
						{{ t('make.instance-actions.delete') }}
					</button>
				</span>
			</li>
		</ul>

		<OverwriteDialog
			v-if="flowOverwriteDialog !== null"
			:path="flowOverwriteDialog.path"
			@overwrite="onConfirmOverwrite"
			@rename="onRename"
			@cancel="flow.cancelOverwrite"
		/>

		<ConfirmDialog
			:open="pendingInstanceDelete !== null"
			:title="pendingInstanceDelete ? t('make.instance-delete-confirm.title', { title: pendingInstanceDelete.title }) : ''"
			:body="t('make.instance-delete-confirm.body')"
			:options="['cancel', 'confirm']"
			:labels="{ confirm: t('make.instance-delete-confirm.confirm'), cancel: t('make.instance-delete-confirm.cancel') }"
			:destructive="true"
			@resolve="onConfirmInstanceDelete"
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
.instance-row { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; padding: 0.375rem 0.5rem; border: 1px solid var(--background-modifier-border); border-radius: 4px; outline: none; }
.instance-row:focus-visible { outline: 2px solid var(--interactive-accent); outline-offset: -2px; }
.instance-title { font-weight: 500; flex: 1; }
.instance-date { color: var(--text-muted); font-size: 0.875rem; }
.instance-row__actions { display: flex; gap: 0.25rem; }
.make-type-instances__header-actions { display: flex; gap: 0.5rem; align-items: center; }
.instance-row__checkbox { user-select: none; cursor: pointer; padding: 0 0.25rem; font-size: 1.1em; }
.instance-row[aria-selected="true"] { background: var(--background-modifier-hover); }
</style>
