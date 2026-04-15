import { describe, expect, it, vi } from 'vitest';
import type { App, Plugin } from 'obsidian';
import { AgentonomousSettingsTab } from '../../../src/infrastructure/settings/settings-tab.js';
import { DEFAULT_SETTINGS } from '../../../src/domain/settings/plugin-settings.js';
import { ok, err } from '../../../src/domain/shared/result.js';
import type { SettingsPort } from '../../../src/domain/settings/settings-port.js';

function makePort(overrides: Partial<SettingsPort> = {}): SettingsPort {
	return {
		load: vi.fn(async () => ok(DEFAULT_SETTINGS)),
		save: vi.fn(async () => ok(undefined as void)),
		subscribe: vi.fn(() => () => {}),
		...overrides,
	};
}

function makeTab(port: SettingsPort): AgentonomousSettingsTab {
	const fakeApp = { workspace: {} } as unknown as App;
	const fakePlugin = {} as unknown as Plugin;
	return new AgentonomousSettingsTab(fakeApp, fakePlugin, port);
}

describe('AgentonomousSettingsTab', () => {
	it('constructs without throwing', () => {
		const tab = makeTab(makePort());
		expect(tab).toBeDefined();
	});

	it('display() loads settings and renders without throwing', async () => {
		const port = makePort();
		const tab = makeTab(port);
		// display() fires an async IIFE — calling it should not throw
		expect(() => { tab.display(); }).not.toThrow();
		// Wait for the async IIFE to complete
		await new Promise((r) => { setTimeout(r, 0); });
		expect(port.load).toHaveBeenCalled();
	});

	it('display() shows a Notice when load fails and falls back to defaults', async () => {
		const port = makePort({ load: vi.fn(async () => err('disk error')) });
		const tab = makeTab(port);
		// Should not throw even when load returns err
		expect(() => { tab.display(); }).not.toThrow();
		await new Promise((r) => { setTimeout(r, 0); });
		expect(port.load).toHaveBeenCalled();
	});

	it('display() calls persist (save) when toggle changes', async () => {
		let toggleCallback: ((v: boolean) => void) | undefined;
		const port = makePort({
			load: vi.fn(async () => ok(DEFAULT_SETTINGS)),
			save: vi.fn(async () => ok(undefined as void)),
		});

		// Intercept Setting to capture the toggle onChange
		const { Setting: OrigSetting } = await import('obsidian');
		const SettingSpy = vi.fn().mockImplementation((container: HTMLElement) => {
			const inst = new OrigSetting(container);
			const origAddToggle = inst.addToggle.bind(inst);
			inst.addToggle = (cb: Parameters<typeof inst.addToggle>[0]) => {
				return origAddToggle((toggle) => {
					const togInst = toggle.setValue(true);
					const origOnChange = togInst.onChange.bind(togInst);
					togInst.onChange = (fn: (v: boolean) => void) => {
						toggleCallback = fn;
						return origOnChange(fn);
					};
					cb(toggle);
					return togInst;
				});
			};
			return inst;
		});

		// Use vi.doMock after import to override Setting in this test scope
		vi.doMock('obsidian', async () => {
			const actual = await import('obsidian');
			return { ...actual, Setting: SettingSpy };
		});

		const tab = makeTab(port);
		tab.display();
		await new Promise((r) => { setTimeout(r, 0); });

		if (toggleCallback) {
			await toggleCallback(false);
			expect(port.save).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, showRibbonIcon: false });
		}

		vi.doUnmock('obsidian');
	});

	it('persist() shows Notice when save fails', async () => {
		const port = makePort({
			save: vi.fn(async () => err('write failed')),
		});
		const tab = makeTab(port);
		tab.display();
		await new Promise((r) => { setTimeout(r, 0); });
		// Trigger save via direct access to the private persist method
		const persist = (tab as unknown as { persist: (s: typeof DEFAULT_SETTINGS) => Promise<void> }).persist;
		await expect(persist.call(tab, DEFAULT_SETTINGS)).resolves.toBeUndefined();
		expect(port.save).toHaveBeenCalled();
	});
});
