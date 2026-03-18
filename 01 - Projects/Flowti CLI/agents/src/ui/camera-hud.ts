import { LitElement, html, css } from "lit";
import { property } from "lit/decorators.js";
import { resetStyles, colorStyles, fontStyles } from "./shared-styles.js";
import type { DashboardStore } from "../store/dashboard-store.js";

export class CameraHud extends LitElement {
	static styles = [
		resetStyles,
		colorStyles,
		fontStyles,
		css`
			:host {
				position: absolute;
				top: 12px;
				left: 50%;
				transform: translateX(-50%);
				z-index: 100;
				pointer-events: none;
			}
			.hud {
				display: flex;
				flex-direction: row;
				align-items: center;
				gap: 8px;
				background: var(--bg-panel);
				color: var(--text-primary);
				border: 1px solid var(--border);
				border-radius: 2px;
				padding: 5px 12px;
				font-size: 11px;
				letter-spacing: 0.04em;
				pointer-events: auto;
				white-space: nowrap;
				box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
			}
			.label {
				color: var(--text-muted);
				text-transform: uppercase;
				font-size: 9px;
				letter-spacing: 0.08em;
			}
			.agent-name {
				font-weight: 600;
				color: var(--accent-gold);
				text-shadow: 0 0 6px rgba(217, 170, 78, 0.2);
			}
			.close-btn {
				background: none;
				border: none;
				color: var(--text-muted);
				cursor: pointer;
				font-size: 13px;
				line-height: 1;
				padding: 0 2px;
				border-radius: 2px;
				transition: color 0.15s;
			}
			.close-btn:hover {
				color: var(--accent-gold);
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
		if (!this.store?.followedAgent) {
			return html``;
		}

		return html`
			<div class="hud">
				<span class="label">Following:</span>
				<span class="agent-name">${this.store.followedAgent}</span>
				<button
					class="close-btn"
					aria-label="Stop following"
					@click=${() => this.store.stopFollow()}
				>x</button>
			</div>
		`;
	}
}

if (!customElements.get("camera-hud")) customElements.define("camera-hud", CameraHud);
