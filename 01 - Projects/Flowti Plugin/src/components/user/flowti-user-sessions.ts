import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { masterDetailLayout, statusBadge, emptyState } from '../shared-styles.js';

interface SessionSummary {
	id: string;
	title: string;
	type: string;
	status: string;
	durationMinutes: number;
	createdAt: string;
	goals: Array<{ completed: boolean }>;
}

/** Format seconds into MM:SS display. */
function formatTimer(totalSeconds: number): string {
	const mins = Math.floor(totalSeconds / 60);
	const secs = totalSeconds % 60;
	return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const STATUS_VARIANTS: Record<string, string> = {
	running: 'success',
	active: 'success',
	paused: 'warning',
	prepared: 'muted',
	reviewing: 'info',
	completed: 'muted',
	archived: 'muted',
};

/**
 * User Sessions — session master/detail with timer display and action buttons.
 *
 * @property sessions - Array of session objects
 * @property selectedId - ID of the currently selected session
 * @property searchText - Filter text for session titles
 * @property timerSeconds - Countdown timer value (updated by handler on tick)
 *
 * @fires session-selected - detail: { sessionId } when a session is clicked
 * @fires session-action - detail: { sessionId, action } for start/pause/resume/end
 */
export class FlowtiUserSessions extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		sessions: { type: Array },
		selectedId: { type: String },
		searchText: { type: String },
		timerSeconds: { type: Number },
	};

	static styles = [
		...FlowtiElement.styles,
		masterDetailLayout,
		statusBadge,
		emptyState,
		css`
			.sessions-layout {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-md);
			}

			.session-list {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-xs);
			}

			.session-item {
				padding: var(--flowti-space-sm) var(--flowti-space-md);
				border-radius: var(--flowti-radius);
				cursor: pointer;
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
			}

			.session-item:hover {
				background: var(--background-modifier-hover);
			}

			.session-item--selected {
				background: var(--background-modifier-active-hover);
			}

			.session-title {
				flex: 1;
				font-size: var(--flowti-font-sm);
			}

			.session-type {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.detail-section {
				padding: var(--flowti-space-md);
				background: var(--background-secondary);
				border-radius: var(--flowti-radius);
			}

			.detail-header {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				margin-bottom: var(--flowti-space-md);
			}

			.detail-title {
				font-weight: 600;
				font-size: 1.1em;
			}

			.timer-display {
				font-family: monospace;
				font-size: 1.5em;
				font-weight: 700;
				margin: var(--flowti-space-md) 0;
			}

			.action-bar {
				display: flex;
				gap: var(--flowti-space-sm);
				margin-top: var(--flowti-space-md);
			}

			button {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				border: 1px solid var(--flowti-border);
				background: var(--background-secondary);
				color: var(--flowti-text, inherit);
				font-size: var(--flowti-font-sm);
				cursor: pointer;
			}

			button:hover {
				background: var(--background-modifier-hover);
			}
		`,
	];

	sessions: SessionSummary[] = [];
	selectedId: string | null = null;
	searchText = '';
	timerSeconds = 0;

	private get filteredSessions(): SessionSummary[] {
		if (!this.searchText) return this.sessions;
		const lower = this.searchText.toLowerCase();
		return this.sessions.filter((s) => s.title.toLowerCase().includes(lower));
	}

	private get selectedSession(): SessionSummary | undefined {
		return this.sessions.find((s) => s.id === this.selectedId);
	}

	private dispatchSessionSelected(sessionId: string): void {
		this.dispatchEvent(
			new CustomEvent('session-selected', {
				detail: { sessionId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private dispatchSessionAction(sessionId: string, action: string): void {
		this.dispatchEvent(
			new CustomEvent('session-action', {
				detail: { sessionId, action },
				bubbles: true,
				composed: true,
			}),
		);
	}

	protected renderContent() {
		return html`
			<div class="sessions-layout">
				${this.renderSessionList()}
				${this.renderDetail()}
			</div>
		`;
	}

	private renderSessionList() {
		const filtered = this.filteredSessions;

		if (filtered.length === 0) {
			return html`
				<div class="empty-state">
					<div class="empty-state__message">No sessions found</div>
				</div>
			`;
		}

		return html`
			<div class="session-list">
				${filtered.map((session) => this.renderSessionItem(session))}
			</div>
		`;
	}

	private renderSessionItem(session: SessionSummary) {
		const isSelected = session.id === this.selectedId;
		const variant = STATUS_VARIANTS[session.status] ?? 'muted';

		return html`
			<div
				class="session-item ${isSelected ? 'session-item--selected' : ''}"
				@click=${() => this.dispatchSessionSelected(session.id)}
			>
				<span class="status-badge status-badge--${variant}">${session.status}</span>
				<span class="session-title">${session.title}</span>
				<span class="session-type">${session.type}</span>
			</div>
		`;
	}

	private renderDetail() {
		const session = this.selectedSession;
		if (!session) return nothing;

		return html`
			<div class="detail-section">
				<div class="detail-header">
					<span class="detail-title">${session.title}</span>
					<span class="status-badge status-badge--${STATUS_VARIANTS[session.status] ?? 'muted'}">${session.status}</span>
				</div>
				${this.renderTimer(session)}
				${this.renderActions(session)}
			</div>
		`;
	}

	private renderTimer(session: SessionSummary) {
		if (session.status !== 'running' && session.status !== 'active' && session.status !== 'paused') {
			return nothing;
		}

		return html`
			<div class="timer-display">${formatTimer(this.timerSeconds)}</div>
		`;
	}

	private renderActions(session: SessionSummary) {
		const isRunning = session.status === 'running' || session.status === 'active';
		const isPaused = session.status === 'paused';
		const isPrepared = session.status === 'prepared';

		return html`
			<div class="action-bar">
				${isPrepared ? html`
					<button class="action-start" @click=${(e: Event) => { e.stopPropagation(); this.dispatchSessionAction(session.id, 'start'); }}>
						Start
					</button>
				` : nothing}
				${isRunning ? html`
					<button class="action-pause" @click=${(e: Event) => { e.stopPropagation(); this.dispatchSessionAction(session.id, 'pause'); }}>
						Pause
					</button>
				` : nothing}
				${isPaused ? html`
					<button class="action-resume" @click=${(e: Event) => { e.stopPropagation(); this.dispatchSessionAction(session.id, 'resume'); }}>
						Resume
					</button>
				` : nothing}
				${(isRunning || isPaused) ? html`
					<button class="action-end" @click=${(e: Event) => { e.stopPropagation(); this.dispatchSessionAction(session.id, 'end'); }}>
						Complete
					</button>
				` : nothing}
			</div>
		`;
	}
}

customElements.define('flowti-user-sessions', FlowtiUserSessions);
