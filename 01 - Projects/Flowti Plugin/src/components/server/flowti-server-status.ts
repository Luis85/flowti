import { html, css } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";

/**
 * Displays server running/stopped status with controls.
 *
 * Fires: `server-start`, `server-stop`, `server-restart`, `server-visit`
 * (all bubbles + composed).
 */
export class FlowtiServerStatus extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		running: { type: Boolean, reflect: true },
		pid: { type: Number },
		port: { type: Number },
		uptime: { type: Number },
		url: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		tokens,
		css`
			:host {
				display: block;
				font-size: var(--flowti-font-sm, 0.85em);
			}

			.status-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm, 8px);
				padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 16px);
			}

			.dot {
				width: 8px;
				height: 8px;
				border-radius: 50%;
				flex-shrink: 0;
			}

			.dot--running {
				background: var(--color-green, #4caf50);
			}

			.dot--stopped {
				background: var(--color-red, #e53935);
			}

			.label {
				font-weight: 500;
			}

			.details {
				display: flex;
				flex-wrap: wrap;
				gap: var(--flowti-space-sm, 8px) var(--flowti-space-md, 16px);
				padding: 0 var(--flowti-space-md, 16px) var(--flowti-space-sm, 8px);
				color: var(--text-muted);
			}

			.detail-item {
				display: flex;
				gap: 4px;
			}

			.detail-key {
				opacity: 0.7;
			}

			.actions {
				display: flex;
				gap: var(--flowti-space-sm, 8px);
				padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 16px);
				border-top: 1px solid var(--background-modifier-border);
			}

			button {
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-sm, 8px);
				border-radius: var(--flowti-radius, 4px);
				border: 1px solid var(--background-modifier-border);
				background: none;
				color: var(--text-muted);
				cursor: pointer;
				font-size: 1em;
			}

			button:hover:not(:disabled) {
				background: var(--background-modifier-hover);
				color: var(--text-normal);
			}

			button:disabled {
				opacity: 0.4;
				cursor: not-allowed;
			}

			button.btn--danger:hover:not(:disabled) {
				color: var(--color-red, #e53935);
				border-color: var(--color-red, #e53935);
			}

			button.btn--primary:hover:not(:disabled) {
				color: var(--interactive-accent);
				border-color: var(--interactive-accent);
			}
		`,
	];

	running = false;
	pid = 0;
	port = 0;
	uptime = 0;
	url = "";

	protected renderContent() {
		const dotClass = this.running ? "dot dot--running" : "dot dot--stopped";
		const statusLabel = this.running ? "Running" : "Stopped";

		return html`
			<div class="status-row">
				<span class="${dotClass}"></span>
				<span class="label">${statusLabel}</span>
			</div>
			${this.running ? this.renderDetails() : ""}
			<div class="actions">
				<button
					class="btn--primary"
					?disabled="${this.running}"
					@click="${this.onStart}"
				>Start</button>
				<button
					class="btn--danger"
					?disabled="${!this.running}"
					@click="${this.onStop}"
				>Stop</button>
				<button
					?disabled="${!this.running}"
					@click="${this.onRestart}"
				>Restart</button>
				<button
					?disabled="${!this.running}"
					@click="${this.onVisit}"
				>Visit</button>
			</div>
		`;
	}

	private renderDetails() {
		return html`
			<div class="details">
				<span class="detail-item">
					<span class="detail-key">PID</span>
					<span>${this.pid}</span>
				</span>
				<span class="detail-item">
					<span class="detail-key">Port</span>
					<span>${this.port}</span>
				</span>
				<span class="detail-item">
					<span class="detail-key">Uptime</span>
					<span>${formatUptime(this.uptime)}</span>
				</span>
			</div>
		`;
	}

	private onStart(): void {
		this.dispatchEvent(new CustomEvent("server-start", { bubbles: true, composed: true }));
	}

	private onStop(): void {
		this.dispatchEvent(new CustomEvent("server-stop", { bubbles: true, composed: true }));
	}

	private onRestart(): void {
		this.dispatchEvent(new CustomEvent("server-restart", { bubbles: true, composed: true }));
	}

	private onVisit(): void {
		this.dispatchEvent(new CustomEvent("server-visit", { bubbles: true, composed: true }));
	}
}

/**
 * Format seconds into human-readable uptime.
 * >= 3600s: "Xh Ym"
 * < 3600s: "Xm Ys"
 */
export function formatUptime(seconds: number): string {
	if (seconds >= 3600) {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		return `${hours}h ${minutes}m`;
	}
	const minutes = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${minutes}m ${secs}s`;
}

if (!customElements.get("flowti-server-status")) customElements.define("flowti-server-status", FlowtiServerStatus);
