import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, within } from 'storybook/test';
import DashboardLayout from '../../src/ui/layouts/DashboardLayout.vue';

const meta: Meta<typeof DashboardLayout> = {
	title: 'Layouts/DashboardLayout',
	component: DashboardLayout,
};
export default meta;

type Story = StoryObj<typeof DashboardLayout>;

export const Default: Story = {
	render: () => ({
		components: { DashboardLayout },
		template: `
			<DashboardLayout>
				<div data-testid="slot-content">Main Content Area</div>
			</DashboardLayout>
		`,
	}),
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);

		await step('renders header with title and version', async () => {
			const header = canvas.getByTestId('dashboard-header');
			await expect(header).toBeVisible();
			await expect(header).toHaveTextContent('Agentonomous');
			await expect(canvas.getByTestId('dashboard-version')).toBeVisible();
		});

		await step('renders sidebar navigation', async () => {
			const sidebar = canvas.getByTestId('dashboard-sidebar');
			await expect(sidebar).toBeVisible();
			await expect(canvas.getByTestId('nav-home')).toBeVisible();
			await expect(canvas.getByTestId('nav-dashboard')).toBeVisible();
			await expect(canvas.getByTestId('nav-about')).toBeVisible();
		});

		await step('renders slot content in main area', async () => {
			await expect(canvas.getByTestId('dashboard-main')).toHaveTextContent('Main Content Area');
		});
	},
};
