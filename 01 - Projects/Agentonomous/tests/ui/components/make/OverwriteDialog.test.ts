import { describe, it, expect } from 'vitest';
import { mountWithI18n } from '../../../__fixtures__/mount-with-i18n.js';
import OverwriteDialog from '../../../../src/ui/components/make/OverwriteDialog.vue';
import { OverwriteDialogPage } from '../../../../src/ui/components/make/OverwriteDialog.po.js';

function mountDialog(props: { path: string }) {
	const wrapper = mountWithI18n(OverwriteDialog, { props, attachTo: document.body });
	const page = new OverwriteDialogPage(document.body);
	return { wrapper, page };
}

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
});
