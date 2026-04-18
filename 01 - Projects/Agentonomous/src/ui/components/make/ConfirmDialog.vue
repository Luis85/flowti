<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';

type Choice = 'save' | 'discard' | 'cancel' | 'confirm' | 'reject';

const props = withDefaults(defineProps<{
	open: boolean;
	title: string;
	body: string;
	options: readonly Choice[];
	destructive?: boolean;
	labels?: Partial<Record<Choice, string>>;
}>(), { destructive: false });

const emit = defineEmits<{ resolve: [choice: Choice] }>();
const { t } = useI18n();
const dialogRef = ref<HTMLElement | null>(null);
let returnFocusEl: HTMLElement | null = null;

function resolve(choice: Choice): void { emit('resolve', choice); }

function defaultLabel(choice: Choice): string {
	return t(`make.confirmDialog.default.${choice}`); // generic fallback keys; see i18n
}
function buttonLabel(choice: Choice): string {
	return props.labels?.[choice] ?? defaultLabel(choice);
}

function isConfirmButton(choice: Choice): boolean {
	return choice === 'confirm' || choice === 'save';
}

function onKeyDown(e: KeyboardEvent): void {
	if (!props.open) return;
	if (e.key === 'Escape') {
		e.preventDefault();
		resolve(props.options.includes('cancel') ? 'cancel' : props.options[0]!);
		return;
	}
	if (e.key === 'Tab' && dialogRef.value) {
		const focusable = Array.from(dialogRef.value.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
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

watch(() => props.open, async (isOpen) => {
	if (isOpen) {
		returnFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		await nextTick();
		// Focus the LAST focusable element (Cancel convention).
		const focusable = dialogRef.value?.querySelectorAll<HTMLElement>('button');
		const last = focusable?.[focusable.length - 1];
		last?.focus();
	} else {
		returnFocusEl?.focus();
		returnFocusEl = null;
	}
}, { immediate: true });

onMounted(() => { document.addEventListener('keydown', onKeyDown); });
onUnmounted(() => { document.removeEventListener('keydown', onKeyDown); });
</script>

<template>
	<Teleport to="body">
		<div
			v-if="open"
			data-testid="confirm-dialog-backdrop"
			class="confirm-dialog__backdrop"
			@click="resolve(options.includes('cancel') ? 'cancel' : options[0]!)"
		/>
		<div
			v-if="open"
			ref="dialogRef"
			data-testid="confirm-dialog"
			role="alertdialog"
			aria-modal="true"
			aria-labelledby="confirm-dialog-title"
			aria-describedby="confirm-dialog-body"
			class="confirm-dialog"
		>
			<h2 id="confirm-dialog-title" data-testid="confirm-dialog-title">{{ title }}</h2>
			<p id="confirm-dialog-body" data-testid="confirm-dialog-body">{{ body }}</p>
			<footer class="confirm-dialog__actions">
				<button
					v-for="choice in options"
					:key="choice"
					type="button"
					:data-testid="`confirm-dialog-${choice}`"
					:class="{ destructive: destructive && isConfirmButton(choice) }"
					@click.stop="resolve(choice)"
				>
					{{ buttonLabel(choice) }}
				</button>
			</footer>
		</div>
	</Teleport>
</template>

<style scoped>
.confirm-dialog__backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); z-index: 1000; }
.confirm-dialog { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--background-primary); color: var(--text-normal); padding: 1.5rem; border-radius: 6px; max-width: 480px; z-index: 1001; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3); }
.confirm-dialog h2 { margin: 0 0 0.5rem 0; }
.confirm-dialog__actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
.confirm-dialog__actions button.destructive { background: var(--text-error); color: var(--text-on-accent); }
</style>
