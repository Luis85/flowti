import { describe, it, expect, afterEach } from 'vitest';
import { nextTick } from 'vue';
import ConfirmDialog from '../../../../src/ui/components/make/ConfirmDialog.vue';
import { ConfirmDialogPage } from '../../../../src/ui/components/make/ConfirmDialog.po.js';
import { mountWithI18n } from '../../../__fixtures__/mount-with-i18n.js';

function mountDialog(props: Record<string, unknown> = {}) {
	const wrapper = mountWithI18n(ConfirmDialog, {
		props: {
			open: true,
			title: 'Test Title',
			body: 'Test body text',
			options: ['cancel', 'confirm'],
			...props,
		},
		attachTo: document.body,
	});
	const page = new ConfirmDialogPage(document.body);
	return { wrapper, page };
}

describe('ConfirmDialog', () => {
	afterEach(() => {
		// Clean up any teleported elements
		document.body.innerHTML = '';
	});

	it('renders title and body from props', async () => {
		const { page } = mountDialog({ title: 'My Title', body: 'My body' });
		await nextTick();
		expect(page.title).toBe('My Title');
		expect(page.body).toBe('My body');
	});

	it('renders a button per entry in options', async () => {
		const { page } = mountDialog({ options: ['cancel', 'confirm'] });
		await nextTick();
		expect(page.button('cancel')).not.toBeNull();
		expect(page.button('confirm')).not.toBeNull();
	});

	it('adds destructive class on confirm button when destructive=true', async () => {
		const { page } = mountDialog({ options: ['cancel', 'confirm'], destructive: true });
		await nextTick();
		expect(page.button('confirm')?.classList.contains('destructive')).toBe(true);
		expect(page.button('cancel')?.classList.contains('destructive')).toBe(false);
	});

	it('does not add destructive class when destructive=false', async () => {
		const { page } = mountDialog({ options: ['cancel', 'confirm'], destructive: false });
		await nextTick();
		expect(page.button('confirm')?.classList.contains('destructive')).toBe(false);
	});

	it('clicking a button emits resolve with that choice', async () => {
		const { wrapper, page } = mountDialog({ options: ['cancel', 'confirm'] });
		await nextTick();
		page.button('confirm')?.click();
		await nextTick();
		const emitted = wrapper.emitted('resolve');
		expect(emitted).toBeTruthy();
		expect(emitted![0]).toEqual(['confirm']);
	});

	it('clicking cancel button emits resolve with cancel', async () => {
		const { wrapper, page } = mountDialog({ options: ['cancel', 'confirm'] });
		await nextTick();
		page.button('cancel')?.click();
		await nextTick();
		const emitted = wrapper.emitted('resolve');
		expect(emitted).toBeTruthy();
		expect(emitted![0]).toEqual(['cancel']);
	});

	it('pressing Escape emits resolve with cancel when cancel is in options', async () => {
		const { wrapper } = mountDialog({ options: ['cancel', 'confirm'] });
		await nextTick();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await nextTick();
		const emitted = wrapper.emitted('resolve');
		expect(emitted).toBeTruthy();
		expect(emitted![0]).toEqual(['cancel']);
	});

	it('pressing Escape resolves with first option when no cancel in options', async () => {
		const { wrapper } = mountDialog({ options: ['save', 'discard'] });
		await nextTick();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await nextTick();
		const emitted = wrapper.emitted('resolve');
		expect(emitted).toBeTruthy();
		expect(emitted![0]).toEqual(['save']);
	});

	it('backdrop click emits resolve with cancel', async () => {
		const { wrapper, page } = mountDialog({ options: ['cancel', 'confirm'] });
		await nextTick();
		page.backdrop?.click();
		await nextTick();
		const emitted = wrapper.emitted('resolve');
		expect(emitted).toBeTruthy();
		expect(emitted![0]).toEqual(['cancel']);
	});

	it('does not render dialog when open=false', async () => {
		const { page } = mountDialog({ open: false });
		await nextTick();
		expect(page.dialog).toBeNull();
	});

	it('does not render backdrop when open=false', async () => {
		const { page } = mountDialog({ open: false });
		await nextTick();
		expect(page.backdrop).toBeNull();
	});

	it('on mount focus lands on the last button', async () => {
		mountDialog({ options: ['cancel', 'confirm'] });
		await nextTick();
		await nextTick();
		const lastBtn = document.querySelector<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]');
		expect(document.activeElement).toBe(lastBtn);
	});

	it('Tab past the last button cycles to the first', async () => {
		mountDialog({ options: ['cancel', 'confirm'] });
		await nextTick();
		await nextTick();
		const firstBtn = document.querySelector<HTMLButtonElement>('[data-testid="confirm-dialog-cancel"]');
		const lastBtn = document.querySelector<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]');
		// Focus is on last button; Tab should cycle to first
		lastBtn?.focus();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
		await nextTick();
		expect(document.activeElement).toBe(firstBtn);
	});

	it('Shift+Tab on the first button cycles to the last', async () => {
		mountDialog({ options: ['cancel', 'confirm'] });
		await nextTick();
		await nextTick();
		const firstBtn = document.querySelector<HTMLButtonElement>('[data-testid="confirm-dialog-cancel"]');
		const lastBtn = document.querySelector<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]');
		firstBtn?.focus();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
		await nextTick();
		expect(document.activeElement).toBe(lastBtn);
	});

	it('has role=alertdialog', async () => {
		const { page } = mountDialog();
		await nextTick();
		expect(page.dialog?.getAttribute('role')).toBe('alertdialog');
	});

	it('has aria-modal=true', async () => {
		const { page } = mountDialog();
		await nextTick();
		expect(page.dialog?.getAttribute('aria-modal')).toBe('true');
	});

	it('has aria-labelledby set', async () => {
		const { page } = mountDialog();
		await nextTick();
		expect(page.dialog?.getAttribute('aria-labelledby')).toBeTruthy();
	});

	it('has aria-describedby set', async () => {
		const { page } = mountDialog();
		await nextTick();
		expect(page.dialog?.getAttribute('aria-describedby')).toBeTruthy();
	});
});
