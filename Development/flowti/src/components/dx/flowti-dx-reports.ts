import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { masterDetailLayout, statusBadge, emptyState } from '../shared-styles.js';

interface ReportEntry {
	name: string;
	path: string;
	frontmatter: Record<string, unknown>;
	frontmatterIssues: string[];
}

/**
 * Data Exchange Reports — report list/detail view.
 *
 * @property reports - Array of report entries (CSV doc summaries)
 * @property selectedId - Currently selected report path
 * @property searchText - External text filter
 *
 * @fires select-report - detail: { reportPath }
 * @fires open-report - detail: { reportPath }
 */
export class FlowtiDxReports extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		reports: { type: Array },
		selectedId: { type: String },
		searchText: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		masterDetailLayout,
		statusBadge,
		emptyState,
		css`
			.report-meta {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
			}

			.detail-header {
				margin-bottom: var(--flowti-space-md);
			}

			.detail-header h3 {
				margin: 0;
				font-size: 1rem;
			}

			.detail-field {
				margin-bottom: var(--flowti-space-sm);
			}

			.detail-field__label {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-muted);
				margin-bottom: 2px;
			}

			.detail-field__value {
				font-size: var(--flowti-font-sm);
			}

			.issue-list {
				list-style: none;
				padding: 0;
				margin: 0;
			}

			.issue-item {
				padding: var(--flowti-space-xs);
				font-size: var(--flowti-font-sm);
				color: var(--flowti-color-warning);
			}

			.detail-actions {
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

	reports: ReportEntry[] = [];
	selectedId: string | null = null;
	searchText = '';

	private get filteredReports(): ReportEntry[] {
		if (!this.searchText) return this.reports;
		const lower = this.searchText.toLowerCase();
		return this.reports.filter((r) => r.name.toLowerCase().includes(lower));
	}

	private get selectedReport(): ReportEntry | undefined {
		return this.reports.find((r) => r.path === this.selectedId);
	}

	private onSelectReport(reportPath: string): void {
		this.selectedId = reportPath;
		this.dispatchEvent(
			new CustomEvent('select-report', {
				detail: { reportPath },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private onOpenReport(reportPath: string): void {
		this.dispatchEvent(
			new CustomEvent('open-report', {
				detail: { reportPath },
				bubbles: true,
				composed: true,
			}),
		);
	}

	protected renderContent() {
		const filtered = this.filteredReports;

		if (filtered.length === 0 && this.reports.length === 0) {
			return html`
				<div class="empty-state">
					<div class="empty-state__message">No reports found</div>
				</div>
			`;
		}

		return html`
			<div class="master-detail">
				<div class="master-list">
					${filtered.length === 0
						? html`<div class="empty-state"><div class="empty-state__message">No matches</div></div>`
						: filtered.map((r) => this.renderListItem(r))}
				</div>
				<div class="detail-panel">
					${this.selectedReport ? this.renderDetail(this.selectedReport) : nothing}
				</div>
			</div>
		`;
	}

	private renderListItem(entry: ReportEntry) {
		const isSelected = entry.path === this.selectedId;
		const hasIssues = entry.frontmatterIssues.length > 0;
		return html`
			<div
				class="list-item ${isSelected ? 'list-item--selected' : ''}"
				@click=${() => this.onSelectReport(entry.path)}
			>
				<div>${entry.name}</div>
				${hasIssues ? html`
					<span class="status-badge status-badge--warning">${entry.frontmatterIssues.length} issues</span>
				` : nothing}
			</div>
		`;
	}

	private renderDetail(entry: ReportEntry) {
		return html`
			<div class="detail-header">
				<h3>${entry.name}</h3>
			</div>
			<div class="detail-field">
				<div class="detail-field__label">Path</div>
				<div class="detail-field__value">${entry.path}</div>
			</div>
			${entry.frontmatterIssues.length > 0 ? html`
				<div class="detail-field">
					<div class="detail-field__label">Frontmatter Issues</div>
					<ul class="issue-list">
						${entry.frontmatterIssues.map((issue) => html`<li class="issue-item">${issue}</li>`)}
					</ul>
				</div>
			` : nothing}
			<div class="detail-actions">
				<button @click=${() => this.onOpenReport(entry.path)}>Open report</button>
			</div>
		`;
	}
}

customElements.define('flowti-dx-reports', FlowtiDxReports);
