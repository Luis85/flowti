import { onMounted, onUnmounted, watch, nextTick, type Ref } from 'vue';

export type FocusTrapOptions = {
	readonly onEscape?: () => void;
	readonly initialFocus?: 'first' | 'last';
};

/**
 * Focus trap + return-focus + Escape-key handling for modal dialogs.
 *
 * Behavior:
 * - On isOpen → true: remembers document.activeElement, waits nextTick,
 *   focuses the first or last focusable element inside dialogRef
 *   (default: last, matching the Cancel-button convention).
 * - On isOpen → false: restores focus to the remembered element.
 * - While open: Tab at last → wraps to first; Shift+Tab at first → wraps to last.
 * - Escape: invokes options.onEscape (if provided).
 */
export function useFocusTrap(
	dialogRef: Ref<HTMLElement | null>,
	isOpen: Ref<boolean>,
	options: FocusTrapOptions = {},
): void {
	let returnFocusEl: HTMLElement | null = null;
	const initialFocus = options.initialFocus ?? 'last';

	function getFocusable(): HTMLElement[] {
		if (dialogRef.value === null) return [];
		const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
		return Array.from(dialogRef.value.querySelectorAll<HTMLElement>(selector));
	}

	function onKeyDown(e: KeyboardEvent): void {
		if (!isOpen.value) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			options.onEscape?.();
			return;
		}
		if (e.key !== 'Tab') return;
		const focusable = getFocusable();
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

	watch(isOpen, async (open) => {
		if (open) {
			returnFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			await nextTick();
			const focusable = getFocusable();
			const target = initialFocus === 'first' ? focusable[0] : focusable[focusable.length - 1];
			target?.focus();
		} else {
			returnFocusEl?.focus();
			returnFocusEl = null;
		}
	}, { immediate: true });

	onMounted(() => { document.addEventListener('keydown', onKeyDown); });
	onUnmounted(() => { document.removeEventListener('keydown', onKeyDown); });
}
