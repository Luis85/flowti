<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{ path: string }>();

const emit = defineEmits<{
	overwrite: [];
	rename:    [];
	cancel:    [];
}>();

const { t } = useI18n();

function onOverwrite(): void { emit('overwrite'); }
function onRename():    void { emit('rename'); }
function onCancel():    void { emit('cancel'); }
</script>

<template>
	<Teleport to="body">
		<div
			data-testid="overwrite-dialog-backdrop"
			class="overwrite-dialog__backdrop"
			@click="onCancel"
		/>
		<div
			data-testid="overwrite-dialog"
			role="dialog"
			aria-modal="true"
			aria-labelledby="overwrite-dialog-title"
			aria-describedby="overwrite-dialog-body"
			class="overwrite-dialog"
		>
			<h2 id="overwrite-dialog-title" data-testid="overwrite-dialog-title">
				{{ t('make.overwrite-dialog.title') }}
			</h2>
			<p id="overwrite-dialog-body" data-testid="overwrite-dialog-body">
				{{ t('make.overwrite-dialog.body', { path }) }}
			</p>
			<footer class="overwrite-dialog__actions">
				<button
					type="button"
					data-testid="overwrite-dialog-cancel"
					@click.stop="onCancel"
				>
					{{ t('make.overwrite-dialog.cancel') }}
				</button>
				<button
					type="button"
					data-testid="overwrite-dialog-rename"
					@click.stop="onRename"
				>
					{{ t('make.overwrite-dialog.rename') }}
				</button>
				<button
					type="button"
					data-testid="overwrite-dialog-overwrite"
					class="destructive"
					@click.stop="onOverwrite"
				>
					{{ t('make.overwrite-dialog.overwrite') }}
				</button>
			</footer>
		</div>
	</Teleport>
</template>

<style scoped>
.overwrite-dialog__backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); z-index: 1000; }
.overwrite-dialog { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--background-primary); color: var(--text-normal); padding: 1.5rem; border-radius: 6px; max-width: 480px; z-index: 1001; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3); }
.overwrite-dialog h2 { margin: 0 0 0.5rem 0; }
.overwrite-dialog__actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
.overwrite-dialog__actions button.destructive { background: var(--text-error); color: var(--text-on-accent); }
</style>
