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

export const MoveInstances: Story = {
	args: {
		open: true,
		title: 'Move 12 instances?',
		body: 'Changing the instance folder from Books to Reading/2026 will move all 12 existing instance files. Obsidian backlinks will update automatically.',
		options: ['cancel', 'confirm'],
		destructive: true,
		labels: { confirm: 'Move files and save', cancel: 'Cancel' },
	},
};

export const MoveInstancesBusy: Story = {
	args: {
		open: true,
		title: 'Move 12 instances?',
		body: 'Changing the instance folder from Books to Reading/2026 will move all 12 existing instance files. Obsidian backlinks will update automatically.',
		options: ['cancel', 'confirm'],
		destructive: true,
		busy: true,
		labels: { confirm: 'Move files and save', cancel: 'Cancel' },
	},
};

export const CascadeDelete: Story = {
	args: {
		open: true,
		title: "Delete type 'Book' and its instances?",
		body: 'This will delete the Book type, its 24 instance notes, and the generated base file. Files go to Obsidian trash and can be restored.',
		options: ['cancel', 'confirm'],
		destructive: true,
		labels: { confirm: 'Delete everything', cancel: 'Keep everything' },
	},
};

export const MoveReportPartial: Story = {
	args: {
		open: true,
		title: "Type saved — some files couldn't move",
		body: '8 of 10 files moved to Reading/2026. 2 files remain at Books: Books/Dune.md, Books/Neuromancer.md',
		options: ['cancel', 'confirm'],
		labels: { confirm: 'Retry failed files', cancel: 'Dismiss' },
	},
};

export const MoveReportPartialBusy: Story = {
	args: {
		open: true,
		title: "Type saved — some files couldn't move",
		body: '8 of 10 files moved to Reading/2026. 2 files remain at Books: Books/Dune.md, Books/Neuromancer.md',
		options: ['cancel', 'confirm'],
		busy: true,
		labels: { confirm: 'Retry failed files', cancel: 'Dismiss' },
	},
};

export const MoveReportManyFailures: Story = {
	args: {
		open: true,
		title: "Type saved — some files couldn't move",
		body: '2 of 42 files moved to Reading/2026. 40 files remain at Books: Books/Dune.md, Books/Neuromancer.md, Books/Foundation.md, +37 more',
		options: ['cancel', 'confirm'],
		labels: { confirm: 'Retry failed files', cancel: 'Dismiss' },
	},
};

export const BulkDeleteConfirm: Story = {
	args: {
		open: true,
		title: 'Delete 3 selected instances?',
		body: 'Files go to Obsidian trash and can be restored.',
		options: ['cancel', 'confirm'],
		destructive: true,
		labels: { confirm: 'Delete 3 files', cancel: 'Cancel' },
	},
};

export const BulkDeleteConfirmBusy: Story = {
	args: {
		open: true,
		title: 'Delete 3 selected instances?',
		body: 'Files go to Obsidian trash and can be restored.',
		options: ['cancel', 'confirm'],
		destructive: true,
		busy: true,
		labels: { confirm: 'Delete 3 files', cancel: 'Cancel' },
	},
};

export const BulkDeletePartial: Story = {
	args: {
		open: true,
		title: "Some files couldn't be deleted",
		body: '7 of 10 deleted. 3 remain: Books/Dune.md, Books/Neuromancer.md, Books/Foundation.md',
		options: ['cancel', 'confirm'],
		labels: { confirm: 'Retry failed files', cancel: 'Dismiss' },
	},
};

export const BulkDeletePartialTruncated: Story = {
	args: {
		open: true,
		title: "Some files couldn't be deleted",
		body: '2 of 10 deleted. 8 remain: Books/Dune.md, Books/Neuromancer.md, Books/Foundation.md, +5 more',
		options: ['cancel', 'confirm'],
		labels: { confirm: 'Retry failed files', cancel: 'Dismiss' },
	},
};
