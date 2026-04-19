import { nextTick, ref } from 'vue';
import type { Router } from 'vue-router';
import type { useMakeStore } from '../../stores/make-store.js';
import type { useMakeTypeDraft } from './use-make-type-draft.js';
import type { MakeError, FieldError, SchemaError } from '../../../domain/make/errors.js';
import type { MoveReport, TypeSchemaPatch } from '../../../domain/make/types.js';
import type { PluginContext } from '../../../plugin.js';

type Translate = (key: string, values?: Record<string, unknown>) => string;

export interface UseMakeTypeSaveFlow {
	readonly schemaErrors:              ReturnType<typeof ref<{ name?: string; folder?: string }>>;
	readonly renameWarningOpen:         ReturnType<typeof ref<boolean>>;
	readonly renameWarningBody:         ReturnType<typeof ref<string>>;
	readonly overwriteWarningOpen:      ReturnType<typeof ref<boolean>>;
	readonly moveInstancesDialogOpen:   ReturnType<typeof ref<boolean>>;
	readonly moveInstancesDialogTitle:  ReturnType<typeof ref<string>>;
	readonly moveInstancesDialogBody:   ReturnType<typeof ref<string>>;
	readonly moveInstancesDialogBusy:   ReturnType<typeof ref<boolean>>;
	onSave():                           Promise<void>;
	onRenameAcknowledge(choice: string): Promise<void>;
	onRegenerate(force?: boolean):      Promise<void>;
	onOverwriteConfirm(choice: string): Promise<void>;
	onMoveInstancesConfirm(choice: string): Promise<void>;
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
	const moveInstancesDialogOpen = ref(false);
	const moveInstancesDialogTitle = ref('');
	const moveInstancesDialogBody = ref('');
	const moveInstancesDialogBusy = ref(false);

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

	function draftPatch(): Required<TypeSchemaPatch> {
		return {
			name: draft.value.name,
			description: draft.value.description,
			instancesFolder: draft.value.instancesFolder,
			titleFieldName: draft.value.titleFieldName,
			fields: draft.value.fields,
		};
	}

	function notifyMoveOutcome(moveReport: MoveReport | undefined): void {
		if (moveReport === undefined || moveReport.movedCount === 0) return;
		ctx?.notifications.info(t('make.move-report.info-toast', {
			movedCount: moveReport.movedCount, newFolder: moveReport.newFolder,
		}));
	}

	function surfacePartialMoveWarning(moveReport: MoveReport): void {
		const total = moveReport.movedCount + moveReport.failedMoves.length;
		const failed = moveReport.failedMoves.length;
		const firstNames = moveReport.failedMoves.slice(0, 3).map((m) => m.path).join(', ');
		const hasMore = failed > 3 ? `, +${failed - 3} more` : '';
		ctx?.notifications.warn(t('make.move-report.partial.body', {
			moved: moveReport.movedCount, total, newFolder: moveReport.newFolder,
			failed, oldFolder: moveReport.oldFolder, firstNames, hasMore,
		}));
	}

	async function attemptUpdate(options?: { moveInstances?: true }): Promise<void> {
		const result = await store.updateType(typeId.value!, draftPatch(), options);
		if (result.kind === 'err') {
			if (result.error.kind === 'instances-move-required') {
				moveInstancesDialogTitle.value = t('make.move-instances-dialog.title', { count: result.error.count });
				moveInstancesDialogBody.value = t('make.move-instances-dialog.body', {
					count: result.error.count, oldFolder: result.error.oldFolder, newFolder: result.error.newFolder,
				});
				moveInstancesDialogOpen.value = true;
				return;
			}
			surfaceError(result.error);
			return;
		}
		applyResult(result.value.schema);
		const moveReport = result.value.moveReport;
		if (moveReport !== undefined && moveReport.failedMoves.length > 0) {
			surfacePartialMoveWarning(moveReport);
			return;
		}
		ctx?.notifications.success(t('make.notify.typeUpdated'));
		notifyMoveOutcome(moveReport);
	}

	async function onSave(): Promise<void> {
		if (isNewMode.value) {
			const result = await store.createType(draftPatch());
			if (result.kind === 'err') { surfaceError(result.error); return; }
			applyResult(result.value);
			ctx?.notifications.success(t('make.notify.typeCreated'));
			await router.replace(`/make/types/${result.value.id}`);
			return;
		}
		await attemptUpdate();
	}

	async function onMoveInstancesConfirm(choice: string): Promise<void> {
		if (choice !== 'confirm') {
			moveInstancesDialogOpen.value = false;
			return;
		}
		moveInstancesDialogBusy.value = true;
		await attemptUpdate({ moveInstances: true });
		moveInstancesDialogBusy.value = false;
		moveInstancesDialogOpen.value = false;
	}

	async function onRenameAcknowledge(choice: string): Promise<void> {
		renameWarningOpen.value = false;
		if (choice !== 'confirm') return;
		const result = await store.updateType(typeId.value!, draftPatch(), { acknowledgeRenames: true });
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
		moveInstancesDialogOpen,
		moveInstancesDialogTitle,
		moveInstancesDialogBody,
		moveInstancesDialogBusy,
		onSave,
		onRenameAcknowledge,
		onRegenerate,
		onOverwriteConfirm,
		onMoveInstancesConfirm,
	};
}
