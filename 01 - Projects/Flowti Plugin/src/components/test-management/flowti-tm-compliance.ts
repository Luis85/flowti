import { html, css, nothing } from "lit";
import { FlowtiElement } from "../flowti-element";

interface ComplianceScore {
	standard: string;
	total: number;
	covered: number;
	percentage: number;
	gaps: string[];
}

interface ComplianceCharacteristic {
	id: string;
	standard: string;
	name: string;
	description: string;
	guidance: string;
}

interface Journey {
	name: string;
	complianceTags: string[];
	runHistory: unknown[];
}

const STANDARD_LABELS: Record<string, string> = {
	"iso-9001": "ISO 9001",
	"iso-27001": "ISO 27001",
	"iso-25010": "ISO 25010",
};

export class FlowtiTmCompliance extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		scores: { type: Array },
		characteristicsByStandard: { type: Object },
		journeys: { type: Array },
		selectedStandard: { type: String, state: true },
		expandedCharacteristic: { type: String, state: true },
		showJourneyListFor: { type: String, state: true },
	};

	scores: ComplianceScore[] = [];
	characteristicsByStandard: Record<string, ComplianceCharacteristic[]> = {};
	journeys: Journey[] = [];
	selectedStandard = "iso-9001";
	expandedCharacteristic: string | null = null;
	showJourneyListFor: string | null = null;

	static styles = [
		...FlowtiElement.styles,
		css`
			.compliance-container {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-md, 12px);
			}

			.standards-row {
				display: flex;
				gap: var(--flowti-space-sm, 8px);
			}

			.standard-card {
				flex: 1;
				padding: var(--flowti-space-md, 12px);
				border: 1px solid var(--flowti-border, #444);
				border-radius: var(--flowti-radius-sm, 4px);
				cursor: pointer;
				transition: background 0.15s, border-color 0.15s;
				background: var(--flowti-bg-secondary, #1e1e1e);
			}

			.standard-card:hover {
				border-color: var(--flowti-accent, #7c3aed);
			}

			.standard-card.active {
				border-color: var(--flowti-accent, #7c3aed);
				background: color-mix(in srgb, var(--flowti-accent, #7c3aed) 10%, transparent);
			}

			.standard-label {
				font-weight: 600;
				font-size: var(--flowti-font-sm, 13px);
				margin-bottom: var(--flowti-space-xs, 4px);
			}

			.standard-stats {
				font-size: var(--flowti-font-xs, 11px);
				color: var(--flowti-text-muted, #888);
			}

			.standard-percentage {
				font-size: var(--flowti-font-lg, 18px);
				font-weight: 700;
				margin-top: var(--flowti-space-xs, 4px);
			}

			.characteristics-section {
				border: 1px solid var(--flowti-border, #444);
				border-radius: var(--flowti-radius-sm, 4px);
				overflow: hidden;
			}

			.characteristic-row {
				padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 12px);
				border-bottom: 1px solid var(--flowti-border, #444);
				cursor: pointer;
				transition: background 0.1s;
			}

			.characteristic-row:last-child {
				border-bottom: none;
			}

			.characteristic-row:hover {
				background: var(--flowti-bg-secondary, #1e1e1e);
			}

			.characteristic-row.expanded {
				background: color-mix(in srgb, var(--flowti-accent, #7c3aed) 5%, transparent);
			}

			.char-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
			}

			.char-name {
				font-size: var(--flowti-font-sm, 13px);
				font-weight: 500;
			}

			.char-status {
				font-size: var(--flowti-font-xs, 11px);
				padding: 2px 6px;
				border-radius: var(--flowti-radius-sm, 4px);
			}

			.char-status.covered {
				background: color-mix(in srgb, var(--flowti-success, #22c55e) 15%, transparent);
				color: var(--flowti-success, #22c55e);
			}

			.char-status.uncovered {
				background: color-mix(in srgb, var(--flowti-warning, #f59e0b) 15%, transparent);
				color: var(--flowti-warning, #f59e0b);
			}

			.char-detail {
				margin-top: var(--flowti-space-sm, 8px);
				padding: var(--flowti-space-sm, 8px);
				font-size: var(--flowti-font-xs, 11px);
				color: var(--flowti-text-muted, #888);
				border-top: 1px solid var(--flowti-border, #444);
			}

			.char-detail p {
				margin: var(--flowti-space-xs, 4px) 0;
			}

			.tags-section {
				margin-top: var(--flowti-space-sm, 8px);
				display: flex;
				flex-wrap: wrap;
				gap: var(--flowti-space-xs, 4px);
				align-items: center;
			}

			.compliance-tag {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				padding: 2px 8px;
				border-radius: var(--flowti-radius-sm, 4px);
				background: color-mix(in srgb, var(--flowti-accent, #7c3aed) 15%, transparent);
				color: var(--flowti-accent, #7c3aed);
				font-size: var(--flowti-font-xs, 11px);
			}

			.tag-remove {
				cursor: pointer;
				opacity: 0.7;
				font-weight: 700;
			}

			.tag-remove:hover {
				opacity: 1;
			}

			.tag-journey-btn {
				display: inline-block;
				margin-top: var(--flowti-space-sm, 8px);
				padding: 4px 10px;
				border: 1px solid var(--flowti-border, #444);
				border-radius: var(--flowti-radius-sm, 4px);
				background: transparent;
				color: var(--flowti-text, #ccc);
				font-size: var(--flowti-font-xs, 11px);
				cursor: pointer;
			}

			.tag-journey-btn:hover {
				border-color: var(--flowti-accent, #7c3aed);
			}

			.journey-list {
				margin-top: var(--flowti-space-xs, 4px);
				border: 1px solid var(--flowti-border, #444);
				border-radius: var(--flowti-radius-sm, 4px);
				overflow: hidden;
			}

			.journey-option {
				padding: var(--flowti-space-xs, 4px) var(--flowti-space-sm, 8px);
				font-size: var(--flowti-font-xs, 11px);
				cursor: pointer;
				border-bottom: 1px solid var(--flowti-border, #444);
			}

			.journey-option:last-child {
				border-bottom: none;
			}

			.journey-option:hover {
				background: var(--flowti-bg-secondary, #1e1e1e);
			}

			.no-chars {
				padding: var(--flowti-space-md, 12px);
				color: var(--flowti-text-muted, #888);
				font-size: var(--flowti-font-sm, 13px);
				text-align: center;
			}
		`,
	];

	private getScore(standard: string): ComplianceScore | undefined {
		return this.scores.find((s) => s.standard === standard);
	}

	private isGap(charId: string): boolean {
		const score = this.getScore(this.selectedStandard);
		return score?.gaps.includes(charId) ?? false;
	}

	private getTaggedJourneys(charId: string): Journey[] {
		return this.journeys.filter((j) => j.complianceTags.includes(charId));
	}

	private handleCardClick(standard: string): void {
		this.selectedStandard = standard;
		this.expandedCharacteristic = null;
		this.showJourneyListFor = null;
	}

	private handleCharClick(charId: string): void {
		this.expandedCharacteristic = this.expandedCharacteristic === charId ? null : charId;
		this.showJourneyListFor = null;
	}

	private handleRemoveTag(journeyName: string, tagId: string): void {
		this.dispatchEvent(
			new CustomEvent("remove-tag", {
				detail: { journeyName, tagId },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private handleAddTag(journeyName: string, tagId: string): void {
		this.dispatchEvent(
			new CustomEvent("add-tag", {
				detail: { journeyName, tagId },
				bubbles: true,
				composed: true,
			}),
		);
		this.showJourneyListFor = null;
	}

	private handleTagJourneyBtn(charId: string): void {
		this.showJourneyListFor = this.showJourneyListFor === charId ? null : charId;
	}

	protected renderContent() {
		const chars = this.characteristicsByStandard[this.selectedStandard] ?? [];

		return html`
			<div class="compliance-container">
				<div class="standards-row">
					${this.scores.map(
						(score) => html`
							<div
								class="standard-card ${this.selectedStandard === score.standard ? "active" : ""}"
								@click=${() => this.handleCardClick(score.standard)}
							>
								<div class="standard-label">${STANDARD_LABELS[score.standard] ?? score.standard}</div>
								<div class="standard-stats">${score.covered} / ${score.total}</div>
								<div class="standard-percentage">${score.percentage}%</div>
							</div>
						`,
					)}
				</div>

				<div class="characteristics-section">
					${chars.length === 0
						? html`<div class="no-chars">No characteristics defined</div>`
						: chars.map((ch) => this.renderCharacteristic(ch))}
				</div>
			</div>
		`;
	}

	private renderCharacteristic(ch: ComplianceCharacteristic) {
		const isExpanded = this.expandedCharacteristic === ch.id;
		const gap = this.isGap(ch.id);

		return html`
			<div
				class="characteristic-row ${isExpanded ? "expanded" : ""}"
				@click=${() => this.handleCharClick(ch.id)}
			>
				<div class="char-header">
					<span class="char-name">${ch.name}</span>
					<span class="char-status ${gap ? "uncovered" : "covered"}">
						${gap ? "Uncovered" : "Covered"}
					</span>
				</div>
				${isExpanded ? this.renderCharDetail(ch, gap) : nothing}
			</div>
		`;
	}

	private renderCharDetail(ch: ComplianceCharacteristic, gap: boolean) {
		const taggedJourneys = this.getTaggedJourneys(ch.id);

		return html`
			<div class="char-detail" @click=${(e: Event) => e.stopPropagation()}>
				<p>${ch.description}</p>
				<p>${ch.guidance}</p>
				${gap
					? this.renderUncoveredActions(ch.id)
					: this.renderCoveredTags(ch.id, taggedJourneys)}
			</div>
		`;
	}

	private renderCoveredTags(charId: string, taggedJourneys: Journey[]) {
		return html`
			<div class="tags-section">
				${taggedJourneys.map(
					(j) => html`
						<span class="compliance-tag">
							${j.name}
							<span
								class="tag-remove"
								@click=${() => this.handleRemoveTag(j.name, charId)}
							>&times;</span>
						</span>
					`,
				)}
			</div>
		`;
	}

	private renderUncoveredActions(charId: string) {
		return html`
			<button
				class="tag-journey-btn"
				@click=${() => this.handleTagJourneyBtn(charId)}
			>
				Tag Journey
			</button>
			${this.showJourneyListFor === charId
				? html`
					<div class="journey-list">
						${this.journeys.map(
							(j) => html`
								<div
									class="journey-option"
									@click=${() => this.handleAddTag(j.name, charId)}
								>
									${j.name}
								</div>
							`,
						)}
					</div>
				`
				: nothing}
		`;
	}
}

if (!customElements.get("flowti-tm-compliance")) customElements.define("flowti-tm-compliance", FlowtiTmCompliance);
