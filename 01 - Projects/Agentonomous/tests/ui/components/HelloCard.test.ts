import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import HelloCard from '../../../src/ui/components/HelloCard.vue';

describe('HelloCard', () => {
	it('renders title and message props', () => {
		const wrapper = mount(HelloCard, {
			props: { title: 'Hi', message: 'Welcome' },
		});
		expect(wrapper.get('[data-testid="card-title"]').text()).toBe('Hi');
		expect(wrapper.get('[data-testid="card-message"]').text()).toBe('Welcome');
	});

	it('applies the hello-card class', () => {
		const wrapper = mount(HelloCard, { props: { title: 'x', message: 'y' } });
		expect(wrapper.classes()).toContain('hello-card');
	});
});
