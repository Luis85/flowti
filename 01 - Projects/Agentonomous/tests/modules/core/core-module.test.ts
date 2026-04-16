import { describe, expect, it, vi } from 'vitest';
import { CoreModule } from '../../../src/modules/core/core-module.js';

function makePorts() {
	return {
		eventBus: { on: vi.fn(() => () => {}), onAny: vi.fn(() => () => {}), emit: vi.fn(), off: vi.fn() },
		logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), setLevel: vi.fn() },
		settings: { load: vi.fn(), save: vi.fn(), subscribe: vi.fn(() => () => {}) },
		notifications: { show: vi.fn() },
		views: { registerAll: vi.fn(), openView: vi.fn() },
	};
}

describe('CoreModule', () => {
	it('has id "core"', () => {
		expect(CoreModule.id).toBe('core');
	});

	it('has settingsKey "core"', () => {
		expect(CoreModule.settingsKey).toBe('core');
	});

	it('init() logs initialization message with logLevel', async () => {
		const ports = makePorts();
		await CoreModule.init(ports, { showRibbonIcon: true, defaultView: 'home', logLevel: 'debug' });
		expect(ports.logger.info).toHaveBeenCalledWith('core', expect.stringContaining('debug'));
	});

	it('destroy() does not throw', () => {
		expect(() => { CoreModule.destroy(); }).not.toThrow();
	});

	it('commands includes open-homepage', () => {
		const cmd = CoreModule.commands?.find((c) => c.id === 'open-homepage');
		expect(cmd).toBeDefined();
	});

	it('validateSettings rejects non-object', () => {
		const result = CoreModule.validateSettings?.('not-an-object');
		expect(result?.kind).toBe('err');
	});

	it('validateSettings accepts valid settings', () => {
		const result = CoreModule.validateSettings?.({ showRibbonIcon: true, defaultView: 'home', logLevel: 'info' });
		expect(result?.kind).toBe('ok');
	});
});
