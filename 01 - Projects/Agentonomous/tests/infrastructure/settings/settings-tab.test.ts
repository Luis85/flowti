import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { App, Plugin } from 'obsidian';
import { Setting, _settingsByContainer, _noticeMessages } from '../../__stubs__/obsidian.js';
import { AgentonomousSettingsTab } from '../../../src/infrastructure/settings/settings-tab.js';
import { CORE_SETTINGS_DEFAULTS } from '../../../src/domain/settings/plugin-settings.js';
import { ok, err } from '../../../src/domain/shared/result.js';
import type { SettingsPort } from '../../../src/domain/settings/settings-port.js';
import { fakeTranslation } from '../../__fakes__/fake-ports.js';

function makePort(overrides: Partial<SettingsPort> = {}): SettingsPort {
	return {
		load: vi.fn(async () => ok(CORE_SETTINGS_DEFAULTS)),
		save: vi.fn(async () => ok(undefined as void)),
		subscribe: vi.fn(() => () => {}),
		...overrides,
	};
}

function makeTab(port: SettingsPort): AgentonomousSettingsTab {
	const fakeApp = { workspace: {} } as unknown as App;
	const fakePlugin = {} as unknown as Plugin;
	return new AgentonomousSettingsTab(fakeApp, fakePlugin, port, fakeTranslation());
}

/** Create an augmented container element matching the stub's augmentEl shape. */
function makeContainer(): HTMLElement & { createEl: (tag: string, opts?: { text?: string }) => HTMLElement; empty: () => void } {
	const el = document.createElement('div') as HTMLElement & {
		createEl: (tag: string, opts?: { text?: string }) => HTMLElement;
		empty: () => void;
	};
	el.createEl = (tag: string, opts?: { text?: string }): HTMLElement => {
		const child = document.createElement(tag);
		if (opts?.text !== undefined) child.textContent = opts.text;
		el.appendChild(child);
		return child;
	};
	el.empty = () => { el.innerHTML = ''; };
	return el;
}

describe('AgentonomousSettingsTab', () => {
	beforeEach(() => {
		// Clear the shared Notice log between tests.
		_noticeMessages.splice(0);
	});

	it('constructs without throwing', () => {
		const tab = makeTab(makePort());
		expect(tab).toBeDefined();
	});

	it('display() loads settings and renders without throwing', async () => {
		const port = makePort();
		const tab = makeTab(port);
		expect(() => { tab.display(); }).not.toThrow();
		await new Promise((r) => { setTimeout(r, 0); });
		expect(port.load).toHaveBeenCalled();
	});

	it('display() shows a Notice when load fails and falls back to defaults', async () => {
		const port = makePort({ load: vi.fn(async () => err('disk error')) });
		const tab = makeTab(port);
		expect(() => { tab.display(); }).not.toThrow();
		await new Promise((r) => { setTimeout(r, 0); });
		expect(port.load).toHaveBeenCalled();
	});

	it('stub Setting._toggles threads the onChange callback via _trigger', () => {
		// Verify the stub correctly wires toggle callbacks so downstream tests work.
		const container = makeContainer();
		const setting = new Setting(container);
		let received: boolean | undefined;
		setting.addToggle((toggle) => {
			toggle.setValue(true);
			toggle.onChange((v) => { received = v; });
		});
		expect(setting._toggles).toHaveLength(1);
		// Callback must not be null — silent-pass guard is gone
		expect(setting._toggles[0]._onChange).not.toBeNull();
		setting._toggles[0]._trigger(false);
		expect(received).toBe(false);
	});

	it('stub Setting._dropdowns threads the onChange callback via _trigger', () => {
		const container = makeContainer();
		const setting = new Setting(container);
		let received: string | undefined;
		setting.addDropdown((dropdown) => {
			dropdown.addOption('home', 'Home');
			dropdown.setValue('home');
			dropdown.onChange((v) => { received = v; });
		});
		expect(setting._dropdowns).toHaveLength(1);
		expect(setting._dropdowns[0]._onChange).not.toBeNull();
		setting._dropdowns[0]._trigger('about');
		expect(received).toBe('about');
	});

	it('persist() calls port.save with updated settings', async () => {
		const port = makePort();
		const tab = makeTab(port);
		tab.display();
		await new Promise((r) => { setTimeout(r, 0); });
		const persist = (tab as unknown as { persist: (s: typeof CORE_SETTINGS_DEFAULTS) => Promise<void> }).persist;
		await persist.call(tab, { ...CORE_SETTINGS_DEFAULTS, showRibbonIcon: false });
		expect(port.save).toHaveBeenCalledWith({ ...CORE_SETTINGS_DEFAULTS, showRibbonIcon: false });
	});

	it('persist() shows Notice when save fails', async () => {
		const port = makePort({ save: vi.fn(async () => err('write failed')) });
		const tab = makeTab(port);
		tab.display();
		await new Promise((r) => { setTimeout(r, 0); });
		const persist = (tab as unknown as { persist: (s: typeof CORE_SETTINGS_DEFAULTS) => Promise<void> }).persist;
		await expect(persist.call(tab, CORE_SETTINGS_DEFAULTS)).resolves.toBeUndefined();
		expect(port.save).toHaveBeenCalled();
	});

	it('display() toggle onChange calls port.save with updated showRibbonIcon', async () => {
		const port = makePort();
		const tab = makeTab(port);
		tab.display();
		await new Promise((r) => { setTimeout(r, 0); });

		const container = (tab as unknown as { containerEl: HTMLElement }).containerEl;
		const settings = _settingsByContainer.get(container) ?? [];
		// First Setting is the toggle row.
		const toggleSetting = settings[0];
		expect(toggleSetting).toBeDefined();
		const toggle = toggleSetting?._toggles[0];
		expect(toggle).toBeDefined();

		toggle?._trigger(false);
		await new Promise((r) => { setTimeout(r, 0); });

		expect(port.save).toHaveBeenCalledWith({ ...CORE_SETTINGS_DEFAULTS, showRibbonIcon: false });
	});

	it('display() dropdown onChange calls port.save with updated defaultView for valid value', async () => {
		const port = makePort();
		const tab = makeTab(port);
		tab.display();
		await new Promise((r) => { setTimeout(r, 0); });

		const container = (tab as unknown as { containerEl: HTMLElement }).containerEl;
		const settings = _settingsByContainer.get(container) ?? [];
		// Second Setting is the dropdown row.
		const dropdownSetting = settings[1];
		expect(dropdownSetting).toBeDefined();
		const dropdown = dropdownSetting?._dropdowns[0];
		expect(dropdown).toBeDefined();

		dropdown?._trigger('home');
		await new Promise((r) => { setTimeout(r, 0); });

		expect(port.save).toHaveBeenCalledWith({ ...CORE_SETTINGS_DEFAULTS, defaultView: 'home' });
	});

	it('display() dropdown onChange shows Notice for unknown view value and does not save', async () => {
		const port = makePort();
		const tab = makeTab(port);
		tab.display();
		await new Promise((r) => { setTimeout(r, 0); });

		const container = (tab as unknown as { containerEl: HTMLElement }).containerEl;
		const settings = _settingsByContainer.get(container) ?? [];
		const dropdownSetting = settings[1];
		const dropdown = dropdownSetting?._dropdowns[0];

		dropdown?._trigger('bogus');
		await new Promise((r) => { setTimeout(r, 0); });

		// save must not have been called
		expect(port.save).not.toHaveBeenCalled();
		// A Notice must have been shown
		expect(_noticeMessages.some((m) => m.includes('bogus'))).toBe(true);
	});
});
