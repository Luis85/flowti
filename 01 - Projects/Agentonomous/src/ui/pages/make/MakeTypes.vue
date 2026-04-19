<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useMakeStore } from '../../stores/make-store.js';
import { useMakeContext } from '../../composables/use-make-context.js';
import ConfirmDialog from '../../components/make/ConfirmDialog.vue';
import type { CorruptTypeRef, SchemaError, IoError } from '../../../domain/make/errors.js';

const { t } = useI18n();
const store = useMakeStore();
const ctx = useMakeContext();
const { typesLoading, typesError, typesSortedByName, instanceCountByTypeId, instancesLoading, issues } = storeToRefs(store);

const showCorruptDetails = ref(false);
const pendingDelete = ref<CorruptTypeRef | null>(null);

const typesFolder = computed(() => ctx.settings$.value.typesFolder);

onMounted(async () => {
	await store.loadTypes();
	void store.loadInstancesForAll();
});

function countLabel(typeId: string): string {
	const n = instanceCountByTypeId.value.get(typeId);
	if (n === undefined) return '— instances';
	return n === 1 ? t('make.types.instancesCountOne', { count: 1 }) : t('make.types.instancesCountOther', { count: n });
}
async function onRefresh(): Promise<void> {
	await store.refreshAll();
	await store.loadInstancesForAll();
}

function reasonText(error: SchemaError | IoError): string {
	const key = `make.corrupt.${error.kind}`;
	const params: Record<string, unknown> = {};
	if ('reason' in error)      params['reason']    = error.reason;
	if ('cause' in error)       params['cause']     = error.cause;
	if ('key' in error)         params['key']       = error.key;
	if ('received' in error)    params['received']  = error.received;
	if ('name' in error)        params['name']      = error.name;
	if ('fieldName' in error)   params['fieldName'] = error.fieldName;
	if ('path' in error)        params['path']      = error.path;
	return t(key, params);
}

async function onCorruptRefresh(): Promise<void> {
	await store.loadTypes();
}

function askDelete(issue: CorruptTypeRef): void { pendingDelete.value = issue; }

async function onConfirmDelete(choice: 'confirm' | 'cancel' | 'save' | 'discard' | 'reject'): Promise<void> {
	const target = pendingDelete.value;
	pendingDelete.value = null;
	if (target === null || choice !== 'confirm') return;
	await store.deleteCorruptFile(target.path);
}
</script>

<template>
	<div class="make-types">
		<header class="make-types__header">
			<div class="make-types__title-block">
				<h1 data-testid="make-types-title">{{ t('make.types.title') }}</h1>
				<span data-testid="make-types-count" class="make-types__count-label">
					{{ typesSortedByName.length === 1 ? t('make.types.countOne', { count: 1 }) : t('make.types.countOther', { count: typesSortedByName.length }) }}
				</span>
			</div>
			<div class="make-types__header-actions">
				<router-link
					data-testid="make-types-create-cta"
					to="/make/types/new"
					class="make-types__create-cta"
				>
					{{ t('make.type.create.cta') }}
				</router-link>
				<button
					type="button"
					data-testid="make-types-refresh"
					:disabled="typesLoading || instancesLoading.size > 0"
					@click="onRefresh"
				>
					{{ t('make.types.refresh') }}
				</button>
			</div>
		</header>

		<aside
			v-if="issues.length > 0"
			data-testid="corrupt-banner"
			class="make-types__corrupt-banner"
			role="status"
		>
			<div class="make-types__corrupt-summary">
				<span class="make-types__corrupt-message">
					{{ t('make.corrupt.banner', { count: issues.length, folder: typesFolder }) }}
				</span>
				<div class="make-types__corrupt-actions">
					<button
						type="button"
						data-testid="corrupt-banner-toggle"
						:aria-expanded="showCorruptDetails ? 'true' : 'false'"
						@click="showCorruptDetails = !showCorruptDetails"
					>
						{{ showCorruptDetails ? t('make.corrupt.hide') : t('make.corrupt.show') }}
					</button>
					<button
						type="button"
						data-testid="corrupt-banner-refresh"
						@click="onCorruptRefresh"
					>
						{{ t('make.corrupt.refresh') }}
					</button>
				</div>
			</div>
			<ul
				v-if="showCorruptDetails"
				data-testid="corrupt-details"
				class="make-types__corrupt-list"
			>
				<li
					v-for="(issue, i) in issues"
					:key="issue.path"
					:data-testid="`corrupt-row-${i}`"
					class="make-types__corrupt-row"
				>
					<span class="make-types__corrupt-filename">{{ issue.filename }}</span>
					<span class="make-types__corrupt-reason">{{ reasonText(issue.error) }}</span>
					<div class="make-types__corrupt-row-actions">
						<button
							type="button"
							:data-testid="`corrupt-open-${i}`"
							:aria-label="t('make.corrupt.openLabel', { filename: issue.filename })"
							@click="store.openInstance(issue.path, 'tab')"
						>
							{{ t('make.corrupt.open') }}
						</button>
						<button
							type="button"
							:data-testid="`corrupt-delete-${i}`"
							:aria-label="t('make.corrupt.deleteLabel', { filename: issue.filename })"
							class="make-types__corrupt-delete"
							@click="askDelete(issue)"
						>
							{{ t('make.corrupt.delete') }}
						</button>
					</div>
				</li>
			</ul>
		</aside>

		<ConfirmDialog
			:open="pendingDelete !== null"
			:title="pendingDelete ? t('make.corrupt.delete-confirm.title', { filename: pendingDelete.filename }) : ''"
			:body="t('make.corrupt.delete-confirm.body')"
			:options="['cancel', 'confirm']"
			:labels="{ confirm: t('make.corrupt.delete-confirm.confirm'), cancel: t('make.corrupt.delete-confirm.cancel') }"
			:destructive="true"
			@resolve="onConfirmDelete"
		/>

		<div v-if="typesError" data-testid="make-types-error" class="make-types__error" role="alert">
			{{ typesError }}
			<button type="button" data-testid="make-types-retry" @click="onRefresh">Retry</button>
		</div>

		<p v-else-if="typesLoading && typesSortedByName.length === 0" class="make-types__loading">Loading…</p>

		<p v-else-if="typesSortedByName.length === 0" data-testid="make-types-empty" class="make-types__empty">
			{{ t('make.types.empty') }}
		</p>

		<ul v-else class="make-types__list">
			<li v-for="type in typesSortedByName" :key="type.id" class="make-types__row">
				<router-link :to="`/make/types/${type.id}`" :data-testid="`type-row-${type.id}`" class="make-types__link">
					<button
						type="button"
						:data-testid="`favorite-star-${type.id}`"
						:aria-label="store.isFavoritedForUI(type.id) ? t('make.type.favoriteRemove', { name: type.name }) : t('make.type.favoriteAdd', { name: type.name })"
						:aria-pressed="store.isFavoritedForUI(type.id) ? 'true' : 'false'"
						:aria-busy="store.favoriteToggling.has(type.id) ? 'true' : 'false'"
						class="favorite-star"
						:class="{ filled: store.isFavoritedForUI(type.id), pending: store.favoriteToggling.has(type.id) }"
						@click.prevent.stop="store.toggleFavorite(type.id)"
					>★</button>
					<span class="make-types__name">{{ type.name }}</span>
					<span v-if="type.description" class="make-types__description">{{ type.description }}</span>
					<span class="make-types__count">{{ countLabel(type.id) }}</span>
				</router-link>
			</li>
		</ul>
	</div>
</template>

<style scoped>
.make-types { padding: 1rem; color: var(--text-normal); display: flex; flex-direction: column; gap: 1rem; }
.make-types__header { display: flex; justify-content: space-between; align-items: center; }
.make-types__header h1 { margin: 0; }
.make-types__title-block { display: flex; align-items: baseline; gap: 0.5rem; }
.make-types__count-label { color: var(--text-muted); font-size: 0.875rem; }
.make-types__error { padding: 0.5rem 0.75rem; border: 1px solid var(--text-error); color: var(--text-error); border-radius: 4px; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
.make-types__loading,
.make-types__empty { color: var(--text-muted); }
.make-types__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.make-types__row { border: 1px solid var(--background-modifier-border); border-radius: 4px; }
.make-types__link {
	display: grid;
	grid-template-columns: auto 1fr auto;
	grid-template-rows: auto auto;
	grid-template-areas:
		'star name count'
		'.    desc desc';
	gap: 0.25rem 0.5rem;
	padding: 0.5rem 0.75rem;
	text-decoration: none;
	color: inherit;
	align-items: center;
}
.make-types__header-actions { display: flex; align-items: center; gap: 0.5rem; }
.make-types__create-cta { display: inline-block; padding: 0.375rem 0.75rem; background: var(--interactive-accent); color: var(--text-on-accent); border-radius: 4px; text-decoration: none; font-size: 0.875rem; }
.favorite-star { grid-area: star; background: none; border: none; padding: 0; cursor: pointer; color: var(--text-muted); font-size: 1rem; line-height: 1; }
.favorite-star.filled { color: var(--text-accent); }
.favorite-star.pending { opacity: 0.5; }
.make-types__name { grid-area: name; font-weight: 600; }
.make-types__description { grid-area: desc; color: var(--text-muted); font-size: 0.875rem; }
.make-types__count { grid-area: count; color: var(--text-muted); font-size: 0.875rem; white-space: nowrap; }

.make-types__corrupt-banner { padding: 0.5rem 0.75rem; border: 1px solid var(--text-warning, var(--text-error)); border-radius: 4px; background: var(--background-secondary); display: flex; flex-direction: column; gap: 0.5rem; }
.make-types__corrupt-summary { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
.make-types__corrupt-message { font-weight: 500; }
.make-types__corrupt-actions { display: flex; gap: 0.5rem; }
.make-types__corrupt-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.make-types__corrupt-row { display: grid; grid-template-columns: auto 1fr auto; gap: 0.5rem; align-items: center; padding: 0.25rem 0; border-top: 1px solid var(--background-modifier-border); }
.make-types__corrupt-filename { font-family: var(--font-monospace, monospace); }
.make-types__corrupt-reason { color: var(--text-muted); font-size: 0.875rem; }
.make-types__corrupt-row-actions { display: flex; gap: 0.25rem; }
.make-types__corrupt-delete { color: var(--text-error); }
</style>
