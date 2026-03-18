import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { statCardGrid, emptyState } from '../shared-styles.js';

interface HubStat {
	hubId: string;
	label: string;
	icon: string;
	statItems: Array<{ label: string; value: string }>;
}

interface InboxPreviewItem {
	id: string;
	title: string;
	type: string;
	read: boolean;
	sourceEvent: string;
	timestamp: string;
}

interface ActiveSessionInfo {
	id: string;
	title: string;
	type: string;
	status: string;
	durationMinutes: number;
	remainingMs: number;
}

/**
 * User Hub Dashboard — welcome callout, cross-hub stat cards,
 * inbox preview, and active session card.
 *
 * @property hubStats - Array of hub stat summary objects
 * @property inboxPreview - Array of inbox items for preview
 * @property activeSession - Active session object (or null)
 * @property showWelcome - Whether to show the welcome callout
 *
 * @fires navigate-hub - detail: { hubId } when a hub stat card is clicked
 * @fires open-inbox - When "View all" inbox link is clicked
 * @fires open-session - detail: { sessionId } when active session card is clicked
 */
export class FlowtiUserDashboard extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		hubStats: { type: Array },
		inboxPreview: { type: Array },
		activeSession: { type: Object },
		showWelcome: { type: Boolean },
	};

	static styles = [
		...FlowtiElement.styles,
		statCardGrid,
		emptyState,
		css`
			.dashboard {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-lg);
			}

			.welcome-callout {
				padding: var(--flowti-space-md);
				border-radius: var(--flowti-radius);
				background: color-mix(in srgb, var(--flowti-color-info) 10%, transparent);
				border: 1px solid color-mix(in srgb, var(--flowti-color-info) 30%, transparent);
			}

			.welcome-title {
				font-weight: 600;
				margin-bottom: var(--flowti-space-xs);
			}

			.welcome-description {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.hub-stats-section {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
				gap: var(--flowti-grid-gap);
			}

			.hub-stat-card {
				padding: var(--flowti-space-md);
				background: var(--background-secondary);
				border-radius: var(--flowti-radius);
				cursor: pointer;
			}

			.hub-stat-card:hover {
				background: var(--background-modifier-hover);
			}

			.hub-stat-header {
				font-weight: 500;
				margin-bottom: var(--flowti-space-sm);
				font-size: var(--flowti-font-sm);
			}

			.hub-stat-items {
				display: flex;
				gap: var(--flowti-space-md);
			}

			.hub-stat-item {
				text-align: center;
			}

			.hub-stat-value {
				font-size: 1.2em;
				font-weight: 700;
			}

			.hub-stat-label {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.inbox-section {
				padding: var(--flowti-space-md);
				background: var(--background-secondary);
				border-radius: var(--flowti-radius);
			}

			.inbox-header {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				margin-bottom: var(--flowti-space-sm);
			}

			.inbox-header-title {
				font-weight: 500;
				font-size: var(--flowti-font-sm);
			}

			.inbox-preview-item {
				padding: var(--flowti-space-xs) 0;
				font-size: var(--flowti-font-sm);
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
			}

			.inbox-unread {
				font-weight: 500;
			}

			.inbox-view-all {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-info);
				cursor: pointer;
				margin-top: var(--flowti-space-sm);
			}

			.inbox-view-all:hover {
				text-decoration: underline;
			}

			.active-session-card {
				padding: var(--flowti-space-md);
				background: color-mix(in srgb, var(--flowti-color-success) 10%, transparent);
				border: 1px solid color-mix(in srgb, var(--flowti-color-success) 30%, transparent);
				border-radius: var(--flowti-radius);
				cursor: pointer;
			}

			.active-session-card:hover {
				background: color-mix(in srgb, var(--flowti-color-success) 15%, transparent);
			}

			.session-title {
				font-weight: 500;
			}

			.session-meta {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				margin-top: var(--flowti-space-xs);
			}
		`,
	];

	hubStats: HubStat[] = [];
	inboxPreview: InboxPreviewItem[] = [];
	activeSession: ActiveSessionInfo | null = null;
	showWelcome = false;

	private dispatchNavigateHub(hubId: string): void {
		this.dispatchEvent(
			new CustomEvent('navigate-hub', {
				detail: { hubId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private dispatchOpenInbox(): void {
		this.dispatchEvent(
			new CustomEvent('open-inbox', {
				bubbles: true,
				composed: true,
			}),
		);
	}

	private dispatchOpenSession(sessionId: string): void {
		this.dispatchEvent(
			new CustomEvent('open-session', {
				detail: { sessionId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	protected renderContent() {
		return html`
			<div class="dashboard">
				${this.renderWelcome()}
				${this.renderActiveSession()}
				${this.renderHubStats()}
				${this.renderInboxPreview()}
			</div>
		`;
	}

	private renderWelcome() {
		if (!this.showWelcome) return nothing;

		return html`
			<div class="welcome-callout">
				<div class="welcome-title">Welcome to your User Hub</div>
				<div class="welcome-description">
					Your personal cockpit — capture ideas, browse commands, manage inbox
					notifications, run focus sessions, and monitor signal connections.
				</div>
			</div>
		`;
	}

	private renderHubStats() {
		if (this.hubStats.length === 0) return nothing;

		return html`
			<div class="hub-stats-section">
				${this.hubStats.map((hub) => this.renderHubStatCard(hub))}
			</div>
		`;
	}

	private renderHubStatCard(hub: HubStat) {
		return html`
			<div class="hub-stat-card" @click=${() => this.dispatchNavigateHub(hub.hubId)}>
				<div class="hub-stat-header">${hub.label}</div>
				<div class="hub-stat-items">
					${hub.statItems.map(
						(item) => html`
							<div class="hub-stat-item">
								<div class="hub-stat-value">${item.value}</div>
								<div class="hub-stat-label">${item.label}</div>
							</div>
						`,
					)}
				</div>
			</div>
		`;
	}

	private renderInboxPreview() {
		if (this.inboxPreview.length === 0) return nothing;

		return html`
			<div class="inbox-section">
				<div class="inbox-header">
					<span class="inbox-header-title">Inbox</span>
				</div>
				${this.inboxPreview.map(
					(item) => html`
						<div class="inbox-preview-item ${item.read ? '' : 'inbox-unread'}">
							<span>${item.title}</span>
						</div>
					`,
				)}
				<div class="inbox-view-all" @click=${() => this.dispatchOpenInbox()}>
					View all
				</div>
			</div>
		`;
	}

	private renderActiveSession() {
		if (!this.activeSession) return nothing;

		return html`
			<div class="active-session-card" @click=${() => this.dispatchOpenSession(this.activeSession!.id)}>
				<div class="session-title">${this.activeSession.title}</div>
				<div class="session-meta">
					${this.activeSession.type} — ${this.activeSession.status}
				</div>
			</div>
		`;
	}
}

if (!customElements.get('flowti-user-dashboard')) customElements.define('flowti-user-dashboard', FlowtiUserDashboard);
