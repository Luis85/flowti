import { describe, expect, it } from 'vitest';
import { ObsidianNotificationAdapter } from '../../../src/infrastructure/obsidian/obsidian-notification-adapter.js';
import { _noticeMessages } from '../../__stubs__/obsidian.js';

describe('ObsidianNotificationAdapter', () => {
	it('info emits plain message', () => {
		_noticeMessages.splice(0);
		const adapter = new ObsidianNotificationAdapter();
		adapter.info('hello');
		expect(_noticeMessages[0]).toBe('hello');
	});

	it('success prefixes with ✓', () => {
		_noticeMessages.splice(0);
		const adapter = new ObsidianNotificationAdapter();
		adapter.success('saved');
		expect(_noticeMessages[0]?.startsWith('✓')).toBe(true);
	});

	it('warn prefixes with ⚠', () => {
		_noticeMessages.splice(0);
		const adapter = new ObsidianNotificationAdapter();
		adapter.warn('careful');
		expect(_noticeMessages[0]?.startsWith('⚠')).toBe(true);
	});

	it('error prefixes with ✕', () => {
		_noticeMessages.splice(0);
		const adapter = new ObsidianNotificationAdapter();
		adapter.error('broken');
		expect(_noticeMessages[0]?.startsWith('✕')).toBe(true);
	});

	it('show delegates to info', () => {
		_noticeMessages.splice(0);
		const adapter = new ObsidianNotificationAdapter();
		adapter.show('legacy');
		expect(_noticeMessages[0]).toBe('legacy');
	});

	it('accepts a durationMs option without throwing', () => {
		const adapter = new ObsidianNotificationAdapter();
		expect(() => { adapter.warn('x', { durationMs: 500 }); }).not.toThrow();
	});
});
