import type { Meta, StoryObj } from '@storybook/vue3-vite';
import ConfirmDialog from '../../../src/ui/components/make/ConfirmDialog.vue';

const meta: Meta<typeof ConfirmDialog> = { title: 'Components/Make/ConfirmDialog', component: ConfirmDialog };
export default meta;
type Story = StoryObj<typeof ConfirmDialog>;

export const UnsavedChanges: Story = {
	args: { open: true, title: 'Unsaved changes', body: 'You have unsaved changes to this type. Save, discard, or cancel navigation?', options: ['save', 'discard', 'cancel'] },
};

export const DestructiveConfirm: Story = {
	args: { open: true, title: 'Overwrite', body: 'This will overwrite the hand-edited file.', options: ['cancel', 'confirm'], destructive: true, labels: { confirm: 'Overwrite' } },
};
