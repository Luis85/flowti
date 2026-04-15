import { describe, expect, it, vi } from 'vitest';
import { HomepageView, VIEW_TYPE_HOMEPAGE } from '../../../src/infrastructure/views/homepage-view.js';

describe('HomepageView constants', () => {
	it('VIEW_TYPE_HOMEPAGE is the expected string', () => {
		expect(VIEW_TYPE_HOMEPAGE).toBe('agentonomous-homepage');
	});
});

describe('HomepageView', () => {
	it('getViewType() returns VIEW_TYPE_HOMEPAGE', () => {
		const view = new HomepageView({} as never, {} as never);
		expect(view.getViewType()).toBe(VIEW_TYPE_HOMEPAGE);
	});

	it('getDisplayText() returns a non-empty string', () => {
		const view = new HomepageView({} as never, {} as never);
		expect(view.getDisplayText()).toBeTruthy();
	});

	it('getIcon() returns a non-empty string', () => {
		const view = new HomepageView({} as never, {} as never);
		expect(view.getIcon()).toBeTruthy();
	});

	it('onClose() clears the mounted app and returns resolved promise', async () => {
		const view = new HomepageView({} as never, {} as never);
		const unmount = vi.fn();
		(view as unknown as { mounted: { unmount: () => void } }).mounted = { unmount };
		await (view as unknown as { onClose: () => Promise<void> }).onClose();
		expect(unmount).toHaveBeenCalledTimes(1);
		expect((view as unknown as { mounted: unknown }).mounted).toBeNull();
	});

	it('onOpen() shows fallback error text when Vue fails to load', async () => {
		vi.doMock('../../../src/ui/app.js', () => ({
			createVueApp: () => { throw new Error('Vue failed'); },
		}));
		const { HomepageView: HV } = await import('../../../src/infrastructure/views/homepage-view.js');
		const view = new HV({} as never, {} as never);
		await (view as unknown as { onOpen: () => Promise<void> }).onOpen();
		const el = (view as unknown as { contentEl: HTMLElement }).contentEl;
		expect(el.textContent).toContain('Agentonomous failed to load');
		vi.doUnmock('../../../src/ui/app.js');
	});
});
