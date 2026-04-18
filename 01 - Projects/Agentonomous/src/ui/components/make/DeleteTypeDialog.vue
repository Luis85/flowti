<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TypeSchema } from '../../../domain/make/type-schema.js';

const props = defineProps<{
	open: boolean;
	type: TypeSchema;
	instanceCount: number | null;
	isDeleting: boolean;
	typesFolder: string;
}>();

const emit = defineEmits<{
	confirm: [payload: { alsoDeleteBaseFile: boolean }];
	cancel:  [];
}>();

const { t } = useI18n();
const alsoDeleteBaseFile = ref(false);
const dialogRef = ref<HTMLElement | null>(null);
let returnFocusEl: HTMLElement | null = null;

// Reset checkbox when dialog re-opens.
watch(() => props.open, async (isOpen) => {
	if (isOpen) {
		alsoDeleteBaseFile.value = false;
		returnFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		// nextTick to allow teleported DOM to appear, then focus the cancel button
		await Promise.resolve();
		const focusable = dialogRef.value?.querySelectorAll<HTMLButtonElement>('button');
		focusable?.[0]?.focus();
	} else {
		returnFocusEl?.focus();
		returnFocusEl = null;
	}
});

const instanceLine = computed(() => {
	if (props.instanceCount === null) return t('make.delete.checkingInstances');
	if (props.instanceCount === 0) return t('make.delete.noInstances');
	if (props.instanceCount === 1) return t('make.delete.hasInstancesOne', { folder: props.type.instancesFolder });
	return t('make.delete.hasInstancesOther', { count: props.instanceCount, folder: props.type.instancesFolder });
});

const typeFilePath = computed(() => `${props.typesFolder.replace(/\/$/, '')}/${props.type.id}.json`);

function onKeyDown(e: KeyboardEvent): void {
	if (!props.open) return;
	if (e.key === 'Escape') {
		e.preventDefault();
		emit('cancel');
		return;
	}
	if (e.key === 'Tab' && dialogRef.value) {
		const focusable = Array.from(
			dialogRef.value.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])'),
		);
		if (focusable.length === 0) return;
		const first = focusable[0]!;
		const last = focusable[focusable.length - 1]!;
		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	}
}

onMounted(() => { document.addEventListener('keydown', onKeyDown); });
onUnmounted(() => { document.removeEventListener('keydown', onKeyDown); });
</script>

<template>
	<Teleport to="body">
		<div
			v-if="open"
			data-testid="delete-type-dialog-backdrop"
			class="backdrop"
			@click="emit('cancel')"
		/>
		<div
			v-if="open"
			ref="dialogRef"
			data-testid="delete-type-dialog"
			role="alertdialog"
			aria-modal="true"
			aria-labelledby="delete-type-dialog-title"
			aria-describedby="delete-type-dialog-body"
			class="dialog"
		>
			<h2 id="delete-type-dialog-title" data-testid="delete-type-dialog-title">
				{{ t('make.delete.title', { name: type.name }) }}
			</h2>
			<div id="delete-type-dialog-body" data-testid="delete-type-dialog-body">
				<p data-testid="delete-type-file-path">
					{{ t('make.delete.typeFile', { path: typeFilePath }) }}
				</p>
				<p
					data-testid="delete-type-instance-line"
					:aria-live="instanceCount === null ? 'polite' : undefined"
				>
					{{ instanceLine }}
				</p>
				<label data-testid="delete-type-base-checkbox-label">
					<input
						v-model="alsoDeleteBaseFile"
						type="checkbox"
						data-testid="delete-type-base-checkbox"
						:disabled="type.baseFile === undefined"
					/>
					{{ t('make.delete.alsoDeleteBase') }}
					<code v-if="type.baseFile" data-testid="delete-type-base-file-path">{{ type.baseFile.path }}</code>
				</label>
				<p class="trash-note">{{ t('make.delete.trashNote') }}</p>
			</div>
			<footer class="dialog__actions">
				<button
					type="button"
					data-testid="delete-type-cancel"
					:disabled="isDeleting"
					@click="emit('cancel')"
				>
					{{ t('make.delete.cancel') }}
				</button>
				<button
					type="button"
					data-testid="delete-type-confirm"
					class="destructive"
					:disabled="isDeleting"
					:aria-busy="isDeleting ? 'true' : 'false'"
					@click="emit('confirm', { alsoDeleteBaseFile })"
				>
					{{ isDeleting ? t('make.delete.deleting') : t('make.delete.confirm') }}
				</button>
			</footer>
		</div>
	</Teleport>
</template>

<style scoped>
.backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); z-index: 1000; }
.dialog { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--background-primary); color: var(--text-normal); padding: 1.5rem; border-radius: 6px; max-width: 520px; z-index: 1001; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3); }
.dialog h2 { margin: 0 0 0.75rem 0; }
.dialog__actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
.dialog__actions button.destructive { background: var(--text-error); color: var(--text-on-accent); }
.trash-note { color: var(--text-muted); font-size: 0.8125rem; }
</style>
