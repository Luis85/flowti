import { describe, it, expect, vi } from 'vitest';
import { ref, defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { useFocusTrap } from '../../../src/ui/composables/use-focus-trap.js';

function Fixture(opts: { initialFocus?: 'first' | 'last'; onEscape?: () => void } = {}) {
	return defineComponent({
		setup() {
			const dialogRef = ref<HTMLElement | null>(null);
			const isOpen = ref(true);
			useFocusTrap(dialogRef, isOpen, { initialFocus: opts.initialFocus, onEscape: opts.onEscape });
			return () => h('div', { ref: dialogRef, 'data-testid': 'dialog' }, [
				h('button', { 'data-testid': 'btn-1' }, 'one'),
				h('button', { 'data-testid': 'btn-2' }, 'two'),
				h('button', { 'data-testid': 'btn-3' }, 'three'),
			]);
		},
	});
}

describe('useFocusTrap', () => {
	it('focuses the last element by default when isOpen becomes true', async () => {
		const wrapper = mount(Fixture(), { attachTo: document.body });
		await new Promise((r) => setTimeout(r, 0));
		expect(document.activeElement).toBe(wrapper.get('[data-testid="btn-3"]').element);
		wrapper.unmount();
	});

	it('focuses the first element when initialFocus is "first"', async () => {
		const wrapper = mount(Fixture({ initialFocus: 'first' }), { attachTo: document.body });
		await new Promise((r) => setTimeout(r, 0));
		expect(document.activeElement).toBe(wrapper.get('[data-testid="btn-1"]').element);
		wrapper.unmount();
	});

	it('wraps focus from last → first on Tab', async () => {
		const wrapper = mount(Fixture({ initialFocus: 'last' }), { attachTo: document.body });
		await new Promise((r) => setTimeout(r, 0));
		const last = wrapper.get('[data-testid="btn-3"]').element as HTMLButtonElement;
		last.focus();
		const event = new KeyboardEvent('keydown', { key: 'Tab' });
		document.dispatchEvent(event);
		expect(document.activeElement).toBe(wrapper.get('[data-testid="btn-1"]').element);
		wrapper.unmount();
	});

	it('wraps focus from first → last on Shift+Tab', async () => {
		const wrapper = mount(Fixture({ initialFocus: 'first' }), { attachTo: document.body });
		await new Promise((r) => setTimeout(r, 0));
		const first = wrapper.get('[data-testid="btn-1"]').element as HTMLButtonElement;
		first.focus();
		const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true });
		document.dispatchEvent(event);
		expect(document.activeElement).toBe(wrapper.get('[data-testid="btn-3"]').element);
		wrapper.unmount();
	});

	it('invokes onEscape when Escape is pressed', async () => {
		const onEscape = vi.fn();
		const wrapper = mount(Fixture({ onEscape }), { attachTo: document.body });
		await new Promise((r) => setTimeout(r, 0));
		const event = new KeyboardEvent('keydown', { key: 'Escape' });
		document.dispatchEvent(event);
		expect(onEscape).toHaveBeenCalledOnce();
		wrapper.unmount();
	});

	it('returns focus to the previously-focused element when isOpen → false', async () => {
		const trigger = document.createElement('button');
		trigger.textContent = 'trigger';
		document.body.appendChild(trigger);
		trigger.focus();
		expect(document.activeElement).toBe(trigger);

		const isOpen = ref(true);
		const FixtureWithToggle = defineComponent({
			setup() {
				const dialogRef = ref<HTMLElement | null>(null);
				useFocusTrap(dialogRef, isOpen);
				return () => isOpen.value
					? h('div', { ref: dialogRef }, [
						h('button', { 'data-testid': 'btn-1' }, 'one'),
						h('button', { 'data-testid': 'btn-2' }, 'two'),
					])
					: h('span', 'closed');
			},
		});
		const wrapper = mount(FixtureWithToggle, { attachTo: document.body });
		await new Promise((r) => setTimeout(r, 0));
		isOpen.value = false;
		await new Promise((r) => setTimeout(r, 0));
		expect(document.activeElement).toBe(trigger);
		wrapper.unmount();
		trigger.remove();
	});
});
