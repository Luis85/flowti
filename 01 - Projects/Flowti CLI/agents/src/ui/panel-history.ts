/**
 * History tab — Lit component rendering the activity log filtered by agent.
 * Read-only; subscribes to DashboardStore for reactive updates.
 */

import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { resetStyles, colorStyles, fontStyles, scrollStyles } from "./shared-styles.js";
import type { DashboardStore } from "../store/dashboard-store.js";
import type { ActivityEntry } from "../data/types.js";

@customElement("panel-history")
export class PanelHistory extends LitElement {
	static styles = [
		resetStyles,
		colorStyles,
		fontStyles,
		scrollStyles,
		css`
			:host {
				display: block;
			}

			.history-item {
				padding: 6px 0;
				border-bottom: 1px solid var(--bg-secondary);
				font-size: 12px;
			}

			.history-time {
				color: var(--text-muted);
				font-size: 10px;
			}

			.history-summary {
				margin-top: 2px;
				color: var(--text-primary);
			}

			.empty {
				color: var(--text-muted);
				font-style: italic;
				text-align: center;
				padding: 20px 0;
			}
		`,
	];

	@property({ attribute: false }) store!: DashboardStore;
	@property() agentName = "";

	@state() private entries: readonly ActivityEntry[] = [];

	private storeHandler = () => { this.syncFromStore(); };

	connectedCallback(): void {
		super.connectedCallback();
		if (this.store) {
			this.store.addEventListener("state-changed", this.storeHandler);
			this.syncFromStore();
		}
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		if (this.store) {
			this.store.removeEventListener("state-changed", this.storeHandler);
		}
	}

	private syncFromStore(): void {
		this.entries = this.store.activityLog.filter(
			(entry) => entry.agentName === this.agentName,
		);
	}

	render() {
		if (this.entries.length === 0) {
			return html`<div class="empty">No activity recorded yet.</div>`;
		}

		return html`
			${this.entries.map((entry) => html`
				<div class="history-item">
					<div class="history-time">${entry.timestamp}</div>
					<div class="history-summary">[${entry.type}] ${entry.summary}</div>
				</div>
			`)}
		`;
	}
}
