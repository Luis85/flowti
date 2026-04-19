<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useMakeStore } from '../../stores/make-store.js';
import { useMakeTypeDraft } from './use-make-type-draft.js';
import { useMakeTypeSaveFlow } from './use-make-type-save-flow.js';
import MakeTypeFieldsEditor from './MakeTypeFieldsEditor.vue';
import MakeTypeInstances from './MakeTypeInstances.vue';
import MakeTypeBaseBanner from './MakeTypeBaseBanner.vue';
import ConfirmDialog from '../../components/make/ConfirmDialog.vue';
import DeleteTypeDialog from '../../components/make/DeleteTypeDialog.vue';
import { PluginContextKey } from '../../plugin-context-key.js';
import { useMakeContext } from '../../composables/use-make-context.js';

type Tab = 'fields' | 'instances';

const route = useRoute();
const router = useRouter();
const store = useMakeStore();
const { t } = useI18n();
const ctx = inject(PluginContextKey);
const makeCtx = useMakeContext();

const draftState = useMakeTypeDraft(route, store);
const { isNewMode, typeId, committedType, draft, isDirty, fieldErrors, resetDraft } = draftState;

const {
	instancesByTypeId, instancesLoading, instancesError,
	savingType, regeneratingForId, regenerationError,
} = storeToRefs(store);

const {
	schemaErrors, renameWarningOpen, renameWarningBody, overwriteWarningOpen,
	moveInstancesDialogOpen, moveInstancesDialogTitle, moveInstancesDialogBody, moveInstancesDialogBusy,
	onSave, onRenameAcknowledge, onRegenerate, onOverwriteConfirm, onMoveInstancesConfirm,
} = useMakeTypeSaveFlow(store, draftState, router, t as (key: string, values?: Record<string, unknown>) => string, ctx);

// --- Tab state (full a11y) ---
const activeTab = ref<Tab>(route.hash === '#fields' || isNewMode.value ? 'fields' : 'instances');
watch(() => route.hash, (h) => { if (!isNewMode.value) activeTab.value = h === '#fields' ? 'fields' : 'instances'; });
watch(activeTab, (tab) => { if (!isNewMode.value && route.hash !== `#${tab}`) void router.replace({ hash: `#${tab}` }); });
function onTabKeydown(e: KeyboardEvent, current: Tab): void {
	if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
		activeTab.value = current === 'fields' ? 'instances' : 'fields';
		e.preventDefault();
	}
}

// --- Base banner computed state ---
const baseFileMissing = computed(() => !isNewMode.value && committedType.value !== null && committedType.value.baseFile === undefined);
const baseFileStale = computed(() => {
	const c = committedType.value;
	if (c?.baseFile === undefined) return false;
	return new Date(c.updatedAt).getTime() > new Date(c.baseFile.generatedAt).getTime();
});
const bannerState = computed<'missing' | 'stale' | null>(() => {
	if (baseFileMissing.value) return 'missing';
	if (baseFileStale.value) return 'stale';
	return null;
});
const bannerRegenerating = computed(() => typeId.value !== null && regeneratingForId.value.has(typeId.value));
const bannerError = computed(() => typeId.value !== null ? (regenerationError.value.get(typeId.value) ?? null) : null);

// --- Dialog state ---
const unsavedOpen = ref(false);
const unsavedResolver = ref<((choice: 'save' | 'discard' | 'cancel') => void) | null>(null);
const deleteOpen = ref(false);
const isDeleting = ref(false);

// --- Instance count for DeleteTypeDialog ---
function ensureInstancesLoaded(): void {
	if (typeId.value !== null && !instancesByTypeId.value.has(typeId.value)) {
		void store.loadInstances(typeId.value);
	}
}
const instanceCount = computed<number | null>(() =>
	typeId.value === null ? null : (instancesByTypeId.value.get(typeId.value)?.length ?? null),
);

// --- Route guard ---
onBeforeRouteLeave(async () => {
	if (!isDirty.value) return true;
	const choice = await new Promise<'save' | 'discard' | 'cancel'>((resolve) => {
		unsavedResolver.value = resolve;
		unsavedOpen.value = true;
	});
	unsavedOpen.value = false;
	unsavedResolver.value = null;
	if (choice === 'cancel') return false;
	if (choice === 'discard') return true;
	await onSave();
	return !isDirty.value;
});

// --- onMount ---
onMounted(async () => {
	if (!isNewMode.value && !store.typesLoaded) await store.loadTypes();
	if (!isNewMode.value && typeId.value !== null) void store.loadInstances(typeId.value);
});

// --- onDelete + confirm flow ---
function onDelete(): void {
	ensureInstancesLoaded();
	deleteOpen.value = true;
}
async function onDeleteConfirm(payload: { alsoDeleteBaseFile: boolean; alsoDeleteInstances: boolean }): Promise<void> {
	isDeleting.value = true;
	const name = committedType.value?.name ?? '';
	const result = await store.deleteType(typeId.value!, {
		alsoDeleteInstances: payload.alsoDeleteInstances,
		alsoDeleteBaseFile: payload.alsoDeleteBaseFile,
	});
	isDeleting.value = false;
	if (result.kind === 'ok') {
		deleteOpen.value = false;
		const failedCount = result.value.instanceFailures.length;
		if (payload.alsoDeleteInstances && failedCount > 0) {
			ctx?.notifications.warn(t('make.cascade.deleted-partial', {
				name, instancesDeleted: result.value.instancesDeleted, failedCount,
			}));
		} else if (payload.alsoDeleteInstances) {
			ctx?.notifications.success(t('make.cascade.deleted-success', {
				name, instancesDeleted: result.value.instancesDeleted,
			}));
		} else {
			ctx?.notifications.success(t('make.notify.typeDeleted', { name }));
		}
		await router.replace('/make/types');
	}
}

// --- onToggleFavorite ---
async function onToggleFavorite(): Promise<void> {
	if (typeId.value === null) return;
	await store.toggleFavorite(typeId.value);
}

// --- Header computed ---
const headerTitle = computed(() => {
	if (isNewMode.value) return draft.value.name.trim() || t('make.type.create.title');
	return committedType.value?.name ?? '';
});
const favoriteAriaLabel = computed(() => {
	if (typeId.value === null) return '';
	return store.isFavoritedForUI(typeId.value)
		? t('make.type.favoriteRemove', { name: committedType.value?.name ?? '' })
		: t('make.type.favoriteAdd', { name: committedType.value?.name ?? '' });
});
const hasExistingInstances = computed(() => typeId.value !== null && (instancesByTypeId.value.get(typeId.value)?.length ?? 0) > 0);

// --- typesFolder from settings ---
const typesFolder = computed(() => makeCtx.settings$.value.typesFolder);
</script>

<template>
	<div class="make-type">
		<header class="make-type__header">
			<div class="title-row">
				<h1 data-testid="make-type-title">{{ headerTitle }}</h1>
				<span v-if="isDirty" data-testid="make-type-unsaved-badge" :aria-label="t('make.type.edit.unsaved')">●</span>
				<button
					v-if="!isNewMode && committedType !== null"
					type="button"
					:data-testid="`favorite-star-${typeId}`"
					:aria-label="favoriteAriaLabel"
					:aria-pressed="store.isFavoritedForUI(typeId!) ? 'true' : 'false'"
					:aria-busy="store.favoriteToggling.has(typeId!) ? 'true' : 'false'"
					class="favorite-star"
					:class="{ filled: store.isFavoritedForUI(typeId!), pending: store.favoriteToggling.has(typeId!) }"
					@click="onToggleFavorite"
				>★</button>
			</div>
			<p v-if="committedType" data-testid="make-type-folder" class="folder">Folder: {{ committedType.instancesFolder }}</p>
		</header>

		<MakeTypeBaseBanner
			v-if="bannerState !== null"
			:state="bannerState"
			:generated-at="committedType?.baseFile?.generatedAt"
			:regenerate-loading="bannerRegenerating"
			:regenerate-error="bannerError"
			@regenerate="onRegenerate(false)"
		/>

		<div v-if="!isNewMode" role="tablist" class="tabs" :aria-label="t('make.module.name')">
			<button
				id="tab-fields"
				role="tab"
				data-testid="make-type-tab-fields"
				:aria-selected="activeTab === 'fields'"
				:aria-controls="'panel-fields'"
				:tabindex="activeTab === 'fields' ? 0 : -1"
				@click="activeTab = 'fields'"
				@keydown="onTabKeydown($event, 'fields')"
			>
				{{ t('make.type.tabs.fields') }}
				<span v-if="isDirty && activeTab !== 'fields'" :aria-label="t('make.type.edit.unsaved')">●</span>
			</button>
			<button
				id="tab-instances"
				role="tab"
				data-testid="make-type-tab-instances"
				:aria-selected="activeTab === 'instances'"
				:aria-controls="'panel-instances'"
				:tabindex="activeTab === 'instances' ? 0 : -1"
				@click="activeTab = 'instances'"
				@keydown="onTabKeydown($event, 'instances')"
			>
				{{ t('make.type.tabs.instances') }}
			</button>
		</div>

		<section id="panel-fields" role="tabpanel" aria-labelledby="tab-fields" :hidden="!isNewMode && activeTab !== 'fields'">
			<MakeTypeFieldsEditor
				:draft="draft"
				:mode="isNewMode ? 'new' : 'edit'"
				:is-dirty="isDirty"
				:is-saving="savingType"
				:service-error="store.saveError"
				:has-existing-instances="hasExistingInstances"
				:original-folder="committedType?.instancesFolder"
				:field-errors="fieldErrors"
				:schema-errors="schemaErrors"
				@update:draft="draft = $event"
				@save="onSave"
				@cancel="isNewMode ? router.push('/make/types') : resetDraft()"
				@delete="onDelete"
			/>
		</section>

		<section v-if="!isNewMode" id="panel-instances" role="tabpanel" aria-labelledby="tab-instances" :hidden="activeTab !== 'instances'">
			<MakeTypeInstances
				v-if="committedType"
				:type="committedType"
				:instances="instancesByTypeId.get(typeId!)"
				:loading="instancesLoading.has(typeId!)"
				:error="instancesError.get(typeId!) ?? null"
			/>
		</section>

		<!-- Dialogs -->
		<ConfirmDialog
			:open="unsavedOpen"
			:title="t('make.type.unsaved.title')"
			:body="t('make.type.unsaved.body')"
			:options="['save', 'discard', 'cancel']"
			@resolve="(choice) => unsavedResolver?.(choice as 'save' | 'discard' | 'cancel')"
		/>
		<ConfirmDialog
			:open="renameWarningOpen"
			:title="t('make.type.renameWarning.title')"
			:body="renameWarningBody"
			:options="['cancel', 'confirm']"
			destructive
			@resolve="onRenameAcknowledge"
		/>
		<ConfirmDialog
			:open="overwriteWarningOpen"
			:title="t('make.type.basefile.overwriteWarning.title')"
			:body="t('make.type.basefile.overwriteWarning.body')"
			:options="['cancel', 'confirm']"
			destructive
			:labels="{ confirm: t('make.type.basefile.overwriteWarning.confirm') }"
			@resolve="onOverwriteConfirm"
		/>
		<ConfirmDialog
			:open="moveInstancesDialogOpen"
			:title="moveInstancesDialogTitle"
			:body="moveInstancesDialogBody"
			:options="['cancel', 'confirm']"
			:labels="{ confirm: t('make.move-instances-dialog.confirm'), cancel: t('make.move-instances-dialog.cancel') }"
			destructive
			:busy="moveInstancesDialogBusy"
			@resolve="onMoveInstancesConfirm"
		/>
		<DeleteTypeDialog
			v-if="committedType"
			:open="deleteOpen"
			:type="committedType"
			:instance-count="instanceCount"
			:is-deleting="isDeleting"
			:types-folder="typesFolder"
			@confirm="onDeleteConfirm"
			@cancel="deleteOpen = false"
		/>
	</div>
</template>

<style scoped>
.make-type { padding: 1rem; color: var(--text-normal); display: flex; flex-direction: column; gap: 0.5rem; }
.make-type__header { display: flex; flex-direction: column; gap: 0.25rem; }
.title-row { display: flex; align-items: center; gap: 0.75rem; }
.title-row h1 { margin: 0; }
.favorite-star { background: none; border: none; padding: 0; cursor: pointer; font-size: 1.25rem; color: var(--text-muted); }
.favorite-star.filled { color: var(--text-accent); }
.favorite-star.pending { opacity: 0.6; }
.folder { color: var(--text-muted); font-size: 0.875rem; margin: 0; }
.tabs { display: flex; gap: 0; border-bottom: 1px solid var(--background-modifier-border); }
.tabs button { background: none; border: none; padding: 0.5rem 0.75rem; color: var(--text-muted); border-bottom: 2px solid transparent; cursor: pointer; }
.tabs button[aria-selected="true"] { color: var(--text-normal); border-bottom-color: var(--interactive-accent); }
</style>
