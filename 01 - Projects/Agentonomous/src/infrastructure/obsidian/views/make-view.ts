import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type { PluginContext } from '../../../plugin.js';
import type { MountedApp } from '../../../ui/app.js';
import type { ViewRegistration } from '../view-registry.js';
import { VIEW_TYPE_MAKE } from '../../../domain/views/view-types.js';

export { VIEW_TYPE_MAKE };

export class MakeView extends ItemView {
	private mounted: MountedApp | null = null;
	private mounting = false;
	private readonly ctx: PluginContext;

	constructor(leaf: WorkspaceLeaf, ctx: PluginContext) {
		super(leaf);
		this.ctx = ctx;
	}

	getViewType(): string { return VIEW_TYPE_MAKE; }
	getDisplayText(): string { return 'Make'; }
	getIcon(): string { return 'hammer'; }

	async onOpen(): Promise<void> {
		if (this.mounted !== null || this.mounting) return;
		this.mounting = true;
		try {
			const { createVueApp } = await import('../../../ui/app.js');
			this.mounted = createVueApp(this.ctx, this.contentEl, '/make');
		} catch (error) {
			this.contentEl.empty();
			this.contentEl.createEl('div', { text: `Make failed to load: ${error instanceof Error ? error.message : String(error)}` });
		} finally {
			this.mounting = false;
		}
	}

	onClose(): Promise<void> {
		this.mounted?.unmount();
		this.mounted = null;
		return Promise.resolve();
	}
}

export const MAKE_VIEW_INTENT = {
	type: VIEW_TYPE_MAKE,
	displayName: 'Make',
	icon: 'hammer',
	defaultLocation: 'main',
} as const;

export const MAKE_VIEW_REGISTRATION: ViewRegistration = {
	...MAKE_VIEW_INTENT,
	viewFactory: (leaf, ctx) => new MakeView(leaf, ctx),
};
