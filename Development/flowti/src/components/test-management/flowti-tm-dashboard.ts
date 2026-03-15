import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element';

interface PyramidLevel {
	count: number;
	passRate: number;
	trend: 'up' | 'down' | 'stable';
}

interface Pyramid {
	e2e: PyramidLevel;
	flow: PyramidLevel;
	unit: PyramidLevel;
}

interface RunResult {
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
	lastRunResult: RunResult;
	runHistory: RunResult[];
}

/**
 * Test Management Dashboard — top-level overview of test health.
 *
 * Displays KPI cards, a mini test pyramid, recent run history,
 * and an onboarding callout for new users.
 *
 * @property journeys - Array of journey definitions with run results
 * @property pyramid - Test pyramid summary (e2e, flow, unit)
 * @property recentRuns - Optional override for recent runs list
 * @property onboardingVisible - Show onboarding callout when true
 *
 * @fires navigate-to-tab - When a KPI card is clicked (detail: { tabId })
 */
export class FlowtiTmDashboard extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		journeys: { type: Array },
		pyramid: { type: Object },
		recentRuns: { type: Array },
		onboardingVisible: { type: Boolean, attribute: 'onboarding-visible' },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			:host {
				display: block;
			}

			.dashboard {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-lg);
			}

			/* KPI Grid */
			.kpi-grid {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
				gap: var(--flowti-space-md);
			}

			.kpi-card {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-xs);
				padding: var(--flowti-space-md);
				border-radius: var(--flowti-radius-sm);
				background: var(--flowti-bg-secondary);
				cursor: pointer;
				transition: background 0.15s ease;
			}

			.kpi-card:hover {
				background: var(--flowti-bg-hover, var(--flowti-bg-secondary));
			}

			.kpi-card .kpi-value {
				font-size: var(--flowti-font-xl, 1.5rem);
				font-weight: 600;
				color: var(--flowti-text);
			}

			.kpi-card .kpi-label {
				font-size: var(--flowti-font-xs);
				color: var(--flowti-text-muted);
			}

			/* Mini Pyramid */
			.pyramid-section {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-sm);
			}

			.pyramid-section h3 {
				margin: 0;
				font-size: var(--flowti-font-sm);
				color: var(--flowti-text);
			}

			.pyramid-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
			}

			.pyramid-label {
				width: 48px;
				font-size: var(--flowti-font-xs);
				color: var(--flowti-text-muted);
				text-transform: uppercase;
			}

			.pyramid-track {
				flex: 1;
				height: 8px;
				border-radius: var(--flowti-radius-sm);
				background: var(--flowti-bg-secondary);
				overflow: hidden;
			}

			.pyramid-bar {
				height: 100%;
				border-radius: var(--flowti-radius-sm);
				background: var(--flowti-success);
				transition: width 0.3s ease;
			}

			.pyramid-count {
				min-width: 48px;
				font-size: var(--flowti-font-xs);
				color: var(--flowti-text-muted);
				text-align: right;
			}

			/* Recent Runs */
			.recent-runs {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-sm);
			}

			.recent-runs h3 {
				margin: 0;
				font-size: var(--flowti-font-sm);
				color: var(--flowti-text);
			}

			.run-item {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: var(--flowti-space-sm) var(--flowti-space-md);
				border-radius: var(--flowti-radius-sm);
				background: var(--flowti-bg-secondary);
				font-size: var(--flowti-font-sm);
			}

			.run-item .run-name {
				color: var(--flowti-text);
			}

			.run-item .run-stats {
				color: var(--flowti-text-muted);
				font-size: var(--flowti-font-xs);
			}

			/* Attention Items */
			.attention-section {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-sm);
			}

			.attention-section h3 {
				margin: 0;
				font-size: var(--flowti-font-sm);
				color: var(--flowti-warning);
			}

			.attention-item {
				padding: var(--flowti-space-sm) var(--flowti-space-md);
				border-radius: var(--flowti-radius-sm);
				background: color-mix(in srgb, var(--flowti-warning) 10%, transparent);
				font-size: var(--flowti-font-sm);
				color: var(--flowti-text);
			}

			/* Empty + Onboarding */
			.empty-state {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				gap: var(--flowti-space-md);
				padding: var(--flowti-space-xl);
				color: var(--flowti-text-muted);
				font-size: var(--flowti-font-sm);
				text-align: center;
			}

			.onboarding-callout {
				padding: var(--flowti-space-md);
				border-radius: var(--flowti-radius-sm);
				background: color-mix(in srgb, var(--flowti-info) 10%, transparent);
				border-left: 3px solid var(--flowti-info);
				font-size: var(--flowti-font-sm);
				color: var(--flowti-text);
			}

			.onboarding-callout strong {
				display: block;
				margin-bottom: var(--flowti-space-xs);
			}
		`,
	];

	journeys: Journey[] = [];
	pyramid: Pyramid = {
		e2e: { count: 0, passRate: 0, trend: 'stable' },
		flow: { count: 0, passRate: 0, trend: 'stable' },
		unit: { count: 0, passRate: 0, trend: 'stable' },
	};
	recentRuns: Journey[] = [];
	onboardingVisible = false;

	private navigateToTab(tabId: string): void {
		this.dispatchEvent(
			new CustomEvent('navigate-to-tab', {
				detail: { tabId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private get passingCount(): number {
		return this.journeys.filter(
			(j) => j.lastRunResult && j.lastRunResult.failed === 0,
		).length;
	}

	private get compliancePercent(): number {
		if (this.journeys.length === 0) return 0;
		return Math.round((this.passingCount / this.journeys.length) * 100);
	}

	private get pyramidSummary(): string {
		const total =
			this.pyramid.e2e.count +
			this.pyramid.flow.count +
			this.pyramid.unit.count;
		return `${total} tests`;
	}

	private get attentionItems(): Journey[] {
		return this.journeys.filter(
			(j) => j.lastRunResult && j.lastRunResult.failed > 0,
		);
	}

	private get effectiveRecentRuns(): Journey[] {
		if (this.recentRuns.length > 0) return this.recentRuns;
		return this.journeys.filter((j) => j.lastRunResult);
	}

	protected renderContent() {
		if (this.journeys.length === 0) {
			return this.renderEmptyState();
		}
		return this.renderDashboard();
	}

	private renderEmptyState() {
		return html`
			<div class="empty-state">
				<span>No journeys defined yet. Create your first test journey to get started.</span>
			</div>
			${this.onboardingVisible ? this.renderOnboardingCallout() : nothing}
		`;
	}

	private renderOnboardingCallout() {
		return html`
			<div class="onboarding-callout">
				<strong>Getting Started</strong>
				<span>Define journeys to track end-to-end test coverage across your project.
				Each journey maps a user workflow to a sequence of test steps.</span>
			</div>
		`;
	}

	private renderDashboard() {
		return html`
			<div class="dashboard">
				${this.renderKpiGrid()}
				${this.renderMiniPyramid()}
				${this.renderRecentRuns()}
				${this.renderAttentionItems()}
			</div>
		`;
	}

	private renderKpiGrid() {
		return html`
			<div class="kpi-grid">
				<div class="kpi-card" @click=${() => this.navigateToTab('journeys')}>
					<span class="kpi-value">${this.journeys.length}</span>
					<span class="kpi-label">Journeys</span>
				</div>
				<div class="kpi-card" @click=${() => this.navigateToTab('journeys')}>
					<span class="kpi-value">${this.passingCount}</span>
					<span class="kpi-label">Passing</span>
				</div>
				<div class="kpi-card" @click=${() => this.navigateToTab('pyramid')}>
					<span class="kpi-value">${this.pyramidSummary}</span>
					<span class="kpi-label">Pyramid</span>
				</div>
				<div class="kpi-card" @click=${() => this.navigateToTab('compliance')}>
					<span class="kpi-value">${this.compliancePercent}%</span>
					<span class="kpi-label">Compliance</span>
				</div>
			</div>
		`;
	}

	private renderMiniPyramid() {
		const levels: Array<{ key: keyof Pyramid; label: string }> = [
			{ key: 'e2e', label: 'E2E' },
			{ key: 'flow', label: 'Flow' },
			{ key: 'unit', label: 'Unit' },
		];

		return html`
			<div class="pyramid-section">
				<h3>Test Pyramid</h3>
				${levels.map(
					({ key, label }) => html`
						<div class="pyramid-row">
							<span class="pyramid-label">${label}</span>
							<div class="pyramid-track">
								<div
									class="pyramid-bar"
									style="width: ${this.pyramid[key].passRate}%"
								></div>
							</div>
							<span class="pyramid-count">${this.pyramid[key].count} tests</span>
						</div>
					`,
				)}
			</div>
		`;
	}

	private renderRecentRuns() {
		const runs = this.effectiveRecentRuns;
		if (runs.length === 0) return nothing;

		return html`
			<div class="recent-runs">
				<h3>Recent Runs</h3>
				${runs.map(
					(journey) => html`
						<div class="run-item">
							<span class="run-name">${journey.name}</span>
							<span class="run-stats">
								${journey.lastRunResult.passed}/${journey.lastRunResult.totalSteps} passed
							</span>
						</div>
					`,
				)}
			</div>
		`;
	}

	private renderAttentionItems() {
		const items = this.attentionItems;
		if (items.length === 0) return nothing;

		return html`
			<div class="attention-section">
				<h3>Needs Attention</h3>
				${items.map(
					(journey) => html`
						<div class="attention-item">
							${journey.name} — ${journey.lastRunResult.failed} step${journey.lastRunResult.failed !== 1 ? 's' : ''} failing
						</div>
					`,
				)}
			</div>
		`;
	}
}

customElements.define('flowti-tm-dashboard', FlowtiTmDashboard);
