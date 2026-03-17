import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element';

interface PyramidLayer {
	count: number;
	passRate: number;
	trend: 'up' | 'down' | 'stable';
}

interface Pyramid {
	e2e: PyramidLayer;
	flow: PyramidLayer;
	unit: PyramidLayer;
}

interface JourneyRunResult {
	date: string;
	totalSteps: number;
	passed: number;
	failed: number;
	skipped: number;
	durationMs: number;
}

interface Journey {
	name: string;
	type: string;
	stepCount: number;
	actors: string[];
	services: string[];
	tools: string[];
	complianceTags: string[];
	jsonPath: string;
	runHistory: JourneyRunResult[];
	lastRunResult: JourneyRunResult;
}

type LayerKey = 'e2e' | 'flow' | 'unit';

const LAYER_LABELS: Record<LayerKey, string> = {
	e2e: 'E2E',
	flow: 'Flow',
	unit: 'Unit',
};

const LAYER_ORDER: LayerKey[] = ['e2e', 'flow', 'unit'];

const TREND_ICONS: Record<string, string> = {
	up: '\u2191',
	down: '\u2193',
	stable: '\u2192',
};

/**
 * Test pyramid visualization component.
 *
 * Renders a master-detail layout with three layer cards (E2E, Flow, Unit)
 * and a drill-down panel for the selected layer.
 *
 * @property pyramid - Object with e2e, flow, unit layer data
 * @property journeys - Array of journey definitions
 * @property hasBaseline - Whether a baseline has been set (shows trend indicators)
 *
 * @fires set-baseline - Emitted when the "Set baseline" button is clicked
 *
 * @example
 * <flowti-tm-pyramid
 *   .pyramid=${{ e2e: { count: 5, passRate: 80, trend: 'up' }, ... }}
 *   .journeys=${journeys}
 *   ?hasBaseline=${true}
 * ></flowti-tm-pyramid>
 */
export class FlowtiTmPyramid extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		pyramid: { type: Object },
		journeys: { type: Array },
		hasBaseline: { type: Boolean },
		selectedLayer: { type: String, state: true },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			:host {
				display: block;
			}

			.pyramid-layout {
				display: flex;
				gap: var(--flowti-space-md, 12px);
			}

			.master-panel {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-sm, 8px);
				flex: 0 0 auto;
				min-width: 180px;
			}

			.detail-panel {
				flex: 1;
				min-width: 0;
			}

			.layer-card {
				padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 12px);
				border-radius: var(--flowti-radius-sm, 4px);
				background: var(--flowti-bg-secondary, #1e1e1e);
				cursor: pointer;
				transition: background 0.15s ease;
			}

			.layer-card:hover {
				background: var(--flowti-bg-hover, #2a2a2a);
			}

			.layer-card.active {
				background: var(--flowti-bg-active, #333);
				outline: 2px solid var(--flowti-accent, #7c3aed);
			}

			.layer-card.dimmed {
				opacity: 0.45;
			}

			.layer-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				margin-bottom: var(--flowti-space-xs, 4px);
			}

			.layer-label {
				font-weight: 600;
				font-size: var(--flowti-font-sm, 0.875rem);
			}

			.layer-stats {
				font-size: var(--flowti-font-xs, 0.75rem);
				color: var(--flowti-text-muted, #888);
			}

			.pyramid-bar-track {
				height: 6px;
				border-radius: 3px;
				background: var(--flowti-bg-tertiary, #2a2a2a);
				overflow: hidden;
				margin-top: var(--flowti-space-xs, 4px);
			}

			.pyramid-bar {
				height: 100%;
				border-radius: 3px;
				background: var(--flowti-accent, #7c3aed);
				transition: width 0.3s ease;
			}

			.trend {
				font-size: var(--flowti-font-xs, 0.75rem);
				margin-left: var(--flowti-space-xs, 4px);
			}

			.drilldown-title {
				font-weight: 600;
				font-size: var(--flowti-font-sm, 0.875rem);
				margin-bottom: var(--flowti-space-sm, 8px);
			}

			.drilldown-row {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-sm, 8px);
				border-radius: var(--flowti-radius-sm, 4px);
				background: var(--flowti-bg-secondary, #1e1e1e);
				margin-bottom: var(--flowti-space-xs, 4px);
				font-size: var(--flowti-font-sm, 0.875rem);
			}

			.drilldown-row .journey-name {
				font-weight: 500;
			}

			.drilldown-row .journey-meta {
				color: var(--flowti-text-muted, #888);
				font-size: var(--flowti-font-xs, 0.75rem);
			}

			.drilldown-summary {
				font-size: var(--flowti-font-sm, 0.875rem);
				color: var(--flowti-text-muted, #888);
				padding: var(--flowti-space-sm, 8px);
			}

			.footer {
				margin-top: var(--flowti-space-md, 12px);
				display: flex;
				justify-content: flex-end;
			}

			.baseline-btn {
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-md, 12px);
				border-radius: var(--flowti-radius-sm, 4px);
				border: 1px solid var(--flowti-border, #444);
				background: var(--flowti-bg-secondary, #1e1e1e);
				color: var(--flowti-text, #ccc);
				cursor: pointer;
				font-size: var(--flowti-font-sm, 0.875rem);
			}

			.baseline-btn:hover {
				background: var(--flowti-bg-hover, #2a2a2a);
			}

			.empty-journeys {
				display: flex;
				align-items: center;
				justify-content: center;
				padding: var(--flowti-space-xl, 24px);
				color: var(--flowti-text-muted, #888);
				font-size: var(--flowti-font-sm, 0.875rem);
			}
		`,
	];

	pyramid: Pyramid = {
		e2e: { count: 0, passRate: 0, trend: 'stable' },
		flow: { count: 0, passRate: 0, trend: 'stable' },
		unit: { count: 0, passRate: 0, trend: 'stable' },
	};
	journeys: Journey[] = [];
	hasBaseline = false;
	selectedLayer: LayerKey = 'e2e';

	protected renderContent() {
		if (this.journeys.length === 0) {
			return html`<div class="empty-journeys">No journeys defined yet</div>`;
		}

		return html`
			<div class="pyramid-layout">
				<div class="master-panel">
					${LAYER_ORDER.map((key) => this.renderLayerCard(key))}
				</div>
				<div class="detail-panel">
					${this.renderDrillDown()}
				</div>
			</div>
			<div class="footer">
				<button class="baseline-btn" @click=${this.onSetBaseline}>Set baseline</button>
			</div>
		`;
	}

	private renderLayerCard(key: LayerKey) {
		const layer = this.pyramid[key];
		const isActive = this.selectedLayer === key;
		const isDimmed = layer.count === 0;
		const classes = [
			'layer-card',
			isActive ? 'active' : '',
			isDimmed ? 'dimmed' : '',
		].filter(Boolean).join(' ');

		return html`
			<div class=${classes} @click=${() => this.onSelectLayer(key)}>
				<div class="layer-header">
					<span class="layer-label">${LAYER_LABELS[key]}</span>
					<span class="layer-stats">
						${layer.count} tests \u00b7 ${layer.passRate}%
						${this.hasBaseline
							? html`<span class="trend">${TREND_ICONS[layer.trend] ?? ''}</span>`
							: nothing
						}
					</span>
				</div>
				<div class="pyramid-bar-track">
					<div class="pyramid-bar" style="width: ${layer.passRate}%"></div>
				</div>
			</div>
		`;
	}

	private renderDrillDown() {
		if (this.selectedLayer === 'e2e') {
			return this.renderE2EDrillDown();
		}
		return this.renderSummaryDrillDown();
	}

	private renderE2EDrillDown() {
		const layer = this.pyramid.e2e;
		return html`
			<div class="drilldown-title">E2E Journeys (${layer.count})</div>
			${this.journeys.map((j) => html`
				<div class="drilldown-row">
					<span class="journey-name">${j.name}</span>
					<span class="journey-meta">
						${j.type} \u00b7 ${j.lastRunResult.passed}/${j.lastRunResult.totalSteps} passed
					</span>
				</div>
			`)}
		`;
	}

	private renderSummaryDrillDown() {
		const key = this.selectedLayer;
		const layer = this.pyramid[key];
		return html`
			<div class="drilldown-title">${LAYER_LABELS[key]} Tests</div>
			<div class="drilldown-summary">
				${layer.count} tests with ${layer.passRate}% pass rate
			</div>
		`;
	}

	private onSelectLayer(key: LayerKey) {
		this.selectedLayer = key;
	}

	private onSetBaseline() {
		this.dispatchEvent(new CustomEvent('set-baseline', { bubbles: true, composed: true }));
	}
}

customElements.define('flowti-tm-pyramid', FlowtiTmPyramid);
