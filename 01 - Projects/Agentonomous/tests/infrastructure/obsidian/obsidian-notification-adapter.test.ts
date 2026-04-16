import { describe, expect, it } from 'vitest';
import { ObsidianNotificationAdapter } from '../../../src/infrastructure/obsidian/obsidian-notification-adapter.js';

describe('ObsidianNotificationAdapter', () => {
	it('show() creates a Notice without throwing', () => {
		const adapter = new ObsidianNotificationAdapter();
		expect(() => { adapter.show('test message'); }).not.toThrow();
	});
});
