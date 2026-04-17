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
import type { StoragePort } from '../../src/domain/shared/storage-port.js';
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
	const notify = (): void => { for (const l of listeners) l(data); };
	const asBlob = (): Record<string, unknown> =>
		(typeof data === 'object' && data !== null && !Array.isArray(data))
			? { ...(data as Record<string, unknown>) }
			: {};
	return {
		load: vi.fn(async () => ok(data)),
		save: vi.fn(async (d: unknown) => { data = d; notify(); return ok(undefined); }),
		loadSection: vi.fn(async (key: string) => ok(asBlob()[key] ?? null)),
		saveSection: vi.fn(async (key: string, value: unknown) => {
			const next = asBlob();
			next[key] = value;
			data = next;
			notify();
			return ok(undefined);
		}),
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
		register: vi.fn((entry: { id: string }) => { registered.push(entry.id); }),
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

export function fakeStorage(): StoragePort {
	const store = new Map<string, Map<string, unknown>>();
	const ns = (namespace: string): Map<string, unknown> => {
		let bucket = store.get(namespace);
		if (bucket === undefined) {
			bucket = new Map();
			store.set(namespace, bucket);
		}
		return bucket;
	};
	return {
		loadJson: vi.fn(async (namespace: string, key: string) => ok(ns(namespace).get(key) ?? null)),
		saveJson: vi.fn(async (namespace: string, key: string, value: unknown) => {
			ns(namespace).set(key, value);
			return ok(undefined as void);
		}),
		deleteKey: vi.fn(async (namespace: string, key: string) => {
			ns(namespace).delete(key);
			return ok(undefined as void);
		}),
		listKeys: vi.fn(async (namespace: string) => ok([...ns(namespace).keys()])),
		clearNamespace: vi.fn(async (namespace: string) => {
			store.delete(namespace);
			return ok(undefined as void);
		}),
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
		storage: overrides?.storage ?? fakeStorage(),
		...overrides,
	};
}
