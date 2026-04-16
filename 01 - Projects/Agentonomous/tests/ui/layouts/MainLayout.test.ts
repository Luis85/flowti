import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import MainLayout from '../../../src/ui/layouts/MainLayout.vue';

describe('MainLayout', () => {
	it('renders the default slot content', () => {
		const wrapper = mount(MainLayout, {
			slots: { default: '<p>Main content</p>' },
		});
		expect(wrapper.find('[data-testid="layout-content"]').exists()).toBe(true);
		expect(wrapper.text()).toContain('Main content');
	});

	it('renders the header slot when provided', () => {
		const wrapper = mount(MainLayout, {
			slots: {
				header: '<span>Page Title</span>',
				default: '<p>Content</p>',
			},
		});
		expect(wrapper.find('[data-testid="layout-header"]').exists()).toBe(true);
		expect(wrapper.text()).toContain('Page Title');
	});

	it('hides the header area when no header slot is provided', () => {
		const wrapper = mount(MainLayout, {
			slots: { default: '<p>Content only</p>' },
		});
		expect(wrapper.find('[data-testid="layout-header"]').exists()).toBe(false);
	});

	it('applies the correct layout class', () => {
		const wrapper = mount(MainLayout, {
			slots: { default: '<p>x</p>' },
		});
		expect(wrapper.classes()).toContain('agentonomous-layout--main');
	});
});
