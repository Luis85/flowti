import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type { PluginContext } from '../../../plugin.js';
import type { MountedModuleApp } from '../../../ui/create-module-vue-app.js';
import type { Unsubscribe } from '../../../domain/shared/unsubscribe.js';
import type { ViewRegistration } from '../view-registry.js';
import {
	VIEW_TYPE_EVENT_INSPECTOR,
	getEventInspectorBuffer,
	getEventInspectorMaxEvents,
	subscribeToEvents,
} from '../../../modules/event-inspector/event-inspector-module.js';
import { useEventInspectorStore } from '../../../ui/stores/event-inspector-store.js';

export { VIEW_TYPE_EVENT_INSPECTOR };

export class EventInspectorView extends ItemView {
	private mounted: MountedModuleApp | null = null;
	private mounting = false;
	private eventsUnsub: Unsubscribe | null = null;
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
			const { default: EventInspectorPanel } = await import('../../../ui/panels/EventInspectorPanel.vue');
			this.mounted = createModuleVueApp(EventInspectorPanel, this.ctx, this.contentEl);

			const store = useEventInspectorStore(this.mounted.pinia);
			store.setMaxEvents(getEventInspectorMaxEvents());
			for (const envelope of getEventInspectorBuffer()) {
				store.addEvent(envelope);
			}
			this.eventsUnsub = subscribeToEvents((envelope) => {
				store.addEvent(envelope);
			});
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
		this.eventsUnsub?.();
		this.eventsUnsub = null;
		this.mounted?.unmount();
		this.mounted = null;
		return Promise.resolve();
	}
}

export const EVENT_INSPECTOR_VIEW_INTENT = {
	type: VIEW_TYPE_EVENT_INSPECTOR,
	displayName: 'Event inspector',
	icon: 'activity',
	defaultLocation: 'right',
} as const;

export const EVENT_INSPECTOR_VIEW_REGISTRATION: ViewRegistration = {
	...EVENT_INSPECTOR_VIEW_INTENT,
	viewFactory: (leaf, ctx) => new EventInspectorView(leaf, ctx),
};
