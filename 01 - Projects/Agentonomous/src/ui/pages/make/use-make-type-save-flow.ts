import { nextTick, ref } from 'vue';
import type { Router } from 'vue-router';
import type { useMakeStore } from '../../stores/make-store.js';
import type { useMakeTypeDraft } from './use-make-type-draft.js';
import type { MakeError, FieldError, SchemaError } from '../../../domain/make/errors.js';
import type { PluginContext } from '../../../plugin.js';

type Translate = (key: string, values?: Record<string, unknown>) => string;

export interface UseMakeTypeSaveFlow {
	readonly schemaErrors:        ReturnType<typeof ref<{ name?: string; folder?: string }>>;
	readonly renameWarningOpen:   ReturnType<typeof ref<boolean>>;
	readonly renameWarningBody:   ReturnType<typeof ref<string>>;
	readonly overwriteWarningOpen: ReturnType<typeof ref<boolean>>;
	onSave():                        Promise<void>;
	onRenameAcknowledge(choice: string): Promise<void>;
	onRegenerate(force?: boolean):   Promise<void>;
	onOverwriteConfirm(choice: string): Promise<void>;
}

function applySchemaIssues(
	issues: readonly SchemaError[],
	schemaErrors: ReturnType<typeof ref<{ name?: string; folder?: string }>>,
	fieldErrors: ReturnType<typeof ref<Map<string, FieldError[]>>>,
	t: Translate,
): void {
	const schemaUpdates: { name?: string; folder?: string } = {};
	const fieldUpdates = new Map<string, FieldError[]>();
	for (const issue of issues) {
		if (issue.kind === 'invalid-name') schemaUpdates.name = t('make.error.invalidName');
		else if (issue.kind === 'invalid-folder-path') schemaUpdates.folder = t('make.error.invalidFolder');
	}
	schemaErrors.value = schemaUpdates;
	fieldErrors.value = fieldUpdates;
	void nextTick(() => document.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());
}

export function useMakeTypeSaveFlow(
	store: ReturnType<typeof useMakeStore>,
	draftState: ReturnType<typeof useMakeTypeDraft>,
	router: Router,
	t: Translate,
	ctx: PluginContext | undefined,
): UseMakeTypeSaveFlow {
	const { isNewMode, typeId, draft, fieldErrors, applyResult } = draftState;

	const schemaErrors = ref<{ name?: string; folder?: string }>({});
	const renameWarningOpen = ref(false);
	const renameWarningBody = ref('');
	const overwriteWarningOpen = ref(false);

	function surfaceError(error: MakeError): void {
		schemaErrors.value = {};
		if (error.kind === 'duplicate-name') {
			schemaErrors.value = { name: t('make.error.duplicateName', { name: error.name }) };
			void nextTick(() => (document.querySelector<HTMLInputElement>('[data-testid="schema-details-name"]'))?.focus());
			return;
		}
		if (error.kind !== 'invalid-schema') return;
		const renameIssue = error.issues.find((i) => i.kind === 'field-rename-warning');
		if (renameIssue?.kind === 'field-rename-warning') {
			renameWarningBody.value = t('make.type.renameWarning.body', {
				oldName: renameIssue.renames[0]?.oldName ?? '',
				newName: renameIssue.renames[0]?.newName ?? '',
				count: renameIssue.affectedCount,
			});
			renameWarningOpen.value = true;
			return;
		}
		applySchemaIssues(error.issues, schemaErrors, fieldErrors, t);
	}

	async function onSave(): Promise<void> {
		const patch = {
			name: draft.value.name,
			description: draft.value.description,
			instancesFolder: draft.value.instancesFolder,
			titleFieldName: draft.value.titleFieldName,
			fields: draft.value.fields,
		};
		if (isNewMode.value) {
			const result = await store.createType(patch);
			if (result.kind === 'err') { surfaceError(result.error); return; }
			applyResult(result.value);
			ctx?.notifications.success(t('make.notify.typeCreated'));
			await router.replace(`/make/types/${result.value.id}`);
			return;
		}
		const result = await store.updateType(typeId.value!, patch);
		if (result.kind === 'err') { surfaceError(result.error); return; }
		applyResult(result.value.schema);
		ctx?.notifications.success(t('make.notify.typeUpdated'));
	}

	async function onRenameAcknowledge(choice: string): Promise<void> {
		renameWarningOpen.value = false;
		if (choice !== 'confirm') return;
		const result = await store.updateType(typeId.value!, {
			name: draft.value.name,
			description: draft.value.description,
			instancesFolder: draft.value.instancesFolder,
			titleFieldName: draft.value.titleFieldName,
			fields: draft.value.fields,
		}, { acknowledgeRenames: true });
		if (result.kind === 'ok') applyResult(result.value.schema);
	}

	async function onRegenerate(force = false): Promise<void> {
		if (typeId.value === null) return;
		const result = await store.regenerateBaseFile(typeId.value, force ? { force: true } : undefined);
		if (result.kind === 'err' && result.error.kind === 'base-generation-failed' && result.error.cause === 'user-edited') {
			overwriteWarningOpen.value = true;
		}
	}

	async function onOverwriteConfirm(choice: string): Promise<void> {
		overwriteWarningOpen.value = false;
		if (choice === 'confirm') await onRegenerate(true);
	}

	return {
		schemaErrors,
		renameWarningOpen,
		renameWarningBody,
		overwriteWarningOpen,
		onSave,
		onRenameAcknowledge,
		onRegenerate,
		onOverwriteConfirm,
	};
}
