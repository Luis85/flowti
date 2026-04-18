import type { Meta, StoryObj, Decorator } from '@storybook/vue3-vite';
import MakeHome from '../../../src/ui/pages/make/MakeHome.vue';
import { useMakeStore } from '../../../src/ui/stores/make-store.js';
import type { TypeSchema } from '../../../src/domain/make/type-schema.js';

const BOOK: TypeSchema = {
	id: 'book', name: 'Book', instancesFolder: 'Books', titleFieldName: 'title',
	fields: [{ kind: 'text', name: 'title', required: true }],
	createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z',
};

function seedStore(seed: (s: ReturnType<typeof useMakeStore>) => void): Decorator {
	return (story) => ({
		setup() {
			const s = useMakeStore();
			seed(s);
			return {};
		},
		components: { Story: story() },
		template: '<Story />',
	});
}

const meta: Meta<typeof MakeHome> = {
	title: 'Pages/Make/MakeHome',
	component: MakeHome,
};
export default meta;
type Story = StoryObj<typeof MakeHome>;

export const Default: Story = {
	decorators: [seedStore((s) => { s.types = [BOOK]; s.typesLoaded = true; })],
};
export const Loading: Story = {
	decorators: [seedStore((s) => { s.typesLoading = true; })],
};
export const Empty: Story = {
	decorators: [seedStore((s) => { s.types = []; s.typesLoaded = true; })],
};
