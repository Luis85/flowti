/**
 * FlowtiModal — Obsidian Modal subclass that renders Lit content.
 *
 * Bridges Obsidian's Modal (chrome, overlay, animations, close button)
 * with Lit web components for the modal body content.
 *
 * Usage:
 *   const modal = new FlowtiModal(app, {
 *     component: 'flowti-confirm-dialog',
 *     properties: { message: 'Are you sure?', confirmLabel: 'Delete' },
 *     onEvent: {
 *       'confirm': () => { doDelete(); modal.close(); },
 *       'cancel': () => { modal.close(); },
 *     },
 *   });
 *   modal.open();
 *
 * The component is created as a child of the modal's contentEl.
 * Event listeners on the component are automatically cleaned up on close.
 */

import { Modal } from "obsidian";
import type { App } from "obsidian";

export interface FlowtiModalConfig {
	/** Tag name of the Lit component to render (e.g. "flowti-confirm-dialog"). */
	component: string;
	/** Properties to set on the Lit element. */
	properties?: Record<string, unknown>;
	/** Event name -> handler map. Listeners are added to the Lit element. */
	onEvent?: Record<string, (e: CustomEvent) => void>;
	/** Optional CSS class to add to the modal container. */
	containerClass?: string;
}

export class FlowtiModal extends Modal {
	private config: FlowtiModalConfig;
	private litElement: HTMLElement | null = null;
	private cleanups: (() => void)[] = [];

	constructor(app: App, config: FlowtiModalConfig) {
		super(app);
		this.config = config;
	}

	onOpen(): void {
		const { contentEl } = this;

		if (this.config.containerClass) {
			this.modalEl.addClass(this.config.containerClass);
		}

		// Create the Lit component
		const el = document.createElement(this.config.component);
		this.litElement = el;

		// Set properties
		if (this.config.properties) {
			for (const [key, value] of Object.entries(this.config.properties)) {
				(el as unknown as Record<string, unknown>)[key] = value;
			}
		}

		// Wire event listeners
		if (this.config.onEvent) {
			for (const [eventName, handler] of Object.entries(this.config.onEvent)) {
				const listener = (e: Event) => handler(e as CustomEvent);
				el.addEventListener(eventName, listener);
				this.cleanups.push(() => el.removeEventListener(eventName, listener));
			}
		}

		// Listen for "modal-close" from any Lit content that uses FlowtiModalContent
		const closeListener = () => this.close();
		el.addEventListener('modal-close', closeListener);
		this.cleanups.push(() => el.removeEventListener('modal-close', closeListener));

		contentEl.appendChild(el);
	}

	onClose(): void {
		// Clean up event listeners
		for (const cleanup of this.cleanups) cleanup();
		this.cleanups = [];
		this.litElement = null;
		this.contentEl.empty();
	}

	/**
	 * Update properties on the rendered Lit element after it's been created.
	 * Useful for reactive updates (e.g. changing loading state).
	 */
	updateProperties(properties: Record<string, unknown>): void {
		if (!this.litElement) return;
		for (const [key, value] of Object.entries(properties)) {
			(this.litElement as unknown as Record<string, unknown>)[key] = value;
		}
	}

	/** Returns the rendered Lit element (for testing or advanced use). */
	getLitElement(): HTMLElement | null {
		return this.litElement;
	}
}
