import type { Meta, StoryObj, Decorator } from '@storybook/vue3-vite';
import MakeTypeInstances from '../../../src/ui/pages/make/MakeTypeInstances.vue';
import { useMakeStore } from '../../../src/ui/stores/make-store.js';
import type { TypeSchema } from '../../../src/domain/make/type-schema.js';
import type { InstanceRef } from '../../../src/domain/make/types.js';

const BOOK: TypeSchema = {
	id: 'book',
	name: 'Book',
	description: 'Reading log',
	instancesFolder: 'Books',
	titleFieldName: 'title',
	fields: [
		{ kind: 'text', name: 'title',  required: true },
		{ kind: 'text', name: 'author', required: false },
	],
	createdAt: '2026-04-18T00:00:00.000Z',
	updatedAt: '2026-04-18T00:00:00.000Z',
};

const DUNE:  InstanceRef = { typeId: 'book', path: 'Books/Dune.md',         title: 'Dune',         createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z' };
const NEURO: InstanceRef = { typeId: 'book', path: 'Books/Neuromancer.md',  title: 'Neuromancer',  createdAt: '2026-04-19T00:00:00.000Z', updatedAt: '2026-04-19T00:00:00.000Z' };

function seedDecorator(seed: (s: ReturnType<typeof useMakeStore>) => void): Decorator {
	return (story) => ({
		setup() {
			seed(useMakeStore());
			return {};
		},
		components: { Story: story() },
		template: '<Story />',
	});
}

const meta: Meta<typeof MakeTypeInstances> = {
	title: 'Pages/Make/MakeTypeInstances',
	component: MakeTypeInstances,
};
export default meta;
type Story = StoryObj<typeof MakeTypeInstances>;

export const InstancesList: Story = {
	args: { type: BOOK, instances: [DUNE, NEURO], loading: false, error: null },
	decorators: [seedDecorator((s) => { s.types = [BOOK]; })],
};

export const EmptyStateAutoOpen: Story = {
	args: { type: BOOK, instances: [], loading: false, error: null },
	decorators: [seedDecorator((s) => { s.types = [BOOK]; })],
};

export const Loading: Story = {
	args: { type: BOOK, instances: undefined, loading: true, error: null },
	decorators: [seedDecorator((s) => { s.types = [BOOK]; })],
};

export const Errored: Story = {
	args: { type: BOOK, instances: undefined, loading: false, error: 'vault-error: EIO' },
	decorators: [seedDecorator((s) => { s.types = [BOOK]; })],
};
