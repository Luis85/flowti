import { describe, it, expect } from 'vitest';
import { nextTick } from 'vue';
import MakeTypeBaseBanner from '../../../../src/ui/pages/make/MakeTypeBaseBanner.vue';
import { mountWithI18n } from '../../../__fixtures__/mount-with-i18n.js';

function getEl(root: HTMLElement, testId: string): HTMLElement | null {
	return root.querySelector(`[data-testid="${testId}"]`);
}

function mountBanner(props: Record<string, unknown> = {}) {
	return mountWithI18n(MakeTypeBaseBanner, {
		props: {
			state: 'missing',
			regenerateLoading: false,
			regenerateError: null,
			...props,
		},
	});
}

describe('MakeTypeBaseBanner', () => {
	it('has role=status', () => {
		const wrapper = mountBanner();
		const root = wrapper.element as HTMLElement;
		// The root element IS the banner (component has a single root element)
		expect(root.getAttribute('role')).toBe('status');
	});

	it('missing state renders correct title text', () => {
		const wrapper = mountBanner({ state: 'missing' });
		const root = wrapper.element as HTMLElement;
		const title = getEl(root, 'base-file-banner-title');
		expect(title?.textContent).toContain('Table view missing');
	});

	it('missing state renders body text', () => {
		const wrapper = mountBanner({ state: 'missing' });
		const root = wrapper.element as HTMLElement;
		expect(root.textContent).toContain("hasn't been generated yet");
	});

	it('stale state renders correct title text', () => {
		const wrapper = mountBanner({ state: 'stale', generatedAt: '2026-04-01T00:00:00.000Z' });
		const root = wrapper.element as HTMLElement;
		const title = getEl(root, 'base-file-banner-title');
		expect(title?.textContent).toContain('Table view out of date');
	});

	it('stale state renders body with date interpolated', () => {
		const wrapper = mountBanner({ state: 'stale', generatedAt: '2026-04-01T00:00:00.000Z' });
		const root = wrapper.element as HTMLElement;
		expect(root.textContent).toContain('2026-04-01');
	});

	it('button click emits regenerate', async () => {
		const wrapper = mountBanner();
		const root = wrapper.element as HTMLElement;
		const btn = getEl(root, 'base-file-banner-regenerate') as HTMLButtonElement;
		btn.click();
		await nextTick();
		expect(wrapper.emitted('regenerate')).toBeTruthy();
		expect(wrapper.emitted('regenerate')!.length).toBe(1);
	});

	it('regenerateLoading disables the button', () => {
		const wrapper = mountBanner({ regenerateLoading: true });
		const root = wrapper.element as HTMLElement;
		const btn = getEl(root, 'base-file-banner-regenerate') as HTMLButtonElement;
		expect(btn.disabled).toBe(true);
	});

	it('regenerateLoading sets aria-busy=true', () => {
		const wrapper = mountBanner({ regenerateLoading: true });
		const root = wrapper.element as HTMLElement;
		const btn = getEl(root, 'base-file-banner-regenerate') as HTMLButtonElement;
		expect(btn.getAttribute('aria-busy')).toBe('true');
	});

	it('regenerateLoading changes button text to Regenerating…', () => {
		const wrapper = mountBanner({ regenerateLoading: true });
		const root = wrapper.element as HTMLElement;
		const btn = getEl(root, 'base-file-banner-regenerate') as HTMLButtonElement;
		expect(btn.textContent?.trim()).toBe('Regenerating…');
	});

	it('regenerateLoading=false sets aria-busy=false', () => {
		const wrapper = mountBanner({ regenerateLoading: false });
		const root = wrapper.element as HTMLElement;
		const btn = getEl(root, 'base-file-banner-regenerate') as HTMLButtonElement;
		expect(btn.getAttribute('aria-busy')).toBe('false');
	});

	it('button has aria-label for regenerate action', () => {
		const wrapper = mountBanner();
		const root = wrapper.element as HTMLElement;
		const btn = getEl(root, 'base-file-banner-regenerate') as HTMLButtonElement;
		expect(btn.getAttribute('aria-label')).toBeTruthy();
	});

	it('regenerateError renders error text when provided', () => {
		const wrapper = mountBanner({ regenerateError: 'Something went wrong' });
		const root = wrapper.element as HTMLElement;
		const errorEl = getEl(root, 'base-file-banner-error');
		expect(errorEl).not.toBeNull();
		expect(errorEl?.textContent).toContain('Something went wrong');
	});

	it('error element is absent when regenerateError is null', () => {
		const wrapper = mountBanner({ regenerateError: null });
		const root = wrapper.element as HTMLElement;
		const errorEl = getEl(root, 'base-file-banner-error');
		expect(errorEl).toBeNull();
	});
});
