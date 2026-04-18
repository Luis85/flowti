import type { Meta, StoryObj, Decorator } from '@storybook/vue3-vite';
import MakeTypes from '../../../src/ui/pages/make/MakeTypes.vue';
import { useMakeStore } from '../../../src/ui/stores/make-store.js';
import type { TypeSchema } from '../../../src/domain/make/type-schema.js';
import type { InstanceRef } from '../../../src/domain/make/types.js';

const BOOK: TypeSchema = { id: 'book', name: 'Book', description: 'Reading log', instancesFolder: 'Books', titleFieldName: 'title', fields: [{ kind: 'text', name: 'title', required: true }], createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z' };
const RECIPE: TypeSchema = { id: 'recipe', name: 'Recipe', instancesFolder: 'Recipes', titleFieldName: 'title', fields: [{ kind: 'text', name: 'title', required: true }], createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z' };
const DUNE: InstanceRef = { typeId: 'book', path: 'Books/Dune.md', title: 'Dune', createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z' };

function seedStore(seed: (s: ReturnType<typeof useMakeStore>) => void): Decorator {
	return (story) => ({
		setup() { const s = useMakeStore(); seed(s); return {}; },
		components: { Story: story() },
		template: '<Story />',
	});
}

const meta: Meta<typeof MakeTypes> = {
	title: 'Pages/Make/MakeTypes',
	component: MakeTypes,
};
export default meta;
type Story = StoryObj<typeof MakeTypes>;

export const Default: Story = {
	decorators: [seedStore((s) => {
		s.types = [BOOK, RECIPE];
		s.typesLoaded = true;
		s.instancesByTypeId = new Map([['book', [DUNE]], ['recipe', []]]);
	})],
};
export const Loading: Story = {
	decorators: [seedStore((s) => { s.typesLoading = true; })],
};
export const Empty: Story = {
	decorators: [seedStore((s) => { s.types = []; s.typesLoaded = true; })],
};
export const Error: Story = {
	decorators: [seedStore((s) => { s.typesError = 'vault-error: EIO'; })],
};
