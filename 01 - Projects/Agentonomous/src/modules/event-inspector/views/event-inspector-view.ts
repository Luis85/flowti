import { ItemView } from 'obsidian';
import { VIEW_TYPE_EVENT_INSPECTOR } from '../event-inspector-module.js';

type MountedView = { unmount: () => void };

export { VIEW_TYPE_EVENT_INSPECTOR };

export class EventInspectorView extends ItemView {
	private mounted: MountedView | null = null;
	private mounting = false;

	getViewType(): string { return VIEW_TYPE_EVENT_INSPECTOR; }
	getDisplayText(): string { return 'Event inspector'; }
	getIcon(): string { return 'activity'; }

	async onOpen(): Promise<void> {
		if (this.mounted !== null || this.mounting) return;
		this.mounting = true;
		try {
			const { createApp } = await import('vue');
			const { default: EventInspectorViewComponent } = await import('./EventInspectorView.vue');
			const app = createApp(EventInspectorViewComponent);
			app.mount(this.contentEl);
			this.mounted = { unmount: () => { app.unmount(); } };
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
