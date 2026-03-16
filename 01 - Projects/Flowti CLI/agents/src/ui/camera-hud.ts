import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { resetStyles, colorStyles, fontStyles } from "./shared-styles.js";
import type { DashboardStore } from "../store/dashboard-store.js";

@customElement("camera-hud")
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
				background: #1e293b;
				color: #e2e8f0;
				border-radius: 6px;
				padding: 6px 12px;
				font-size: 13px;
				pointer-events: auto;
				white-space: nowrap;
				box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
			}
			.label {
				opacity: 0.7;
			}
			.agent-name {
				font-weight: 600;
			}
			.close-btn {
				background: none;
				border: none;
				color: #94a3b8;
				cursor: pointer;
				font-size: 14px;
				line-height: 1;
				padding: 0 2px;
				border-radius: 3px;
				transition: color 0.15s;
			}
			.close-btn:hover {
				color: #e2e8f0;
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
