import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type { PluginContext } from '../../plugin.js';
import type { MountedApp } from '../../ui/app.js';
import { VIEW_TYPE_HOMEPAGE } from '../../domain/views/view-types.js';
export { VIEW_TYPE_HOMEPAGE };

export class HomepageView extends ItemView {
	private mounted: MountedApp | null = null;
	private mounting = false;
	private readonly ctx: PluginContext;

	constructor(leaf: WorkspaceLeaf, ctx: PluginContext) {
		super(leaf);
		this.ctx = ctx;
	}

	getViewType(): string { return VIEW_TYPE_HOMEPAGE; }
	getDisplayText(): string { return 'Agentonomous homepage'; }
	getIcon(): string { return 'bot'; }

	async onOpen(): Promise<void> {
		if (this.mounted !== null || this.mounting) return;
		this.mounting = true;
		try {
			const { createVueApp } = await import('../../ui/app.js');
			this.mounted = createVueApp(this.ctx, this.contentEl);
		} catch (error) {
			this.contentEl.empty();
			this.contentEl.createEl('div', { text: `Agentonomous failed to load: ${error instanceof Error ? error.message : String(error)}` });
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
