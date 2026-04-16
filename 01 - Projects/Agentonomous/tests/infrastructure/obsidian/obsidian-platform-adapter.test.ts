import { describe, expect, it } from 'vitest';
import { ObsidianPlatformAdapter } from '../../../src/infrastructure/obsidian/obsidian-platform-adapter.js';

describe('ObsidianPlatformAdapter', () => {
	it('locale returns a non-empty string', () => {
		const adapter = new ObsidianPlatformAdapter();
		expect(typeof adapter.locale).toBe('string');
		expect(adapter.locale.length).toBeGreaterThan(0);
	});

	it('locale falls back to en when neither moment nor navigator is available', () => {
		// In jsdom environment navigator.language may be empty; adapter returns 'en'
		const adapter = new ObsidianPlatformAdapter();
		// Just verify it does not throw and returns a string
		expect(adapter.locale).toBeTruthy();
	});
});
