import { vi } from 'vitest';
import type { LoggerPort } from '../../src/domain/shared/logger-port.js';
import type { NotificationPort } from '../../src/domain/shared/notification-port.js';
import type { SettingsPort } from '../../src/domain/settings/settings-port.js';
import type { CommandPort } from '../../src/domain/commands/command-port.js';
import type { ViewRegistryPort } from '../../src/domain/views/view-registry-port.js';
import type { ModulePorts } from '../../src/domain/shared/module.js';
import type { TranslationPort } from '../../src/domain/shared/translation-port.js';
import type { PlatformPort } from '../../src/domain/shared/platform-port.js';
import type { VaultPort } from '../../src/domain/shared/vault-port.js';
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

export function fakeTranslation(): TranslationPort {
	return { t: vi.fn((key: string) => key), locale: 'en' };
}

export function fakePlatform(): PlatformPort {
	return { locale: 'en' };
}

export function fakeVault(): VaultPort {
	const files = new Map<string, { content: string; ctime: number; mtime: number }>();
	return {
		read: vi.fn(async (path: string) => {
			const f = files.get(path);
			if (f === undefined) return { kind: 'err' as const, error: `not found: ${path}` };
			return ok({ path, content: f.content, frontmatter: {}, stat: { size: f.content.length, ctime: f.ctime, mtime: f.mtime } });
		}),
		create: vi.fn(async (path: string, content: string) => {
			files.set(path, { content, ctime: Date.now(), mtime: Date.now() });
			return ok(undefined);
		}),
		update: vi.fn(async (path: string, content: string) => {
			const f = files.get(path);
			if (f === undefined) return { kind: 'err' as const, error: `not found: ${path}` };
			files.set(path, { ...f, content, mtime: Date.now() });
			return ok(undefined);
		}),
		delete: vi.fn(async (path: string) => {
			files.delete(path);
			return ok(undefined);
		}),
		exists: vi.fn(async (path: string) => files.has(path)),
		list: vi.fn(async (folder: string) => ok([...files.keys()].filter((k) => k.startsWith(folder)))),
	};
}

export function fakeModulePorts(overrides?: Partial<ModulePorts>): ModulePorts {
	return {
		eventBus: overrides?.eventBus ?? { on: vi.fn(() => () => {}), emit: vi.fn(), emitAsync: vi.fn(), onAny: vi.fn(() => () => {}), listenerCount: vi.fn(() => 0) } as never,
		logger: overrides?.logger ?? fakeLogger(),
		settings: overrides?.settings ?? fakeSettings(),
		notifications: overrides?.notifications ?? fakeNotifications(),
		views: overrides?.views ?? fakeViews(),
		t: overrides?.t ?? fakeTranslation(),
		platform: overrides?.platform ?? fakePlatform(),
		vault: overrides?.vault ?? fakeVault(),
		...overrides,
	};
}
