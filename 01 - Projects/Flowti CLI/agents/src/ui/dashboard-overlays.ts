import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { resetStyles } from "./shared-styles.js";
import type { DashboardStore } from "../store/dashboard-store.js";

@customElement("dashboard-overlays")
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
				border-left: 4px solid transparent;
				border-right: 4px solid transparent;
				border-bottom: 8px solid rgba(255, 255, 255, 0.6);
				transform-origin: center center;
				transition: opacity 0.3s;
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
		const arrows: { name: string; x: number; y: number; angle: number }[] = [];

		for (const [name, target] of this.store.agentTargets) {
			const pos = this.store.agentPositions.get(name);
			if (!pos) continue;

			const dx = target.x - pos.x;
			const dy = target.y - pos.y;
			if (Math.abs(dx) < 2 && Math.abs(dy) < 2) continue;

			const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
			arrows.push({ name, x: pos.x, y: pos.y + 20, angle });
		}

		return html`${arrows.map(
			(a) => html`
				<div
					class="arrow"
					style="left:${a.x}px;top:${a.y}px;transform:translate(-50%,-50%) rotate(${a.angle}deg)"
				></div>
			`,
		)}`;
	}
}
