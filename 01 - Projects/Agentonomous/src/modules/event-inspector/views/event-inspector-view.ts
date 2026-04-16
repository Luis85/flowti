import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type { PluginContext } from '../../../plugin.js';
import { VIEW_TYPE_EVENT_INSPECTOR } from '../event-inspector-module.js';

export { VIEW_TYPE_EVENT_INSPECTOR };

export class EventInspectorView extends ItemView {
	private mounted: { unmount: () => void } | null = null;
	private mounting = false;
	private readonly ctx: PluginContext;

	constructor(leaf: WorkspaceLeaf, ctx: PluginContext) {
		super(leaf);
		this.ctx = ctx;
	}

	getViewType(): string { return VIEW_TYPE_EVENT_INSPECTOR; }
	getDisplayText(): string { return 'Event inspector'; }
	getIcon(): string { return 'activity'; }

	async onOpen(): Promise<void> {
		if (this.mounted !== null || this.mounting) return;
		this.mounting = true;
		try {
			const { createModuleVueApp } = await import('../../../ui/create-module-vue-app.js');
			const { default: EventInspectorViewComponent } = await import('./EventInspectorView.vue');
			this.mounted = createModuleVueApp(EventInspectorViewComponent, this.ctx, this.contentEl);
		} catch (error) {
			this.contentEl.empty();
			this.contentEl.createEl('div', {
				text: `Event inspector failed to load: ${error instanceof Error ? error.message : String(error)}`,
			});
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
