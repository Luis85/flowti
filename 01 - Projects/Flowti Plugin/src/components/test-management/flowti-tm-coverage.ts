import { html, css } from 'lit';
import { FlowtiElement } from '../flowti-element';
import { computeDomainCoverage, findGaps } from '../../domain/testManagement/coverageCalculator';
import type { CoverageEntry } from '../../domain/testManagement/types';

/**
 * PRD coverage matrix component.
 *
 * Renders a master-detail layout listing PRDs with their coverage status
 * (covered / partial / uncovered). Selecting a PRD shows linked journeys,
 * domain coverage bars, and coverage gaps.
 *
 * @property coverageEntries - Array of CoverageEntry objects
 *
 * @example
 * <flowti-tm-coverage
 *   .coverageEntries=${entries}
 * ></flowti-tm-coverage>
 */
export class FlowtiTmCoverage extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		coverageEntries: { type: Array },
		selectedPrdName: { type: String, state: true },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			:host {
				display: block;
			}

			.master-detail {
				display: flex;
				gap: var(--flowti-space-md, 12px);
			}

			.master-panel {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-xs, 4px);
				flex: 0 0 260px;
				min-width: 200px;
			}

			.prd-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm, 8px);
				padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 12px);
				border-radius: var(--flowti-radius-sm, 4px);
				background: var(--flowti-bg-secondary, #1e1e1e);
				cursor: pointer;
				transition: background 0.15s ease;
				font-size: var(--flowti-font-sm, 0.875rem);
			}

			.prd-row:hover {
				background: var(--flowti-bg-hover, #2a2a2a);
			}

			.prd-row.active {
				background: var(--flowti-bg-active, #333);
				outline: 2px solid var(--flowti-accent, #7c3aed);
			}

			.prd-name {
				flex: 1;
				font-weight: 500;
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.stage-badge {
				font-size: var(--flowti-font-xs, 0.75rem);
				color: var(--flowti-text-muted, #888);
			}

			.journey-count {
				font-size: var(--flowti-font-xs, 0.75rem);
				color: var(--flowti-text-muted, #888);
			}

			.coverage-badge {
				display: inline-block;
				width: 10px;
				height: 10px;
				border-radius: 50%;
				flex-shrink: 0;
			}

			.coverage-badge.covered {
				background: var(--flowti-success, #22c55e);
			}

			.coverage-badge.partial {
				background: var(--flowti-warning, #eab308);
			}

			.coverage-badge.uncovered {
				background: var(--flowti-error, #ef4444);
			}

			.detail-panel {
				flex: 1;
				min-width: 0;
				padding: var(--flowti-space-md, 12px);
				background: var(--flowti-bg-secondary, #1e1e1e);
				border-radius: var(--flowti-radius-sm, 4px);
			}

			.detail-header {
				font-weight: 600;
				font-size: var(--flowti-font-md, 1rem);
				margin-bottom: var(--flowti-space-sm, 8px);
			}

			.detail-section-title {
				font-weight: 600;
				font-size: var(--flowti-font-sm, 0.875rem);
				margin-top: var(--flowti-space-md, 12px);
				margin-bottom: var(--flowti-space-xs, 4px);
				color: var(--flowti-text-muted, #888);
			}

			.journey-list {
				display: flex;
				flex-wrap: wrap;
				gap: var(--flowti-space-xs, 4px);
			}

			.journey-tag {
				padding: 2px var(--flowti-space-sm, 8px);
				border-radius: var(--flowti-radius-sm, 4px);
				background: var(--flowti-bg-tertiary, #2a2a2a);
				font-size: var(--flowti-font-xs, 0.75rem);
			}

			.domain-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm, 8px);
				padding: var(--flowti-space-xs, 4px) 0;
				font-size: var(--flowti-font-sm, 0.875rem);
			}

			.domain-label {
				flex: 0 0 100px;
				font-weight: 500;
			}

			.domain-bar-track {
				flex: 1;
				height: 6px;
				border-radius: 3px;
				background: var(--flowti-bg-tertiary, #2a2a2a);
				overflow: hidden;
			}

			.domain-bar {
				height: 100%;
				border-radius: 3px;
				background: var(--flowti-accent, #7c3aed);
				transition: width 0.3s ease;
			}

			.domain-stat {
				flex: 0 0 60px;
				text-align: right;
				font-size: var(--flowti-font-xs, 0.75rem);
				color: var(--flowti-text-muted, #888);
			}

			.gaps-section {
				margin-top: var(--flowti-space-md, 12px);
				padding: var(--flowti-space-sm, 8px);
				border-radius: var(--flowti-radius-sm, 4px);
				background: color-mix(in srgb, var(--flowti-error, #ef4444) 10%, transparent);
			}

			.gaps-section .gaps-title {
				font-weight: 600;
				font-size: var(--flowti-font-sm, 0.875rem);
				margin-bottom: var(--flowti-space-xs, 4px);
			}

			.gap-item {
				font-size: var(--flowti-font-xs, 0.75rem);
				padding: 2px 0;
				color: var(--flowti-text-muted, #888);
			}

			.no-gaps {
				font-size: var(--flowti-font-xs, 0.75rem);
				color: var(--flowti-text-muted, #888);
			}

			.empty-coverage {
				display: flex;
				align-items: center;
				justify-content: center;
				padding: var(--flowti-space-xl, 24px);
				color: var(--flowti-text-muted, #888);
				font-size: var(--flowti-font-sm, 0.875rem);
			}

			.select-prompt {
				display: flex;
				align-items: center;
				justify-content: center;
				padding: var(--flowti-space-xl, 24px);
				color: var(--flowti-text-muted, #888);
				font-size: var(--flowti-font-sm, 0.875rem);
			}
		`,
	];

	coverageEntries: CoverageEntry[] = [];
	selectedPrdName: string | null = null;

	protected renderContent() {
		if (this.coverageEntries.length === 0) {
			return html`<div class="empty-coverage">No PRD coverage data available</div>`;
		}

		return html`
			<div class="master-detail">
				<div class="master-panel">
					${this.coverageEntries.map((entry) => this.renderPrdRow(entry))}
				</div>
				${this.renderDetail()}
			</div>
		`;
	}

	private renderPrdRow(entry: CoverageEntry) {
		const isActive = this.selectedPrdName === entry.prdName;
		const classes = ['prd-row', isActive ? 'active' : ''].filter(Boolean).join(' ');

		return html`
			<div class=${classes} @click=${() => this.onSelectPrd(entry.prdName)}>
				<span class="coverage-badge ${entry.status}"></span>
				<span class="prd-name">${entry.prdName}</span>
				<span class="stage-badge">${entry.prdStage}</span>
				<span class="journey-count">${entry.journeyCount}</span>
			</div>
		`;
	}

	private renderDetail() {
		const selected = this.coverageEntries.find((e) => e.prdName === this.selectedPrdName);

		if (!selected) {
			return html`<div class="detail-panel select-prompt">Select a PRD to view details</div>`;
		}

		const domainCoverage = computeDomainCoverage(this.coverageEntries);
		const gaps = findGaps(this.coverageEntries);

		return html`
			<div class="detail-panel">
				<div class="detail-header">${selected.prdName}</div>

				<div class="detail-section-title">Linked Journeys</div>
				<div class="journey-list">
					${selected.journeyNames.length > 0
						? selected.journeyNames.map((name) => html`<span class="journey-tag">${name}</span>`)
						: html`<span class="journey-tag">None</span>`
					}
				</div>

				<div class="detail-section-title">Domain Coverage</div>
				${Object.entries(domainCoverage).map(([domain, stats]) => {
					const pct = stats.total > 0 ? Math.round((stats.covered / stats.total) * 100) : 0;
					return html`
						<div class="domain-row">
							<span class="domain-label">${domain}</span>
							<div class="domain-bar-track">
								<div class="domain-bar" style="width: ${pct}%"></div>
							</div>
							<span class="domain-stat">${stats.covered}/${stats.total}</span>
						</div>
					`;
				})}

				<div class="gaps-section">
					<div class="gaps-title">Coverage Gaps</div>
					${gaps.length > 0
						? gaps.map((g) => html`<div class="gap-item">${g.prdName} (${g.prdStage})</div>`)
						: html`<div class="no-gaps">No critical gaps detected</div>`
					}
				</div>
			</div>
		`;
	}

	private onSelectPrd(prdName: string) {
		this.selectedPrdName = prdName;
	}
}

if (!customElements.get('flowti-tm-coverage')) customElements.define('flowti-tm-coverage', FlowtiTmCoverage);
