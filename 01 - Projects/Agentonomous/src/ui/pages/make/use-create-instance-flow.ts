import { ref, type Ref } from 'vue';
import type { FieldError, MakeError } from '../../../domain/make/errors.js';
import type { TypeId } from '../../../domain/make/types.js';
import type { useMakeStore } from '../../stores/make-store.js';
import type { NotificationPort } from '../../../domain/shared/notification-port.js';

type Translate = (key: string, values?: Record<string, unknown>) => string;

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

/**
 * Translation key (and optional value-builder) for each MakeError variant the
 * composable wants to surface as a notification. Variants handled inline
 * (`invalid-values` → serverErrors, `instance-exists` → dialog) are absent so
 * `unhandledErrorMessage` returns `null` for them.
 */
const ERROR_MESSAGE_MAP: {
	readonly [K in MakeError['kind']]?: {
		readonly key:    string;
		readonly values?: (error: Extract<MakeError, { kind: K }>) => Record<string, unknown>;
	};
} = {
	'vault-error':              { key: 'make.error.vault' },
	'no-title-field':           { key: 'make.error.noTitleField' },
	'type-not-found':           { key: 'make.notify.typeNotFound' },
	'not-implemented':          { key: 'make.error.notImplemented' },
	'invalid-schema':           { key: 'make.error.invalidSchema' },
	'duplicate-name':           { key: 'make.error.duplicateName', values: (e) => ({ name: e.name }) },
	'base-generation-failed':   { key: 'make.notify.baseFailed' },
	'instances-move-required':  { key: 'make.error.vault' },
	'partial-move':             { key: 'make.error.vault' },
};

function unhandledErrorMessage(error: MakeError, t: Translate): string | null {
	const entry = ERROR_MESSAGE_MAP[error.kind];
	if (entry === undefined) return null;
	const values = entry.values?.(error as never);
	return values === undefined ? t(entry.key) : t(entry.key, values);
}

export function useCreateInstanceFlow(
	typeId: Ref<TypeId>,
	store: ReturnType<typeof useMakeStore>,
	notifications?: NotificationPort,
	t?: Translate,
): UseCreateInstanceFlow {
	const submitting = ref(false);
	const serverErrors = ref<readonly FieldError[]>([]);
	const overwriteDialog = ref<OverwritePending | null>(null);

	function notifyUnhandled(error: MakeError): void {
		if (notifications === undefined || t === undefined) return;
		const message = unhandledErrorMessage(error, t);
		if (message === null) return;
		notifications.error(message);
	}

	async function submit(payload: { raw: Record<string, unknown>; explicitFilename: string | null }): Promise<void> {
		if (submitting.value) return;
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
		notifyUnhandled(result.error);
	}

	async function confirmOverwrite(): Promise<void> {
		if (submitting.value) return;
		if (overwriteDialog.value === null) return;
		const pending = overwriteDialog.value;
		submitting.value = true;
		const result = await store.createInstance(typeId.value, pending.raw, pending.explicitFilename, { overwrite: true });
		submitting.value = false;
		overwriteDialog.value = null;
		if (result.kind === 'ok') return;
		if (result.error.kind === 'invalid-values') {
			serverErrors.value = result.error.issues;
			return;
		}
		notifyUnhandled(result.error);
	}

	function cancelOverwrite(): void {
		overwriteDialog.value = null;
	}

	return { submitting, serverErrors, overwriteDialog, submit, confirmOverwrite, cancelOverwrite };
}
