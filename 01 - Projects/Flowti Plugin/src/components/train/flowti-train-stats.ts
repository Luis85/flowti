/**
 * Train Stats — stat card grid showing train metrics.
 *
 * Displays: Thoughts, Branches, Chain Length, Elapsed Time.
 * Elapsed time ticks live when the train status is "running".
 *
 * @property train - The current train state object
 * @property chainLength - Length of the main thought chain
 * @property activePosition - Optional { index, total } for "X/Y" display
 *
 * Pure presentation component — no side effects.
 */

import { html, css } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import { statCardGrid } from '../shared-styles.js';

interface TrainData {
	id: string;
	status: string;
	thoughts: { id: string }[];
	relations: { fromId: string; toId: string; direction: string }[];
	createdAt: string;
	pausedAt: string | null;
	completedAt: string | null;
}

export class FlowtiTrainStats extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		train: { type: Object },
		chainLength: { type: Number, attribute: 'chain-length' },
		activePosition: { type: Object },
		branchCount: { type: Number, attribute: 'branch-count' },
	};

	static styles = [
		...FlowtiElement.styles,
		statCardGrid,
		css`
			.stat-grid {
				grid-template-columns: repeat(4, 1fr);
			}

			.stat-card__icon {
				font-size: 1.2em;
				margin-bottom: var(--flowti-space-xs);
				color: var(--flowti-color-muted);
			}
		`,
	];

	train: TrainData | null = null;
	chainLength = 0;
	activePosition: { index: number; total: number } | null = null;
	branchCount = 0;

	private tickTimer: ReturnType<typeof setInterval> | null = null;
	private elapsed = '';

	connectedCallback(): void {
		super.connectedCallback();
		this.startTicking();
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.stopTicking();
	}

	updated(changed: Map<string, unknown>): void {
		if (changed.has('train')) {
			this.stopTicking();
			this.elapsed = this.computeElapsed();
			this.startTicking();
		}
	}

	private startTicking(): void {
		if (this.train?.status === 'running') {
			this.tickTimer = setInterval(() => {
				this.elapsed = this.computeElapsed();
				this.requestUpdate();
			}, 1000);
		}
	}

	private stopTicking(): void {
		if (this.tickTimer !== null) {
			clearInterval(this.tickTimer);
			this.tickTimer = null;
		}
	}

	private computeElapsed(): string {
		if (!this.train?.createdAt) return '\u2014';
		const start = new Date(this.train.createdAt).getTime();
		const end = this.train.completedAt
			? new Date(this.train.completedAt).getTime()
			: (this.train.pausedAt ? new Date(this.train.pausedAt).getTime() : Date.now());
		const diffMs = Math.max(0, end - start);
		const mins = Math.floor(diffMs / 60_000);
		const secs = Math.floor((diffMs % 60_000) / 1000);
		return `${mins}:${String(secs).padStart(2, '0')}`;
	}

	protected renderContent() {
		if (!this.train) return html``;

		const thoughtValue = this.activePosition
			? `${this.activePosition.index + 1}/${this.activePosition.total}`
			: String(this.train.thoughts.length);

		this.elapsed = this.elapsed || this.computeElapsed();

		return html`
			<div class="stat-grid">
				<div class="stat-card">
					<div class="stat-card__value">${thoughtValue}</div>
					<div class="stat-card__label">Thoughts</div>
				</div>
				<div class="stat-card">
					<div class="stat-card__value">${this.branchCount}</div>
					<div class="stat-card__label">Branches</div>
				</div>
				<div class="stat-card">
					<div class="stat-card__value">${this.chainLength}</div>
					<div class="stat-card__label">Chain</div>
				</div>
				<div class="stat-card">
					<div class="stat-card__value">${this.elapsed}</div>
					<div class="stat-card__label">Elapsed</div>
				</div>
			</div>
		`;
	}
}

if (!customElements.get('flowti-train-stats')) customElements.define('flowti-train-stats', FlowtiTrainStats);
