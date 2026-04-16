import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import HelloCard from '../../../src/ui/components/HelloCard.vue';
import { HelloCardPO } from '../../../src/ui/components/HelloCard.po.js';

describe('HelloCard', () => {
	it('renders title and message props', () => {
		const wrapper = mount(HelloCard, {
			props: { title: 'Hi', message: 'Welcome' },
		});
		const po = new HelloCardPO(wrapper.element as HTMLElement);
		expect(po.title).toBe('Hi');
		expect(po.message).toBe('Welcome');
	});

	it('applies the hello-card class', () => {
		const wrapper = mount(HelloCard, { props: { title: 'x', message: 'y' } });
		expect(wrapper.classes()).toContain('hello-card');
	});
});
