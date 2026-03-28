import { describe, it, expect } from 'vitest';
import type { VaultAdapter, NotificationAdapter, CommandRegistry, ModalAdapter, PlatformServices } from '../../../src/domain/core/platform.js';
import type { ResultValue } from '../../../src/domain/core/result.js';

describe('Platform interfaces', () => {
	it('VaultAdapter can be implemented with all required methods', () => {
		const ok = <T>(value: T): ResultValue<T> => ({ ok: true, value });

		const adapter: VaultAdapter = {
			readFile: async () => ok('content'),
			writeFile: async () => ok(undefined),
			deleteFile: async () => ok(undefined),
			listFiles: async () => [],
			exists: async () => true,
		};
		expect(adapter.readFile).toBeDefined();
		expect(adapter.writeFile).toBeDefined();
		expect(adapter.deleteFile).toBeDefined();
		expect(adapter.listFiles).toBeDefined();
		expect(adapter.exists).toBeDefined();
	});

	it('PlatformServices aggregates all adapter interfaces', () => {
		const platform: PlatformServices = {
			vault: {
				readFile: async () => ({ ok: true, value: '' }),
				writeFile: async () => ({ ok: true, value: undefined }),
				deleteFile: async () => ({ ok: true, value: undefined }),
				listFiles: async () => [],
				exists: async () => false,
			},
			notifications: { show() {}, showError() {} },
			commands: { register() {} },
			modals: { confirm: async () => true, prompt: async () => null },
		};
		expect(platform.vault).toBeDefined();
		expect(platform.notifications).toBeDefined();
		expect(platform.commands).toBeDefined();
		expect(platform.modals).toBeDefined();
	});
});
