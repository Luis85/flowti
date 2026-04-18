import type { Meta, StoryObj, Decorator } from '@storybook/vue3-vite';
import { expect, within, userEvent, fn } from 'storybook/test';
import FileDetailPanel from '../../src/ui/panels/FileDetailPanel.vue';
import { useFileDetailStore } from '../../src/ui/stores/file-detail-store.js';
import { jsonAnalysis, csvAnalysis, largeFileAnalysis } from '../__fixtures__/file-analysis.js';

function withAnalysis(analysis: typeof jsonAnalysis | null, error: string | null = null): Decorator {
	return () => ({
		setup() {
			const store = useFileDetailStore();
			store.clear();
			if (error !== null) {
				store.setError(error);
			} else if (analysis !== null) {
				store.setAnalysis(analysis);
			}
			return {};
		},
		template: '<story />',
	});
}

const meta: Meta<typeof FileDetailPanel> = {
	title: 'Panels/FileDetailPanel',
	component: FileDetailPanel,
};
export default meta;

type Story = StoryObj<typeof FileDetailPanel>;

export const Empty: Story = {
	decorators: [withAnalysis(null)],
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('shows empty state message', async () => {
			await expect(canvas.getByTestId('file-empty')).toHaveTextContent('No file selected.');
		});
	},
};

export const WithError: Story = {
	decorators: [withAnalysis(null, 'Failed to read file: permission denied')],
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('shows error message', async () => {
			await expect(canvas.getByTestId('file-error')).toHaveTextContent(/permission denied/);
		});
	},
};

export const JsonFile: Story = {
	decorators: [withAnalysis(jsonAnalysis)],
	args: { onOpenInEditor: fn() },
	play: async ({ canvasElement, step, args }) => {
		const canvas = within(canvasElement);

		await step('displays file name and size', async () => {
			await expect(canvas.getByTestId('file-name')).toHaveTextContent('agents.json');
			await expect(canvas.getByTestId('file-size')).toHaveTextContent('4096 bytes');
		});

		await step('renders summary table', async () => {
			const table = canvas.getByTestId('file-summary');
			await expect(within(table).getByText('Keys')).toBeVisible();
			await expect(within(table).getByText('12')).toBeVisible();
		});

		await step('click Open in editor calls callback', async () => {
			await userEvent.click(canvas.getByTestId('open-in-editor'));
			await expect(args.onOpenInEditor).toHaveBeenCalledOnce();
		});
	},
};

export const CsvFile: Story = {
	decorators: [withAnalysis(csvAnalysis)],
	args: { onOpenInEditor: fn() },
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('displays CSV file details', async () => {
			await expect(canvas.getByTestId('file-name')).toHaveTextContent('activity-log.csv');
			await expect(canvas.getByTestId('file-size')).toHaveTextContent('28672 bytes');
		});

		await step('shows row and column count', async () => {
			const table = canvas.getByTestId('file-summary');
			await expect(within(table).getByText('Rows')).toBeVisible();
			await expect(within(table).getByText('342')).toBeVisible();
		});
	},
};

export const LargeFile: Story = {
	decorators: [withAnalysis(largeFileAnalysis)],
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('displays large file with rich summary', async () => {
			await expect(canvas.getByTestId('file-name')).toHaveTextContent('world-state.json');
			await expect(canvas.getByTestId('file-size')).toHaveTextContent('1048576 bytes');
		});

		await step('hides editor button when callback not provided', async () => {
			await expect(canvas.queryByTestId('open-in-editor')).toBeNull();
		});
	},
};
