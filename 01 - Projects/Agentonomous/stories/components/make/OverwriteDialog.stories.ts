import type { Meta, StoryObj } from '@storybook/vue3-vite';
import OverwriteDialog from '../../../src/ui/components/make/OverwriteDialog.vue';

const meta: Meta<typeof OverwriteDialog> = {
	title: 'Components/Make/OverwriteDialog',
	component: OverwriteDialog,
};
export default meta;
type Story = StoryObj<typeof OverwriteDialog>;

export const Default: Story = {
	args: { path: 'Books/Dune.md' },
};
