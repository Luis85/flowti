import { html, css } from 'lit';
import { FlowtiElement } from '../flowti-element';

interface FeatureData {
	featureName: string;
	journeyCount: number;
	journeyNames: string[];
	totalSteps: number;
	passedSteps: number;
	failedSteps: number;
	passRate: number;
	trend: 'improving' | 'stable' | 'degrading';
}

interface JourneyData {
	name: string;
	lastRunResult: { passed: number; totalSteps: number } | null;
	runHistory: unknown[];
}

/**
 * Feature quality master-detail view for test management.
 *
 * Displays a list of features with pass-rate badges on the left,
 * and a detail panel with linked journeys on the right.
 *
 * @property features - Array of feature quality data
 * @property journeys - Array of journey data for cross-referencing
 */
export class FlowtiTmFeatureQuality extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		features: { type: Array },
		journeys: { type: Array },
		selectedFeature: { type: String, state: true },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			.master-detail {
				display: flex;
				gap: var(--flowti-space-md);
				min-height: 200px;
			}

			.master-panel {
				flex: 0 0 280px;
				overflow-y: auto;
				border-right: 1px solid var(--flowti-border, #333);
				padding-right: var(--flowti-space-md);
			}

			.feature-item {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: var(--flowti-space-sm) var(--flowti-space-md);
				border-radius: var(--flowti-radius-sm);
				cursor: pointer;
				transition: background 0.15s ease;
			}

			.feature-item:hover {
				background: var(--flowti-bg-secondary, #1e1e1e);
			}

			.feature-item.active {
				background: var(--flowti-bg-secondary, #1e1e1e);
				outline: 1px solid var(--flowti-info, #58a6ff);
			}

			.feature-name {
				font-size: var(--flowti-font-sm);
				color: var(--flowti-text);
				flex: 1;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.feature-meta {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-xs);
				flex-shrink: 0;
			}

			.journey-count {
				font-size: var(--flowti-font-xs);
				color: var(--flowti-text-muted);
			}

			.pass-rate-badge {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				min-width: 42px;
				padding: 2px var(--flowti-space-xs);
				border-radius: var(--flowti-radius-sm);
				font-size: var(--flowti-font-xs);
				font-weight: 600;
				color: #fff;
			}

			.pass-rate-badge.green {
				background: var(--flowti-success, #3fb950);
			}

			.pass-rate-badge.yellow {
				background: var(--flowti-warning, #d29922);
			}

			.pass-rate-badge.red {
				background: var(--flowti-error, #f85149);
			}

			.detail-panel {
				flex: 1;
				padding: var(--flowti-space-md);
			}

			.detail-header {
				margin-bottom: var(--flowti-space-md);
			}

			.detail-title {
				font-size: var(--flowti-font-lg);
				font-weight: 600;
				color: var(--flowti-text);
				margin: 0 0 var(--flowti-space-sm) 0;
			}

			.detail-badges {
				display: flex;
				flex-wrap: wrap;
				gap: var(--flowti-space-sm);
				align-items: center;
			}

			.detail-badge {
				font-size: var(--flowti-font-xs);
				color: var(--flowti-text-muted);
				background: var(--flowti-bg-secondary, #1e1e1e);
				padding: 2px var(--flowti-space-sm);
				border-radius: var(--flowti-radius-sm);
			}

			.trend {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				font-size: var(--flowti-font-xs);
				padding: 2px var(--flowti-space-sm);
				border-radius: var(--flowti-radius-sm);
				background: var(--flowti-bg-secondary, #1e1e1e);
			}

			.trend.improving {
				color: var(--flowti-success, #3fb950);
			}

			.trend.stable {
				color: var(--flowti-text-muted);
			}

			.trend.degrading {
				color: var(--flowti-error, #f85149);
			}

			.journeys-section {
				margin-top: var(--flowti-space-md);
			}

			.journeys-heading {
				font-size: var(--flowti-font-sm);
				font-weight: 600;
				color: var(--flowti-text-muted);
				margin: 0 0 var(--flowti-space-sm) 0;
			}

			.journey-row {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius-sm);
				font-size: var(--flowti-font-sm);
				color: var(--flowti-text);
			}

			.journey-row:nth-child(even) {
				background: var(--flowti-bg-secondary, #1e1e1e);
			}

			.journey-result {
				font-size: var(--flowti-font-xs);
				color: var(--flowti-text-muted);
			}

			.empty-state {
				display: flex;
				align-items: center;
				justify-content: center;
				padding: var(--flowti-space-xl);
				color: var(--flowti-text-muted);
				font-size: var(--flowti-font-sm);
			}

			.detail-placeholder {
				display: flex;
				align-items: center;
				justify-content: center;
				height: 100%;
				color: var(--flowti-text-muted);
				font-size: var(--flowti-font-sm);
			}
		`,
	];

	features: FeatureData[] = [];
	journeys: JourneyData[] = [];
	selectedFeature: string | null = null;

	private _badgeColor(rate: number): string {
		if (rate >= 70) return 'green';
		if (rate >= 40) return 'yellow';
		return 'red';
	}

	private _trendLabel(trend: string): string {
		switch (trend) {
			case 'improving': return '\u2191 Improving';
			case 'degrading': return '\u2193 Degrading';
			default: return '\u2192 Stable';
		}
	}

	private _selectFeature(name: string): void {
		this.selectedFeature = name;
	}

	private _getSelectedFeature(): FeatureData | undefined {
		return this.features.find(f => f.featureName === this.selectedFeature);
	}

	private _getJourneyResult(name: string): string {
		const journey = this.journeys.find(j => j.name === name);
		if (!journey?.lastRunResult) return 'No runs';
		const { passed, totalSteps } = journey.lastRunResult;
		return `${passed}/${totalSteps} passed`;
	}

	protected renderContent() {
		if (this.features.length === 0) {
			return html`<div class="empty-state">No feature quality data available</div>`;
		}

		const selected = this._getSelectedFeature();

		return html`
			<div class="master-detail">
				<div class="master-panel">
					${this.features.map(f => html`
						<div
							class="feature-item ${f.featureName === this.selectedFeature ? 'active' : ''}"
							@click=${() => this._selectFeature(f.featureName)}
						>
							<span class="feature-name">${f.featureName}</span>
							<div class="feature-meta">
								<span class="journey-count">${f.journeyCount}j</span>
								<span class="pass-rate-badge ${this._badgeColor(f.passRate)}">${f.passRate}%</span>
							</div>
						</div>
					`)}
				</div>
				${selected ? this._renderDetail(selected) : html`
					<div class="detail-panel">
						<div class="detail-placeholder">Select a feature to view details</div>
					</div>
				`}
			</div>
		`;
	}

	private _renderDetail(feature: FeatureData) {
		return html`
			<div class="detail-panel">
				<div class="detail-header">
					<h3 class="detail-title">${feature.featureName}</h3>
					<div class="detail-badges">
						<span class="pass-rate-badge ${this._badgeColor(feature.passRate)}">${feature.passRate}%</span>
						<span class="detail-badge">${feature.journeyCount} journeys</span>
						<span class="detail-badge">${feature.passedSteps}/${feature.totalSteps} steps</span>
						<span class="trend ${feature.trend}">${this._trendLabel(feature.trend)}</span>
					</div>
				</div>
				<div class="journeys-section">
					<h4 class="journeys-heading">Linked journeys</h4>
					${feature.journeyNames.map(name => html`
						<div class="journey-row">
							<span>${name}</span>
							<span class="journey-result">${this._getJourneyResult(name)}</span>
						</div>
					`)}
				</div>
			</div>
		`;
	}
}

if (!customElements.get('flowti-tm-feature-quality')) customElements.define('flowti-tm-feature-quality', FlowtiTmFeatureQuality);
