import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import type { ActivityEntry } from '../../domain/server/types.js';

/**
 * Real-time activity feed showing agent actions as a compact log.
 *
 * @property entries - Array of activity entries to display
 * @property paused - Whether auto-scroll is paused
 *
 * @fires feed-pause - When the user pauses the feed
 * @fires feed-resume - When the user resumes the feed
 * @fires feed-clear - When the user clears all entries
 *
 * @example
 * <flowti-activity-feed .entries=${entries} .paused=${false}></flowti-activity-feed>
 */
export class FlowtiActivityFeed extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		entries: { type: Array },
		paused: { type: Boolean, reflect: true },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			:host {
				display: flex;
				flex-direction: column;
				max-height: 400px;
			}

			.toolbar {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-bottom: 1px solid var(--flowti-border);
				flex-shrink: 0;
			}

			.toolbar button {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border: 1px solid var(--flowti-border);
				border-radius: var(--flowti-radius-sm);
				background: var(--flowti-bg-secondary);
				color: var(--flowti-text);
				cursor: pointer;
				font-size: var(--flowti-font-xs);
			}

			.toolbar button:hover {
				background: var(--flowti-bg-hover);
			}

			.entry-count {
				margin-left: auto;
				font-size: var(--flowti-font-xs);
				color: var(--flowti-text-muted);
			}

			.log {
				overflow-y: auto;
				flex: 1;
				padding: var(--flowti-space-xs);
			}

			.log--autoscroll {
				scroll-behavior: smooth;
			}

			.entry {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				font-family: monospace;
				font-size: var(--flowti-font-xs);
				cursor: pointer;
				border-radius: var(--flowti-radius-sm);
				line-height: 1.4;
			}

			.entry:hover {
				background: var(--flowti-bg-secondary);
			}

			.entry-line {
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			.entry-timestamp {
				color: var(--flowti-text-muted);
			}

			.entry-agent {
				color: var(--flowti-info);
				font-weight: 600;
			}

			.entry-action {
				color: var(--flowti-text-muted);
			}

			.entry-text {
				color: var(--flowti-text);
			}

			.entry-expanded {
				margin-top: var(--flowti-space-xs);
				padding: var(--flowti-space-sm);
				background: var(--flowti-bg-secondary);
				border-radius: var(--flowti-radius-sm);
				white-space: pre-wrap;
				word-break: break-word;
				color: var(--flowti-text);
			}

			.empty-state {
				display: flex;
				align-items: center;
				justify-content: center;
				padding: var(--flowti-space-xl);
				color: var(--flowti-text-muted);
				font-size: var(--flowti-font-sm);
			}
		`,
	];

	entries: ActivityEntry[] = [];
	paused = false;

	private formatTimestamp(iso: string): string {
		try {
			const date = new Date(iso);
			const h = String(date.getHours()).padStart(2, '0');
			const m = String(date.getMinutes()).padStart(2, '0');
			const s = String(date.getSeconds()).padStart(2, '0');
			return `${h}:${m}:${s}`;
		} catch {
			return iso;
		}
	}

	private handleTogglePause(): void {
		if (this.paused) {
			this.dispatchEvent(new CustomEvent('feed-resume', { bubbles: true, composed: true }));
		} else {
			this.dispatchEvent(new CustomEvent('feed-pause', { bubbles: true, composed: true }));
		}
	}

	private handleClear(): void {
		this.dispatchEvent(new CustomEvent('feed-clear', { bubbles: true, composed: true }));
	}

	private handleEntryClick(entry: ActivityEntry): void {
		this.entries = this.entries.map(e =>
			e.id === entry.id ? { ...e, expanded: !e.expanded } : e
		);
		this.requestUpdate();
	}

	protected updated(): void {
		if (!this.paused) {
			const log = this.shadowRoot?.querySelector('.log');
			if (log) {
				log.scrollTop = log.scrollHeight;
			}
		}
	}

	protected renderContent() {
		if (this.entries.length === 0) {
			return html`
				${this.renderToolbar()}
				<div class="empty-state">No activity yet</div>
			`;
		}

		return html`
			${this.renderToolbar()}
			<div class="log ${this.paused ? '' : 'log--autoscroll'}">
				${this.entries.map(entry => this.renderEntry(entry))}
			</div>
		`;
	}

	private renderToolbar() {
		return html`
			<div class="toolbar">
				<button class="btn-pause" @click=${this.handleTogglePause}>
					${this.paused ? 'Resume' : 'Pause'}
				</button>
				<button class="btn-clear" @click=${this.handleClear}>Clear</button>
				<span class="entry-count">${this.entries.length} entries</span>
			</div>
		`;
	}

	private renderEntry(entry: ActivityEntry) {
		const time = this.formatTimestamp(entry.timestamp);
		return html`
			<div class="entry" data-id=${entry.id} @click=${() => this.handleEntryClick(entry)}>
				<div class="entry-line">
					<span class="entry-timestamp">[${time}]</span>
					<span class="entry-agent">${entry.agentName}</span>
					<span class="entry-action">${'\u2192'} ${entry.actionType}:</span>
					<span class="entry-text">${entry.text}</span>
				</div>
				${entry.expanded
					? html`<div class="entry-expanded">${entry.text}</div>`
					: nothing}
			</div>
		`;
	}
}

if (!customElements.get('flowti-activity-feed')) customElements.define('flowti-activity-feed', FlowtiActivityFeed);
