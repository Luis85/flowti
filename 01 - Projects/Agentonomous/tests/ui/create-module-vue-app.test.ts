import { describe, expect, it, vi } from 'vitest';
import { defineComponent, inject, h } from 'vue';
import { createModuleVueApp } from '../../src/ui/create-module-vue-app.js';
import { PluginContextKey } from '../../src/ui/plugin-context-key.js';
import type { PluginContext } from '../../src/plugin.js';
import { ok } from '../../src/domain/shared/result.js';
import { CORE_SETTINGS_DEFAULTS } from '../../src/domain/settings/plugin-settings.js';

function makeCtx(): PluginContext {
	return {
		app: {} as never,
		plugin: { manifest: { version: '1.0.0' }, app: {} as never } as never,
		settings: {
			load: vi.fn(async () => ok(CORE_SETTINGS_DEFAULTS)),
			save: vi.fn(async () => ok(undefined as void)),
			subscribe: vi.fn(() => () => {}),
		},
		commands: {} as never,
		views: {} as never,
		logger: {} as never,
		notifications: {} as never,
		eventBus: {} as never,
		t: {} as never,
		platform: {} as never,
		vault: {} as never,
		moduleStatus: [],
	};
}

describe('createModuleVueApp', () => {
	it('mounts a component and returns an unmount function', () => {
		const el = document.createElement('div');
		document.body.appendChild(el);
		const ctx = makeCtx();
		const StubComponent = defineComponent({ render: () => h('span', 'hello') });

		const mounted = createModuleVueApp(StubComponent, ctx, el);

		expect(mounted).toHaveProperty('unmount');
		expect(typeof mounted.unmount).toBe('function');
		expect(el.textContent).toBe('hello');

		mounted.unmount();
		document.body.removeChild(el);
	});

	it('provides PluginContext via PluginContextKey', () => {
		const el = document.createElement('div');
		document.body.appendChild(el);
		const ctx = makeCtx();

		let injected: PluginContext | undefined;
		const StubComponent = defineComponent({
			setup() {
				injected = inject(PluginContextKey);
				return {};
			},
			render: () => h('span'),
		});

		const mounted = createModuleVueApp(StubComponent, ctx, el);
		expect(injected).toBe(ctx);

		mounted.unmount();
		document.body.removeChild(el);
	});

	it('unmounts cleanly without throwing', () => {
		const el = document.createElement('div');
		document.body.appendChild(el);
		const ctx = makeCtx();
		const StubComponent = defineComponent({ render: () => h('span') });

		const mounted = createModuleVueApp(StubComponent, ctx, el);
		expect(() => { mounted.unmount(); }).not.toThrow();
		document.body.removeChild(el);
	});

	it('forwards optional props to the root component', () => {
		const el = document.createElement('div');
		document.body.appendChild(el);
		const ctx = makeCtx();
		const StubComponent = defineComponent({
			props: { label: { type: String, default: '' } },
			render(this: { label: string }) { return h('span', this.label); },
		});

		const mounted = createModuleVueApp(StubComponent, ctx, el, { label: 'from-props' });
		expect(el.textContent).toBe('from-props');

		mounted.unmount();
		document.body.removeChild(el);
	});
});
