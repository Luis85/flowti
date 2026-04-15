import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type { PluginContext } from '../../plugin.js';

export const VIEW_TYPE_HOMEPAGE = 'agentonomous-homepage';

type MountedApp = { unmount: () => void };

export class HomepageView extends ItemView {
	private mounted: MountedApp | null = null;
	private readonly ctx: PluginContext;

	constructor(leaf: WorkspaceLeaf, ctx: PluginContext) {
		super(leaf);
		this.ctx = ctx;
	}

	getViewType(): string { return VIEW_TYPE_HOMEPAGE; }
	getDisplayText(): string { return 'Agentonomous homepage'; }
	getIcon(): string { return 'bot'; }

	async onOpen(): Promise<void> {
		try {
			const { createVueApp } = await import('../../ui/app.js');
			this.mounted = createVueApp(this.ctx, this.contentEl);
		} catch (error) {
			this.contentEl.empty();
			this.contentEl.createEl('div', { text: `Agentonomous failed to load: ${error instanceof Error ? error.message : String(error)}` });
		}
	}

	onClose(): Promise<void> {
		this.mounted?.unmount();
		this.mounted = null;
		return Promise.resolve();
	}
}
