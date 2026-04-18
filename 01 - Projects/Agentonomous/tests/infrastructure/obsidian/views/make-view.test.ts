import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MakeView, MAKE_VIEW_REGISTRATION } from '../../../../src/infrastructure/obsidian/views/make-view.js';
import { VIEW_TYPE_MAKE } from '../../../../src/domain/views/view-types.js';
import type { PluginContext } from '../../../../src/plugin.js';

describe('MakeView constants', () => {
	it('VIEW_TYPE_MAKE is the expected string', () => {
		expect(VIEW_TYPE_MAKE).toBe('agentonomous-make');
	});
});

describe('MakeView', () => {
	it('getViewType() returns VIEW_TYPE_MAKE', () => {
		const view = new MakeView({} as never, {} as never);
		expect(view.getViewType()).toBe(VIEW_TYPE_MAKE);
	});

	it('getDisplayText() returns Make', () => {
		const view = new MakeView({} as never, {} as never);
		expect(view.getDisplayText()).toBe('Make');
	});

	it('getIcon() returns hammer', () => {
		const view = new MakeView({} as never, {} as never);
		expect(view.getIcon()).toBe('hammer');
	});

	it('onClose() clears the mounted app', async () => {
		const view = new MakeView({} as never, {} as never);
		const unmount = vi.fn();
		(view as unknown as { mounted: { unmount: () => void } }).mounted = { unmount };
		await (view as unknown as { onClose: () => Promise<void> }).onClose();
		expect(unmount).toHaveBeenCalledTimes(1);
		expect((view as unknown as { mounted: unknown }).mounted).toBeNull();
	});
});

describe('MakeView — onOpen happy path', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.doMock('../../../../src/ui/app.js', () => ({
			createVueApp: vi.fn(() => ({ unmount: vi.fn() })),
		}));
	});

	afterEach(() => {
		vi.doUnmock('../../../../src/ui/app.js');
	});

	it('onOpen() calls createVueApp with ctx, contentEl, and /make initial route', async () => {
		const { MakeView: MV } = await import('../../../../src/infrastructure/obsidian/views/make-view.js');
		const { createVueApp } = await import('../../../../src/ui/app.js');
		const fakeCtx = {} as unknown as PluginContext;
		const view = new MV({} as never, fakeCtx);
		await (view as unknown as { onOpen: () => Promise<void> }).onOpen();
		expect(createVueApp).toHaveBeenCalledWith(
			fakeCtx,
			(view as unknown as { contentEl: HTMLElement }).contentEl,
			'/make',
		);
		expect((view as unknown as { mounted: unknown }).mounted).not.toBeNull();
	});

	it('onOpen() is idempotent — two calls mount once', async () => {
		const { MakeView: MV } = await import('../../../../src/infrastructure/obsidian/views/make-view.js');
		const { createVueApp } = await import('../../../../src/ui/app.js');
		const view = new MV({} as never, {} as unknown as PluginContext);
		await (view as unknown as { onOpen: () => Promise<void> }).onOpen();
		await (view as unknown as { onOpen: () => Promise<void> }).onOpen();
		expect(createVueApp).toHaveBeenCalledTimes(1);
	});
});

describe('MakeView — error branch', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.doMock('../../../../src/ui/app.js', () => ({
			createVueApp: () => { throw new Error('Vue failed'); },
		}));
	});

	afterEach(() => {
		vi.doUnmock('../../../../src/ui/app.js');
	});

	it('onOpen() renders fallback text when createVueApp throws', async () => {
		const { MakeView: MV } = await import('../../../../src/infrastructure/obsidian/views/make-view.js');
		const view = new MV({} as never, {} as never);
		await (view as unknown as { onOpen: () => Promise<void> }).onOpen();
		const el = (view as unknown as { contentEl: HTMLElement }).contentEl;
		expect(el.textContent).toContain('Make failed to load');
		expect(el.textContent).toContain('Vue failed');
	});
});

describe('MAKE_VIEW_REGISTRATION', () => {
	it('has the expected shape', () => {
		expect(MAKE_VIEW_REGISTRATION.type).toBe(VIEW_TYPE_MAKE);
		expect(MAKE_VIEW_REGISTRATION.displayName).toBe('Make');
		expect(MAKE_VIEW_REGISTRATION.icon).toBe('hammer');
		expect(MAKE_VIEW_REGISTRATION.defaultLocation).toBe('main');
		expect(typeof MAKE_VIEW_REGISTRATION.viewFactory).toBe('function');
	});
});
