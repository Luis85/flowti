import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import type { TypeSchema } from '../../domain/make/type-schema.js';
import type { InstanceRef, TypeId } from '../../domain/make/types.js';
import { getMakeService, getMakeSettings } from '../../modules/make/make-module.js';

function formatError(error: unknown): string {
	if (typeof error === 'object' && error !== null && 'kind' in error) {
		const kind = (error as { kind: string }).kind;
		if ('cause' in error) return `${kind}: ${String((error as { cause: unknown }).cause)}`;
		return kind;
	}
	return String(error);
}

export const useMakeStore = defineStore('make', () => {
	const types = shallowRef<readonly TypeSchema[]>([]);
	const typesLoaded = ref(false);
	const typesLoading = ref(false);
	const typesError = ref<string | null>(null);

	const instancesByTypeId = shallowRef<ReadonlyMap<TypeId, readonly InstanceRef[]>>(new Map());
	const instancesLoading = shallowRef<ReadonlySet<TypeId>>(new Set());
	const instancesError = shallowRef<ReadonlyMap<TypeId, string>>(new Map());

	async function loadTypes(): Promise<void> {
		const svc = getMakeService();
		if (svc === null) { typesError.value = 'make module not ready'; return; }
		typesLoading.value = true;
		typesError.value = null;
		const result = await svc.listTypes();
		typesLoading.value = false;
		if (result.kind === 'err') { typesError.value = formatError(result.error); return; }
		types.value = result.value;
		typesLoaded.value = true;
	}

	async function loadInstances(typeId: TypeId): Promise<void> {
		const svc = getMakeService();
		if (svc === null) { typesError.value = 'make module not ready'; return; }
		const nextLoading = new Set(instancesLoading.value);
		nextLoading.add(typeId);
		instancesLoading.value = nextLoading;
		const result = await svc.listInstances(typeId);
		const clearLoading = new Set(instancesLoading.value);
		clearLoading.delete(typeId);
		instancesLoading.value = clearLoading;
		if (result.kind === 'err') {
			const nextError = new Map(instancesError.value);
			nextError.set(typeId, formatError(result.error));
			instancesError.value = nextError;
			return;
		}
		const nextMap = new Map(instancesByTypeId.value);
		nextMap.set(typeId, result.value);
		instancesByTypeId.value = nextMap;
		const clearError = new Map(instancesError.value);
		clearError.delete(typeId);
		instancesError.value = clearError;
	}

	async function loadInstancesForAll(): Promise<void> {
		await Promise.all(types.value.map((t) => loadInstances(t.id)));
	}

	async function refreshAll(currentTypeId?: TypeId): Promise<void> {
		types.value = [];
		typesLoaded.value = false;
		instancesByTypeId.value = new Map();
		instancesError.value = new Map();
		await loadTypes();
		if (currentTypeId !== undefined) await loadInstances(currentTypeId);
	}

	function getType(typeId: TypeId): TypeSchema | undefined {
		return types.value.find((t) => t.id === typeId);
	}

	const typesSortedByName = computed(() => [...types.value].sort((a, b) => a.name.localeCompare(b.name)));

	const instanceCountByTypeId = computed<ReadonlyMap<TypeId, number>>(() => {
		const out = new Map<TypeId, number>();
		for (const [id, list] of instancesByTypeId.value) out.set(id, list.length);
		return out;
	});

	const favoriteTypes = computed(() => {
		const settings = getMakeSettings();
		const favorites = settings?.favorites ?? [];
		return types.value.filter((t) => favorites.includes(t.id));
	});

	return {
		types,
		typesLoaded,
		typesLoading,
		typesError,
		instancesByTypeId,
		instancesLoading,
		instancesError,
		loadTypes,
		loadInstances,
		loadInstancesForAll,
		refreshAll,
		getType,
		typesSortedByName,
		instanceCountByTypeId,
		favoriteTypes,
	};
});
