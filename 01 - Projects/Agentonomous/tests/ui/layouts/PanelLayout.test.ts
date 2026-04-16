import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import PanelLayout from '../../../src/ui/layouts/PanelLayout.vue';

describe('PanelLayout', () => {
	it('renders the default slot content', () => {
		const wrapper = mount(PanelLayout, {
			slots: { default: '<p>Panel content</p>' },
		});
		expect(wrapper.find('[data-testid="panel-content"]').exists()).toBe(true);
		expect(wrapper.text()).toContain('Panel content');
	});

	it('renders the header slot when provided', () => {
		const wrapper = mount(PanelLayout, {
			slots: {
				header: '<span>Panel Title</span>',
				default: '<p>Content</p>',
			},
		});
		expect(wrapper.find('[data-testid="panel-header"]').exists()).toBe(true);
		expect(wrapper.text()).toContain('Panel Title');
	});

	it('hides the header area when no header slot is provided', () => {
		const wrapper = mount(PanelLayout, {
			slots: { default: '<p>Content only</p>' },
		});
		expect(wrapper.find('[data-testid="panel-header"]').exists()).toBe(false);
	});

	it('applies the correct layout class', () => {
		const wrapper = mount(PanelLayout, {
			slots: { default: '<p>x</p>' },
		});
		expect(wrapper.classes()).toContain('agentonomous-layout--panel');
	});
});
