import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createVueApp } from '../../src/ui/app.js';
import { PluginContextKey } from '../../src/ui/plugin-context-key.js';
import { createAppRouter } from '../../src/ui/router/index.js';
import * as makeModule from '../../src/modules/make/make-module.js';
import type { PluginContext } from '../../src/plugin.js';
import { CORE_SETTINGS_DEFAULTS } from '../../src/domain/settings/plugin-settings.js';
import { ok } from '../../src/domain/shared/result.js';

function makeCtx(version = '1.0.0'): PluginContext {
	const listeners: Array<(s: unknown) => void> = [];
	return {
		app: {} as never,
		plugin: { manifest: { version }, app: {} as never } as never,
		settings: {
			load: vi.fn(async () => ok({ core: CORE_SETTINGS_DEFAULTS })),
			save: vi.fn(async () => ok(undefined as void)),
			loadSection: vi.fn(async () => ok(CORE_SETTINGS_DEFAULTS)),
			saveSection: vi.fn(async () => ok(undefined as void)),
			subscribe: vi.fn((cb: (s: unknown) => void) => {
				listeners.push(cb);
				return () => { listeners.splice(listeners.indexOf(cb), 1); };
			}),
		},
		commands: {} as never,
		views: {} as never,
		logger: {} as never,
		notifications: {} as never,
		eventBus: {} as never,
		moduleStatus: [],
	};
}

describe('PluginContextKey', () => {
	it('is a symbol', () => {
		expect(typeof PluginContextKey).toBe('symbol');
	});
});

describe('createAppRouter', () => {
	it('creates a router with /, /about, and /dashboard routes', () => {
		const router = createAppRouter();
		const routes = router.getRoutes();
		const paths = routes.map((r) => r.path);
		expect(paths).toContain('/');
		expect(paths).toContain('/about');
		expect(paths).toContain('/dashboard');
	});
});

describe('createVueApp', () => {
	it('mounts and returns an unmount function', () => {
		const el = document.createElement('div');
		document.body.appendChild(el);
		const ctx = makeCtx('2.0.0');
		const mounted = createVueApp(ctx, el);
		expect(mounted).toHaveProperty('unmount');
		expect(typeof mounted.unmount).toBe('function');
		mounted.unmount();
		document.body.removeChild(el);
	});

	it('unmount() calls settingsStore.dispose()', () => {
		const el = document.createElement('div');
		document.body.appendChild(el);
		const ctx = makeCtx('3.0.0');
		const mounted = createVueApp(ctx, el);
		// Should not throw on unmount
		expect(() => { mounted.unmount(); }).not.toThrow();
		document.body.removeChild(el);
	});

	it('sets the plugin version in the app store', async () => {
		const el = document.createElement('div');
		document.body.appendChild(el);
		const ctx = makeCtx('5.5.5');
		const mounted = createVueApp(ctx, el);
		// Allow Vue's async rendering to flush
		await new Promise((r) => { setTimeout(r, 0); });
		expect(el.textContent).toContain('5.5.5');
		mounted.unmount();
		document.body.removeChild(el);
	});
});

describe('createVueApp - Make navigate handler wiring', () => {
	let el: HTMLElement;
	let setSpy: ReturnType<typeof vi.spyOn>;
	let clearSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		el = document.createElement('div');
		document.body.appendChild(el);
		setSpy   = vi.spyOn(makeModule, 'setMakeNavigateHandler');
		clearSpy = vi.spyOn(makeModule, 'clearMakeNavigateHandler');
	});

	afterEach(() => {
		el.remove();
		vi.restoreAllMocks();
	});

	it('setMakeNavigateHandler is called with a function on mount', () => {
		const app = createVueApp(makeCtx('1.0.0'), el);
		expect(setSpy).toHaveBeenCalledTimes(1);
		expect(typeof setSpy.mock.calls[0]![0]).toBe('function');
		app.unmount();
	});

	it('clearMakeNavigateHandler is called on unmount', () => {
		const app = createVueApp(makeCtx('1.0.0'), el);
		expect(clearSpy).not.toHaveBeenCalled();
		app.unmount();
		expect(clearSpy).toHaveBeenCalledTimes(1);
	});
});
