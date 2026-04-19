import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mountWithI18n } from '../../../__fixtures__/mount-with-i18n.js';
import RecentInstancesList from '../../../../src/ui/components/make/RecentInstancesList.vue';
import type { InstanceRef } from '../../../../src/domain/make/types.js';

const NOW = new Date('2026-04-19T12:00:00.000Z');

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterAll(() => { vi.useRealTimers(); });

const DUNE:  InstanceRef = { typeId: 'book', path: 'Books/Dune.md',  title: 'Dune',  createdAt: '2026-04-19T10:00:00.000Z', updatedAt: '2026-04-19T10:00:00.000Z' };
const NEURO: InstanceRef = { typeId: 'book', path: 'Books/Neuro.md', title: 'Neuro', createdAt: '2026-04-18T12:00:00.000Z', updatedAt: '2026-04-18T12:00:00.000Z' };

describe('RecentInstancesList', () => {
	it('renders one row per instance with title, type-name chip, and relative date', () => {
		const wrapper = mountWithI18n(RecentInstancesList, {
			props: { instances: [DUNE, NEURO], typeNamesById: { book: 'Book' }, emptyPlaceholder: '', loading: false },
		});
		const rows = wrapper.findAll('[data-testid^="recent-instance-row-"]');
		expect(rows).toHaveLength(2);
		expect(rows[0]!.text()).toContain('Dune');
		expect(rows[0]!.text()).toContain('Book');
		expect(rows[0]!.text()).toContain('2h ago');
		expect(rows[1]!.text()).toContain('Neuro');
		expect(rows[1]!.text()).toContain('1d ago');
		wrapper.unmount();
	});

	it('emits "open" with the path when a row is clicked', async () => {
		const wrapper = mountWithI18n(RecentInstancesList, {
			props: { instances: [DUNE], typeNamesById: { book: 'Book' }, emptyPlaceholder: '', loading: false },
		});
		await wrapper.find(`[data-testid="recent-instance-row-${DUNE.path}"]`).trigger('click');
		expect(wrapper.emitted('open')).toEqual([['Books/Dune.md']]);
		wrapper.unmount();
	});

	it('emits "open" when Enter is pressed on a focused row', async () => {
		const wrapper = mountWithI18n(RecentInstancesList, {
			props: { instances: [DUNE], typeNamesById: { book: 'Book' }, emptyPlaceholder: '', loading: false },
			attachTo: document.body,
		});
		const row = wrapper.find(`[data-testid="recent-instance-row-${DUNE.path}"]`);
		(row.element as HTMLElement).focus();
		row.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(wrapper.emitted('open')).toEqual([['Books/Dune.md']]);
		wrapper.unmount();
	});

	it('shows emptyPlaceholder text when instances is empty (and loading is false)', () => {
		const wrapper = mountWithI18n(RecentInstancesList, {
			props: { instances: [], typeNamesById: {}, emptyPlaceholder: 'Nothing yet', loading: false },
		});
		expect(wrapper.find('[data-testid="recent-instances-empty"]').text()).toBe('Nothing yet');
		expect(wrapper.findAll('[data-testid^="recent-instance-row-"]')).toHaveLength(0);
		wrapper.unmount();
	});

	it('uses the raw typeId as the chip text when typeNamesById has no entry for the typeId', () => {
		const wrapper = mountWithI18n(RecentInstancesList, {
			props: { instances: [DUNE], typeNamesById: {}, emptyPlaceholder: '', loading: false },
		});
		const row = wrapper.find(`[data-testid="recent-instance-row-${DUNE.path}"]`);
		expect(row.text()).toContain('book');
		wrapper.unmount();
	});

	it('does NOT render the empty placeholder while loading=true', () => {
		const wrapper = mountWithI18n(RecentInstancesList, {
			props: { instances: [], typeNamesById: {}, emptyPlaceholder: 'X', loading: true },
		});
		expect(wrapper.find('[data-testid="recent-instances-empty"]').exists()).toBe(false);
		wrapper.unmount();
	});

	it('rows are keyboard-focusable (tabindex="0")', () => {
		const wrapper = mountWithI18n(RecentInstancesList, {
			props: { instances: [DUNE], typeNamesById: {}, emptyPlaceholder: '', loading: false },
		});
		const row = wrapper.find(`[data-testid="recent-instance-row-${DUNE.path}"]`);
		expect(row.attributes('tabindex')).toBe('0');
		wrapper.unmount();
	});

	it('rows expose role="button" and an aria-label naming the instance', () => {
		const wrapper = mountWithI18n(RecentInstancesList, {
			props: { instances: [DUNE], typeNamesById: { book: 'Book' }, emptyPlaceholder: '', loading: false },
		});
		const row = wrapper.find(`[data-testid="recent-instance-row-${DUNE.path}"]`);
		expect(row.attributes('role')).toBe('button');
		expect(row.attributes('aria-label')).toBe('Open Dune');
		wrapper.unmount();
	});

	it('emits "open" when Space is pressed on a focused row', async () => {
		const wrapper = mountWithI18n(RecentInstancesList, {
			props: { instances: [DUNE], typeNamesById: { book: 'Book' }, emptyPlaceholder: '', loading: false },
			attachTo: document.body,
		});
		const row = wrapper.find(`[data-testid="recent-instance-row-${DUNE.path}"]`);
		(row.element as HTMLElement).focus();
		row.element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		expect(wrapper.emitted('open')).toEqual([['Books/Dune.md']]);
		wrapper.unmount();
	});
});
