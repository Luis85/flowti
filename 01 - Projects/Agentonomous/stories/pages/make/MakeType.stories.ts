import type { Meta, StoryObj, Decorator } from '@storybook/vue3-vite';
import { useRouter } from 'vue-router';
import MakeType from '../../../src/ui/pages/make/MakeType.vue';
import { useMakeStore } from '../../../src/ui/stores/make-store.js';
import type { TypeSchema } from '../../../src/domain/make/type-schema.js';
import type { InstanceRef } from '../../../src/domain/make/types.js';

const BOOK: TypeSchema = {
	id: 'book', name: 'Book', description: 'Reading log', instancesFolder: 'Books', titleFieldName: 'title',
	fields: [
		{ kind: 'text', name: 'title', required: true },
		{ kind: 'text', name: 'author', required: false },
		{ kind: 'number', name: 'pages', required: false, description: 'Page count' },
	],
	createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z',
};
const DUNE: InstanceRef = { typeId: 'book', path: 'Books/Dune.md', title: 'Dune', createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z' };
const NEURO: InstanceRef = { typeId: 'book', path: 'Books/Neuromancer.md', title: 'Neuromancer', createdAt: '2026-04-19T00:00:00.000Z', updatedAt: '2026-04-19T00:00:00.000Z' };

function makeDecorator(path: string, seed: (s: ReturnType<typeof useMakeStore>) => void): Decorator {
	return (story) => ({
		async setup() {
			const router = useRouter();
			seed(useMakeStore());
			await router.push(path);
			await router.isReady();
			return {};
		},
		components: { Story: story() },
		template: '<Story />',
	});
}

const meta: Meta<typeof MakeType> = {
	title: 'Pages/Make/MakeType',
	component: MakeType,
};
export default meta;
type Story = StoryObj<typeof MakeType>;

export const InstancesTab: Story = {
	decorators: [makeDecorator('/make/types/book', (s) => {
		s.types = [BOOK]; s.typesLoaded = true;
		s.instancesByTypeId = new Map([['book', [DUNE, NEURO]]]);
	})],
};

export const FieldsTab: Story = {
	decorators: [makeDecorator('/make/types/book#fields', (s) => {
		s.types = [BOOK]; s.typesLoaded = true;
		s.instancesByTypeId = new Map([['book', [DUNE, NEURO]]]);
	})],
};

export const Empty: Story = {
	decorators: [makeDecorator('/make/types/book', (s) => {
		s.types = [BOOK]; s.typesLoaded = true;
		s.instancesByTypeId = new Map([['book', []]]);
	})],
};

export const LoadingInstances: Story = {
	decorators: [makeDecorator('/make/types/book', (s) => {
		s.types = [BOOK]; s.typesLoaded = true;
		s.instancesLoading = new Set(['book']);
	})],
};

export const InstancesError: Story = {
	decorators: [makeDecorator('/make/types/book', (s) => {
		s.types = [BOOK]; s.typesLoaded = true;
		s.instancesError = new Map([['book', 'vault-error: EIO']]);
	})],
};
