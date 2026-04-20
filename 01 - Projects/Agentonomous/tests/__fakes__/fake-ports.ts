import { vi } from 'vitest';
import type { LoggerPort } from '../../src/domain/shared/logger-port.js';
import type { NotificationPort } from '../../src/domain/shared/notification-port.js';
import type { DialogPort } from '../../src/domain/shared/dialog-port.js';
import type { SettingsPort } from '../../src/domain/settings/settings-port.js';
import type { CommandPort } from '../../src/domain/commands/command-port.js';
import type { ViewRegistryPort } from '../../src/domain/views/view-registry-port.js';
import type { ModulePorts } from '../../src/domain/shared/module.js';
import type { TranslationPort } from '../../src/domain/shared/translation-port.js';
import type { PlatformPort } from '../../src/domain/shared/platform-port.js';
import type { VaultChange, VaultPort } from '../../src/domain/shared/vault-port.js';
import type { StoragePort } from '../../src/domain/shared/storage-port.js';
import type { SchedulerPort } from '../../src/domain/shared/scheduler-port.js';
import type { AgentPort, TaskPort } from '../../src/domain/agents/agent-port.js';
import type { WorkspacePort, OpenFileMode } from '../../src/domain/shared/workspace-port.js';
import { UnimplementedAgentAdapter, UnimplementedTaskAdapter } from '../../src/infrastructure/agents/unimplemented-agent-adapter.js';
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

export type FakeNotification = { severity: 'info' | 'success' | 'warn' | 'error'; message: string };

export function fakeNotifications(): NotificationPort & { messages: string[]; events: FakeNotification[] } {
	const events: FakeNotification[] = [];
	const messages: string[] = [];
	const push = (severity: FakeNotification['severity'], message: string): void => {
		events.push({ severity, message });
		messages.push(message);
	};
	return {
		info: vi.fn((msg: string) => { push('info', msg); }),
		success: vi.fn((msg: string) => { push('success', msg); }),
		warn: vi.fn((msg: string) => { push('warn', msg); }),
		error: vi.fn((msg: string) => { push('error', msg); }),
		show: vi.fn((msg: string) => { push('info', msg); }),
		events,
		messages,
	};
}

export function fakeDialogs(overrides?: { confirm?: boolean; prompt?: string | null }): DialogPort {
	return {
		confirm: vi.fn(async () => overrides?.confirm ?? false),
		prompt: vi.fn(async () => overrides?.prompt ?? null),
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

export type FakeVaultOptions = {
	/** If set, every `list()` call returns this error. */
	listError?: string;
	/** If set, every `create()` call returns this error. */
	createError?: string;
	/** If set, every `update()` call returns this error. */
	updateError?: string;
	/** If set, every `delete()` call returns this error. */
	deleteError?: string;
	/**
	 * If set, every `rename()` call returns this error.
	 * (The `rename` method is added to VaultPort in Slice F; this option is
	 * reserved here so the fake is ready when that slice lands.)
	 */
	renameError?: string;
};

export type FakeVault = VaultPort & {
	/** Manually trigger a vault change (useful for simulating file events in tests). */
	emitChange: (change: VaultChange) => void;
};

/**
 * @param initial  Seed files for the fake vault.  Each value is either a plain
 *                 content string, or `{ __readError: '<msg>' }` to simulate a
 *                 per-file read failure on that path.
 * @param options  Per-operation error overrides (see `FakeVaultOptions`).
 */
export function fakeVault(
	initial: Record<string, string | { __readError: string }> = {},
	options: FakeVaultOptions = {},
): FakeVault {
	const files = new Map<string, { content: string; ctime: number; mtime: number } | { __readError: string }>();

	// Seed from initial
	for (const [path, value] of Object.entries(initial)) {
		if (typeof value === 'string') {
			files.set(path, { content: value, ctime: Date.now(), mtime: Date.now() });
		} else {
			files.set(path, { __readError: value.__readError });
		}
	}

	const listeners = new Set<(change: VaultChange) => void>();
	const ensuredFolders = new Set<string>();
	const folderExists = (folder: string): boolean => {
		const prefix = folder === '' || folder.endsWith('/') ? folder : `${folder}/`;
		if (prefix === '') return true; // root always exists
		const normalized = prefix.replace(/\/+$/, '');
		if (ensuredFolders.has(normalized)) return true;
		for (const k of files.keys()) {
			if (k.startsWith(prefix)) return true;
		}
		return false;
	};
	return {
		read: vi.fn(async (path: string) => {
			const f = files.get(path);
			if (f === undefined) return { kind: 'err' as const, error: `not found: ${path}` };
			if ('__readError' in f) return { kind: 'err' as const, error: f.__readError };
			return ok({ path, content: f.content, frontmatter: {}, stat: { size: f.content.length, ctime: f.ctime, mtime: f.mtime } });
		}),
		create: vi.fn(async (path: string, content: string) => {
			if (options.createError !== undefined) return { kind: 'err' as const, error: options.createError };
			files.set(path, { content, ctime: Date.now(), mtime: Date.now() });
			return ok(undefined);
		}),
		update: vi.fn(async (path: string, content: string) => {
			if (options.updateError !== undefined) return { kind: 'err' as const, error: options.updateError };
			const f = files.get(path);
			if (f === undefined) return { kind: 'err' as const, error: `not found: ${path}` };
			if ('__readError' in f) return { kind: 'err' as const, error: f.__readError };
			files.set(path, { ...f, content, mtime: Date.now() });
			return ok(undefined);
		}),
		delete: vi.fn(async (path: string) => {
			if (options.deleteError !== undefined) return { kind: 'err' as const, error: options.deleteError };
			files.delete(path);
			return ok(undefined);
		}),
		rename: vi.fn(async (oldPath: string, newPath: string) => {
			if (options.renameError !== undefined) return { kind: 'err' as const, error: options.renameError };
			const entry = files.get(oldPath);
			if (entry === undefined) return { kind: 'err' as const, error: `not-found: ${oldPath}` };
			if (files.has(newPath)) return { kind: 'err' as const, error: `target-exists: ${newPath}` };
			files.set(newPath, entry);
			files.delete(oldPath);
			return ok(undefined);
		}),
		exists: vi.fn(async (path: string) => {
			const entry = files.get(path);
			if (entry !== undefined) return true;
			return folderExists(path);
		}),
		list: vi.fn(async (folder: string) => {
			if (options.listError !== undefined) return { kind: 'err' as const, error: options.listError };
			const prefix = folder === '' || folder.endsWith('/') ? folder : `${folder}/`;
			return ok([...files.keys()].filter((k) => prefix === '' || k.startsWith(prefix)));
		}),
		watch: vi.fn((listener: (change: VaultChange) => void) => {
			listeners.add(listener);
			return () => { listeners.delete(listener); };
		}),
		ensureFolder: vi.fn(async (folder: string) => {
			const normalized = folder.replace(/^\/+|\/+$/g, '');
			if (normalized !== '') ensuredFolders.add(normalized);
			return ok(undefined);
		}),
		emitChange: (change: VaultChange) => {
			for (const l of listeners) l(change);
		},
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
	} as StoragePort;
}

/**
 * In-memory scheduler for tests.  No real timers — run scheduled tasks
 * by calling `fire(id)` or `fireAll()`.
 */
export type FakeScheduler = SchedulerPort & {
	readonly scheduled: Map<string, { kind: 'every' | 'once'; intervalMs: number; fn: () => void | Promise<void> }>;
	fire: (id: string) => Promise<void>;
	fireAll: () => Promise<void>;
};

export function fakeScheduler(): FakeScheduler {
	const scheduled = new Map<string, { kind: 'every' | 'once'; intervalMs: number; fn: () => void | Promise<void> }>();
	const port: FakeScheduler = {
		scheduled,
		every: vi.fn((id: string, intervalMs: number, fn: () => void | Promise<void>) => {
			scheduled.set(id, { kind: 'every', intervalMs, fn });
		}),
		once: vi.fn((id: string, delayMs: number, fn: () => void | Promise<void>) => {
			scheduled.set(id, { kind: 'once', intervalMs: delayMs, fn });
		}),
		cancel: vi.fn((id: string) => { scheduled.delete(id); }),
		cancelAll: vi.fn(() => { scheduled.clear(); }),
		fire: async (id: string): Promise<void> => {
			const entry = scheduled.get(id);
			if (entry === undefined) return;
			if (entry.kind === 'once') scheduled.delete(id);
			await entry.fn();
		},
		fireAll: async (): Promise<void> => {
			for (const id of [...scheduled.keys()]) await port.fire(id);
		},
	};
	return port;
}

export function fakeAgents(): AgentPort {
	return new UnimplementedAgentAdapter();
}

export function fakeTasks(): TaskPort {
	return new UnimplementedTaskAdapter();
}

export function fakeWorkspace(): {
	port: WorkspacePort;
	calls: Array<{ path: string; mode: OpenFileMode }>;
} {
	const calls: Array<{ path: string; mode: OpenFileMode }> = [];
	return {
		port: {
			async openFile(path, mode) {
				calls.push({ path, mode });
				return ok(undefined);
			},
		} satisfies WorkspacePort,
		calls,
	};
}

export function fakeModulePorts(overrides?: Partial<ModulePorts>): ModulePorts {
	return {
		eventBus: overrides?.eventBus ?? { on: vi.fn(() => () => {}), emit: vi.fn(), emitAsync: vi.fn(), onAny: vi.fn(() => () => {}), listenerCount: vi.fn(() => 0) } as never,
		logger: overrides?.logger ?? fakeLogger(),
		settings: overrides?.settings ?? fakeSettings(),
		notifications: overrides?.notifications ?? fakeNotifications(),
		dialogs: overrides?.dialogs ?? fakeDialogs(),
		views: overrides?.views ?? fakeViews(),
		t: overrides?.t ?? fakeTranslation(),
		platform: overrides?.platform ?? fakePlatform(),
		vault: overrides?.vault ?? fakeVault(),
		storage: overrides?.storage ?? fakeStorage(),
		scheduler: overrides?.scheduler ?? fakeScheduler(),
		agents: overrides?.agents ?? fakeAgents(),
		tasks: overrides?.tasks ?? fakeTasks(),
		workspace: overrides?.workspace ?? fakeWorkspace().port,
		...overrides,
	};
}
