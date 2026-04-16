import { vi } from 'vitest';
import type { LoggerPort } from '../../src/domain/shared/logger-port.js';
import type { NotificationPort } from '../../src/domain/shared/notification-port.js';
import type { SettingsPort } from '../../src/domain/settings/settings-port.js';
import type { CommandPort } from '../../src/domain/commands/command-port.js';
import type { ViewRegistryPort } from '../../src/domain/views/view-registry-port.js';
import type { ModulePorts } from '../../src/domain/shared/module.js';
import { ok } from '../../src/domain/shared/result.js';

export function fakeLogger(): LoggerPort {
	return {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		setLevel: vi.fn(),
	};
}

export function fakeSettings(initial: unknown = null): SettingsPort {
	let data = initial;
	const listeners = new Set<(s: unknown) => void>();
	return {
		load: vi.fn(async () => ok(data)),
		save: vi.fn(async (d: unknown) => { data = d; for (const l of listeners) l(d); return ok(undefined); }),
		subscribe: vi.fn((l: (s: unknown) => void) => { listeners.add(l); return () => { listeners.delete(l); }; }),
	};
}

export function fakeNotifications(): NotificationPort & { messages: string[] } {
	const messages: string[] = [];
	return {
		show: vi.fn((msg: string) => { messages.push(msg); }),
		messages,
	};
}

export function fakeCommands(): CommandPort & { registered: string[] } {
	const registered: string[] = [];
	return {
		register: vi.fn((entry: { id: string }) => { registered.push(entry.id); return () => {}; }),
		unregisterAll: vi.fn(),
		registered,
	};
}

export function fakeViews(): ViewRegistryPort {
	return {
		registerAll: vi.fn(),
		openView: vi.fn(async () => ok(undefined)),
	};
}

export function fakeModulePorts(overrides?: Partial<ModulePorts>): ModulePorts {
	return {
		eventBus: overrides?.eventBus ?? { on: vi.fn(() => () => {}), emit: vi.fn(), emitAsync: vi.fn(), onAny: vi.fn(() => () => {}), listenerCount: vi.fn(() => 0) } as never,
		logger: overrides?.logger ?? fakeLogger(),
		settings: overrides?.settings ?? fakeSettings(),
		notifications: overrides?.notifications ?? fakeNotifications(),
		views: overrides?.views ?? fakeViews(),
		...overrides,
	};
}
