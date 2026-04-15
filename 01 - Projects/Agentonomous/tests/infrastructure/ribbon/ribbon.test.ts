import { describe, expect, it, vi } from 'vitest';
import type { Plugin } from 'obsidian';
import { registerRibbon } from '../../../src/infrastructure/ribbon/ribbon.js';
import { createFakePlugin } from '../obsidian/fake-plugin.js';

describe('registerRibbon', () => {
	it('returns null and does not call addRibbonIcon when visible is false', () => {
		const plugin = createFakePlugin();
		const handle = registerRibbon(plugin as unknown as Plugin, {
			visible: false,
			icon: 'bot',
			title: 'Test',
			onClick: vi.fn(),
		});
		expect(handle).toBeNull();
		expect(plugin.addRibbonIcon).not.toHaveBeenCalled();
	});

	it('calls addRibbonIcon and returns a handle with remove() when visible is true', () => {
		const plugin = createFakePlugin();
		const handle = registerRibbon(plugin as unknown as Plugin, {
			visible: true,
			icon: 'bot',
			title: 'Open Agentonomous',
			onClick: vi.fn(),
		});
		expect(plugin.addRibbonIcon).toHaveBeenCalledWith('bot', 'Open Agentonomous', expect.any(Function));
		expect(handle).not.toBeNull();
		expect(handle?.remove).toBeTypeOf('function');
	});

	it('invokes onClick when the ribbon icon is clicked', () => {
		const plugin = createFakePlugin();
		const onClick = vi.fn();
		registerRibbon(plugin as unknown as Plugin, {
			visible: true,
			icon: 'bot',
			title: 'Open',
			onClick,
		});
		// addRibbonIcon was called with a handler — extract and invoke it
		const handler = plugin.addRibbonIcon.mock.calls[0]?.[2] as () => void;
		handler();
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('handles async onClick without throwing', () => {
		const plugin = createFakePlugin();
		const asyncOnClick = vi.fn(async () => undefined);
		registerRibbon(plugin as unknown as Plugin, {
			visible: true,
			icon: 'bot',
			title: 'Open',
			onClick: asyncOnClick,
		});
		const handler = plugin.addRibbonIcon.mock.calls[0]?.[2] as () => void;
		expect(() => { handler(); }).not.toThrow();
	});

	it('remove() calls el.remove()', () => {
		const plugin = createFakePlugin();
		const handle = registerRibbon(plugin as unknown as Plugin, {
			visible: true,
			icon: 'bot',
			title: 'Open',
			onClick: vi.fn(),
		});
		// The fake addRibbonIcon returns { remove: vi.fn() }
		// Our handle wraps that — calling handle.remove() should call el.remove()
		handle?.remove();
		const el = plugin.addRibbonIcon.mock.results[0]?.value as { remove: ReturnType<typeof vi.fn> };
		expect(el.remove).toHaveBeenCalledTimes(1);
	});
});
