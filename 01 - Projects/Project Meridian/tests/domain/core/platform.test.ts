import { describe, it, expect } from 'vitest';
import type { VaultAdapter, SecretStorageAdapter, PlatformServices } from '../../../src/domain/core/platform.js';
import { Result } from '../../../src/domain/core/result.js';

describe('Platform interfaces', () => {
	it('VaultAdapter can be implemented with all required methods', () => {
		const adapter: VaultAdapter = {
			readFile: async () => Result.ok('content'),
			writeFile: async () => Result.ok(undefined),
			deleteFile: async () => Result.ok(undefined),
			listFiles: async () => [],
			exists: async () => true,
		};
		expect(adapter.readFile).toBeDefined();
		expect(adapter.writeFile).toBeDefined();
		expect(adapter.deleteFile).toBeDefined();
		expect(adapter.listFiles).toBeDefined();
		expect(adapter.exists).toBeDefined();
	});

	it('SecretStorageAdapter can be implemented with in-memory map', () => {
		const store = new Map<string, string>();
		const adapter: SecretStorageAdapter = {
			get: async (key) => store.get(key) ?? null,
			set: async (key, value) => { store.set(key, value); },
			delete: async (key) => { store.delete(key); },
		};
		expect(adapter.get).toBeDefined();
		expect(adapter.set).toBeDefined();
		expect(adapter.delete).toBeDefined();
	});

	it('PlatformServices aggregates all adapter interfaces', () => {
		const platform: PlatformServices = {
			vault: {
				readFile: async () => Result.ok(''),
				writeFile: async () => Result.ok(undefined),
				deleteFile: async () => Result.ok(undefined),
				listFiles: async () => [],
				exists: async () => false,
			},
			notifications: { show() {}, showError() {} },
			commands: { register() {} },
			modals: { confirm: async () => true, prompt: async () => null },
			secrets: { get: async () => null, set: async () => {}, delete: async () => {} },
		};
		expect(platform.vault).toBeDefined();
		expect(platform.notifications).toBeDefined();
		expect(platform.commands).toBeDefined();
		expect(platform.modals).toBeDefined();
		expect(platform.secrets).toBeDefined();
	});
});
