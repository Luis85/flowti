import { ItemView, type ViewStateResult, type WorkspaceLeaf } from "obsidian";
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
	private savedState: Record<string, unknown> = {};

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

	// NOTE: Obsidian's ItemView constructor calls getViewType() during super(),
	// before this.viewDef is assigned. The factory in sitemap-bootstrap.ts creates
	// a bound subclass that overrides these to return closure-captured values.
	// The ?. guards here are a safety net for direct instantiation (e.g. tests).
	getViewType(): string { return this.viewDef?.type ?? ""; }
	getDisplayText(): string { return this.viewDef?.label ?? ""; }
	getIcon(): string { return this.viewDef?.icon ?? ""; }

	override getState(): Record<string, unknown> {
		const base: Record<string, unknown> = { type: this.viewDef?.type ?? "" };
		if (this.viewDef?.handler) {
			const handler = this.handlerRegistry.getTabHandler(this.viewDef.handler);
			if (handler?.getState) {
				return { ...base, ...handler.getState() };
			}
		}
		return base;
	}

	override async setState(state: Record<string, unknown>, result: ViewStateResult): Promise<void> {
		this.savedState = state;
		await super.setState(state, result);
		this.refresh();
	}

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

		// If handler was not yet available (registered in onLayoutReady),
		// schedule a one-time re-render once layout is ready.
		if (this.viewDef.handler && !this.handlerRegistry.getTabHandler(this.viewDef.handler)) {
			const workspace = (this.app as unknown as { workspace?: { onLayoutReady?: (cb: () => void) => void } }).workspace;
			if (workspace?.onLayoutReady) {
				workspace.onLayoutReady(() => this.refresh());
			}
		}
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
					savedState: Object.keys(this.savedState).length > 0 ? this.savedState : undefined,
				};
				const result = await handler(container, ctx);
				if (typeof result === "function") {
					this.handlerCleanup = result;
				}
			} else {
				// Handler not yet registered (timing gap: views in onload, handlers in onLayoutReady)
				const loading = container.createDiv({ cls: "flowti-loading" });
				loading.setText("Loading...");
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
