import { html, css } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { statusBadge, emptyState } from '../shared-styles.js';

interface Signal {
	id: string;
	name: string;
	sourcePath: string;
	targetPath: string;
	syncStatus: string;
	lastSyncAt?: string;
}

/**
 * Data Exchange Signals — signal list with sync status.
 *
 * @property signals - Array of signal configuration objects
 * @property searchText - External text filter
 *
 * @fires sync-signal - detail: { signalId }
 * @fires sync-all - When "Sync all" is clicked
 */
export class FlowtiDxSignals extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		signals: { type: Array },
		searchText: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		statusBadge,
		emptyState,
		css`
			.toolbar {
				display: flex;
				justify-content: flex-end;
				margin-bottom: var(--flowti-space-md);
			}

			.signal-list {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-sm);
			}

			.signal-card {
				padding: var(--flowti-space-md);
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
				display: flex;
				align-items: center;
				gap: var(--flowti-space-md);
			}

			.signal-name {
				font-weight: 500;
				flex: 1;
			}

			.signal-meta {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.signal-paths {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
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

	signals: Signal[] = [];
	searchText = '';

	private get filteredSignals(): Signal[] {
		if (!this.searchText) return this.signals;
		const lower = this.searchText.toLowerCase();
		return this.signals.filter((s) =>
			s.name.toLowerCase().includes(lower) ||
			s.sourcePath.toLowerCase().includes(lower),
		);
	}

	private getSyncVariant(status: string): string {
		switch (status) {
			case 'synced': return 'success';
			case 'pending': return 'warning';
			case 'error': return 'error';
			default: return 'muted';
		}
	}

	private dispatchSyncSignal(signalId: string, e: Event): void {
		e.stopPropagation();
		this.dispatchEvent(
			new CustomEvent('sync-signal', {
				detail: { signalId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private dispatchSyncAll(): void {
		this.dispatchEvent(
			new CustomEvent('sync-all', {
				bubbles: true,
				composed: true,
			}),
		);
	}

	protected renderContent() {
		const filtered = this.filteredSignals;

		if (filtered.length === 0 && this.signals.length === 0) {
			return html`
				<div class="empty-state">
					<div class="empty-state__message">No signals configured</div>
				</div>
			`;
		}

		return html`
			${this.signals.length > 0 ? html`
				<div class="toolbar">
					<button @click=${this.dispatchSyncAll}>Sync all</button>
				</div>
			` : ''}
			<div class="signal-list">
				${filtered.length === 0
					? html`<div class="empty-state"><div class="empty-state__message">No matches</div></div>`
					: filtered.map((s) => this.renderSignalCard(s))}
			</div>
		`;
	}

	private renderSignalCard(signal: Signal) {
		const variant = this.getSyncVariant(signal.syncStatus);
		return html`
			<div class="signal-card">
				<span class="status-badge status-badge--${variant}">${signal.syncStatus}</span>
				<span class="signal-name">${signal.name}</span>
				<span class="signal-paths">${signal.sourcePath} → ${signal.targetPath}</span>
				<button @click=${(e: Event) => this.dispatchSyncSignal(signal.id, e)}>Sync</button>
			</div>
		`;
	}
}

if (!customElements.get('flowti-dx-signals')) customElements.define('flowti-dx-signals', FlowtiDxSignals);
