// INVARIANT: useMakeStore() must be called from within an active Vue app's
// setup context (component setup or a composable invoked from setup).
// Pinia's inject() cannot resolve outside a running app.
import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import type { TypeSchema } from '../../domain/make/type-schema.js';
import type { InstanceRef, TypeId, NewTypeDraft, TypeSchemaPatch, DeleteTypeOptions, DeleteTypeReport } from '../../domain/make/types.js';
import type { CorruptTypeRef, MakeError } from '../../domain/make/errors.js';
import type { Result } from '../../domain/shared/result.js';
import { useMakeContext } from '../composables/use-make-context.js';

function formatError(error: unknown): string {
	if (typeof error === 'object' && error !== null && 'kind' in error) {
		const kind = (error as { kind: string }).kind;
		if ('cause' in error) return `${kind}: ${String((error as { cause: unknown }).cause)}`;
		return kind;
	}
	return String(error);
}

export const useMakeStore = defineStore('make', () => {
	const ctx = useMakeContext();

	const types = shallowRef<readonly TypeSchema[]>([]);
	const issues = shallowRef<readonly CorruptTypeRef[]>([]);
	const typesLoaded = ref(false);
	const typesLoading = ref(false);
	const typesError = ref<string | null>(null);

	const instancesByTypeId = shallowRef<ReadonlyMap<TypeId, readonly InstanceRef[]>>(new Map());
	const instancesLoading = shallowRef<ReadonlySet<TypeId>>(new Set());
	const instancesError = shallowRef<ReadonlyMap<TypeId, string>>(new Map());

	async function loadTypes(): Promise<void> {
		typesLoading.value = true;
		typesError.value = null;
		const result = await ctx.service.listTypes();
		typesLoading.value = false;
		if (result.kind === 'err') { typesError.value = formatError(result.error); return; }
		types.value = result.value.types;
		issues.value = result.value.issues;
		typesLoaded.value = true;
	}

	async function loadInstances(typeId: TypeId): Promise<void> {
		const nextLoading = new Set(instancesLoading.value);
		nextLoading.add(typeId);
		instancesLoading.value = nextLoading;
		const result = await ctx.service.listInstances(typeId);
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
		const favorites = ctx.settings$.value.favorites;
		return types.value.filter((t) => favorites.includes(t.id));
	});

	// --- Write state ---
	const savingType                  = ref(false);
	const saveError                   = ref<string | null>(null);
	const regeneratingForId           = shallowRef<ReadonlySet<TypeId>>(new Set());
	const regenerationError           = shallowRef<ReadonlyMap<TypeId, string>>(new Map());
	const favoriteToggling            = shallowRef<ReadonlySet<TypeId>>(new Set());
	const optimisticFavoriteOverrides = shallowRef<ReadonlyMap<TypeId, boolean>>(new Map());

	// --- Write actions ---
	async function createType(draft: NewTypeDraft): Promise<Result<TypeSchema, MakeError>> {
		savingType.value = true;
		saveError.value = null;
		const result = await ctx.service.createType(draft);
		savingType.value = false;
		if (result.kind === 'err') saveError.value = formatError(result.error);
		return result;
	}

	async function updateType(typeId: TypeId, patch: TypeSchemaPatch, options?: { acknowledgeRenames?: boolean }): Promise<Result<TypeSchema, MakeError>> {
		savingType.value = true;
		saveError.value = null;
		const result = await ctx.service.updateType(typeId, patch, options);
		savingType.value = false;
		if (result.kind === 'err') saveError.value = formatError(result.error);
		return result;
	}

	async function deleteType(typeId: TypeId, options: DeleteTypeOptions): Promise<Result<DeleteTypeReport, MakeError>> {
		savingType.value = true;
		saveError.value = null;
		const result = await ctx.service.deleteType(typeId, options);
		savingType.value = false;
		if (result.kind === 'err') saveError.value = formatError(result.error);
		return result;
	}

	async function regenerateBaseFile(typeId: TypeId, options?: { force?: boolean }): Promise<Result<string, MakeError>> {
		const startedLoading = new Set(regeneratingForId.value); startedLoading.add(typeId); regeneratingForId.value = startedLoading;
		const result = await ctx.service.regenerateBaseFile(typeId, options);
		const doneLoading = new Set(regeneratingForId.value); doneLoading.delete(typeId); regeneratingForId.value = doneLoading;
		if (result.kind === 'err') {
			const nextError = new Map(regenerationError.value); nextError.set(typeId, formatError(result.error)); regenerationError.value = nextError;
			return result;
		}
		const clearError = new Map(regenerationError.value); clearError.delete(typeId); regenerationError.value = clearError;
		// Refresh types to pick up the new baseFile.generatedAt.
		await loadTypes();
		return result;
	}

	async function toggleFavorite(typeId: TypeId): Promise<Result<boolean, MakeError>> {
		const currentFavorited = ctx.settings$.value.favorites.includes(typeId);
		const targetFavorited = !currentFavorited;
		// Optimistic override.
		const nextOverrides = new Map(optimisticFavoriteOverrides.value); nextOverrides.set(typeId, targetFavorited); optimisticFavoriteOverrides.value = nextOverrides;
		const started = new Set(favoriteToggling.value); started.add(typeId); favoriteToggling.value = started;
		const result = await ctx.service.toggleFavorite(typeId);
		const doneLoading = new Set(favoriteToggling.value); doneLoading.delete(typeId); favoriteToggling.value = doneLoading;
		const clearedOverrides = new Map(optimisticFavoriteOverrides.value); clearedOverrides.delete(typeId); optimisticFavoriteOverrides.value = clearedOverrides;
		return result;
	}

	function isFavoritedForUI(typeId: TypeId): boolean {
		const override = optimisticFavoriteOverrides.value.get(typeId);
		if (override !== undefined) return override;
		return ctx.settings$.value.favorites.includes(typeId);
	}

	// --- Event subscription (handlers are sole cache mutators) ---
	ctx.subscribe({
		onTypeCreated: ({ schema }) => {
			if (!types.value.some((t) => t.id === schema.id)) types.value = [...types.value, schema];
		},
		onTypeUpdated: ({ schema }) => {
			types.value = types.value.map((t) => t.id === schema.id ? schema : t);
		},
		onTypeDeleted: ({ typeId }) => {
			types.value = types.value.filter((t) => t.id !== typeId);
			const nextInstances = new Map(instancesByTypeId.value); nextInstances.delete(typeId); instancesByTypeId.value = nextInstances;
			const nextInstanceErr = new Map(instancesError.value); nextInstanceErr.delete(typeId); instancesError.value = nextInstanceErr;
			const nextRegenErr = new Map(regenerationError.value); nextRegenErr.delete(typeId); regenerationError.value = nextRegenErr;
		},
		onFavoriteToggled: () => {
			// favoriteTypes and isFavoritedForUI read reactively off ctx.settings$; no nudge needed.
		},
		onBaseRegenerated: ({ typeId: _typeId }) => {
			// regenerateBaseFile action already triggers loadTypes; this handler is a no-op
			// for same-session calls but ensures cache consistency if emitted cross-session.
		},
	});

	return {
		types,
		issues,
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
		savingType,
		saveError,
		regeneratingForId,
		regenerationError,
		favoriteToggling,
		optimisticFavoriteOverrides,
		createType,
		updateType,
		deleteType,
		regenerateBaseFile,
		toggleFavorite,
		isFavoritedForUI,
	};
});
