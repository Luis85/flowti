import { LitElement, html, css } from "lit";
import { property } from "lit/decorators.js";
import { resetStyles } from "./shared-styles.js";
import type { DashboardStore } from "../store/dashboard-store.js";

export class DashboardOverlays extends LitElement {
	static styles = [
		resetStyles,
		css`
			:host {
				position: absolute;
				inset: 0;
				pointer-events: none;
				z-index: 10;
				overflow: hidden;
			}
			.arrow {
				position: absolute;
				width: 0;
				height: 0;
				border-left: 5px solid transparent;
				border-right: 5px solid transparent;
				border-bottom: 10px solid rgba(255, 255, 255, 0.7);
				transform-origin: center center;
				transition: opacity 0.3s;
				filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.5));
			}
			.arrow.idle {
				border-bottom-color: rgba(100, 116, 139, 0.4);
			}
		`,
	];

	@property({ attribute: false }) store!: DashboardStore;

	private unsubscribe: (() => void) | null = null;

	connectedCallback(): void {
		super.connectedCallback();
		const handler = () => this.requestUpdate();
		this.store?.addEventListener("state-changed", handler);
		this.unsubscribe = () => this.store?.removeEventListener("state-changed", handler);
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.unsubscribe?.();
	}

	render() {
		const arrows: { name: string; x: number; y: number; angle: number; idle: boolean }[] = [];

		// Show an arrow for every agent that has a known position
		for (const [name, pos] of this.store.agentPositions) {
			const target = this.store.agentTargets.get(name);
			let angle = 180; // default: pointing down (facing user)
			let idle = true;

			if (target) {
				const dx = target.x - pos.x;
				const dy = target.y - pos.y;
				// Only show movement direction if far enough from target
				if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
					angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
					idle = false;
				}
			}

			// Position below the status dot (offset down by ~40px in CSS space)
			arrows.push({ name, x: pos.x, y: pos.y + 40, angle, idle });
		}

		return html`${arrows.map(
			(a) => html`
				<div
					class="arrow ${a.idle ? "idle" : ""}"
					style="left:${a.x}px;top:${a.y}px;transform:translate(-50%,-50%) rotate(${a.angle}deg)"
				></div>
			`,
		)}`;
	}
}

if (!customElements.get("dashboard-overlays")) customElements.define("dashboard-overlays", DashboardOverlays);
