import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { createPinia } from 'pinia';
import DashboardLayout from '../../src/ui/layouts/DashboardLayout.vue';
import { withRouter } from '../decorators/with-router.js';

const meta: Meta<typeof DashboardLayout> = {
	title: 'Layouts/DashboardLayout',
	component: DashboardLayout,
	decorators: [withRouter],
};
export default meta;

type Story = StoryObj<typeof DashboardLayout>;

export const Default: Story = {
	render: () => ({
		components: { DashboardLayout },
		setup() {
			const pinia = createPinia();
			return { pinia };
		},
		template: `
			<DashboardLayout>
				<div>Main Content Area</div>
			</DashboardLayout>
		`,
		global: { plugins: [createPinia()] },
	}),
};
