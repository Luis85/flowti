import { describe, expect, it, vi } from 'vitest';
import { PluginCore } from '../../src/core/plugin-core.js';
import { createEventBus } from '../../src/domain/shared/event-bus.js';
import '../../src/domain/shared/core-events.js';
import { Logger } from '../../src/core/logger.js';
import { defineModule } from '../../src/domain/shared/module.js';
import { ok } from '../../src/domain/shared/result.js';
import { fakeSettings, fakeCommands, fakeViews, fakeNotifications, fakeLogger } from '../__fakes__/fake-ports.js';

describe('PluginCore with modules', () => {
	it('init() calls module.init in dependency order', async () => {
		const bus = createEventBus();
		const order: string[] = [];
		const a = defineModule({ id: 'a', name: 'A', async init() { order.push('a'); }, destroy() {} });
		const b = defineModule({ id: 'b', name: 'B', dependsOn: ['a'], async init() { order.push('b'); }, destroy() {} });

		const core = new PluginCore(
			{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus },
			[b, a],
		);
		await core.init();
		expect(order).toEqual(['a', 'b']);
		expect(core.ready).toBe(true);
	});

	it('destroy() calls module.destroy in reverse order', async () => {
		const bus = createEventBus();
		const order: string[] = [];
		const a = defineModule({ id: 'a', name: 'A', async init() {}, destroy() { order.push('a'); } });
		const b = defineModule({ id: 'b', name: 'B', dependsOn: ['a'], async init() {}, destroy() { order.push('b'); } });

		const core = new PluginCore(
			{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus },
			[b, a],
		);
		await core.init();
		core.destroy();
		expect(order).toEqual(['b', 'a']);
	});

	it('fails fast on circular dependencies', async () => {
		const bus = createEventBus();
		const a = defineModule({ id: 'a', name: 'A', dependsOn: ['b'], async init() {}, destroy() {} });
		const b = defineModule({ id: 'b', name: 'B', dependsOn: ['a'], async init() {}, destroy() {} });

		const core = new PluginCore(
			{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus },
			[a, b],
		);

		const phases: string[] = [];
		bus.on('core', (env) => { phases.push(String(env.payload.phase)); });
		await core.init();
		expect(core.ready).toBe(false);
		expect(phases).toContain('validation');
	});

	it('detects duplicate module ids', async () => {
		const bus = createEventBus();
		const a1 = defineModule({ id: 'a', name: 'A1', async init() {}, destroy() {} });
		const a2 = defineModule({ id: 'a', name: 'A2', async init() {}, destroy() {} });

		const core = new PluginCore(
			{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus },
			[a1, a2],
		);
		await core.init();
		expect(core.ready).toBe(false);
	});

	it('collects and registers commands from all modules', async () => {
		const bus = createEventBus();
		const commands = fakeCommands();
		const m = defineModule({
			id: 'test', name: 'Test',
			commands: [{ id: 'test-cmd', name: 'Test' }],
			async init() {}, destroy() {},
		});

		const core = new PluginCore(
			{ settings: fakeSettings(), commands, views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus },
			[m],
		);
		await core.init();
		expect(commands.register).toHaveBeenCalledWith(expect.objectContaining({ id: 'test-cmd' }));
	});

	it('emits core:initializing and core:ready', async () => {
		const bus = createEventBus();
		const phases: string[] = [];
		bus.on('core', (env) => { phases.push(String(env.payload.phase)); });

		const m = defineModule({ id: 'a', name: 'A', async init() {}, destroy() {} });
		const core = new PluginCore(
			{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus },
			[m],
		);
		await core.init();
		expect(phases).toContain('initializing');
		expect(phases).toContain('ready');
	});

	it('emits core:destroying and core:destroyed', async () => {
		const bus = createEventBus();
		const m = defineModule({ id: 'a', name: 'A', async init() {}, destroy() {} });
		const core = new PluginCore(
			{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus },
			[m],
		);
		await core.init();

		const phases: string[] = [];
		bus.on('core', (env) => { phases.push(String(env.payload.phase)); });
		core.destroy();
		expect(phases).toContain('destroying');
		expect(phases).toContain('destroyed');
	});

	it('passes validated settings to module.init', async () => {
		const bus = createEventBus();
		const receivedSettings: unknown[] = [];
		const m = defineModule<{ color: string }>({
			id: 'test', name: 'Test',
			settingsKey: 'test',
			settingsDefaults: { color: 'blue' },
			validateSettings: (raw) => {
				if (typeof raw === 'object' && raw !== null && 'color' in raw && typeof (raw as Record<string, unknown>).color === 'string') {
					return ok(raw as { color: string });
				}
				return ok({ color: 'blue' });
			},
			async init(_ports, settings) { receivedSettings.push(settings); },
			destroy() {},
		});

		const settings = fakeSettings({ test: { color: 'red' } });

		const core = new PluginCore(
			{ settings, commands: fakeCommands(), views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus },
			[m],
		);
		await core.init();
		expect(receivedSettings[0]).toEqual({ color: 'red' });
	});

	it('falls back to defaults when settings section is missing', async () => {
		const bus = createEventBus();
		const receivedSettings: unknown[] = [];
		const m = defineModule<{ color: string }>({
			id: 'test', name: 'Test',
			settingsKey: 'test',
			settingsDefaults: { color: 'blue' },
			async init(_ports, settings) { receivedSettings.push(settings); },
			destroy() {},
		});

		const settings = fakeSettings({});

		const core = new PluginCore(
			{ settings, commands: fakeCommands(), views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus },
			[m],
		);
		await core.init();
		expect(receivedSettings[0]).toEqual({ color: 'blue' });
	});

	it('is headless — no Obsidian, no DOM, no Vue', async () => {
		const bus = createEventBus();
		const m = defineModule({ id: 'a', name: 'A', async init() {}, destroy() {} });
		const core = new PluginCore(
			{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus },
			[m],
		);
		await core.init();
		core.destroy();
		expect(core.ready).toBe(false);
	});
});
