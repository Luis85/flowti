import { computed, ref, type ComputedRef, type Ref } from 'vue';
import type { RouteLocationNormalizedLoaded } from 'vue-router';
import type { Draft } from '../../../domain/make/draft-equality.js';
import { deepEqualDraft } from '../../../domain/make/draft-equality.js';
import type { TypeSchema, Field } from '../../../domain/make/type-schema.js';
import type { TypeId } from '../../../domain/make/types.js';
import type { FieldError } from '../../../domain/make/errors.js';
import { FIELD_KINDS } from '../../../domain/make/field-kinds/index.js';
import type { useMakeStore } from '../../stores/make-store.js';
import { getMakeSettings } from '../../../modules/make/make-module.js';

export interface UseMakeTypeDraft {
	readonly isNewMode:     ComputedRef<boolean>;
	readonly typeId:        ComputedRef<TypeId | null>;
	readonly committedType: ComputedRef<TypeSchema | null>;
	readonly draft:         Ref<Draft>;
	readonly isDirty:       ComputedRef<boolean>;
	readonly fieldErrors:   Ref<Map<string, FieldError[]>>;
	resetDraft():           void;
	applyResult(schema: TypeSchema): void;
}

function emptyDraftForNewMode(defaultFolder: string): Draft {
	const titleField: Field = FIELD_KINDS['text'].defaultField('title');
	return {
		name: '',
		description: '',
		instancesFolder: defaultFolder,
		titleFieldName: 'title',
		fields: [titleField],
	};
}

function toDraft(schema: TypeSchema): Draft {
	return {
		name: schema.name,
		description: schema.description ?? '',
		instancesFolder: schema.instancesFolder,
		titleFieldName: schema.titleFieldName,
		fields: [...schema.fields],
	};
}

export function useMakeTypeDraft(
	route: RouteLocationNormalizedLoaded,
	store: ReturnType<typeof useMakeStore>,
): UseMakeTypeDraft {
	const isNewMode = computed(() => route.name === 'make-type-new');
	const typeId = computed<TypeId | null>(() => isNewMode.value ? null : String(route.params['typeId']));
	const committedType = computed<TypeSchema | null>(() => typeId.value === null ? null : (store.getType(typeId.value) ?? null));
	const firstSaveComplete = ref(false);
	const fieldErrors = ref<Map<string, FieldError[]>>(new Map());
	const defaultFolder = getMakeSettings()?.defaultInstancesRoot ?? 'Make/Instances';
	const draft = ref<Draft>(
		isNewMode.value
			? emptyDraftForNewMode(defaultFolder)
			: (committedType.value !== null ? toDraft(committedType.value) : emptyDraftForNewMode(defaultFolder)),
	);
	// Tracks the last schema successfully applied via applyResult — used as the
	// dirty-detection reference in edit-mode so isDirty clears immediately on save
	// (before the event-driven store cache update arrives).
	const lastAppliedSchema = ref<TypeSchema | null>(committedType.value);

	const isDirty = computed(() => {
		if (isNewMode.value) return !firstSaveComplete.value;
		const reference = lastAppliedSchema.value ?? committedType.value;
		if (reference === null) return false;
		return !deepEqualDraft(draft.value, toDraft(reference));
	});

	function resetDraft(): void {
		if (isNewMode.value) {
			draft.value = emptyDraftForNewMode(defaultFolder);
			firstSaveComplete.value = false;
		} else if (committedType.value !== null) {
			draft.value = toDraft(committedType.value);
			lastAppliedSchema.value = committedType.value;
		}
		fieldErrors.value = new Map();
	}

	function applyResult(schema: TypeSchema): void {
		draft.value = toDraft(schema);
		lastAppliedSchema.value = schema;
		firstSaveComplete.value = true;
		fieldErrors.value = new Map();
	}

	return { isNewMode, typeId, committedType, draft, isDirty, fieldErrors, resetDraft, applyResult };
}
