import { ItemView, type WorkspaceLeaf } from "obsidian";
import type { ViewDef } from "../../domain/sitemap/plugin-sitemap-types";
import type { PluginHandlerRegistry, TabContext, TabCleanup } from "../../infrastructure/handlers/plugin-handler-registry";
import type { IEventBus } from "../../infrastructure/events/types";

/**
 * Generic leaf/panel view driven by a ViewDef from plugin-sitemap.json.
 *
 * Provides two rendering paths:
 * - **handler**: looks up a TabHandler in the registry and calls it
 * - **component**: creates a custom element (Lit) and appends to container
 *
 * Handler takes priority when both fields are present.
 */
export class SitemapLeafView extends ItemView {
	private viewDef: ViewDef;
	private handlerRegistry: PluginHandlerRegistry;
	private eventBus: IEventBus;
	private unsubscribes: (() => void)[] = [];
	private handlerCleanup: TabCleanup | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		eventBus: IEventBus,
		viewDef: ViewDef,
		handlerRegistry: PluginHandlerRegistry,
	) {
		super(leaf);
		this.viewDef = viewDef;
		this.eventBus = eventBus;
		this.handlerRegistry = handlerRegistry;
	}

	getViewType(): string { return this.viewDef.type; }
	getDisplayText(): string { return this.viewDef.label; }
	getIcon(): string { return this.viewDef.icon; }

	async onOpen(): Promise<void> {
		const container = this.contentEl;
		container.empty();

		if (this.viewDef.refreshEvents) {
			for (const event of this.viewDef.refreshEvents) {
				this.unsubscribes.push(
					this.eventBus.on(event as never, () => this.refresh())
				);
			}
		}

		await this.render(container);
	}

	async onClose(): Promise<void> {
		this.handlerCleanup?.();
		this.handlerCleanup = null;
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
	}

	private async render(container: HTMLElement): Promise<void> {
		this.handlerCleanup?.();
		this.handlerCleanup = null;
		container.empty();

		// Path 1: handler-based rendering (takes priority)
		if (this.viewDef.handler) {
			const handler = this.handlerRegistry.getTabHandler(this.viewDef.handler);
			if (handler) {
				const ctx: TabContext = {
					tabId: "main",
					viewId: this.viewDef.type,
					eventBus: this.eventBus,
					leaf: this.leaf,
				};
				const result = await handler(container, ctx);
				if (typeof result === "function") {
					this.handlerCleanup = result;
				}
			}
			return;
		}

		// Path 2: component-based rendering
		if (this.viewDef.component) {
			const el = document.createElement(this.viewDef.component);
			container.appendChild(el);
		}
	}

	private refresh(): void {
		void this.render(this.contentEl);
	}
}
