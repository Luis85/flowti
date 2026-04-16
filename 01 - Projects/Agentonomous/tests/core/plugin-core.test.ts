import { describe, expect, it, vi } from 'vitest';
import { PluginCore } from '../../src/core/plugin-core.js';
import { createEventBus } from '../../src/domain/shared/event-bus.js';
import { Logger } from '../../src/core/logger.js';
import type { SettingsPort } from '../../src/domain/settings/settings-port.js';
import type { CommandPort } from '../../src/domain/commands/command-port.js';
import type { CommandEntry } from '../../src/domain/commands/command-types.js';
import type { NotificationPort } from '../../src/domain/shared/notification-port.js';
import type { ViewRegistryPort } from '../../src/domain/views/view-registry-port.js';
import { ok } from '../../src/domain/shared/result.js';
import { CORE_SETTINGS_DEFAULTS } from '../../src/domain/settings/plugin-settings.js';
import { CORE_COMMANDS } from '../../src/domain/commands/core-commands.js';

function fakeSettings(): SettingsPort {
	return {
		load: vi.fn(async () => ok(CORE_SETTINGS_DEFAULTS)),
		save: vi.fn(async () => ok(undefined)),
		subscribe: vi.fn(() => () => {}),
	};
}

function fakeCommands(): CommandPort & { registered: string[] } {
	const registered: string[] = [];
	return {
		register: vi.fn((entry: CommandEntry) => { registered.push(entry.id); return () => {}; }),
		unregisterAll: vi.fn(),
		setRibbonVisibility: vi.fn(),
		registered,
	};
}

function fakeViews(): ViewRegistryPort {
	return { registerAll: vi.fn(), openView: vi.fn(async () => {}) };
}

function fakeNotifications(): NotificationPort {
	return { show: vi.fn() };
}

describe('PluginCore', () => {
	it('init() emits core:initializing then core:ready', async () => {
		const bus = createEventBus();
		const phases: string[] = [];
		bus.on('core', (env) => { phases.push(env.payload.phase); });

		const core = new PluginCore({
			settings: fakeSettings(),
			commands: fakeCommands(),
			views: fakeViews(),
			logger: new Logger(bus, 'error'),
			notifications: fakeNotifications(),
			eventBus: bus,
		}, CORE_COMMANDS);

		await core.init();
		expect(phases).toContain('initializing');
		expect(phases).toContain('ready');
		expect(core.ready).toBe(true);
	});

	it('init() registers all command entries', async () => {
		const bus = createEventBus();
		const commands = fakeCommands();

		const core = new PluginCore({
			settings: fakeSettings(),
			commands,
			views: fakeViews(),
			logger: new Logger(bus, 'error'),
			notifications: fakeNotifications(),
			eventBus: bus,
		}, CORE_COMMANDS);

		await core.init();
		expect(commands.register).toHaveBeenCalled();
		expect(commands.registered).toContain('open-homepage');
	});

	it('destroy() emits core:destroying then core:destroyed', async () => {
		const bus = createEventBus();
		const core = new PluginCore({
			settings: fakeSettings(),
			commands: fakeCommands(),
			views: fakeViews(),
			logger: new Logger(bus, 'error'),
			notifications: fakeNotifications(),
			eventBus: bus,
		}, CORE_COMMANDS);

		await core.init();

		const phases: string[] = [];
		bus.on('core', (env) => { phases.push(env.payload.phase); });
		core.destroy();
		expect(phases).toContain('destroying');
		expect(phases).toContain('destroyed');
		expect(core.ready).toBe(false);
	});

	it('is headless — no Obsidian, no DOM, no Vue required', async () => {
		const bus = createEventBus();
		const core = new PluginCore({
			settings: fakeSettings(),
			commands: fakeCommands(),
			views: fakeViews(),
			logger: new Logger(bus, 'error'),
			notifications: fakeNotifications(),
			eventBus: bus,
		}, CORE_COMMANDS);

		await core.init();
		core.destroy();
		expect(core.ready).toBe(false);
	});
});
