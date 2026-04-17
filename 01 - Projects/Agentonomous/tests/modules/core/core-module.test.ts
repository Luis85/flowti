import { describe, expect, it, vi } from 'vitest';
import { CoreModule } from '../../../src/modules/core/core-module.js';

function makePorts() {
	return {
		eventBus: { on: vi.fn(() => () => {}), onAny: vi.fn(() => () => {}), emit: vi.fn(), off: vi.fn() },
		logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), setLevel: vi.fn() },
		settings: { load: vi.fn(), save: vi.fn(), loadSection: vi.fn(), saveSection: vi.fn(), subscribe: vi.fn(() => () => {}) },
		notifications: { show: vi.fn() },
		views: { registerAll: vi.fn(), openView: vi.fn() },
	};
}

describe('CoreModule', () => {
	it('has id "core"', () => {
		expect(CoreModule.id).toBe('core');
	});

	it('does not claim the reserved "core" settingsKey — PluginCore owns it', () => {
		expect(CoreModule.settingsKey).toBeUndefined();
	});

	it('init() logs initialization message', async () => {
		const ports = makePorts();
		await CoreModule.init(ports, undefined);
		expect(ports.logger.info).toHaveBeenCalledWith('core', expect.stringContaining('initialized'));
	});

	it('destroy() does not throw', () => {
		expect(() => { CoreModule.destroy(); }).not.toThrow();
	});

	it('commands includes open-homepage', () => {
		const cmd = CoreModule.commands?.find((c) => c.id === 'open-homepage');
		expect(cmd).toBeDefined();
	});

	it('declares the homepage view', () => {
		const homepage = CoreModule.views?.find((v) => v.type === 'agentonomous-homepage');
		expect(homepage).toBeDefined();
	});
});
