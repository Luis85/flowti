import { describe, it, expect } from 'vitest';
import { mountWithI18n } from '../../../__fixtures__/mount-with-i18n.js';
import KpiCard from '../../../../src/ui/components/make/KpiCard.vue';

describe('KpiCard', () => {
	it('renders the label and value', () => {
		const wrapper = mountWithI18n(KpiCard, { props: { label: 'Types', value: 3, testid: 'kpi-types' } });
		expect(wrapper.find('[data-testid="kpi-types"]').exists()).toBe(true);
		expect(wrapper.find('[data-testid="kpi-types-value"]').text()).toBe('3');
		expect(wrapper.find('[data-testid="kpi-types-label"]').text()).toBe('Types');
		wrapper.unmount();
	});

	it('renders a skeleton dash when loading=true', () => {
		const wrapper = mountWithI18n(KpiCard, { props: { label: 'Types', value: 0, testid: 'kpi-x', loading: true } });
		expect(wrapper.find('[data-testid="kpi-x-value"]').text()).toBe('—');
		wrapper.unmount();
	});

	it('uses the default testid "kpi-card" when no testid prop is provided', () => {
		const wrapper = mountWithI18n(KpiCard, { props: { label: 'Types', value: 0 } });
		expect(wrapper.find('[data-testid="kpi-card"]').exists()).toBe(true);
		wrapper.unmount();
	});

	it('numeric value 0 renders as "0", not empty', () => {
		const wrapper = mountWithI18n(KpiCard, { props: { label: 'Types', value: 0, testid: 'z' } });
		expect(wrapper.find('[data-testid="z-value"]').text()).toBe('0');
		wrapper.unmount();
	});

	it('exposes an aria-label combining label and value, and aria-busy during loading', () => {
		const ready = mountWithI18n(KpiCard, { props: { label: 'Types', value: 3, testid: 'kpi-a' } });
		const readyCard = ready.find('[data-testid="kpi-a"]');
		expect(readyCard.attributes('aria-label')).toBe('Types: 3');
		expect(readyCard.attributes('aria-busy')).toBe('false');
		ready.unmount();

		const busy = mountWithI18n(KpiCard, { props: { label: 'Types', value: 0, testid: 'kpi-b', loading: true } });
		const busyCard = busy.find('[data-testid="kpi-b"]');
		expect(busyCard.attributes('aria-busy')).toBe('true');
		expect(busyCard.attributes('aria-label')).toBe('Types: —');
		busy.unmount();
	});
});
