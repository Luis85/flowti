import type { Meta, StoryObj, Decorator } from '@storybook/vue3-vite';
import MakeTypes from '../../../src/ui/pages/make/MakeTypes.vue';
import { useMakeStore } from '../../../src/ui/stores/make-store.js';
import type { TypeSchema } from '../../../src/domain/make/type-schema.js';
import type { InstanceRef } from '../../../src/domain/make/types.js';
import type { CorruptTypeRef } from '../../../src/domain/make/errors.js';

const BOOK: TypeSchema = { id: 'book', name: 'Book', description: 'Reading log', instancesFolder: 'Books', titleFieldName: 'title', fields: [{ kind: 'text', name: 'title', required: true }], createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z' };
const RECIPE: TypeSchema = { id: 'recipe', name: 'Recipe', instancesFolder: 'Recipes', titleFieldName: 'title', fields: [{ kind: 'text', name: 'title', required: true }], createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z' };
const DUNE: InstanceRef = { typeId: 'book', path: 'Books/Dune.md', title: 'Dune', createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z' };

const CORRUPT_ONE: readonly CorruptTypeRef[] = [
	{ path: 'Make/Types/broken.json', filename: 'broken.json', error: { kind: 'invalid-json', reason: 'unexpected token at position 4' } },
];
const CORRUPT_FIVE: readonly CorruptTypeRef[] = [
	{ path: 'Make/Types/broken.json',  filename: 'broken.json',  error: { kind: 'invalid-json', reason: 'unexpected token' } },
	{ path: 'Make/Types/secret.json',  filename: 'secret.json',  error: { kind: 'io-error',     cause: 'permission denied' } },
	{ path: 'Make/Types/orphan.json',  filename: 'orphan.json',  error: { kind: 'missing-required-key', key: 'titleFieldName' } },
	{ path: 'Make/Types/badkind.json', filename: 'badkind.json', error: { kind: 'invalid-field-kind',   received: 'numbr' } },
	{ path: 'Make/Types/dupname.json', filename: 'dupname.json', error: { kind: 'duplicate-field-name', name: 'title' } },
];

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

export const CorruptBannerNone: Story = {
	decorators: [seedStore((s) => {
		s.types = [BOOK];
		s.typesLoaded = true;
		s.issues = [];
	})],
};

export const CorruptBannerOneIssue: Story = {
	decorators: [seedStore((s) => {
		s.types = [BOOK];
		s.typesLoaded = true;
		s.issues = CORRUPT_ONE;
	})],
};

export const CorruptBannerFiveIssuesExpanded: Story = {
	decorators: [seedStore((s) => {
		s.types = [BOOK, RECIPE];
		s.typesLoaded = true;
		s.issues = CORRUPT_FIVE;
	})],
};
