import { ref, type Ref } from 'vue';
import type { FieldError } from '../../../domain/make/errors.js';
import type { TypeId } from '../../../domain/make/types.js';
import type { useMakeStore } from '../../stores/make-store.js';

export type OverwritePending = {
	readonly raw:              Record<string, unknown>;
	readonly explicitFilename: string | null;
	readonly path:             string;
};

export interface UseCreateInstanceFlow {
	readonly submitting:      Ref<boolean>;
	readonly serverErrors:    Ref<readonly FieldError[]>;
	readonly overwriteDialog: Ref<OverwritePending | null>;
	submit(payload: { raw: Record<string, unknown>; explicitFilename: string | null }): Promise<void>;
	confirmOverwrite():       Promise<void>;
	cancelOverwrite():        void;
}

export function useCreateInstanceFlow(
	typeId: Ref<TypeId>,
	store: ReturnType<typeof useMakeStore>,
): UseCreateInstanceFlow {
	const submitting = ref(false);
	const serverErrors = ref<readonly FieldError[]>([]);
	const overwriteDialog = ref<OverwritePending | null>(null);

	async function submit(payload: { raw: Record<string, unknown>; explicitFilename: string | null }): Promise<void> {
		submitting.value = true;
		serverErrors.value = [];
		const result = await store.createInstance(typeId.value, payload.raw, payload.explicitFilename);
		submitting.value = false;
		if (result.kind === 'ok') {
			overwriteDialog.value = null;
			return;
		}
		if (result.error.kind === 'invalid-values') {
			serverErrors.value = result.error.issues;
			return;
		}
		if (result.error.kind === 'instance-exists') {
			overwriteDialog.value = {
				raw:              payload.raw,
				explicitFilename: payload.explicitFilename,
				path:             result.error.path,
			};
			return;
		}
		// no-title-field / vault-error / type-not-found and other variants are
		// silently dropped at this layer — Slice H does not surface them. Future
		// slices may wire these to ctx.notifications.
	}

	async function confirmOverwrite(): Promise<void> {
		if (overwriteDialog.value === null) return;
		const pending = overwriteDialog.value;
		submitting.value = true;
		const result = await store.createInstance(typeId.value, pending.raw, pending.explicitFilename, { overwrite: true });
		submitting.value = false;
		overwriteDialog.value = null;
		if (result.kind === 'err' && result.error.kind === 'invalid-values') {
			serverErrors.value = result.error.issues;
		}
	}

	function cancelOverwrite(): void {
		overwriteDialog.value = null;
	}

	return { submitting, serverErrors, overwriteDialog, submit, confirmOverwrite, cancelOverwrite };
}
