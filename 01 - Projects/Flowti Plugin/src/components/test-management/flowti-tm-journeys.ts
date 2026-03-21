import { html, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element';
import { tmJourneysStyles } from './flowti-tm-journeys-styles.js';

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
	category?: string;
	domain?: string;
	chapter?: number;
	stepCount: number;
	actors: string[];
	services: string[];
	tools: string[];
	jsonPath: string;
	canvasPath?: string;
	complianceTags: string[];
	runHistory: RunResult[];
	lastRunResult: RunResult | null;
}

type JourneyStatus = 'passing' | 'failing' | 'never-run';

/**
 * Journeys list with master-detail layout, filters, and action buttons.
 *
 * Ports the legacy JourneysTab to Lit. Displays a filterable list of
 * test journeys with run history and traceability details.
 *
 * @property journeys - Array of journey definitions
 * @property searchText - External text filter for journey names
 *
 * @fires run-journey - When "Run journey" button is clicked (detail: { name })
 * @fires request-review - When "Request review" button is clicked (detail: { name })
 * @fires open-builder - When "Open in builder" button is clicked (detail: { name })
 */
export class FlowtiTmJourneys extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		journeys: { type: Array },
		searchText: { type: String },
		selectedJourney: { type: String, state: true },
		typeFilter: { type: String, state: true },
		statusFilter: { type: String, state: true },
	};

	static styles = [
		...FlowtiElement.styles,
		tmJourneysStyles,
	];

	journeys: Journey[] = [];
	searchText = '';
	selectedJourney: string | null = null;
	typeFilter = 'all';
	statusFilter = 'all';

	private getStatus(journey: Journey): JourneyStatus {
		if (!journey.lastRunResult) return 'never-run';
		if (journey.lastRunResult.failed > 0) return 'failing';
		return 'passing';
	}

	private get filteredJourneys(): Journey[] {
		return this.journeys.filter((j) => {
			if (this.searchText && !j.name.toLowerCase().includes(this.searchText.toLowerCase())) {
				return false;
			}
			if (this.typeFilter !== 'all' && j.type !== this.typeFilter) {
				return false;
			}
			if (this.statusFilter !== 'all') {
				const status = this.getStatus(j);
				if (status !== this.statusFilter) return false;
			}
			return true;
		});
	}

	private get selectedJourneyData(): Journey | undefined {
		return this.journeys.find((j) => j.name === this.selectedJourney);
	}

	private onTypeFilterChange(e: Event): void {
		this.typeFilter = (e.target as HTMLSelectElement).value;
	}

	private onStatusFilterChange(e: Event): void {
		this.statusFilter = (e.target as HTMLSelectElement).value;
	}

	private onJourneyClick(name: string): void {
		this.selectedJourney = name;
	}

	private dispatchJourneyEvent(eventName: string, name: string): void {
		this.dispatchEvent(
			new CustomEvent(eventName, {
				detail: { name },
				bubbles: true,
				composed: true,
			}),
		);
	}

	protected renderContent() {
		const filtered = this.filteredJourneys;

		if (filtered.length === 0 && this.journeys.length === 0) {
			return html`<div class="empty-state">No journeys defined</div>`;
		}

		if (filtered.length === 0) {
			return html`
				<div class="journeys-layout">
					${this.renderFilterBar()}
					<div class="empty-state">No journeys match the current filters</div>
				</div>
			`;
		}

		return html`
			<div class="journeys-layout">
				${this.renderFilterBar()}
				<div class="master-detail">
					${this.renderJourneyList(filtered)}
					${this.selectedJourneyData ? this.renderDetailPanel(this.selectedJourneyData) : nothing}
				</div>
			</div>
		`;
	}

	private renderFilterBar() {
		return html`
			<div class="filter-bar">
				<select @change=${this.onTypeFilterChange} .value=${this.typeFilter}>
					<option value="all">All types</option>
					<option value="functional">Functional</option>
					<option value="regression">Regression</option>
					<option value="smoke">Smoke</option>
					<option value="exploratory">Exploratory</option>
					<option value="blueprint">Blueprint</option>
				</select>
				<select @change=${this.onStatusFilterChange} .value=${this.statusFilter}>
					<option value="all">All statuses</option>
					<option value="passing">Passing</option>
					<option value="failing">Failing</option>
					<option value="never-run">Never run</option>
					<option value="stale">Stale</option>
				</select>
			</div>
		`;
	}

	private renderJourneyList(journeys: Journey[]) {
		return html`
			<div class="journey-list">
				${journeys.map((j) => {
					const status = this.getStatus(j);
					const isActive = this.selectedJourney === j.name;
					return html`
						<div
							class="journey-row ${isActive ? 'active' : ''}"
							@click=${() => this.onJourneyClick(j.name)}
						>
							<span class="status-badge ${status}">
								<span class="dot"></span>
								${status}
							</span>
							<span class="journey-name">${j.name}</span>
							<span class="type-badge">${j.type}</span>
							<span class="journey-meta">${j.stepCount} steps</span>
						</div>
					`;
				})}
			</div>
		`;
	}

	private renderDetailPanel(journey: Journey) {
		const status = this.getStatus(journey);
		const sortedHistory = [...journey.runHistory].sort(
			(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
		);

		return html`
			<div class="detail-panel">
				${this.renderDetailHeader(journey, status)}
				${this.renderDetailActions(journey)}
				${this.renderRunHistory(sortedHistory)}
				${this.renderTraceability(journey)}
			</div>
		`;
	}

	private renderDetailHeader(journey: Journey, status: JourneyStatus) {
		return html`
			<div class="detail-header">
				<h3>${journey.name}</h3>
				<div class="detail-meta">
					<span class="status-badge ${status}">
						<span class="dot"></span>
						${status}
					</span>
					<span>${journey.type}</span>
					${journey.domain ? html`<span>${journey.domain}</span>` : nothing}
					<span>${journey.stepCount} steps</span>
				</div>
			</div>
		`;
	}

	private renderDetailActions(journey: Journey) {
		return html`
			<div class="detail-actions">
				<button
					class="builder-btn"
					@click=${() => this.dispatchJourneyEvent('open-builder', journey.name)}
				>Open in builder</button>
				<button
					class="review-btn"
					@click=${() => this.dispatchJourneyEvent('request-review', journey.name)}
				>Request review</button>
				<button
					class="run-btn"
					@click=${() => this.dispatchJourneyEvent('run-journey', journey.name)}
				>Run journey</button>
			</div>
		`;
	}

	private renderRunHistory(runs: RunResult[]) {
		if (runs.length === 0) return nothing;

		return html`
			<div class="run-history">
				<h4>Run History</h4>
				${runs.map(
					(run) => html`
						<div class="run-history-row">
							<span class="run-date">${run.date}</span>
							<span>${run.passed}/${run.totalSteps} passed</span>
							${run.failed > 0
								? html`<span class="run-failed">${run.failed} failed</span>`
								: nothing}
							<span>${run.durationMs}ms</span>
						</div>
					`,
				)}
			</div>
		`;
	}

	private renderTraceability(journey: Journey) {
		const hasActors = journey.actors.length > 0;
		const hasServices = journey.services.length > 0;
		const hasTools = journey.tools.length > 0;

		if (!hasActors && !hasServices && !hasTools) return nothing;

		return html`
			<div class="traceability">
				<h4>Traceability</h4>
				${hasActors
					? html`
						<div class="chip-group">
							<span class="chip-group-label">Actors</span>
							${journey.actors.map((a) => html`<span class="chip">${a}</span>`)}
						</div>
					`
					: nothing}
				${hasServices
					? html`
						<div class="chip-group">
							<span class="chip-group-label">Services</span>
							${journey.services.map((s) => html`<span class="chip">${s}</span>`)}
						</div>
					`
					: nothing}
				${hasTools
					? html`
						<div class="chip-group">
							<span class="chip-group-label">Tools</span>
							${journey.tools.map((t) => html`<span class="chip">${t}</span>`)}
						</div>
					`
					: nothing}
			</div>
		`;
	}
}

if (!customElements.get('flowti-tm-journeys')) customElements.define('flowti-tm-journeys', FlowtiTmJourneys);
