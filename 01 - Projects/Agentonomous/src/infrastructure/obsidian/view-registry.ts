import type { ItemView, Plugin, WorkspaceLeaf } from 'obsidian';
import type { PluginContext } from '../../plugin.js';
import type { ViewRegistryPort } from '../../domain/views/view-registry-port.js';
import type { ViewRegistration as DomainViewRegistration, ViewLocation } from '../../domain/views/view-registration.js';
import type { Result } from '../../domain/shared/result.js';
import { ok, err } from '../../domain/shared/result.js';

export type { ViewLocation };

/** Obsidian-specialized view registration — what modules declare and the adapter calls. */
export type ViewRegistration = DomainViewRegistration<WorkspaceLeaf, ItemView, PluginContext>;

export class ViewRegistry implements ViewRegistryPort<Plugin, PluginContext> {
	private entries: readonly DomainViewRegistration[] = [];

	registerAll(plugin: Plugin, ctx: PluginContext, entries: readonly DomainViewRegistration[]): void {
		this.entries = entries;
		for (const entry of entries) {
			// Domain uses `never` for the factory's leaf/ctx params to stay
			// platform-neutral; narrow to the Obsidian-specialized shape here.
			const concrete = entry as ViewRegistration;
			plugin.registerView(concrete.type, (leaf) => concrete.viewFactory(leaf, ctx));
		}
	}

	async openView(plugin: Plugin, type: string): Promise<Result<void, string>> {
		const entry = this.entries.find((e) => e.type === type) as ViewRegistration | undefined;
		if (entry === undefined) return err(`ViewRegistry: unknown view type "${type}"`);

		const existing = plugin.app.workspace.getLeavesOfType(type);
		if (existing.length > 0 && existing[0] !== undefined) {
			await plugin.app.workspace.revealLeaf(existing[0]);
			return ok(undefined);
		}

		const leaf = this.getLeafForLocation(plugin, entry.defaultLocation);
		await leaf.setViewState({ type, active: true });
		await plugin.app.workspace.revealLeaf(leaf);
		return ok(undefined);
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
