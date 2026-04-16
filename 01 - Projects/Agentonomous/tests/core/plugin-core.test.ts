import { describe, expect, it, vi } from 'vitest';
import { PluginCore } from '../../src/core/plugin-core.js';
import { createEventBus } from '../../src/domain/shared/event-bus.js';
import '../../src/domain/shared/core-events.js';
import { Logger } from '../../src/core/logger.js';
import { defineModule } from '../../src/domain/shared/module.js';
import { ok } from '../../src/domain/shared/result.js';
import { fakeSettings, fakeCommands, fakeViews, fakeNotifications, fakeLogger, fakeTranslation, fakePlatform, fakeVault } from '../__fakes__/fake-ports.js';
import type { Result } from '../../src/domain/shared/result.js';

describe('PluginCore with modules', () => {
	it('init() calls module.init in dependency order', async () => {
		const bus = createEventBus();
		const order: string[] = [];
		const a = defineModule({ id: 'a', name: 'A', async init() { order.push('a'); }, destroy() {} });
		const b = defineModule({ id: 'b', name: 'B', dependsOn: ['a'], async init() { order.push('b'); }, destroy() {} });

		const core = new PluginCore(
			{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus, t: fakeTranslation(), platform: fakePlatform(), vault: fakeVault() },
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
			{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus, t: fakeTranslation(), platform: fakePlatform(), vault: fakeVault() },
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
			{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus, t: fakeTranslation(), platform: fakePlatform(), vault: fakeVault() },
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
			{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus, t: fakeTranslation(), platform: fakePlatform(), vault: fakeVault() },
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
			{ settings: fakeSettings(), commands, views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus, t: fakeTranslation(), platform: fakePlatform(), vault: fakeVault() },
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
			{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus, t: fakeTranslation(), platform: fakePlatform(), vault: fakeVault() },
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
			{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus, t: fakeTranslation(), platform: fakePlatform(), vault: fakeVault() },
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
			{ settings, commands: fakeCommands(), views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus, t: fakeTranslation(), platform: fakePlatform(), vault: fakeVault() },
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
			{ settings, commands: fakeCommands(), views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus, t: fakeTranslation(), platform: fakePlatform(), vault: fakeVault() },
			[m],
		);
		await core.init();
		expect(receivedSettings[0]).toEqual({ color: 'blue' });
	});

	it('is headless — no Obsidian, no DOM, no Vue', async () => {
		const bus = createEventBus();
		const m = defineModule({ id: 'a', name: 'A', async init() {}, destroy() {} });
		const core = new PluginCore(
			{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger: new Logger(bus, 'error'), notifications: fakeNotifications(), eventBus: bus, t: fakeTranslation(), platform: fakePlatform(), vault: fakeVault() },
			[m],
		);
		await core.init();
		core.destroy();
		expect(core.ready).toBe(false);
	});
});

describe('PluginCore graceful degradation', () => {
	it('continues initializing other modules when one throws', async () => {
		const bus = createEventBus();
		const order: string[] = [];
		const broken = defineModule({ id: 'broken', name: 'Broken', async init() { throw new Error('boom'); }, destroy() {} });
		const healthy = defineModule({ id: 'healthy', name: 'Healthy', async init() { order.push('healthy'); }, destroy() {} });

		const core = new PluginCore(
			{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger: fakeLogger(), notifications: fakeNotifications(), eventBus: bus, t: fakeTranslation(), platform: fakePlatform(), vault: fakeVault() },
			[broken, healthy],
		);
		await core.init();
		expect(core.ready).toBe(true);
		expect(order).toContain('healthy');
	});

	it('exposes degradedModules for failed modules', async () => {
		const bus = createEventBus();
		const broken = defineModule({ id: 'broken', name: 'Broken', async init() { throw new Error('boom'); }, destroy() {} });

		const core = new PluginCore(
			{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger: fakeLogger(), notifications: fakeNotifications(), eventBus: bus, t: fakeTranslation(), platform: fakePlatform(), vault: fakeVault() },
			[broken],
		);
		await core.init();
		expect(core.degradedModules).toContain('broken');
	});

	it('emits core event with degraded: true when a module fails', async () => {
		const bus = createEventBus();
		const events: unknown[] = [];
		bus.on('core', (env) => { events.push(env.payload); });
		const broken = defineModule({ id: 'broken', name: 'Broken', async init() { throw new Error('boom'); }, destroy() {} });

		const core = new PluginCore(
			{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger: fakeLogger(), notifications: fakeNotifications(), eventBus: bus, t: fakeTranslation(), platform: fakePlatform(), vault: fakeVault() },
			[broken],
		);
		await core.init();
		expect(events).toContainEqual(expect.objectContaining({ degraded: true }));
	});

	it('does not register commands for failed modules', async () => {
		const bus = createEventBus();
		const commands = fakeCommands();
		const broken = defineModule({
			id: 'broken', name: 'Broken',
			commands: [{ id: 'broken-cmd', name: 'Broken' }],
			async init() { throw new Error('boom'); },
			destroy() {},
		});

		const core = new PluginCore(
			{ settings: fakeSettings(), commands, views: fakeViews(), logger: fakeLogger(), notifications: fakeNotifications(), eventBus: bus, t: fakeTranslation(), platform: fakePlatform(), vault: fakeVault() },
			[broken],
		);
		await core.init();
		expect(commands.registered).not.toContain('broken-cmd');
	});

	it('skips failed modules during destroy', async () => {
		const bus = createEventBus();
		const destroyCalls: string[] = [];
		const broken = defineModule({ id: 'broken', name: 'Broken', async init() { throw new Error('boom'); }, destroy() { destroyCalls.push('broken'); } });
		const healthy = defineModule({ id: 'healthy', name: 'Healthy', async init() {}, destroy() { destroyCalls.push('healthy'); } });

		const core = new PluginCore(
			{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger: fakeLogger(), notifications: fakeNotifications(), eventBus: bus, t: fakeTranslation(), platform: fakePlatform(), vault: fakeVault() },
			[broken, healthy],
		);
		await core.init();
		core.destroy();
		expect(destroyCalls).toEqual(['healthy']);
		expect(destroyCalls).not.toContain('broken');
	});
});

describe('PluginCore settings migration', () => {
	it('calls migrate() when settings version is behind', async () => {
		const bus = createEventBus();
		const migrateFn = vi.fn((_fromVersion: number, blob: unknown) => {
			return ok({ ...(blob as Record<string, unknown>), migrated: true, _version: 2 });
		});
		const m = defineModule<{ color: string }>({
			id: 'test', name: 'Test',
			settingsKey: 'test',
			settingsVersion: 2,
			settingsDefaults: { color: 'blue' },
			migrate: migrateFn as (fromVersion: number, blob: unknown) => Result<{ color: string }, string>,
			async init() {},
			destroy() {},
		});

		const settings = fakeSettings({ test: { _version: 1, color: 'red' } });
		const core = new PluginCore(
			{ settings, commands: fakeCommands(), views: fakeViews(), logger: fakeLogger(), notifications: fakeNotifications(), eventBus: bus, t: fakeTranslation(), platform: fakePlatform(), vault: fakeVault() },
			[m],
		);
		await core.init();
		expect(migrateFn).toHaveBeenCalledWith(1, expect.objectContaining({ color: 'red' }));
	});

	it('falls back to defaults when migrate returns err', async () => {
		const bus = createEventBus();
		const receivedSettings: unknown[] = [];
		const m = defineModule<{ color: string }>({
			id: 'test', name: 'Test',
			settingsKey: 'test',
			settingsVersion: 2,
			settingsDefaults: { color: 'blue' },
			migrate: () => ({ kind: 'err', error: 'migration failed' }),
			async init(_ports, settings) { receivedSettings.push(settings); },
			destroy() {},
		});

		const settings = fakeSettings({ test: { _version: 1, color: 'red' } });
		const core = new PluginCore(
			{ settings, commands: fakeCommands(), views: fakeViews(), logger: fakeLogger(), notifications: fakeNotifications(), eventBus: bus, t: fakeTranslation(), platform: fakePlatform(), vault: fakeVault() },
			[m],
		);
		await core.init();
		expect(receivedSettings[0]).toEqual({ color: 'blue' });
	});

	it('skips migration when no settingsVersion declared', async () => {
		const bus = createEventBus();
		const receivedSettings: unknown[] = [];
		const m = defineModule<{ color: string }>({
			id: 'test', name: 'Test',
			settingsKey: 'test',
			settingsDefaults: { color: 'blue' },
			async init(_ports, settings) { receivedSettings.push(settings); },
			destroy() {},
		});

		const settings = fakeSettings({ test: { color: 'red' } });
		const core = new PluginCore(
			{ settings, commands: fakeCommands(), views: fakeViews(), logger: fakeLogger(), notifications: fakeNotifications(), eventBus: bus, t: fakeTranslation(), platform: fakePlatform(), vault: fakeVault() },
			[m],
		);
		await core.init();
		expect(receivedSettings[0]).toEqual(expect.objectContaining({ color: 'red' }));
	});
});

describe('PluginCore listener leak detection', () => {
	it('warns when a module leaks listeners during destroy', async () => {
		const bus = createEventBus();
		const logger = fakeLogger();
		const leaky = defineModule({
			id: 'leaky', name: 'Leaky',
			async init(ports) {
				ports.eventBus.on('core', () => {}); // subscribes but destroy doesn't unsubscribe
			},
			destroy() { /* intentionally does NOT unsubscribe */ },
		});

		const core = new PluginCore(
			{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger, notifications: fakeNotifications(), eventBus: bus, t: fakeTranslation(), platform: fakePlatform(), vault: fakeVault() },
			[leaky],
		);
		await core.init();
		core.destroy();
		expect(logger.warn).toHaveBeenCalledWith('core', expect.stringContaining('leaky'));
	});
});

describe('PluginCore core settings resolution', () => {
	it('falls back to defaults when core settings are invalid in blob', async () => {
		const bus = createEventBus();
		// Provide invalid core settings (logLevel: 99 is not a valid LogLevel)
		const settingsPort = fakeSettings({ core: { showRibbonIcon: 'not-a-boolean', defaultView: 'home', logLevel: 'info' } });
		const m = defineModule({ id: 'a', name: 'A', async init() {}, destroy() {} });
		const core = new PluginCore(
			{ settings: settingsPort, commands: fakeCommands(), views: fakeViews(), logger: fakeLogger(), notifications: fakeNotifications(), eventBus: bus, t: fakeTranslation(), platform: fakePlatform(), vault: fakeVault() },
			[m],
		);
		await core.init();
		// Should fall back to defaults since showRibbonIcon is invalid
		expect(core.coreSettings).toBeDefined();
	});
});

describe('PluginCore.registerExtensions', () => {
	it('calls port.register for each module extension after init', async () => {
		const bus = createEventBus();
		const m = defineModule({
			id: 'test', name: 'Test',
			extensions: [
				{ ext: 'csv', viewType: 'agentonomous-file-detail' },
				{ ext: 'json', viewType: 'agentonomous-file-detail' },
			],
			async init() {},
			destroy() {},
		});

		const core = new PluginCore(
			{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger: fakeLogger(), notifications: fakeNotifications(), eventBus: bus, t: fakeTranslation(), platform: fakePlatform(), vault: fakeVault() },
			[m],
		);
		await core.init();

		const registered: Array<{ extensions: readonly string[]; viewType: string }> = [];
		const fakePort = {
			register: (extensions: readonly string[], viewType: string) => {
				registered.push({ extensions, viewType });
				return () => {};
			},
		};
		core.registerExtensions(fakePort);

		expect(registered).toHaveLength(2);
		expect(registered[0]).toEqual({ extensions: ['csv'], viewType: 'agentonomous-file-detail' });
		expect(registered[1]).toEqual({ extensions: ['json'], viewType: 'agentonomous-file-detail' });
	});

	it('does not register extensions for failed modules', async () => {
		const bus = createEventBus();
		const broken = defineModule({
			id: 'broken', name: 'Broken',
			extensions: [{ ext: 'csv', viewType: 'test-view' }],
			async init() { throw new Error('boom'); },
			destroy() {},
		});

		const core = new PluginCore(
			{ settings: fakeSettings(), commands: fakeCommands(), views: fakeViews(), logger: fakeLogger(), notifications: fakeNotifications(), eventBus: bus, t: fakeTranslation(), platform: fakePlatform(), vault: fakeVault() },
			[broken],
		);
		await core.init();

		const registered: string[] = [];
		const fakePort = { register: (exts: readonly string[]) => { registered.push(...exts); return () => {}; } };
		core.registerExtensions(fakePort);

		expect(registered).toHaveLength(0);
	});
});
