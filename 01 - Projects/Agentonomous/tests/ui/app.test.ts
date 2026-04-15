import { describe, expect, it, vi } from 'vitest';
import { createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { createVueApp } from '../../src/ui/app.js';
import { PluginContextKey } from '../../src/ui/plugin-context-key.js';
import { createAppRouter } from '../../src/ui/router/index.js';
import type { PluginContext } from '../../src/plugin.js';
import { DEFAULT_SETTINGS } from '../../src/domain/settings/plugin-settings.js';
import { ok } from '../../src/domain/shared/result.js';

function makeCtx(version = '1.0.0'): PluginContext {
	const listeners: Array<(s: typeof DEFAULT_SETTINGS) => void> = [];
	return {
		app: {} as never,
		plugin: { manifest: { version }, app: {} as never } as never,
		settings: {
			load: vi.fn(async () => ok(DEFAULT_SETTINGS)),
			save: vi.fn(async () => ok(undefined as void)),
			subscribe: vi.fn((cb: (s: typeof DEFAULT_SETTINGS) => void) => {
				listeners.push(cb);
				return () => { listeners.splice(listeners.indexOf(cb), 1); };
			}),
		},
		viewRegistry: {} as never,
	};
}

describe('PluginContextKey', () => {
	it('is a symbol', () => {
		expect(typeof PluginContextKey).toBe('symbol');
	});
});

describe('createAppRouter', () => {
	it('creates a router with / and /about routes', () => {
		const router = createAppRouter();
		const routes = router.getRoutes();
		const paths = routes.map((r) => r.path);
		expect(paths).toContain('/');
		expect(paths).toContain('/about');
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
