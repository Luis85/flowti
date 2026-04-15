import type { Plugin } from 'obsidian';

export type RibbonHandle = { remove: () => void } | null;

export function registerRibbon(
	plugin: Plugin,
	opts: { visible: boolean; icon: string; title: string; onClick: () => void | Promise<void> },
): RibbonHandle {
	if (!opts.visible) return null;
	const el = plugin.addRibbonIcon(opts.icon, opts.title, () => {
		const result = opts.onClick();
		if (result instanceof Promise) void result;
	});
	return { remove: () => { el.remove(); } };
}
