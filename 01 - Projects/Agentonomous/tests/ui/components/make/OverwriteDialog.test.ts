import { describe, it, expect, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import { mountWithI18n } from '../../../__fixtures__/mount-with-i18n.js';
import OverwriteDialog from '../../../../src/ui/components/make/OverwriteDialog.vue';
import { OverwriteDialogPage } from '../../../../src/ui/components/make/OverwriteDialog.po.js';

function mountDialog(props: { path: string }) {
	const wrapper = mountWithI18n(OverwriteDialog, { props, attachTo: document.body });
	const page = new OverwriteDialogPage(document.body);
	return { wrapper, page };
}

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('OverwriteDialog', () => {
	it('renders dialog with title and body containing the path', () => {
		const { page, wrapper } = mountDialog({ path: 'Books/Dune.md' });
		expect(page.dialog).not.toBeNull();
		expect(page.title?.textContent).toBeTruthy();
		expect(page.body?.textContent).toContain('Books/Dune.md');
		wrapper.unmount();
	});

	it('emits "overwrite" when Overwrite button clicked', async () => {
		const { page, wrapper } = mountDialog({ path: 'Books/Dune.md' });
		page.overwriteButton?.click();
		expect(wrapper.emitted('overwrite')).toHaveLength(1);
		wrapper.unmount();
	});

	it('emits "rename" when Rename button clicked', async () => {
		const { page, wrapper } = mountDialog({ path: 'Books/Dune.md' });
		page.renameButton?.click();
		expect(wrapper.emitted('rename')).toHaveLength(1);
		wrapper.unmount();
	});

	it('emits "cancel" when Cancel button clicked', async () => {
		const { page, wrapper } = mountDialog({ path: 'Books/Dune.md' });
		page.cancelButton?.click();
		expect(wrapper.emitted('cancel')).toHaveLength(1);
		wrapper.unmount();
	});

	it('moves focus to the overwrite button on mount', async () => {
		const { wrapper, page } = mountDialog({ path: 'Books/Dune.md' });
		await nextTick();
		await nextTick();
		expect(document.activeElement).toBe(page.overwriteButton);
		wrapper.unmount();
	});

	it('emits cancel on Escape keydown', async () => {
		const { wrapper } = mountDialog({ path: 'Books/Dune.md' });
		await nextTick();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(wrapper.emitted('cancel')).toHaveLength(1);
		wrapper.unmount();
	});

	it('removes the keydown listener on unmount (no leaks across dialog opens)', async () => {
		const { wrapper } = mountDialog({ path: 'Books/Dune.md' });
		await nextTick();
		wrapper.unmount();
		// Re-mount a fresh instance and verify only the new instance receives Escape
		const second = mountDialog({ path: 'Books/Other.md' });
		await nextTick();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(wrapper.emitted('cancel')).toBeUndefined();
		expect(second.wrapper.emitted('cancel')).toHaveLength(1);
		second.wrapper.unmount();
	});
});
