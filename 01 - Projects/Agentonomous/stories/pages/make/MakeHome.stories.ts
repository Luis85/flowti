import type { Meta, StoryObj, Decorator } from '@storybook/vue3-vite';
import MakeHome from '../../../src/ui/pages/make/MakeHome.vue';
import { useMakeStore } from '../../../src/ui/stores/make-store.js';
import type { TypeSchema } from '../../../src/domain/make/type-schema.js';
import type { InstanceRef, KpiSnapshot } from '../../../src/domain/make/types.js';

const BOOK: TypeSchema = {
	id: 'book', name: 'Book', instancesFolder: 'Books', titleFieldName: 'title',
	fields: [{ kind: 'text', name: 'title', required: true }],
	createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z',
};

const DUNE:  InstanceRef = { typeId: 'book', path: 'Books/Dune.md',         title: 'Dune',        createdAt: '2026-04-19T10:00:00.000Z', updatedAt: '2026-04-19T10:00:00.000Z' };
const FOUND: InstanceRef = { typeId: 'book', path: 'Books/Foundation.md',   title: 'Foundation',  createdAt: '2026-04-18T12:00:00.000Z', updatedAt: '2026-04-18T12:00:00.000Z' };
const NEURO: InstanceRef = { typeId: 'book', path: 'Books/Neuromancer.md',  title: 'Neuromancer', createdAt: '2026-04-17T09:00:00.000Z', updatedAt: '2026-04-17T09:00:00.000Z' };

const EMPTY_KPIS:   KpiSnapshot = { typesCount: 0, instancesCount: 0, createdThisWeek: 0, perType: {},             recentlyCreated: [] };
const TYPES_ONLY:   KpiSnapshot = { typesCount: 1, instancesCount: 0, createdThisWeek: 0, perType: { book: 0 },   recentlyCreated: [] };
const POPULATED:    KpiSnapshot = { typesCount: 1, instancesCount: 12, createdThisWeek: 3, perType: { book: 12 }, recentlyCreated: [DUNE, FOUND, NEURO] };

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

/** 0 types — existing empty-state branch (no KPIs, no recent list). */
export const Empty: Story = {
	decorators: [seedStore((s) => {
		s.types = [];
		s.typesLoaded = true;
		s.kpis = EMPTY_KPIS;
	})],
};

/** Types list still loading (spinner state). */
export const Loading: Story = {
	decorators: [seedStore((s) => { s.typesLoading = true; })],
};

/** ≥1 type, 0 instances — KPIs show zeros; recent-list shows placeholder. */
export const TypesOnly: Story = {
	decorators: [seedStore((s) => {
		s.types = [BOOK];
		s.typesLoaded = true;
		s.kpis = TYPES_ONLY;
	})],
};

/** Realistic numbers — KPIs populated, recent list showing 3 rows. */
export const Populated: Story = {
	decorators: [seedStore((s) => {
		s.types = [BOOK];
		s.typesLoaded = true;
		s.kpis = POPULATED;
	})],
};
