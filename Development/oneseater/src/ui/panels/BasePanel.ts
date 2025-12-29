import { EventType, IEventBus } from "src/eventsystem";
import { GameViewModel } from "src/models/GameViewModel";
import { PanelConfig, PanelElements } from "src/ui";

// ═══════════════════════════════════════════════════════════════════════════════
// BASE PANEL CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export abstract class BasePanel<TConfig extends PanelConfig = PanelConfig> {
	// Core references
	protected events: IEventBus;
	protected config: TConfig;
	protected elements: PanelElements | null = null;

	// Lifecycle state
	protected mounted = false;
	protected built = false;

	// Event subscriptions for automatic cleanup
	private subscriptions: Array<{
		eventType: EventType<unknown>;
		handler: (event: unknown) => void;
	}> = [];

	// Change detection cache
	protected cache: Map<string, unknown> = new Map();

	constructor(events: IEventBus, config: TConfig) {
		this.events = events;
		this.config = config;
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// PUBLIC LIFECYCLE
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Mount the panel to a parent element
	 */
	mount(parent: HTMLElement): void {
		if (this.mounted) {
			console.warn(`Panel "${this.config.id}" is already mounted`);
			return;
		}

		// Build DOM structure
		this.elements = this.buildStructure(parent);
		this.mounted = true;

		// Call hook for subclass initialization
		this.onMount();
	}

	/**
	 * Render the panel with new data
	 */
	render(model: GameViewModel): void {
		if (!this.mounted || !this.elements) {
			console.warn(`Panel "${this.config.id}" is not mounted`);
			return;
		}

		// One-time build after first render
		if (!this.built) {
			this.buildContent(this.elements);
			this.built = true;
		}

		// Update content
		this.updateContent(model);
	}

	/**
	 * Destroy the panel and cleanup
	 */
	destroy(): void {
		if (!this.mounted) return;

		// Call hook for subclass cleanup
		this.onDestroy();

		// Unsubscribe all events
		this.clearSubscriptions();

		// Remove DOM
		this.elements?.root.remove();

		// Reset state
		this.elements = null;
		this.mounted = false;
		this.built = false;
		this.cache.clear();
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// PROTECTED HOOKS (Override in subclass)
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Called after mount, before first render
	 * Use for setting up event subscriptions
	 */
	protected onMount(): void {
		// Override in subclass
	}

	/**
	 * Called during destroy, before DOM removal
	 * Use for custom cleanup
	 */
	protected onDestroy(): void {
		// Override in subclass
	}

	/**
	 * Build the panel content (called once on first render)
	 * Use for creating static DOM structure
	 */
	protected abstract buildContent(elements: PanelElements): void;

	/**
	 * Update the panel content (called on every render)
	 * Use for updating dynamic content
	 */
	protected abstract updateContent(model: GameViewModel): void;

	// ─────────────────────────────────────────────────────────────────────────────
	// PROTECTED UTILITIES
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Subscribe to an event with automatic cleanup
	 */
	protected subscribe<T>(
		eventType: EventType<T>,
		handler: (event: T) => void
	): void {
		this.events.subscribe(eventType, handler);
		this.subscriptions.push({
			eventType: eventType as EventType<unknown>,
			handler: handler as (event: unknown) => void,
		});
	}

	/**
	 * Publish an event
	 */
	protected publish<T extends object>(event: T): void {
		this.events.publish(event);
	}

	/**
	 * Check if a value has changed since last render
	 * Returns true if changed, updates cache
	 */
	protected hasChanged<T>(key: string, value: T): boolean {
		const cached = this.cache.get(key);
		if (cached === value) return false;
		this.cache.set(key, value);
		return true;
	}

	/**
	 * Check if multiple values have changed (OR logic)
	 */
	protected hasAnyChanged(changes: Record<string, unknown>): boolean {
		let anyChanged = false;
		for (const [key, value] of Object.entries(changes)) {
			if (this.hasChanged(key, value)) {
				anyChanged = true;
			}
		}
		return anyChanged;
	}

	/**
	 * Get cached value
	 */
	protected getCached<T>(key: string): T | undefined {
		return this.cache.get(key) as T | undefined;
	}

	/**
	 * Set header title dynamically
	 */
	protected setHeaderTitle(text: string): void {
		if (this.elements?.headerTitle) {
			this.elements.headerTitle.textContent = text;
		}
	}

	/**
	 * Add action button to header
	 */
	protected addHeaderAction(
		label: string,
		onClick: () => void,
		options?: { icon?: string; variant?: "primary" | "secondary" | "ghost" }
	): HTMLButtonElement {
		const btn = document.createElement("button");
		btn.className = `mm-panel__header-btn mm-panel__header-btn--${options?.variant ?? "secondary"}`;
		btn.textContent = options?.icon ? `${options.icon} ${label}` : label;
		btn.addEventListener("click", onClick);

		if (this.elements?.headerActions) {
			this.elements.headerActions.appendChild(btn);
		}

		return btn;
	}

	/**
	 * Show/hide the panel
	 */
	protected setVisible(visible: boolean): void {
		if (this.elements?.root) {
			this.elements.root.style.display = visible ? "" : "none";
		}
	}

	/**
	 * Add CSS class to root
	 */
	protected addClass(className: string): void {
		this.elements?.root.classList.add(className);
	}

	/**
	 * Remove CSS class from root
	 */
	protected removeClass(className: string): void {
		this.elements?.root.classList.remove(className);
	}

	/**
	 * Toggle CSS class on root
	 */
	protected toggleClass(className: string, force?: boolean): void {
		this.elements?.root.classList.toggle(className, force);
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// PRIVATE METHODS
	// ─────────────────────────────────────────────────────────────────────────────

	private buildStructure(parent: HTMLElement): PanelElements {
		const { name, title, icon, showHeader, showFooter, cssClasses } = this.config;

		// Root
		const root = parent.createDiv({
			cls: `mm-panel mm-${name} ${cssClasses?.join(" ") ?? ""}`.trim(),
		});
		root.dataset.panelId = this.config.id;

		// Header (optional)
		let header: HTMLElement | undefined;
		let headerTitle: HTMLElement | undefined;
		let headerActions: HTMLElement | undefined;

		const shouldShowHeader = showHeader ?? !!title;
		if (shouldShowHeader) {
			header = root.createDiv({ cls: "mm-panel__header" });

			const titleWrap = header.createDiv({ cls: "mm-panel__header-title-wrap" });

			if (icon) {
				titleWrap.createDiv({ cls: "mm-panel__header-icon", text: icon });
			}

			headerTitle = titleWrap.createDiv({
				cls: "mm-panel__header-title",
				text: title ?? "",
			});

			headerActions = header.createDiv({ cls: "mm-panel__header-actions" });
		}

		// Body (always present)
		const body = root.createDiv({ cls: "mm-panel__body" });

		// Footer (optional)
		let footer: HTMLElement | undefined;
		if (showFooter) {
			footer = root.createDiv({ cls: "mm-panel__footer" });
		}

		return {
			root,
			header,
			headerTitle,
			headerActions,
			body,
			footer,
		};
	}

	private clearSubscriptions(): void {
		for (const { eventType, handler } of this.subscriptions) {
			this.events.unsubscribe(eventType, handler);
		}
		this.subscriptions = [];
	}
}
