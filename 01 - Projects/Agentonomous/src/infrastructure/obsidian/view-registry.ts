import type { ItemView, Plugin, WorkspaceLeaf } from 'obsidian';
import type { PluginContext } from '../../plugin.js';

export type ViewLocation = 'main' | 'left' | 'right';

export type ViewRegistration = {
	readonly type: string;
	readonly displayName: string;
	readonly icon: string;
	readonly defaultLocation: ViewLocation;
	readonly viewFactory: (leaf: WorkspaceLeaf, ctx: PluginContext) => ItemView;
};

export class ViewRegistry {
	private readonly entries: readonly ViewRegistration[];

	constructor(entries: readonly ViewRegistration[]) {
		this.entries = entries;
	}

	registerAll(plugin: Plugin, ctx: PluginContext): void {
		for (const entry of this.entries) {
			plugin.registerView(entry.type, (leaf) => entry.viewFactory(leaf, ctx));
		}
	}

	async openView(plugin: Plugin, type: string): Promise<void> {
		const entry = this.entries.find((e) => e.type === type);
		if (entry === undefined) throw new Error(`ViewRegistry: unknown view type "${type}"`);

		const existing = plugin.app.workspace.getLeavesOfType(type);
		if (existing.length > 0 && existing[0] !== undefined) {
			await plugin.app.workspace.revealLeaf(existing[0]);
			return;
		}

		const leaf = this.getLeafForLocation(plugin, entry.defaultLocation);
		await leaf.setViewState({ type, active: true });
		await plugin.app.workspace.revealLeaf(leaf);
	}

	private getLeafForLocation(plugin: Plugin, location: ViewLocation): WorkspaceLeaf {
		switch (location) {
			case 'left': return plugin.app.workspace.getLeftLeaf(false) ?? plugin.app.workspace.getLeaf(true);
			case 'right': return plugin.app.workspace.getRightLeaf(false) ?? plugin.app.workspace.getLeaf(true);
			case 'main':
			default: return plugin.app.workspace.getLeaf(true);
		}
	}
}
