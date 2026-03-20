/**
 * Permissions tab — Lit component rendering pending permission requests with
 * Allow/Deny buttons and a read-only grant history section.
 */

import { html, css, nothing } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles, scrollStyles } from "./game-styles.js";
import type { DashboardStore } from "../store/dashboard-store.js";
import type { PermissionEntry } from "../data/types.js";

export interface PendingPermission {
	readonly tool: string;
	readonly requestedAt: string;
}

export class PanelPermissions extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		store: { attribute: false },
		agentName: { type: String },
		pendingPermissions: { state: true },
		grantHistory: { state: true },
	};

	static styles = [
		...FlowtiElement.styles,
		resetStyles,
		colorStyles,
		fontStyles,
		scrollStyles,
		css`
			:host {
				display: block;
			}

			.permission-item {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 8px 0;
				border-bottom: 1px solid var(--bg-secondary);
			}

			.permission-tool {
				font-weight: 600;
				font-size: 12px;
				color: var(--text-primary);
			}

			.permission-actions {
				display: flex;
				gap: 4px;
			}

			.allow-btn {
				padding: 3px 10px;
				background: #166534;
				border: none;
				border-radius: 4px;
				color: #4ade80;
				font-size: 11px;
				cursor: pointer;
				font-family: inherit;
				transition: background 0.15s;
			}

			.allow-btn:hover {
				background: #15803d;
			}

			.deny-btn {
				padding: 3px 10px;
				background: #7f1d1d;
				border: none;
				border-radius: 4px;
				color: #f87171;
				font-size: 11px;
				cursor: pointer;
				font-family: inherit;
				transition: background 0.15s;
			}

			.deny-btn:hover {
				background: #991b1b;
			}

			.grant-history {
				margin-top: 12px;
				padding-top: 10px;
				border-top: 1px solid var(--border);
			}

			.grant-title {
				font-size: 11px;
				color: var(--text-secondary);
				margin-bottom: 6px;
				text-transform: uppercase;
			}

			.grant-item {
				font-size: 11px;
				padding: 4px 0;
				color: var(--text-secondary);
			}

			.empty {
				color: var(--text-muted);
				font-style: italic;
				text-align: center;
				padding: 20px 0;
			}
		`,
	];

	store!: DashboardStore;
	agentName = "";

	private pendingPermissions: readonly PendingPermission[] = [];
	private grantHistory: readonly PermissionEntry[] = [];

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
		const allPerms = this.store.permissions.get(this.agentName) ?? [];
		this.grantHistory = allPerms;
		// Pull pending permissions from store (populated by permission-request CLI events)
		const pending = this.store.pendingPermissions.get(this.agentName) ?? [];
		this.pendingPermissions = pending.map((p) => ({
			tool: p.tool,
			requestedAt: new Date(p.requestedAt).toLocaleTimeString(),
		}));
	}

	private handleAllow(tool: string): void {
		void this.store.grantPermission(this.agentName, tool, "allow");
	}

	private handleDeny(tool: string): void {
		void this.store.grantPermission(this.agentName, tool, "deny");
	}

	private renderPending() {
		if (this.pendingPermissions.length === 0) {
			return html`<div class="empty">No pending permission requests.</div>`;
		}

		return html`
			${this.pendingPermissions.map((perm) => html`
				<div class="permission-item">
					<span class="permission-tool">${perm.tool}</span>
					<div class="permission-actions">
						<button
							class="allow-btn"
							data-tool="${perm.tool}"
							data-decision="allow"
							@click="${() => { this.handleAllow(perm.tool); }}"
						>Allow</button>
						<button
							class="deny-btn"
							data-tool="${perm.tool}"
							data-decision="deny"
							@click="${() => { this.handleDeny(perm.tool); }}"
						>Deny</button>
					</div>
				</div>
			`)}
		`;
	}

	private renderGrantHistory() {
		if (this.grantHistory.length === 0) return nothing;

		return html`
			<div class="grant-history">
				<div class="grant-title">Grant History</div>
				${this.grantHistory.map((grant) => html`
					<div class="grant-item">
						${grant.tool} (${grant.scope}) — ${grant.grantedAt}
					</div>
				`)}
			</div>
		`;
	}

	protected renderContent() {
		return html`
			${this.renderPending()}
			${this.renderGrantHistory()}
		`;
	}
}

if (!customElements.get("ft-game-panel-permissions")) customElements.define("ft-game-panel-permissions", PanelPermissions);
